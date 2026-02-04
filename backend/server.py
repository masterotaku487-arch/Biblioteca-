from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, WebSocket, WebSocketDisconnect, Form, BackgroundTasks
from fastapi.responses import StreamingResponse, RedirectResponse, Response
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
from typing import List, Optional, Set
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import aiofiles
import json
import io
import httpx
import base64
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
SECRET_KEY = os.environ.get("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

# Storage configuration
STORAGE_MODE = os.environ.get("STORAGE_MODE", "local")
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/app/uploads"))
UPLOAD_DIR.mkdir(exist_ok=True, parents=True)

# Supabase configuration
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
SUPABASE_BUCKET = os.environ.get("SUPABASE_BUCKET", "uploads")

# Google OAuth configuration
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000")

# OAuth setup
oauth = OAuth()
oauth.register(
    name='google',
    client_id=GOOGLE_CLIENT_ID,
    client_secret=GOOGLE_CLIENT_SECRET,
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'}
)

if STORAGE_MODE == "supabase":
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("⚠️ Supabase não configurado! Usando storage local.")
        STORAGE_MODE = "local"
    else:
        print(f"✅ Supabase Storage ativado: {SUPABASE_URL}")
        print(f"✅ Bucket: {SUPABASE_BUCKET}")
else:
    print(f"✅ Storage local: {UPLOAD_DIR}")

# WebSocket connections
active_connections: Set[WebSocket] = set()

# Create app
app = FastAPI()

@app.get("/", include_in_schema=False)
def read_root():
    return {"status": "ok", "service": "biblioteca-backend", "message": "Service is running fine."}

api_router = APIRouter(prefix="/api")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: Optional[str] = None
    google_id: Optional[str] = None
    discord_id: Optional[str] = None
    discriminator: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str = "user"
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
    owner_id: str
    members_v2: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TeamCreate(BaseModel):
    name: str


class TeamInvite(BaseModel):
    username: str


class FileMetadata(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    original_name: str
    file_type: str
    file_size: int
    uploaded_by: str
    is_private: bool = True
    has_password: bool = False
    password_hash: Optional[str] = None
    team_id: Optional[str] = None
    storage_location: str = "local"
    supabase_path: Optional[str] = None
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_accessed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ShareLink(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    file_id: str
    share_token: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = None


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


# Supabase Storage Helper Functions
async def upload_to_supabase(file_content: bytes, file_path: str) -> str:
    url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{file_path}"
    headers = {
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/octet-stream"
    }
    async with httpx.AsyncClient(timeout=30.0) as http_client:
        response = await http_client.post(url, content=file_content, headers=headers)
        if response.status_code not in [200, 201]:
            logger.error(f"Supabase upload error: {response.text}")
            raise Exception(f"Upload failed: {response.status_code}")
        return file_path


async def download_from_supabase(file_path: str) -> bytes:
    url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{file_path}"
    headers = {"Authorization": f"Bearer {SUPABASE_KEY}"}
    async with httpx.AsyncClient(timeout=30.0) as http_client:
        response = await http_client.get(url, headers=headers)
        if response.status_code != 200:
            logger.error(f"Supabase download error: {response.text}")
            raise Exception(f"Download failed: {response.status_code}")
        return response.content


async def delete_from_supabase(file_path: str):
    url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{file_path}"
    headers = {"Authorization": f"Bearer {SUPABASE_KEY}"}
    async with httpx.AsyncClient(timeout=30.0) as http_client:
        response = await http_client.delete(url, headers=headers)
        if response.status_code not in [200, 204]:
            logger.error(f"Supabase delete error: {response.text}")


# Storage Helper Functions
async def save_file_to_storage(file_content: bytes, filename: str, original_name: str, uploaded_by: str) -> dict:
    if STORAGE_MODE == "supabase":
        try:
            file_path = f"{uploaded_by}/{filename}"
            await upload_to_supabase(file_content, file_path)
            logger.info(f"☁️ Arquivo salvo no Supabase: {file_path}")
            return {"storage_location": "supabase", "supabase_path": file_path, "filename": filename}
        except Exception as e:
            logger.error(f"❌ Erro no Supabase: {e}. Usando local.")
    
    file_path = UPLOAD_DIR / filename
    async with aiofiles.open(file_path, 'wb') as out_file:
        await out_file.write(file_content)
    logger.info(f"💾 Arquivo salvo localmente: {file_path}")
    return {"storage_location": "local", "supabase_path": None, "filename": filename}


async def get_file_from_storage(file_metadata: dict) -> bytes:
    if file_metadata.get("storage_location") == "supabase":
        try:
            return await download_from_supabase(file_metadata["supabase_path"])
        except Exception as e:
            logger.error(f"❌ Erro ao baixar do Supabase: {e}")
            raise HTTPException(status_code=404, detail="File not found")
    
    file_path = UPLOAD_DIR / file_metadata["filename"]
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    async with aiofiles.open(file_path, 'rb') as f:
        return await f.read()


async def delete_file_from_storage(file_metadata: dict):
    if file_metadata.get("storage_location") == "supabase":
        try:
            await delete_from_supabase(file_metadata["supabase_path"])
            logger.info(f"🗑️ Arquivo removido do Supabase")
        except Exception as e:
            logger.error(f"❌ Erro ao deletar do Supabase: {e}")
    else:
        file_path = UPLOAD_DIR / file_metadata["filename"]
        if file_path.exists():
            file_path.unlink()
            logger.info(f"🗑️ Arquivo removido localmente")


async def update_file_last_accessed(file_id: str):
    """Atualiza o campo last_accessed_at quando um arquivo é acessado"""
    await db.files.update_one(
        {"id": file_id},
        {"$set": {"last_accessed_at": datetime.now(timezone.utc)}}
    )


# Helper functions
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


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
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await db.users.find_one({"username": username}, {"_id": 0})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    
    return User(**user)


async def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


async def check_file_access(file_metadata: dict, current_user: User) -> bool:
    """Verifica se o usuário tem acesso ao arquivo (owner, team member ou admin)"""
    # Admin tem acesso a tudo
    if current_user.role == "admin":
        return True
    
    # Owner sempre tem acesso
    if file_metadata["uploaded_by"] == current_user.username:
        return True
    
    # Se for público, todos têm acesso
    if not file_metadata.get("is_private", True):
        return True
    
    # Se o arquivo pertence a um time, verifica se o usuário é membro
    if file_metadata.get("team_id"):
        team = await db.teams.find_one({"id": file_metadata["team_id"]}, {"_id": 0})
        if team and current_user.username in team.get("members_v2", []):
            return True
    
    return False


# Background Task: Auto-Delete Inactive Files
async def cleanup_inactive_files():
    """Remove arquivos inativos há mais de 730 dias (2 anos)"""
    try:
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=730)
        
        # Busca arquivos inativos
        inactive_files = await db.files.find({
            "last_accessed_at": {"$lt": cutoff_date}
        }, {"_id": 0}).to_list(1000)
        
        deleted_count = 0
        for file_metadata in inactive_files:
            try:
                # Remove do storage
                await delete_file_from_storage(file_metadata)
                
                # Remove do banco
                await db.files.delete_one({"id": file_metadata["id"]})
                
                # Remove links de compartilhamento associados
                await db.share_links.delete_many({"file_id": file_metadata["id"]})
                
                deleted_count += 1
                logger.info(f"🗑️ Arquivo inativo removido: {file_metadata['original_name']}")
            except Exception as e:
                logger.error(f"❌ Erro ao remover arquivo {file_metadata['id']}: {e}")
        
        if deleted_count > 0:
            logger.info(f"✅ Limpeza concluída: {deleted_count} arquivos inativos removidos")
        
    except Exception as e:
        logger.error(f"❌ Erro na limpeza de arquivos inativos: {e}")


# Startup Event: Schedule cleanup task
@app.on_event("startup")
async def startup_event():
    """Agenda a tarefa de limpeza para executar periodicamente"""
    async def periodic_cleanup():
        while True:
            await asyncio.sleep(86400)  # Executa a cada 24 horas
            await cleanup_inactive_files()
    
    asyncio.create_task(periodic_cleanup())
    logger.info("✅ Background task de limpeza iniciada")


# Auth routes
@api_router.post("/register", response_model=Token)
async def register(user: UserCreate):
    existing_user = await db.users.find_one({"username": user.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    hashed_password = get_password_hash(user.password)
    new_user = User(username=user.username, role="user")
    
    user_dict = new_user.model_dump()
    user_dict["hashed_password"] = hashed_password
    
    await db.users.insert_one(user_dict)
    
    access_token = create_access_token(data={"sub": new_user.username})
    
    return Token(access_token=access_token, token_type="bearer", user=new_user)


@api_router.post("/login", response_model=Token)
async def login(user: UserLogin):
    db_user = await db.users.find_one({"username": user.username})
    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(user.password, db_user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user_obj = User(**{k: v for k, v in db_user.items() if k != "hashed_password"})
    access_token = create_access_token(data={"sub": user_obj.username})
    
    return Token(access_token=access_token, token_type="bearer", user=user_obj)


@api_router.post("/auth/discord", response_model=Token)
async def discord_auth(auth_data: DiscordAuthRequest):
    existing_user = await db.users.find_one({"discord_id": auth_data.discordId})
    
    if existing_user:
        user = User(**{k: v for k, v in existing_user.items() if k != "hashed_password"})
        access_token = create_access_token(data={"sub": user.username})
        return Token(access_token=access_token, token_type="bearer", user=user)
    
    new_user = User(
        username=auth_data.username,
        email=auth_data.email,
        discord_id=auth_data.discordId,
        discriminator=auth_data.discriminator,
        avatar_url=auth_data.avatar,
        role="user"
    )
    
    await db.users.insert_one(new_user.model_dump())
    access_token = create_access_token(data={"sub": new_user.username})
    
    return Token(access_token=access_token, token_type="bearer", user=new_user)


# Google OAuth routes
@api_router.get('/auth/google/login')
async def google_login(request: Request):
    redirect_uri = f"{BACKEND_URL}/api/auth/google/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri)


@api_router.get('/auth/google/callback')
async def google_callback(request: Request):
    try:
        token = await oauth.google.authorize_access_token(request)
        user_info = token.get('userinfo')
        
        if not user_info:
            raise HTTPException(status_code=400, detail="Failed to get user info")
        
        google_id = user_info.get('sub')
        email = user_info.get('email')
        name = user_info.get('name', email.split('@')[0])
        picture = user_info.get('picture')
        
        existing_user = await db.users.find_one({"google_id": google_id})
        
        if existing_user:
            user = User(**{k: v for k, v in existing_user.items() if k != "hashed_password"})
        else:
            username = email.split('@')[0]
            base_username = username
            counter = 1
            while await db.users.find_one({"username": username}):
                username = f"{base_username}{counter}"
                counter += 1
            
            new_user = User(
                username=username,
                email=email,
                google_id=google_id,
                avatar_url=picture,
                role="user"
            )
            await db.users.insert_one(new_user.model_dump())
            user = new_user
        
        access_token = create_access_token(data={"sub": user.username})
        
        redirect_url = f"{FRONTEND_URL}/auth/callback?token={access_token}"
        return RedirectResponse(url=redirect_url)
        
    except Exception as e:
        logger.error(f"Google OAuth error: {e}")
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=oauth_failed")


@api_router.get("/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


# Team routes
@api_router.post("/teams", response_model=Team)
async def create_team(team_data: TeamCreate, current_user: User = Depends(get_current_user)):
    """Cria um novo time"""
    new_team = Team(
        name=team_data.name,
        owner_id=current_user.username,
        members_v2=[current_user.username]
    )
    
    await db.teams.insert_one(new_team.model_dump())
    
    return new_team


@api_router.get("/teams", response_model=List[Team])
async def list_teams(current_user: User = Depends(get_current_user)):
    """Lista todos os times do usuário (onde ele é membro)"""
    teams = await db.teams.find(
        {"members_v2": current_user.username},
        {"_id": 0}
    ).to_list(100)
    
    return teams


@api_router.get("/teams/{team_id}", response_model=Team)
async def get_team(team_id: str, current_user: User = Depends(get_current_user)):
    """Obtém detalhes de um time específico"""
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    if current_user.username not in team.get("members_v2", []):
        raise HTTPException(status_code=403, detail="You are not a member of this team")
    
    return Team(**team)


@api_router.post("/teams/{team_id}/invite")
async def invite_to_team(
    team_id: str,
    invite_data: TeamInvite,
    current_user: User = Depends(get_current_user)
):
    """Convida um usuário para o time (apenas o owner pode convidar)"""
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    if team["owner_id"] != current_user.username:
        raise HTTPException(status_code=403, detail="Only team owner can invite members")
    
    # Verifica se o usuário existe
    user_to_invite = await db.users.find_one({"username": invite_data.username})
    if not user_to_invite:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verifica se já é membro
    if invite_data.username in team.get("members_v2", []):
        raise HTTPException(status_code=400, detail="User is already a team member")
    
    # Adiciona o membro
    await db.teams.update_one(
        {"id": team_id},
        {"$push": {"members_v2": invite_data.username}}
    )
    
    return {"message": f"User {invite_data.username} invited to team successfully"}


@api_router.delete("/teams/{team_id}/members/{username}")
async def remove_from_team(
    team_id: str,
    username: str,
    current_user: User = Depends(get_current_user)
):
    """Remove um membro do time (owner pode remover qualquer um, membros podem sair)"""
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Owner pode remover qualquer um, ou o próprio usuário pode sair
    if team["owner_id"] != current_user.username and username != current_user.username:
        raise HTTPException(status_code=403, detail="You don't have permission to remove this member")
    
    # Não pode remover o owner
    if username == team["owner_id"]:
        raise HTTPException(status_code=400, detail="Cannot remove team owner")
    
    await db.teams.update_one(
        {"id": team_id},
        {"$pull": {"members_v2": username}}
    )
    
    return {"message": f"User {username} removed from team successfully"}


# File routes
@api_router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    is_private: bool = Form(True),
    password: Optional[str] = Form(None),
    team_id: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
):
    file_content = await file.read()
    file_extension = Path(file.filename).suffix
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    
    # Verifica se o team_id é válido e se o usuário é membro
    if team_id:
        team = await db.teams.find_one({"id": team_id}, {"_id": 0})
        if not team:
            raise HTTPException(status_code=404, detail="Team not found")
        if current_user.username not in team.get("members_v2", []):
            raise HTTPException(status_code=403, detail="You are not a member of this team")
    
    storage_info = await save_file_to_storage(
        file_content, 
        unique_filename, 
        file.filename, 
        current_user.username
    )
    
    file_metadata = FileMetadata(
        filename=storage_info["filename"],
        original_name=file.filename,
        file_type=file.content_type or "application/octet-stream",
        file_size=len(file_content),
        uploaded_by=current_user.username,
        is_private=is_private,
        has_password=bool(password),
        password_hash=get_password_hash(password) if password else None,
        team_id=team_id,
        storage_location=storage_info["storage_location"],
        supabase_path=storage_info.get("supabase_path")
    )
    
    await db.files.insert_one(file_metadata.model_dump())
    
    return {
        "id": file_metadata.id,
        "filename": file_metadata.original_name,
        "file_size": file_metadata.file_size,
        "uploaded_at": file_metadata.uploaded_at,
        "storage_location": file_metadata.storage_location,
        "team_id": file_metadata.team_id
    }


@api_router.get("/files", response_model=List[FileMetadata])
async def list_files(current_user: User = Depends(get_current_user)):
    if current_user.role == "admin":
        files = await db.files.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    else:
        # Busca os times do usuário
        user_teams = await db.teams.find(
            {"members_v2": current_user.username},
            {"_id": 0, "id": 1}
        ).to_list(100)
        team_ids = [team["id"] for team in user_teams]
        
        # Busca arquivos: próprios, públicos ou de times
        files = await db.files.find(
            {
                "$or": [
                    {"uploaded_by": current_user.username},
                    {"is_private": False},
                    {"team_id": {"$in": team_ids}}
                ]
            },
            {"_id": 0, "password_hash": 0}
        ).to_list(1000)
    
    return files


@api_router.post("/files/{file_id}/verify-password")
async def verify_file_password(
    file_id: str,
    password_data: FilePasswordVerify,
    current_user: User = Depends(get_current_user)
):
    """Verifica se a senha fornecida está correta para um arquivo protegido"""
    file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
    
    if not file_metadata:
        raise HTTPException(status_code=404, detail="File not found")
    
    if not file_metadata.get("has_password"):
        return {"valid": True, "message": "File does not require password"}
    
    if not file_metadata.get("password_hash"):
        raise HTTPException(status_code=500, detail="Password hash not found")
    
    is_valid = verify_password(password_data.password, file_metadata["password_hash"])
    
    if is_valid:
        return {"valid": True, "message": "Password correct"}
    else:
        return {"valid": False, "message": "Invalid password"}


@api_router.get("/files/{file_id}/preview")
async def preview_file(file_id: str, current_user: User = Depends(get_current_user)):
    """Endpoint para preview de arquivos (texto, PDF, imagens)"""
    file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
    
    if not file_metadata:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Verifica permissões (owner, team member ou admin)
    if not await check_file_access(file_metadata, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Atualiza last_accessed_at
    await update_file_last_accessed(file_id)
    
    file_content = await get_file_from_storage(file_metadata)
    file_type = file_metadata.get("file_type", "application/octet-stream")
    original_name = file_metadata.get("original_name", "file")
    
    # Para imagens, retorna como base64
    if file_type.startswith("image/"):
        base64_content = base64.b64encode(file_content).decode('utf-8')
        return {
            "previewable": True,
            "file_type": file_type,
            "original_name": original_name,
            "content": f"data:{file_type};base64,{base64_content}"
        }
    
    # Para PDFs, retorna como base64
    if file_type == "application/pdf":
        base64_content = base64.b64encode(file_content).decode('utf-8')
        return {
            "previewable": True,
            "file_type": file_type,
            "original_name": original_name,
            "content": f"data:{file_type};base64,{base64_content}",
            "is_pdf": True
        }
    
    # Para texto, retorna como texto
    if file_type.startswith("text/") or file_type in ["application/json", "application/xml"]:
        try:
            text_content = file_content.decode('utf-8')
            # Limita o tamanho do preview de texto
            if len(text_content) > 100000:
                text_content = text_content[:100000] + "\n\n... (arquivo truncado para preview)"
            return {
                "previewable": True,
                "file_type": file_type,
                "original_name": original_name,
                "content": text_content
            }
        except UnicodeDecodeError:
            return {
                "previewable": False,
                "file_type": file_type,
                "original_name": original_name,
                "message": "Não foi possível decodificar o arquivo"
            }
    
    return {
        "previewable": False,
        "file_type": file_type,
        "original_name": original_name,
        "message": "Tipo de arquivo não suportado para preview"
    }


@api_router.get("/files/{file_id}/download")
async def download_file(file_id: str, current_user: User = Depends(get_current_user)):
    file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
    
    if not file_metadata:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Verifica permissões (owner, team member ou admin)
    if not await check_file_access(file_metadata, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Atualiza last_accessed_at
    await update_file_last_accessed(file_id)
    
    file_content = await get_file_from_storage(file_metadata)
    
    return StreamingResponse(
        io.BytesIO(file_content),
        media_type=file_metadata["file_type"],
        headers={"Content-Disposition": f'attachment; filename="{file_metadata["original_name"]}"'}
    )


@api_router.post("/files/{file_id}/share")
async def create_share_link(
    file_id: str,
    current_user: User = Depends(get_current_user)
):
    """Gera um link de compartilhamento público para um arquivo"""
    file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
    
    if not file_metadata:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Verifica permissões (owner, team member ou admin)
    if not await check_file_access(file_metadata, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Cria o link de compartilhamento
    share_link = ShareLink(
        file_id=file_id,
        created_by=current_user.username
    )
    
    await db.share_links.insert_one(share_link.model_dump())
    
    share_url = f"{FRONTEND_URL}/shared/{share_link.share_token}"
    
    return {
        "share_token": share_link.share_token,
        "share_url": share_url,
        "created_at": share_link.created_at
    }


@api_router.get("/shared/{share_token}")
async def download_shared_file(share_token: str):
    """Download público via token (sem necessidade de login)"""
    share_link = await db.share_links.find_one({"share_token": share_token}, {"_id": 0})
    
    if not share_link:
        raise HTTPException(status_code=404, detail="Share link not found")
    
    # Verifica se o link expirou (se expires_at foi definido)
    if share_link.get("expires_at"):
        if datetime.now(timezone.utc) > share_link["expires_at"]:
            raise HTTPException(status_code=410, detail="Share link has expired")
    
    file_metadata = await db.files.find_one({"id": share_link["file_id"]}, {"_id": 0})
    
    if not file_metadata:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Atualiza last_accessed_at
    await update_file_last_accessed(share_link["file_id"])
    
    file_content = await get_file_from_storage(file_metadata)
    
    return StreamingResponse(
        io.BytesIO(file_content),
        media_type=file_metadata["file_type"],
        headers={"Content-Disposition": f'attachment; filename="{file_metadata["original_name"]}"'}
    )


@api_router.get("/files/{file_id}/share-links")
async def list_share_links(
    file_id: str,
    current_user: User = Depends(get_current_user)
):
    """Lista todos os links de compartilhamento de um arquivo"""
    file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
    
    if not file_metadata:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Verifica permissões
    if not await check_file_access(file_metadata, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    
    share_links = await db.share_links.find(
        {"file_id": file_id},
        {"_id": 0}
    ).to_list(100)
    
    for link in share_links:
        link["share_url"] = f"{FRONTEND_URL}/shared/{link['share_token']}"
    
    return share_links


@api_router.delete("/share-links/{share_token}")
async def delete_share_link(
    share_token: str,
    current_user: User = Depends(get_current_user)
):
    """Remove um link de compartilhamento"""
    share_link = await db.share_links.find_one({"share_token": share_token}, {"_id": 0})
    
    if not share_link:
        raise HTTPException(status_code=404, detail="Share link not found")
    
    file_metadata = await db.files.find_one({"id": share_link["file_id"]}, {"_id": 0})
    
    if not file_metadata:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Apenas o criador do link ou o dono do arquivo podem deletar
    if share_link["created_by"] != current_user.username and file_metadata["uploaded_by"] != current_user.username:
        if current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Access denied")
    
    await db.share_links.delete_one({"share_token": share_token})
    
    return {"message": "Share link deleted successfully"}


@api_router.delete("/files/{file_id}")
async def delete_file(file_id: str, current_user: User = Depends(get_current_user)):
    file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_metadata:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Apenas admin ou owner podem deletar
    if file_metadata["uploaded_by"] != current_user.username and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    
    await delete_file_from_storage(file_metadata)
    await db.files.delete_one({"id": file_id})
    
    # Remove links de compartilhamento associados
    await db.share_links.delete_many({"file_id": file_id})
    
    return {"message": "File deleted successfully"}


# User stats route
@api_router.get("/user/stats")
async def get_user_stats(current_user: User = Depends(get_current_user)):
    files = await db.files.find({"uploaded_by": current_user.username}, {"file_size": 1}).to_list(10000)
    total_storage = sum(f.get("file_size", 0) for f in files)
    
    return {
        "total_files": len(files),
        "total_storage_bytes": total_storage,
        "total_storage_mb": round(total_storage / (1024 * 1024), 2)
    }


# Admin routes
@api_router.get("/admin/stats")
async def get_stats(current_user: User = Depends(get_admin_user)):
    total_users = await db.users.count_documents({})
    total_files = await db.files.count_documents({})
    total_teams = await db.teams.count_documents({})
    files = await db.files.find({}, {"file_size": 1}).to_list(10000)
    total_storage = sum(f.get("file_size", 0) for f in files)
    settings = await db.settings.find_one({"key": "chat_enabled"})
    
    return {
        "total_users": total_users,
        "total_files": total_files,
        "total_teams": total_teams,
        "total_storage_bytes": total_storage,
        "total_storage_mb": round(total_storage / (1024 * 1024), 2),
        "chat_enabled": settings.get("value", False) if settings else False,
        "storage_mode": STORAGE_MODE
    }


@api_router.post("/admin/cleanup")
async def manual_cleanup(current_user: User = Depends(get_admin_user)):
    """Executa manualmente a limpeza de arquivos inativos (apenas Admin)"""
    await cleanup_inactive_files()
    return {"message": "Cleanup task executed successfully"}


# Chat routes
@api_router.get("/chat/enabled")
async def get_chat_enabled(current_user: User = Depends(get_current_user)):
    settings = await db.settings.find_one({"key": "chat_enabled"})
    return {"enabled": settings.get("value", False) if settings else False}


@api_router.get("/chat/status")
async def get_chat_status():
    """Verifica se o chat está ativo ou não"""
    settings = await db.settings.find_one({"key": "chat_enabled"})
    return {"enabled": settings["value"] if settings else False}


@api_router.get("/chat/messages", response_model=List[ChatMessage])
async def get_chat_messages(current_user: User = Depends(get_current_user)):
    settings = await db.settings.find_one({"key": "chat_enabled"})
    if not settings or not settings.get("value", False):
        if current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Chat is disabled")
    
    messages = await db.chat_messages.find({}, {"_id": 0}).sort("timestamp", -1).limit(100).to_list(100)
    
    for msg in messages:
        if isinstance(msg['timestamp'], str):
            msg['timestamp'] = datetime.fromisoformat(msg['timestamp'])
    
    return list(reversed(messages))


@api_router.post("/chat/toggle")
async def toggle_chat(config: ChatToggle, current_user: User = Depends(get_admin_user)):
    """Ativa ou desativa o chat (Apenas Admin)"""
    await db.settings.update_one(
        {"key": "chat_enabled"},
        {"$set": {"value": config.enabled}},
        upsert=True
    )
    return {"status": "success", "enabled": config.enabled}


@api_router.post("/admin/chat/toggle")
async def admin_toggle_chat(data: ChatToggle, current_user: User = Depends(get_admin_user)):
    await db.settings.update_one(
        {"key": "chat_enabled"},
        {"$set": {"value": data.enabled}},
        upsert=True
    )
    return {"enabled": data.enabled}


@api_router.delete("/chat/clear")
async def clear_chat(current_user: User = Depends(get_admin_user)):
    """Limpa todas as mensagens (Apenas Admin)"""
    await db.chat_messages.delete_many({})
    return {"status": "success", "message": "Chat limpo com sucesso"}


# WebSocket Chat
@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    await websocket.accept()
    active_connections.add(websocket)
    logger.info(f"✅ WebSocket conectado. Total: {len(active_connections)}")
    
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            settings = await db.settings.find_one({"key": "chat_enabled"})
            chat_enabled = settings.get("value", False) if settings else False
            
            user = await db.users.find_one(
                {"username": message_data.get("username")}, 
                {"_id": 0}
            )
            
            if not user:
                await websocket.send_json({
                    "type": "error",
                    "message": "User not found"
                })
                continue
            
            if not chat_enabled and user.get("role") != "admin":
                await websocket.send_json({
                    "type": "error",
                    "message": "Chat is disabled"
                })
                continue
            
            chat_message = ChatMessage(
                username=message_data.get("username"),
                message=message_data.get("message"),
                role=user.get("role", "user")
            )
            
            message_doc = chat_message.model_dump()
            message_doc["timestamp"] = message_doc["timestamp"].isoformat()
            await db.chat_messages.insert_one(message_doc)
            
            broadcast_data = {
                "type": "message",
                "data": {
                    "id": chat_message.id,
                    "username": chat_message.username,
                    "message": chat_message.message,
                    "role": chat_message.role,
                    "timestamp": chat_message.timestamp.isoformat()
                }
            }
            
            disconnected = set()
            for connection in active_connections:
                try:
                    await connection.send_json(broadcast_data)
                except Exception as e:
                    logger.error(f"❌ Erro ao enviar mensagem: {e}")
                    disconnected.add(connection)
            
            active_connections.difference_update(disconnected)
            
            logger.info(f"💬 Mensagem de {chat_message.username}: {chat_message.message[:50]}")
            
    except WebSocketDisconnect:
        active_connections.discard(websocket)
        logger.info(f"❌ WebSocket desconectado. Total: {len(active_connections)}")
    except Exception as e:
        logger.error(f"❌ Erro no WebSocket: {e}")
        active_connections.discard(websocket)
        try:
            await websocket.close()
        except:
            pass


# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[
        "https://biblioteca-sigma-gilt.vercel.app",
        "http://localhost:3000",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


# Mount frontend
try:
    from static_server import mount_frontend
    mount_frontend(app)
except:
    logger.warning("⚠️ static_server não encontrado")
