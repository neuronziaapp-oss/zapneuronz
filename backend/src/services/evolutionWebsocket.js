const WebSocket = require('ws')
const evolutionApi = require('./evolutionApi')
const { SupabaseInstance } = require('../models/supabase')
const webhookController = require('../controllers/WebhookController')
const { getIO } = require('./socket')

const DEFAULT_EVENTS = [
  'APPLICATION_STARTUP',
  'QRCODE_UPDATED',
  'MESSAGES_SET',
  'MESSAGES_UPSERT',
  'MESSAGES_UPDATE',
  'MESSAGES_DELETE',
  'SEND_MESSAGE',
  'CONTACTS_SET',
  'CONTACTS_UPSERT',
  'CONTACTS_UPDATE',
  'PRESENCE_UPDATE',
  'CHATS_SET',
  'CHATS_UPSERT',
  'CHATS_UPDATE',
  'CHATS_DELETE',
  'GROUPS_UPSERT',
  'GROUP_UPDATE',
  'GROUP_PARTICIPANTS_UPDATE',
  'CONNECTION_UPDATE'
]

const activeConnections = new Map()
const pendingConnections = new Map()
const permanentlyMissingInstances = new Set()
const websocketUnavailableInstances = new Set()

const TRANSIENT_NOT_FOUND_WINDOW_MS = 60000

const transientStatuses = new Set(['connecting', 'pending', 'qr_code', 'qr'])

const parseDateSafe = value => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const shouldTreatNotFoundAsTransient = (instance, entry) => {
  if (!instance) {
    return false
  }

  const status = (instance.status || '').toLowerCase()
  if (!transientStatuses.has(status)) {
    return false
  }

  const now = Date.now()
  const createdAt =
    parseDateSafe(instance.created_at) ||
    parseDateSafe(instance.createdAt) ||
    null
  if (createdAt && now - createdAt.getTime() <= TRANSIENT_NOT_FOUND_WINDOW_MS) {
    return true
  }

  if (entry?.firstAttemptAt && now - entry.firstAttemptAt <= TRANSIENT_NOT_FOUND_WINDOW_MS) {
    return true
  }

  return false
}
const MAX_RECONNECT_DELAY = 30000
const INSTANCE_NOT_FOUND_CODE = 'EVOLUTION_INSTANCE_NOT_FOUND'

const extractProviderMessage = details => {
  if (!details) return 'Instance not found at provider'

  if (typeof details === 'string') {
    return details
  }

  const responseMessage = details.response?.message
  if (Array.isArray(responseMessage) && responseMessage.length > 0) {
    return responseMessage.join(' | ')
  }

  if (details.message) {
    return details.message
  }

  if (details.error) {
    return details.error
  }

  return 'Instance not found at provider'
}

async function registerWebsocketUnavailable(instance, providerDetails) {
  if (!instance || !instance.evolution_instance_id) {
    return
  }

  const instanceId = instance.evolution_instance_id
  const providerMessage = extractProviderMessage(providerDetails)
  const timestamp = new Date().toISOString()

  if (!websocketUnavailableInstances.has(instanceId)) {
    console.warn(`⚠️ [EvolutionWS] WebSocket indisponível para ${instanceId}. Motivo: ${providerMessage}`)
  }

  websocketUnavailableInstances.add(instanceId)

  if (instance.settings && typeof instance.settings === 'object') {
    instance.settings.websocketUnavailable = true
    instance.settings.websocketUnavailableAt = timestamp
    instance.settings.websocketUnavailableReason = providerMessage
  }

  if (instance.id) {
    try {
      await SupabaseInstance.updateSettings(instance.id, {
        websocketUnavailable: true,
        websocketUnavailableAt: timestamp,
        websocketUnavailableReason: providerMessage
      })
    } catch (error) {
      console.error(`❌ [EvolutionWS] Falha ao registrar indisponibilidade do WebSocket para ${instanceId}:`, error.message)
    }
  }
}

async function clearUnavailableFlag(instanceOrId) {
  if (!instanceOrId) {
    return
  }

  let instanceRecord = instanceOrId

  if (typeof instanceOrId === 'string') {
    instanceRecord = await SupabaseInstance.findByEvolutionId(instanceOrId)
    if (!instanceRecord) {
      websocketUnavailableInstances.delete(instanceOrId)
      return
    }
  }

  const instanceId = instanceRecord?.evolution_instance_id
  if (!instanceId) {
    return
  }

  websocketUnavailableInstances.delete(instanceId)

  if (instanceRecord.settings && typeof instanceRecord.settings === 'object') {
    instanceRecord.settings.websocketUnavailable = false
    instanceRecord.settings.websocketUnavailableAt = null
    instanceRecord.settings.websocketUnavailableReason = null
  }

  if (instanceRecord.id) {
    try {
      await SupabaseInstance.updateSettings(instanceRecord.id, {
        websocketUnavailable: false,
        websocketUnavailableAt: null,
        websocketUnavailableReason: null
      })
    } catch (error) {
      console.error(`❌ [EvolutionWS] Falha ao limpar flag de WebSocket indisponível para ${instanceId}:`, error.message)
    }
  }
}

