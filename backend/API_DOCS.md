# Documentação da API - Backend WhatsApp Web

> **Versão:** 1.0.0  
> **Idioma:** Português (Brasil)  
> **Última Atualização:** 27 de Outubro de 2025

## 📋 Sumário

- [Visão Geral](#visão-geral)
- [Autenticação](#autenticação)
- [Endpoints](#endpoints)
  - [Autenticação](#endpoints-de-autenticação)
  - [Instâncias](#endpoints-de-instâncias)
  - [Chats](#endpoints-de-chats)
  - [Mensagens](#endpoints-de-mensagens)
  - [Webhooks](#endpoints-de-webhooks)
  - [Dashboard](#endpoints-de-dashboard)
- [Códigos de Status](#códigos-de-status-http)
- [Exemplos de Uso](#exemplos-de-uso)
- [Rate Limiting](#rate-limiting)
- [Tratamento de Erros](#tratamento-de-erros)

---

## 🌐 Visão Geral

Esta API REST permite integração completa com o WhatsApp através do Evolution API, oferecendo gerenciamento de instâncias, envio e recebimento de mensagens, gerenciamento de chats e muito mais.

### Base URL

**Desenvolvimento:**
```
http://localhost:3001/api
```

**Produção:**
```
https://seu-dominio.com.br/api
```

### Formato das Requisições

- **Content-Type:** `application/json`
- **Encoding:** UTF-8
- **Método de Autenticação:** Bearer Token (JWT) ou API Key

---

## 🔐 Autenticação

A API utiliza dois métodos de autenticação:

### 1. JWT (JSON Web Token)
Usado para autenticação de usuários do sistema.

```http
Authorization: Bearer {seu_token_jwt}
```

### 2. API Key (Modo Iframe)
Usado para integração de clientes externos.

```http
x-api-key: {sua_api_key}
```

### Obter Token JWT

**Endpoint:** `POST /auth/login`

**Corpo da Requisição:**
```json
{
  "email": "usuario@exemplo.com",
  "password": "senha123"
}
```

**Resposta de Sucesso:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-do-usuario",
    "name": "Nome do Usuário",
    "email": "usuario@exemplo.com",
    "role": "admin"
  }
}
```

---

## 📡 Endpoints de Autenticação

### Login

Autentica um usuário e retorna um token JWT.

```http
POST /auth/login
```

**Parâmetros do Corpo:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| email | string | Sim | Email do usuário |
| password | string | Sim | Senha do usuário |

**Exemplo de Requisição:**
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@exemplo.com",
    "password": "senha123"
  }'
```

**Resposta (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "aee9c880-9205-4c76-b260-062f6772af16",
    "name": "Administrador",
    "email": "admin@exemplo.com",
    "role": "admin"
  }
}
```

---

### Registrar Usuário

Cria um novo usuário no sistema (apenas se o registro estiver habilitado).

```http
POST /auth/register
```

**Parâmetros do Corpo:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| name | string | Sim | Nome completo do usuário |
| email | string | Sim | Email do usuário |
| password | string | Sim | Senha (mínimo 6 caracteres) |

**Exemplo de Requisição:**
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Novo Usuário",
    "email": "novo@exemplo.com",
    "password": "senha123"
  }'
```

**Resposta (201 Created):**
```json
{
  "message": "Usuário criado com sucesso",
  "user": {
    "id": "uuid-gerado",
    "name": "Novo Usuário",
    "email": "novo@exemplo.com",
    "role": "user"
  }
}
```

---

### Verificar Token

Valida o token JWT e retorna os dados do usuário autenticado.

```http
GET /auth/verify
```

**Headers Obrigatórios:**
```
Authorization: Bearer {token}
```

**Resposta (200 OK):**
```json
{
  "user": {
    "id": "uuid-do-usuario",
    "name": "Nome do Usuário",
    "email": "usuario@exemplo.com",
    "role": "admin"
  }
}
```

---

### Obter Token Iframe

Retorna um token JWT para autenticação no modo iframe.

```http
GET /auth/iframe-token
```

**Resposta (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "aee9c880-9205-4c76-b260-062f6772af16",
    "name": "Agent Web Interface",
    "email": "agent-iframe@neurons.local",
    "role": "admin"
  }
}
```

---

### Status do Registro

Verifica se o registro de novos usuários está habilitado.

```http
GET /auth/registration-status
```

**Resposta (200 OK):**
```json
{
  "enabled": true,
  "iframeMode": false
}
```

---

### Alterar Senha

Permite que o usuário autenticado altere sua senha.

```http
PUT /auth/change-password
```

**Headers Obrigatórios:**
```
Authorization: Bearer {token}
```

**Parâmetros do Corpo:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| currentPassword | string | Sim | Senha atual |
| newPassword | string | Sim | Nova senha |

**Exemplo de Requisição:**
```bash
curl -X PUT http://localhost:3001/api/auth/change-password \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "senha123",
    "newPassword": "novaSenha456"
  }'
```

---

### Criar Usuário (Admin)

Cria um novo usuário (requer permissões de administrador).

```http
POST /auth/users
```

**Headers Obrigatórios:**
```
Authorization: Bearer {token_admin}
```

**Parâmetros do Corpo:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| name | string | Sim | Nome do usuário |
| email | string | Sim | Email do usuário |
| password | string | Sim | Senha |
| role | string | Não | Papel (user/admin) - Padrão: user |

---

### Listar Usuários (Admin)

Lista todos os usuários do sistema.

```http
GET /auth/users
```

**Headers Obrigatórios:**
```
Authorization: Bearer {token_admin}
```

**Resposta (200 OK):**
```json
{
  "users": [
    {
      "id": "uuid-1",
      "name": "Usuário 1",
      "email": "user1@exemplo.com",
      "role": "user",
      "is_active": true,
      "created_at": "2025-01-15T10:00:00.000Z"
    },
    {
      "id": "uuid-2",
      "name": "Usuário 2",
      "email": "user2@exemplo.com",
      "role": "admin",
      "is_active": true,
      "created_at": "2025-01-16T14:30:00.000Z"
    }
  ]
}
```

---

### Ativar/Desativar Usuário (Admin)

Alterna o status de ativo/inativo de um usuário.

```http
PUT /auth/users/:id/toggle-status
```

**Headers Obrigatórios:**
```
Authorization: Bearer {token_admin}
```

**Parâmetros da URL:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| id | string | UUID do usuário |

---

### Autenticar Cliente (Multi-tenancy)

Autentica um cliente externo usando client_id e client_secret.

```http
POST /auth/client/authenticate
```

**Parâmetros do Corpo:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| client_id | string | Sim | ID do cliente |
| client_secret | string | Sim | Chave secreta do cliente |

**Resposta (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "client": {
    "id": "uuid-do-cliente",
    "name": "Nome do Cliente",
    "client_id": "client_abc123"
  }
}
```

---

### Validar Cliente (Multi-tenancy)

Valida o token de um cliente.

```http
GET /auth/client/validate
```

**Headers Obrigatórios:**
```
Authorization: Bearer {token_cliente}
```

---

## 📱 Endpoints de Instâncias

### Criar Instância

Cria uma nova instância do WhatsApp.

```http
POST /instances
```

**Headers Obrigatórios:**
```
Authorization: Bearer {token}
```

**Parâmetros do Corpo:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| name | string | Sim | Nome da instância |

**Exemplo de Requisição:**
```bash
curl -X POST http://localhost:3001/api/instances \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Minha Instância"
  }'
```

**Resposta (201 Created):**
```json
{
  "id": "uuid-da-instancia",
  "name": "Minha Instância",
  "instance_name": "minha_instancia_abc123_1698420000",
  "status": "disconnected",
  "qr_code": null,
  "webhook_url": "https://seu-webhook.com/minha_instancia_abc123_1698420000",
  "created_at": "2025-10-27T10:00:00.000Z"
}
```

---

### Listar Instâncias

Lista todas as instâncias do usuário autenticado.

```http
GET /instances
```

**Headers Obrigatórios:**
```
Authorization: Bearer {token}
```

**Parâmetros de Query:**

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| page | number | 1 | Número da página |
| limit | number | 10 | Itens por página |

**Resposta (200 OK):**
```json
{
  "instances": [
    {
      "id": "uuid-1",
      "name": "Instância 1",
      "instance_name": "instancia_1_abc123",
      "status": "connected",
      "profile_name": "João Silva",
      "profile_picture_url": "https://...",
      "phone_number": "5511999999999",
      "created_at": "2025-10-27T10:00:00.000Z",
      "updated_at": "2025-10-27T11:30:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 3,
    "totalInstances": 25,
    "limit": 10
  }
}
```

---

### Obter Instância

Retorna os detalhes de uma instância específica.

```http
GET /instances/:id
```

**Parâmetros da URL:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| id | string | UUID da instância |

**Resposta (200 OK):**
```json
{
  "id": "uuid-da-instancia",
  "name": "Minha Instância",
  "instance_name": "minha_instancia_abc123",
  "status": "connected",
  "profile_name": "João Silva",
  "profile_picture_url": "https://...",
  "phone_number": "5511999999999",
  "webhook_url": "https://seu-webhook.com/...",
  "created_at": "2025-10-27T10:00:00.000Z",
  "updated_at": "2025-10-27T11:30:00.000Z"
}
```

---

### Conectar Instância

Inicia o processo de conexão da instância ao WhatsApp.

```http
POST /instances/:id/connect
```

**Parâmetros da URL:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| id | string | UUID da instância |

**Resposta (200 OK):**
```json
{
  "message": "Conexão iniciada com sucesso",
  "qrCode": {
    "code": "2@...",
    "base64": "data:image/png;base64,iVBORw0KGgo..."
  }
}
```

---

### Obter QR Code

Retorna o QR Code para autenticação da instância.

```http
GET /instances/:id/qrcode
```

**Parâmetros da URL:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| id | string | UUID da instância |

**Resposta (200 OK):**
```json
{
  "qrCode": {
    "code": "2@...",
    "base64": "data:image/png;base64,iVBORw0KGgo..."
  }
}
```

**Resposta (404):** Se não houver QR Code disponível
```json
{
  "error": "QR Code não disponível"
}
```

---

### Obter Status da Conexão

Retorna o status atual da conexão da instância.

```http
GET /instances/:id/status
```

**Parâmetros da URL:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| id | string | UUID da instância |

**Resposta (200 OK):**
```json
{
  "state": "open",
  "status": "connected"
}
```

**Possíveis valores de status:**
- `disconnected` - Desconectado
- `connecting` - Conectando
- `connected` - Conectado
- `error` - Erro na conexão

---

### Desconectar Instância

Desconecta a instância do WhatsApp.

```http
POST /instances/:id/disconnect
```

**Parâmetros da URL:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| id | string | UUID da instância |

**Resposta (200 OK):**
```json
{
  "message": "Instância desconectada com sucesso"
}
```

---

### Excluir Instância

Exclui permanentemente uma instância.

```http
DELETE /instances/:id
```

**Parâmetros da URL:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| id | string | UUID da instância |

**Resposta (200 OK):**
```json
{
  "message": "Instância excluída com sucesso"
}
```

---

### Obter Informações do Perfil

Retorna as informações do perfil WhatsApp da instância.

```http
GET /instances/:id/profile
```

**Parâmetros da URL:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| id | string | UUID da instância |

**Resposta (200 OK):**
```json
{
  "name": "João Silva",
  "number": "5511999999999",
  "profilePictureUrl": "https://...",
  "status": "Olá! Estou usando WhatsApp."
}
```

---

### Listar Contatos

Lista todos os contatos da instância.

```http
GET /instances/:id/contacts
```

**Parâmetros da URL:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| id | string | UUID da instância |

**Resposta (200 OK):**
```json
{
  "contacts": [
    {
      "id": "5511999999999@s.whatsapp.net",
      "name": "João Silva",
      "pushName": "João",
      "profilePictureUrl": "https://...",
      "isGroup": false
    }
  ]
}
```

---

### Sincronizar Dados da Instância

Sincroniza todos os dados (chats, contatos, mensagens) da instância.

```http
POST /instances/:id/sync
```

**Parâmetros da URL:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| id | string | UUID da instância |

**Resposta (200 OK):**
```json
{
  "message": "Sincronização iniciada com sucesso",
  "syncId": "sync-uuid-123"
}
```

---

### Verificar Webhook

Verifica o status do webhook da instância.

```http
GET /instances/:id/webhook
```

**Parâmetros da URL:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| id | string | UUID da instância |

**Resposta (200 OK):**
```json
{
  "webhookUrl": "https://seu-webhook.com/...",
  "configured": true,
  "lastCheck": "2025-10-27T12:00:00.000Z"
}
```

---

### Reconfigurar Webhook

Reconfigura o webhook da instância.

```http
POST /instances/:id/webhook/reconfigure
```

**Parâmetros da URL:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| id | string | UUID da instância |

**Resposta (200 OK):**
```json
{
  "message": "Webhook reconfigurado com sucesso",
  "webhookUrl": "https://novo-webhook.com/..."
}
```

---

### Recriar Instância

Recria a instância no Evolution API (útil para resolver problemas).

```http
POST /instances/:id/recreate
```

**Parâmetros da URL:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| id | string | UUID da instância |

**Resposta (200 OK):**
```json
{
  "message": "Instância recriada com sucesso",
  "instance": {
    "id": "uuid-da-instancia",
    "name": "Minha Instância",
    "status": "disconnected"
  }
}
```

---

### Limpar Instâncias Órfãs (Admin)

Remove instâncias órfãs do Evolution API que não estão no banco de dados.

```http
GET /instances/admin/cleanup-orphaned
```

**Headers Obrigatórios:**
```
Authorization: Bearer {token_admin}
```

**Resposta (200 OK):**
```json
{
  "message": "Limpeza concluída",
  "deleted": [
    "instancia_orfao_1",
    "instancia_orfao_2"
  ],
  "count": 2
}
```

---

## 💬 Endpoints de Chats

### Listar Chats

Lista todos os chats de uma instância.

```http
GET /:instanceId/chats
```

**Parâmetros da URL:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| instanceId | string | UUID da instância |

**Parâmetros de Query:**

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| page | number | 1 | Número da página |
| limit | number | 50 | Itens por página (máx: 200) |
| search | string | - | Buscar por nome ou número |
| archived | boolean | false | Incluir arquivados |

**Exemplo de Requisição:**
```bash
curl -X GET "http://localhost:3001/api/uuid-instancia/chats?page=1&limit=20" \
  -H "Authorization: Bearer {token}"
```

**Resposta (200 OK):**
```json
{
  "chats": [
    {
      "id": "5511999999999@s.whatsapp.net",
      "name": "João Silva",
      "lastMessage": "Olá, tudo bem?",
      "lastMessageTime": "2025-10-27T14:30:00.000Z",
      "unreadCount": 3,
      "isGroup": false,
      "isArchived": false,
      "isPinned": false,
      "profilePictureUrl": "https://...",
      "contact": {
        "name": "João Silva",
        "pushName": "João",
        "isMyContact": true
      }
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalChats": 95,
    "limit": 20
  }
}
```

---

### Obter Chat Ativo

Retorna o chat atualmente ativo/selecionado pelo usuário.

```http
GET /:instanceId/chats/active
```

**Parâmetros da URL:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| instanceId | string | UUID da instância |

**Resposta (200 OK):**
```json
{
  "activeChatId": "5511999999999@s.whatsapp.net",
  "chat": {
    "id": "5511999999999@s.whatsapp.net",
    "name": "João Silva",
    "isGroup": false,
    "profilePictureUrl": "https://..."
  }
}
```

**Resposta (404):** Se não houver chat ativo
```json
{
  "activeChatId": null
}
```

---

### Definir Chat Ativo

Define qual chat está ativo/selecionado no momento.

```http
PUT /:instanceId/chats/:chatId/active
```

**Parâmetros da URL:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| instanceId | string | UUID da instância |
| chatId | string | ID do chat (ex: 5511999999999@s.whatsapp.net) |

**Resposta (200 OK):**
```json
{
  "message": "Chat ativo atualizado com sucesso",
  "activeChatId": "5511999999999@s.whatsapp.net"
}
```

---

### Sincronizar Chats

Sincroniza todos os chats da instância com o WhatsApp.

```http
POST /:instanceId/chats/sync
```

**Parâmetros da URL:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| instanceId | string | UUID da instância |

**Parâmetros do Corpo (Opcionais):**

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| fullSync | boolean | false | Sincronização completa ou apenas novos |

**Resposta (200 OK):**
```json
{
  "message": "Sincronização de chats iniciada",
  "syncId": "sync-uuid-123",
  "estimatedTime": "5 minutos"
}
```

---

### Obter Chat Específico

Retorna os detalhes de um chat específico.

```http
GET /:instanceId/chats/:chatId
```

**Parâmetros da URL:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| instanceId | string | UUID da instância |
| chatId | string | ID do chat |

**Resposta (200 OK):**
```json
{
  "id": "5511999999999@s.whatsapp.net",
  "name": "João Silva",
  "lastMessage": "Olá, tudo bem?",
  "lastMessageTime": "2025-10-27T14:30:00.000Z",
  "unreadCount": 3,
  "isGroup": false,
  "isArchived": false,
  "isPinned": false,
  "profilePictureUrl": "https://...",
  "contact": {
    "name": "João Silva",
    "pushName": "João",
    "number": "5511999999999",
    "isMyContact": true
  },
  "groupMetadata": null
}
```

---

### Marcar Como Lido

Marca todas as mensagens de um chat como lidas.

```http
PUT /:instanceId/chats/:chatId/read
```

**Parâmetros da URL:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| instanceId | string | UUID da instância |
| chatId | string | ID do chat |

**Resposta (200 OK):**
```json
{
  "message": "Chat marcado como lido",
  "chatId": "5511999999999@s.whatsapp.net",
  "unreadCount": 0
}
```

---

### Arquivar/Desarquivar Chat

Arquiva ou desarquiva um chat.

```http
PUT /:instanceId/chats/:chatId/archive
```

**Parâmetros da URL:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| instanceId | string | UUID da instância |
| chatId | string | ID do chat |

**Parâmetros do Corpo:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| archive | boolean | Sim | true para arquivar, false para desarquivar |

**Exemplo de Requisição:**
```bash
curl -X PUT "http://localhost:3001/api/uuid-instancia/chats/5511999999999@s.whatsapp.net/archive" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"archive": true}'
```

**Resposta (200 OK):**
```json
{
  "message": "Chat arquivado com sucesso",
  "chatId": "5511999999999@s.whatsapp.net",
  "isArchived": true
}
```

---

### Fixar/Desafixar Chat

Fixa ou desafixa um chat no topo da lista.

```http
PUT /:instanceId/chats/:chatId/pin
```

**Parâmetros da URL:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| instanceId | string | UUID da instância |
| chatId | string | ID do chat |

**Parâmetros do Corpo:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| pin | boolean | Sim | true para fixar, false para desafixar |

**Resposta (200 OK):**
```json
{
  "message": "Chat fixado com sucesso",
  "chatId": "5511999999999@s.whatsapp.net",
  "isPinned": true
}
```

---

### Definir Presença

Define o status de presença no chat (digitando, gravando áudio, online).

```http
POST /:instanceId/chats/:chatId/presence
```

**Parâmetros da URL:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| instanceId | string | UUID da instância |
| chatId | string | ID do chat |

**Parâmetros do Corpo:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| presence | string | Sim | available, composing, recording, paused |

**Exemplo de Requisição:**
```bash
curl -X POST "http://localhost:3001/api/uuid-instancia/chats/5511999999999@s.whatsapp.net/presence" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"presence": "composing"}'
```

**Resposta (200 OK):**
```json
{
  "message": "Presença atualizada",
  "presence": "composing"
}
```

**Valores de presença:**
- `available` - Online/disponível
- `composing` - Digitando
- `recording` - Gravando áudio
- `paused` - Pausado

---

## 📨 Endpoints de Mensagens

### Listar Mensagens

Lista as mensagens de um chat específico.

```http
GET /:instanceId/chats/:chatId/messages
```

**Parâmetros da URL:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| instanceId | string | UUID da instância |
| chatId | string | ID do chat |

**Parâmetros de Query:**

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| page | number | 1 | Número da página |
| limit | number | 50 | Mensagens por página (máx: 200) |
| search | string | - | Buscar mensagens por conteúdo |

**Exemplo de Requisição:**
```bash
curl -X GET "http://localhost:3001/api/uuid-instancia/chats/5511999999999@s.whatsapp.net/messages?page=1&limit=50" \
  -H "Authorization: Bearer {token}"
```

**Resposta (200 OK):**
```json
{
  "messages": [
    {
      "id": "msg-uuid-1",
      "messageId": "BAE5...",
      "fromMe": false,
      "content": "Olá! Como vai?",
      "messageType": "text",
      "timestamp": "2025-10-27T14:30:00.000Z",
      "status": "read",
      "participant": null,
      "participantName": null,
      "quotedMessage": null,
      "mediaUrl": null,
      "location": null
    },
    {
      "id": "msg-uuid-2",
      "messageId": "BAE6...",
      "fromMe": true,
      "content": "Tudo ótimo! E você?",
      "messageType": "text",
      "timestamp": "2025-10-27T14:31:00.000Z",
      "status": "read",
      "participant": null,
      "participantName": null,
      "quotedMessage": null,
      "mediaUrl": null,
      "location": null
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 10,
    "totalMessages": 487,
    "limit": 50
  }
}
```

---

### Sincronizar Mensagens

Sincroniza as mensagens de um chat específico.

```http
POST /:instanceId/chats/:chatId/messages/sync
```

**Parâmetros da URL:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| instanceId | string | UUID da instância |
| chatId | string | ID do chat |

**Resposta (200 OK):**
```json
{
  "message": "Sincronização de mensagens iniciada",
  "chatId": "5511999999999@s.whatsapp.net",
  "syncId": "sync-uuid-456"
}
```

---

### Enviar Mensagem de Texto

Envia uma mensagem de texto para um chat.

```http
POST /:instanceId/chats/:chatId/messages/text
```

**Parâmetros da URL:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| instanceId | string | UUID da instância |
| chatId | string | ID do chat (ex: 5511999999999@s.whatsapp.net) |

**Parâmetros do Corpo:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| content | string | Sim | Conteúdo da mensagem |
| quotedMessageId | string | Não | ID da mensagem a ser citada/respondida |

**Exemplo de Requisição:**
```bash
curl -X POST "http://localhost:3001/api/uuid-instancia/chats/5511999999999@s.whatsapp.net/messages/text" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Olá! Tudo bem?"
  }'
```

**Resposta (200 OK):**
```json
{
  "message": "Mensagem enviada com sucesso",
  "messageId": "BAE5...",
  "timestamp": "2025-10-27T14:35:00.000Z",
  "status": "sent"
}
```

---

### Enviar Mensagem de Texto (Alternativa)

Endpoint alternativo para enviar mensagem de texto.

```http
POST /:instanceId/messages/send-text
```

**Parâmetros da URL:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| instanceId | string | UUID da instância |

**Parâmetros do Corpo:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| number | string | Sim | Número do destinatário (ex: 5511999999999) |
| text | string | Sim | Texto da mensagem |

**Exemplo de Requisição:**
```bash
curl -X POST "http://localhost:3001/api/uuid-instancia/messages/send-text" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "5511999999999",
    "text": "Olá! Como vai?"
  }'
```

---

### Enviar Mídia (Upload)

Envia uma mensagem com mídia (imagem, vídeo, documento) fazendo upload do arquivo.

```http
POST /:instanceId/chats/:chatId/messages/media
```

**Headers Obrigatórios:**
```
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Parâmetros da URL:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| instanceId | string | UUID da instância |
| chatId | string | ID do chat |

**Parâmetros do Form-Data:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| media | file | Sim | Arquivo de mídia |
| caption | string | Não | Legenda da mídia |

**Exemplo de Requisição:**
```bash
curl -X POST "http://localhost:3001/api/uuid-instancia/chats/5511999999999@s.whatsapp.net/messages/media" \
  -H "Authorization: Bearer {token}" \
  -F "media=@/caminho/para/imagem.jpg" \
  -F "caption=Olha essa foto!"
```

**Resposta (200 OK):**
```json
{
  "message": "Mídia enviada com sucesso",
  "messageId": "BAE7...",
  "mediaUrl": "https://...",
  "timestamp": "2025-10-27T14:40:00.000Z"
}
```

---

### Enviar Mídia (URL)

Envia uma mensagem com mídia a partir de uma URL.

```http
POST /:instanceId/messages/send-media
```

**Parâmetros da URL:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| instanceId | string | UUID da instância |

**Parâmetros do Corpo:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| number | string | Sim | Número do destinatário |
| mediaUrl | string | Sim | URL da mídia |
| mediaType | string | Sim | image, video, document, audio |
| caption | string | Não | Legenda da mídia |
| fileName | string | Não | Nome do arquivo (para documentos) |

**Exemplo de Requisição:**
```bash
curl -X POST "http://localhost:3001/api/uuid-instancia/messages/send-media" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "5511999999999",
    "mediaUrl": "https://exemplo.com/imagem.jpg",
    "mediaType": "image",
    "caption": "Confira esta imagem!"
  }'
```

**Resposta (200 OK):**
```json
{
  "message": "Mídia enviada com sucesso",
  "messageId": "BAE8...",
  "timestamp": "2025-10-27T14:45:00.000Z"
}
```

---

### Enviar Áudio do WhatsApp

Envia um áudio no formato PTT (Push to Talk) do WhatsApp.

```http
POST /:instanceId/messages/send-audio
```

**Parâmetros da URL:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| instanceId | string | UUID da instância |

**Parâmetros do Corpo:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| number | string | Sim | Número do destinatário |
| audioUrl | string | Sim | URL do arquivo de áudio |

**Exemplo de Requisição:**
```bash
curl -X POST "http://localhost:3001/api/uuid-instancia/messages/send-audio" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "5511999999999",
    "audioUrl": "https://exemplo.com/audio.ogg"
  }'
```

**Resposta (200 OK):**
```json
{
  "message": "Áudio enviado com sucesso",
  "messageId": "BAE9...",
  "timestamp": "2025-10-27T14:50:00.000Z"
}
```

---

### Enviar Sticker (Figurinha)

Envia um sticker/figurinha para um chat.

```http
POST /:instanceId/messages/send-sticker
```

**Parâmetros da URL:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| instanceId | string | UUID da instância |

**Parâmetros do Corpo:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| number | string | Sim | Número do destinatário |
| stickerUrl | string | Sim | URL da imagem do sticker |

**Exemplo de Requisição:**
```bash
curl -X POST "http://localhost:3001/api/uuid-instancia/messages/send-sticker" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "5511999999999",
    "stickerUrl": "https://exemplo.com/sticker.webp"
  }'
```

**Resposta (200 OK):**
```json
{
  "message": "Sticker enviado com sucesso",
  "messageId": "BAE10...",
  "timestamp": "2025-10-27T14:55:00.000Z"
}
```

---

### Buscar Mensagens

Busca mensagens por conteúdo em todos os chats da instância.

```http
GET /:instanceId/messages/search
```

**Parâmetros da URL:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| instanceId | string | UUID da instância |

**Parâmetros de Query:**

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| q | string | Sim | Termo de busca |
| limit | number | Não | Limite de resultados (padrão: 50) |

**Exemplo de Requisição:**
```bash
curl -X GET "http://localhost:3001/api/uuid-instancia/messages/search?q=reunião&limit=20" \
  -H "Authorization: Bearer {token}"
```

**Resposta (200 OK):**
```json
{
  "results": [
    {
      "id": "msg-uuid-1",
      "chatId": "5511999999999@s.whatsapp.net",
      "chatName": "João Silva",
      "content": "A reunião será às 15h",
      "timestamp": "2025-10-27T10:00:00.000Z",
      "fromMe": false
    }
  ],
  "count": 15,
  "query": "reunião"
}
```

---

### Baixar Mídia

Faz o download de uma mídia de uma mensagem.

```http
GET /:instanceId/messages/:messageId/media
```

**Parâmetros da URL:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| instanceId | string | UUID da instância |
| messageId | string | UUID da mensagem |

**Resposta (200 OK):**
Retorna o arquivo de mídia com o Content-Type apropriado.

---

### Obter Mídia em Base64

Retorna a mídia de uma mensagem codificada em Base64.

```http
POST /:instanceId/messages/:messageId/base64
```

**Parâmetros da URL:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| instanceId | string | UUID da instância |
| messageId | string | UUID da mensagem |

**Resposta (200 OK):**
```json
{
  "base64": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "mimetype": "image/jpeg",
  "filename": "imagem.jpg"
}
```

---

## 🔔 Endpoints de Webhooks

### Receber Webhook

Endpoint para receber eventos do Evolution API via webhook.

```http
POST /webhook/:instanceName
```

**Parâmetros da URL:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| instanceName | string | Nome da instância no Evolution API |

**Eventos Suportados:**

- `messages.upsert` - Nova mensagem recebida ou atualizada
- `connection.update` - Atualização do status de conexão
- `qrcode.updated` - QR Code atualizado
- `messages.update` - Status de mensagem atualizado
- `chats.upsert` - Chat criado ou atualizado
- `chats.update` - Chat atualizado
- `contacts.upsert` - Contato criado ou atualizado
- `groups.upsert` - Grupo criado ou atualizado

**Exemplo de Payload (messages.upsert):**
```json
{
  "event": "messages.upsert",
  "instance": "minha_instancia_abc123",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "BAE5..."
    },
    "message": {
      "conversation": "Olá! Como vai?"
    },
    "messageTimestamp": 1698420000,
    "pushName": "João Silva"
  }
}
```

**Resposta (200 OK):**
```json
{
  "success": true,
  "message": "Webhook processado com sucesso"
}
```

---

## 📊 Endpoints de Dashboard

### Estatísticas do Dashboard

Retorna estatísticas gerais do sistema.

```http
GET /dashboard/stats
```

**Headers Obrigatórios:**
```
Authorization: Bearer {token}
```

**Resposta (200 OK):**
```json
{
  "totalInstances": 15,
  "connectedInstances": 12,
  "disconnectedInstances": 3,
  "totalChats": 1450,
  "totalMessages": 45892,
  "todayMessages": 234,
  "unreadMessages": 87
}
```

---

## 📋 Códigos de Status HTTP

| Código | Significado | Descrição |
|--------|-------------|-----------|
| 200 | OK | Requisição bem-sucedida |
| 201 | Created | Recurso criado com sucesso |
| 400 | Bad Request | Parâmetros inválidos ou faltantes |
| 401 | Unauthorized | Token de autenticação inválido ou ausente |
| 403 | Forbidden | Sem permissão para acessar o recurso |
| 404 | Not Found | Recurso não encontrado |
| 409 | Conflict | Conflito (ex: instância já existe) |
| 429 | Too Many Requests | Limite de requisições excedido |
| 500 | Internal Server Error | Erro interno do servidor |
| 503 | Service Unavailable | Serviço temporariamente indisponível |

---

## 💡 Exemplos de Uso

### Exemplo Completo: Conectar e Enviar Mensagem

```javascript
// 1. Fazer login
const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'usuario@exemplo.com',
    password: 'senha123'
  })
});
const { token } = await loginResponse.json();

