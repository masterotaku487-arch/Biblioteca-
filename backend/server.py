from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, WebSocket, WebSocketDisconnect, Form
from fastapi.responses import StreamingResponse, RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from authlib.integrations.starlette_client import OAuth
from starlette.requests import Request  # Se já não tiver
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
# --- ADIÇÃO PARA CORRIGIR O ERRO 404 DO RENDER ---
@app.get("/", include_in_schema=False)
def read_root():
    """
    Endpoint de checagem de saúde (Health Check).
    Corrige o INFO: "GET / HTTP/1.1" 404 Not Found do Render.
    """
    return {"status": "ok", "service": "biblioteca-backend", "message": "Service is running fine."}
# --------------------------------------------------

api_router = APIRouter(prefix="/api")
# ... resto do código ...
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
    email: Optional[str] = None  # ← NOVO
    google_id: Optional[str] = None  # ← NOVO
    avatar_url: Optional[str] = None  # ← NOVO
    role: str = "user"
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


# Supabase Storage Helper Functions
async def upload_to_supabase(file_content: bytes, file_path: str) -> str:
    """Upload file to Supabase Storage"""
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
    """Download file from Supabase Storage"""
    url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{file_path}"
    
    headers = {
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url, headers=headers)
        
        if response.status_code != 200:
            logger.error(f"Supabase download error: {response.text}")
            raise Exception(f"Download failed: {response.status_code}")
        
        return response.content


