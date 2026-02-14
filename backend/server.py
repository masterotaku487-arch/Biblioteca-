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
        """Cria novo banco se necessário"""
        try:
            current_db = self.databases[self.current_db_index]
            stats = await current_db.command("dbStats")
            current_size = stats.get("dataSize", 0)
            
            if current_size >= (self.max_size_bytes * 0.8):
                self.current_db_index += 1
                new_db_name = f"{self.base_db_name}_{self.current_db_index}"
                self.databases[self.current_db_index] = self.client[new_db_name]
                logger.warning(f"MongoDB capacity reached! Creating: {new_db_name}")
                return self.databases[self.current_db_index]
            return current_db
        except:
            return self.databases[self.current_db_index]

# Inicializar MongoDB Manager
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
    return {"storage_location": "local", "supabase_path": None, "filename": filename}

async def get_file_from_storage(file_metadata: dict) -> bytes:
    if file_metadata.get("storage_location") == "supabase":
        try:
            return await download_from_supabase(file_metadata["supabase_path"])
        except:
            pass
    
    file_path = UPLOAD_DIR / file_metadata["filename"]
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    async with aiofiles.open(file_path, 'rb') as f:
        return await f.read()

async def delete_file_from_storage(file_metadata: dict):
    if file_metadata.get("storage_location") == "supabase":
        try:
            await delete_from_supabase(file_metadata["supabase_path"])
        except:
            pass
    else:
        file_path = UPLOAD_DIR / file_metadata["filename"]
        if file_path.exists():
            file_path.unlink()

# Auth helpers
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401)
    except JWTError:
        raise HTTPException(status_code=401)
    
    user = await db.users.find_one({"username": username}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401)
    return User(**user)

async def get_admin_user(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403)
    return current_user

# Startup
@app.on_event("startup")
async def startup_event():
    admin = await db.users.find_one({"username": "Masterotaku"})
    if not admin:
        admin_user = User(username="Masterotaku", role="admin")
        admin_doc = admin_user.model_dump()
        admin_doc["password_hash"] = get_password_hash("adm123")
        admin_doc["created_at"] = admin_doc["created_at"].isoformat()
        await db.users.insert_one(admin_doc)
    
    if not await db.settings.find_one({"key": "chat_enabled"}):
        await db.settings.insert_one({"key": "chat_enabled", "value": False})