// 2. Criar instância
const instanceResponse = await fetch('http://localhost:3001/api/instances', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ name: 'Minha Instância' })
});
const instance = await instanceResponse.json();

// 3. Conectar instância
const connectResponse = await fetch(
  `http://localhost:3001/api/instances/${instance.id}/connect`,
  {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  }
);
const { qrCode } = await connectResponse.json();

// 4. Exibir QR Code para usuário escanear
console.log('QR Code:', qrCode.base64);

// 5. Aguardar conexão (monitorar via WebSocket ou polling)
// ... aguardar status === 'connected'

// 6. Enviar mensagem
const messageResponse = await fetch(
  `http://localhost:3001/api/${instance.id}/messages/send-text`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      number: '5511999999999',
      text: 'Olá! Esta é uma mensagem de teste.'
    })
  }
);
const result = await messageResponse.json();
console.log('Mensagem enviada:', result);
```

---

### Exemplo: Buscar e Listar Mensagens de um Chat

```javascript
const token = 'seu_token_jwt';
const instanceId = 'uuid-da-instancia';
const chatId = '5511999999999@s.whatsapp.net';

// Listar mensagens do chat
const response = await fetch(
  `http://localhost:3001/api/${instanceId}/chats/${chatId}/messages?page=1&limit=50`,
  {
    headers: { 'Authorization': `Bearer ${token}` }
  }
);

