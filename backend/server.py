from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, WebSocket, WebSocketDisconnect, Form
from fastapi.responses import StreamingResponse, RedirectResponse, FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from authlib.integrations.starlette_client import OAuth
from starlette.requests import Request
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Set, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import aiofiles
import json
import io
import httpx
import base64
import zipfile

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# ===================================================================
# MONGODB MULTI-DATABASE SYSTEM
# ===================================================================
class MongoDBManager:
    """Gerencia múltiplos bancos MongoDB automaticamente"""
    def __init__(self, client, base_db_name: str, max_size_gb: float = 0.5):
        self.client = client
        self.base_db_name = base_db_name
        self.max_size_bytes = int(max_size_gb * 1024 * 1024 * 1024)
        self.current_db_index = 0
        self.databases = {0: client[base_db_name]}
        
    async def check_and_rotate(self):
        try:
            current_db = self.databases[self.current_db_index]
            stats = await current_db.command("dbStats")
            current_size = stats.get("dataSize", 0)
            if current_size >= (self.max_size_bytes * 0.8):
                self.current_db_index += 1
                new_db_name = f"{self.base_db_name}_{self.current_db_index}"
                self.databases[self.current_db_index] = self.client[new_db_name]
                logger.warning(f"MongoDB capacity! Creating: {new_db_name}")
                return self.databases[self.current_db_index]
            return current_db
        except:
            return self.databases[self.current_db_index]

mongo_manager = MongoDBManager(client, os.environ['DB_NAME'], max_size_gb=0.5)


# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key-change-this")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

# Storage
STORAGE_MODE = os.environ.get("STORAGE_MODE", "supabase")
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/app/uploads"))
UPLOAD_DIR.mkdir(exist_ok=True, parents=True)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
SUPABASE_BUCKET = os.environ.get("SUPABASE_BUCKET", "uploads")

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000")

# OAuth
oauth = OAuth()
oauth.register(
    name='google',
    client_id=GOOGLE_CLIENT_ID,
    client_secret=GOOGLE_CLIENT_SECRET,
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'}
)

if STORAGE_MODE == "supabase" and (not SUPABASE_URL or not SUPABASE_KEY):
    STORAGE_MODE = "local"

active_connections: Set[WebSocket] = set()

app = FastAPI()

@app.get("/", include_in_schema=False)
def read_root():
    return {"status": "ok", "service": "biblioteca-backend"}

