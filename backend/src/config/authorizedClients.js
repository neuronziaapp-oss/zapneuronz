/**
 * Configuração de Clientes Autorizados para Multi-Tenancy
 * 
 * Este arquivo permite configurar uma lista de clientes autorizados
 * para acessar a aplicação em modo iframe com isolamento de dados.
 * 
 * MODO DE OPERAÇÃO:
 * - Se WHITELIST_ENABLED=true, apenas clientes nesta lista podem se autenticar
 * - Se WHITELIST_ENABLED=false, qualquer client_id pode criar um usuário
 */

// Lista de clientes autorizados
const AUTHORIZED_CLIENTS = [
  {
    client_id: 'empresa-abc',
    name: 'Empresa ABC Ltda',
    email: 'contato@empresa-abc.com',
    active: true,
    max_instances: 5, // Limite de instâncias
    created_at: '2025-01-01'
  },
  {
    client_id: 'empresa-xyz',
    name: 'Empresa XYZ S.A.',
    email: 'contato@empresa-xyz.com',
    active: true,
    max_instances: 10,
    created_at: '2025-01-15'
  },
  {
    client_id: 'cliente-teste',
    name: 'Cliente de Teste',
    email: 'teste@teste.com',
    active: true,
    max_instances: 2,
    created_at: '2025-01-20'
  }
]

/**
 * Verificar se um client_id está autorizado
 */
function isClientAuthorized(clientId) {
  // Se whitelist não está habilitada, permitir todos
  if (process.env.WHITELIST_ENABLED !== 'true') {
    return true
  }

  // Verificar se cliente está na lista e ativo
  const client = AUTHORIZED_CLIENTS.find(c => c.client_id === clientId)
  return client && client.active
}

/**
 * Obter informações de um cliente autorizado
 */
function getClientInfo(clientId) {
  return AUTHORIZED_CLIENTS.find(c => c.client_id === clientId) || null
}

/**
 * Verificar limite de instâncias de um cliente
 */
function getClientInstanceLimit(clientId) {
  const client = getClientInfo(clientId)
  return client?.max_instances || 5 // Padrão: 5 instâncias
}

/**
 * Listar todos os clientes ativos
 */
function getActiveClients() {
  return AUTHORIZED_CLIENTS.filter(c => c.active)
}

module.exports = {
  AUTHORIZED_CLIENTS,
  isClientAuthorized,
  getClientInfo,
  getClientInstanceLimit,
  getActiveClients
}