async function markInstanceAsMissing(instance, providerDetails) {
  if (!instance) {
    return 'unknown'
  }

  const instanceId = instance.evolution_instance_id
  const providerMessage = extractProviderMessage(providerDetails)

  let existsOnProvider = null
  try {
    const providerInfo = await evolutionApi.getInstanceInfo(instanceId)
    existsOnProvider = Boolean(providerInfo)
  } catch (error) {
    if (error.response?.status === 404) {
      existsOnProvider = false
    } else {
      console.error(`❌ [EvolutionWS] Falha ao verificar existência da instância ${instanceId}:`, error.message)
      existsOnProvider = null
    }
  }

  if (existsOnProvider) {
    await registerWebsocketUnavailable(instance, providerDetails)
    const entry = activeConnections.get(instanceId)
    if (entry) {
      entry.permanentError = true
    }
    pendingConnections.delete(instanceId)
    disconnectInstance(instanceId)
    return 'unavailable'
  }

  if (existsOnProvider === null) {
    console.warn(`⚠️ [EvolutionWS] Não foi possível confirmar se a instância ${instanceId} foi removida do provider. Tentaremos novamente mais tarde.`)
    return 'unknown'
  }

  console.warn(`⚠️ [EvolutionWS] Instância ${instanceId} não existe mais no provider. Encerrando WebSocket.`)

  permanentlyMissingInstances.add(instanceId)

  try {
    const settings = instance.settings || {}
    if (instance.id) {
      await SupabaseInstance.update(instance.id, {
        status: 'error',
        settings: {
          ...settings,
          orphaned: true,
          orphanedAt: new Date().toISOString(),
          orphanError: providerMessage
        }
      })
    }
  } catch (error) {
    console.error(`❌ [EvolutionWS] Falha ao marcar instância ${instanceId} como órfã:`, error.message)
  }

  const entry = activeConnections.get(instanceId)
  if (entry) {
    entry.permanentError = true
  }

  pendingConnections.delete(instanceId)
  disconnectInstance(instanceId)
  return 'missing'
}

const buildWebsocketUrl = instanceId => {
  const baseUrl = (process.env.EVOLUTION_WS_URL || evolutionApi.baseURL || '').trim()
  if (!baseUrl) {
    throw new Error('EVOLUTION_API_URL não configurada')
  }

  const url = new URL(baseUrl)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  const pathname = url.pathname || '/'
  const trimmedPath = pathname.replace(/\/+$/u, '')
  const prefix = trimmedPath ? `${trimmedPath}/` : '/'
  url.pathname = `${prefix}websocket/${instanceId}`
  return url.toString()
}

const normalizeDiscoveredUrl = (rawUrl, fallbackUrl, instanceId) => {
  if (!rawUrl) {
    return null
  }

  try {
    const base = fallbackUrl || buildWebsocketUrl(instanceId)
    const hasProtocol = /^[a-zA-Z][a-zA-Z\d+-.]*:/.test(rawUrl)
    const url = hasProtocol ? new URL(rawUrl) : new URL(rawUrl, base)

    if (url.protocol === 'http:') {
      url.protocol = 'ws:'
    } else if (url.protocol === 'https:') {
      url.protocol = 'wss:'
    }

    return url.toString()
  } catch (error) {
    console.warn(`⚠️ [EvolutionWS] URL de websocket inválida fornecida pelo provider (${rawUrl}):`, error.message)
    return null
  }
}

const safeJsonParse = raw => {
  try {
    return JSON.parse(raw)
  } catch (error) {
    console.warn('⚠️ [EvolutionWS] Mensagem não é JSON válido, ignorando:', raw)
    return null
  }
}

