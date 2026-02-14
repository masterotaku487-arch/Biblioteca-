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
from typing import List, Optional, Set, Dict
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

# ===================================================================
# MONGODB MULTI-DATABASE SYSTEM
# ===================================================================
class MongoDBManager:
    """
    Gerencia múltiplos bancos MongoDB automaticamente.
    Quando um banco atinge 80% da capacidade, cria um novo.
    """
    def __init__(self, mongo_url: str, base_db_name: str, max_size_gb: float = 0.5):
        self.mongo_url = mongo_url
        self.base_db_name = base_db_name
        self.max_size_bytes = int(max_size_gb * 1024 * 1024 * 1024)  # Converter GB para bytes
        self.client = AsyncIOMotorClient(mongo_url)
        self.current_db_index = 0
        self.databases = {}
        
    async def initialize(self):
        """Inicializa e detecta bancos existentes"""
        # Tentar conectar ao banco principal
        self.databases[0] = self.client[self.base_db_name]
        
        # Verificar se há bancos adicionais
        all_dbs = await self.client.list_database_names()
        index = 1
        while f"{self.base_db_name}_{index}" in all_dbs:
            self.databases[index] = self.client[f"{self.base_db_name}_{index}"]
            self.current_db_index = index
            index += 1
            
        logger.info(f"MongoDB Manager initialized with {len(self.databases)} database(s)")
        return self.databases[self.current_db_index]
    
    async def get_current_db(self):
        """Retorna o banco de dados atual"""
        return self.databases[self.current_db_index]
    
    async def check_and_rotate(self):
        """Verifica se precisa criar novo banco"""
        try:
            current_db = self.databases[self.current_db_index]
            stats = await current_db.command("dbStats")
            current_size = stats.get("dataSize", 0)
            
            # Se atingiu 80% da capacidade, criar novo banco
            if current_size >= (self.max_size_bytes * 0.8):
                self.current_db_index += 1
                new_db_name = f"{self.base_db_name}_{self.current_db_index}"
                self.databases[self.current_db_index] = self.client[new_db_name]
                
                logger.warning(f"MongoDB capacity reached! Creating new database: {new_db_name}")
                logger.info(f"Previous DB size: {current_size / (1024*1024):.2f} MB")
                
                return self.databases[self.current_db_index]
            
            return current_db
        except Exception as e:
            logger.error(f"Error checking MongoDB size: {e}")
            return self.databases[self.current_db_index]
    
    async def get_all_data(self, collection_name: str, query: dict = None):
        """Busca dados em todos os bancos"""
        query = query or {}
        all_data = []
        
        for db_index, database in self.databases.items():
            try:
                collection = database[collection_name]
                data = await collection.find(query, {"_id": 0}).to_list(10000)
                all_data.extend(data)
            except Exception as e:
                logger.error(f"Error fetching from DB {db_index}: {e}")
        
        return all_data
    
    async def insert_one(self, collection_name: str, document: dict):
        """Insere em banco atual, rotaciona se necessário"""
        current_db = await self.check_and_rotate()
        collection = current_db[collection_name]
        return await collection.insert_one(document)
    
    async def find_one(self, collection_name: str, query: dict):
        """Busca em todos os bancos até achar"""
        for db_index, database in self.databases.items():
            try:
                collection = database[collection_name]
                result = await collection.find_one(query, {"_id": 0})
                if result:
                    return result
            except Exception as e:
                logger.error(f"Error finding in DB {db_index}: {e}")
        return None
    
    async def update_one(self, collection_name: str, query: dict, update: dict):
        """Atualiza em todos os bancos onde encontrar"""
        updated = False
        for db_index, database in self.databases.items():
            try:
                collection = database[collection_name]
                result = await collection.update_one(query, update)
                if result.modified_count > 0:
                    updated = True
            except Exception as e:
                logger.error(f"Error updating in DB {db_index}: {e}")
        return updated
    
    async def delete_one(self, collection_name: str, query: dict):
        """Deleta em todos os bancos onde encontrar"""
        deleted = False
        for db_index, database in self.databases.items():
            try:
                collection = database[collection_name]
                result = await collection.delete_one(query)
                if result.deleted_count > 0:
                    deleted = True
            except Exception as e:
                logger.error(f"Error deleting in DB {db_index}: {e}")
        return deleted

# Inicializar MongoDB Manager
mongo_url = os.environ['MONGO_URL']
mongo_manager = MongoDBManager(
    mongo_url=mongo_url,
    base_db_name=os.environ['DB_NAME'],
    max_size_gb=0.5  # 500MB por banco
)

