from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import StreamingResponse, RedirectResponse, JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware # A importação original é starlette, vamos manter
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict
from models import User, Notification
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import aiofiles
import json
import io
import httpx
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL')
if not mongo_url:
    raise ValueError("MONGO_URL environment variable not set")
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'biblioteca')]

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

# Email configuration
SMTP_EMAIL = os.environ.get("SMTP_EMAIL")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")
ADMIN_EMAIL = "masterotaku487@gmail.com"

# Google OAuth
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN = os.environ.get("MERCADOPAGO_ACCESS_TOKEN")
MERCADOPAGO_PUBLIC_KEY = os.environ.get("MERCADOPAGO_PUBLIC_KEY")

if STORAGE_MODE == "supabase":
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("⚠️ Supabase não configurado! Usando storage local.")
        STORAGE_MODE = "local"
    else:
        print(f"✅ Supabase Storage ativado: {SUPABASE_URL}")
        print(f"✅ Bucket: {SUPABASE_BUCKET}")
else:
    print(f"✅ Storage local: {UPLOAD_DIR}")

# Create app
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[
        "https://biblioteca-sigma-gilt.vercel.app",
        "https://biblioteca-privada-lfp5.onrender.com",
        "http://localhost:3000",
        "http://localhost:8000",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)#
    
# ============================================================================
# CORREÇÃO CRÍTICA DO CORS APLICADA AQUI, ANTES DE TUDO
# ============================================================================
# Adicionamos a URL do Backend (Render) à lista de origens permitidas
# e movemos a inclusão do middleware para cima.
# Esta é a correção para o erro "blocked by CORS policy".

origins: List[str] = [
    # 1. Frontend Vercel (Já existia)
    "https://biblioteca-sigma-gilt.vercel.app",
    # 2. Backend Render (NOVO - O Render precisa se autorizar)
    "https://biblioteca-privada-lfp5.onrender.com",
    # 3. Localhost (Já existia)
    "http://localhost:3000",
    "http://localhost:8000", # Adicionado 8000 por segurança
]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
# FIM DA CORREÇÃO CORS

@app.get("/", include_in_schema=False)
def read_root():
    return {"status": "ok", "service": "biblioteca-backend", "message": "Service is running fine."}