async def delete_from_supabase(file_path: str):
    """Delete file from Supabase Storage"""
    url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{file_path}"
    
    headers = {
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.delete(url, headers=headers)
        
        if response.status_code not in [200, 204]:
            logger.error(f"Supabase delete error: {response.text}")


# Storage Helper Functions
async def save_file_to_storage(file_content: bytes, filename: str, original_name: str, uploaded_by: str) -> dict:
    """Save file to configured storage"""
    
    if STORAGE_MODE == "supabase":
        try:
            file_path = f"{uploaded_by}/{filename}"
            await upload_to_supabase(file_content, file_path)
            logger.info(f"☁️ Arquivo salvo no Supabase: {file_path}")
            return {
                "storage_location": "supabase",
                "supabase_path": file_path,
                "filename": filename
            }
        except Exception as e:
            logger.error(f"❌ Erro no Supabase: {e}. Usando local.")
    
    # Local storage (fallback)
    file_path = UPLOAD_DIR / filename
    async with aiofiles.open(file_path, 'wb') as out_file:
        await out_file.write(file_content)
    
    logger.info(f"💾 Arquivo salvo localmente: {file_path}")
    return {
        "storage_location": "local",
        "supabase_path": None,
        "filename": filename
    }


async def get_file_from_storage(file_metadata: dict) -> bytes:
    """Retrieve file from storage"""
    
    if file_metadata.get("storage_location") == "supabase":
        try:
            return await download_from_supabase(file_metadata["supabase_path"])
        except Exception as e:
            logger.error(f"❌ Erro ao baixar do Supabase: {e}")
            raise HTTPException(status_code=404, detail="File not found")
    
    # Local storage
    file_path = UPLOAD_DIR / file_metadata["filename"]
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    async with aiofiles.open(file_path, 'rb') as f:
        return await f.read()


async def delete_file_from_storage(file_metadata: dict):
    """Delete file from storage"""
    
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


# Auth Helper Functions
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
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid credentials")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user = await db.users.find_one({"username": username}, {"_id": 0})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user)


async def get_admin_user(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
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
        logger.info("✅ Admin criado: Masterotaku / adm123")
    
    settings = await db.settings.find_one({"key": "chat_enabled"})
    if not settings:
        await db.settings.insert_one({"key": "chat_enabled", "value": False})
    
    logger.info(f"✅ Storage: {STORAGE_MODE}")


# Authentication routes
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
    if not user or not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    
    access_token = create_access_token(
        data={"sub": user_data.username},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    return Token(access_token=access_token, token_type="bearer", user=User(**user))

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


# Google OAuth routes  # ← NOVO BLOCO
@api_router.get("/auth/google/login")
async def google_login(request: Request):
    """Inicia o fluxo de login com Google"""
    redirect_uri = f"{BACKEND_URL}/api/auth/google/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri)


@api_router.get("/auth/google/callback")
async def google_callback(request: Request):
    """Callback do Google OAuth"""
    try:
        # Obter token do Google
        token = await oauth.google.authorize_access_token(request)
        user_info = token.get('userinfo')
        
        if not user_info:
            raise HTTPException(status_code=400, detail="Failed to get user info from Google")
        
        google_id = user_info.get('sub')
        email = user_info.get('email')
        name = user_info.get('name', email.split('@')[0] if email else 'user')
        avatar_url = user_info.get('picture')
        
        if not google_id or not email:
            raise HTTPException(status_code=400, detail="Invalid user info from Google")
        
        # Verificar se usuário já existe
        existing_user = await db.users.find_one({
            "$or": [
                {"google_id": google_id},
                {"email": email}
            ]
        }, {"_id": 0})
        
        if existing_user:
            if not existing_user.get("google_id"):
                await db.users.update_one(
                    {"email": email},
                    {"$set": {
                        "google_id": google_id,
                        "avatar_url": avatar_url
                    }}
                )
            user_data = existing_user
        else:
            # Criar novo usuário
            base_username = email.split('@')[0]
            username = base_username
            counter = 1
            
            while await db.users.find_one({"username": username}):
                username = f"{base_username}{counter}"
                counter += 1
            
            new_user = User(
                username=username,
                email=email,
                google_id=google_id,
                avatar_url=avatar_url,
                role="user"
            )
            
            user_doc = new_user.model_dump()
            user_doc["created_at"] = user_doc["created_at"].isoformat()
            user_doc["password_hash"] = None
            
            await db.users.insert_one(user_doc)
            user_data = user_doc
            
            logger.info(f"✅ Novo usuário via Google: {username} ({email})")
        
        # Criar token JWT
        access_token = create_access_token(
            data={"sub": user_data["username"]},
            expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        
        # Redirecionar para frontend
        redirect_url = f"{FRONTEND_URL}/auth/google/success?token={access_token}"
        return RedirectResponse(url=redirect_url)
        
    except Exception as e:
        logger.error(f"❌ Erro no callback do Google: {str(e)}")
        error_url = f"{FRONTEND_URL}/login?error=google_auth_failed"
        return RedirectResponse(url=error_url)


# File routes  # ← CÓDIGO QUE JÁ EXISTE
@api_router.post("/files/upload", response_model=FileMetadata)
async def upload_file(
    file: UploadFile = File(...),
    password: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
):
    file_id = str(uuid.uuid4())
    file_extension = Path(file.filename).suffix
    filename = f"{file_id}{file_extension}"
    
    content = await file.read()
    file_size = len(content)
    
    storage_info = await save_file_to_storage(content, filename, file.filename, current_user.username)
    
    file_metadata = FileMetadata(
        id=file_id,
        filename=filename,
        original_name=file.filename,
        file_type=file.content_type or "application/octet-stream",
        file_size=file_size,
        uploaded_by=current_user.username,
        is_private=True,
        has_password=password is not None,
        storage_location=storage_info["storage_location"],
        supabase_path=storage_info.get("supabase_path")
    )
    
    metadata_doc = file_metadata.model_dump()
    metadata_doc["uploaded_at"] = metadata_doc["uploaded_at"].isoformat()
    
    if password:
        metadata_doc["password_hash"] = get_password_hash(password)
    
    await db.files.insert_one(metadata_doc)
    
    logger.info(f"📤 Upload: {file.filename} por {current_user.username}")
    
    return file_metadata


@api_router.get("/files", response_model=List[FileMetadata])
async def get_files(current_user: User = Depends(get_current_user)):
    query = {} if current_user.role == "admin" else {"uploaded_by": current_user.username}
    files = await db.files.find(query, {"_id": 0, "password_hash": 0}).to_list(10000)
    
    for file in files:
        if isinstance(file['uploaded_at'], str):
            file['uploaded_at'] = datetime.fromisoformat(file['uploaded_at'])
    
    return files


@api_router.get("/files/{file_id}/download")
async def download_file(file_id: str, current_user: User = Depends(get_current_user)):
    file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_metadata:
        raise HTTPException(status_code=404, detail="File not found")
    
    if current_user.role != "admin" and file_metadata["uploaded_by"] != current_user.username:
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
    files = await db.files.find({}, {"file_size": 1}).to_list(10000)
    total_storage = sum(f.get("file_size", 0) for f in files)
    settings = await db.settings.find_one({"key": "chat_enabled"})
    
    return {
        "total_users": total_users,
        "total_files": total_files,
        "total_storage_bytes": total_storage,
        "total_storage_mb": round(total_storage / (1024 * 1024), 2),
        "chat_enabled": settings.get("value", False) if settings else False,
        "storage_mode": STORAGE_MODE
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


@api_router.post("/admin/chat/toggle")
async def toggle_chat(data: ChatToggle, current_user: User = Depends(get_admin_user)):
    await db.settings.update_one(
        {"key": "chat_enabled"},
        {"$set": {"value": data.enabled}},
        upsert=True
    )
    return {"enabled": data.enabled}


# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[
    "https://biblioteca-sigma-gilt.vercel.app",
    "http://localhost:3000",  # para testes locais
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
    