api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ===================================================================
# HELPER FUNCTIONS
# ===================================================================
def serialize_datetime(obj: Any) -> Any:
    """Converte datetime para string ISO 8601 recursivamente"""
    if isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, dict):
        return {k: serialize_datetime(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [serialize_datetime(item) for item in obj]
    return obj

def serialize_document(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Serializa um documento MongoDB para JSON, convertendo datas"""
    if doc is None:
        return None
    doc = dict(doc)
    if '_id' in doc:
        del doc['_id']
    return serialize_datetime(doc)

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: Optional[str] = None
    google_id: Optional[str] = None
    discord_id: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str = "user"
    theme: str = "auto"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class DiscordAuthRequest(BaseModel):
    discordId: str
    email: str
    username: str
    avatar: str
    discriminator: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class Team(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    created_by: str
    members: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TeamCreate(BaseModel):
    name: str
    description: str = ""

class TeamAddMember(BaseModel):
    username: str

class TeamInvite(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    team_id: str
    team_name: str
    inviter_username: str
    invitee_username: str
    status: str = "pending"  # pending, accepted, rejected
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InviteResponse(BaseModel):
    action: str  # "accept" or "reject"

class FileMetadata(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    original_name: str
    file_type: str
    file_size: int
    uploaded_by: str
    team_id: Optional[str] = None
    shared_with: List[str] = []
    is_private: bool = True
    has_password: bool = False
    storage_location: str = "local"
    supabase_path: Optional[str] = None
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FileShare(BaseModel):
    username: str

class FilePasswordVerify(BaseModel):
    password: str

class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    message: str
    role: str = "user"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChatToggle(BaseModel):
    enabled: bool

class ThemeUpdate(BaseModel):
    theme: str

# Storage functions
async def upload_to_supabase(file_content: bytes, file_path: str) -> str:
    url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{file_path}"
    headers = {"Authorization": f"Bearer {SUPABASE_KEY}", "Content-Type": "application/octet-stream"}
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, content=file_content, headers=headers)
        response.raise_for_status()
    return f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_BUCKET}/{file_path}"

async def get_from_supabase(file_path: str) -> bytes:
    url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{file_path}"
    headers = {"Authorization": f"Bearer {SUPABASE_KEY}"}
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        return response.content

async def delete_from_supabase(file_path: str):
    url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{file_path}"
    headers = {"Authorization": f"Bearer {SUPABASE_KEY}"}
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.delete(url, headers=headers)
        response.raise_for_status()

# Auth functions
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user_doc = await db.users.find_one({"username": username}, {"_id": 0})
        if user_doc is None:
            raise HTTPException(status_code=401, detail="User not found")
        return User(**user_doc)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ===================================================================
# STARTUP EVENT
# ===================================================================
@app.on_event("startup")
async def startup_event():
    """Inicializa dados do sistema"""
    # Criar usuário admin se não existir
    admin = await db.users.find_one({"username": "Masterotaku"})
    if not admin:
        admin_user = User(username="Masterotaku", role="admin")
        admin_doc = admin_user.model_dump()
        admin_doc["password_hash"] = pwd_context.hash("adm123")
        admin_doc = serialize_document(admin_doc)
        await db.users.insert_one(admin_doc)
        logger.info("✓ Admin user created: Masterotaku")
    
    # Configuração padrão do chat
    if not await db.settings.find_one({"key": "chat_enabled"}):
        await db.settings.insert_one({"key": "chat_enabled", "value": True})
        logger.info("✓ Chat settings initialized")

# ===================================================================
# AUTH ROUTES
# ===================================================================
@api_router.post("/auth/register", response_model=Token)
async def register(user_create: UserCreate):
    if await db.users.find_one({"username": user_create.username}):
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = pwd_context.hash(user_create.password)
    user = User(username=user_create.username)
    user_dict = user.model_dump()
    user_dict["password_hash"] = hashed_password
    user_dict = serialize_document(user_dict)
    
    await db.users.insert_one(user_dict)
    
    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return Token(access_token=access_token, token_type="bearer", user=user)

@api_router.post("/auth/login", response_model=Token)
async def login(user_login: UserLogin):
    user_doc = await db.users.find_one({"username": user_login.username}, {"_id": 0})
    if not user_doc or not pwd_context.verify(user_login.password, user_doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    
    user = User(**user_doc)
    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return Token(access_token=access_token, token_type="bearer", user=user)

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.get("/me", response_model=User)
async def get_me_alias(current_user: User = Depends(get_current_user)):
    """Alias para /auth/me"""
    return current_user

@api_router.post("/auth/discord", response_model=Token)
async def discord_auth(auth_request: DiscordAuthRequest):
    user_doc = await db.users.find_one({"discord_id": auth_request.discordId}, {"_id": 0})
    
    if not user_doc:
        user = User(
            username=auth_request.username,
            email=auth_request.email,
            discord_id=auth_request.discordId,
            avatar_url=auth_request.avatar
        )
        await db.users.insert_one(user.model_dump())
    else:
        user = User(**user_doc)
    
    access_token = create_access_token(data={"sub": user.username})
    return Token(access_token=access_token, token_type="bearer", user=user)

@api_router.get("/auth/google/login")
async def google_login(request: Request):
    redirect_uri = f"{BACKEND_URL}/api/auth/google/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri)

@api_router.get("/auth/google/callback")
async def google_callback(request: Request):
    try:
        token = await oauth.google.authorize_access_token(request)
        user_info = token.get('userinfo')
        
        if not user_info:
            raise HTTPException(status_code=400, detail="Failed to get user info")
        
        google_id = user_info.get('sub')
        email = user_info.get('email')
        name = user_info.get('name')
        picture = user_info.get('picture')
        
        user_doc = await db.users.find_one({"google_id": google_id}, {"_id": 0})
        
        if not user_doc:
            username = email.split('@')[0]
            counter = 1
            while await db.users.find_one({"username": username}):
                username = f"{email.split('@')[0]}{counter}"
                counter += 1
            
            user = User(username=username, email=email, google_id=google_id, avatar_url=picture)
            await db.users.insert_one(user.model_dump())
        else:
            user = User(**user_doc)
        
        access_token = create_access_token(data={"sub": user.username})
        return RedirectResponse(url=f"{FRONTEND_URL}?token={access_token}")
    except Exception as e:
        logger.error(f"Google auth error: {e}")
        raise HTTPException(status_code=400, detail="Authentication failed")

@api_router.put("/theme")
async def update_theme(theme_update: ThemeUpdate, current_user: User = Depends(get_current_user)):
    await db.users.update_one({"username": current_user.username}, {"$set": {"theme": theme_update.theme}})
    return {"message": "Theme updated"}

# ===================================================================
# TEAM ROUTES - CORRIGIDAS E PADRONIZADAS
# ===================================================================

@api_router.post("/teams", response_model=Dict[str, Any])
async def create_team(team_create: TeamCreate, current_user: User = Depends(get_current_user)):
    """Cria um novo time"""
    team = Team(
        name=team_create.name,
        description=team_create.description,
        created_by=current_user.username,
        members=[current_user.username]
    )
    
    team_dict = team.model_dump()
    await db.teams.insert_one(team_dict)
    
    return serialize_document(team_dict)

@api_router.get("/teams", response_model=List[Dict[str, Any]])
async def get_teams(current_user: User = Depends(get_current_user)):
    """Lista todos os times do usuário atual"""
    teams = await db.teams.find(
        {"members": current_user.username}, 
        {"_id": 0}
    ).to_list(100)
    
    return [serialize_document(team) for team in teams]

@api_router.get("/teams/my-teams", response_model=List[Dict[str, Any]])
async def get_my_teams(current_user: User = Depends(get_current_user)):
    """Alias para /teams - retorna times do usuário"""
    return await get_teams(current_user)

@api_router.get("/teams/{team_id}", response_model=Dict[str, Any])
async def get_team(team_id: str, current_user: User = Depends(get_current_user)):
    """Retorna detalhes de um time específico"""
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    if current_user.username not in team.get("members", []):
        raise HTTPException(status_code=403, detail="Not a member of this team")
    
    return serialize_document(team)

@api_router.delete("/teams/{team_id}")
async def delete_team(team_id: str, current_user: User = Depends(get_current_user)):
    """Deleta um time (apenas criador)"""
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    if team.get("created_by") != current_user.username:
        raise HTTPException(status_code=403, detail="Only team creator can delete")
    
    await db.teams.delete_one({"id": team_id})
    await db.team_invites.delete_many({"team_id": team_id})
    
    return {"message": "Team deleted successfully"}

# ===================================================================
# TEAM MEMBERS ROUTES
# ===================================================================

@api_router.post("/teams/{team_id}/members")
async def add_team_member(
    team_id: str, 
    data: TeamAddMember, 
    current_user: User = Depends(get_current_user)
):
    """Adiciona membro ao time (envia convite)"""
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    if current_user.username not in team.get("members", []):
        raise HTTPException(status_code=403, detail="Not a member of this team")
    
    # Verificar se usuário existe
    user_exists = await db.users.find_one({"username": data.username})
    if not user_exists:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verificar se já é membro
    if data.username in team.get("members", []):
        raise HTTPException(status_code=400, detail="User already in team")
    
    # Verificar se já tem convite pendente
    existing_invite = await db.team_invites.find_one({
        "team_id": team_id,
        "invitee_username": data.username,
        "status": "pending"
    })
    
    if existing_invite:
        raise HTTPException(status_code=400, detail="Invite already sent")
    
    # Criar convite
    invite = TeamInvite(
        team_id=team_id,
        team_name=team.get("name", ""),
        inviter_username=current_user.username,
        invitee_username=data.username
    )
    
    await db.team_invites.insert_one(invite.model_dump())
    
    return {"message": f"Invite sent to {data.username}"}

@api_router.delete("/teams/{team_id}/members/{username}")
async def remove_team_member(
    team_id: str, 
    username: str, 
    current_user: User = Depends(get_current_user)
):
    """Remove membro do time"""
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Apenas criador pode remover outros, ou usuário pode sair
    is_creator = team.get("created_by") == current_user.username
    is_self = username == current_user.username
    
    if not (is_creator or is_self):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Não pode remover o criador
    if username == team.get("created_by"):
        raise HTTPException(status_code=400, detail="Cannot remove team creator")
    
    if username not in team.get("members", []):
        raise HTTPException(status_code=404, detail="User not in team")
    
    await db.teams.update_one(
        {"id": team_id},
        {"$pull": {"members": username}}
    )
    
    return {"message": f"{username} removed from team"}

# ===================================================================
# TEAM INVITES ROUTES
# ===================================================================

@api_router.post("/teams/{team_id}/invite")
async def invite_to_team(
    team_id: str, 
    data: TeamAddMember, 
    current_user: User = Depends(get_current_user)
):
    """Envia convite para usuário entrar no time"""
    return await add_team_member(team_id, data, current_user)

@api_router.get("/teams/invites", response_model=List[Dict[str, Any]])
async def get_my_invites(current_user: User = Depends(get_current_user)):
    """Lista convites pendentes do usuário"""
    invites = await db.team_invites.find(
        {
            "invitee_username": current_user.username,
            "status": "pending"
        },
        {"_id": 0}
    ).to_list(100)
    
    return [serialize_document(invite) for invite in invites]

@api_router.post("/teams/invites/{invite_id}/respond")
async def respond_to_invite(
    invite_id: str, 
    data: InviteResponse, 
    current_user: User = Depends(get_current_user)
):
    """Responde a um convite (aceitar ou rejeitar)"""
    invite = await db.team_invites.find_one({"id": invite_id}, {"_id": 0})
    
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    
    if invite.get("invitee_username") != current_user.username:
        raise HTTPException(status_code=403, detail="Not your invite")
    
    if invite.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Invite already processed")
    
    if data.action == "accept":
        # Adicionar usuário ao time
        await db.teams.update_one(
            {"id": invite.get("team_id")},
            {"$push": {"members": current_user.username}}
        )
        
        # Atualizar status do convite
        await db.team_invites.update_one(
            {"id": invite_id},
            {"$set": {"status": "accepted"}}
        )
        
        return {"message": "Invite accepted", "team_id": invite.get("team_id")}
    
    elif data.action == "reject":
        await db.team_invites.update_one(
            {"id": invite_id},
            {"$set": {"status": "rejected"}}
        )
        
        return {"message": "Invite rejected"}
    
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

# ===================================================================
# FILE ROUTES
# ===================================================================

@api_router.post("/files/upload")
async def upload_file(
    file: UploadFile = File(...),
    team_id: Optional[str] = Form(None),
    is_private: bool = Form(True),
    current_user: User = Depends(get_current_user)
):
    """Upload de arquivo"""
    file_id = str(uuid.uuid4())
    file_ext = Path(file.filename).suffix
    filename = f"{file_id}{file_ext}"
    
    content = await file.read()
    
    if STORAGE_MODE == "supabase":
        try:
            supabase_path = f"{current_user.username}/{filename}"
            await upload_to_supabase(content, supabase_path)
            storage_location = "supabase"
        except:
            file_path = UPLOAD_DIR / filename
            async with aiofiles.open(file_path, 'wb') as f:
                await f.write(content)
            storage_location = "local"
            supabase_path = None
    else:
        file_path = UPLOAD_DIR / filename
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(content)
        storage_location = "local"
        supabase_path = None
    
    file_metadata = FileMetadata(
        id=file_id,
        filename=filename,
        original_name=file.filename,
        file_type=file.content_type or "application/octet-stream",
        file_size=len(content),
        uploaded_by=current_user.username,
        team_id=team_id,
        is_private=is_private,
        storage_location=storage_location,
        supabase_path=supabase_path
    )
    
    await db.files.insert_one(file_metadata.model_dump())
    
    return serialize_document(file_metadata.model_dump())

@api_router.get("/files")
async def list_files(current_user: User = Depends(get_current_user)):
    """Lista arquivos do usuário"""
    files = await db.files.find(
        {
            "$or": [
                {"uploaded_by": current_user.username},
                {"shared_with": current_user.username},
                {"team_id": {"$in": [
                    team["id"] for team in await db.teams.find(
                        {"members": current_user.username}, 
                        {"_id": 0, "id": 1}
                    ).to_list(100)
                ]}}
            ]
        },
        {"_id": 0}
    ).to_list(1000)
    
    return [serialize_document(f) for f in files]

@api_router.get("/files/{file_id}")
async def get_file_metadata(file_id: str, current_user: User = Depends(get_current_user)):
    """Retorna metadados do arquivo"""
    file_doc = await db.files.find_one({"id": file_id}, {"_id": 0})
    
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Verificar permissões
    team_id = file_doc.get("team_id")
    if team_id:
        team = await db.teams.find_one({"id": team_id}, {"_id": 0})
        if not team or current_user.username not in team.get("members", []):
            raise HTTPException(status_code=403)
    elif file_doc.get("uploaded_by") != current_user.username and current_user.username not in file_doc.get("shared_with", []):
        raise HTTPException(status_code=403)
    
    return serialize_document(file_doc)

@api_router.get("/files/{file_id}/download")
async def download_file(file_id: str, current_user: User = Depends(get_current_user)):
    """Download de arquivo"""
    file_doc = await db.files.find_one({"id": file_id}, {"_id": 0})
    
    if not file_doc:
        raise HTTPException(status_code=404)
    
    # Verificar permissões
    team_id = file_doc.get("team_id")
    if team_id:
        team = await db.teams.find_one({"id": team_id}, {"_id": 0})
        if not team or current_user.username not in team.get("members", []):
            raise HTTPException(status_code=403)
    elif file_doc.get("uploaded_by") != current_user.username and current_user.username not in file_doc.get("shared_with", []):
        raise HTTPException(status_code=403)
    
    if file_doc.get("storage_location") == "supabase":
        content = await get_from_supabase(file_doc.get("supabase_path"))
    else:
        file_path = UPLOAD_DIR / file_doc.get("filename")
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found on disk")
        async with aiofiles.open(file_path, 'rb') as f:
            content = await f.read()
    
    return StreamingResponse(
        io.BytesIO(content),
        media_type=file_doc.get("file_type"),
        headers={"Content-Disposition": f"attachment; filename={file_doc.get('original_name')}"}
    )

@api_router.get("/files/{file_id}/preview")
async def preview_file(file_id: str, current_user: User = Depends(get_current_user)):
    """Preview de arquivo (para editor ao vivo)"""
    file_doc = await db.files.find_one({"id": file_id}, {"_id": 0})
    
    if not file_doc:
        raise HTTPException(status_code=404)
    
    # Verificar permissões
    team_id = file_doc.get("team_id")
    if team_id:
        team = await db.teams.find_one({"id": team_id}, {"_id": 0})
        if not team or current_user.username not in team.get("members", []):
            raise HTTPException(status_code=403)
    elif file_doc.get("uploaded_by") != current_user.username:
        raise HTTPException(status_code=403)
    
    if file_doc.get("storage_location") == "supabase":
        content = await get_from_supabase(file_doc.get("supabase_path"))
    else:
        file_path = UPLOAD_DIR / file_doc.get("filename")
        if not file_path.exists():
            raise HTTPException(status_code=404)
        async with aiofiles.open(file_path, 'rb') as f:
            content = await f.read()
    
    # Tentar decodificar como texto
    try:
        text_content = content.decode('utf-8')
        return {"type": "text", "content": text_content}
    except:
        # Se não for texto, retornar base64
        return {"type": "base64", "content": base64.b64encode(content).decode()}

@api_router.delete("/files/{file_id}")
async def delete_file(file_id: str, current_user: User = Depends(get_current_user)):
    """Deleta arquivo"""
    file_doc = await db.files.find_one({"id": file_id}, {"_id": 0})
    
    if not file_doc:
        raise HTTPException(status_code=404)
    
    if file_doc.get("uploaded_by") != current_user.username:
        raise HTTPException(status_code=403)
    
    if file_doc.get("storage_location") == "supabase":
        try:
            await delete_from_supabase(file_doc.get("supabase_path"))
        except:
            pass
    else:
        file_path = UPLOAD_DIR / file_doc.get("filename")
        if file_path.exists():
            file_path.unlink()
    
    await db.files.delete_one({"id": file_id})
    
    return {"message": "File deleted"}

# ===================================================================
# CHAT ROUTES
# ===================================================================

@api_router.websocket("/chat")
async def websocket_chat(websocket: WebSocket):
    await websocket.accept()
    active_connections.add(websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            chat_message = ChatMessage(
                username=message_data.get("username", "Anonymous"),
                message=message_data.get("message", "")
            )
            
            await db.chat_messages.insert_one(chat_message.model_dump())
            
            for connection in active_connections:
                try:
                    await connection.send_json(serialize_document(chat_message.model_dump()))
                except:
                    active_connections.discard(connection)
    except WebSocketDisconnect:
        active_connections.discard(websocket)

@api_router.get("/chat/messages")
async def get_chat_messages(limit: int = 50):
    messages = await db.chat_messages.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    return [serialize_document(msg) for msg in reversed(messages)]

@api_router.post("/chat/toggle")
async def toggle_chat(toggle: ChatToggle, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403)
    
    await db.settings.update_one(
        {"key": "chat_enabled"},
        {"$set": {"value": toggle.enabled}},
        upsert=True
    )
    return {"message": "Chat toggled", "enabled": toggle.enabled}

@api_router.get("/chat/status")
async def get_chat_status():
    setting = await db.settings.find_one({"key": "chat_enabled"})
    return {"enabled": setting.get("value", True) if setting else True}

# ===================================================================
# ADMIN ROUTES
# ===================================================================

@api_router.get("/admin/users")
async def list_users(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403)
    
    users = await db.users.find({}, {"_id": 0, "hashed_password": 0}).to_list(1000)
    return [serialize_document(user) for user in users]

@api_router.get("/admin/stats")
async def get_stats(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403)
    
    total_users = await db.users.count_documents({})
    total_files = await db.files.count_documents({})
    total_teams = await db.teams.count_documents({})
    
    return {
        "total_users": total_users,
        "total_files": total_files,
        "total_teams": total_teams
    }

@api_router.get("/admin/source-code")
async def download_source_code(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403)
    
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for dir_path in [Path("/app/backend"), Path("/app/frontend")]:
            if not dir_path.exists():
                continue
            for file_path in dir_path.rglob("*"):
                if file_path.is_file() and 'node_modules' not in str(file_path) and '__pycache__' not in str(file_path):
                    try:
                        arcname = f"{dir_path.name}/{file_path.relative_to(dir_path)}"
                        zip_file.write(file_path, arcname)
                    except:
                        pass
    zip_buffer.seek(0)
    return StreamingResponse(
        iter([zip_buffer.getvalue()]),
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=source_code.zip"}
    )

# ===================================================================
# LIVE EDITING WEBSOCKET
# ===================================================================
class LiveConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Dict[str, Dict[str, WebSocket]]] = {}
    
    async def connect(self, websocket: WebSocket, team_id: str, file_id: str, username: str):
        await websocket.accept()
        
        if team_id not in self.active_connections:
            self.active_connections[team_id] = {}
        if file_id not in self.active_connections[team_id]:
            self.active_connections[team_id][file_id] = {}
        
        self.active_connections[team_id][file_id][username] = websocket
        
        # Notificar outros usuários
        await self.broadcast_to_session(team_id, file_id, {
            "type": "user_joined",
            "username": username,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }, exclude_username=username)
        
        # Enviar lista de usuários ativos
        active_users = list(self.active_connections[team_id][file_id].keys())
        await websocket.send_json({
            "type": "users_list",
            "users": active_users
        })
    
    def disconnect(self, team_id: str, file_id: str, username: str):
        try:
            if (team_id in self.active_connections and 
                file_id in self.active_connections[team_id] and 
                username in self.active_connections[team_id][file_id]):
                
                del self.active_connections[team_id][file_id][username]
                
                if not self.active_connections[team_id][file_id]:
                    del self.active_connections[team_id][file_id]
                if not self.active_connections[team_id]:
                    del self.active_connections[team_id]
        except:
            pass
    
    async def broadcast_to_session(self, team_id: str, file_id: str, message: dict, exclude_username: str = None):
        if team_id not in self.active_connections or file_id not in self.active_connections[team_id]:
            return
        
        for username, connection in list(self.active_connections[team_id][file_id].items()):
            if exclude_username and username == exclude_username:
                continue
            try:
                await connection.send_json(message)
            except:
                self.disconnect(team_id, file_id, username)

live_manager = LiveConnectionManager()

@app.websocket("/api/ws/live/{team_id}/{file_id}")
async def websocket_live_editing(websocket: WebSocket, team_id: str, file_id: str):
    """WebSocket para edição colaborativa ao vivo"""
    username = None
    
    try:
        # Aceitar conexão e aguardar mensagem de join
        await websocket.accept()
        data = await websocket.receive_text()
        join_data = json.loads(data)
        
        if join_data.get("type") != "join":
            await websocket.close()
            return
        
        username = join_data.get("username")
        if not username:
            await websocket.close()
            return
        
        # Verificar permissões
        user = await db.users.find_one({"username": username}, {"_id": 0})
        team = await db.teams.find_one({"id": team_id}, {"_id": 0})
        file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
        
        if not user or not team or username not in team.get("members", []):
            await websocket.close()
            return
        
        if not file_metadata or file_metadata.get("team_id") != team_id:
            await websocket.close()
            return
        
        # Conectar usuário
        await live_manager.connect(websocket, team_id, file_id, username)
        
        # Loop de mensagens
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            message_type = message.get("type")
            
            if message_type == "content_update":
                await live_manager.broadcast_to_session(team_id, file_id, {
                    "type": "content_update",
                    "username": username,
                    "content": message.get("content", ""),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }, exclude_username=username)
            
            elif message_type == "cursor_position":
                await live_manager.broadcast_to_session(team_id, file_id, {
                    "type": "cursor_position",
                    "username": username,
                    "position": message.get("position", 0),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }, exclude_username=username)
            
            elif message_type == "file_saved":
                await live_manager.broadcast_to_session(team_id, file_id, {
                    "type": "file_saved",
                    "username": username,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }, exclude_username=username)
    
    except WebSocketDisconnect:
        if username:
            live_manager.disconnect(team_id, file_id, username)
            try:
                await live_manager.broadcast_to_session(team_id, file_id, {
                    "type": "user_left",
                    "username": username,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
            except:
                pass
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        if username:
            live_manager.disconnect(team_id, file_id, username)

@api_router.get("/teams/{team_id}/live-sessions")
async def get_team_live_sessions(team_id: str, current_user: User = Depends(get_current_user)):
    """Lista sessões Live ativas de um time"""
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    
    if not team or current_user.username not in team.get("members", []):
        raise HTTPException(status_code=403)
    
    sessions = []
    if team_id in live_manager.active_connections:
        for file_id, users in live_manager.active_connections[team_id].items():
            file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
            if file_metadata:
                sessions.append({
                    "file_id": file_id,
                    "file_name": file_metadata.get("original_name"),
                    "active_users": list(users.keys()),
                    "user_count": len(users)
                })
    
    return {
        "team_id": team_id,
        "team_name": team.get("name"),
        "active_sessions": sessions
    }

# Incluir o router no app
app.include_router(api_router)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[
        "https://biblioteca-sigma-gilt.vercel.app",
        "http://localhost:3000",
        "*"
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