api_router = APIRouter(prefix="/api")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================================
# MODELS (Mantenha o resto do seu código inalterado)
# ...
# ============================================================================
# O restante do seu código (Modelos, Funções Auxiliares, e todas as Rotas)
# permanece inalterado.
# ============================================================================
# ============================================================================

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: Optional[str] = None
    google_id: Optional[str] = None
    role: str = "user"
    plan: str = "free"
    storage_used: int = 0
    storage_limit: int = 104857600  # 100 MB para free
    file_count: int = 0
    premium_since: Optional[datetime] = None
    premium_expires: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[str] = None

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
    uploaded_by: str  # user_id (UUID)
    uploaded_by_username: str  # para exibição
    is_private: bool = True
    has_password: bool = False
    storage_location: str = "local"
    supabase_path: Optional[str] = None
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FileShare(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    file_id: str
    owner_id: str
    shared_with_id: str
    shared_with_username: str
    permissions: str = "view"
    requires_password: bool = False
    shared_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ShareRequest(BaseModel):
    username: str
    permissions: str = "download"

class Team(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    owner_id: str
    owner_username: str
    members: List[str] = []  # user_ids
    member_usernames: List[str] = []
    files: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TeamCreate(BaseModel):
    name: str
    description: Optional[str] = None

class TeamInvite(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    team_id: str
    team_name: str
    inviter_id: str
    inviter_username: str
    invitee_username: str
    invitee_id: Optional[str] = None
    status: str = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InviteRequest(BaseModel):
    username: str

class BugReport(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    username: str
    email: Optional[str] = None
    category: str
    title: str
    description: str
    steps_to_reproduce: Optional[str] = None
    expected_behavior: Optional[str] = None
    actual_behavior: Optional[str] = None
    browser_info: Optional[Dict] = None
    status: str = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    resolved_at: Optional[datetime] = None

class BugReportCreate(BaseModel):
    category: str
    title: str
    description: str
    steps_to_reproduce: Optional[str] = None
    expected_behavior: Optional[str] = None
    actual_behavior: Optional[str] = None
    browser_info: Optional[Dict] = None

class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    message: str
    role: str = "user"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChatToggle(BaseModel):
    enabled: bool

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

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
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid credentials")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user)

async def get_admin_user(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

async def require_premium(current_user: User = Depends(get_current_user)):
    if current_user.plan != "premium" and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Premium subscription required")
    return current_user

async def check_user_limits(user: User, file_size: int):
    if user.role == "admin":
        return True
    
    if user.plan == "free":
        if user.file_count >= 20:
            raise HTTPException(status_code=403, detail="Limite de 20 arquivos atingido. Faça upgrade para Premium!")
        if user.storage_used + file_size > user.storage_limit:
            raise HTTPException(status_code=403, detail="Limite de 100 MB atingido. Faça upgrade para Premium!")
    elif user.plan == "premium":
        if user.storage_used + file_size > 5368709120:  # 5 GB
            raise HTTPException(status_code=403, detail="Limite de 5 GB atingido.")
    
    return True

# Supabase Storage
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

async def save_file_to_storage(file_content: bytes, filename: str, original_name: str, user_id: str) -> dict:
    if STORAGE_MODE == "supabase":
        try:
            file_path = f"{user_id}/{filename}"
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

# Email
async def send_bug_report_email(bug_report: BugReport):
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        logger.warning("⚠️ SMTP não configurado")
        return
    
    try:
        msg = MIMEMultipart('alternative')
        msg['From'] = formataddr(('Biblioteca Privada', SMTP_EMAIL))
        msg['To'] = ADMIN_EMAIL
        msg['Subject'] = f"[BUG REPORT] {bug_report.title}"
        
        html = f"""
        <html>
          <body style="font-family: Arial, sans-serif;">
            <h2 style="color: #e63946;">🐛 Novo Bug Report</h2>
            <p><strong>ID:</strong> {bug_report.id}</p>
            <p><strong>Categoria:</strong> {bug_report.category}</p>
            <p><strong>Usuário:</strong> {bug_report.username}</p>
            <p><strong>Email:</strong> {bug_report.email or 'Não fornecido'}</p>
            <hr>
            <h3>Descrição:</h3>
            <p>{bug_report.description}</p>
            {f'<h3>Passos para Reproduzir:</h3><p>{bug_report.steps_to_reproduce}</p>' if bug_report.steps_to_reproduce else ''}
            {f'<h3>Comportamento Esperado:</h3><p>{bug_report.expected_behavior}</p>' if bug_report.expected_behavior else ''}
            {f'<h3>Comportamento Atual:</h3><p>{bug_report.actual_behavior}</p>' if bug_report.actual_behavior else ''}
            <p><strong>Data:</strong> {bug_report.created_at.strftime('%d/%m/%Y %H:%M')}</p>
          </body>
        </html>
        """
        
        part = MIMEText(html, 'html')
        msg.attach(part)
        
        async with aiosmtplib.SMTP(hostname="smtp.gmail.com", port=587, use_tls=False, start_tls=True) as smtp:
            await smtp.login(SMTP_EMAIL, SMTP_PASSWORD)
            await smtp.send_message(msg)
        
        logger.info(f"✅ Email de bug report enviado para {ADMIN_EMAIL}")
    except Exception as e:
        logger.error(f"❌ Erro ao enviar email: {e}")

# CONTINUA NA PARTE 2...
# CONTINUAÇÃO DO server.py (PARTE 2)
# Cole isso logo após a PARTE 1

# ============================================================================
# STARTUP
# ============================================================================

@app.on_event("startup")
async def startup_event():
    admin = await db.users.find_one({"username": "Masterotaku"})
    if not admin:
        admin_user = User(
            username="Masterotaku",
            role="admin",
            plan="premium",
            storage_limit=5368709120  # 5 GB
        )
        admin_doc = admin_user.model_dump()
        admin_doc["password_hash"] = get_password_hash("@adm3011")
        admin_doc["created_at"] = admin_doc["created_at"].isoformat()
        await db.users.insert_one(admin_doc)
        logger.info("✅ Admin criado: Masterotaku / @adm3011")
    
    settings = await db.settings.find_one({"key": "chat_enabled"})
    if not settings:
        await db.settings.insert_one({"key": "chat_enabled", "value": False})
    
    logger.info(f"✅ Storage: {STORAGE_MODE}")

# ============================================================================
# AUTHENTICATION ROUTES
# ============================================================================

@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    if await db.users.find_one({"username": user_data.username}):
        raise HTTPException(status_code=400, detail="Username already registered")
    
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        role="user",
        plan="free",
        storage_limit=104857600  # 100 MB
    )
    user_doc = new_user.model_dump()
    user_doc["password_hash"] = get_password_hash(user_data.password)
    user_doc["created_at"] = user_doc["created_at"].isoformat()
    await db.users.insert_one(user_doc)
    
    access_token = create_access_token(
        data={"sub": new_user.id},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    logger.info(f"✅ Usuário registrado: {new_user.username}")
    return Token(access_token=access_token, token_type="bearer", user=new_user)

@api_router.post("/auth/login", response_model=Token)
async def login(user_data: UserLogin):
    user = await db.users.find_one({"username": user_data.username}, {"_id": 0})
    if not user or not user.get("password_hash") or not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    
    access_token = create_access_token(
        data={"sub": user["id"]},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    logger.info(f"➡️ Login: {user['username']}")
    return Token(access_token=access_token, token_type="bearer", user=User(**user))

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.get("/auth/google/login")
async def google_login():
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google OAuth not configured")
    
    redirect_uri = f"{FRONTEND_URL}/auth/google/callback"
    google_auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={GOOGLE_CLIENT_ID}&"
        f"redirect_uri={redirect_uri}&"
        f"response_type=code&"
        f"scope=openid%20email%20profile"
    )
    return RedirectResponse(google_auth_url)

@api_router.get("/auth/google/callback")
async def google_callback(code: str):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=503, detail="Google OAuth not configured")
    
    try:
        token_url = "https://oauth2.googleapis.com/token"
        token_data = {
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": f"{FRONTEND_URL}/auth/google/callback",
            "grant_type": "authorization_code"
        }
        
        async with httpx.AsyncClient() as client:
            token_response = await client.post(token_url, data=token_data)
            token_response.raise_for_status()
            token_json = token_response.json()
            access_token = token_json.get("access_token")
            
            if not access_token:
                raise Exception("Failed to get Google Access Token")
            
            user_info_url = "https://www.googleapis.com/oauth2/v2/userinfo"
            headers = {"Authorization": f"Bearer {access_token}"}
            user_response = await client.get(user_info_url, headers=headers)
            user_response.raise_for_status()
            user_data = user_response.json()
        
        google_id = user_data.get("id")
        email = user_data.get("email")
        
        user = await db.users.find_one({"google_id": google_id})
        
        if not user:
            username = email.split("@")[0] if email else f"google_user_{google_id[:8]}"
            base_username = username
            counter = 1
            while await db.users.find_one({"username": username}):
                username = f"{base_username}{counter}"
                counter += 1
            
            new_user = User(
                username=username,
                email=email,
                google_id=google_id,
                role="user",
                plan="free",
                storage_limit=104857600
            )
            user_doc = new_user.model_dump()
            user_doc["created_at"] = user_doc["created_at"].isoformat()
            await db.users.insert_one(user_doc)
            user = user_doc
            logger.info(f"✅ Novo usuário Google: {username}")
        
        jwt_token = create_access_token(
            data={"sub": user["id"]},
            expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        
        logger.info(f"🔐 Google Login: {user.get('username', email)}")
        return RedirectResponse(f"{FRONTEND_URL}/?token={jwt_token}")
        
    except Exception as e:
        logger.error(f"❌ Google OAuth error: {e}")
        raise HTTPException(status_code=500, detail=f"Google login failed: {str(e)}")

@api_router.delete("/auth/delete-account")
async def delete_account(
    password: str = Form(...),
    confirmation: str = Form(...),
    current_user: User = Depends(get_current_user)
):
    user = await db.users.find_one({"id": current_user.id}, {"_id": 0})
    if not verify_password(password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Senha incorreta")
    
    if confirmation.upper() != "DELETAR":
        raise HTTPException(status_code=400, detail="Digite 'DELETAR' para confirmar")
    
    files = await db.files.find({"uploaded_by": current_user.id}).to_list(10000)
    for file in files:
        await delete_file_from_storage(file)
    await db.files.delete_many({"uploaded_by": current_user.id})
    
    await db.file_shares.delete_many({"$or": [{"owner_id": current_user.id}, {"shared_with_id": current_user.id}]})
    await db.teams.delete_many({"owner_id": current_user.id})
    await db.teams.update_many(
        {"members": current_user.id},
        {"$pull": {"members": current_user.id, "member_usernames": current_user.username}}
    )
    
    await db.users.delete_one({"id": current_user.id})
    
    logger.info(f"🗑️ Conta deletada: {current_user.username}")
    return {"message": "Conta deletada com sucesso"}

# ============================================================================
# FILE ROUTES
# ============================================================================

@api_router.post("/files/upload", response_model=FileMetadata)
async def upload_file(
    file: UploadFile = File(...),
    password: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
):
    content = await file.read()
    file_size = len(content)
    
    await check_user_limits(current_user, file_size)
    
    file_id = str(uuid.uuid4())
    file_extension = Path(file.filename).suffix
    filename = f"{file_id}{file_extension}"
    
    storage_info = await save_file_to_storage(content, filename, file.filename, current_user.id)
    
    file_metadata = FileMetadata(
        id=file_id,
        filename=filename,
        original_name=file.filename,
        file_type=file.content_type or "application/octet-stream",
        file_size=file_size,
        uploaded_by=current_user.id,
        uploaded_by_username=current_user.username,
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
    
    await db.users.update_one(
        {"id": current_user.id},
        {"$inc": {"storage_used": file_size, "file_count": 1}}
    )
    
    logger.info(f"📤 Upload: {file.filename} por {current_user.username}")
    return file_metadata

@api_router.get("/files", response_model=List[FileMetadata])
async def get_files(current_user: User = Depends(get_current_user)):
    query = {"uploaded_by": current_user.id}
    files = await db.files.find(query, {"_id": 0, "password_hash": 0}).to_list(10000)
    
    for file in files:
        if isinstance(file['uploaded_at'], str):
            file['uploaded_at'] = datetime.fromisoformat(file['uploaded_at'])
    
    return files

@api_router.get("/files/shared-with-me", response_model=List[FileMetadata])
async def get_shared_files(current_user: User = Depends(get_current_user)):
    shares = await db.file_shares.find({"shared_with_id": current_user.id}).to_list(1000)
    file_ids = [share["file_id"] for share in shares]
    
    files = await db.files.find({"id": {"$in": file_ids}}, {"_id": 0, "password_hash": 0}).to_list(1000)
    
    for file in files:
        if isinstance(file['uploaded_at'], str):
            file['uploaded_at'] = datetime.fromisoformat(file['uploaded_at'])
    
    return files

@api_router.post("/files/{file_id}/share")
async def share_file(file_id: str, share_data: ShareRequest, current_user: User = Depends(get_current_user)):
    file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_metadata:
        raise HTTPException(status_code=404, detail="File not found")
    
    if file_metadata["uploaded_by"] != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can share")
    
    target_user = await db.users.find_one({"username": share_data.username}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    existing = await db.file_shares.find_one({
        "file_id": file_id,
        "shared_with_id": target_user["id"]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already shared with this user")
    
    share = FileShare(
        file_id=file_id,
        owner_id=current_user.id,
        shared_with_id=target_user["id"],
        shared_with_username=target_user["username"],
        permissions=share_data.permissions,
        requires_password=file_metadata.get("has_password", False)
    )
    
    share_doc = share.model_dump()
    share_doc["shared_at"] = share_doc["shared_at"].isoformat()
    await db.file_shares.insert_one(share_doc)
    
    logger.info(f"📤 {current_user.username} compartilhou com {target_user['username']}")
    return share

@api_router.delete("/files/{file_id}/share/{user_id}")
async def revoke_share(file_id: str, user_id: str, current_user: User = Depends(get_current_user)):
    file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_metadata or file_metadata["uploaded_by"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    result = await db.file_shares.delete_one({"file_id": file_id, "shared_with_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Share not found")
    
    return {"message": "Share revoked"}

@api_router.get("/files/{file_id}/download")
async def download_file(file_id: str, current_user: User = Depends(get_current_user)):
    file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_metadata:
        raise HTTPException(status_code=404, detail="File not found")
    
    is_owner = file_metadata["uploaded_by"] == current_user.id
    is_shared = await db.file_shares.find_one({"file_id": file_id, "shared_with_id": current_user.id})
    
    if not is_owner and not is_shared:
        raise HTTPException(status_code=403, detail="Access denied")
    
    file_content = await get_file_from_storage(file_metadata)
    
    return StreamingResponse(
        io.BytesIO(file_content),
        media_type=file_metadata["file_type"],
        headers={"Content-Disposition": f'attachment; filename="{file_metadata["original_name"]}"'}
    )

@api_router.delete("/files/{file_id}")
async def delete_file(file_id: str, current_user: User = Depends(get_current_user)):
    file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_metadata or file_metadata["uploaded_by"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await delete_file_from_storage(file_metadata)
    await db.files.delete_one({"id": file_id})
    await db.file_shares.delete_many({"file_id": file_id})
    
    await db.users.update_one(
        {"id": current_user.id},
        {"$inc": {"storage_used": -file_metadata["file_size"], "file_count": -1}}
    )
    
    return {"message": "File deleted"}

@api_router.get("/user/stats")
async def get_user_stats(current_user: User = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user.id})
    return {
        "total_files": user.get("file_count", 0),
        "total_storage_bytes": user.get("storage_used", 0),
        "total_storage_mb": round(user.get("storage_used", 0) / (1024 * 1024), 2),
        "storage_limit_bytes": user.get("storage_limit", 104857600),
        "storage_limit_mb": round(user.get("storage_limit", 104857600) / (1024 * 1024), 2),
        "plan": user.get("plan", "free")
    }

# ============================================================================
# TEAMS (PREMIUM)
# ============================================================================

@api_router.post("/teams/create", response_model=Team)
async def create_team(team_data: TeamCreate, current_user: User = Depends(require_premium)):
    existing = await db.teams.find_one({"name": team_data.name})
    if existing:
        raise HTTPException(status_code=400, detail="Team name already exists")
    
    team = Team(
        name=team_data.name,
        description=team_data.description,
        owner_id=current_user.id,
        owner_username=current_user.username,
        members=[current_user.id],
        member_usernames=[current_user.username]
    )
    
    team_doc = team.model_dump()
    team_doc["created_at"] = team_doc["created_at"].isoformat()
    await db.teams.insert_one(team_doc)
    
    return team

@api_router.get("/teams/my-teams")
async def get_my_teams(current_user: User = Depends(get_current_user)):
    teams = await db.teams.find({"members": current_user.id}, {"_id": 0}).to_list(100)
    
    for team in teams:
        if isinstance(team['created_at'], str):
            team['created_at'] = datetime.fromisoformat(team['created_at'])
    
    return teams

@api_router.post("/teams/{team_id}/invite")
async def invite_to_team(team_id: str, invite_data: InviteRequest, current_user: User = Depends(require_premium)):
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team or team["owner_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not team owner")
    
    target_user = await db.users.find_one({"username": invite_data.username}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if target_user["id"] in team["members"]:
        raise HTTPException(status_code=400, detail="Already member")
    
    invite = TeamInvite(
        team_id=team_id,
        team_name=team["name"],
        inviter_id=current_user.id,
        inviter_username=current_user.username,
        invitee_username=invite_data.username,
        invitee_id=target_user["id"]
    )
    
    invite_doc = invite.model_dump()
    invite_doc["created_at"] = invite_doc["created_at"].isoformat()
    await db.team_invites.insert_one(invite_doc)
    
    return invite

@api_router.get("/teams/invites")
async def get_my_invites(current_user: User = Depends(get_current_user)):
    invites = await db.team_invites.find(
        {"invitee_id": current_user.id, "status": "pending"},
        {"_id": 0}
    ).to_list(100)
    
    for invite in invites:
        if isinstance(invite['created_at'], str):
            invite['created_at'] = datetime.fromisoformat(invite['created_at'])
    
    return invites

@api_router.post("/teams/invites/{invite_id}/accept")
async def accept_invite(invite_id: str, current_user: User = Depends(get_current_user)):
    invite = await db.team_invites.find_one({"id": invite_id}, {"_id": 0})
    if not invite or invite["invitee_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not your invite")
    
    await db.teams.update_one(
        {"id": invite["team_id"]},
        {
            "$push": {
                "members": current_user.id,
                "member_usernames": current_user.username
            }
        }
    )
    
    await db.team_invites.update_one(
        {"id": invite_id},
        {"$set": {"status": "accepted"}}
    )
    
    return {"message": "Invite accepted"}

@api_router.post("/teams/invites/{invite_id}/reject")
async def reject_invite(invite_id: str, current_user: User = Depends(get_current_user)):
    invite = await db.team_invites.find_one({"id": invite_id}, {"_id": 0})
    if not invite or invite["invitee_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not your invite")
    
    await db.team_invites.update_one(
        {"id": invite_id},
        {"$set": {"status": "rejected"}}
    )
    
    return {"message": "Invite rejected"}

@api_router.post("/teams/{team_id}/files/{file_id}/add")
async def add_file_to_team(team_id: str, file_id: str, current_user: User = Depends(get_current_user)):
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team or current_user.id not in team["members"]:
        raise HTTPException(status_code=403, detail="Not a member")
    
    file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_metadata or file_metadata["uploaded_by"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not your file")
    
    await db.teams.update_one(
        {"id": team_id},
        {"$addToSet": {"files": file_id}}
    )
    
    return {"message": "File added to team"}

@api_router.get("/teams/{team_id}/files")
async def get_team_files(team_id: str, current_user: User = Depends(get_current_user)):
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team or current_user.id not in team["members"]:
        raise HTTPException(status_code=403, detail="Not a member")
    
    files = await db.files.find(
        {"id": {"$in": team["files"]}},
        {"_id": 0, "password_hash": 0}
    ).to_list(1000)
    
    for file in files:
        if isinstance(file['uploaded_at'], str):
            file['uploaded_at'] = datetime.fromisoformat(file['uploaded_at'])
    
    return files

# ============================================================================
# CHAT ROUTES
# ============================================================================

@api_router.get("/chat/status")
async def get_chat_status():
    settings = await db.settings.find_one({"key": "chat_enabled"})
    return {"enabled": settings.get("value", False) if settings else False}

@api_router.post("/chat/toggle", dependencies=[Depends(get_admin_user)])
async def toggle_chat(toggle: ChatToggle):
    await db.settings.update_one(
        {"key": "chat_enabled"},
        {"$set": {"value": toggle.enabled}},
        upsert=True
    )
    logger.info(f"💬 Chat {'ativado' if toggle.enabled else 'desativado'}")
    return {"enabled": toggle.enabled}

@api_router.get("/chat/messages", response_model=List[ChatMessage])
async def get_chat_messages(current_user: User = Depends(get_current_user)):
    settings = await db.settings.find_one({"key": "chat_enabled"})
    if not settings or not settings.get("value"):
        raise HTTPException(status_code=403, detail="Chat desabilitado")
    
    messages = await db.chat_messages.find({}, {"_id": 0}).sort("timestamp", -1).limit(100).to_list(100)
    
    for msg in messages:
        if isinstance(msg['timestamp'], str):
            msg['timestamp'] = datetime.fromisoformat(msg['timestamp'])
    
    return list(reversed(messages))

@api_router.post("/chat/send", response_model=ChatMessage)
async def send_chat_message(message: str = Form(...), current_user: User = Depends(get_current_user)):
    settings = await db.settings.find_one({"key": "chat_enabled"})
    if not settings or not settings.get("value"):
        raise HTTPException(status_code=403, detail="Chat desabilitado")
    
    chat_message = ChatMessage(
        username=current_user.username,
        message=message.strip(),
        role=current_user.role
    )
    
    msg_doc = chat_message.model_dump()
    msg_doc["timestamp"] = msg_doc["timestamp"].isoformat()
    await db.chat_messages.insert_one(msg_doc)
    
    return chat_message

# ============================================================================
# BUG REPORTS
# ============================================================================

@api_router.post("/bugs/report", response_model=BugReport)
async def create_bug_report(
    bug_data: BugReportCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    bug = BugReport(
        user_id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        **bug_data.model_dump()
    )
    
    bug_doc = bug.model_dump()
    bug_doc["created_at"] = bug_doc["created_at"].isoformat()
    await db.bugs.insert_one(bug_doc)
    
    background_tasks.add_task(send_bug_report_email, bug)
    
    return bug

@api_router.get("/bugs/list", dependencies=[Depends(get_admin_user)])
async def list_bug_reports():
    bugs = await db.bugs.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    for bug in bugs:
        if isinstance(bug['created_at'], str):
            bug['created_at'] = datetime.fromisoformat(bug['created_at'])
    
    return bugs

# ============================================================================
# PAYMENT ROUTES
# ============================================================================

@api_router.post("/payments/create-preference")
async def create_payment_preference(current_user: User = Depends(get_current_user)):
    if not MERCADOPAGO_ACCESS_TOKEN:
        raise HTTPException(status_code=503, detail="Pagamentos não configurados")
    
    preference_data = {
        "items": [{
            "title": "Biblioteca Premium - 1 Mês",
            "quantity": 1,
            "unit_price": 4.80,  # ← R$ 4,80
            "currency_id": "BRL"
        }],
        "payer": {
            "email": current_user.email or f"{current_user.username}@biblioteca.app"
        },
        "back_urls": {
            "success": f"{FRONTEND_URL}/payment/success",
            "failure": f"{FRONTEND_URL}/payment/failure",
            "pending": f"{FRONTEND_URL}/payment/pending"
        },
        "auto_return": "approved",
        "external_reference": current_user.id,
        "notification_url": f"{BACKEND_URL}/api/payments/webhook"
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.mercadopago.com/checkout/preferences",
                json=preference_data,
                headers={
                    "Authorization": f"Bearer {MERCADOPAGO_ACCESS_TOKEN}",
                    "Content-Type": "application/json"
                }
            )
            response.raise_for_status()
            result = response.json()
        
        return {
            "preference_id": result["id"],
            "init_point": result["init_point"]
        }
    
    except Exception as e:
        logger.error(f"Erro Mercado Pago: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/payments/webhook")
async def payment_webhook(data: dict):
    logger.info(f"Webhook: {data}")
    
    if data.get("type") == "payment":
        payment_id = data.get("data", {}).get("id")
        if payment_id:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"https://api.mercadopago.com/v1/payments/{payment_id}",
                    headers={"Authorization": f"Bearer {MERCADOPAGO_ACCESS_TOKEN}"}
                )
                payment_data = response.json()
            
            if payment_data.get("status") == "approved":
                user_id = payment_data.get("external_reference")
                premium_expires = datetime.now(timezone.utc) + timedelta(days=30)
                
                await db.users.update_one(
                    {"id": user_id},
                    {
                        "$set": {
                            "plan": "premium",
                            "premium_since": datetime.now(timezone.utc).isoformat(),
                            "premium_expires": premium_expires.isoformat(),
                            "storage_limit": 5368709120
                        }
                    }
                )
                logger.info(f"✅ User {user_id} → Premium")
    
    return {"status": "received"}

# ============================================================================
# ADMIN ROUTES
# ============================================================================

@api_router.get("/admin/stats", dependencies=[Depends(get_admin_user)])
async def get_admin_stats():
    total_users = await db.users.count_documents({})
    premium_users = await db.users.count_documents({"plan": "premium"})
    total_files = await db.files.count_documents({})
    
    return {
        "total_users": total_users,
        "premium_users": premium_users,
        "total_files": total_files
    }

# ============================================================================
# INCLUDE ROUTER
# ============================================================================

app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)
    # ============================================================================
# FILE ROUTES
# ============================================================================

@api_router.post("/files/upload", response_model=FileMetadata)
async def upload_file(
    file: UploadFile = File(...),
    password: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
):
    """🆕 CORRIGIDO: Upload com validação de limites"""
    content = await file.read()
    file_size = len(content)
    
    # Validar limites do plano
    await check_user_limits(current_user, file_size)
    
    file_id = str(uuid.uuid4())
    file_extension = Path(file.filename).suffix
    filename = f"{file_id}{file_extension}"
    
    storage_info = await save_file_to_storage(content, filename, file.filename, current_user.id)
    
    file_metadata = FileMetadata(
        id=file_id,
        filename=filename,
        original_name=file.filename,
        file_type=file.content_type or "application/octet-stream",
        file_size=file_size,
        uploaded_by=current_user.id,  # 🆕 CORRIGIDO: Usa UUID ao invés de username
        uploaded_by_username=current_user.username,
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
    
    # Atualizar contadores do usuário
    await db.users.update_one(
        {"id": current_user.id},
        {"$inc": {"storage_used": file_size, "file_count": 1}}
    )
    
    logger.info(f"📤 Upload: {file.filename} ({file_size} bytes) por {current_user.username}")
    return file_metadata

@api_router.get("/files", response_model=List[FileMetadata])
async def get_files(current_user: User = Depends(get_current_user)):
    """🆕 CORRIGIDO: Listar apenas arquivos do usuário (não deletados)"""
    query = {
        "uploaded_by": current_user.id,  # 🆕 Usa UUID
        "is_deleted": False
    }
    files = await db.files.find(query, {"_id": 0, "password_hash": 0}).to_list(10000)
    
    for file in files:
        if isinstance(file['uploaded_at'], str):
            file['uploaded_at'] = datetime.fromisoformat(file['uploaded_at'])
    
    return files

@api_router.get("/files/shared-with-me", response_model=List[FileMetadata])
async def get_shared_files(current_user: User = Depends(get_current_user)):
    """Listar arquivos compartilhados comigo"""
    shares = await db.file_shares.find({"shared_with_id": current_user.id}).to_list(1000)
    file_ids = [share["file_id"] for share in shares]
    
    if not file_ids:
        return []
    
    files = await db.files.find(
        {
            "id": {"$in": file_ids},
            "is_deleted": False
        },
        {"_id": 0, "password_hash": 0}
    ).to_list(1000)
    
    for file in files:
        if isinstance(file['uploaded_at'], str):
            file['uploaded_at'] = datetime.fromisoformat(file['uploaded_at'])
    
    return files

@api_router.get("/files/{file_id}/metadata")
async def get_file_metadata(file_id: str, current_user: User = Depends(get_current_user)):
    """Obter metadados de um arquivo"""
    file = await db.files.find_one({"id": file_id, "is_deleted": False}, {"_id": 0, "password_hash": 0})
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Verificar acesso
    is_owner = file["uploaded_by"] == current_user.id
    is_shared = await db.file_shares.find_one({"file_id": file_id, "shared_with_id": current_user.id})
    is_admin = current_user.role == "admin"
    
    if not (is_owner or is_shared or is_admin):
        raise HTTPException(status_code=403, detail="Access denied")
    
    if isinstance(file['uploaded_at'], str):
        file['uploaded_at'] = datetime.fromisoformat(file['uploaded_at'])
    
    return file

@api_router.get("/files/{file_id}/download")
async def download_file(
    file_id: str,
    password: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Download de arquivo"""
    file_metadata = await db.files.find_one({"id": file_id, "is_deleted": False}, {"_id": 0})
    if not file_metadata:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Verificar acesso
    is_owner = file_metadata["uploaded_by"] == current_user.id
    is_shared = await db.file_shares.find_one({"file_id": file_id, "shared_with_id": current_user.id})
    
    if not is_owner and not is_shared:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Verificar senha se arquivo tem senha
    if file_metadata.get("has_password") and file_metadata.get("password_hash"):
        if not password:
            raise HTTPException(status_code=401, detail="Password required")
        if not verify_password(password, file_metadata["password_hash"]):
            raise HTTPException(status_code=401, detail="Incorrect password")
    
    file_content = await get_file_from_storage(file_metadata)
    
    logger.info(f"📥 Download: {file_metadata['original_name']} por {current_user.username}")
    
    return StreamingResponse(
        io.BytesIO(file_content),
        media_type=file_metadata["file_type"],
        headers={"Content-Disposition": f'attachment; filename="{file_metadata["original_name"]}"'}
    )

@api_router.delete("/files/{file_id}")
async def delete_file(file_id: str, current_user: User = Depends(get_current_user)):
    """🆕 CORRIGIDO: Deletar arquivo (soft delete para premium, hard delete para free)"""
    file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_metadata or file_metadata["uploaded_by"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if file_metadata.get("is_deleted"):
        raise HTTPException(status_code=400, detail="File already deleted")
    
    if current_user.plan == "premium" or current_user.role == "admin":
        # 🆕 PREMIUM: Soft delete (vai pra lixeira)
        await db.files.update_one(
            {"id": file_id},
            {
                "$set": {
                    "is_deleted": True,
                    "deleted_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # Decrementar contadores
        await db.users.update_one(
            {"id": current_user.id},
            {"$inc": {"storage_used": -file_metadata["file_size"], "file_count": -1}}
        )
        
        logger.info(f"🗑️ Movido para lixeira: {file_metadata['original_name']} (Premium)")
        return {"message": "File moved to trash", "trash": True}
    else:
        # 🆕 FREE: Hard delete (deleta permanentemente)
        await delete_file_from_storage(file_metadata)
        await db.files.delete_one({"id": file_id})
        await db.file_shares.delete_many({"file_id": file_id})
        
        # Decrementar contadores
        await db.users.update_one(
            {"id": current_user.id},
            {"$inc": {"storage_used": -file_metadata["file_size"], "file_count": -1}}
        )
        
        logger.info(f"🗑️ Deletado permanentemente: {file_metadata['original_name']} (Free)")
        return {"message": "File deleted permanently", "trash": False}

@api_router.get("/user/stats")
async def get_user_stats(current_user: User = Depends(get_current_user)):
    """Estatísticas do usuário"""
    user = await db.users.find_one({"id": current_user.id})
    
    # Contar arquivos ativos
    active_files = await db.files.count_documents({
        "uploaded_by": current_user.id,
        "is_deleted": False
    })
    
    # Contar arquivos na lixeira
    trash_files = await db.files.count_documents({
        "uploaded_by": current_user.id,
        "is_deleted": True
    })
    
    storage_used = user.get("storage_used", 0)
    storage_limit = user.get("storage_limit", 104857600)
    
    return {
        "total_files": active_files,
        "trash_files": trash_files,
        "total_storage_bytes": storage_used,
        "total_storage_mb": round(storage_used / (1024 * 1024), 2),
        "storage_limit_bytes": storage_limit,
        "storage_limit_mb": round(storage_limit / (1024 * 1024), 2),
        "storage_limit_gb": round(storage_limit / (1024 ** 3), 2),
        "storage_percentage": round((storage_used / storage_limit) * 100, 1) if storage_limit > 0 else 0,
        "plan": user.get("plan", "free"),
        "premium_expires": user.get("premium_expires")
    }

# ============================================================================
# TRASH ROUTES (PREMIUM ONLY)
# ============================================================================

@api_router.get("/trash", dependencies=[Depends(require_premium)])
async def get_trash(current_user: User = Depends(get_current_user)):
    """🆕 NOVO: Listar arquivos na lixeira (PREMIUM ONLY)"""
    files = await db.files.find(
        {
            "uploaded_by": current_user.id,
            "is_deleted": True
        },
        {"_id": 0, "password_hash": 0}
    ).to_list(1000)
    
    for file in files:
        if isinstance(file['uploaded_at'], str):
            file['uploaded_at'] = datetime.fromisoformat(file['uploaded_at'])
        if file.get('deleted_at') and isinstance(file['deleted_at'], str):
            file['deleted_at'] = datetime.fromisoformat(file['deleted_at'])
            
            # Calcular dias restantes até deleção permanente
            deleted_date = datetime.fromisoformat(file['deleted_at'])
            days_left = 30 - (datetime.now(timezone.utc) - deleted_date).days
            file['days_until_permanent_delete'] = max(0, days_left)
    
    return files

@api_router.post("/trash/{file_id}/restore", dependencies=[Depends(require_premium)])
async def restore_file(file_id: str, current_user: User = Depends(get_current_user)):
    """🆕 NOVO: Restaurar arquivo da lixeira (PREMIUM ONLY)"""
    file = await db.files.find_one(
        {"id": file_id, "uploaded_by": current_user.id, "is_deleted": True},
        {"_id": 0}
    )
    
    if not file:
        raise HTTPException(status_code=404, detail="File not found in trash")
    
    # Verificar se usuário tem espaço disponível
    await check_user_limits(current_user, file["file_size"])
    
    # Restaurar arquivo
    await db.files.update_one(
        {"id": file_id},
        {
            "$set": {
                "is_deleted": False,
                "deleted_at": None
            }
        }
    )
    
    # Incrementar contadores
    await db.users.update_one(
        {"id": current_user.id},
        {"$inc": {"storage_used": file["file_size"], "file_count": 1}}
    )
    
    logger.info(f"♻️ Restaurado da lixeira: {file['original_name']}")
    
    # Criar notificação
    await create_notification(
        current_user.id,
        "file_restored",
        "♻️ Arquivo Restaurado",
        f"Arquivo '{file['original_name']}' foi restaurado da lixeira"
    )
    
    return {"message": "File restored", "file": file}

@api_router.delete("/trash/{file_id}/permanent", dependencies=[Depends(require_premium)])
async def permanent_delete(file_id: str, current_user: User = Depends(get_current_user)):
    """🆕 NOVO: Deletar permanentemente da lixeira (PREMIUM ONLY)"""
    file = await db.files.find_one(
        {"id": file_id, "uploaded_by": current_user.id, "is_deleted": True},
        {"_id": 0}
    )
    
    if not file:
        raise HTTPException(status_code=404, detail="File not found in trash")
    
    # Deletar do storage
    await delete_file_from_storage(file)
    
    # Deletar do MongoDB
    await db.files.delete_one({"id": file_id})
    
    # Deletar compartilhamentos
    await db.file_shares.delete_many({"file_id": file_id})
    
    logger.info(f"🗑️ Deletado permanentemente: {file['original_name']}")
    
    return {"message": "File permanently deleted"}

@api_router.delete("/trash/empty", dependencies=[Depends(require_premium)])
async def empty_trash(current_user: User = Depends(get_current_user)):
    """🆕 NOVO: Esvaziar lixeira completamente (PREMIUM ONLY)"""
    files = await db.files.find({
        "uploaded_by": current_user.id,
        "is_deleted": True
    }).to_list(1000)
    
    deleted_count = 0
    for file in files:
        try:
            await delete_file_from_storage(file)
            await db.files.delete_one({"id": file["id"]})
            await db.file_shares.delete_many({"file_id": file["id"]})
            deleted_count += 1
        except Exception as e:
            logger.error(f"Erro ao deletar arquivo {file['id']}: {e}")
    
    logger.info(f"🗑️ Lixeira esvaziada: {deleted_count} arquivos")
    
    return {
        "message": "Trash emptied",
        "deleted_count": deleted_count
    }

# ============================================================================
# SEARCH ROUTES
# ============================================================================

@api_router.get("/files/search", dependencies=[Depends(require_premium)])
async def search_files(
    query: Optional[str] = None,
    file_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """🆕 NOVO: Busca avançada de arquivos (PREMIUM ONLY)"""
    filters = {
        "uploaded_by": current_user.id,
        "is_deleted": False
    }
    
    # Filtro por nome
    if query:
        filters["original_name"] = {"$regex": query, "$options": "i"}
    
    # Filtro por tipo
    if file_type:
        filters["file_type"] = {"$regex": file_type, "$options": "i"}
    
    # Filtro por data
    if date_from or date_to:
        date_filter = {}
        if date_from:
            date_filter["$gte"] = date_from
        if date_to:
            date_filter["$lte"] = date_to
        if date_filter:
            filters["uploaded_at"] = date_filter
    
    files = await db.files.find(filters, {"_id": 0, "password_hash": 0}).to_list(1000)
    
    for file in files:
        if isinstance(file['uploaded_at'], str):
            file['uploaded_at'] = datetime.fromisoformat(file['uploaded_at'])
    
    logger.info(f"🔍 Busca: '{query}' por {current_user.username} - {len(files)} resultados")
    
    return files
    # ============================================================================
# SHARING ROUTES
# ============================================================================

@api_router.get("/users/search")
async def search_users(
    query: str,
    current_user: User = Depends(get_current_user)
):
    """🆕 NOVO: Buscar usuários por username (para autocomplete de compartilhamento)"""
    if len(query) < 2:
        return []
    
    users = await db.users.find(
        {
            "username": {"$regex": f"^{query}", "$options": "i"},
            "id": {"$ne": current_user.id}  # Não incluir ele mesmo
        },
        {"_id": 0, "id": 1, "username": 1, "plan": 1}
    ).limit(10).to_list(10)
    
    return users

@api_router.post("/files/{file_id}/share")
async def share_file(
    file_id: str,
    share_data: ShareRequest,
    current_user: User = Depends(get_current_user)
):
    """Compartilhar arquivo com outro usuário"""
    file_metadata = await db.files.find_one({"id": file_id, "is_deleted": False}, {"_id": 0})
    if not file_metadata:
        raise HTTPException(status_code=404, detail="File not found")
    
    # 🆕 CORRIGIDO: Verificar por UUID
    if file_metadata["uploaded_by"] != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can share")
    
    # Buscar usuário destinatário
    target_user = await db.users.find_one({"username": share_data.username}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Não pode compartilhar consigo mesmo
    if target_user["id"] == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot share with yourself")
    
    # Verificar se já compartilhou
    existing = await db.file_shares.find_one({
        "file_id": file_id,
        "shared_with_id": target_user["id"]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already shared with this user")
    
    # Criar compartilhamento
    share = FileShare(
        file_id=file_id,
        owner_id=current_user.id,
        shared_with_id=target_user["id"],
        shared_with_username=target_user["username"],
        permissions=share_data.permissions,
        requires_password=file_metadata.get("has_password", False)
    )
    
    share_doc = share.model_dump()
    share_doc["shared_at"] = share_doc["shared_at"].isoformat()
    await db.file_shares.insert_one(share_doc)
    
    # 🆕 Criar notificação
    await create_notification(
        target_user["id"],
        "file_share",
        "📤 Arquivo Compartilhado",
        f"{current_user.username} compartilhou '{file_metadata['original_name']}' com você"
    )
    
    logger.info(f"📤 {current_user.username} compartilhou '{file_metadata['original_name']}' com {target_user['username']}")
    
    return share

@api_router.get("/files/{file_id}/shares")
async def list_file_shares(
    file_id: str,
    current_user: User = Depends(get_current_user)
):
    """Listar com quem um arquivo foi compartilhado"""
    file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_metadata:
        raise HTTPException(status_code=404, detail="File not found")
    
    # 🆕 CORRIGIDO: Verificar por UUID
    if file_metadata["uploaded_by"] != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can see shares")
    
    shares = await db.file_shares.find({"file_id": file_id}, {"_id": 0}).to_list(1000)
    
    for share in shares:
        if isinstance(share['shared_at'], str):
            share['shared_at'] = datetime.fromisoformat(share['shared_at'])
    
    return shares

@api_router.delete("/files/{file_id}/shares/{share_id}")
async def revoke_share(
    file_id: str,
    share_id: str,
    current_user: User = Depends(get_current_user)
):
    """Revogar compartilhamento"""
    share = await db.file_shares.find_one({"id": share_id, "file_id": file_id}, {"_id": 0})
    if not share:
        raise HTTPException(status_code=404, detail="Share not found")
    
    # Verificar se é o dono
    if share["owner_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can revoke")
    
    await db.file_shares.delete_one({"id": share_id})
    
    # 🆕 Criar notificação para quem perdeu o acesso
    await create_notification(
        share["shared_with_id"],
        "share_revoked",
        "🚫 Compartilhamento Removido",
        f"{current_user.username} removeu seu acesso a um arquivo"
    )
    
    logger.info(f"🚫 Compartilhamento revogado: {share_id}")
    
    return {"message": "Share revoked"}

@api_router.delete("/files/{file_id}/shares/user/{user_id}")
async def revoke_share_by_user(
    file_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    """Revogar compartilhamento com usuário específico"""
    file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_metadata or file_metadata["uploaded_by"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    result = await db.file_shares.delete_one({
        "file_id": file_id,
        "shared_with_id": user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Share not found")
    
    # 🆕 Criar notificação
    await create_notification(
        user_id,
        "share_revoked",
        "🚫 Compartilhamento Removido",
        f"{current_user.username} removeu seu acesso a '{file_metadata['original_name']}'"
    )
    
    return {"message": "Share revoked"}

@api_router.get("/shares/received")
async def get_received_shares(current_user: User = Depends(get_current_user)):
    """Listar todos os compartilhamentos recebidos com detalhes"""
    shares = await db.file_shares.find(
        {"shared_with_id": current_user.id},
        {"_id": 0}
    ).to_list(1000)
    
    result = []
    for share in shares:
        # Buscar informações do arquivo
        file = await db.files.find_one(
            {"id": share["file_id"], "is_deleted": False},
            {"_id": 0, "password_hash": 0}
        )
        
        if file:
            if isinstance(share['shared_at'], str):
                share['shared_at'] = datetime.fromisoformat(share['shared_at'])
            if isinstance(file['uploaded_at'], str):
                file['uploaded_at'] = datetime.fromisoformat(file['uploaded_at'])
            
            result.append({
                "share": share,
                "file": file
            })
    
    return result

@api_router.get("/shares/sent")
async def get_sent_shares(current_user: User = Depends(get_current_user)):
    """Listar todos os compartilhamentos enviados"""
    shares = await db.file_shares.find(
        {"owner_id": current_user.id},
        {"_id": 0}
    ).to_list(1000)
    
    result = []
    for share in shares:
        # Buscar informações do arquivo
        file = await db.files.find_one(
            {"id": share["file_id"]},
            {"_id": 0, "password_hash": 0}
        )
        
        if file:
            if isinstance(share['shared_at'], str):
                share['shared_at'] = datetime.fromisoformat(share['shared_at'])
            if isinstance(file['uploaded_at'], str):
                file['uploaded_at'] = datetime.fromisoformat(file['uploaded_at'])
            
            result.append({
                "share": share,
                "file": file
            })
    
    return result
    # ============================================================================
# TEAMS ROUTES (PREMIUM ONLY)
# ============================================================================

@api_router.post("/teams/create", response_model=Team, dependencies=[Depends(require_premium)])
async def create_team(team_data: TeamCreate, current_user: User = Depends(get_current_user)):
    """🆕 Criar time (PREMIUM ONLY)"""
    
    # Verificar se nome já existe
    existing = await db.teams.find_one({"name": team_data.name})
    if existing:
        raise HTTPException(status_code=400, detail="Team name already exists")
    
    # Criar time
    team = Team(
        name=team_data.name,
        description=team_data.description,
        owner_id=current_user.id,
        owner_username=current_user.username,
        members=[current_user.id],
        member_usernames=[current_user.username]
    )
    
    team_doc = team.model_dump()
    team_doc["created_at"] = team_doc["created_at"].isoformat()
    await db.teams.insert_one(team_doc)
    
    logger.info(f"👥 Time criado: {team.name} por {current_user.username}")
    
    return team

@api_router.get("/teams/my-teams")
async def get_my_teams(current_user: User = Depends(get_current_user)):
    """Listar times do usuário"""
    teams = await db.teams.find(
        {"members": current_user.id},
        {"_id": 0}
    ).to_list(100)
    
    for team in teams:
        if isinstance(team['created_at'], str):
            team['created_at'] = datetime.fromisoformat(team['created_at'])
    
    return teams

@api_router.get("/teams/{team_id}")
async def get_team(team_id: str, current_user: User = Depends(get_current_user)):
    """Obter detalhes de um time"""
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Verificar se é membro
    if current_user.id not in team["members"] and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not a team member")
    
    if isinstance(team['created_at'], str):
        team['created_at'] = datetime.fromisoformat(team['created_at'])
    
    return team

@api_router.post("/teams/{team_id}/invite", dependencies=[Depends(require_premium)])
async def invite_to_team(
    team_id: str,
    invite_data: InviteRequest,
    current_user: User = Depends(get_current_user)
):
    """Convidar usuário para time (apenas dono)"""
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Verificar se é o dono
    if team["owner_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Only team owner can invite")
    
    # Buscar usuário
    target_user = await db.users.find_one({"username": invite_data.username}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verificar se já é membro
    if target_user["id"] in team["members"]:
        raise HTTPException(status_code=400, detail="User already a member")
    
    # Verificar se já tem convite pendente
    existing_invite = await db.team_invites.find_one({
        "team_id": team_id,
        "invitee_id": target_user["id"],
        "status": "pending"
    })
    if existing_invite:
        raise HTTPException(status_code=400, detail="Invite already sent")
    
    # Criar convite
    invite = TeamInvite(
        team_id=team_id,
        team_name=team["name"],
        inviter_id=current_user.id,
        inviter_username=current_user.username,
        invitee_username=invite_data.username,
        invitee_id=target_user["id"]
    )
    
    invite_doc = invite.model_dump()
    invite_doc["created_at"] = invite_doc["created_at"].isoformat()
    await db.team_invites.insert_one(invite_doc)
    
    # 🆕 Criar notificação
    await create_notification(
        target_user["id"],
        "team_invite",
        "👥 Convite para Time",
        f"{current_user.username} convidou você para o time '{team['name']}'"
    )
    
    logger.info(f"📨 Convite enviado: {invite_data.username} para time {team['name']}")
    
    return invite

@api_router.get("/teams/invites")
async def get_my_invites(current_user: User = Depends(get_current_user)):
    """Listar convites de times pendentes"""
    invites = await db.team_invites.find(
        {"invitee_id": current_user.id, "status": "pending"},
        {"_id": 0}
    ).to_list(100)
    
    for invite in invites:
        if isinstance(invite['created_at'], str):
            invite['created_at'] = datetime.fromisoformat(invite['created_at'])
    
    return invites

@api_router.post("/teams/invites/{invite_id}/accept")
async def accept_invite(invite_id: str, current_user: User = Depends(get_current_user)):
    """Aceitar convite de time"""
    invite = await db.team_invites.find_one({"id": invite_id}, {"_id": 0})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    
    # Verificar se é o destinatário
    if invite["invitee_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not your invite")
    
    # Verificar status
    if invite["status"] != "pending":
        raise HTTPException(status_code=400, detail="Invite already processed")
    
    # Adicionar ao time
    result = await db.teams.update_one(
        {"id": invite["team_id"]},
        {
            "$push": {
                "members": current_user.id,
                "member_usernames": current_user.username
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Atualizar status do convite
    await db.team_invites.update_one(
        {"id": invite_id},
        {"$set": {"status": "accepted"}}
    )
    
    # 🆕 Criar notificação para quem convidou
    await create_notification(
        invite["inviter_id"],
        "team_join",
        "✅ Convite Aceito",
        f"{current_user.username} aceitou o convite e entrou no time '{invite['team_name']}'"
    )
    
    logger.info(f"✅ {current_user.username} aceitou convite para {invite['team_name']}")
    
    return {"message": "Invite accepted", "team_id": invite["team_id"]}

@api_router.post("/teams/invites/{invite_id}/reject")
async def reject_invite(invite_id: str, current_user: User = Depends(get_current_user)):
    """Rejeitar convite de time"""
    invite = await db.team_invites.find_one({"id": invite_id}, {"_id": 0})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    
    # Verificar se é o destinatário
    if invite["invitee_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not your invite")
    
    # Atualizar status
    await db.team_invites.update_one(
        {"id": invite_id},
        {"$set": {"status": "rejected"}}
    )
    
    # 🆕 Criar notificação para quem convidou
    await create_notification(
        invite["inviter_id"],
        "team_reject",
        "❌ Convite Rejeitado",
        f"{current_user.username} rejeitou o convite para o time '{invite['team_name']}'"
    )
    
    logger.info(f"❌ {current_user.username} rejeitou convite para {invite['team_name']}")
    
    return {"message": "Invite rejected"}

@api_router.post("/teams/{team_id}/files/{file_id}/add")
async def add_file_to_team(
    team_id: str,
    file_id: str,
    current_user: User = Depends(get_current_user)
):
    """Adicionar arquivo ao time"""
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Verificar se é membro
    if current_user.id not in team["members"]:
        raise HTTPException(status_code=403, detail="Not a team member")
    
    # Verificar se arquivo existe e pertence ao usuário
    file_metadata = await db.files.find_one({"id": file_id, "is_deleted": False}, {"_id": 0})
    if not file_metadata:
        raise HTTPException(status_code=404, detail="File not found")
    
    if file_metadata["uploaded_by"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not your file")
    
    # Verificar se já está no time
    if file_id in team.get("files", []):
        raise HTTPException(status_code=400, detail="File already in team")
    
    # Adicionar arquivo ao time
    await db.teams.update_one(
        {"id": team_id},
        {"$addToSet": {"files": file_id}}
    )
    
    # 🆕 Notificar todos os membros (exceto quem adicionou)
    for member_id in team["members"]:
        if member_id != current_user.id:
            await create_notification(
                member_id,
                "team_file_added",
                "📁 Novo Arquivo no Time",
                f"{current_user.username} adicionou '{file_metadata['original_name']}' ao time '{team['name']}'"
            )
    
    logger.info(f"📁 Arquivo '{file_metadata['original_name']}' adicionado ao time {team['name']}")
    
    return {"message": "File added to team"}

@api_router.delete("/teams/{team_id}/files/{file_id}")
async def remove_file_from_team(
    team_id: str,
    file_id: str,
    current_user: User = Depends(get_current_user)
):
    """Remover arquivo do time (dono do arquivo ou dono do time)"""
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    file_metadata = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_metadata:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Permitir apenas dono do arquivo ou dono do time
    is_file_owner = file_metadata["uploaded_by"] == current_user.id
    is_team_owner = team["owner_id"] == current_user.id
    
    if not (is_file_owner or is_team_owner):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Remover arquivo
    await db.teams.update_one(
        {"id": team_id},
        {"$pull": {"files": file_id}}
    )
    
    logger.info(f"🗑️ Arquivo removido do time {team['name']}")
    
    return {"message": "File removed from team"}

@api_router.get("/teams/{team_id}/files")
async def get_team_files(team_id: str, current_user: User = Depends(get_current_user)):
    """Listar arquivos do time"""
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Verificar se é membro
    if current_user.id not in team["members"] and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not a team member")
    
    file_ids = team.get("files", [])
    if not file_ids:
        return []
    
    files = await db.files.find(
        {"id": {"$in": file_ids}, "is_deleted": False},
        {"_id": 0, "password_hash": 0}
    ).to_list(1000)
    
    for file in files:
        if isinstance(file['uploaded_at'], str):
            file['uploaded_at'] = datetime.fromisoformat(file['uploaded_at'])
    
    return files

@api_router.get("/teams/{team_id}/members")
async def get_team_members(team_id: str, current_user: User = Depends(get_current_user)):
    """Listar membros do time com detalhes"""
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Verificar se é membro
    if current_user.id not in team["members"] and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not a team member")
    
    members = []
    for member_id in team["members"]:
        user = await db.users.find_one(
            {"id": member_id},
            {"_id": 0, "id": 1, "username": 1, "plan": 1, "role": 1}
        )
        if user:
            user["is_owner"] = member_id == team["owner_id"]
            members.append(user)
    
    return members

@api_router.delete("/teams/{team_id}/members/{user_id}")
async def remove_team_member(
    team_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    """Remover membro do time (apenas dono)"""
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Verificar se é o dono
    if team["owner_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Only team owner can remove members")
    
    # Não pode remover a si mesmo
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself. Delete the team instead.")
    
    # Buscar username do usuário
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Remover membro
    await db.teams.update_one(
        {"id": team_id},
        {
            "$pull": {
                "members": user_id,
                "member_usernames": user["username"]
            }
        }
    )
    
    # 🆕 Notificar usuário removido
    await create_notification(
        user_id,
        "team_removed",
        "🚫 Removido do Time",
        f"Você foi removido do time '{team['name']}'"
    )
    
    logger.info(f"🚫 {user['username']} removido do time {team['name']}")
    
    return {"message": "Member removed"}

@api_router.post("/teams/{team_id}/leave")
async def leave_team(team_id: str, current_user: User = Depends(get_current_user)):
    """Sair do time"""
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Verificar se é membro
    if current_user.id not in team["members"]:
        raise HTTPException(status_code=400, detail="Not a team member")
    
    # Dono não pode sair, deve deletar o time
    if team["owner_id"] == current_user.id:
        raise HTTPException(status_code=400, detail="Team owner cannot leave. Delete the team instead.")
    
    # Remover do time
    await db.teams.update_one(
        {"id": team_id},
        {
            "$pull": {
                "members": current_user.id,
                "member_usernames": current_user.username
            }
        }
    )
    
    # 🆕 Notificar dono do time
    await create_notification(
        team["owner_id"],
        "team_leave",
        "👋 Membro Saiu",
        f"{current_user.username} saiu do time '{team['name']}'"
    )
    
    logger.info(f"👋 {current_user.username} saiu do time {team['name']}")
    
    return {"message": "Left team"}

@api_router.delete("/teams/{team_id}", dependencies=[Depends(require_premium)])
async def delete_team(team_id: str, current_user: User = Depends(get_current_user)):
    """Deletar time (apenas dono)"""
    team = await db.teams.find_one({"id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Verificar se é o dono
    if team["owner_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Only team owner can delete")
    
    # 🆕 Notificar todos os membros
    for member_id in team["members"]:
        if member_id != current_user.id:
            await create_notification(
                member_id,
                "team_deleted",
                "🗑️ Time Deletado",
                f"O time '{team['name']}' foi deletado por {current_user.username}"
            )
    
    # Deletar time
    await db.teams.delete_one({"id": team_id})
    
    # Deletar convites pendentes
    await db.team_invites.delete_many({"team_id": team_id})
    
    logger.info(f"🗑️ Time deletado: {team['name']}")
    
    return {"message": "Team deleted"}
    # ============================================================================
# NOTIFICATIONS ROUTES
# ============================================================================

@api_router.get("/notifications", response_model=List[Notification])
async def get_notifications(current_user: User = Depends(get_current_user)):
    """🆕 NOVO: Listar notificações do usuário"""
    notifs = await db.notifications.find(
        {"user_id": current_user.id},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    for notif in notifs:
        if isinstance(notif['created_at'], str):
            notif['created_at'] = datetime.fromisoformat(notif['created_at'])
    
    return notifs

@api_router.get("/notifications/unread-count")
async def get_unread_count(current_user: User = Depends(get_current_user)):
    """🆕 NOVO: Contar notificações não lidas"""
    count = await db.notifications.count_documents({
        "user_id": current_user.id,
        "read": False
    })
    return {"count": count}

@api_router.post("/notifications/{notif_id}/read")
async def mark_notification_read(
    notif_id: str,
    current_user: User = Depends(get_current_user)
):
    """🆕 NOVO: Marcar notificação como lida"""
    result = await db.notifications.update_one(
        {"id": notif_id, "user_id": current_user.id},
        {"$set": {"read": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification marked as read"}

@api_router.post("/notifications/mark-all-read")
async def mark_all_read(current_user: User = Depends(get_current_user)):
    """🆕 NOVO: Marcar todas notificações como lidas"""
    result = await db.notifications.update_many(
        {"user_id": current_user.id, "read": False},
        {"$set": {"read": True}}
    )
    
    return {
        "message": "All notifications marked as read",
        "count": result.modified_count
    }

@api_router.delete("/notifications/{notif_id}")
async def delete_notification(
    notif_id: str,
    current_user: User = Depends(get_current_user)
):
    """🆕 NOVO: Deletar notificação"""
    result = await db.notifications.delete_one({
        "id": notif_id,
        "user_id": current_user.id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification deleted"}

@api_router.delete("/notifications/clear-all")
async def clear_all_notifications(current_user: User = Depends(get_current_user)):
    """🆕 NOVO: Limpar todas notificações"""
    result = await db.notifications.delete_many({"user_id": current_user.id})
    
    return {
        "message": "All notifications cleared",
        "count": result.deleted_count
    }

# ============================================================================
# CHAT ROUTES
# ============================================================================

@api_router.get("/chat/status")
async def get_chat_status():
    """Verificar se chat está habilitado"""
    settings = await db.settings.find_one({"key": "chat_enabled"})
    return {"enabled": settings.get("value", False) if settings else False}

@api_router.post("/chat/toggle", dependencies=[Depends(get_admin_user)])
async def toggle_chat(toggle: ChatToggle):
    """Ativar/desativar chat (ADMIN ONLY)"""
    await db.settings.update_one(
        {"key": "chat_enabled"},
        {"$set": {"value": toggle.enabled}},
        upsert=True
    )
    logger.info(f"💬 Chat {'ativado' if toggle.enabled else 'desativado'}")
    return {"enabled": toggle.enabled, "message": f"Chat {'ativado' if toggle.enabled else 'desativado'}"}

@api_router.get("/chat/messages", response_model=List[ChatMessage])
async def get_chat_messages(current_user: User = Depends(get_current_user)):
    """Listar mensagens do chat"""
    settings = await db.settings.find_one({"key": "chat_enabled"})
    if not settings or not settings.get("value"):
        raise HTTPException(status_code=403, detail="Chat está desabilitado")
    
    messages = await db.chat_messages.find({}, {"_id": 0}).sort("timestamp", -1).limit(100).to_list(100)
    
    for msg in messages:
        if isinstance(msg['timestamp'], str):
            msg['timestamp'] = datetime.fromisoformat(msg['timestamp'])
    
    return list(reversed(messages))

@api_router.post("/chat/send", response_model=ChatMessage)
async def send_chat_message(message: str = Form(...), current_user: User = Depends(get_current_user)):
    """Enviar mensagem no chat"""
    settings = await db.settings.find_one({"key": "chat_enabled"})
    if not settings or not settings.get("value"):
        raise HTTPException(status_code=403, detail="Chat está desabilitado")
    
    # Validações
    if len(message.strip()) == 0:
        raise HTTPException(status_code=400, detail="Mensagem vazia")
    
    if len(message) > 500:
        raise HTTPException(status_code=400, detail="Mensagem muito longa (máx 500 caracteres)")
    
    # Criar mensagem
    chat_message = ChatMessage(
        username=current_user.username,
        message=message.strip(),
        role=current_user.role
    )
    
    msg_doc = chat_message.model_dump()
    msg_doc["timestamp"] = msg_doc["timestamp"].isoformat()
    await db.chat_messages.insert_one(msg_doc)
    
    logger.info(f"💬 {current_user.username}: {message[:50]}...")
    return chat_message

@api_router.delete("/chat/messages/{message_id}", dependencies=[Depends(get_admin_user)])
async def delete_chat_message(message_id: str):
    """Deletar mensagem do chat (ADMIN ONLY)"""
    result = await db.chat_messages.delete_one({"id": message_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    
    return {"message": "Chat message deleted"}

@api_router.delete("/chat/clear", dependencies=[Depends(get_admin_user)])
async def clear_chat():
    """Limpar todo o chat (ADMIN ONLY)"""
    result = await db.chat_messages.delete_many({})
    
    logger.info(f"🗑️ Chat limpo: {result.deleted_count} mensagens deletadas")
    
    return {
        "message": "Chat cleared",
        "deleted_count": result.deleted_count
    }

# ============================================================================
# BUG REPORTS ROUTES
# ============================================================================

@api_router.post("/bugs/report", response_model=BugReport)
async def create_bug_report(
    bug_data: BugReportCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Criar relatório de bug"""
    
    # Criar bug report
    bug = BugReport(
        user_id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        category=bug_data.category,
        title=bug_data.title,
        description=bug_data.description,
        steps_to_reproduce=bug_data.steps_to_reproduce,
        expected_behavior=bug_data.expected_behavior,
        actual_behavior=bug_data.actual_behavior,
        browser_info=bug_data.browser_info
    )
    
    bug_doc = bug.model_dump()
    bug_doc["created_at"] = bug_doc["created_at"].isoformat()
    await db.bugs.insert_one(bug_doc)
    
    # 🆕 Enviar email em background (não bloqueia resposta)
    background_tasks.add_task(send_bug_report_email, bug)
    
    logger.info(f"🐛 Bug report de {current_user.username}: {bug.title}")
    
    return bug

@api_router.get("/bugs/list", dependencies=[Depends(get_admin_user)])
async def list_bug_reports(
    status: Optional[str] = None,
    category: Optional[str] = None
):
    """Listar bug reports (ADMIN ONLY)"""
    filters = {}
    
    if status:
        filters["status"] = status
    
    if category:
        filters["category"] = category
    
    bugs = await db.bugs.find(filters, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    for bug in bugs:
        if isinstance(bug['created_at'], str):
            bug['created_at'] = datetime.fromisoformat(bug['created_at'])
        if bug.get('resolved_at') and isinstance(bug['resolved_at'], str):
            bug['resolved_at'] = datetime.fromisoformat(bug['resolved_at'])
    
    return bugs

@api_router.get("/bugs/{bug_id}", dependencies=[Depends(get_admin_user)])
async def get_bug_report(bug_id: str):
    """Obter detalhes de um bug report (ADMIN ONLY)"""
    bug = await db.bugs.find_one({"id": bug_id}, {"_id": 0})
    if not bug:
        raise HTTPException(status_code=404, detail="Bug report not found")
    
    if isinstance(bug['created_at'], str):
        bug['created_at'] = datetime.fromisoformat(bug['created_at'])
    if bug.get('resolved_at') and isinstance(bug['resolved_at'], str):
        bug['resolved_at'] = datetime.fromisoformat(bug['resolved_at'])
    
    return bug

@api_router.post("/bugs/{bug_id}/resolve", dependencies=[Depends(get_admin_user)])
async def resolve_bug(bug_id: str):
    """Marcar bug como resolvido (ADMIN ONLY)"""
    result = await db.bugs.update_one(
        {"id": bug_id},
        {
            "$set": {
                "status": "resolved",
                "resolved_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Bug report not found")
    
    # Buscar bug para notificar usuário
    bug = await db.bugs.find_one({"id": bug_id}, {"_id": 0})
    if bug:
        await create_notification(
            bug["user_id"],
            "bug_resolved",
            "✅ Bug Resolvido",
            f"Seu bug report '{bug['title']}' foi marcado como resolvido!"
        )
    
    logger.info(f"✅ Bug resolvido: {bug_id}")
    
    return {"message": "Bug marked as resolved"}

@api_router.post("/bugs/{bug_id}/status", dependencies=[Depends(get_admin_user)])
async def update_bug_status(
    bug_id: str,
    status: str = Form(...)
):
    """Atualizar status do bug (ADMIN ONLY)"""
    valid_statuses = ["pending", "analyzing", "resolved", "wont_fix"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    update_data = {"status": status}
    
    if status == "resolved":
        update_data["resolved_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.bugs.update_one(
        {"id": bug_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Bug report not found")
    
    return {"message": f"Bug status updated to {status}"}

@api_router.delete("/bugs/{bug_id}", dependencies=[Depends(get_admin_user)])
async def delete_bug_report(bug_id: str):
    """Deletar bug report (ADMIN ONLY)"""
    result = await db.bugs.delete_one({"id": bug_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bug report not found")
    
    return {"message": "Bug report deleted"}

@api_router.get("/bugs/my-reports")
async def get_my_bug_reports(current_user: User = Depends(get_current_user)):
    """Listar meus bug reports"""
    bugs = await db.bugs.find(
        {"user_id": current_user.id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    for bug in bugs:
        if isinstance(bug['created_at'], str):
            bug['created_at'] = datetime.fromisoformat(bug['created_at'])
        if bug.get('resolved_at') and isinstance(bug['resolved_at'], str):
            bug['resolved_at'] = datetime.fromisoformat(bug['resolved_at'])
    
    return bugs

@api_router.get("/bugs/stats", dependencies=[Depends(get_admin_user)])
async def get_bug_stats():
    """Estatísticas de bugs (ADMIN ONLY)"""
    total = await db.bugs.count_documents({})
    pending = await db.bugs.count_documents({"status": "pending"})
    analyzing = await db.bugs.count_documents({"status": "analyzing"})
    resolved = await db.bugs.count_documents({"status": "resolved"})
    wont_fix = await db.bugs.count_documents({"status": "wont_fix"})
    
    # Agrupar por categoria
    pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    by_category = await db.bugs.aggregate(pipeline).to_list(100)
    
    return {
        "total": total,
        "pending": pending,
        "analyzing": analyzing,
        "resolved": resolved,
        "wont_fix": wont_fix,
        "by_category": by_category
    }
    # ============================================================================
# PAYMENT ROUTES (MERCADO PAGO)
# ============================================================================

@api_router.post("/payments/create-preference")
async def create_payment_preference(
    plan_type: str = Form("monthly"),  # "monthly" ou "yearly"
    current_user: User = Depends(get_current_user)
):
    """🆕 CORRIGIDO: Criar preferência de pagamento (PIX + cartão)"""
    if not MERCADOPAGO_ACCESS_TOKEN:
        raise HTTPException(status_code=503, detail="Sistema de pagamentos não configurado")
    
    # Verificar se já é premium
    if current_user.plan == "premium" and current_user.role != "admin":
        raise HTTPException(status_code=400, detail="Você já é Premium!")
    
    # 🆕 PREÇOS CORRETOS
    if plan_type == "yearly":
        price = 49.90  # R$ 49,90/ano
        title = "Biblioteca Premium - 1 Ano"
        description = "Acesso Premium por 12 meses"
        days = 365
    else:  # monthly
        price = 4.90  # 🆕 CORRIGIDO: R$ 4,90/mês
        title = "Biblioteca Premium - 1 Mês"
        description = "Acesso Premium por 30 dias"
        days = 30
    
    preference_data = {
        "items": [{
            "title": title,
            "quantity": 1,
            "unit_price": price,
            "currency_id": "BRL",
            "description": description
        }],
        "payer": {
            "name": current_user.username,
            "email": current_user.email or f"{current_user.username}@biblioteca.app"
        },
        "back_urls": {
            "success": f"{FRONTEND_URL}/payment/success",
            "failure": f"{FRONTEND_URL}/payment/failure",
            "pending": f"{FRONTEND_URL}/payment/pending"
        },
        "auto_return": "approved",
        "external_reference": f"{current_user.id}|{plan_type}|{days}",  # Incluir dias
        "notification_url": f"{BACKEND_URL}/api/payments/webhook",
        "statement_descriptor": "BIBLIOTECA PREMIUM",
        # 🆕 NOVO: Configurar PIX como método preferencial
        "payment_methods": {
            "installments": 1,  # Sem parcelamento
            "default_payment_method_id": "pix"  # Sugerir PIX primeiro
        },
        "expires": True,
        "expiration_date_from": datetime.now(timezone.utc).isoformat(),
        "expiration_date_to": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.mercadopago.com/checkout/preferences",
                json=preference_data,
                headers={
                    "Authorization": f"Bearer {MERCADOPAGO_ACCESS_TOKEN}",
                    "Content-Type": "application/json"
                }
            )
            response.raise_for_status()
            result = response.json()
        
        logger.info(f"💳 Preferência criada para {current_user.username} ({plan_type})")
        
        return {
            "preference_id": result["id"],
            "init_point": result["init_point"],
            "sandbox_init_point": result.get("sandbox_init_point"),
            "plan_type": plan_type,
            "price": price,
            "days": days
        }
    
    except Exception as e:
        logger.error(f"❌ Erro Mercado Pago: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao criar pagamento: {str(e)}")

@api_router.post("/payments/webhook")
async def payment_webhook(data: dict):
    """🆕 CORRIGIDO: Webhook do Mercado Pago para confirmar pagamentos"""
    try:
        logger.info(f"📥 Webhook recebido: {json.dumps(data, indent=2)}")
        
        # Mercado Pago envia notificações de diferentes tipos
        if data.get("type") == "payment":
            payment_id = data.get("data", {}).get("id")
            
            if not payment_id:
                return JSONResponse({"status": "no_payment_id"})
            
            # Buscar detalhes do pagamento
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"https://api.mercadopago.com/v1/payments/{payment_id}",
                    headers={"Authorization": f"Bearer {MERCADOPAGO_ACCESS_TOKEN}"}
                )
                payment_data = response.json()
            
            status = payment_data.get("status")
            external_ref = payment_data.get("external_reference")
            
            logger.info(f"💳 Pagamento {payment_id}: status={status}, ref={external_ref}")
            
            # Se pagamento aprovado
            if status == "approved" and external_ref:
                # Extrair informações do external_reference
                parts = external_ref.split("|")
                if len(parts) >= 3:
                    user_id = parts[0]
                    plan_type = parts[1]
                    days = int(parts[2])
                else:
                    user_id = external_ref
                    days = 30  # Default
                
                # Calcular data de expiração
                premium_expires = datetime.now(timezone.utc) + timedelta(days=days)
                
                # Atualizar usuário para Premium
                result = await db.users.update_one(
                    {"id": user_id},
                    {
                        "$set": {
                            "plan": "premium",
                            "premium_since": datetime.now(timezone.utc).isoformat(),
                            "premium_expires": premium_expires.isoformat(),
                            "storage_limit": 5368709120  # 5 GB
                        }
                    }
                )
                
                if result.modified_count > 0:
                    logger.info(f"✅ Usuário {user_id} virou Premium por {days} dias!")
                    
                    # 🆕 Criar notificação de boas-vindas
                    await create_notification(
                        user_id,
                        "premium_activated",
                        "👑 Bem-vindo ao Premium!",
                        f"Seu plano Premium foi ativado com sucesso! Aproveite todos os recursos exclusivos por {days} dias."
                    )
                    
                    return JSONResponse({"status": "success", "user_upgraded": True})
                else:
                    logger.warning(f"⚠️ Usuário {user_id} não encontrado")
        
        return JSONResponse({"status": "received"})
    
    except Exception as e:
        logger.error(f"❌ Erro no webhook: {e}")
        return JSONResponse({"status": "error", "message": str(e)})

@api_router.get("/payments/check-status")
async def check_payment_status(
    payment_id: str,
    current_user: User = Depends(get_current_user)
):
    """Verificar status de um pagamento específico"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://api.mercadopago.com/v1/payments/{payment_id}",
                headers={"Authorization": f"Bearer {MERCADOPAGO_ACCESS_TOKEN}"}
            )
            payment_data = response.json()
        
        return {
            "status": payment_data.get("status"),
            "status_detail": payment_data.get("status_detail"),
            "amount": payment_data.get("transaction_amount"),
            "payment_method": payment_data.get("payment_method_id"),
            "date_approved": payment_data.get("date_approved")
        }
    
    except Exception as e:
        logger.error(f"❌ Erro ao verificar pagamento: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/payments/my-subscriptions")
async def get_my_subscriptions(current_user: User = Depends(get_current_user)):
    """Ver informações da minha assinatura"""
    user = await db.users.find_one({"id": current_user.id}, {"_id": 0})
    
    if user.get("plan") != "premium":
        return {
            "is_premium": False,
            "plan": "free",
            "message": "Você está no plano Free"
        }
    
    premium_expires = user.get("premium_expires")
    if premium_expires:
        if isinstance(premium_expires, str):
            premium_expires = datetime.fromisoformat(premium_expires)
        
        days_left = (premium_expires - datetime.now(timezone.utc)).days
        
        return {
            "is_premium": True,
            "plan": "premium",
            "premium_since": user.get("premium_since"),
            "premium_expires": premium_expires.isoformat(),
            "days_left": max(0, days_left),
            "is_active": days_left > 0
        }
    
    return {
        "is_premium": True,
        "plan": "premium",
        "message": "Premium vitalício"
    }

# ============================================================================
# ADMIN ROUTES
# ============================================================================

@api_router.get("/admin/users", dependencies=[Depends(get_admin_user)])
async def list_all_users(
    plan: Optional[str] = None,
    role: Optional[str] = None,
    limit: int = 100
):
    """🆕 CORRIGIDO: Listar usuários (sem ver conteúdo dos arquivos)"""
    filters = {}
    
    if plan:
        filters["plan"] = plan
    
    if role:
        filters["role"] = role
    
    users = await db.users.find(
        filters,
        {"_id": 0, "password_hash": 0}  # Não retornar senha
    ).limit(limit).to_list(limit)
    
    for user in users:
        if isinstance(user['created_at'], str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
        if user.get('premium_since') and isinstance(user['premium_since'], str):
            user['premium_since'] = datetime.fromisoformat(user['premium_since'])
        if user.get('premium_expires') and isinstance(user['premium_expires'], str):
            user['premium_expires'] = datetime.fromisoformat(user['premium_expires'])
    
    return users

@api_router.get("/admin/stats", dependencies=[Depends(get_admin_user)])
async def get_admin_stats():
    """🆕 CORRIGIDO: Estatísticas gerais (sem ver conteúdo)"""
    total_users = await db.users.count_documents({})
    free_users = await db.users.count_documents({"plan": "free"})
    premium_users = await db.users.count_documents({"plan": "premium"})
    total_files = await db.files.count_documents({"is_deleted": False})
    deleted_files = await db.files.count_documents({"is_deleted": True})
    
    # Storage total usado (soma de todos os usuários)
    pipeline = [
        {"$group": {"_id": None, "total": {"$sum": "$storage_used"}}}
    ]
    result = await db.users.aggregate(pipeline).to_list(1)
    total_storage = result[0]["total"] if result else 0
    
    # Total de compartilhamentos
    total_shares = await db.file_shares.count_documents({})
    
    # Total de teams
    total_teams = await db.teams.count_documents({})
    
    # Bugs pendentes
    pending_bugs = await db.bugs.count_documents({"status": "pending"})
    
    return {
        "users": {
            "total": total_users,
            "free": free_users,
            "premium": premium_users
        },
        "files": {
            "active": total_files,
            "deleted": deleted_files,
            "total": total_files + deleted_files
        },
        "storage": {
            "total_bytes": total_storage,
            "total_mb": round(total_storage / (1024 * 1024), 2),
            "total_gb": round(total_storage / (1024 ** 3), 2)
        },
        "shares": total_shares,
        "teams": total_teams,
        "pending_bugs": pending_bugs
    }

@api_router.post("/admin/users/{user_id}/upgrade", dependencies=[Depends(get_admin_user)])
async def admin_upgrade_user(
    user_id: str,
    days: int = Form(30)
):
    """Admin pode fazer upgrade manual de usuário"""
    premium_expires = datetime.now(timezone.utc) + timedelta(days=days)
    
    result = await db.users.update_one(
        {"id": user_id},
        {
            "$set": {
                "plan": "premium",
                "premium_since": datetime.now(timezone.utc).isoformat(),
                "premium_expires": premium_expires.isoformat(),
                "storage_limit": 5368709120
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # 🆕 Notificar usuário
    await create_notification(
        user_id,
        "premium_activated",
        "👑 Premium Ativado!",
        f"Seu plano Premium foi ativado manualmente por um administrador por {days} dias!"
    )
    
    logger.info(f"👑 Admin upgrade: {user_id} → Premium por {days} dias")
    
    return {"message": f"User upgraded to premium for {days} days"}

@api_router.post("/admin/users/{user_id}/downgrade", dependencies=[Depends(get_admin_user)])
async def admin_downgrade_user(user_id: str):
    """Admin pode fazer downgrade de usuário"""
    result = await db.users.update_one(
        {"id": user_id},
        {
            "$set": {
                "plan": "free",
                "premium_since": None,
                "premium_expires": None,
                "storage_limit": 104857600  # 100 MB
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    logger.info(f"⬇️ Admin downgrade: {user_id} → Free")
    
    return {"message": "User downgraded to free"}

@api_router.delete("/admin/users/{user_id}/delete", dependencies=[Depends(get_admin_user)])
async def admin_delete_user(user_id: str):
    """🆕 CORRIGIDO: Admin pode deletar usuário (exceto outros admins)"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Não pode deletar outros admins
    if user.get("role") == "admin":
        raise HTTPException(status_code=403, detail="Cannot delete admin users")
    
    # Deletar todos os arquivos do storage
    files = await db.files.find({"uploaded_by": user_id}).to_list(10000)
    for file in files:
        try:
            await delete_file_from_storage(file)
        except Exception as e:
            logger.error(f"Erro ao deletar arquivo: {e}")
    
    # Deletar dados em cascata
    await db.files.delete_many({"uploaded_by": user_id})
    await db.file_shares.delete_many({"$or": [{"owner_id": user_id}, {"shared_with_id": user_id}]})
    await db.teams.delete_many({"owner_id": user_id})
    await db.teams.update_many({"members": user_id}, {"$pull": {"members": user_id}})
    await db.notifications.delete_many({"user_id": user_id})
    await db.bugs.delete_many({"user_id": user_id})
    await db.users.delete_one({"id": user_id})
    
    logger.info(f"🗑️ Admin deletou usuário: {user.get('username')}")
    
    return {"message": "User deleted by admin"}

@api_router.get("/admin/user/{user_id}/details", dependencies=[Depends(get_admin_user)])
async def get_user_details(user_id: str):
    """Ver detalhes de um usuário específico (sem ver conteúdo dos arquivos)"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Contar arquivos
    file_count = await db.files.count_documents({"uploaded_by": user_id, "is_deleted": False})
    trash_count = await db.files.count_documents({"uploaded_by": user_id, "is_deleted": True})
    
    # Contar compartilhamentos
    shares_sent = await db.file_shares.count_documents({"owner_id": user_id})
    shares_received = await db.file_shares.count_documents({"shared_with_id": user_id})
    
    # Contar teams
    teams_owned = await db.teams.count_documents({"owner_id": user_id})
    teams_member = await db.teams.count_documents({"members": user_id})
    
    if isinstance(user['created_at'], str):
        user['created_at'] = datetime.fromisoformat(user['created_at'])
    
    return {
        "user": user,
        "stats": {
            "files": file_count,
            "trash": trash_count,
            "shares_sent": shares_sent,
            "shares_received": shares_received,
            "teams_owned": teams_owned,
            "teams_member": teams_member
        }
    }

# ============================================================================
# HEALTH CHECK
# ============================================================================

@api_router.get("/health")
async def health_check():
    """Verificar saúde do serviço"""
    try:
        await db.command("ping")
        db_status = "ok"
    except:
        db_status = "error"
    
    return {
        "status": "ok",
        "database": db_status,
        "storage_mode": STORAGE_MODE,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "2.0.0"
    }

@api_router.get("/public-key")
async def get_public_key():
    """Retornar chave pública do Mercado Pago"""
    if not MERCADOPAGO_PUBLIC_KEY:
        raise HTTPException(status_code=503, detail="Mercado Pago not configured")
    
    return {"public_key": MERCADOPAGO_PUBLIC_KEY}

# ============================================================================
# INCLUDE ROUTER
# ============================================================================

app.include_router(api_router)

# ============================================================================
# RUN SERVER
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)