const { messages, pagination } = await response.json();

console.log('Total de mensagens:', pagination.totalMessages);
console.log('Mensagens:', messages);

// Filtrar mensagens não lidas
const unreadMessages = messages.filter(msg => 
  !msg.fromMe && msg.status !== 'read'
);

console.log('Mensagens não lidas:', unreadMessages.length);
```

---

### Exemplo: Enviar Mídia com Legenda

```javascript
const token = 'seu_token_jwt';
const instanceId = 'uuid-da-instancia';

const response = await fetch(
  `http://localhost:3001/api/${instanceId}/messages/send-media`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      number: '5511999999999',
      mediaUrl: 'https://exemplo.com/foto-produto.jpg',
      mediaType: 'image',
      caption: 'Confira nosso novo produto! 🚀'
    })
  }
);

const result = await response.json();
console.log('Mídia enviada:', result);
```

---

### Exemplo: Sincronizar Todos os Dados

```javascript
const token = 'seu_token_jwt';
const instanceId = 'uuid-da-instancia';

// Sincronizar instância completa (chats, contatos, mensagens)
const syncResponse = await fetch(
  `http://localhost:3001/api/instances/${instanceId}/sync`,
  {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  }
);

const { syncId } = await syncResponse.json();
console.log('Sincronização iniciada:', syncId);

