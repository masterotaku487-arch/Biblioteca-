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

# Instala dependências do Python (já inclui boto3)
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copia build do React
COPY --from=frontend-build /app/frontend/build ./frontend_build/

# Copia o .env se existir (ou use variáveis de ambiente do Fly.io)
COPY backend/.env* ./backend/ 2>/dev/null || true

# Variáveis de ambiente padrão (podem ser sobrescritas)
ENV STORAGE_MODE=local
ENV UPLOAD_DIR=/app/uploads
ENV PYTHONUNBUFFERED=1

# Porta usada pelo Fly.io
EXPOSE 8080

# Health check (opcional, mas recomendado)
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:8080/api/auth/me')" || exit 1

# Inicia o FastAPI com Uvicorn
CMD ["uvicorn", "backend.server:app", "--host", "0.0.0.0", "--port", "8080"]