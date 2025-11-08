#!/usr/bin/env node

/**
 * Script de Teste para Multi-Tenancy com Client ID
 * 
 * Este script testa a funcionalidade de multi-tenancy do sistema.
 * 
 * USO:
 * node test_multi_tenancy.js
 */

const API_URL = process.env.API_URL || 'http://localhost:3001'
const API_KEY = process.env.IFRAME_API_KEY || 'fb879a6b-b52c-4120-ba49-6bd3d9d31d5d'

// Clientes de teste
const TEST_CLIENTS = [
  {
    client_id: 'test-client-1',
    client_name: 'Cliente Teste 1'
  },
  {
    client_id: 'test-client-2',
    client_name: 'Cliente Teste 2'
  },
  {
    client_id: 'test-client-3',
    client_name: 'Cliente Teste 3'
  }
]

// Cores para output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
}

function log(color, emoji, message) {
  console.log(`${colors[color]}${emoji} ${message}${colors.reset}`)
}

function logSuccess(message) {
  log('green', '✅', message)
}

function logError(message) {
  log('red', '❌', message)
}

function logInfo(message) {
  log('blue', 'ℹ️ ', message)
}

function logWarning(message) {
  log('yellow', '⚠️ ', message)
}

function logHeader(message) {
  console.log(`\n${colors.cyan}${colors.bright}${'='.repeat(60)}`)
  console.log(`${message}`)
  console.log(`${'='.repeat(60)}${colors.reset}\n`)
}

// Funções de teste
async function authenticateClient(client) {
  try {
    const response = await fetch(`${API_URL}/api/auth/client/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: client.client_id,
        client_name: client.client_name,
        api_key: API_KEY
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Authentication failed')
    }

    return {
      success: true,
      token: data.token,
      user: data.user
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

async function validateClient(clientId) {
  try {
    const response = await fetch(`${API_URL}/api/auth/client/validate?client_id=${clientId}`)
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Validation failed')
    }

    return {
      success: true,
      exists: data.exists,
      user: data.user
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

async function getInstances(token) {
  try {
    const response = await fetch(`${API_URL}/api/instances`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to get instances')
    }

    return {
      success: true,
      instances: data.instances || []
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

// Testes
async function runTests() {
  logHeader('🧪 INICIANDO TESTES DE MULTI-TENANCY')

  logInfo(`API URL: ${API_URL}`)
  logInfo(`API Key: ${API_KEY.substring(0, 8)}...`)
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0
  }

  // Teste 1: Autenticar múltiplos clientes
  logHeader('Teste 1: Autenticar Múltiplos Clientes')
  
  const clientTokens = {}
  
  for (const client of TEST_CLIENTS) {
    results.total++
    logInfo(`Autenticando ${client.client_id}...`)
    
    const result = await authenticateClient(client)
    
    if (result.success) {
      logSuccess(`Cliente autenticado: ${result.user.name} (ID: ${result.user.id})`)
      clientTokens[client.client_id] = result.token
      results.passed++
    } else {
      logError(`Falha na autenticação: ${result.error}`)
      results.failed++
    }
  }

  // Teste 2: Validar clientes existentes
  logHeader('Teste 2: Validar Clientes Existentes')
  
  for (const client of TEST_CLIENTS) {
    results.total++
    logInfo(`Validando ${client.client_id}...`)
    
    const result = await validateClient(client.client_id)
    
    if (result.success && result.exists) {
      logSuccess(`Cliente existe: ${result.user.name}`)
      results.passed++
    } else if (result.success && !result.exists) {
      logWarning(`Cliente não existe: ${client.client_id}`)
      results.failed++
    } else {
      logError(`Falha na validação: ${result.error}`)
      results.failed++
    }
  }

  // Teste 3: Verificar isolamento de instâncias
  logHeader('Teste 3: Verificar Isolamento de Instâncias')
  
  for (const client of TEST_CLIENTS) {
    results.total++
    const token = clientTokens[client.client_id]
    
    if (!token) {
      logWarning(`Token não disponível para ${client.client_id}`)
      results.failed++
      continue
    }
    
    logInfo(`Buscando instâncias de ${client.client_id}...`)
    
    const result = await getInstances(token)
    
    if (result.success) {
      logSuccess(`${client.client_id}: ${result.instances.length} instância(s)`)
      if (result.instances.length > 0) {
        result.instances.forEach(inst => {
          console.log(`  - ${inst.name} (${inst.status})`)
        })
      }
      results.passed++
    } else {
      logError(`Falha ao buscar instâncias: ${result.error}`)
      results.failed++
    }
  }

  // Teste 4: Tentar autenticar sem API Key
  logHeader('Teste 4: Validação de Segurança (Sem API Key)')
  
  results.total++
  logInfo('Tentando autenticar sem API Key...')
  
  try {
    const response = await fetch(`${API_URL}/api/auth/client/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: 'test-unauthorized',
        client_name: 'Test'
      })
    })

    const data = await response.json()
    
    if (response.status === 401) {
      logSuccess('Corretamente bloqueado (401 Unauthorized)')
      results.passed++
    } else {
      logError('Deveria ter bloqueado mas não bloqueou!')
      results.failed++
    }
  } catch (error) {
    logError(`Erro inesperado: ${error.message}`)
    results.failed++
  }

  // Teste 5: Tentar autenticar com API Key inválida
  logHeader('Teste 5: Validação de Segurança (API Key Inválida)')
  
  results.total++
  logInfo('Tentando autenticar com API Key inválida...')
  
  try {
    const response = await fetch(`${API_URL}/api/auth/client/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: 'test-unauthorized',
        client_name: 'Test',
        api_key: 'invalid-key-12345'
      })
    })

    const data = await response.json()
    
    if (response.status === 401) {
      logSuccess('Corretamente bloqueado (401 Unauthorized)')
      results.passed++
    } else {
      logError('Deveria ter bloqueado mas não bloqueou!')
      results.failed++
    }
  } catch (error) {
    logError(`Erro inesperado: ${error.message}`)
    results.failed++
  }

  // Resultados finais
  logHeader('📊 RESULTADOS DOS TESTES')
  
  console.log(`Total de Testes: ${results.total}`)
  console.log(`${colors.green}✅ Passou: ${results.passed}${colors.reset}`)
  console.log(`${colors.red}❌ Falhou: ${results.failed}${colors.reset}`)
  
  const percentage = ((results.passed / results.total) * 100).toFixed(1)
  console.log(`\nTaxa de Sucesso: ${percentage}%`)
  
  if (results.failed === 0) {
    logSuccess('TODOS OS TESTES PASSARAM! 🎉')
  } else {
    logWarning(`${results.failed} teste(s) falharam. Verifique os logs acima.`)
  }
  
  console.log('\n')
  
  // Retornar código de saída apropriado
  process.exit(results.failed > 0 ? 1 : 0)
}

// Executar testes
runTests().catch(error => {
  logError(`Erro fatal: ${error.message}`)
  console.error(error)
  process.exit(1)
})
