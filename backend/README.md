# WhatsApp Web Backend

Backend para aplicação WhatsApp Web usando Evolution API como gateway para Baileys/Cloud API.

## 🚀 Características

- ✅ Autenticação JWT segura
- ✅ Gerenciamento de instâncias WhatsApp
- ✅ Envio/recebimento de mensagens em tempo real
- ✅ Upload/download de mídia
- ✅ WebSocket para atualizações em tempo real
- ✅ Webhooks do Evolution API
- ✅ Busca de mensagens e chats
- ✅ Dashboard com estatísticas
- ✅ Rate limiting e segurança
- ✅ Banco de dados SQLite (pode ser alterado)

## 🛠️ Instalação

1. **Clone e instale dependências:**

```bash
cd backend
npm install
```

2. **Configure variáveis de ambiente:**

```bash
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

3. **Inicie o servidor:**

```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

## 📋 Variáveis de Ambiente

### Servidor

- `PORT`: Porta do servidor (padrão: 3001)
- `NODE_ENV`: Ambiente (development/production)
- `JWT_SECRET`: Chave secreta para JWT (ALTERE EM PRODUÇÃO!)

### Evolution API

- `EVOLUTION_API_URL`: URL da Evolution API (ex: http://localhost:8080)
- `EVOLUTION_API_KEY`: Chave da Evolution API

### Banco de Dados

- `DB_DIALECT`: Tipo do banco (sqlite/postgres/mysql)
- `DB_STORAGE`: Arquivo SQLite (se usando SQLite)

### Segurança

- `BCRYPT_ROUNDS`: Rounds do bcrypt (padrão: 12)
- `SESSION_TIMEOUT`: Tempo de sessão JWT (padrão: 24h)

### Admin Padrão

- `DEFAULT_ADMIN_EMAIL`: Email do admin inicial
- `DEFAULT_ADMIN_PASSWORD`: Senha do admin inicial (ALTERE!)

## 🔗 API Endpoints

### Autenticação

- `POST /api/auth/login` - Login
- `GET /api/auth/verify` - Verificar token
- `PUT /api/auth/change-password` - Alterar senha
- `POST /api/auth/users` - Criar usuário (admin)
- `GET /api/auth/users` - Listar usuários (admin)

### Instâncias

- `POST /api/instances` - Criar instância
- `GET /api/instances` - Listar instâncias
- `GET /api/instances/:id` - Detalhes da instância
- `POST /api/instances/:id/connect` - Conectar instância
- `GET /api/instances/:id/qrcode` - Obter QR Code
- `POST /api/instances/:id/disconnect` - Desconectar
- `DELETE /api/instances/:id` - Deletar instância

### Chats

- `GET /api/:instanceId/chats` - Listar chats
- `POST /api/:instanceId/chats/sync` - Sincronizar chats
- `PUT /api/:instanceId/chats/:chatId/read` - Marcar como lido
- `PUT /api/:instanceId/chats/:chatId/archive` - Arquivar/desarquivar
- `PUT /api/:instanceId/chats/:chatId/pin` - Fixar/desfixar

### Mensagens

- `GET /api/:instanceId/chats/:chatId/messages` - Listar mensagens
- `POST /api/:instanceId/chats/:chatId/messages/text` - Enviar texto
- `POST /api/:instanceId/chats/:chatId/messages/media` - Enviar mídia
- `POST /api/:instanceId/messages/send-media` - Enviar mídia (URL/base64)
- `POST /api/:instanceId/messages/send-audio` - Enviar áudio/voz (URL/base64)
- `POST /api/:instanceId/messages/send-sticker` - Enviar figurinha (URL/base64)
- `GET /api/:instanceId/messages/search` - Buscar mensagens
- `GET /api/:instanceId/messages/:messageId/media` - Download mídia

### Dashboard

- `GET /api/dashboard/stats` - Estatísticas gerais
- `GET /api/dashboard/health` - Health check instâncias
- `GET /api/dashboard/activity` - Atividade recente
- `GET /api/dashboard/usage-report` - Relatório de uso (admin)

### Webhooks

- `POST /webhook/:instanceName` - Receber webhooks Evolution API

## 🔧 Estrutura do Projeto

```
backend/
├── src/
│   ├── config/
│   │   └── database.js          # Configuração do banco
│   ├── controllers/
│   │   ├── AuthController.js    # Autenticação
│   │   ├── InstanceController.js # Instâncias
│   │   ├── ChatController.js    # Chats
│   │   ├── MessageController.js # Mensagens
│   │   └── WebhookController.js # Webhooks
│   ├── middleware/
│   │   ├── auth.js             # Autenticação JWT
│   │   └── upload.js           # Upload de arquivos
│   ├── models/
│   │   ├── User.js             # Usuários
│   │   ├── Instance.js         # Instâncias WhatsApp
│   │   ├── Contact.js          # Contatos
│   │   ├── Chat.js            # Chats
│   │   ├── Message.js         # Mensagens
│   │   └── index.js           # Relacionamentos
│   ├── routes/
│   │   ├── auth.js            # Rotas de autenticação
│   │   ├── instances.js       # Rotas de instâncias
│   │   ├── chats.js          # Rotas de chats
│   │   ├── messages.js       # Rotas de mensagens
│   │   ├── webhook.js        # Rotas de webhook
│   │   └── dashboard.js      # Rotas de dashboard
│   ├── services/
│   │   ├── evolutionApi.js   # Cliente Evolution API
│   │   └── socket.js         # WebSocket
│   └── server.js             # Servidor principal
├── uploads/                   # Arquivos de mídia
├── .env.example              # Exemplo de configuração
├── .gitignore               # Arquivos ignorados
├── package.json             # Dependências
└── README.md               # Este arquivo
```

## 🔄 WebSocket Events

### Cliente -> Servidor

- `join_instance(instanceId)` - Entrar na sala da instância
- `leave_instance(instanceId)` - Sair da sala da instância
- `typing_start({instanceId, chatId})` - Começar a digitar
- `typing_stop({instanceId, chatId})` - Parar de digitar
- `message_seen({instanceId, messageId})` - Marcar como visto

### Servidor -> Cliente

- `qrcode_updated` - QR Code atualizado
- `connection_update` - Status da conexão alterado
- `new_message` - Nova mensagem recebida
- `message_update` - Status da mensagem alterado
- `new_notification` - Nova notificação
- `presence_update` - Presença atualizada (online, digitando, etc.)

## 🛡️ Segurança

- JWT para autenticação
- Rate limiting
- Helmet para headers de segurança
- Validação de entrada
- Sanitização de dados
- CORS configurado
- Upload com validação de tipos

## 📊 Banco de Dados

O sistema usa Sequelize ORM com SQLite por padrão. Pode ser alterado para PostgreSQL, MySQL, etc.

### Tabelas:

- **Users**: Usuários do sistema (admin/operator)
- **Instances**: Instâncias WhatsApp conectadas
- **Contacts**: Contatos e grupos
- **Chats**: Conversas/chats
- **Messages**: Mensagens enviadas/recebidas

## 🚀 Deploy em Produção

1. **Configure variáveis de ambiente seguras**
2. **Use banco de dados robusto (PostgreSQL recomendado)**
3. **Configure SSL/HTTPS**
4. **Use processo manager (PM2)**
5. **Configure proxy reverso (Nginx)**
6. **Monitore logs e performance**

### Exemplo PM2:

```bash
npm install -g pm2
pm2 start src/server.js --name "whatsapp-backend"
pm2 startup
pm2 save
```

## 🔧 Desenvolvimento

### Scripts disponíveis:

```bash
npm run dev      # Desenvolvimento com nodemon
npm start        # Produção
npm test         # Executar testes (quando implementados)
```

### Estrutura de logs:

- Conexões WebSocket
- Atividade das instâncias
- Erros e exceções
- Requests HTTP (em desenvolvimento)

## 🤝 Contribuição

1. Fork o projeto
2. Crie sua branch (`git checkout -b feature/NovaFeature`)
3. Commit suas mudanças (`git commit -m 'Add: Nova feature'`)
4. Push para a branch (`git push origin feature/NovaFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo LICENSE para mais detalhes.
