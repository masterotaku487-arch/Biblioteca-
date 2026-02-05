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
import zipfile
import base64

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
STORAGE_MODE = os.environ.get("STORAGE_MODE", "supabase")
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

# Discord OAuth configuration
DISCORD_CLIENT_ID = os.environ.get("DISCORD_CLIENT_ID")
DISCORD_CLIENT_SECRET = os.environ.get("DISCORD_CLIENT_SECRET")
DISCORD_REDIRECT_URI = os.environ.get("DISCORD_REDIRECT_URI", f"{BACKEND_URL}/api/auth/discord/callback")

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
    theme: str = "auto"  # auto, natal, carnaval, ano-novo, pascoa
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
    is_private: bool = True
    has_password: bool = False
    storage_location: str = "local"
    supabase_path: Optional[str] = None
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


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


# Supabase Storage Helper Functions
async def upload_to_supabase(file_content: bytes, file_path: str) -> str:
    url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{file_path}"
    headers = {
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/octet-stream"
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, content=file_content, headers=headers)
        if response.status_code not in [200, 201]:
            logger.error(f"Supabase upload error: {response.text}")
            raise Exception(f"Upload failed: {response.status_code}")
        return file_path


async def download_from_supabase(file_path: str) -> bytes:
    url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{file_path}"
    headers = {"Authorization": f"Bearer {SUPABASE_KEY}"}
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url, headers=headers)
        if response.status_code != 200:
            logger.error(f"Supabase download error: {response.text}")
            raise Exception(f"Download failed: {response.status_code}")
        return response.content


async def delete_from_supabase(file_path: str):
    url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{file_path}"
    headers = {"Authorization": f"Bearer {SUPABASE_KEY}"}
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.delete(url, headers=headers)
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
            logger.info(f"🗑️ Arquivo deletado do Supabase: {file_metadata['supabase_path']}")
        except Exception as e:
            logger.error(f"❌ Erro ao deletar do Supabase: {e}")
    else:
        file_path = UPLOAD_DIR / file_metadata["filename"]
        if file_path.exists():
            file_path.unlink()
            logger.info(f"🗑️ Arquivo deletado localmente: {file_path}")


# Helper functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"username": username}, {"_id": 0})
    if user is None:
        raise credentials_exception
    return User(**user)


