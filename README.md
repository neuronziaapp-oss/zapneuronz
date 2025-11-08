# 📱 WhatsApp Web Clone

Uma aplicação web completa que replica a experiência do WhatsApp Web, incluindo chat em tempo real, envio de mídia, notificações e integração completa com Evolution API.

## 🎯 Características Principais

### ✅ MVP Implementado

- 🔐 **Autenticação segura** - Login de administradores/operadores
- 📱 **Gerenciamento de instâncias** - Conectar números WhatsApp via QR Code
- 💬 **Lista de chats** - Preview da última mensagem, horário, contador não lidas
- 📝 **Conversa em tempo real** - Envio/recebimento de texto, imagens, arquivos, áudios
- ⚡ **Atualizações em tempo real** - WebSocket para mensagens e eventos
- 📤 **Envio de mensagens** - Texto, mídia, reply, menções em grupos
- 👁️ **Indicadores de status** - "digitando...", "visto", read receipts
- 📁 **Upload/Download de mídia** - Com armazenamento e streaming
- 🔔 **Notificações** - Notificações do navegador para novas mensagens
- 🔍 **Busca avançada** - Buscar por texto em chats e mensagens
- 📊 **Dashboard e logs** - Painel de health das instâncias e atividades

### 🚀 Recursos Avançados (Próximas versões)

- 👥 **Gestão de grupos** - Criar, gerenciar membros, admin
- 📋 **Templates de mensagem** - Respostas rápidas e automação
- 📈 **Relatórios e analytics** - Estatísticas de uso e performance
- 🤖 **Chatbot básico** - Respostas automáticas e fluxos
- 📧 **Integração CRM** - Conectar com sistemas externos
- 🎨 **Temas personalizáveis** - Dark mode e customização
- 📱 **PWA** - Aplicativo instalável como app nativo

## 🏗️ Arquitetura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │  Evolution API  │
│   (React SPA)   │◄──►│  (Node.js API)  │◄──►│   (WhatsApp)    │
│                 │    │                 │    │                 │
│ • Interface     │    │ • Orquestração  │    │ • Baileys       │
│ • WebSocket     │    │ • Webhooks      │    │ • Cloud API     │
│ • Upload mídia  │    │ • Armazenamento │    │ • QR Connect    │
│ • Notificações  │    │ • Autenticação  │    │ • Mensageria    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┴───────────────────────┘
                        WebSocket + REST API
```

## 📦 Stack Tecnológica

### Backend (Node.js)

- **Framework**: Express.js
- **Banco de dados**: Sequelize ORM (SQLite/PostgreSQL/MySQL)
- **Autenticação**: JWT + bcrypt
- **WebSocket**: Socket.IO
- **Upload**: Multer + Sharp (processamento imagem)
- **Segurança**: Helmet, Rate limiting, CORS
- **API Externa**: Axios (Evolution API)

### Frontend (React)

- **Framework**: Create React App
- **UI/Styling**: Tailwind CSS + Headless UI
- **Estado**: Context API + useReducer
- **WebSocket**: Socket.IO Client
- **HTTP**: Axios
- **Notificações**: React-toastify
- **Ícones**: Heroicons + React Icons
- **Upload**: React-dropzone

### Infraestrutura

- **Evolution API**: Gateway para WhatsApp (Baileys/Cloud API)
- **Reverse Proxy**: Nginx (produção)
- **Process Manager**: PM2 (produção)
- **Monitoramento**: Logs estruturados

## 🚀 Instalação e Setup

### Pré-requisitos

- Node.js 18+ e npm
- Evolution API rodando (Docker recomendado)
- Sistema operacional: Windows/Linux/macOS

### 1. Clone o repositório

```bash
git clone <seu-repositorio>
cd WppWeb
```

### 2. Configure o Backend

```bash
cd backend
npm install
cp .env.example .env
# Edite .env com suas configurações
npm run dev
```

### 3. Configure o Frontend

```bash
cd frontend
npm install
# Configure as variáveis de ambiente
npm start
```

### 4. Evolution API (Docker)

```bash
# Exemplo de docker-compose para Evolution API
version: '3.8'
services:
  evolution-api:
    image: atendai/evolution-api:v2.0.0
    ports:
      - "8080:8080"
    environment:
      - SERVER_URL=http://localhost:8080
      - WEBHOOK_GLOBAL_URL=http://localhost:3001/webhook
    volumes:
      - evolution_data:/evolution/instances
