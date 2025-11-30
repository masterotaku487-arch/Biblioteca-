FROM python:3.11
WORKDIR /app
COPY backend/ ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

ENV STORAGE_MODE=supabase
ENV UPLOAD_DIR=/app/uploads
ENV PYTHONUNBUFFERED=1
ENV PORT=8080
EXPOSE $PORT

CMD uvicorn backend.server:app --host 0.0.0.0 --port $PORT
