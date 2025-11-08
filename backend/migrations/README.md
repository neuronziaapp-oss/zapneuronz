# Database Migrations

Esta pasta contém as migrações do banco de dados para o projeto WhatsApp Web.

## Migrations Disponíveis

### 001_initial_schema.sql
- **Descrição**: Schema inicial completo para Supabase (PostgreSQL)
- **Inclui**: 
  - Todas as tabelas (users, instances, contacts, chats, messages)
  - Índices para performance
  - Row Level Security (RLS)
  - Triggers para updated_at automático

## Como Usar

### 1. Supabase Setup
1. Acesse seu dashboard do Supabase
2. Vá em SQL Editor
3. Execute o arquivo `001_initial_schema.sql`

### 2. Verificar Criação
```sql
-- Verificar se as tabelas foram criadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE';
```

### 3. Verificar Políticas RLS
```sql
-- Verificar políticas de segurança
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public';
```

## Estrutura do Banco

```
├── users (Usuários do sistema)
├── instances (Instâncias do WhatsApp)
├── contacts (Contatos sincronizados)
├── chats (Conversas)
└── messages (Mensagens)
```

## Diferenças do SQLite

| SQLite (Antigo) | PostgreSQL (Novo) |
|----------------|-------------------|
| INTEGER PRIMARY KEY | UUID PRIMARY KEY |
| TEXT/VARCHAR | VARCHAR com tamanhos específicos |
| JSON | JSONB (melhor performance) |
| datetime | TIMESTAMP WITH TIME ZONE |
| Sem constraints | CHECK constraints |
| Sem RLS | Row Level Security |

## Próximas Migrations

Futuras migrações serão numeradas sequencialmente:
- `002_add_feature.sql`
- `003_update_schema.sql`
- etc.

## Rollback

Para reverter uma migração, crie um arquivo de rollback:
- `001_initial_schema_rollback.sql`