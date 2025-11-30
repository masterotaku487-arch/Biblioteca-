# 🚀 Guia de Deploy - Biblioteca Privada

## Deploy no Fly.io

### 1. Pré-requisitos

```bash
# Instale o Fly CLI
curl -L https://fly.io/install.sh | sh

# Faça login
fly auth login
```

### 2. Configure os Secrets

⚠️ **NUNCA commite o .env!** Use secrets do Fly.io:

```bash
# Secret Key (gere uma nova!)
fly secrets set SECRET_KEY=sua-chave-secreta-64-caracteres

# MongoDB (use MongoDB Atlas ou outro serviço)
fly secrets set MONGO_URL=mongodb+srv://usuario:senha@cluster.mongodb.net/

# Se usar S3:
fly secrets set AWS_ACCESS_KEY_ID=sua-chave
fly secrets set AWS_SECRET_ACCESS_KEY=sua-chave-secreta
fly secrets set S3_BUCKET=seu-bucket
fly secrets set S3_REGION=us-east-1
fly secrets set STORAGE_MODE=s3
```

### 3. Crie o Volume (para persistência local)

```bash
# Crie um volume para armazenar uploads
fly volumes create biblioteca_uploads --region gru --size 10
```

### 4. Deploy

```bash
# Primeira vez
fly launch

# Deploys seguintes
fly deploy

# Verificar status
fly status

# Ver logs
fly logs
```

### 5. MongoDB (Recomendação)

Use **MongoDB Atlas** (gratuito até 512MB):

1. Acesse: https://www.mongodb.com/cloud/atlas
2. Crie um cluster gratuito
3. Adicione IP `0.0.0.0/0` nas Network Access
4. Copie a connection string
5. Configure: `fly secrets set MONGO_URL=mongodb+srv://...`

---

## Deploy Local com Docker

### Build da imagem

```bash
docker build -t biblioteca-privada .
```

### Executar

```bash
docker run -d \
  -p 8080:8080 \
  -e MONGO_URL=mongodb://host.docker.internal:27017 \
  -e SECRET_KEY=sua-chave-aqui \
  -e STORAGE_MODE=local \
  -v $(pwd)/uploads:/app/uploads \
  --name biblioteca \
  biblioteca-privada
```

### Ver logs

```bash
docker logs -f biblioteca
```

---

## Deploy com Docker Compose

Se preferir usar `docker-compose.yml`:

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:7
    container_name: biblioteca_mongo
    volumes:
      - mongodb_data:/data/db
    ports:
      - "27017:27017"
    restart: unless-stopped

  app:
    build: .
    container_name: biblioteca_app
    ports:
      - "8080:8080"
    environment:
      - MONGO_URL=mongodb://mongodb:27017
      - SECRET_KEY=${SECRET_KEY}
      - STORAGE_MODE=local
      - UPLOAD_DIR=/app/uploads
    volumes:
      - ./uploads:/app/uploads
    depends_on:
      - mongodb
    restart: unless-stopped

volumes:
  mongodb_data:
```

Execute:
```bash
docker-compose up -d
```

---

## Configuração S3 (Produção)

### 1. Crie um bucket no AWS S3

```bash
# Via AWS CLI
aws s3 mb s3://biblioteca-privada-files --region us-east-1
```

### 2. Crie usuário IAM com permissões

Política necessária:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::biblioteca-privada-files/*",
        "arn:aws:s3:::biblioteca-privada-files"
      ]
    }
  ]
}
```

### 3. Configure as variáveis

```bash
fly secrets set STORAGE_MODE=s3
fly secrets set S3_BUCKET=biblioteca-privada-files
fly secrets set S3_REGION=us-east-1
fly secrets set AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
fly secrets set AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCY
```

---

## Verificações Pós-Deploy

### 1. Health Check
```bash
curl https://sua-app.fly.dev/api/auth/me
```

### 2. Teste de Upload
1. Acesse: `https://sua-app.fly.dev`
2. Registre um usuário
3. Faça upload de um arquivo teste
4. Verifique se download funciona

### 3. Logs
```bash
fly logs --app biblioteca-privada
```

---

## Troubleshooting

### Erro: MongoDB não conecta
```bash
# Verifique a connection string
fly secrets list

# Teste a conexão
mongosh "mongodb+srv://..."
```

### Erro: Uploads não persistem
```bash
# Verifique se o volume está montado
fly volumes list

# Ou use S3 (recomendado para produção)
fly secrets set STORAGE_MODE=s3
```

### Erro: SECRET_KEY inválida
```bash
# Gere uma nova
python -c "import secrets; print(secrets.token_hex(32))"

# Configure
fly secrets set SECRET_KEY=nova-chave-aqui
```

---

## Comandos Úteis

```bash
# Ver secrets configuradas
fly secrets list

# Reiniciar app
fly apps restart

# Escalar máquinas
fly scale count 2

# SSH na máquina
fly ssh console

# Ver uso de recursos
fly dashboard metrics

# Backup do volume
fly volumes snapshots create biblioteca_uploads
```

---

## Custos Estimados (Fly.io)

- **Máquina básica**: ~$5-10/mês (1 shared-cpu-1x)
- **Volume 10GB**: ~$1.50/mês
- **Bandwidth**: Primeiro 100GB grátis

**MongoDB Atlas**: Gratuito (tier M0)  
**AWS S3**: ~$0.023/GB/mês + transferência

---

## Segurança em Produção

- ✅ Sempre use HTTPS (Fly.io já inclui)
- ✅ Configure `CORS_ORIGINS` com domínios específicos
- ✅ Use secrets para credenciais (nunca no código)
- ✅ Ative MFA no MongoDB Atlas
- ✅ Limite IPs no MongoDB (se possível)
- ✅ Rotacione SECRET_KEY regularmente
- ✅ Faça backups regulares dos volumes

---

## Monitoramento

### Fly.io Dashboard
```bash
fly dashboard
```

### Logs em tempo real
```bash
fly logs --app biblioteca-privada -f
```

### Métricas
```bash
fly status --app biblioteca-privada
```

---

## Atualizações

```bash
# Pull das mudanças
git pull origin main

# Build e deploy
fly deploy

# Verificar versão
fly releases
```

---

🎉 **Pronto!** Sua aplicação está no ar!