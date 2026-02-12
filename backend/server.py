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

# MongoDB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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

# WebSocket connections for Chat
active_connections: Set[WebSocket] = set()

# ====================================================
# CANVAS WEBSOCKET - CLASSE ConnectionManager
# ====================================================
class CanvasConnectionManager:
    """Gerenciador de conexões WebSocket para canvas colaborativo"""
    
    def __init__(self):
        # {team_id: {username: websocket}}
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}
        # Store canvas state per team
        self.canvas_state: Dict[str, List] = {}

    async def connect(self, websocket: WebSocket, team_id: str, username: str):
        await websocket.accept()
        
        if team_id not in self.active_connections:
            self.active_connections[team_id] = {}
            self.canvas_state[team_id] = []
        
        self.active_connections[team_id][username] = websocket
        
        # Send current canvas state to new user
        if self.canvas_state[team_id]:
            await websocket.send_json({
                "type": "init",
                "elements": self.canvas_state[team_id]
            })
        
        # Notify others
        await self.broadcast(team_id, {
            "type": "user_joined",
            "user": username
        }, exclude=username)
        
        logger.info(f"Canvas: {username} joined team {team_id}")

    def disconnect(self, team_id: str, username: str):
        if team_id in self.active_connections:
            if username in self.active_connections[team_id]:
                del self.active_connections[team_id][username]
                logger.info(f"Canvas: {username} left team {team_id}")
            
            if not self.active_connections[team_id]:
                del self.active_connections[team_id]

    async def broadcast(self, team_id: str, message: dict, exclude: str = None):
        """Send message to all users in a team except the excluded one"""
        if team_id not in self.active_connections:
            return
        
        disconnected = []
        for username, websocket in self.active_connections[team_id].items():
            if exclude and username == exclude:
                continue
            
            try:
                await websocket.send_json(message)
            except Exception:
                disconnected.append(username)
        
        # Clean up disconnected users
        for username in disconnected:
            self.disconnect(team_id, username)

    def add_element(self, team_id: str, element: dict):
        """Add element to canvas state"""
        if team_id not in self.canvas_state:
            self.canvas_state[team_id] = []
        self.canvas_state[team_id].append(element)

    def update_canvas_state(self, team_id: str, elements: List):
        """Update entire canvas state (for undo/redo)"""
        self.canvas_state[team_id] = elements

    def clear_canvas(self, team_id: str):
        """Clear canvas state"""
        self.canvas_state[team_id] = []


# Instanciar o gerenciador de canvas
canvas_manager = CanvasConnectionManager()
# ====================================================

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
    async with aiofiles.open(file_path, 'rb') as in_file:
        return await in_file.read()

async def delete_file_from_storage(file_metadata: dict):
    if file_metadata.get("storage_location") == "supabase":
        try:
            await delete_from_supabase(file_metadata["supabase_path"])
        except:
            pass
    
    file_path = UPLOAD_DIR / file_metadata["filename"]
    if file_path.exists():
        file_path.unlink()

# Auth
def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401)
    except JWTError:
        raise HTTPException(status_code=401)
    
    user_doc = await db.users.find_one({"username": username}, {"_id": 0, "password_hash": 0})
    if user_doc is None:
        raise HTTPException(status_code=401)
    
    if isinstance(user_doc['created_at'], str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    return User(**user_doc)

async def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403)
    return current_user