```

## 🔧 Configuração

### Backend (.env)

```env
# Servidor
PORT=3001
NODE_ENV=development
JWT_SECRET=sua_chave_super_secreta_aqui

# Evolution API
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=sua_chave_evolution

# Banco de dados
DB_DIALECT=sqlite
DB_STORAGE=./database.sqlite

# Admin padrão (ALTERE!)
DEFAULT_ADMIN_EMAIL=admin@wppweb.com
DEFAULT_ADMIN_PASSWORD=admin123456
```

### Frontend (.env)

```env
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_SOCKET_URL=http://localhost:3001
REACT_APP_APP_NAME=WhatsApp Web
```

## 📚 Como Usar

### 1. Login Inicial

- Acesse http://localhost:3000
- Use as credenciais do admin padrão:
  - Email: `admin@wppweb.com`
  - Senha: `admin123456`
- **IMPORTANTE**: Altere a senha após primeiro login!

### 2. Criar Instância WhatsApp

1. No dashboard, clique em "Nova Instância"
2. Dê um nome para sua instância
3. Clique em "Conectar" para gerar QR Code
4. Escaneie o QR Code com seu WhatsApp
5. Aguarde a conexão ser estabelecida

### 3. Usar o Chat

- Lista de chats aparecerá automaticamente após sincronização
- Clique em um chat para abrir a conversa
- Digite mensagens normalmente
- Use o botão "+" ao lado do campo de mensagem para anexar documentos, fotos/vídeos, áudios e figurinhas
- Arraste e solte arquivos para enviar mídia rapidamente
- Use @ para mencionar em grupos

### 4. Funcionalidades Avançadas

- **Busca**: Use o campo de busca no topo
- **Arquivar**: Clique com botão direito no chat
- **Fixar**: Use o ícone de alfinete
- **Dashboard**: Veja estatísticas e saúde das instâncias

#### Envio de mídia suportado

A partir desta versão a aplicação consome os endpoints oficiais da Evolution API para envio de:

- 📄 Documentos (`sendMedia` com `mediatype=document`)
- 🖼️ Imagens e 🎞️ vídeos (`sendMedia` com `mediatype=image|video`)
- 🎧 Áudios e mensagens de voz (`sendWhatsAppAudio`)
- 😄 Figurinhas (`sendSticker`)

Basta escolher o tipo no menu de anexos, selecionar o arquivo (URL/base64 é gerado automaticamente) e a mensagem é enviada pela Evolution API mantendo o histórico no chat.

## 🔒 Segurança

### Produção

- [ ] Altere `JWT_SECRET` para valor aleatório forte
- [ ] Altere credenciais do admin padrão
- [ ] Configure HTTPS/SSL
- [ ] Use banco de dados robusto (PostgreSQL)
- [ ] Configure firewall e rate limiting
- [ ] Monitore logs de segurança
- [ ] Backup regular dos dados

### Desenvolvimento

- ✅ Rate limiting configurado
- ✅ Sanitização de entrada
- ✅ Headers de segurança (Helmet)
- ✅ CORS configurado
- ✅ JWT com expiração
- ✅ Senhas hash com bcrypt

## 📊 API Documentation

### Autenticação

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@wppweb.com",
  "password": "admin123456"
}
```

### Enviar Mensagem

```http
POST /api/{instanceId}/chats/{chatId}/messages/text
Authorization: Bearer {token}
Content-Type: application/json

{
  "message": "Olá! Como posso ajudar?",
  "quotedMessageId": null
}
```

### Upload de Mídia

