from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, WebSocket, WebSocketDisconnect, Form
from fastapi.responses import StreamingResponse, RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
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
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
# Adicionando aiosmtplib para envio assíncrono de e-mail (necessário para o endpoint de bug report)
import aiosmtplib
from email.utils import formataddr

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL')
if not mongo_url:
    # Fallback para string vazia para evitar erro de inicialização se a var não existir,
    # mas o app vai falhar ao tentar conectar. O ideal é ter a variável.
    print("⚠️ MONGO_URL não encontrada nas variáveis de ambiente.")
    mongo_url = ""

try:
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ.get('DB_NAME', 'biblioteca')]
except Exception as e:
    print(f"❌ Erro ao conectar ao MongoDB: {e}")

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
SMTP_EMAIL = os.environ.get("SMTP_EMAIL", "masterotaku487@gmail.com")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "oncl yigo lvzg oadz")
ADMIN_EMAIL = "masterotaku487@gmail.com"

# Google OAuth
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "202794626190-m95el70t5hbr1pphnj3lcf0suv8lv3k7.apps.googleusercontent.com")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "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")
BACKEND_URL = os.environ.get("BACKEND_URL", "https://biblioteca-privada-lfp5.onrender.com")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://biblioteca-sigma-gilt.vercel.app")

# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN = os.environ.get("MERCADOPAGO_ACCESS_TOKEN", "")
MERCADOPAGO_PUBLIC_KEY = os.environ.get("MERCADOPAGO_PUBLIC_KEY", "")

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