// Você receberá atualizações via WebSocket sobre o progresso
```

---

## 🚦 Rate Limiting

A API implementa limitação de taxa (rate limiting) para proteger contra abuso:

- **Janela de Tempo:** 15 minutos
- **Limite (Desenvolvimento):** 10.000 requisições
- **Limite (Produção):** 1.000 requisições

Quando o limite é excedido, a API retorna:

```json
{
  "error": "Muitas tentativas. Tente novamente em 15 minutos."
}
```

**Headers de Resposta:**
- `X-RateLimit-Limit`: Limite total de requisições
- `X-RateLimit-Remaining`: Requisições restantes
- `X-RateLimit-Reset`: Timestamp quando o limite será resetado

---

## ⚠️ Tratamento de Erros

Todos os erros retornam um JSON no seguinte formato:

```json
{
  "error": "Descrição do erro",
  "details": "Informações adicionais (opcional)",
  "code": "ERROR_CODE (opcional)"
}
```

### Exemplos de Erros Comuns

**Erro 400 - Bad Request:**
```json
{
  "error": "Nome da instância é obrigatório"
}
```

**Erro 401 - Unauthorized:**
```json
{
  "error": "Token inválido ou expirado"
}
```

**Erro 404 - Not Found:**
```json
{
  "error": "Instância não encontrada"
}
```

**Erro 409 - Conflict:**
```json
{
  "error": "Já existe uma instância com esse nome"
}
```

**Erro 500 - Internal Server Error:**
```json
{
  "error": "Erro interno do servidor",
  "details": "Detalhes técnicos do erro"
}
```

---

## 🔌 WebSocket (Socket.IO)

A API oferece comunicação em tempo real via WebSocket para eventos como:

- Novas mensagens recebidas
- Atualização de status de conexão
- Progresso de sincronização
- Atualizações de chats

**Conexão:**
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3001', {
  auth: {
    token: 'seu_token_jwt'
  }
});

// Escutar eventos
socket.on('new-message', (data) => {
  console.log('Nova mensagem:', data);
});

socket.on('instance-status', (data) => {
  console.log('Status da instância:', data);
});

socket.on('sync-progress', (data) => {
  console.log('Progresso:', data.progress + '%');
});
```