const dispatchEvent = async (instance, payload) => {
  if (!payload || !payload.event) {
    return
  }

  const io = getIO()
  const normalizedEvent = (payload.event || '').toUpperCase().replace('.', '_')

  try {
    switch (normalizedEvent) {
      case 'QRCODE_UPDATED':
        await webhookController.handleQRCodeUpdate(instance, payload, io)
        break
      case 'CONNECTION_UPDATE':
        await webhookController.handleConnectionUpdate(instance, payload, io)
        break
      case 'MESSAGES_UPSERT':
        await webhookController.handleMessagesUpsert(instance, payload, io)
        break
      case 'MESSAGES_UPDATE':
        await webhookController.handleMessagesUpdate(instance, payload, io)
        break
      case 'CONTACTS_UPSERT':
      case 'CONTACTS_UPDATE':
        await webhookController.handleContactsUpdate(instance, payload, io)
        break
      case 'CHATS_UPSERT':
      case 'CHATS_UPDATE':
        await webhookController.handleChatsUpdate(instance, payload, io)
        break
      case 'PRESENCE_UPDATE':
        await webhookController.handlePresenceUpdate(instance, payload, io)
        break
      case 'APPLICATION_STARTUP':
        console.log('⚙️ [EvolutionWS] Evolution API confirmou WebSocket ativo')
        break
      default:
        console.log(`[EvolutionWS] Evento não processado via WebSocket: ${payload.event}`)
        break
    }
  } catch (error) {
    console.error(`[EvolutionWS] Erro ao processar evento ${payload.event}:`, error)
  }
}

const configureWebsocket = async (instanceId, instance) => {
  try {
    const result = await evolutionApi.setWebsocketWithRetry(instanceId, DEFAULT_EVENTS)
    await clearUnavailableFlag(instance)
    return result
  } catch (error) {
    if (error.code === INSTANCE_NOT_FOUND_CODE || error.response?.status === 404) {
      error.code = INSTANCE_NOT_FOUND_CODE
      error.providerDetails = error.providerDetails || error.response?.data || error.message
      error.transient = shouldTreatNotFoundAsTransient(instance, null)
      throw error
    }
    console.error(`❌ [EvolutionWS] Erro ao configurar websocket para ${instanceId}:`, error.response?.data || error.message)
    throw error
  }
}

const scheduleReconnect = (entry, reason) => {
  if (!entry) return

  const { instance } = entry

  if (entry.permanentError) {
    console.warn(`🛑 [EvolutionWS] Reconexão cancelada para ${instance.evolution_instance_id}: erro permanente indicado`)
    activeConnections.delete(instance.evolution_instance_id)
    return
  }
  entry.reconnectAttempts = (entry.reconnectAttempts || 0) + 1
  const delay = Math.min(MAX_RECONNECT_DELAY, 1000 * entry.reconnectAttempts)
  const reasonText = reason ? reason.toString() : 'desconhecido'
  console.log(`🔄 [EvolutionWS] Reconectando instância ${instance.evolution_instance_id} em ${delay}ms (motivo: ${reasonText})`)

  if (entry.reconnectTimer) {
    clearTimeout(entry.reconnectTimer)
  }

  entry.reconnectTimer = setTimeout(() => {
    entry.reconnectTimer = null
    ;(async () => {
      try {
        await configureWebsocket(instance.evolution_instance_id, instance)
        await createConnection(instance, true)
      } catch (error) {
        if (error.code === INSTANCE_NOT_FOUND_CODE) {
          if (error.transient) {
            console.warn(`⚠️ [EvolutionWS] WebSocket para ${instance.evolution_instance_id} ainda não disponível no provider. Nova tentativa em breve.`)
            entry.permanentError = false
            scheduleReconnect(entry, error.providerDetails || error.message)
            return
          }

          const outcome = await markInstanceAsMissing(instance, error.providerDetails || error)
          if (outcome === 'unknown') {
            entry.permanentError = false
            scheduleReconnect(entry, error.providerDetails || error.message)
            return
          }

          if (entry) {
            entry.permanentError = true
          }
          return
        }

        console.error(`❌ [EvolutionWS] Falha ao reconectar ${instance.evolution_instance_id}:`, error.message)
        scheduleReconnect(entry)
      }
    })()
  }, delay)
}