# Para compatibilidade com código existente
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key-change-this")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

# Storage
STORAGE_MODE = os.environ.get("STORAGE_MODE", "local")
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

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Inicializar MongoDB Manager ao iniciar"""
    global db
    db = await mongo_manager.initialize()
    logger.info("Server started successfully")

@app.get("/", include_in_schema=False)
def read_root():
    return {"status": "ok", "service": "biblioteca-backend"}

api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

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
    status: str = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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

# Security functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await mongo_manager.find_one("users", {"username": username})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    
    if isinstance(user.get('created_at'), str):
        user['created_at'] = datetime.fromisoformat(user['created_at'])
    
    return User(**user)

async def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# Storage functions
async def upload_to_supabase(file_content: bytes, file_path: str) -> str:
    url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{file_path}"
    headers = {"Authorization": f"Bearer {SUPABASE_KEY}", "Content-Type": "application/octet-stream"}
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, content=file_content, headers=headers)
        if response.status_code not in [200, 201]:
            raise Exception(f"Upload failed: {response.status_code}")
    return file_path

async def download_from_supabase(file_path: str) -> bytes:
    url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{file_path}"
    headers = {"Authorization": f"Bearer {SUPABASE_KEY}"}
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url, headers=headers)
        if response.status_code != 200:
            raise Exception(f"Download failed: {response.status_code}")
    return response.content

async def delete_from_supabase(file_path: str):
    url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{file_path}"
    headers = {"Authorization": f"Bearer {SUPABASE_KEY}"}
    async with httpx.AsyncClient(timeout=30.0) as client:
        await client.delete(url, headers=headers)

async def save_file_to_storage(file_content: bytes, filename: str, original_name: str, uploaded_by: str) -> dict:
    if STORAGE_MODE == "supabase":
        try:
            file_path = f"{uploaded_by}/{filename}"
            await upload_to_supabase(file_content, file_path)
            return {"storage_location": "supabase", "supabase_path": file_path, "filename": filename}
        except Exception as e:
            logger.error(f"Supabase error: {e}")
    
    file_path = UPLOAD_DIR / filename
    async with aiofiles.open(file_path, 'wb') as out_file:
        await out_file.write(file_content)
    return {"storage_location": "local", "filename": filename}

async def get_file_from_storage(file_metadata: dict) -> bytes:
    if file_metadata.get("storage_location") == "supabase":
        return await download_from_supabase(file_metadata["supabase_path"])
    
    file_path = UPLOAD_DIR / file_metadata["filename"]
    async with aiofiles.open(file_path, 'rb') as in_file:
        return await in_file.read()

async def delete_file_from_storage(file_metadata: dict):
    if file_metadata.get("storage_location") == "supabase":
        await delete_from_supabase(file_metadata["supabase_path"])
    else:
        file_path = UPLOAD_DIR / file_metadata["filename"]
        if file_path.exists():
            file_path.unlink()

# Auth routes
@api_router.post("/register", response_model=Token)
async def register(user_data: UserCreate):
    existing = await mongo_manager.find_one("users", {"username": user_data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    user = User(username=user_data.username)
    user_doc = user.model_dump()
    user_doc["password_hash"] = hash_password(user_data.password)
    user_doc["created_at"] = user_doc["created_at"].isoformat()
    
    await mongo_manager.insert_one("users", user_doc)
    
    access_token = create_access_token(data={"sub": user.username})
    return Token(access_token=access_token, token_type="bearer", user=user)

@api_router.post("/login", response_model=Token)
async def login(credentials: UserLogin):
    user = await mongo_manager.find_one("users", {"username": credentials.username})
    if not user or not verify_password(credentials.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if isinstance(user.get('created_at'), str):
        user['created_at'] = datetime.fromisoformat(user['created_at'])
    
    user_obj = User(**user)
    access_token = create_access_token(data={"sub": user_obj.username})
    return Token(access_token=access_token, token_type="bearer", user=user_obj)

@api_router.get("/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.post("/update-theme")
async def update_theme(data: ThemeUpdate, current_user: User = Depends(get_current_user)):
    await mongo_manager.update_one("users", {"username": current_user.username}, {"$set": {"theme": data.theme}})
    return {"message": "Theme updated"}

# Google OAuth
@app.get("/api/auth/google")
async def auth_google(request: Request):
    redirect_uri = f"{BACKEND_URL}/api/auth/google/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri)

@app.get("/api/auth/google/callback")
async def auth_google_callback(request: Request):
    try:
        token = await oauth.google.authorize_access_token(request)
        user_info = token.get('userinfo')
        
        google_id = user_info['sub']
        email = user_info['email']
        username = user_info.get('name', email.split('@')[0])
        avatar_url = user_info.get('picture')
        
        user = await mongo_manager.find_one("users", {"google_id": google_id})
        
        if not user:
            user = User(username=username, email=email, google_id=google_id, avatar_url=avatar_url)
            user_doc = user.model_dump()
            user_doc["created_at"] = user_doc["created_at"].isoformat()
            await mongo_manager.insert_one("users", user_doc)
        else:
            if isinstance(user.get('created_at'), str):
                user['created_at'] = datetime.fromisoformat(user['created_at'])
            user = User(**user)
        
        access_token = create_access_token(data={"sub": user.username})
        return RedirectResponse(url=f"{FRONTEND_URL}/auth/callback?token={access_token}")
    
    except Exception as e:
        logger.error(f"Google auth error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Discord OAuth
@api_router.post("/auth/discord")
async def discord_auth(discord_data: DiscordAuthRequest):
    try:
        user = await mongo_manager.find_one("users", {"discord_id": discord_data.discordId})
        
        if not user:
            new_user = User(
                username=discord_data.username,
                email=discord_data.email,
                discord_id=discord_data.discordId,
                avatar_url=discord_data.avatar
            )
            user_doc = new_user.model_dump()
            user_doc["created_at"] = user_doc["created_at"].isoformat()
            await mongo_manager.insert_one("users", user_doc)
            user = user_doc
        
        if isinstance(user.get('created_at'), str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
        
        user_obj = User(**user)
        access_token = create_access_token(data={"sub": user_obj.username})
        
        return {
            "success": True,
            "token": access_token,
            "user": {
                "id": user_obj.id,
                "username": user_obj.username,
                "email": user_obj.email,
                "role": user_obj.role,
                "avatar_url": user_obj.avatar_url
            }
        }
    except Exception as e:
        logger.error(f"Discord auth error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Teams routes
@api_router.post("/teams", response_model=Team)
async def create_team(team_data: TeamCreate, current_user: User = Depends(get_current_user)):
    team = Team(name=team_data.name, description=team_data.description, created_by=current_user.username, members=[current_user.username])
    team_doc = team.model_dump()
    team_doc["created_at"] = team_doc["created_at"].isoformat()
    await mongo_manager.insert_one("teams", team_doc)
    return team

@api_router.get("/teams", response_model=List[Team])
async def get_teams(current_user: User = Depends(get_current_user)):
    teams = await mongo_manager.get_all_data("teams", {"members": current_user.username})
    for team in teams:
        if isinstance(team.get('created_at'), str):
            team['created_at'] = datetime.fromisoformat(team['created_at'])
    return teams

@api_router.post("/teams/{team_id}/members")
async def add_team_member(team_id: str, data: TeamAddMember, current_user: User = Depends(get_current_user)):
    team = await mongo_manager.find_one("teams", {"id": team_id})
    if not team or current_user.username not in team["members"]:
        raise HTTPException(status_code=403)
    
    if not await mongo_manager.find_one("users", {"username": data.username}):
        raise HTTPException(status_code=404, detail="User not found")
    
    if data.username in team["members"]:
        raise HTTPException(status_code=400, detail="User already in team")
    
    await mongo_manager.update_one("teams", {"id": team_id}, {"$push": {"members": data.username}})
    return {"message": f"{data.username} added to team"}

@api_router.delete("/teams/{team_id}/members/{username}")
async def remove_team_member(team_id: str, username: str, current_user: User = Depends(get_current_user)):
    team = await mongo_manager.find_one("teams", {"id": team_id})
    if not team:
        raise HTTPException(status_code=404)
    
    if current_user.username != team["created_by"] and current_user.username != username:
        raise HTTPException(status_code=403)
    
    await mongo_manager.update_one("teams", {"id": team_id}, {"$pull": {"members": username}})
    return {"message": "Member removed"}

@api_router.delete("/teams/{team_id}")
async def delete_team(team_id: str, current_user: User = Depends(get_current_user)):
    team = await mongo_manager.find_one("teams", {"id": team_id})
    if not team:
        raise HTTPException(status_code=404)
    
    # REMOVIDO: Admin não pode mais deletar times de outros
    if current_user.username != team["created_by"]:
        raise HTTPException(status_code=403, detail="Only team owner can delete")
    
    await mongo_manager.delete_one("teams", {"id": team_id})
    await mongo_manager.update_one("files", {"team_id": team_id}, {"$set": {"team_id": None}})
    return {"message": "Team deleted"}

# Team Invites
@api_router.post("/teams/{team_id}/invite")
async def invite_to_team(team_id: str, data: TeamAddMember, current_user: User = Depends(get_current_user)):
    team = await mongo_manager.find_one("teams", {"id": team_id})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    if current_user.username not in team["members"]:
        raise HTTPException(status_code=403, detail="Not a team member")
    
    invitee = await mongo_manager.find_one("users", {"username": data.username})
    if not invitee:
        raise HTTPException(status_code=404, detail="User not found")
    
    if data.username in team["members"]:
        raise HTTPException(status_code=400, detail="User already in team")
    
    existing_invite = await mongo_manager.find_one("team_invites", {
        "team_id": team_id,
        "invitee_username": data.username,
        "status": "pending"
    })
    
    if existing_invite:
        raise HTTPException(status_code=400, detail="Invite already sent")
    
    invite = TeamInvite(
        team_id=team_id,
        team_name=team["name"],
        inviter_username=current_user.username,
        invitee_username=data.username
    )
    
    invite_doc = invite.model_dump()
    invite_doc["created_at"] = invite_doc["created_at"].isoformat()
    await mongo_manager.insert_one("team_invites", invite_doc)
    
    return {"message": f"Invite sent to {data.username}"}

@api_router.get("/teams/invites")
async def get_my_invites(current_user: User = Depends(get_current_user)):
    invites = await mongo_manager.get_all_data("team_invites", {
        "invitee_username": current_user.username,
        "status": "pending"
    })
    
    for invite in invites:
        if isinstance(invite.get('created_at'), str):
            invite['created_at'] = datetime.fromisoformat(invite['created_at'])
    
    return invites

@api_router.post("/teams/invites/{invite_id}/respond")
async def respond_to_invite(invite_id: str, data: dict, current_user: User = Depends(get_current_user)):
    invite = await mongo_manager.find_one("team_invites", {"id": invite_id})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    
    if invite["invitee_username"] != current_user.username:
        raise HTTPException(status_code=403, detail="Not your invite")
    
    if invite["status"] != "pending":
        raise HTTPException(status_code=400, detail="Invite already processed")
    
    action = data.get("action")
    
    if action == "accept":
        await mongo_manager.update_one("teams", {"id": invite["team_id"]}, {"$push": {"members": current_user.username}})
        await mongo_manager.update_one("team_invites", {"id": invite_id}, {"$set": {"status": "accepted"}})
        return {"message": "Invite accepted"}
    
    elif action == "reject":
        await mongo_manager.update_one("team_invites", {"id": invite_id}, {"$set": {"status": "rejected"}})
        return {"message": "Invite rejected"}
    
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

# File routes
@api_router.post("/files/upload", response_model=FileMetadata)
async def upload_file(
    file: UploadFile = File(...),
    team_id: Optional[str] = Form(None),
    is_private: bool = Form(True),
    password: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
):
    file_content = await file.read()
    file_size = len(file_content)
    
    filename = f"{uuid.uuid4()}_{file.filename}"
    storage_info = await save_file_to_storage(file_content, filename, file.filename, current_user.username)
    
    file_metadata = FileMetadata(
        filename=storage_info["filename"],
        original_name=file.filename,
        file_type=file.content_type,
        file_size=file_size,
        uploaded_by=current_user.username,
        team_id=team_id,
        is_private=is_private,
        has_password=bool(password),
        storage_location=storage_info["storage_location"],
        supabase_path=storage_info.get("supabase_path")
    )
    
    file_doc = file_metadata.model_dump()
    if password:
        file_doc["password_hash"] = hash_password(password)
    file_doc["uploaded_at"] = file_doc["uploaded_at"].isoformat()
    
    await mongo_manager.insert_one("files", file_doc)
    return file_metadata

@api_router.get("/files", response_model=List[FileMetadata])
async def get_files(current_user: User = Depends(get_current_user)):
    # MODIFICADO: Admin NÃO vê mais arquivos de todos
    user_teams = await mongo_manager.get_all_data("teams", {"members": current_user.username})
    team_ids = [team["id"] for team in user_teams]
    
    # Buscar apenas arquivos do próprio usuário ou de times que participa
    own_files = await mongo_manager.get_all_data("files", {"uploaded_by": current_user.username})
    team_files = await mongo_manager.get_all_data("files", {"team_id": {"$in": team_ids}})
    shared_files = await mongo_manager.get_all_data("files", {"shared_with": current_user.username})
    
    # Combinar e remover duplicatas
    all_files = {f["id"]: f for f in (own_files + team_files + shared_files)}.values()
    
    for file in all_files:
        if isinstance(file.get('uploaded_at'), str):
            file['uploaded_at'] = datetime.fromisoformat(file['uploaded_at'])
    
    return list(all_files)

@api_router.post("/files/{file_id}/share")
async def share_file(file_id: str, data: FileShare, current_user: User = Depends(get_current_user)):
    file_metadata = await mongo_manager.find_one("files", {"id": file_id})
    if not file_metadata:
        raise HTTPException(status_code=404, detail="File not found")
    
    # MODIFICADO: Admin não tem mais permissão especial
    if file_metadata["uploaded_by"] != current_user.username:
        raise HTTPException(status_code=403, detail="Only file owner can share")
    
    if not await mongo_manager.find_one("users", {"username": data.username}):
        raise HTTPException(status_code=404, detail="User not found")
    
    if data.username in file_metadata.get("shared_with", []):
        raise HTTPException(status_code=400, detail="Already shared")
    
    await mongo_manager.update_one("files", {"id": file_id}, {"$push": {"shared_with": data.username}})
    return {"message": f"File shared with {data.username}"}

@api_router.delete("/files/{file_id}/share/{username}")
async def unshare_file(file_id: str, username: str, current_user: User = Depends(get_current_user)):
    file_metadata = await mongo_manager.find_one("files", {"id": file_id})
    if not file_metadata:
        raise HTTPException(status_code=404)
    
    # MODIFICADO: Admin não tem mais permissão especial
    if file_metadata["uploaded_by"] != current_user.username:
        raise HTTPException(status_code=403, detail="Only file owner can unshare")
    
    await mongo_manager.update_one("files", {"id": file_id}, {"$pull": {"shared_with": username}})
    return {"message": "File unshared"}

@api_router.get("/files/{file_id}/preview")
async def preview_file(file_id: str, current_user: User = Depends(get_current_user)):
    file_metadata = await mongo_manager.find_one("files", {"id": file_id})
    if not file_metadata:
        raise HTTPException(status_code=404)
    
    # MODIFICADO: Admin não tem mais acesso automático
    has_access = False
    if file_metadata["uploaded_by"] == current_user.username:
        has_access = True
    elif file_metadata.get("team_id"):
        team = await mongo_manager.find_one("teams", {"id": file_metadata["team_id"]})
        if team and current_user.username in team["members"]:
            has_access = True
    elif current_user.username in file_metadata.get("shared_with", []):
        has_access = True
    
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")
    
    file_type = file_metadata["file_type"]
    
    if file_type.startswith(('image/', 'text/')) or file_metadata["file_size"] < 5 * 1024 * 1024:
        content = await get_file_from_storage(file_metadata)
        if file_type.startswith('text/'):
            return {"type": "text", "content": content.decode('utf-8', errors='ignore')}
        else:
            return {"type": "base64", "content": base64.b64encode(content).decode(), "mime_type": file_type}
    
    return {"type": "stream", "file_id": file_id}

@api_router.get("/files/{file_id}/stream")
async def stream_file(file_id: str, current_user: User = Depends(get_current_user)):
    file_metadata = await mongo_manager.find_one("files", {"id": file_id})
    if not file_metadata:
        raise HTTPException(status_code=404)
    
    file_content = await get_file_from_storage(file_metadata)
    return StreamingResponse(io.BytesIO(file_content), media_type=file_metadata["file_type"])

@api_router.post("/files/{file_id}/verify-password")
async def verify_file_password(file_id: str, data: FilePasswordVerify, current_user: User = Depends(get_current_user)):
    file_metadata = await mongo_manager.find_one("files", {"id": file_id})
    if not file_metadata:
        raise HTTPException(status_code=404)
    
    if not file_metadata.get("password_hash"):
        return {"valid": True}
    
    return {"valid": verify_password(data.password, file_metadata["password_hash"])}

@api_router.get("/files/{file_id}/download")
async def download_file(file_id: str, current_user: User = Depends(get_current_user)):
    file_metadata = await mongo_manager.find_one("files", {"id": file_id})
    if not file_metadata:
        raise HTTPException(status_code=404)
    
    # MODIFICADO: Admin não tem mais acesso automático
    has_access = False
    if file_metadata["uploaded_by"] == current_user.username:
        has_access = True
    elif file_metadata.get("team_id"):
        team = await mongo_manager.find_one("teams", {"id": file_metadata["team_id"]})
        if team and current_user.username in team["members"]:
            has_access = True
    elif current_user.username in file_metadata.get("shared_with", []):
        has_access = True
    
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")
    
    file_content = await get_file_from_storage(file_metadata)
    return StreamingResponse(
        io.BytesIO(file_content),
        media_type=file_metadata["file_type"],
        headers={"Content-Disposition": f"attachment; filename={file_metadata['original_name']}"}
    )

@api_router.delete("/files/{file_id}")
async def delete_file(file_id: str, current_user: User = Depends(get_admin_user)):
    file_metadata = await mongo_manager.find_one("files", {"id": file_id})
    if not file_metadata:
        raise HTTPException(status_code=404)
    
    await delete_file_from_storage(file_metadata)
    await mongo_manager.delete_one("files", {"id": file_id})
    return {"message": "File deleted"}

# User stats
@api_router.get("/user/stats")
async def get_user_stats(current_user: User = Depends(get_current_user)):
    files = await mongo_manager.get_all_data("files", {"uploaded_by": current_user.username})
    total_storage = sum(f.get("file_size", 0) for f in files)
    teams = await mongo_manager.get_all_data("teams", {"members": current_user.username})
    
    return {
        "total_files": len(files),
        "total_storage_bytes": total_storage,
        "total_storage_mb": round(total_storage / (1024 * 1024), 2),
        "total_teams": len(teams)
    }

# Chat routes
@api_router.get("/chat/enabled")
async def get_chat_enabled(current_user: User = Depends(get_current_user)):
    settings = await mongo_manager.find_one("settings", {"key": "chat_enabled"})
    return {"enabled": settings.get("value", False) if settings else False}

@api_router.get("/chat/messages", response_model=List[ChatMessage])
async def get_chat_messages(current_user: User = Depends(get_current_user)):
    settings = await mongo_manager.find_one("settings", {"key": "chat_enabled"})
    if not settings or not settings.get("value", False):
        if current_user.role != "admin":
            raise HTTPException(status_code=403)
    
    messages = await mongo_manager.get_all_data("chat_messages", {})
    messages = sorted(messages, key=lambda x: x.get('timestamp', ''), reverse=True)[:100]
    
    for msg in messages:
        if isinstance(msg.get('timestamp'), str):
            msg['timestamp'] = datetime.fromisoformat(msg['timestamp'])
    
    return list(reversed(messages))

@api_router.post("/admin/chat/toggle")
async def toggle_chat(data: ChatToggle, current_user: User = Depends(get_admin_user)):
    await mongo_manager.update_one("settings", {"key": "chat_enabled"}, {"$set": {"value": data.enabled}}, upsert=True)
    return {"enabled": data.enabled}

@api_router.delete("/admin/chat/messages/{message_id}")
async def delete_chat_message(message_id: str, current_user: User = Depends(get_admin_user)):
    deleted = await mongo_manager.delete_one("chat_messages", {"id": message_id})
    if not deleted:
        raise HTTPException(status_code=404)
    
    for connection in active_connections:
        try:
            await connection.send_json({"type": "message_deleted", "message_id": message_id})
        except:
            pass
    return {"message": "Message deleted"}

# WebSocket Chat
@app.websocket("/api/ws/chat")
async def websocket_chat(websocket: WebSocket):
    await websocket.accept()
    active_connections.add(websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            user = await mongo_manager.find_one("users", {"username": message_data.get("username")})
            if not user:
                continue
            
            chat_message = ChatMessage(
                username=message_data.get("username"),
                message=message_data.get("message"),
                role=user.get("role", "user")
            )
            
            message_doc = chat_message.model_dump()
            message_doc["timestamp"] = message_doc["timestamp"].isoformat()
            await mongo_manager.insert_one("chat_messages", message_doc)
            
            broadcast_data = chat_message.model_dump()
            broadcast_data["timestamp"] = broadcast_data["timestamp"].isoformat()
            
            for connection in active_connections:
                try:
                    await connection.send_json(broadcast_data)
                except:
                    pass
    
    except WebSocketDisconnect:
        active_connections.discard(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        active_connections.discard(websocket)

# Admin routes
@api_router.get("/admin/users", response_model=List[User])
async def get_all_users(current_user: User = Depends(get_admin_user)):
    users = await mongo_manager.get_all_data("users", {})
    for user in users:
        if isinstance(user.get('created_at'), str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
    return users

@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(get_admin_user)):
    user = await mongo_manager.find_one("users", {"id": user_id})
    if not user or user["role"] == "admin":
        raise HTTPException(status_code=403)
    await mongo_manager.delete_one("users", {"id": user_id})
    return {"message": "User deleted"}

@api_router.get("/admin/stats")
async def get_stats(current_user: User = Depends(get_admin_user)):
    all_users = await mongo_manager.get_all_data("users", {})
    all_files = await mongo_manager.get_all_data("files", {})
    all_teams = await mongo_manager.get_all_data("teams", {})
    
    total_users = len(all_users)
    total_files = len(all_files)
    total_storage = sum(f.get("file_size", 0) for f in all_files)
    total_teams = len(all_teams)
    
    return {
        "total_users": total_users,
        "total_files": total_files,
        "total_storage_bytes": total_storage,
        "total_storage_mb": round(total_storage / (1024 * 1024), 2),
        "total_teams": total_teams
    }

# MongoDB Stats
@api_router.get("/admin/mongodb-stats")
async def get_mongodb_stats(current_user: User = Depends(get_admin_user)):
    """Retorna estatísticas de todos os bancos MongoDB"""
    stats = []
    
    for db_index, database in mongo_manager.databases.items():
        try:
            db_stats = await database.command("dbStats")
            stats.append({
                "database_index": db_index,
                "database_name": database.name,
                "size_bytes": db_stats.get("dataSize", 0),
                "size_mb": round(db_stats.get("dataSize", 0) / (1024 * 1024), 2),
                "collections": db_stats.get("collections", 0),
                "objects": db_stats.get("objects", 0),
                "is_current": db_index == mongo_manager.current_db_index
            })
        except Exception as e:
            logger.error(f"Error getting stats for DB {db_index}: {e}")
    
    return {
        "total_databases": len(mongo_manager.databases),
        "current_database_index": mongo_manager.current_db_index,
        "max_size_per_db_mb": round(mongo_manager.max_size_bytes / (1024 * 1024), 2),
        "databases": stats
    }

# ===================================================================
# LIVE EDITING WEBSOCKET
# ===================================================================

class LiveConnectionManager:
    """Gerencia conexões WebSocket para edição colaborativa"""
    
    def __init__(self):
        self.active_connections: Dict[str, Dict[str, Dict[str, WebSocket]]] = {}
    
    async def connect(self, websocket: WebSocket, team_id: str, file_id: str, username: str):
        await websocket.accept()
        
        if team_id not in self.active_connections:
            self.active_connections[team_id] = {}
        
        if file_id not in self.active_connections[team_id]:
            self.active_connections[team_id][file_id] = {}
        
        self.active_connections[team_id][file_id][username] = websocket
        
        await self.broadcast_to_session(
            team_id, 
            file_id, 
            {
                "type": "user_joined",
                "username": username,
                "timestamp": datetime.now(timezone.utc).isoformat()
            },
            exclude_username=username
        )
        
        active_users = list(self.active_connections[team_id][file_id].keys())
        await websocket.send_json({
            "type": "users_list",
            "users": active_users,
            "timestamp": datetime.now(timezone.utc).isoformat()
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
        except Exception as e:
            logger.error(f"Erro ao desconectar: {e}")
    
    async def broadcast_to_session(self, team_id: str, file_id: str, message: dict, exclude_username: str = None):
        if team_id not in self.active_connections:
            return
        
        if file_id not in self.active_connections[team_id]:
            return
        
        disconnected = []
        
        for username, connection in self.active_connections[team_id][file_id].items():
            if exclude_username and username == exclude_username:
                continue
            
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Erro ao enviar para {username}: {e}")
                disconnected.append(username)
        
        for username in disconnected:
            self.disconnect(team_id, file_id, username)
    
    def get_active_users(self, team_id: str, file_id: str) -> list:
        if team_id not in self.active_connections:
            return []
        
        if file_id not in self.active_connections[team_id]:
            return []
        
        return list(self.active_connections[team_id][file_id].keys())

live_manager = LiveConnectionManager()

@app.websocket("/api/ws/live/{team_id}/{file_id}")
async def websocket_live_editing(websocket: WebSocket, team_id: str, file_id: str):
    username = None
    
    try:
        await websocket.accept()
        
        data = await websocket.receive_text()
        join_data = json.loads(data)
        
        if join_data.get("type") != "join":
            await websocket.send_json({"type": "error", "message": "Expected join message"})
            await websocket.close()
            return
        
        username = join_data.get("username")
        
        if not username:
            await websocket.send_json({"type": "error", "message": "Username required"})
            await websocket.close()
            return
        
        user = await mongo_manager.find_one("users", {"username": username})
        if not user:
            await websocket.send_json({"type": "error", "message": "User not found"})
            await websocket.close()
            return
        
        team = await mongo_manager.find_one("teams", {"id": team_id})
        if not team:
            await websocket.send_json({"type": "error", "message": "Team not found"})
            await websocket.close()
            return
        
        if username not in team.get("members", []):
            await websocket.send_json({"type": "error", "message": "Not a team member"})
            await websocket.close()
            return
        
        file_metadata = await mongo_manager.find_one("files", {"id": file_id})
        if not file_metadata:
            await websocket.send_json({"type": "error", "message": "File not found"})
            await websocket.close()
            return
        
        if file_metadata.get("team_id") != team_id:
            await websocket.send_json({"type": "error", "message": "File does not belong to this team"})
            await websocket.close()
            return
        
        await live_manager.connect(websocket, team_id, file_id, username)
        logger.info(f"User {username} joined live session for file {file_id} in team {team_id}")
        
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            message_type = message.get("type")
            
            if message_type == "content_update":
                await live_manager.broadcast_to_session(
                    team_id,
                    file_id,
                    {
                        "type": "content_update",
                        "username": username,
                        "content": message.get("content", ""),
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    },
                    exclude_username=username
                )
            
            elif message_type == "cursor_position":
                await live_manager.broadcast_to_session(
                    team_id,
                    file_id,
                    {
                        "type": "cursor_position",
                        "username": username,
                        "position": message.get("position", 0),
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    },
                    exclude_username=username
                )
            
            elif message_type == "file_saved":
                await live_manager.broadcast_to_session(
                    team_id,
                    file_id,
                    {
                        "type": "file_saved",
                        "username": username,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    },
                    exclude_username=username
                )
            
            else:
                logger.warning(f"Unknown message type: {message_type}")
    
    except WebSocketDisconnect:
        if username:
            live_manager.disconnect(team_id, file_id, username)
            logger.info(f"User {username} disconnected from live session")
            
            try:
                await live_manager.broadcast_to_session(
                    team_id,
                    file_id,
                    {
                        "type": "user_left",
                        "username": username,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
                )
            except:
                pass
    
    except Exception as e:
        logger.error(f"WebSocket error in live editing: {e}")
        if username:
            live_manager.disconnect(team_id, file_id, username)
        
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e)
            })
        except:
            pass

@api_router.get("/teams/{team_id}/live-sessions")
async def get_team_live_sessions(team_id: str, current_user: User = Depends(get_current_user)):
    team = await mongo_manager.find_one("teams", {"id": team_id})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    if current_user.username not in team.get("members", []):
        raise HTTPException(status_code=403, detail="Not a team member")
    
    sessions = []
    
    if team_id in live_manager.active_connections:
        for file_id, users in live_manager.active_connections[team_id].items():
            file_metadata = await mongo_manager.find_one("files", {"id": file_id})
            
            if file_metadata:
                sessions.append({
                    "file_id": file_id,
                    "file_name": file_metadata.get("original_name", "Unknown"),
                    "active_users": list(users.keys()),
                    "user_count": len(users)
                })
    
    return {
        "team_id": team_id,
        "team_name": team.get("name"),
        "active_sessions": sessions,
        "total_sessions": len(sessions)
    }

@api_router.get("/files/{file_id}/live-status")
async def get_file_live_status(file_id: str, current_user: User = Depends(get_current_user)):
    file_metadata = await mongo_manager.find_one("files", {"id": file_id})
    if not file_metadata:
        raise HTTPException(status_code=404, detail="File not found")
    
    has_access = False
    if file_metadata["uploaded_by"] == current_user.username:
        has_access = True
    elif file_metadata.get("team_id"):
        team = await mongo_manager.find_one("teams", {"id": file_metadata["team_id"]})
        if team and current_user.username in team["members"]:
            has_access = True
    
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")
    
    team_id = file_metadata.get("team_id")
    active_users = []
    is_live = False
    
    if team_id and team_id in live_manager.active_connections:
        if file_id in live_manager.active_connections[team_id]:
            active_users = list(live_manager.active_connections[team_id][file_id].keys())
            is_live = len(active_users) > 0
    
    return {
        "file_id": file_id,
        "file_name": file_metadata.get("original_name"),
        "is_live": is_live,
        "active_users": active_users,
        "user_count": len(active_users)
    }

# Mount API router
app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