**Eventos Disponíveis:**

| Evento | Descrição |
|--------|-----------|
| `new-message` | Nova mensagem recebida |
| `message-status-update` | Status de mensagem atualizado |
| `instance-status` | Status de conexão atualizado |
| `qrcode-updated` | QR Code atualizado |
| `sync-start` | Sincronização iniciada |
| `sync-progress` | Progresso da sincronização |
| `sync-complete` | Sincronização concluída |
| `chat-updated` | Chat atualizado |
| `contact-updated` | Contato atualizado |

---

## 🔒 Segurança

### Boas Práticas

1. **Sempre use HTTPS em produção**
2. **Mantenha seus tokens seguros** - Nunca exponha no código frontend
3. **Rotacione tokens regularmente**
4. **Use variáveis de ambiente** para chaves sensíveis
5. **Implemente CORS adequadamente**
6. **Monitore logs de erro** para detectar ataques
7. **Use senhas fortes** (mínimo 8 caracteres, letras, números, símbolos)

### CORS

Os seguintes domínios são permitidos por padrão:
- `http://localhost:3000` (desenvolvimento)
- Domínio configurado em `FRONTEND_URL`

---

## 🐛 Suporte e Debugging

### Logs

Todos os eventos importantes são registrados nos logs do servidor:

```bash
# Ver logs em tempo real
docker-compose logs -f backend
```

