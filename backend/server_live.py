"""
SERVER LIVE - WebSocket Dedicado (Auto-iniciado pelo server.py)
Porta: 8001
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import os
import json
import logging
from datetime import datetime, timezone
from typing import Dict

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# MongoDB (mesma conexão)
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Live Server")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Manager
class LiveManager:
    def __init__(self):
        self.connections: Dict[str, Dict[str, Dict[str, WebSocket]]] = {}
    
    async def connect(self, ws: WebSocket, team_id: str, file_id: str, username: str):
        await ws.accept()
        
        if team_id not in self.connections:
            self.connections[team_id] = {}
        if file_id not in self.connections[team_id]:
            self.connections[team_id][file_id] = {}
        
        self.connections[team_id][file_id][username] = ws
        
        await self.broadcast(team_id, file_id, {
            "type": "user_joined",
            "username": username,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }, exclude=username)
        
        users = list(self.connections[team_id][file_id].keys())
        await ws.send_json({"type": "users_list", "users": users})
    
    def disconnect(self, team_id: str, file_id: str, username: str):
        try:
            if (team_id in self.connections and 
                file_id in self.connections[team_id] and 
                username in self.connections[team_id][file_id]):
                del self.connections[team_id][file_id][username]
                if not self.connections[team_id][file_id]:
                    del self.connections[team_id][file_id]
                if not self.connections[team_id]:
                    del self.connections[team_id]
        except:
            pass
    
    async def broadcast(self, team_id: str, file_id: str, message: dict, exclude: str = None):
        if team_id not in self.connections or file_id not in self.connections[team_id]:
            return
        
        disconnected = []
        for username, ws in list(self.connections[team_id][file_id].items()):
            if exclude and username == exclude:
                continue
            try:
                await ws.send_json(message)
            except:
                disconnected.append(username)
        
        for username in disconnected:
            self.disconnect(team_id, file_id, username)

live_manager = LiveManager()

@app.get("/")
async def root():
    return {"status": "ok", "service": "live-server", "port": 8001}

@app.websocket("/ws/live/{team_id}/{file_id}")
async def websocket_endpoint(websocket: WebSocket, team_id: str, file_id: str):
    username = None
    try:
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
        
        await live_manager.connect(websocket, team_id, file_id, username)
        
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            message_type = message.get("type")
            timestamp = datetime.now(timezone.utc).isoformat()
            
            if message_type == "content_update":
                await live_manager.broadcast(team_id, file_id, {
                    "type": "content_update",
                    "username": username,
                    "content": message.get("content", ""),
                    "timestamp": timestamp
                }, exclude=username)
            
            elif message_type == "cursor_position":
                await live_manager.broadcast(team_id, file_id, {
                    "type": "cursor_position",
                    "username": username,
                    "position": message.get("position", 0),
                    "timestamp": timestamp
                }, exclude=username)
            
            elif message_type == "file_saved":
                await live_manager.broadcast(team_id, file_id, {
                    "type": "file_saved",
                    "username": username,
                    "timestamp": timestamp
                }, exclude=username)
    
    except WebSocketDisconnect:
        if username:
            live_manager.disconnect(team_id, file_id, username)
            try:
                await live_manager.broadcast(team_id, file_id, {
                    "type": "user_left",
                    "username": username,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
            except:
                pass
    except Exception as e:
        logger.error(f"Erro: {e}")
        if username:
            live_manager.disconnect(team_id, file_id, username)

@app.on_event("startup")
async def startup():
    logger.info("🚀 Live Server iniciado na porta 8001")

@app.on_event("shutdown")
async def shutdown():
    client.close()
