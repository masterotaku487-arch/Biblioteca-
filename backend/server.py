from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, WebSocket, WebSocketDisconnect, Form
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import aiofiles
import shutil
from typing import Set
import json
import zipfile
import io
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
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key-change-this-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# File storage
UPLOAD_DIR = Path("/app/uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# WebSocket connections
active_connections: Set[WebSocket] = set()

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")


# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    role: str = "user"
    theme: str = "auto"  # auto, natal, carnaval, ano-novo, pascoa
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserCreate(BaseModel):
    username: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


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
        logger.info("Admin user created")
    
    settings = await db.settings.find_one({"key": "chat_enabled"})
    if not settings:
        await db.settings.insert_one({"key": "chat_enabled", "value": False})
        logger.info("Chat settings initialized")


# Auth routes
@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    existing_user = await db.users.find_one({"username": user_data.username})
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered")
    
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
    if not user or not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": user_data.username}, expires_delta=access_token_expires)
    user_obj = User(**user)
    return Token(access_token=access_token, token_type="bearer", user=user_obj)


@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@api_router.put("/user/theme")
async def update_theme(data: ThemeUpdate, current_user: User = Depends(get_current_user)):
    await db.users.update_one({"username": current_user.username}, {"$set": {"theme": data.theme}})
    return {"theme": data.theme}


# Teams routes
@api_router.post("/teams", response_model=Team)
async def create_team(team_data: TeamCreate, current_user: User = Depends(get_current_user)):
    team = Team(name=team_data.name, description=team_data.description, created_by=current_user.username, members=[current_user.username])
    team_doc = team.model_dump()
    team_doc["created_at"] = team_doc["created_at"].isoformat()
    await db.teams.insert_one(team_doc)
    return team


@api_router.get("/teams", response_model=List[Team])
async def get_teams(current_user: User = Depends(get_current_user)):
    teams = await db.teams.find({"members": current_user.username}, {"_id": 0}).to_list(1000)
    for team in teams:
        if isinstance(team['created_at'], str):
            team['created_at'] = datetime.fromisoformat(team['created_at'])
    return teams


@api_router.post("/teams/{team_id}/members")
async def add_team_member(team_id: str, data: TeamAddMember, current_user: User = Depends(get_current_user)):
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    
    if current_user.username not in team["members"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a team member")
    
    user_to_add = await db.users.find_one({"username": data.username})
    if not user_to_add:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    if data.username in team["members"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already in team")
    
    await db.teams.update_one({"id": team_id}, {"$push": {"members": data.username}})
    return {"message": f"{data.username} added to team"}


@api_router.delete("/teams/{team_id}/members/{username}")
async def remove_team_member(team_id: str, username: str, current_user: User = Depends(get_current_user)):
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    
    if current_user.username != team["created_by"] and current_user.username != username:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only team creator or self can remove members")
    
    await db.teams.update_one({"id": team_id}, {"$pull": {"members": username}})
    return {"message": "Member removed"}


@api_router.delete("/teams/{team_id}")
async def delete_team(team_id: str, current_user: User = Depends(get_current_user)):
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    
    if current_user.username != team["created_by"] and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only team creator or admin can delete team")
    
    await db.teams.delete_one({"id": team_id})
    await db.files.delete_many({"team_id": team_id})
    return {"message": "Team deleted"}


# File routes
@api_router.post("/files/upload", response_model=FileMetadata)
async def upload_file(file: UploadFile = File(...), password: Optional[str] = Form(None), team_id: Optional[str] = Form(None), current_user: User = Depends(get_current_user)):
    # Verify team membership
    if team_id:
        team = await db.teams.find_one({"id": team_id})
        if not team or current_user.username not in team["members"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a team member")
    
    file_id = str(uuid.uuid4())
    file_extension = Path(file.filename).suffix
    filename = f"{file_id}{file_extension}"
    file_path = UPLOAD_DIR / filename
    
    async with aiofiles.open(file_path, 'wb') as out_file:
        content = await file.read()
        await out_file.write(content)
    
    file_size = os.path.getsize(file_path)
    file_metadata = FileMetadata(
        id=file_id, filename=filename, original_name=file.filename,
        file_type=file.content_type or "application/octet-stream",
        file_size=file_size, uploaded_by=current_user.username,
        team_id=team_id, is_private=(team_id is None),
        has_password=password is not None
    )
    
    metadata_doc = file_metadata.model_dump()
    metadata_doc["uploaded_at"] = metadata_doc["uploaded_at"].isoformat()
    if password:
        metadata_doc["password_hash"] = get_password_hash(password)
    
    await db.files.insert_one(metadata_doc)
    return file_metadata


@api_router.get("/files", response_model=List[FileMetadata])
async def get_files(current_user: User = Depends(get_current_user)):
    if current_user.role == "admin":
        query = {}
    else:
        user_teams = await db.teams.find({"members": current_user.username}, {"id": 1}).to_list(1000)
        team_ids = [team["id"] for team in user_teams]
        query = {"$or": [{"uploaded_by": current_user.username}, {"team_id": {"$in": team_ids}}]}
    
    files = await db.files.find(query, {"_id": 0, "password_hash": 0}).to_list(10000)
    for file in files:
        if isinstance(file['uploaded_at'], str):
            file['uploaded_at'] = datetime.fromisoformat(file['uploaded_at'])
    return files


@api_router.get("/files/{file_id}/preview")
async def preview_file(file_id: str, current_user: User = Depends(get_current_user)):
    file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_metadata:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    
    # Check permissions
    has_access = False
    if current_user.role == "admin" or file_metadata["uploaded_by"] == current_user.username:
        has_access = True
    elif file_metadata.get("team_id"):
        team = await db.teams.find_one({"id": file_metadata["team_id"]})
        if team and current_user.username in team["members"]:
            has_access = True
    
    if not has_access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    
    file_path = UPLOAD_DIR / file_metadata["filename"]
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    
    file_type = file_metadata["file_type"]
    
    # Images, text, small files - return base64
    if file_type.startswith(('image/', 'text/')) or file_metadata["file_size"] < 5 * 1024 * 1024:
        async with aiofiles.open(file_path, 'rb') as f:
            content = await f.read()
            if file_type.startswith('text/'):
                return {"type": "text", "content": content.decode('utf-8', errors='ignore')}
            else:
                return {"type": "base64", "content": base64.b64encode(content).decode(), "mime_type": file_type}
    
    # For videos, PDFs - return stream URL
    return {"type": "stream", "file_id": file_id}


@api_router.get("/files/{file_id}/stream")
async def stream_file(file_id: str, current_user: User = Depends(get_current_user)):
    file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_metadata:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    
    file_path = UPLOAD_DIR / file_metadata["filename"]
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    
    return FileResponse(path=file_path, media_type=file_metadata["file_type"])


@api_router.post("/files/{file_id}/verify-password")
async def verify_file_password(file_id: str, data: FilePasswordVerify, current_user: User = Depends(get_current_user)):
    file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_metadata:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    
    if current_user.role == "admin":
        return {"valid": True}
    
    if not file_metadata.get("password_hash"):
        return {"valid": True}
    
    valid = verify_password(data.password, file_metadata["password_hash"])
    return {"valid": valid}


@api_router.get("/files/{file_id}/download")
async def download_file(file_id: str, current_user: User = Depends(get_current_user)):
    file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_metadata:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    
    # Check permissions
    has_access = False
    if current_user.role == "admin" or file_metadata["uploaded_by"] == current_user.username:
        has_access = True
    elif file_metadata.get("team_id"):
        team = await db.teams.find_one({"id": file_metadata["team_id"]})
        if team and current_user.username in team["members"]:
            has_access = True
    
    if not has_access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    
    file_path = UPLOAD_DIR / file_metadata["filename"]
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    
    return FileResponse(path=file_path, filename=file_metadata["original_name"], media_type=file_metadata["file_type"])


@api_router.delete("/files/{file_id}")
async def delete_file(file_id: str, current_user: User = Depends(get_admin_user)):
    file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_metadata:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    
    file_path = UPLOAD_DIR / file_metadata["filename"]
    if file_path.exists():
        file_path.unlink()
    
    await db.files.delete_one({"id": file_id})
    return {"message": "File deleted successfully"}


# User stats
@api_router.get("/user/stats")
async def get_user_stats(current_user: User = Depends(get_current_user)):
    files = await db.files.find({"uploaded_by": current_user.username}, {"file_size": 1}).to_list(10000)
    total_files = len(files)
    total_storage = sum(f.get("file_size", 0) for f in files)
    
    teams = await db.teams.find({"members": current_user.username}).to_list(1000)
    total_teams = len(teams)
    
    return {
        "total_files": total_files,
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
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chat is disabled")
    
    messages = await db.chat_messages.find({}, {"_id": 0}).sort("timestamp", -1).limit(100).to_list(100)
    for msg in messages:
        if isinstance(msg['timestamp'], str):
            msg['timestamp'] = datetime.fromisoformat(msg['timestamp'])
    return list(reversed(messages))


@api_router.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    await websocket.accept()
    active_connections.add(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            chat_message = ChatMessage(username=message_data["username"], message=message_data["message"], role=message_data.get("role", "user"))
            msg_doc = chat_message.model_dump()
            msg_doc["timestamp"] = msg_doc["timestamp"].isoformat()
            await db.chat_messages.insert_one(msg_doc)
            msg_to_send = chat_message.model_dump()
            msg_to_send["timestamp"] = msg_to_send["timestamp"].isoformat()
            for connection in active_connections:
                try:
                    await connection.send_json(msg_to_send)
                except:
                    pass
    except WebSocketDisconnect:
        active_connections.remove(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        if websocket in active_connections:
            active_connections.remove(websocket)


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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user["role"] == "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete admin user")
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
    chat_enabled = settings.get("value", False) if settings else False
    return {
        "total_users": total_users,
        "total_files": total_files,
        "total_teams": total_teams,
        "total_storage_bytes": total_storage,
        "total_storage_mb": round(total_storage / (1024 * 1024), 2),
        "chat_enabled": chat_enabled
    }


@api_router.post("/admin/chat/toggle")
async def toggle_chat(data: ChatToggle, current_user: User = Depends(get_admin_user)):
    await db.settings.update_one({"key": "chat_enabled"}, {"$set": {"value": data.enabled}}, upsert=True)
    return {"enabled": data.enabled}


@api_router.delete("/admin/chat/messages/{message_id}")
async def delete_chat_message(message_id: str, current_user: User = Depends(get_admin_user)):
    result = await db.chat_messages.delete_one({"id": message_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    for connection in active_connections:
        try:
            await connection.send_json({"type": "message_deleted", "message_id": message_id})
        except:
            pass
    return {"message": "Message deleted successfully"}


@api_router.get("/admin/download-all")
async def download_all_files(current_user: User = Depends(get_admin_user)):
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        files = await db.files.find({}, {"_id": 0}).to_list(10000)
        for file_metadata in files:
            file_path = UPLOAD_DIR / file_metadata["filename"]
            if file_path.exists():
                arcname = f"{file_metadata['uploaded_by']}/{file_metadata['original_name']}"
                zip_file.write(file_path, arcname)
    zip_buffer.seek(0)
    return StreamingResponse(iter([zip_buffer.getvalue()]), media_type="application/zip", headers={"Content-Disposition": "attachment; filename=all_files_backup.zip"})


@api_router.get("/admin/download-source-code")
async def download_source_code(current_user: User = Depends(get_admin_user)):
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        backend_dir = Path("/app/backend")
        for file_path in backend_dir.rglob("*"):
            if file_path.is_file() and not file_path.name.startswith('.') and '__pycache__' not in str(file_path):
                arcname = f"backend/{file_path.relative_to(backend_dir)}"
                zip_file.write(file_path, arcname)
        frontend_dir = Path("/app/frontend")
        for file_path in frontend_dir.rglob("*"):
            if file_path.is_file() and not file_path.name.startswith('.') and 'node_modules' not in str(file_path) and 'build' not in str(file_path):
                arcname = f"frontend/{file_path.relative_to(frontend_dir)}"
                zip_file.write(file_path, arcname)
        readme = """# Biblioteca Privada - Código Fonte\n\nSistema de compartilhamento privado de arquivos com chat em tempo real.\n\n## Tecnologias\n- Backend: FastAPI (Python)\n- Frontend: React\n- Database: MongoDB\n- WebSocket para chat em tempo real\n\n## Desenvolvido por Masterotaku\n"""
        zip_file.writestr("README.md", readme)
    zip_buffer.seek(0)
    return StreamingResponse(iter([zip_buffer.getvalue()]), media_type="application/zip", headers={"Content-Disposition": "attachment; filename=source_code.zip"})


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