### Variáveis de Ambiente

Configure as seguintes variáveis no arquivo `.env`:

```env
# Servidor
PORT=3001
NODE_ENV=production

# Banco de Dados
DATABASE_URL=postgresql://usuario:senha@localhost:5432/wppweb

# JWT
JWT_SECRET=sua_chave_secreta_aqui
SESSION_TIMEOUT=24h

# Evolution API
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=sua_api_key

# Webhook
WEBHOOK_URL=https://seu-dominio.com/api/webhook

# Frontend
FRONTEND_URL=https://seu-dominio.com

# Redis (opcional)
REDIS_URL=redis://localhost:6379

# Modo Iframe
IFRAME_MODE=false

# Registro de Usuários
ALLOW_USER_REGISTRATION=true

# Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_KEY=sua_service_key
```

---

## 📝 Changelog

### v1.0.0 (27/10/2025)
- Versão inicial da documentação
- Suporte completo a instâncias, chats e mensagens
- Autenticação JWT e API Key
- WebSocket para eventos em tempo real
- Multi-tenancy com client_id
- Sincronização otimizada para grandes volumes

---

## 📞 Contato

Para suporte técnico ou dúvidas:

- **Email:** suporte@exemplo.com
- **GitHub:** https://github.com/safecore-technology/web-chat-neurons-partners
- **Documentação:** https://docs.exemplo.com

---

## 📄 Licença

Esta documentação e a API são propriedade de SafeCore Technology.

**© 2025 SafeCore Technology. Todos os direitos reservados.**