# Auth routes
@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    if await db.users.find_one({"username": user_data.username}):
        raise HTTPException(status_code=400, detail="Username already registered")
    
    new_user = User(username=user_data.username, role="user")
    user_doc = new_user.model_dump()
    user_doc["password_hash"] = get_password_hash(user_data.password)
    user_doc["created_at"] = user_doc["created_at"].isoformat()
    await db.users.insert_one(user_doc)
    
    access_token = create_access_token(
        data={"sub": user_data.username},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return Token(access_token=access_token, token_type="bearer", user=new_user)

@api_router.post("/auth/login", response_model=Token)
async def login(user_data: UserLogin):
    user = await db.users.find_one({"username": user_data.username}, {"_id": 0})
    if not user or not verify_password(user_data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    
    access_token = create_access_token(
        data={"sub": user_data.username},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return Token(access_token=access_token, token_type="bearer", user=User(**user))

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.put("/user/theme")
async def update_theme(data: ThemeUpdate, current_user: User = Depends(get_current_user)):
    await db.users.update_one({"username": current_user.username}, {"$set": {"theme": data.theme}})
    return {"theme": data.theme}

# Google OAuth
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
            raise HTTPException(status_code=400)
        
        google_id = user_info.get('sub')
        email = user_info.get('email')
        name = user_info.get('name', email.split('@')[0])
        avatar_url = user_info.get('picture')
        
        existing_user = await db.users.find_one({"$or": [{"google_id": google_id}, {"email": email}]}, {"_id": 0})
        
        if existing_user:
            if not existing_user.get("google_id"):
                await db.users.update_one({"email": email}, {"$set": {"google_id": google_id, "avatar_url": avatar_url}})
            user_data = existing_user
        else:
            username = email.split('@')[0]
            counter = 1
            while await db.users.find_one({"username": username}):
                username = f"{email.split('@')[0]}{counter}"
                counter += 1
            
            new_user = User(username=username, email=email, google_id=google_id, avatar_url=avatar_url, role="user")
            user_doc = new_user.model_dump()
            user_doc["created_at"] = user_doc["created_at"].isoformat()
            user_doc["password_hash"] = None
            await db.users.insert_one(user_doc)
            user_data = user_doc
        
        access_token = create_access_token(
            data={"sub": user_data["username"]},
            expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        return RedirectResponse(url=f"{FRONTEND_URL}/auth/google/success?token={access_token}")
    except Exception as e:
        logger.error(f"Google auth error: {e}")
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=google_auth_failed")

# Discord OAuth
@api_router.post("/auth/discord")
async def discord_auth(data: DiscordAuthRequest):
    try:
        existing_user = await db.users.find_one({"$or": [{"discord_id": data.discordId}, {"email": data.email}]}, {"_id": 0})
        
        if existing_user:
            await db.users.update_one(
                {"discord_id": data.discordId},
                {"$set": {"username": data.username, "avatar_url": data.avatar, "email": data.email}}
            )
            user_data = existing_user
        else:
            username = data.username
            counter = 1
            while await db.users.find_one({"username": username}):
                username = f"{data.username}{counter}"
                counter += 1
            
            new_user = User(username=username, email=data.email, discord_id=data.discordId, avatar_url=data.avatar, role="user")
            user_doc = new_user.model_dump()
            user_doc["created_at"] = user_doc["created_at"].isoformat()
            user_doc["password_hash"] = None
            await db.users.insert_one(user_doc)
            user_data = user_doc
        
        access_token = create_access_token(
            data={"sub": user_data["username"]},
            expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        return {
            "token": access_token,
            "user": {
                "id": user_data.get("id"),
                "username": user_data.get("username"),
                "email": user_data.get("email"),
                "avatar_url": user_data.get("avatar_url"),
                "role": user_data.get("role", "user")
            }
        }
    except Exception as e:
        logger.error(f"Discord auth error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        
# 1. Rota para Listar os Times (Ajustada para /my-teams)
@api_router.get("/teams/my-teams")
async def get_my_teams(current_user: User = Depends(get_current_user)):
    # Busca times onde o usuário é membro ou dono
    teams = await db.teams.find({"members": current_user.username}, {"_id": 0}).to_list(1000)
    # Garante que os campos de data não quebrem o JSON
    for team in teams:
        if 'created_at' in team and not isinstance(team['created_at'], str):
            team['created_at'] = team['created_at'].isoformat()
    return teams

# 2. Rota para Listar Convites (A que faltava e causava erro)
@api_router.get("/teams/invites")
async def get_my_invites(current_user: User = Depends(get_current_user)):
    invites = await db.team_invites.find({
        "invitee_username": current_user.username, 
        "status": "pending"
    }, {"_id": 0}).to_list(100)
    return invites

# 3. Rota para Enviar Convites (Usada pelo botão "Adicionar Membro")
@api_router.post("/teams/invites")
async def send_team_invite(data: dict, current_user: User = Depends(get_current_user)):
    # data deve conter 'team_id' e 'username' (do convidado)
    invite_doc = {
        "id": str(uuid.uuid4()),
        "team_id": data.get("team_id"),
        "team_name": data.get("team_name"), # Opcional, para exibição
        "inviter_username": current_user.username,
        "invitee_username": data.get("username"),
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.team_invites.insert_one(invite_doc)
    return {"message": "Convite enviado!"}
    

# File routes
@api_router.post("/files/upload", response_model=FileMetadata)
async def upload_file(
    file: UploadFile = File(...),
    password: Optional[str] = Form(None),
    team_id: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
):
    if team_id:
        team = await db.teams.find_one({"id": team_id})
        if not team or current_user.username not in team["members"]:
            raise HTTPException(status_code=403)
    
    file_id = str(uuid.uuid4())
    file_extension = Path(file.filename).suffix
    filename = f"{file_id}{file_extension}"
    
    content = await file.read()
    file_size = len(content)
    storage_info = await save_file_to_storage(content, filename, file.filename, current_user.username)
    
    file_metadata = FileMetadata(
        id=file_id, filename=filename, original_name=file.filename,
        file_type=file.content_type or "application/octet-stream",
        file_size=file_size, uploaded_by=current_user.username,
        team_id=team_id, is_private=(team_id is None),
        has_password=password is not None,
        storage_location=storage_info["storage_location"],
        supabase_path=storage_info.get("supabase_path")
    )
    
    metadata_doc = file_metadata.model_dump()
    metadata_doc["uploaded_at"] = metadata_doc["uploaded_at"].isoformat()
    if password:
        metadata_doc["password_hash"] = get_password_hash(password)
    
    await db.files.insert_one(metadata_doc)
    return file_metadata

@api_router.get("/files", response_model=List[FileMetadata])
async def get_files(current_user: User = Depends(get_current_user)):
    # MODIFICADO: Admin não vê mais arquivos de outros
    user_teams = await db.teams.find({"members": current_user.username}, {"id": 1}).to_list(1000)
    team_ids = [team["id"] for team in user_teams]
    query = {"$or": [
        {"uploaded_by": current_user.username},
        {"team_id": {"$in": team_ids}},
        {"shared_with": current_user.username}
    ]}
    
    files = await db.files.find(query, {"_id": 0, "password_hash": 0}).to_list(10000)
    for file in files:
        if isinstance(file['uploaded_at'], str):
            file['uploaded_at'] = datetime.fromisoformat(file['uploaded_at'])
    return files

@api_router.post("/files/{file_id}/share")
async def share_file(file_id: str, data: FileShare, current_user: User = Depends(get_current_user)):
    file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_metadata:
        raise HTTPException(status_code=404, detail="File not found")
    
    if file_metadata["uploaded_by"] != current_user.username and current_user.role != "admin":
        raise HTTPException(status_code=403)
    
    if not await db.users.find_one({"username": data.username}):
        raise HTTPException(status_code=404, detail="User not found")
    
    if data.username in file_metadata.get("shared_with", []):
        raise HTTPException(status_code=400, detail="Already shared")
    
    await db.files.update_one({"id": file_id}, {"$push": {"shared_with": data.username}})
    return {"message": f"File shared with {data.username}"}

@api_router.delete("/files/{file_id}/share/{username}")
async def unshare_file(file_id: str, username: str, current_user: User = Depends(get_current_user)):
    file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_metadata:
        raise HTTPException(status_code=404)
    
    if file_metadata["uploaded_by"] != current_user.username and current_user.role != "admin":
        raise HTTPException(status_code=403)
    
    await db.files.update_one({"id": file_id}, {"$pull": {"shared_with": username}})
    return {"message": "File unshared"}

@api_router.get("/files/{file_id}/preview")
async def preview_file(file_id: str, current_user: User = Depends(get_current_user)):
    file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_metadata:
        raise HTTPException(status_code=404)
    
    has_access = False
    if file_metadata["uploaded_by"] == current_user.username:
        has_access = True
    elif file_metadata.get("team_id"):
        team = await db.teams.find_one({"id": file_metadata["team_id"]})
        if team and current_user.username in team["members"]:
            has_access = True
    elif current_user.username in file_metadata.get("shared_with", []):
        has_access = True
    
    if not has_access:
        raise HTTPException(status_code=403)
    
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
    file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_metadata:
        raise HTTPException(status_code=404)
    
    file_content = await get_file_from_storage(file_metadata)
    return StreamingResponse(io.BytesIO(file_content), media_type=file_metadata["file_type"])

@api_router.post("/files/{file_id}/verify-password")
async def verify_file_password(file_id: str, data: FilePasswordVerify, current_user: User = Depends(get_current_user)):
    file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_metadata:
        raise HTTPException(status_code=404)
    
    if current_user.role == "admin":
        return {"valid": True}
    
    if not file_metadata.get("password_hash"):
        return {"valid": True}
    
    return {"valid": verify_password(data.password, file_metadata["password_hash"])}

@api_router.get("/files/{file_id}/download")
async def download_file(file_id: str, current_user: User = Depends(get_current_user)):
    file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_metadata:
        raise HTTPException(status_code=404)
    
    has_access = False
    if file_metadata["uploaded_by"] == current_user.username:
        has_access = True
    elif file_metadata.get("team_id"):
        team = await db.teams.find_one({"id": file_metadata["team_id"]})
        if team and current_user.username in team["members"]:
            has_access = True
    elif current_user.username in file_metadata.get("shared_with", []):
        has_access = True
    
    if not has_access:
        raise HTTPException(status_code=403)
    
    file_content = await get_file_from_storage(file_metadata)
    return StreamingResponse(
        io.BytesIO(file_content),
        media_type=file_metadata["file_type"],
        headers={"Content-Disposition": f"attachment; filename={file_metadata['original_name']}"}
    )

@api_router.delete("/files/{file_id}")
async def delete_file(file_id: str, current_user: User = Depends(get_admin_user)):
    file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_metadata:
        raise HTTPException(status_code=404)
    
    await delete_file_from_storage(file_metadata)
    await db.files.delete_one({"id": file_id})
    return {"message": "File deleted"}

# User stats
@api_router.get("/user/stats")
async def get_user_stats(current_user: User = Depends(get_current_user)):
    files = await db.files.find({"uploaded_by": current_user.username}, {"file_size": 1}).to_list(10000)
    total_storage = sum(f.get("file_size", 0) for f in files)
    teams = await db.teams.find({"members": current_user.username}).to_list(1000)
    
    return {
        "total_files": len(files),
        "total_storage_bytes": total_storage,
        "total_storage_mb": round(total_storage / (1024 * 1024), 2),
        "total_teams": len(teams)
    }

# Chat routes
@api_router.get("/chat/enabled")
async def get_chat_enabled(current_user: User = Depends(get_current_user)):
    settings = await db.settings.find_one({"key": "chat_enabled"})
    return {"enabled": settings.get("value", False) if settings else False}

@api_router.get("/chat/messages", response_model=List[ChatMessage])
async def get_chat_messages(current_user: User = Depends(get_current_user)):
    settings = await db.settings.find_one({"key": "chat_enabled"})
    if not settings or not settings.get("value", False):
        if current_user.role != "admin":
            raise HTTPException(status_code=403)
    
    messages = await db.chat_messages.find({}, {"_id": 0}).sort("timestamp", -1).limit(100).to_list(100)
    for msg in messages:
        if isinstance(msg['timestamp'], str):
            msg['timestamp'] = datetime.fromisoformat(msg['timestamp'])
    return list(reversed(messages))

@api_router.post("/admin/chat/toggle")
async def toggle_chat(data: ChatToggle, current_user: User = Depends(get_admin_user)):
    await db.settings.update_one({"key": "chat_enabled"}, {"$set": {"value": data.enabled}}, upsert=True)
    return {"enabled": data.enabled}

@api_router.delete("/admin/chat/messages/{message_id}")
async def delete_chat_message(message_id: str, current_user: User = Depends(get_admin_user)):
    result = await db.chat_messages.delete_one({"id": message_id})
    if result.deleted_count == 0:
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
            
            user = await db.users.find_one({"username": message_data.get("username")}, {"_id": 0})
            if not user:
                continue
            
            chat_message = ChatMessage(
                username=message_data.get("username"),
                message=message_data.get("message"),
                role=user.get("role", "user")
            )
            
            message_doc = chat_message.model_dump()
            message_doc["timestamp"] = message_doc["timestamp"].isoformat()
            await db.chat_messages.insert_one(message_doc)
            
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
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    for user in users:
        if isinstance(user['created_at'], str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
    return users

@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(get_admin_user)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user or user["role"] == "admin":
        raise HTTPException(status_code=403)
    await db.users.delete_one({"id": user_id})
    return {"message": "User deleted"}

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

@api_router.get("/admin/download-all")
async def download_all_files(current_user: User = Depends(get_admin_user)):
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        files = await db.files.find({}, {"_id": 0}).to_list(10000)
        for file_metadata in files:
            try:
                content = await get_file_from_storage(file_metadata)
                arcname = f"{file_metadata['uploaded_by']}/{file_metadata['original_name']}"
                zip_file.writestr(arcname, content)
            except:
                pass
    zip_buffer.seek(0)
    return StreamingResponse(iter([zip_buffer.getvalue()]), media_type="application/zip", headers={"Content-Disposition": "attachment; filename=backup.zip"})

@api_router.get("/admin/download-source-code")
async def download_source_code(current_user: User = Depends(get_admin_user)):
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for dir_path in [Path("/app/backend"), Path("/app/frontend")]:
            for file_path in dir_path.rglob("*"):
                if file_path.is_file() and 'node_modules' not in str(file_path) and '__pycache__' not in str(file_path):
                    try:
                        arcname = f"{dir_path.name}/{file_path.relative_to(dir_path)}"
                        zip_file.write(file_path, arcname)
                    except:
                        pass
    zip_buffer.seek(0)
    return StreamingResponse(iter([zip_buffer.getvalue()]), media_type="application/zip", headers={"Content-Disposition": "attachment; filename=source_code.zip"})

app.include_router(api_router)


# ===================================================================
# LIVE EDITING WEBSOCKET
# ===================================================================
class LiveConnectionManager:
    def __init__(self):
        self.active_connections = {}
    
    async def connect(self, websocket: WebSocket, team_id: str, file_id: str, username: str):
        await websocket.accept()
        if team_id not in self.active_connections:
            self.active_connections[team_id] = {}
        if file_id not in self.active_connections[team_id]:
            self.active_connections[team_id][file_id] = {}
        self.active_connections[team_id][file_id][username] = websocket
        
        await self.broadcast_to_session(team_id, file_id, {
            "type": "user_joined",
            "username": username,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }, exclude_username=username)
        
        active_users = list(self.active_connections[team_id][file_id].keys())
        await websocket.send_json({"type": "users_list", "users": active_users})
    
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
        
        user = await db.users.find_one({"username": username}, {"_id": 0})
        if not user:
            await websocket.send_json({"type": "error", "message": "User not found"})
            await websocket.close()
            return
        
        team = await db.teams.find_one({"id": team_id}, {"_id": 0})
        if not team or username not in team.get("members", []):
            await websocket.send_json({"type": "error", "message": "Not a team member"})
            await websocket.close()
            return
        
        file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
        if not file_metadata or file_metadata.get("team_id") != team_id:
            await websocket.send_json({"type": "error", "message": "File not found or not in team"})
            await websocket.close()
            return
        
        await live_manager.connect(websocket, team_id, file_id, username)
        logger.info(f"Live session: {username} joined file {file_id}")
        
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
    return {"team_id": team_id, "team_name": team.get("name"), "active_sessions": sessions}

# Team Invites
@api_router.post("/teams/{team_id}/invite")
async def invite_to_team(team_id: str, data: TeamAddMember, current_user: User = Depends(get_current_user)):
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team or current_user.username not in team["members"]:
        raise HTTPException(status_code=403)
    
    if not await db.users.find_one({"username": data.username}):
        raise HTTPException(status_code=404, detail="User not found")
    
    if data.username in team["members"]:
        raise HTTPException(status_code=400, detail="User already in team")
    
    existing = await db.team_invites.find_one({"team_id": team_id, "invitee_username": data.username, "status": "pending"})
    if existing:
        raise HTTPException(status_code=400, detail="Invite already sent")
    
    invite_doc = {
        "id": str(uuid.uuid4()),
        "team_id": team_id,
        "team_name": team["name"],
        "inviter_username": current_user.username,
        "invitee_username": data.username,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.team_invites.insert_one(invite_doc)
    return {"message": f"Invite sent to {data.username}"}

@api_router.get("/teams/invites")
async def get_my_invites(current_user: User = Depends(get_current_user)):
    invites = await db.team_invites.find({"invitee_username": current_user.username, "status": "pending"}, {"_id": 0}).to_list(100)
    return invites

@api_router.post("/teams/invites/{invite_id}/respond")
async def respond_to_invite(invite_id: str, data: dict, current_user: User = Depends(get_current_user)):
    invite = await db.team_invites.find_one({"id": invite_id}, {"_id": 0})
    if not invite or invite["invitee_username"] != current_user.username or invite["status"] != "pending":
        raise HTTPException(status_code=400)
    
    if data.get("action") == "accept":
        await db.teams.update_one({"id": invite["team_id"]}, {"$push": {"members": current_user.username}})
        await db.team_invites.update_one({"id": invite_id}, {"$set": {"status": "accepted"}})
        return {"message": "Invite accepted"}
    else:
        await db.team_invites.update_one({"id": invite_id}, {"$set": {"status": "rejected"}})
        return {"message": "Invite rejected"}



app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["https://biblioteca-sigma-gilt.vercel.app", "http://localhost:3000", "*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
