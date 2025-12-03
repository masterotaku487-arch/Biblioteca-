from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pathlib import Path

def mount_frontend(app: FastAPI):
    """Monta frontend estático se existir"""
    build_path = Path(__file__).resolve().parent.parent / "frontend_build"
    if build_path.exists():
        app.mount("/", StaticFiles(directory=build_path, html=True), name="static")
        print(f"✅ Frontend montado em: {build_path}")
    else:
        print(f"⚠️ Frontend build não encontrado em: {build_path}")