async def get_admin_user(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


# Initialize
@app.on_event("startup")
async def startup_event():
    admin = await db.users.find_one({"username": "Masterotaku"})
    if not admin:
        admin_user = User(username="Masterotaku", role="admin")
        admin_doc = admin_user.model_dump()
        admin_doc["password_hash"] = get_password_hash("adm123")
        admin_doc["created_at"] = admin_doc["created_at"].isoformat()
        await db.users.insert_one(admin_doc)
        logger.info("✅ Admin user created")
    
    settings = await db.settings.find_one({"key": "chat_enabled"})
    if not settings:
        await db.settings.insert_one({"key": "chat_enabled", "value": False})
        logger.info("✅ Chat settings initialized")


# Auth routes
@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    existing_user = await db.users.find_one({"username": user_data.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    new_user = User(username=user_data.username, role="user")
    user_doc = new_user.model_dump()
    user_doc["password_hash"] = get_password_hash(user_data.password)
    user_doc["created_at"] = user_doc["created_at"].isoformat()
    await db.users.insert_one(user_doc)
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": user_data.username}, expires_delta=access_token_expires)
    
    return Token(access_token=access_token, token_type="bearer", user=new_user)


@api_router.post("/auth/login", response_model=Token)
async def login(user_data: UserLogin):
    user = await db.users.find_one({"username": user_data.username}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(user_data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": user_data.username}, expires_delta=access_token_expires)
    
    if isinstance(user['created_at'], str):
        user['created_at'] = datetime.fromisoformat(user['created_at'])
    
    return Token(access_token=access_token, token_type="bearer", user=User(**user))


# Google OAuth routes
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
        name = user_info.get('name', email.split('@')[0])
        avatar = user_info.get('picture')
        
        user = await db.users.find_one({"google_id": google_id}, {"_id": 0})
        
        if not user:
            username = name.replace(" ", "_").lower()
            base_username = username
            counter = 1
            while await db.users.find_one({"username": username}):
                username = f"{base_username}_{counter}"
                counter += 1
            
            new_user = User(
                username=username,
                email=email,
                google_id=google_id,
                avatar_url=avatar,
                role="user"
            )
            user_doc = new_user.model_dump()
            user_doc["created_at"] = user_doc["created_at"].isoformat()
            await db.users.insert_one(user_doc)
            user = user_doc
        
        if isinstance(user['created_at'], str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
        
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user["username"]},
            expires_delta=access_token_expires
        )
        
        return RedirectResponse(
            url=f"{FRONTEND_URL}/auth/callback?token={access_token}"
        )
        
    except Exception as e:
        logger.error(f"Google OAuth error: {e}")
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=oauth_failed")


# Discord OAuth routes
@api_router.post("/auth/discord", response_model=Token)
async def discord_auth(auth_data: DiscordAuthRequest):
    user = await db.users.find_one({"discord_id": auth_data.discordId}, {"_id": 0})
    
    if not user:
        username = auth_data.username.replace(" ", "_").lower()
        base_username = username
        counter = 1
        while await db.users.find_one({"username": username}):
            username = f"{base_username}_{counter}"
            counter += 1
        
        new_user = User(
            username=username,
            email=auth_data.email,
            discord_id=auth_data.discordId,
            discriminator=auth_data.discriminator,
            avatar_url=auth_data.avatar,
            role="user"
        )
        user_doc = new_user.model_dump()
        user_doc["created_at"] = user_doc["created_at"].isoformat()
        await db.users.insert_one(user_doc)
        user = user_doc
    
    if isinstance(user['created_at'], str):
        user['created_at'] = datetime.fromisoformat(user['created_at'])
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"]},
        expires_delta=access_token_expires
    )
    
    return Token(access_token=access_token, token_type="bearer", user=User(**user))


@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@api_router.patch("/auth/theme")
async def update_theme(theme_data: ThemeUpdate, current_user: User = Depends(get_current_user)):
    await db.users.update_one(
        {"username": current_user.username},
        {"$set": {"theme": theme_data.theme}}
    )
    return {"theme": theme_data.theme}


# Team routes
@api_router.post("/teams", response_model=Team)
async def create_team(team_data: TeamCreate, current_user: User = Depends(get_current_user)):
    new_team = Team(
        name=team_data.name,
        description=team_data.description,
        created_by=current_user.username,
        members=[current_user.username]
    )
    team_doc = new_team.model_dump()
    team_doc["created_at"] = team_doc["created_at"].isoformat()
    await db.teams.insert_one(team_doc)
    return new_team


@api_router.get("/teams", response_model=List[Team])
async def get_teams(current_user: User = Depends(get_current_user)):
    teams = await db.teams.find({"members": current_user.username}, {"_id": 0}).to_list(1000)
    for team in teams:
        if isinstance(team['created_at'], str):
            team['created_at'] = datetime.fromisoformat(team['created_at'])
    return teams


@api_router.post("/teams/{team_id}/members")
async def add_team_member(team_id: str, member_data: TeamAddMember, current_user: User = Depends(get_current_user)):
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    if team["created_by"] != current_user.username:
        raise HTTPException(status_code=403, detail="Only team creator can add members")
    
    user = await db.users.find_one({"username": member_data.username}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if member_data.username in team["members"]:
        raise HTTPException(status_code=400, detail="User already in team")
    
    await db.teams.update_one(
        {"id": team_id},
        {"$push": {"members": member_data.username}}
    )
    
    return {"message": "Member added successfully"}


@api_router.delete("/teams/{team_id}/members/{username}")
async def remove_team_member(team_id: str, username: str, current_user: User = Depends(get_current_user)):
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    if team["created_by"] != current_user.username and current_user.username != username:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    await db.teams.update_one(
        {"id": team_id},
        {"$pull": {"members": username}}
    )
    
    return {"message": "Member removed successfully"}


# File routes
@api_router.post("/files/upload")
async def upload_file(
    file: UploadFile = File(...),
    is_private: bool = Form(True),
    password: Optional[str] = Form(None),
    team_id: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
):
    file_content = await file.read()
    file_size = len(file_content)
    file_extension = Path(file.filename).suffix
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    
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
        file_size=file_size,
        uploaded_by=current_user.username,
        team_id=team_id,
        is_private=is_private,
        has_password=bool(password),
        storage_location=storage_info["storage_location"],
        supabase_path=storage_info.get("supabase_path")
    )
    
    file_doc = file_metadata.model_dump()
    file_doc["uploaded_at"] = file_doc["uploaded_at"].isoformat()
    
    if password:
        file_doc["password_hash"] = get_password_hash(password)
    
    await db.files.insert_one(file_doc)
    
    return file_metadata


@api_router.get("/files", response_model=List[FileMetadata])
async def get_files(current_user: User = Depends(get_current_user)):
    if current_user.role == "admin":
        files = await db.files.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    else:
        team_ids = []
        teams = await db.teams.find({"members": current_user.username}, {"id": 1}).to_list(1000)
        team_ids = [team["id"] for team in teams]
        
        files = await db.files.find({
            "$or": [
                {"uploaded_by": current_user.username},
                {"team_id": {"$in": team_ids}},
                {"is_private": False}
            ]
        }, {"_id": 0, "password_hash": 0}).to_list(1000)
    
    for file_meta in files:
        if isinstance(file_meta['uploaded_at'], str):
            file_meta['uploaded_at'] = datetime.fromisoformat(file_meta['uploaded_at'])
    
    return files


@api_router.get("/files/{file_id}/preview")
async def preview_file(file_id: str, current_user: User = Depends(get_current_user)):
    file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_metadata:
        raise HTTPException(status_code=404, detail="File not found")
    
    has_access = False
    if current_user.role == "admin" or file_metadata["uploaded_by"] == current_user.username:
        has_access = True
    elif file_metadata.get("team_id"):
        team = await db.teams.find_one({"id": file_metadata["team_id"]})
        if team and current_user.username in team["members"]:
            has_access = True
    elif not file_metadata["is_private"]:
        has_access = True
    
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")
    
    file_content = await get_file_from_storage(file_metadata)
    
    # For images, return base64
    if file_metadata["file_type"].startswith("image/"):
        base64_content = base64.b64encode(file_content).decode('utf-8')
        return {
            "type": "image",
            "content": f"data:{file_metadata['file_type']};base64,{base64_content}",
            "filename": file_metadata["original_name"]
        }
    
    # For text files, return text content
    if file_metadata["file_type"].startswith("text/"):
        try:
            text_content = file_content.decode('utf-8')
            return {
                "type": "text",
                "content": text_content,
                "filename": file_metadata["original_name"]
            }
        except:
            pass
    
    # For other files, just return metadata
    return {
        "type": "file",
        "filename": file_metadata["original_name"],
        "size": file_metadata["file_size"],
        "file_type": file_metadata["file_type"]
    }


@api_router.post("/files/{file_id}/verify-password")
async def verify_file_password(file_id: str, password_data: FilePasswordVerify):
    file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_metadata:
        raise HTTPException(status_code=404, detail="File not found")
    
    if not file_metadata.get("has_password"):
        return {"verified": True}
    
    if not verify_password(password_data.password, file_metadata.get("password_hash", "")):
        raise HTTPException(status_code=403, detail="Invalid password")
    
    return {"verified": True}


@api_router.get("/files/{file_id}/download")
async def download_file(file_id: str, current_user: User = Depends(get_current_user)):
    file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_metadata:
        raise HTTPException(status_code=404, detail="File not found")
    
    has_access = False
    if current_user.role == "admin" or file_metadata["uploaded_by"] == current_user.username:
        has_access = True
    elif file_metadata.get("team_id"):
        team = await db.teams.find_one({"id": file_metadata["team_id"]})
        if team and current_user.username in team["members"]:
            has_access = True
    elif not file_metadata["is_private"]:
        has_access = True
    
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")
    
    file_content = await get_file_from_storage(file_metadata)
    
    return StreamingResponse(
        io.BytesIO(file_content),
        media_type=file_metadata["file_type"],
        headers={"Content-Disposition": f'attachment; filename="{file_metadata["original_name"]}"'}
    )


@api_router.delete("/files/{file_id}")
async def delete_file(file_id: str, current_user: User = Depends(get_admin_user)):
    file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_metadata:
        raise HTTPException(status_code=404, detail="File not found")
    
    await delete_file_from_storage(file_metadata)
    await db.files.delete_one({"id": file_id})
    
    return {"message": "File deleted successfully"}


# User stats
@api_router.get("/user/stats")
async def get_user_stats(current_user: User = Depends(get_current_user)):
    files = await db.files.find({"uploaded_by": current_user.username}, {"file_size": 1}).to_list(10000)
    total_storage = sum(f.get("file_size", 0) for f in files)
    
    teams = await db.teams.find({"members": current_user.username}).to_list(1000)
    total_teams = len(teams)
    
    return {
        "total_files": len(files),
        "total_storage_bytes": total_storage,
        "total_storage_mb": round(total_storage / (1024 * 1024), 2),
        "total_teams": total_teams
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
            raise HTTPException(status_code=403, detail="Chat is disabled")
    
    messages = await db.chat_messages.find({}, {"_id": 0}).sort("timestamp", -1).limit(100).to_list(100)
    
    for msg in messages:
        if isinstance(msg['timestamp'], str):
            msg['timestamp'] = datetime.fromisoformat(msg['timestamp'])
    
    return list(reversed(messages))


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
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user["role"] == "admin":
        raise HTTPException(status_code=403, detail="Cannot delete admin user")
    await db.users.delete_one({"id": user_id})
    return {"message": "User deleted successfully"}


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


@api_router.post("/admin/chat/toggle")
async def toggle_chat(data: ChatToggle, current_user: User = Depends(get_admin_user)):
    await db.settings.update_one(
        {"key": "chat_enabled"},
        {"$set": {"value": data.enabled}},
        upsert=True
    )
    return {"enabled": data.enabled}


@api_router.delete("/admin/chat/messages/{message_id}")
async def delete_chat_message(message_id: str, current_user: User = Depends(get_admin_user)):
    result = await db.chat_messages.delete_one({"id": message_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    
    for connection in active_connections:
        try:
            await connection.send_json({"type": "message_deleted", "message_id": message_id})
        except:
            pass
    
    return {"message": "Message deleted successfully"}


@api_router.delete("/admin/chat/clear")
async def clear_chat(current_user: User = Depends(get_admin_user)):
    await db.chat_messages.delete_many({})
    return {"status": "success", "message": "Chat limpo com sucesso"}


@api_router.get("/admin/download-all")
async def download_all_files(current_user: User = Depends(get_admin_user)):
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        files = await db.files.find({}, {"_id": 0}).to_list(10000)
        for file_metadata in files:
            try:
                file_content = await get_file_from_storage(file_metadata)
                arcname = f"{file_metadata['uploaded_by']}/{file_metadata['original_name']}"
                zip_file.writestr(arcname, file_content)
            except Exception as e:
                logger.error(f"Error adding file {file_metadata['filename']}: {e}")
    
    zip_buffer.seek(0)
    return StreamingResponse(
        iter([zip_buffer.getvalue()]),
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=all_files_backup.zip"}
    )


@api_router.get("/admin/download-source-code")
async def download_source_code(current_user: User = Depends(get_admin_user)):
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        backend_dir = Path("/app/backend")
        if backend_dir.exists():
            for file_path in backend_dir.rglob("*"):
                if file_path.is_file() and not file_path.name.startswith('.') and '__pycache__' not in str(file_path):
                    arcname = f"backend/{file_path.relative_to(backend_dir)}"
                    zip_file.write(file_path, arcname)
        
        frontend_dir = Path("/app/frontend")
        if frontend_dir.exists():
            for file_path in frontend_dir.rglob("*"):
                if file_path.is_file() and not file_path.name.startswith('.') and 'node_modules' not in str(file_path) and 'build' not in str(file_path):
                    arcname = f"frontend/{file_path.relative_to(frontend_dir)}"
                    zip_file.write(file_path, arcname)
        
        readme = """# Biblioteca Privada - Código Fonte

Sistema de compartilhamento privado de arquivos com chat em tempo real.

## Tecnologias
- Backend: FastAPI (Python)
- Frontend: React
- Database: MongoDB
- Storage: Supabase/Local
- WebSocket para chat em tempo real
- OAuth: Google & Discord

## Funcionalidades
- ✅ Autenticação (Login tradicional, Google OAuth, Discord OAuth)
- ✅ Upload/Download de arquivos
- ✅ Preview de arquivos (imagens, texto)
- ✅ Gestão de equipes
- ✅ Chat em tempo real com WebSocket
- ✅ Temas personalizáveis
- ✅ Painel administrativo completo
- ✅ Backup de arquivos
- ✅ Download do código-fonte

## Desenvolvido por Masterotaku
"""
        zip_file.writestr("README.md", readme)
    
    zip_buffer.seek(0)
    return StreamingResponse(
        iter([zip_buffer.getvalue()]),
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=source_code.zip"}
    )


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
