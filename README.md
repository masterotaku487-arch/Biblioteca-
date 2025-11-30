# 📚 Biblioteca Privada

Sistema completo de compartilhamento privado de arquivos com chat em tempo real.

## 🚀 Tecnologias

- **Backend**: FastAPI (Python 3.11+)
- **Frontend**: React 18
- **Database**: MongoDB
- **Storage**: Local ou AWS S3
- **WebSocket**: Chat em tempo real
- **Autenticação**: JWT + bcrypt

## ✨ Funcionalidades

### Para Usuários:
- ✅ Registro e login seguro
- ✅ Upload de arquivos com proteção por senha
- ✅ Download dos próprios arquivos
- ✅ Chat em tempo real (quando habilitado)
- ✅ Dashboard com estatísticas pessoais

### Para Administradores:
- ✅ Painel admin completo
- ✅ Gerenciamento de usuários
- ✅ Visualização de todos os arquivos
- ✅ Download em lote (backup completo)
- ✅ Controle do chat (habilitar/desabilitar)
- ✅ Download do código fonte
- ✅ Estatísticas globais do sistema

## 📋 Pré-requisitos

- Python 3.11+
- Node.js 18+
- MongoDB 5.0+
- (Opcional) Conta AWS para S3

## 🔧 Instalação

### 1. Clone o repositório

```bash
git clone <seu-repositorio>
cd codigo_fonte_site
```

### 2. Configure o Backend

```bash
cd backend

# Instale as dependências
pip install -r requirements.txt

# Crie o arquivo .env
# Copie o conteúdo de .env.example e ajuste as configurações
```

**Arquivo `.env` mínimo:**
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=biblioteca
SECRET_KEY=sua-chave-secreta-64-caracteres
STORAGE_MODE=local
UPLOAD_DIR=/app/uploads
CORS_ORIGINS=*
```

### 3. Configure o Frontend

```bash
cd frontend

# Instale as dependências
npm install
# ou
yarn install
```

### 4. Inicie o MongoDB

```bash
# Via Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Ou inicie o serviço local
mongod
```

### 5. Execute a aplicação

**Backend:**
```bash
cd backend
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

**Frontend (desenvolvimento):**
```bash
cd frontend
npm start
# ou
yarn start
```

Acesse: `http://localhost:3000`

## 🐳 Docker (Opcional)

Se você já tem `docker-compose.yml`:

```bash
docker-compose up -d
```

## 🔐 Credenciais Padrão

**Admin:**
- Usuário: `Masterotaku`
- Senha: `******`

⚠️ **IMPORTANTE**: Altere a senha do admin após o primeiro login!

## ☁️ Configuração AWS S3 (Opcional)

Para usar armazenamento em nuvem:

1. Crie um bucket no AWS S3
2. Crie um usuário IAM com permissões S3
3. Configure no `.env`:

```env
STORAGE_MODE=s3
S3_BUCKET=seu-bucket-nome
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=sua-chave
AWS_SECRET_ACCESS_KEY=sua-chave-secreta
```

## 📁 Estrutura do Projeto

```
codigo_fonte_site/
├── backend/
│   ├── server.py              # API principal
│   ├── static_server.py       # Servidor de arquivos estáticos
│   ├── requirements.txt       # Dependências Python
│   └── .env                   # Configurações (não commitar!)
│
├── frontend/
│   ├── src/
│   │   ├── pages/            # Páginas React
│   │   ├── components/       # Componentes reutilizáveis
│   │   ├── lib/              # Funções auxiliares
│   │   └── hooks/            # Custom hooks
│   ├── public/               # Arquivos públicos
│   └── package.json          # Dependências Node
│
├── .gitignore               # Arquivos ignorados pelo Git
├── README.md                # Este arquivo
└── docker-compose.yml       # Configuração Docker (se existir)
```

## 🔒 Segurança

- ✅ Senhas hasheadas com bcrypt
- ✅ Autenticação JWT
- ✅ Proteção de rotas admin
- ✅ Arquivos protegidos por senha (opcional)
- ✅ CORS configurável
- ✅ Validação de permissões

⚠️ **Nunca commite o arquivo `.env`** - ele contém credenciais sensíveis!

## 🛠️ Desenvolvimento

### Backend (FastAPI)
```bash
cd backend
uvicorn server:app --reload --port 8000
```

### Frontend (React)
```bash
cd frontend
npm start
```

### Build de Produção
```bash
cd frontend
npm run build
```

O build será servido pelo FastAPI automaticamente.

## 📊 API Endpoints

### Autenticação
- `POST /api/auth/register` - Registro de usuário
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Usuário atual

### Arquivos
- `POST /api/files/upload` - Upload de arquivo
- `GET /api/files` - Listar arquivos
- `GET /api/files/{id}/download` - Download
- `DELETE /api/files/{id}` - Deletar (admin)

### Chat
- `GET /api/chat/messages` - Mensagens
- `WS /api/ws/chat` - WebSocket

### Admin
- `GET /api/admin/users` - Listar usuários
- `GET /api/admin/stats` - Estatísticas
- `POST /api/admin/chat/toggle` - Habilitar/desabilitar chat
- `GET /api/admin/download-all` - Backup completo

## 🐛 Troubleshooting

### MongoDB não conecta
```bash
# Verifique se está rodando
docker ps | grep mongo
# ou
systemctl status mongod
```

### Erro de CORS
Configure `CORS_ORIGINS` no `.env` com seus domínios:
```env
CORS_ORIGINS=http://localhost:3000,https://seudominio.com
```

### Arquivos não aparecem após reiniciar
Use `STORAGE_MODE=s3` para persistência permanente ou configure volumes Docker.

## 📝 TODO / Melhorias Futuras

- [ ] Migração automática de arquivos local → S3
- [ ] Suporte a múltiplos buckets S3
- [ ] Preview de imagens/PDFs
- [ ] Compartilhamento de arquivos via link
- [ ] Sistema de notificações
- [ ] Logs de auditoria

## 👨‍💻 Desenvolvido por

**Masterotaku**

## 📄 Licença

Este projeto é privado. Todos os direitos reservados.

---

⭐ Se você gostou do projeto, considere dar uma estrela!