# Auth routes
@api_router.post("/register", response_model=Token)
async def register(user: UserCreate):
    existing = await db.users.find_one({"username": user.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username taken")
    
    is_first_user = await db.users.count_documents({}) == 0
    user_doc = User(
        username=user.username,
        role="admin" if is_first_user else "user"
    ).model_dump()
    user_doc["password_hash"] = get_password_hash(user.password)
    user_doc["created_at"] = user_doc["created_at"].isoformat()
    await db.users.insert_one(user_doc)
    
    user_doc.pop("password_hash")
    user_doc["created_at"] = datetime.fromisoformat(user_doc["created_at"])
    token = create_access_token({"sub": user.username})
    return Token(access_token=token, token_type="bearer", user=User(**user_doc))

@api_router.post("/login", response_model=Token)
async def login(user: UserLogin):
    user_doc = await db.users.find_one({"username": user.username}, {"_id": 0})
    if not user_doc or not verify_password(user.password, user_doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user_doc.pop("password_hash")
    if isinstance(user_doc['created_at'], str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    token = create_access_token({"sub": user.username})
    return Token(access_token=token, token_type="bearer", user=User(**user_doc))

@api_router.get("/auth/google")
async def google_login(request: Request):
    redirect_uri = f"{BACKEND_URL}/api/auth/google/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri)

@api_router.get("/auth/google/callback")
async def google_callback(request: Request):
    try:
        token = await oauth.google.authorize_access_token(request)
        user_info = token.get("userinfo")
        
        user_doc = await db.users.find_one({"google_id": user_info["sub"]}, {"_id": 0})
        
        if not user_doc:
            username = user_info["email"].split("@")[0]
            base_username = username
            counter = 1
            while await db.users.find_one({"username": username}):
                username = f"{base_username}{counter}"
                counter += 1
            
            is_first_user = await db.users.count_documents({}) == 0
            user_doc = User(
                username=username,
                email=user_info.get("email"),
                google_id=user_info["sub"],
                avatar_url=user_info.get("picture"),
                role="admin" if is_first_user else "user"
            ).model_dump()
            user_doc["created_at"] = user_doc["created_at"].isoformat()
            await db.users.insert_one(user_doc)
        
        if isinstance(user_doc['created_at'], str):
            user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
        
        access_token = create_access_token({"sub": user_doc["username"]})
        
        return RedirectResponse(url=f"{FRONTEND_URL}/?token={access_token}")
    
    except Exception as e:
        logger.error(f"Google auth error: {e}")
        return RedirectResponse(url=f"{FRONTEND_URL}/?error=auth_failed")

@api_router.post("/auth/discord", response_model=Token)
async def discord_auth(data: DiscordAuthRequest):
    user_doc = await db.users.find_one({"discord_id": data.discordId}, {"_id": 0})
    
    if not user_doc:
        username = data.username
        base_username = username
        counter = 1
        while await db.users.find_one({"username": username}):
            username = f"{base_username}{counter}"
            counter += 1
        
        is_first_user = await db.users.count_documents({}) == 0
        user_doc = User(
            username=username,
            email=data.email,
            discord_id=data.discordId,
            avatar_url=data.avatar,
            role="admin" if is_first_user else "user"
        ).model_dump()
        user_doc["created_at"] = user_doc["created_at"].isoformat()
        await db.users.insert_one(user_doc)
    
    if isinstance(user_doc['created_at'], str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    token = create_access_token({"sub": user_doc["username"]})
    return Token(access_token=token, token_type="bearer", user=User(**user_doc))

@api_router.get("/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.put("/me/theme")
async def update_theme(theme: ThemeUpdate, current_user: User = Depends(get_current_user)):
    await db.users.update_one({"username": current_user.username}, {"$set": {"theme": theme.theme}})
    return {"theme": theme.theme}

# Team routes
@api_router.post("/teams", response_model=Team)
async def create_team(team: TeamCreate, current_user: User = Depends(get_current_user)):
    team_doc = Team(
        name=team.name,
        description=team.description,
        created_by=current_user.username,
        members=[current_user.username]
    ).model_dump()
    team_doc["created_at"] = team_doc["created_at"].isoformat()
    await db.teams.insert_one(team_doc)
    team_doc["created_at"] = datetime.fromisoformat(team_doc["created_at"])
    return Team(**team_doc)

@api_router.get("/teams", response_model=List[Team])
async def get_teams(current_user: User = Depends(get_current_user)):
    teams = await db.teams.find({"members": current_user.username}, {"_id": 0}).to_list(1000)
    for team in teams:
        if isinstance(team['created_at'], str):
            team['created_at'] = datetime.fromisoformat(team['created_at'])
    return teams

@api_router.post("/teams/{team_id}/members")
async def add_team_member(team_id: str, member: TeamAddMember, current_user: User = Depends(get_current_user)):
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team or team["created_by"] != current_user.username:
        raise HTTPException(status_code=403)
    
    user = await db.users.find_one({"username": member.username}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if member.username in team["members"]:
        raise HTTPException(status_code=400, detail="User already in team")
    
    await db.teams.update_one({"id": team_id}, {"$push": {"members": member.username}})
    return {"message": "Member added"}

@api_router.delete("/teams/{team_id}/members/{username}")
async def remove_team_member(team_id: str, username: str, current_user: User = Depends(get_current_user)):
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404)
    
    if team["created_by"] != current_user.username and username != current_user.username:
        raise HTTPException(status_code=403)
    
    await db.teams.update_one({"id": team_id}, {"$pull": {"members": username}})
    return {"message": "Member removed"}

@api_router.delete("/teams/{team_id}")
async def delete_team(team_id: str, current_user: User = Depends(get_current_user)):
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team or team["created_by"] != current_user.username:
        raise HTTPException(status_code=403)
    
    files = await db.files.find({"team_id": team_id}).to_list(10000)
    for file_metadata in files:
        await delete_file_from_storage(file_metadata)
    
    await db.files.delete_many({"team_id": team_id})
    await db.teams.delete_one({"id": team_id})
    return {"message": "Team deleted"}

# File routes
@api_router.post("/files/upload")
async def upload_file(
    file: UploadFile = File(...),
    team_id: Optional[str] = Form(None),
    is_private: bool = Form(True),
    password: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
):
    if team_id:
        team = await db.teams.find_one({"id": team_id}, {"_id": 0})
        if not team or current_user.username not in team["members"]:
            raise HTTPException(status_code=403)
    
    content = await file.read()
    filename = f"{uuid.uuid4()}_{file.filename}"
    storage_info = await save_file_to_storage(content, filename, file.filename, current_user.username)
    
    file_doc = FileMetadata(
        filename=storage_info["filename"],
        original_name=file.filename,
        file_type=file.content_type or "application/octet-stream",
        file_size=len(content),
        uploaded_by=current_user.username,
        team_id=team_id,
        is_private=is_private,
        has_password=bool(password),
        storage_location=storage_info["storage_location"],
        supabase_path=storage_info.get("supabase_path")
    ).model_dump()
    
    if password:
        file_doc["password_hash"] = get_password_hash(password)
    
    file_doc["uploaded_at"] = file_doc["uploaded_at"].isoformat()
    await db.files.insert_one(file_doc)
    
    file_doc.pop("password_hash", None)
    return {"id": file_doc["id"], "filename": file.filename}

@api_router.get("/files")
async def get_files(current_user: User = Depends(get_current_user)):
    query = {
        "$or": [
            {"uploaded_by": current_user.username},
            {"shared_with": current_user.username}
        ]
    }
    
    if current_user.role == "admin":
        query = {}
    
    files = await db.files.find(query, {"_id": 0, "password_hash": 0}).to_list(10000)
    for f in files:
        if isinstance(f['uploaded_at'], str):
            f['uploaded_at'] = datetime.fromisoformat(f['uploaded_at'])
    
    return files

@api_router.get("/files/team/{team_id}")
async def get_team_files(team_id: str, current_user: User = Depends(get_current_user)):
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team or current_user.username not in team["members"]:
        raise HTTPException(status_code=403)
    
    files = await db.files.find({"team_id": team_id}, {"_id": 0, "password_hash": 0}).to_list(10000)
    for f in files:
        if isinstance(f['uploaded_at'], str):
            f['uploaded_at'] = datetime.fromisoformat(f['uploaded_at'])
    
    return files

@api_router.post("/files/{file_id}/share")
async def share_file(file_id: str, share: FileShare, current_user: User = Depends(get_current_user)):
    file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_metadata or file_metadata["uploaded_by"] != current_user.username:
        raise HTTPException(status_code=403)
    
    user = await db.users.find_one({"username": share.username}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.files.update_one({"id": file_id}, {"$addToSet": {"shared_with": share.username}})
    return {"message": "File shared"}

@api_router.post("/files/{file_id}/verify-password")
async def verify_file_password(file_id: str, data: FilePasswordVerify):
    file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_metadata:
        raise HTTPException(status_code=404)
    
    if not file_metadata.get("has_password"):
        return {"valid": True}
    
    return {"valid": verify_password(data.password, file_metadata["password_hash"])}

@api_router.get("/files/{file_id}/download")
async def download_file(file_id: str, current_user: User = Depends(get_current_user)):
    file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_metadata:
        raise HTTPException(status_code=404)
    
    has_access = False
    if current_user.role == "admin" or file_metadata["uploaded_by"] == current_user.username:
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


# ====================================================
# WEBSOCKET CANVAS COLABORATIVO
# ====================================================
@app.websocket("/api/ws/canvas/{team_id}")
async def websocket_canvas(websocket: WebSocket, team_id: str):
    """WebSocket endpoint para canvas colaborativo"""
    username = None
    
    try:
        await websocket.accept()
        
        # Wait for join message
        data = await websocket.receive_json()
        
        if data.get("type") == "join":
            username = data.get("user")
            await canvas_manager.connect(websocket, team_id, username)
            
            # Main loop
            while True:
                data = await websocket.receive_json()
                message_type = data.get("type")
                
                if message_type == "draw":
                    # Add element to state
                    element = data.get("element")
                    canvas_manager.add_element(team_id, element)
                    
                    # Broadcast to others
                    await canvas_manager.broadcast(team_id, {
                        "type": "draw",
                        "element": element
                    }, exclude=username)
                
                elif message_type == "cursor":
                    # Just broadcast cursor position
                    await canvas_manager.broadcast(team_id, {
                        "type": "cursor",
                        "user": username,
                        "x": data.get("x"),
                        "y": data.get("y"),
                        "color": data.get("color")
                    }, exclude=username)
                
                elif message_type == "undo":
                    # Update canvas state
                    elements = data.get("elements", [])
                    canvas_manager.update_canvas_state(team_id, elements)
                    
                    # Broadcast to others
                    await canvas_manager.broadcast(team_id, {
                        "type": "undo",
                        "elements": elements
                    }, exclude=username)
                
                elif message_type == "clear":
                    # Clear canvas state
                    canvas_manager.clear_canvas(team_id)
                    
                    # Broadcast to others
                    await canvas_manager.broadcast(team_id, {
                        "type": "clear"
                    }, exclude=username)
    
    except WebSocketDisconnect:
        if username:
            canvas_manager.disconnect(team_id, username)
            await canvas_manager.broadcast(team_id, {
                "type": "user_left",
                "user": username
            })
    
    except Exception as e:
        logger.error(f"Canvas WebSocket error: {e}")
        if username:
            canvas_manager.disconnect(team_id, username)


# Canvas helper routes (opcional)
@api_router.get("/canvas/{team_id}/state")
async def get_canvas_state(team_id: str, current_user: User = Depends(get_current_user)):
    """Get current canvas state for a team"""
    # Verify user is member of team
    team = await db.teams.find_one({"id": team_id})
    if not team or current_user.username not in team["members"]:
        raise HTTPException(status_code=403)
    
    return {
        "team_id": team_id,
        "elements": canvas_manager.canvas_state.get(team_id, []),
        "online_users": list(canvas_manager.active_connections.get(team_id, {}).keys()),
        "element_count": len(canvas_manager.canvas_state.get(team_id, []))
    }
# ====================================================


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