const createConnection = async (instance, isReconnect = false) => {
  const instanceId = instance.evolution_instance_id
  const fallbackUrl = buildWebsocketUrl(instanceId)

  let url = fallbackUrl
  let urlSource = 'computed'
  const headers = {}
  if (evolutionApi.apiKey) {
    headers.apikey = evolutionApi.apiKey
  }

  try {
    const config = await evolutionApi.findWebsocket(instanceId)
    const rawUrl = config?.websocket?.url || config?.websocketUrl || config?.url
    const configHeaders = config?.websocket?.headers || config?.headers

    const discoveredUrl = normalizeDiscoveredUrl(rawUrl, fallbackUrl, instanceId)
    if (discoveredUrl) {
      if (discoveredUrl !== fallbackUrl) {
        console.log(`ℹ️ [EvolutionWS] URL fornecida pelo provider para ${instanceId}: ${discoveredUrl}`)
      }
      url = discoveredUrl
      urlSource = discoveredUrl === fallbackUrl ? 'computed' : 'provider'
    } else if (config) {
      const configKeys = Object.keys(config || {})
      const websocketKeys = Object.keys(config.websocket || {})
      console.log(`ℹ️ [EvolutionWS] Provider não forneceu URL explícita para ${instanceId}. Chaves: ${configKeys.join(', ')} | websocket: ${websocketKeys.join(', ')}`)
    }

    if (configHeaders && typeof configHeaders === 'object') {
      Object.assign(headers, configHeaders)
    }
  } catch (error) {
    if (error.response?.status === 404) {
      const notFoundError = new Error('Evolution instance not found when fetching websocket configuration')
      notFoundError.code = INSTANCE_NOT_FOUND_CODE
      notFoundError.providerDetails = error.response?.data || error
      const entryRef = activeConnections.get(instanceId)
      notFoundError.transient = shouldTreatNotFoundAsTransient(instance, entryRef || null)
      throw notFoundError
    }

    console.warn(`⚠️ [EvolutionWS] Não foi possível obter configuração atual do websocket (${instanceId}):`, error.response?.data || error.message)
  }

  console.log(`${isReconnect ? '🔄' : '🔌'} [EvolutionWS] Conectando WebSocket (${urlSource}): ${url}`)

  const ws = new WebSocket(url, {
    headers,
    perMessageDeflate: false
  })

  const entry = activeConnections.get(instanceId) || {}
  entry.instance = instance
  entry.ws = ws
  entry.manualClose = false
  entry.reconnectAttempts = isReconnect ? entry.reconnectAttempts || 0 : 0
  entry.firstAttemptAt = entry.firstAttemptAt || Date.now()
  activeConnections.set(instanceId, entry)

  ws.on('open', () => {
    console.log(`✅ [EvolutionWS] Conectado ao WebSocket da instância ${instanceId}`)
    console.log(`🎧 [EvolutionWS] Aguardando eventos MESSAGES_UPSERT e outros...`)
    entry.reconnectAttempts = 0
    entry.permanentError = false
  })

  ws.on('message', async message => {
    const payloadString = message?.toString?.() || ''

    if (!payloadString) {
      return
    }

    if (payloadString === 'ping' || payloadString === 'pong') {
      return
    }

    const payload = safeJsonParse(payloadString)
    if (!payload) {
      return
    }

    console.log(`📨 [EvolutionWS] Evento recebido via WebSocket: ${payload.event} para ${instanceId}`)
    
    // Log especial para mensagens
    if (payload.event && payload.event.toLowerCase().includes('message')) {
      console.log(`💬 [EvolutionWS] MENSAGEM RECEBIDA VIA WEBSOCKET!`)
      console.log(`📋 Dados:`, JSON.stringify(payload.data, null, 2).substring(0, 500))
    }

    const freshInstance = await SupabaseInstance.findByEvolutionId(instanceId) || instance
    await dispatchEvent(freshInstance, payload)
  })

  ws.on('error', error => {
    if (error?.message?.includes('Unexpected server response: 404')) {
      if (shouldTreatNotFoundAsTransient(instance, entry)) {
        console.warn(`⚠️ [EvolutionWS] WebSocket 404 para ${instanceId} possivelmente transitório. Tentando novamente.`)
        scheduleReconnect(entry, error.message)
        return
      }

      markInstanceAsMissing(instance, error)
        .then(outcome => {
          if (outcome === 'unknown' && entry) {
            entry.permanentError = false
            entry.manualClose = false
          }
        })
        .finally(() => {
          try {
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
              ws.close()
            }
          } catch (_) {}
        })
      return
    }

    console.error(`❌ [EvolutionWS] Erro no WebSocket (${instanceId}):`, error.message)
  })

  ws.on('close', (code, reason) => {
    console.warn(`⚠️ [EvolutionWS] WebSocket fechado (${instanceId}) com código ${code}`)

    if (entry.manualClose) {
      console.log(`🛑 [EvolutionWS] Conexão manualmente encerrada para ${instanceId}`)
      activeConnections.delete(instanceId)
      return
    }

    scheduleReconnect(entry, reason)
  })

  return ws
}

