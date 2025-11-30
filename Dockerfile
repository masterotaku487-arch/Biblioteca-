# ---------- STAGE 1: Build do frontend (React) ----------
FROM node:18 AS frontend-build

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

COPY frontend ./
RUN npm run build

# ---------- STAGE 2: Backend FastAPI + Frontend juntos ----------
FROM python:3.11

WORKDIR /app

# Cria diretório para uploads (storage local)
RUN mkdir -p /app/uploads

# Copia backend
COPY backend/ ./backend/

# Instala dependências do Python
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copia build do React
COPY --from=frontend-build /app/frontend/build ./frontend_build/

# Variáveis de ambiente padrão
ENV STORAGE_MODE=supabase
ENV UPLOAD_DIR=/app/uploads
ENV PYTHONUNBUFFERED=1

# Railway usa a variável PORT dinamicamente
ENV PORT=8080
EXPOSE $PORT

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:$PORT/api/auth/me', timeout=2)" || exit 1

# Inicia o FastAPI com porta dinâmica do Railway
CMD uvicorn backend.server:app --host 0.0.0.0 --port $PORT