# ============================================================================
# CORS (Configuração Crítica - DEVE vir antes das rotas)
# ============================================================================
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[
        "https://biblioteca-sigma-gilt.vercel.app",  # Seu Frontend Vercel
        "https://biblioteca-privada-lfp5.onrender.com", # Seu Backend Render
        "http://localhost:3000",
        "http://localhost:8000",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

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
# MODELS
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
    storage_limit: int = 104857600  # 100 MB
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
    browser_info: Optional[dict] = None
    status: str = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BugReportCreate(BaseModel):
    category: str
    title: str
    description: str
    steps_to_reproduce: Optional[str] = None
    expected_behavior: Optional[str] = None
    actual_behavior: Optional[str] = None
    browser_info: Optional[dict] = None


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    return pwd_context.hash(password)


async def check_user_limits(user: User, file_size: int):
    """Verifica se usuário pode fazer upload"""
    if user.plan == "free":
        if user.file_count >= 20:
            raise HTTPException(
                status_code=403,
                detail="Limite de 20 arquivos atingido. Faça upgrade para Premium!"
            )
        if user.storage_used + file_size > user.storage_limit:
            raise HTTPException(
                status_code=403,
                detail="Limite de storage atingido (100 MB). Faça upgrade para Premium!"
            )
    elif user.plan == "premium":
        if user.storage_used + file_size > user.storage_limit:
            raise HTTPException(
                status_code=403,
                detail="Limite de storage atingido (5 GB)."
            )


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


async def send_email(subject: str, body: str, to_email: str = ADMIN_EMAIL):
    """Envia email via SMTP (síncrono/bloqueante - fallback simples)"""
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        logger.warning("Email não configurado")
        return
    
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = SMTP_EMAIL
        msg['To'] = to_email
        
        html_part = MIMEText(body, 'html')
        msg.attach(html_part)
        
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.send_message(msg)
        
        logger.info(f"📧 Email enviado para {to_email}")
    except Exception as e:
        logger.error(f"❌ Erro ao enviar email: {e}")


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


async def send_bug_report_email(bug: BugReport):
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        return
    
    html = f"""
    <html>
    <body style="font-family: Arial;">
      <h2 style="color: #e63946;">🐛 Bug Report</h2>
      <p><strong>Categoria:</strong> {bug.category}</p>
      <p><strong>Título:</strong> {bug.title}</p>
      <p><strong>Usuário:</strong> {bug.username}</p>
      <hr>
      <h3>Descrição:</h3>
      <p>{bug.description}</p>
      {f'<p><strong>Passos:</strong><br>{bug.steps_to_reproduce}</p>' if bug.steps_to_reproduce else ''}
      {f'<p><strong>Esperado:</strong><br>{bug.expected_behavior}</p>' if bug.expected_behavior else ''}
      {f'<p><strong>Atual:</strong><br>{bug.actual_behavior}</p>' if bug.actual_behavior else ''}
      {f'<pre>{json.dumps(bug.browser_info, indent=2)}</pre>' if bug.browser_info else ''}
    </body>
    </html>
    """
    
    try:
        msg = MIMEMultipart()
        msg["Subject"] = f"Bug: {bug.title}"
        msg["From"] = formataddr(("Biblioteca", SMTP_EMAIL))
        msg["To"] = ADMIN_EMAIL
        msg.attach(MIMEText(html, "html"))
        
        async with aiosmtplib.SMTP(hostname="smtp.gmail.com", port=587, use_tls=False, start_tls=True) as smtp:
            await smtp.login(SMTP_EMAIL, SMTP_PASSWORD)
            await smtp.send_message(msg)
    except Exception as e:
        logger.error(f"Email error: {e}")

# ============================================================================
# STARTUP
# ============================================================================

@app.on_event("startup")
async def startup_event():
    admin = await db.users.find_one({"username": "Masterotaku"})
    if not admin:
        admin_user = User(username="Masterotaku", role="admin", plan="premium", storage_limit=5368709120)
        doc = admin_user.model_dump()
        doc["password_hash"] = get_password_hash("@adm3011")
        doc["created_at"] = doc["created_at"].isoformat()
        await db.users.insert_one(doc)
        logger.info("✅ Admin: Masterotaku / @adm3011")
    
    settings = await db.settings.find_one({"key": "chat_enabled"})
    if not settings:
        await db.settings.insert_one({"key": "chat_enabled", "value": False})

# ============================================================================
# AUTH ROUTES
# ============================================================================

@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    if await db.users.find_one({"username": user_data.username}):
        raise HTTPException(400, "Username already registered")
    
    new_user = User(username=user_data.username, email=user_data.email)
    doc = new_user.model_dump()
    doc["password_hash"] = get_password_hash(user_data.password)
    doc["created_at"] = doc["created_at"].isoformat()
    await db.users.insert_one(doc)
    
    token = create_access_token({"sub": new_user.id}, timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    return Token(access_token=token, token_type="bearer", user=new_user)

@api_router.post("/auth/login", response_model=Token)
async def login(user_data: UserLogin):
    user = await db.users.find_one({"username": user_data.username}, {"_id": 0})
    if not user or not user.get("password_hash") or not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(401, "Incorrect username or password")
    
    token = create_access_token({"sub": user["id"]}, timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    return Token(access_token=token, token_type="bearer", user=User(**user))

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.get("/auth/google/login")
async def google_login():
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(503, "Google OAuth not configured")
    
    url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={GOOGLE_CLIENT_ID}&"
        f"redirect_uri={FRONTEND_URL}/auth/google/callback&"
        f"response_type=code&"
        f"scope=openid%20email%20profile"
    )
    return RedirectResponse(url)

@api_router.get("/auth/google/callback")
async def google_callback(code: str):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(503, "Google OAuth not configured")
    
    try:
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "redirect_uri": f"{FRONTEND_URL}/auth/google/callback",
                    "grant_type": "authorization_code"
                }
            )
            token_response.raise_for_status()
            access_token = token_response.json().get("access_token")
            
            user_response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            user_response.raise_for_status()
            user_data = user_response.json()
        
        google_id = user_data.get("id")
        email = user_data.get("email")
        
        user = await db.users.find_one({"google_id": google_id})
        
        if not user:
            username = email.split("@")[0] if email else f"user_{google_id[:8]}"
            base_username = username
            counter = 1
            while await db.users.find_one({"username": username}):
                username = f"{base_username}{counter}"
                counter += 1
            
            new_user = User(username=username, email=email, google_id=google_id)
            doc = new_user.model_dump()
            doc["created_at"] = doc["created_at"].isoformat()
            await db.users.insert_one(doc)
            user = doc
        
        jwt_token = create_access_token({"sub": user["id"]}, timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
        return RedirectResponse(f"{FRONTEND_URL}/?token={jwt_token}")
        
    except Exception as e:
        logger.error(f"Google OAuth error: {e}")
      @api_router.delete("/auth/delete-account")
async def delete_account(password: str = Form(...), confirmation: str = Form(...), current_user: User = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user.id})
    if not verify_password(password, user["password_hash"]):
        raise HTTPException(401, "Incorrect password")
    
    if confirmation.upper() != "DELETAR":
        raise HTTPException(400, "Must type 'DELETAR'")
    
    files = await db.files.find({"uploaded_by": current_user.id}).to_list(10000)
    for file in files:
        await delete_file_from_storage(file)
    await db.files.delete_many({"uploaded_by": current_user.id})
    await db.file_shares.delete_many({"$or": [{"owner_id": current_user.id}, {"shared_with_id": current_user.id}]})
    await db.teams.delete_many({"owner_id": current_user.id})
    await db.teams.update_many({"members": current_user.id}, {"$pull": {"members": current_user.id}})
    await db.notifications.delete_many({"user_id": current_user.id})
    await db.users.delete_one({"id": current_user.id})
    
    return {"message": "Account deleted"}

# ============================================================================
# INCLUDE ROUTER
# ============================================================================

app.include_router(api_router)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()