```http
POST /api/{instanceId}/chats/{chatId}/messages/media
Authorization: Bearer {token}
Content-Type: multipart/form-data

media: [file]
caption: "Legenda da mídia"
```

## 🔄 WebSocket Events

### Cliente escuta:

- `new_message` - Nova mensagem recebida
- `message_update` - Status da mensagem alterado
- `connection_update` - Status da instância alterado
- `qrcode_updated` - Novo QR Code disponível
- `presence_update` - Presença do contato (online, digitando)

### Cliente emite:

- `join_instance` - Entrar na sala da instância
- `typing_start` - Começar a digitar
- `typing_stop` - Parar de digitar

## 🐛 Troubleshooting

### Problemas Comuns

**Instância não conecta**

- Verifique se Evolution API está rodando
- Confirme as URLs no .env
- Verifique logs do Evolution API

**QR Code não aparece**

- Limpe cache do navegador
- Verifique conexão com Evolution API
- Tente recriar a instância

**Mensagens não chegam**

- Verifique webhook no Evolution API
- Confirme WebSocket connection
- Verifique logs do backend

**Upload falha**

- Verifique tamanho do arquivo (max 50MB)
- Confirme tipo de arquivo permitido
- Verifique espaço em disco

### Logs e Debug

**Backend logs:**

```bash
# Ver logs em tempo real
cd backend && npm run dev

# Logs estruturados incluem:
# - Conexões WebSocket
# - Atividade das instâncias
# - Erros e exceções
# - Requests HTTP
```

**Frontend logs:**

- Abra DevTools (F12) → Console
- Erros de network na aba Network
- Estado do WebSocket em Application → Storage

## 🚀 Deploy em Produção

### Usando PM2 + Nginx

**1. Preparar aplicação:**

```bash
# Build do frontend
cd frontend && npm run build

# Configurar backend para produção
cd backend
cp .env.example .env.production
# Configure variáveis para produção
```

**2. PM2 Process Manager:**

```bash
npm install -g pm2

# Iniciar backend
cd backend
pm2 start src/server.js --name "whatsapp-backend"

# Servir frontend com PM2
pm2 serve frontend/build 3000 --name "whatsapp-frontend"

pm2 startup
pm2 save
```

**3. Nginx Reverse Proxy:**

```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # API Backend
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Docker (Opcional)

**Backend Dockerfile:**

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

**docker-compose.yml:**

```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - '3001:3001'
    environment:
      - NODE_ENV=production
    volumes:
      - uploads:/app/uploads
      - ./backend/.env:/app/.env

  frontend:
    build: ./frontend
    ports:
      - '3000:3000'
    depends_on:
      - backend

  evolution:
    image: atendai/evolution-api:v2.0.0
    ports:
      - '8080:8080'
    environment:
      - WEBHOOK_GLOBAL_URL=http://backend:3001/webhook

volumes:
  uploads:
```

## 🤝 Contribuição

### Como contribuir:

1. Fork o projeto
2. Crie sua branch (`git checkout -b feature/NovaFeature`)
3. Commit suas mudanças (`git commit -m 'Add: Nova feature'`)
4. Push para a branch (`git push origin feature/NovaFeature`)
5. Abra um Pull Request

### Padrões do código:

- Use ESLint + Prettier
- Comentários em português
- Nomes de variáveis descritivos
- Commits semânticos (Add/Fix/Update/Remove)

### Roadmap futuro:

- [ ] Testes unitários (Jest + React Testing Library)
- [ ] Migração para TypeScript
- [ ] Kubernetes deployment
- [ ] Multi-tenancy (SaaS)
- [ ] API GraphQL
- [ ] Integração WhatsApp Business API
- [ ] AI/ML para análise de sentimentos

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

## 🆘 Suporte

Para dúvidas ou suporte:

1. **Issues**: Abra uma issue no GitHub
2. **Documentação**: Consulte os READMEs específicos em `/backend` e `/frontend`
3. **Evolution API**: [Documentação oficial](https://doc.evolution-api.com/)

---

**⭐ Se este projeto foi útil, considere dar uma estrela!**
