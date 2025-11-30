from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pathlib import Path

def mount_frontend(app: FastAPI):
    build_path = Path(__file__).resolve().parent.parent / "frontend_build"
    if build_path.exists():
        app.mount("/", StaticFiles(directory=build_path, html=True), name="static")