const ensureConnection = async instance => {
  if (!instance || !instance.evolution_instance_id) {
    console.warn('⚠️ [EvolutionWS] Instância inválida ao tentar conectar WebSocket')
    return null
  }

  const instanceId = instance.evolution_instance_id

  if (permanentlyMissingInstances.has(instanceId)) {
    console.warn(`🛑 [EvolutionWS] Ignorando conexão para ${instanceId}: instância marcada como órfã no provider`)
    return null
  }

  if (websocketUnavailableInstances.has(instanceId)) {
    console.warn(`🛑 [EvolutionWS] Ignorando conexão para ${instanceId}: WebSocket indisponível no provider (marcação anterior)`)
    return null
  }

  if (activeConnections.has(instanceId)) {
    const entry = activeConnections.get(instanceId)
    entry.instance = instance
    return entry.ws
  }

  if (pendingConnections.has(instanceId)) {
    return pendingConnections.get(instanceId)
  }

  // Criar ou atualizar entrada de controle antes da primeira tentativa
  if (!activeConnections.has(instanceId)) {
    activeConnections.set(instanceId, {
      instance,
      reconnectAttempts: 0,
      manualClose: false,
      firstAttemptAt: Date.now()
    })
  } else {
    const entry = activeConnections.get(instanceId)
    entry.instance = instance
    entry.firstAttemptAt = entry.firstAttemptAt || Date.now()
  }

  const connectPromise = (async () => {
    await configureWebsocket(instanceId, instance)
    return createConnection(instance)
  })()
    .catch(async error => {
      if (error.code === INSTANCE_NOT_FOUND_CODE) {
        const entry = activeConnections.get(instanceId)
        if (error.transient) {
          console.warn(`⚠️ [EvolutionWS] WebSocket para ${instanceId} ainda não disponível no provider. Nova tentativa em breve.`)
          if (entry) {
            entry.permanentError = false
            scheduleReconnect(entry, error.providerDetails || error.message)
          }
          return null
        }

        const outcome = await markInstanceAsMissing(instance, error.providerDetails || error)
        if (entry) {
          if (outcome === 'unknown') {
            entry.permanentError = false
            scheduleReconnect(entry, error.providerDetails || error.message)
          } else {
            entry.permanentError = true
          }
        }
        return null
      } else {
        console.error(`❌ [EvolutionWS] Falha ao iniciar WebSocket para ${instanceId}:`, error.message)
      }
      throw error
    })
    .finally(() => {
      pendingConnections.delete(instanceId)
    })

  pendingConnections.set(instanceId, connectPromise)
  return connectPromise
}

const initialize = async () => {
  try {
    console.log('🔄 [EvolutionWS] Inicializando gerenciador de WebSockets...')
    const instances = await SupabaseInstance.findAll()

    for (const instance of instances) {
      if (!instance?.evolution_instance_id) {
        continue
      }

      if (instance.settings?.websocketUnavailable) {
        websocketUnavailableInstances.add(instance.evolution_instance_id)
        console.warn(`🛑 [EvolutionWS] Ignorando instância ${instance.evolution_instance_id} no bootstrap: WebSocket indisponível no provider (flag persistida)`)
        continue
      }

      const status = instance.status || 'unknown'
      if (['connected', 'connecting'].includes(status)) {
        ensureConnection(instance).catch(error => {
          console.error(`❌ [EvolutionWS] Falha ao conectar WebSocket da instância ${instance.evolution_instance_id}:`, error.message)
        })
      }
    }
  } catch (error) {
    console.error('❌ [EvolutionWS] Erro ao inicializar conexões WebSocket:', error.message)
  }
}

function disconnectInstance(instanceId) {
  const entry = activeConnections.get(instanceId)
  if (!entry) {
    return
  }

  entry.manualClose = true
  if (entry.reconnectTimer) {
    clearTimeout(entry.reconnectTimer)
    entry.reconnectTimer = null
  }

  if (entry.ws && entry.ws.readyState === WebSocket.OPEN) {
    entry.ws.close()
  }

  activeConnections.delete(instanceId)
  console.log(`🛑 [EvolutionWS] WebSocket encerrado para ${instanceId}`)
}

const shutdown = async () => {
  console.log('📴 [EvolutionWS] Encerrando todas as conexões WebSocket...')
  for (const [instanceId, entry] of activeConnections.entries()) {
    entry.manualClose = true
    if (entry.reconnectTimer) {
      clearTimeout(entry.reconnectTimer)
    }
    if (entry.ws && entry.ws.readyState === WebSocket.OPEN) {
      entry.ws.close()
    }
    activeConnections.delete(instanceId)
  }
}

module.exports = {
  initialize,
  ensureConnection,
  disconnectInstance,
  shutdown,
  clearUnavailableFlag
}
