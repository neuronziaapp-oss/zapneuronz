const {
  SupabaseChat,
  SupabaseContact,
  SupabaseMessage,
  SupabaseInstance,
  SupabaseActiveChatWindow
} = require('../models/supabase')
// Aliases for compatibility
const Instance = SupabaseInstance
const Chat = SupabaseChat
const Contact = SupabaseContact
const Message = SupabaseMessage
const ActiveChatWindow = SupabaseActiveChatWindow
const evolutionApi = require('../services/evolutionApi')
const socketService = require('../services/socket')
const redisService = require('../config/redis')
const groupCache = require('../services/groupCache')
const { emitSyncProgress, emitSyncStart, emitSyncComplete } = require('../services/socket')

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const WHATSAPP_GROUP_SUFFIX = '@g.us'
const WHATSAPP_PERSON_SUFFIX = '@s.whatsapp.net'

// Configurações otimizadas para grandes volumes (30k-40k chats)
// const CHAT_SYNC_PAGE_SIZE = 50 // Reduzido de 100 para 50 para evitar timeout
// const CHAT_SYNC_MAX_PAGES = 1000 // Aumentado de 80 para 1000 para suportar 50k chats
// const MESSAGE_SYNC_PAGE_SIZE = 50 // Reduzido de 100 para 50
// const MESSAGE_SYNC_MAX_PAGES = 20 // Reduzido de 80 para 20 (apenas mensagens recentes)
// const SYNC_MAX_RETRIES = 5 // Aumentado de 3 para 5 tentativas
// const SYNC_RETRY_DELAY_BASE_MS = 2000 // Aumentado de 1500ms para 2000ms
// const SYNC_MAX_ERROR_LOGS = 100 // Aumentado de 50 para 100
// const SYNC_BATCH_DELAY_MS = 100 // Delay entre cada chat para não sobrecarregar
// const SYNC_GROUP_INFO_BATCH_SIZE = 3 // Reduzido de 5 para 3 grupos por vez

const CHAT_SYNC_PAGE_SIZE = 100 // Reduzido de 100 para 50 para evitar timeout
const CHAT_SYNC_MAX_PAGES = 1000 // Aumentado de 80 para 1000 para suportar 50k chats
const MESSAGE_SYNC_PAGE_SIZE = 100 // Reduzido de 100 para 50
const MESSAGE_SYNC_MAX_PAGES = 1000 // Reduzido de 80 para 20 (apenas mensagens recentes)
const SYNC_MAX_RETRIES = 5 // Aumentado de 3 para 5 tentativas
const SYNC_RETRY_DELAY_BASE_MS = 2000 // Aumentado de 1500ms para 2000ms
const SYNC_MAX_ERROR_LOGS = 100 // Aumentado de 50 para 100
const SYNC_BATCH_DELAY_MS = 100 // Delay entre cada chat para não sobrecarregar
const SYNC_GROUP_INFO_BATCH_SIZE = 3 // Reduzido de 5 para 3 grupos por vez

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

const shouldRetrySyncRequest = error => {
  if (!error) return false

  const status = error.response?.status || error.status
  if (status === 429 || status === 408 || status === 425) {
    return true
  }

  if (status && status >= 500) {
    return true
  }

  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
    return true
  }

  return false
}
const MESSAGE_STATUS_ALLOWED = new Set(['sent', 'delivered', 'read', 'error'])

const normalizeMessageStatus = (status, fromMe = false) => {
  const fallback = fromMe ? 'sent' : 'delivered'

  if (!status) {
    return fallback
  }

  const candidate = status.toString().trim().toLowerCase()

  if (MESSAGE_STATUS_ALLOWED.has(candidate)) {
    return candidate
  }

  if (candidate === 'received') {
    return fromMe ? 'sent' : 'delivered'
  }

  if (candidate === 'pending' || candidate === 'created' || candidate === 'queued') {
    return fallback
  }

  return fallback
}

const normalizeRemoteJid = identifier => {
  if (!identifier || typeof identifier !== 'string') {
    return null
  }

  const trimmed = identifier.trim()

  if (!trimmed) {
    return null
  }

  if (!trimmed.includes('@')) {
    return trimmed.includes('-')
      ? `${trimmed}${WHATSAPP_GROUP_SUFFIX}`
      : `${trimmed}${WHATSAPP_PERSON_SUFFIX}`
  }

  const [userPart, domainPart] = trimmed.split('@')
  const user = (userPart || '').trim()
  const domain = (domainPart || '').trim().toLowerCase()

  if (!user) {
    return null
  }

  if (!domain) {
    return `${user}${WHATSAPP_PERSON_SUFFIX}`
  }

  if (domain === 'g.us' || domain === 's.whatsapp.net' || domain === 'broadcast') {
    return `${user}@${domain}`
  }

  return `${user}@${domain}`
}

const toIsoStringSafe = value => {
  if (!value) {
    return null
  }

  const dateObj = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(dateObj.getTime())) {
    return null
  }

  return dateObj.toISOString()
}

const getMediaPathFromMessage = message => {
  if (!message) return null
  if (message.imageMessage?.url) return message.imageMessage.url
  if (message.videoMessage?.url) return message.videoMessage.url
  if (message.audioMessage?.url) return message.audioMessage.url
  if (message.documentMessage?.url) return message.documentMessage.url
  if (message.stickerMessage?.url) return message.stickerMessage.url
  return null
}

const getMediaMimeTypeFromMessage = message => {
  if (!message) return null
  if (message.imageMessage?.mimetype) return message.imageMessage.mimetype
  if (message.videoMessage?.mimetype) return message.videoMessage.mimetype
  if (message.audioMessage?.mimetype) return message.audioMessage.mimetype
  if (message.documentMessage?.mimetype) return message.documentMessage.mimetype
  if (message.stickerMessage?.mimetype) return message.stickerMessage.mimetype || 'image/webp'
  return null
}

const getMediaSizeFromMessage = message => {
  if (!message) return null
  if (message.imageMessage?.fileLength) return Number(message.imageMessage.fileLength) || null
  if (message.videoMessage?.fileLength) return Number(message.videoMessage.fileLength) || null
  if (message.audioMessage?.fileLength) return Number(message.audioMessage.fileLength) || null
  if (message.documentMessage?.fileLength) return Number(message.documentMessage.fileLength) || null
  if (message.stickerMessage?.fileLength) return Number(message.stickerMessage.fileLength) || null
  return null
}

const getLocationDataFromMessage = message => {
  const location = message?.locationMessage
  if (!location) return null

  const latitude =
    location.degreesLatitude ?? location.latitude ?? location.lat ?? null
  const longitude =
    location.degreesLongitude ?? location.longitude ?? location.lng ?? null

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return null
  }

  const label =
    location.name || location.address || location.caption || location.description || null
  const thumbnail = location.jpegThumbnail || null
  const url = `https://www.google.com/maps?q=${latitude},${longitude}`

  return {
    latitude,
    longitude,
    label,
    thumbnail,
    url,
    address: location.address || null,
    name: location.name || null,
    description: location.caption || location.description || null
  }
}

const getStickerDataFromMessage = message => {
  const sticker = message?.stickerMessage
  if (!sticker) return null

  return {
    isAnimated: Boolean(sticker.isAnimated),
    isLottie: Boolean(sticker.isLottie),
    mimetype: sticker.mimetype || 'image/webp',
    fileSha256: sticker.fileSha256 || null,
    fileEncSha256: sticker.fileEncSha256 || null,
    mediaKey: sticker.mediaKey || null,
    fileLength: sticker.fileLength || null,
    directPath: sticker.directPath || null
  }
}

const getMessageTypeFromMessage = message => {
  if (!message) return 'unknown'
  if (message.conversation) return 'text'
  if (message.extendedTextMessage) return 'text'
  if (message.imageMessage) return 'image'
  if (message.videoMessage) return 'video'
  if (message.audioMessage) return 'audio'
  if (message.documentMessage) return 'document'
  if (message.stickerMessage) return 'sticker'
  if (message.locationMessage) return 'location'
  if (message.contactMessage) return 'contact'
  return Object.keys(message)[0] || 'unknown'
}

const normalizeMessageType = messageType => {
  if (!messageType) return 'text'
  const type = messageType.toLowerCase()
  if (type === 'stickermessage' || type === 'sticker') return 'sticker'
  if (type === 'imagemessage' || type === 'image') return 'image'
  if (type === 'videomessage' || type === 'video') return 'video'
  if (type === 'audiomessage' || type === 'audio') return 'audio'
  if (type === 'documentmessage' || type === 'document') return 'document'
  if (type === 'locationmessage' || type === 'location') return 'location'
  if (type === 'contactmessage' || type === 'contact') return 'contact'
  return 'text'
}

const extractMessageContentFromMessage = (message, locationMetadata = null) => {
  if (!message) return ''

  if (message.conversation) return message.conversation
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text
  if (message.imageMessage?.caption) return message.imageMessage.caption
  if (message.videoMessage?.caption) return message.videoMessage.caption
  if (message.documentMessage?.caption) return message.documentMessage.caption
  if (message.imageMessage) return '📷 Imagem'
  if (message.videoMessage) return '🎥 Vídeo'
  if (message.audioMessage) return '🎵 Áudio'
  if (message.documentMessage) {
    return `📄 ${message.documentMessage.fileName || 'Documento'}`
  }
  if (message.stickerMessage) return '😄 Sticker'
  if (message.contactMessage) return '👤 Contato'

  if (message.locationMessage) {
    if (locationMetadata) {
      if (locationMetadata.label) {
        return `📍 ${locationMetadata.label}`
      }

      if (
        typeof locationMetadata.latitude === 'number' &&
        typeof locationMetadata.longitude === 'number'
      ) {
        return `📍 ${locationMetadata.latitude.toFixed(6)}, ${locationMetadata.longitude.toFixed(6)}`
      }
    }

    const lat =
      message.locationMessage.degreesLatitude ??
      message.locationMessage.latitude ??
      message.locationMessage.lat
    const lon =
      message.locationMessage.degreesLongitude ??
      message.locationMessage.longitude ??
      message.locationMessage.lng

    if (typeof lat === 'number' && typeof lon === 'number') {
      return `📍 ${lat.toFixed(6)}, ${lon.toFixed(6)}`
    }

    return '📍 Localização'
  }

  return 'Mensagem'
}

const extractMessagesArray = payload => {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload.messages)) return payload.messages
  if (Array.isArray(payload.data)) return payload.data
  if (Array.isArray(payload.messages?.records)) return payload.messages.records
  if (Array.isArray(payload.data?.records)) return payload.data.records
  return []
}

const buildLastMessageSummaryFromEvolution = lastMessage => {
  if (!lastMessage) {
    return null
  }

  const messageObject = lastMessage.message || lastMessage
  const locationMetadata = getLocationDataFromMessage(messageObject)
  const messageTypeRaw =
    locationMetadata ? 'location' : lastMessage.messageType || getMessageTypeFromMessage(messageObject)
  const messageType = normalizeMessageType(messageTypeRaw)
  const content = extractMessageContentFromMessage(messageObject, locationMetadata)
  const fromMe = Boolean(lastMessage.key?.fromMe || lastMessage.fromMe)
  const status = normalizeMessageStatus(lastMessage.status, fromMe)
  const timestamp =
    lastMessage.messageTimestamp
      ? new Date(Number(lastMessage.messageTimestamp) * 1000)
      : lastMessage.timestamp
      ? new Date(lastMessage.timestamp)
      : new Date()

  return {
    id: lastMessage.key?.id || lastMessage.id || null,
    content,
    messageType,
    fromMe,
    timestamp: toIsoStringSafe(timestamp),
    status
  }
}

const buildContactDefaultsFromEvolution = (chatData, remoteJid) => {
  const phone = remoteJid ? remoteJid.split('@')[0] : null
  const nowIso = new Date().toISOString()

  return {
    phone,
    name:
      chatData.name ||
      chatData.displayName ||
      chatData.pushName ||
      chatData.push_name ||
      phone,
    push_name:
      chatData.pushName ||
      chatData.push_name ||
      chatData.name ||
      null,
    profile_pic_url:
      chatData.profilePicUrl ||
      chatData.profile_pic_url ||
      chatData.picture ||
      null,
    is_group: Boolean(chatData.isGroup || remoteJid?.endsWith(WHATSAPP_GROUP_SUFFIX)),
    group_metadata: chatData.groupMetadata || chatData.group_metadata || null,
    last_seen: nowIso
  }
}

const buildNormalizedMessageFromEvolution = messageRecord => {
  if (!messageRecord || typeof messageRecord !== 'object') {
    return null
  }

  const key = messageRecord.key || {}
  const remoteJid = normalizeRemoteJid(key.remoteJid || messageRecord.remoteJid)
  const messageId = key.id || messageRecord.id

  if (!remoteJid || !messageId) {
    return null
  }

  const messageObject = messageRecord.message || {}
  const locationMetadata = getLocationDataFromMessage(messageObject)
  const stickerMetadata = getStickerDataFromMessage(messageObject)
  const rawType = locationMetadata
    ? 'location'
    : messageRecord.messageType || getMessageTypeFromMessage(messageObject)
  const messageType = normalizeMessageType(rawType)
  const content = extractMessageContentFromMessage(messageObject, locationMetadata)
  const mediaPath = getMediaPathFromMessage(messageObject)
  const mediaMimeType = getMediaMimeTypeFromMessage(messageObject)
  const mediaSize = getMediaSizeFromMessage(messageObject)
  const timestampSeconds =
    messageRecord.messageTimestamp ?? messageObject.messageTimestamp ?? messageObject.timestamp
  const timestamp = timestampSeconds
    ? new Date(Number(timestampSeconds) * 1000)
    : new Date()

  const fromMe = Boolean(key.fromMe || messageRecord.fromMe)
  const status = normalizeMessageStatus(messageRecord.status, fromMe)

  const quotedId =
    messageObject?.extendedTextMessage?.contextInfo?.stanzaId ||
    messageObject?.extendedTextMessage?.contextInfo?.stanzaID ||
    null

  return {
    messageId,
    remoteJid,
    fromMe,
    participant: key.participant || messageRecord.participant || null,
    messageType,
    content,
    mediaPath,
    mediaUrl: mediaPath,
    mediaMimeType,
    mediaSize,
    location: locationMetadata,
    sticker: stickerMetadata,
    pushName: messageRecord.pushName || messageObject.pushName || null,
    status,
    timestamp: toIsoStringSafe(timestamp),
    raw: messageRecord,
    quotedMessageId: quotedId
  }
}

const fetchEvolutionChats = async evolutionInstanceName => {
  const chats = []

  for (let page = 1; page <= CHAT_SYNC_MAX_PAGES; page += 1) {
    let attempts = 0
    let batch = null

    while (attempts < SYNC_MAX_RETRIES) {
      try {
        // eslint-disable-next-line no-await-in-loop
        batch = await evolutionApi.getChats(evolutionInstanceName, {
          page,
          limit: CHAT_SYNC_PAGE_SIZE
        })
        break
      } catch (error) {
        attempts += 1
        const retryable = shouldRetrySyncRequest(error)
        console.warn(
          `Falha ao buscar chats (página ${page}, tentativa ${attempts}/${SYNC_MAX_RETRIES}):`,
          error?.message || error
        )

        if (!retryable || attempts >= SYNC_MAX_RETRIES) {
          throw error
        }

        // eslint-disable-next-line no-await-in-loop
        await delay(SYNC_RETRY_DELAY_BASE_MS * attempts)
      }
    }

    const batchArray = Array.isArray(batch) ? batch : batch?.data || []

    if (!Array.isArray(batchArray) || batchArray.length === 0) {
      break
    }

    chats.push(...batchArray)

    if (batchArray.length < CHAT_SYNC_PAGE_SIZE) {
      break
    }
  }

  // Buscar informações de grupos proativamente (otimizado para grandes volumes)
  console.log(`🔍 Buscando informações de ${chats.length} chats...`)
  const groupChats = chats.filter(chat => {
    const remoteJid = chat.id || chat.remoteJid || chat.jid || ''
    return remoteJid.includes('@g.us')
  })
  
  if (groupChats.length > 0) {
    console.log(`👥 Encontrados ${groupChats.length} grupos, buscando nomes da API (lotes de ${SYNC_GROUP_INFO_BATCH_SIZE})...`)
    
    // Buscar informações de grupos em paralelo (lotes menores para não sobrecarregar)
    for (let i = 0; i < groupChats.length; i += SYNC_GROUP_INFO_BATCH_SIZE) {
      const batch = groupChats.slice(i, i + SYNC_GROUP_INFO_BATCH_SIZE)
      
      // eslint-disable-next-line no-await-in-loop
      await Promise.allSettled(
        batch.map(async (groupChat) => {
          const remoteJid = groupChat.id || groupChat.remoteJid || groupChat.jid
          try {
            const groupInfo = await groupCache.getGroupInfo(
              evolutionInstanceName,
              remoteJid,
              () => evolutionApi.getGroupInfo(evolutionInstanceName, remoteJid)
            )
            
            if (groupInfo && groupInfo.subject) {
              // Adicionar metadata ao objeto do chat para ser usado no sync
              groupChat._groupMetadata = {
                subject: groupInfo.subject,
                creation: groupInfo.creation,
                owner: groupInfo.owner,
                desc: groupInfo.desc,
                size: groupInfo.size,
                participants: groupInfo.participants || []
              }
              console.log(`✅ Nome do grupo ${remoteJid}: "${groupInfo.subject}"`)
            }
          } catch (error) {
            console.warn(`⚠️ Falha ao buscar grupo ${remoteJid}:`, error.message)
          }
        })
      )
      
      // Delay entre lotes para não sobrecarregar a API
      if (i + SYNC_GROUP_INFO_BATCH_SIZE < groupChats.length) {
        // eslint-disable-next-line no-await-in-loop
        await delay(500) // 500ms entre cada lote de grupos
      }
    }
    
    console.log(`✅ Busca de nomes de grupos concluída (${groupChats.length} grupos processados)`)
  }

  return chats
}

const fetchEvolutionMessages = async (evolutionInstanceName, remoteJid) => {
  const messages = []

  for (let page = 1; page <= MESSAGE_SYNC_MAX_PAGES; page += 1) {
    const offset = (page - 1) * MESSAGE_SYNC_PAGE_SIZE

    let attempts = 0
    let batchRaw = null

    while (attempts < SYNC_MAX_RETRIES) {
      try {
        // eslint-disable-next-line no-await-in-loop
        batchRaw = await evolutionApi.getChatMessages(
          evolutionInstanceName,
          remoteJid,
          {
            page,
            offset,
            limit: MESSAGE_SYNC_PAGE_SIZE
          }
        )
        break
      } catch (error) {
        attempts += 1
        const retryable = shouldRetrySyncRequest(error)
        console.warn(
          `Falha ao buscar mensagens (${remoteJid}, página ${page}, tentativa ${attempts}/${SYNC_MAX_RETRIES}):`,
          error?.message || error
        )

        if (!retryable || attempts >= SYNC_MAX_RETRIES) {
          throw error
        }

        // eslint-disable-next-line no-await-in-loop
        await delay(SYNC_RETRY_DELAY_BASE_MS * attempts)
      }
    }

    const batch = extractMessagesArray(batchRaw)

    if (batch.length === 0) {
      break
    }

    messages.push(...batch)

    // Delay entre páginas de mensagens para não sobrecarregar
    if (page < MESSAGE_SYNC_MAX_PAGES && batch.length === MESSAGE_SYNC_PAGE_SIZE) {
      // eslint-disable-next-line no-await-in-loop
      await delay(200) // 200ms entre cada página de mensagens
    }

    if (batch.length < MESSAGE_SYNC_PAGE_SIZE) {
      break
    }
  }

  return messages
}

const persistEvolutionMessage = async (
  instance,
  chatRecord,
  contactRecord,
  normalizedMessage
) => {
  if (!normalizedMessage) {
    return {
      created: false,
      error: 'Normalized message inválida'
    }
  }

  try {
    const metadata = {
      rawMessage: normalizedMessage.raw?.message || normalizedMessage.raw || null,
      location: normalizedMessage.location || null,
      sticker: normalizedMessage.sticker || null,
      pushName: normalizedMessage.pushName || null,
      manualSync: true
    }

    if (
      normalizedMessage.mediaPath ||
      normalizedMessage.mediaUrl ||
      normalizedMessage.mediaMimeType ||
      normalizedMessage.mediaSize
    ) {
      metadata.media = {
        path: normalizedMessage.mediaPath || null,
        url: normalizedMessage.mediaUrl || null,
        mimetype: normalizedMessage.mediaMimeType || null,
        size: normalizedMessage.mediaSize || null
      }
    }

    const payload = {
      message_id: normalizedMessage.messageId,
      from_me: Boolean(normalizedMessage.fromMe),
      chat_id: normalizedMessage.remoteJid,
      participant: normalizedMessage.participant,
      message_type: normalizedMessage.messageType || 'text',
      content: normalizedMessage.content,
      media_url: normalizedMessage.mediaUrl || null,
      media_path: normalizedMessage.mediaPath || null,
      media_size: normalizedMessage.mediaSize || null,
      media_mime_type: normalizedMessage.mediaMimeType || null,
      timestamp_msg: normalizedMessage.timestamp || new Date().toISOString(),
      status: normalizeMessageStatus(normalizedMessage.status, normalizedMessage.fromMe),
      quoted_message_id: normalizedMessage.quotedMessageId || null,
      metadata,
      instance_id: instance.id,
      chat_table_id: chatRecord?.id || null,
      contact_id: contactRecord?.id || null
    }

    const record = await SupabaseMessage.create(payload)
    return {
      created: true,
      id: record?.id || null
    }
  } catch (error) {
    console.error('Erro ao persistir mensagem sincronizada:', error)
    return {
      created: false,
      error: error?.message || 'Falha ao salvar mensagem',
      code: error?.code || null
    }
  }
}

const syncEvolutionChat = async (instance, evolutionInstanceName, chatData) => {
  const stats = {
    chatsCreated: 0,
    contactsCreated: 0,
    messagesCreated: 0,
    messagesSkipped: 0,
    lastMessageTimestamp: null,
    chatRemoteJid: null,
    errors: []
  }

  const addError = message => {
    if (stats.errors.length < SYNC_MAX_ERROR_LOGS) {
      stats.errors.push(message)
    }
  }

  const remoteJid = normalizeRemoteJid(
    chatData.remoteJid ||
      chatData.remote_jid ||
      chatData.chatId ||
      chatData.chat_id ||
      chatData.id ||
      chatData.jid
  )

  if (!remoteJid) {
    return stats
  }

  stats.chatRemoteJid = remoteJid
  const contactDefaults = buildContactDefaultsFromEvolution(chatData, remoteJid)
  const phone = contactDefaults.phone

  let contactRecord = null

  if (phone) {
    try {
      const contactResult = await Contact.findOrCreate(phone, instance.id, contactDefaults)
      contactRecord = contactResult?.data || null
      if (contactResult?.created) {
        stats.contactsCreated += 1
      } else if (contactRecord?.id) {
        const updates = {}

        if (contactDefaults.name && contactRecord.name !== contactDefaults.name) {
          updates.name = contactDefaults.name
        }

        if (
          contactDefaults.push_name &&
          contactRecord.push_name !== contactDefaults.push_name
        ) {
          updates.push_name = contactDefaults.push_name
        }

        if (
          contactDefaults.profile_pic_url &&
          contactRecord.profile_pic_url !== contactDefaults.profile_pic_url
        ) {
          updates.profile_pic_url = contactDefaults.profile_pic_url
        }

        if (contactDefaults.is_group !== undefined && contactRecord.is_group !== contactDefaults.is_group) {
          updates.is_group = contactDefaults.is_group
        }
        
        // Atualizar group_metadata para grupos se houver
        if (contactDefaults.is_group && contactDefaults.group_metadata) {
          const currentMetadata = contactRecord.group_metadata
          const newMetadata = contactDefaults.group_metadata
          const hasNoMetadata = !currentMetadata || Object.keys(currentMetadata).length === 0
          const metadataChanged = JSON.stringify(currentMetadata) !== JSON.stringify(newMetadata)
          
          if (hasNoMetadata || metadataChanged) {
            updates.group_metadata = newMetadata
            console.log(`🔄 Atualizando metadata do grupo ${remoteJid}:`, newMetadata)
          }
        }
        
        // Usar metadata pré-carregada do grupo se disponível (já buscada em fetchEvolutionChats)
        if (contactDefaults.is_group && remoteJid.includes('@g.us')) {
          // Primeiro tenta usar metadata que já foi carregada
          if (chatData._groupMetadata && chatData._groupMetadata.subject) {
            updates.group_metadata = {
              ...chatData._groupMetadata,
              fetchedAt: new Date().toISOString()
            }
            console.log(`✅ [Sync] Usando metadata pré-carregada do grupo ${remoteJid}: "${chatData._groupMetadata.subject}"`)
          } else {
            // Fallback: buscar da API se não foi pré-carregada (não deveria acontecer)
            try {
              const groupInfo = await groupCache.getGroupInfo(
                instance.evolution_instance_name,
                remoteJid,
                () => evolutionApi.getGroupInfo(instance.evolution_instance_name, remoteJid)
              )
              
              if (groupInfo && groupInfo.subject) {
                const apiMetadata = {
                  subject: groupInfo.subject,
                  creation: groupInfo.creation,
                  owner: groupInfo.owner,
                  desc: groupInfo.desc,
                  descOwner: groupInfo.descOwner,
                  descId: groupInfo.descId,
                  restrict: groupInfo.restrict,
                  announce: groupInfo.announce,
                  size: groupInfo.size,
                  participants: groupInfo.participants || [],
                  fetchedAt: new Date().toISOString()
                }
                
                updates.group_metadata = apiMetadata
                console.log(`✅ [Sync] Metadata do grupo ${remoteJid} obtida da API (fallback): "${groupInfo.subject}"`)
              }
            } catch (groupError) {
              console.warn(`⚠️ [Sync] Falha ao buscar info do grupo ${remoteJid}:`, groupError.message)
            }
          }
        }

        if (Object.keys(updates).length > 0) {
          try {
            updates.last_seen = contactDefaults.last_seen
            contactRecord = await Contact.update(contactRecord.id, updates)
          } catch (updateError) {
            console.warn('Não foi possível atualizar contato durante sync:', updateError.message)
          }
        }
      }
    } catch (contactError) {
      console.error('Erro ao sincronizar contato:', contactError)
      addError(
        `Contato não sincronizado (${remoteJid}): ${contactError?.message || contactError}`
      )
    }
  }

  const lastMessageSummary = buildLastMessageSummaryFromEvolution(chatData.lastMessage)
  const baseChatPayload = {
    contact_id: contactRecord?.id || null,
    last_message: lastMessageSummary,
    last_message_time: lastMessageSummary?.timestamp || null,
    unread_count: Number(chatData.unreadCount ?? chatData.unread_count ?? 0) || 0,
    pinned: Boolean(chatData.pinned),
    archived: Boolean(chatData.archived),
    muted: Boolean(chatData.muted)
  }

  let chatRecord = null
  try {
    const chatResult = await Chat.findOrCreate(remoteJid, instance.id, baseChatPayload)
    chatRecord = chatResult?.data || null
    if (chatResult?.created) {
      stats.chatsCreated += 1
    }

    if (chatRecord?.id) {
      const updates = {
        ...baseChatPayload
      }

      if (!chatRecord.contact_id && contactRecord?.id) {
        updates.contact_id = contactRecord.id
      }

      try {
        chatRecord = await Chat.update(chatRecord.id, updates)
      } catch (updateError) {
        console.warn('Não foi possível atualizar chat durante sync:', updateError.message)
      }
    }
  } catch (chatError) {
    console.error('Erro ao sincronizar chat:', chatError)
    addError(`Chat não sincronizado (${remoteJid}): ${chatError?.message || chatError}`)
  }

  if (!chatRecord) {
    return stats
  }

  // Buscar mensagens recentes desse chat
  let messages
  try {
    messages = await fetchEvolutionMessages(evolutionInstanceName, remoteJid)
  } catch (messageFetchError) {
    console.error('Erro ao buscar mensagens para chat:', remoteJid, messageFetchError)
    messages = []
    addError(
      `Mensagens não carregadas (${remoteJid}): ${messageFetchError?.message || messageFetchError}`
    )
  }

  if (messages.length === 0) {
    if (lastMessageSummary?.timestamp) {
      stats.lastMessageTimestamp = lastMessageSummary.timestamp
    }
    return stats
  }

  let existingIds = new Set()
  try {
    existingIds = await SupabaseMessage.getMessageIdsByChat(remoteJid, instance.id)
  } catch (existingErr) {
    console.warn('Não foi possível recuperar mensagens existentes:', existingErr.message)
  }

  let latestTimestamp = lastMessageSummary?.timestamp || null

  for (const messageRecord of messages) {
    const normalizedMessage = buildNormalizedMessageFromEvolution(messageRecord)

    if (!normalizedMessage) {
      stats.messagesSkipped += 1
      addError(`Mensagem ignorada (${remoteJid}): normalização falhou`)
      continue
    }

    if (existingIds.has(normalizedMessage.messageId)) {
      stats.messagesSkipped += 1
      continue
    }

    // eslint-disable-next-line no-await-in-loop
    const result = await persistEvolutionMessage(
      instance,
      chatRecord,
      contactRecord,
      normalizedMessage
    )

    if (result.created) {
      stats.messagesCreated += 1
      existingIds.add(normalizedMessage.messageId)
      latestTimestamp = normalizedMessage.timestamp || latestTimestamp
      if (!normalizedMessage.fromMe) {
        // Atualizar contador de não lidas conforme Evolution reporta
        baseChatPayload.unread_count = Number(chatData.unreadCount ?? 0) || 0
      }
    } else {
      stats.messagesSkipped += 1
      if (result.error) {
        addError(
          `Mensagem não salva (${remoteJid}, id ${normalizedMessage.messageId}): ${result.error}`
        )
      }
    }
  }

  if (contactRecord?.id && latestTimestamp) {
    try {
      await Contact.update(contactRecord.id, {
        last_seen: latestTimestamp
      })
    } catch (updateError) {
      console.warn('Não foi possível atualizar last_seen do contato:', updateError.message)
    }
  }

  if (chatRecord?.id) {
    const latest = latestTimestamp || baseChatPayload.last_message_time
    const messageForSummary = messages
      .map(buildNormalizedMessageFromEvolution)
      .filter(Boolean)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]

    const summary = messageForSummary
      ? {
          id: messageForSummary.messageId,
          content: messageForSummary.content,
          messageType: messageForSummary.messageType,
          fromMe: messageForSummary.fromMe,
          timestamp: messageForSummary.timestamp,
          status: messageForSummary.status
        }
      : lastMessageSummary

    try {
      await Chat.update(chatRecord.id, {
        last_message: summary,
        last_message_time: summary?.timestamp || latest,
        unread_count: baseChatPayload.unread_count,
        contact_id: chatRecord.contact_id || contactRecord?.id || null
      })
    } catch (updateError) {
      console.warn('Não foi possível atualizar resumo do chat durante sync:', updateError.message)
      addError(
        `Resumo do chat não atualizado (${remoteJid}): ${updateError?.message || updateError}`
      )
    }
  }

  stats.lastMessageTimestamp = latestTimestamp || lastMessageSummary?.timestamp || null
  return stats
}

const mapChatForResponse = chat => {
  if (!chat) {
    return null
  }

  const contact = chat.contacts || chat.contact || {}
  const chatId = chat.chat_id || chat.chatId || null
  const presence = chat.presence || chat.status || 'offline'
  const isGroup = Boolean(contact.is_group || (chatId ? chatId.endsWith('@g.us') : false))
  
  // Para grupos, tentar extrair o nome do group_metadata
  let chatName = null
  if (isGroup) {
    // Tentar pegar o nome do grupo do metadata
    const groupMetadata = contact.group_metadata || {}
    chatName = groupMetadata.subject || groupMetadata.name || contact.name
    
    // Se ainda não tiver nome, usar o ID do grupo
    if (!chatName) {
      chatName = chatId ? chatId.split('@')[0] : 'Grupo'
    }
  } else {
    // Para conversas individuais, usar o nome do contato
    chatName = contact.name || contact.push_name || contact.phone || (chatId ? chatId.split('@')[0] : null)
  }

  return {
    id: chat.id,
    chatId,
    remoteJid: chatId,
    instanceId: chat.instance_id,
    name: chatName,
    phone: contact.phone || null,
    avatar: contact.profile_pic_url || null,
    lastMessage: chat.last_message || null,
    lastMessageTime: chat.last_message_time || null,
    unreadCount: chat.unread_count || 0,
    pinned: chat.pinned || false,
    archived: chat.archived || false,
    muted: chat.muted || false,
    presence,
    isGroup: isGroup,
    contact
  }
}

const mapActiveChatRecord = record => {
  if (!record) {
    return null
  }

  return {
    id: record.id,
    userId: record.user_id,
    instanceId: record.instance_id,
    chatUuid: record.chat_uuid,
    chatRemoteId: record.chat_remote_id,
    clientId: record.client_id,
    lastActivatedAt: record.last_activated_at,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    chat: mapChatForResponse(record.chat)
  }
}

const inferRemoteIdentifier = identifier => {
  if (!identifier || typeof identifier !== 'string') {
    return null
  }

  let value = identifier.trim()

  if (!value) {
    return null
  }

  if (value.includes('@')) {
    return value
  }

  if (value.includes('-')) {
    return `${value}${WHATSAPP_GROUP_SUFFIX}`
  }

  if (/^\d+$/.test(value)) {
    return `${value}${WHATSAPP_PERSON_SUFFIX}`
  }

  return null
}

class ChatController {
  // Obter lista de chats
  async getChats(req, res) {
    try {
      const { instanceId } = req.params
      const { page = 1, limit = 50, search = '' } = req.query

      // Evitar consultas inválidas
      if (!instanceId || instanceId === 'undefined') {
        return res.status(400).json({ error: 'Parâmetro instanceId inválido' })
      }

      // Verificar se o usuário tem acesso à instância (se não for autenticação via API)
      if (req.user?.role !== 'admin' && req.user?.id) {
        const instance = await Instance.findById(instanceId)
        if (!instance || instance.user_id !== req.user.id) {
          return res.status(404).json({ error: 'Instância não encontrada' })
        }
      }

      const offset = (page - 1) * limit

      // Buscar chats da instância
      let chats = await Chat.findByInstance(instanceId, {
        limit: parseInt(limit),
        offset
      })

      // Filtrar por busca se necessário
      if (search && chats.length > 0) {
        const searchLower = search.toLowerCase()
        chats = chats.filter(chat => {
          const contact = chat.contacts
          if (!contact) return false
          
          return (
            contact.name?.toLowerCase().includes(searchLower) ||
            contact.push_name?.toLowerCase().includes(searchLower) ||
            contact.phone?.includes(search)
          )
        })
      }

      // Contar total para paginação
      const totalChats = await Chat.count(instanceId)

      // Transformar dados para o formato esperado pelo frontend
      const transformedChats = chats.map(mapChatForResponse)

      res.json({
        chats: transformedChats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalChats,
          totalPages: Math.ceil(totalChats / limit),
          hasMore: offset + chats.length < totalChats
        }
      })
    } catch (error) {
      console.error('Erro ao obter chats:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  async getActiveChat(req, res) {
    try {
      const { instanceId } = req.params
      const user = req.user

      if (!user?.id) {
        return res.status(401).json({ error: 'Usuário não autenticado' })
      }

      if (!instanceId || instanceId === 'undefined') {
        return res.status(400).json({ error: 'Parâmetro instanceId inválido' })
      }

      if (user.role !== 'admin' && user.id) {
        const instance = await Instance.findById(instanceId)
        if (!instance || instance.user_id !== user.id) {
          return res.status(404).json({ error: 'Instância não encontrada' })
        }
      }

      const record = await ActiveChatWindow.getForUser({
        userId: user.id,
        instanceId,
        clientId: user.client_id || null
      })

      if (!record || !record.chat) {
        if (record && !record.chat) {
          try {
            await ActiveChatWindow.clearForInstance({
              userId: user.id,
              instanceId
            })
          } catch (cleanupError) {
            console.warn('Não foi possível limpar registro órfão de chat ativo:', cleanupError.message)
          }
        }

        return res.json({ activeChat: null })
      }

      return res.json({ activeChat: mapActiveChatRecord(record) })
    } catch (error) {
      console.error('Erro ao obter chat ativo:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  async setActiveChat(req, res) {
    try {
      const { instanceId } = req.params
      const user = req.user
      const rawChatParam = req.params.chatId || ''
      const {
        chatRemoteId,
        chatName,
        contact: contactPayload = {},
        metadata: metadataPayload = {}
      } = req.body || {}

      if (!user?.id) {
        return res.status(401).json({ error: 'Usuário não autenticado' })
      }

      if (!instanceId || instanceId === 'undefined') {
        return res.status(400).json({ error: 'Parâmetro instanceId inválido' })
      }

      if (user.role !== 'admin' && user.id) {
        const instance = await Instance.findById(instanceId)
        if (!instance || instance.user_id !== user.id) {
          return res.status(404).json({ error: 'Instância não encontrada' })
        }
      }

      let decodedChatParam = rawChatParam
      try {
        decodedChatParam = decodeURIComponent(rawChatParam)
      } catch (decodeError) {
        decodedChatParam = rawChatParam
      }

      const normalizedChatParam =
        typeof decodedChatParam === 'string'
          ? decodedChatParam.trim()
          : ''

      if (!normalizedChatParam && !chatRemoteId) {
        return res.status(400).json({ error: 'Identificador do chat é obrigatório' })
      }

      let chatRecord = null

      if (normalizedChatParam && UUID_REGEX.test(normalizedChatParam)) {
        chatRecord = await Chat.findById(normalizedChatParam)
      }

      const inferredRemoteCandidates = [chatRemoteId, normalizedChatParam, contactPayload.remoteJid]
        .map(inferRemoteIdentifier)
        .filter(Boolean)

      const lookupCandidates = [normalizedChatParam, ...inferredRemoteCandidates]
        .filter(Boolean)
        .filter(candidate => !UUID_REGEX.test(candidate))

      if (!chatRecord) {
        for (const candidate of lookupCandidates) {
          // eslint-disable-next-line no-await-in-loop
          const found = await Chat.findOne(candidate, instanceId)
          if (found) {
            chatRecord = found
            break
          }
        }
      }

      if (!chatRecord && inferredRemoteCandidates.length > 0) {
        const [primaryRemote] = inferredRemoteCandidates
        const isGroup = primaryRemote.endsWith(WHATSAPP_GROUP_SUFFIX)
        const remotePhone = primaryRemote.split('@')[0] || null

        let contactRecord = null

        try {
          if (remotePhone) {
            const contactDefaults = {
              name:
                contactPayload.name ||
                contactPayload.displayName ||
                chatName ||
                null,
              push_name:
                contactPayload.pushName ||
                contactPayload.push_name ||
                chatName ||
                null,
              profile_pic_url:
                contactPayload.avatar ||
                contactPayload.profilePicUrl ||
                contactPayload.profile_pic_url ||
                null,
              is_group: Boolean(isGroup),
              last_seen: new Date().toISOString()
            }

            const { data: ensuredContact } = await Contact.findOrCreate(
              remotePhone,
              instanceId,
              contactDefaults
            )

            contactRecord = ensuredContact
          }
        } catch (contactError) {
          console.warn('Não foi possível criar/garantir contato para chat ativo:', contactError)
        }

        try {
          const chatDefaults = {
            contact_id: contactRecord?.id || null,
            last_message: metadataPayload.lastMessage || null,
            last_message_time:
              metadataPayload.lastMessageTime || new Date().toISOString(),
            unread_count: Number(metadataPayload.unreadCount) || 0,
            pinned: false,
            archived: false
          }

          const createdChat = await Chat.findOrCreate(
            primaryRemote,
            instanceId,
            chatDefaults
          )

          if (createdChat?.data) {
            const enriched = await Chat.findById(createdChat.data.id)
            chatRecord = enriched || createdChat.data
          }
        } catch (chatCreationError) {
          console.warn('Não foi possível criar chat ao definir ativo:', chatCreationError)
        }
      }

      if (!chatRecord) {
        return res.status(404).json({ error: 'Chat não encontrado' })
      }

      if (chatRecord.instance_id && chatRecord.instance_id !== instanceId) {
        return res.status(400).json({ error: 'Chat não pertence à instância informada' })
      }

      const remoteIdentifier =
        chatRecord.chat_id ||
        inferredRemoteCandidates[0] ||
        chatRemoteId ||
        normalizedChatParam

      if (!remoteIdentifier) {
        return res.status(400).json({ error: 'Não foi possível determinar o identificador remoto do chat' })
      }

      const record = await ActiveChatWindow.upsertActiveChat({
        userId: user.id,
        instanceId,
        chatUuid: chatRecord.id,
        chatRemoteId: remoteIdentifier,
        clientId: user.client_id || null
      })

      return res.json({ activeChat: mapActiveChatRecord(record) })
    } catch (error) {
      console.error('Erro ao definir chat ativo:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  // Sincronizar chats do WhatsApp direto da Evolution API
  async syncChats(req, res) {
    try {
      const { instanceId } = req.params

      if (!instanceId || instanceId === 'undefined') {
        return res.status(400).json({ error: 'Parâmetro instanceId inválido' })
      }

      const canSync = await redisService.checkSyncRateLimit(instanceId, 5, 60)
      if (!canSync) {
        return res.status(429).json({
          error: 'Muitas tentativas de sincronização. Aguarde um momento antes de tentar novamente.',
          retryAfter: 60
        })
      }

      const instance = await SupabaseInstance.findById(instanceId)

      if (!instance) {
        return res.status(404).json({ error: 'Instância não encontrada' })
      }

      const isAdmin = req.user?.role === 'admin'
      if (!isAdmin) {
        const instanceUserId = instance.user_id || instance.userId
        const instanceClientId = instance.client_id || instance.clientId
        const matchesUser = Boolean(req.user?.id && instanceUserId && instanceUserId === req.user.id)
        const matchesClient = Boolean(
          req.user?.client_id && instanceClientId && instanceClientId === req.user.client_id
        )

        if (!matchesUser && !matchesClient) {
          return res.status(404).json({ error: 'Instância não encontrada' })
        }
      }

      const evolutionInstanceName =
        instance.evolution_instance_id || instance.evolutionInstanceId || instance.name

      if (!evolutionInstanceName) {
        return res.status(400).json({ error: 'Instância Evolution inválida' })
      }

      console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 INICIANDO SINCRONIZAÇÃO OTIMIZADA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Instância: ${evolutionInstanceName}
Configurações otimizadas para grandes volumes:
  • Tamanho da página de chats: ${CHAT_SYNC_PAGE_SIZE}
  • Máximo de páginas de chats: ${CHAT_SYNC_MAX_PAGES} (suporta até ${CHAT_SYNC_PAGE_SIZE * CHAT_SYNC_MAX_PAGES} chats)
  • Mensagens por chat: ${MESSAGE_SYNC_PAGE_SIZE * MESSAGE_SYNC_MAX_PAGES} (${MESSAGE_SYNC_MAX_PAGES} páginas)
  • Delay entre chats: ${SYNC_BATCH_DELAY_MS}ms a cada 10 chats
  • Delay entre lotes de grupos: 500ms
  • Grupos por lote: ${SYNC_GROUP_INFO_BATCH_SIZE}
  • Cache de grupos: 24 horas
  • Tentativas de retry: ${SYNC_MAX_RETRIES}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `)

      emitSyncStart(instanceId, 'manual')

      await redisService.setSyncProgress(instanceId, {
        type: 'manual',
        status: 'processing',
        step: 'Buscando chats na Evolution API...',
        progress: 10,
        contactsProcessed: 0,
        chatsProcessed: 0,
        messagesProcessed: 0,
        messagesSkipped: 0,
        totalContacts: 0,
        totalChats: 0,
        totalMessages: 0,
        errorsCount: 0
      })

      emitSyncProgress(instanceId, {
        status: 'processing',
        step: 'Buscando chats na Evolution API...',
        progress: 10,
        contactsProcessed: 0,
        chatsProcessed: 0,
        messagesProcessed: 0,
        messagesSkipped: 0,
        totalContacts: 0,
        totalChats: 0,
        totalMessages: 0,
        errorsCount: 0
      })

      const evolutionChats = await fetchEvolutionChats(evolutionInstanceName)
      const totalEvolutionChats = evolutionChats.length

      const syncStats = {
        chatsProcessed: 0,
        chatsCreated: 0,
        contactsCreated: 0,
        messagesCreated: 0,
        messagesSkipped: 0,
        errors: []
      }

      const recordSyncError = message => {
        if (syncStats.errors.length < SYNC_MAX_ERROR_LOGS) {
          syncStats.errors.push(message)
        }
      }

      for (let index = 0; index < evolutionChats.length; index += 1) {
        const chatData = evolutionChats[index]

        // eslint-disable-next-line no-await-in-loop
        const result = await syncEvolutionChat(instance, evolutionInstanceName, chatData)

        syncStats.chatsProcessed += 1
        syncStats.chatsCreated += result.chatsCreated
        syncStats.contactsCreated += result.contactsCreated
        syncStats.messagesCreated += result.messagesCreated
        syncStats.messagesSkipped += result.messagesSkipped

        if (Array.isArray(result.errors) && result.errors.length > 0) {
          result.errors.forEach(recordSyncError)
        }

        // Delay entre cada chat para não sobrecarregar o sistema
        // eslint-disable-next-line no-await-in-loop
        if ((index + 1) % 10 === 0) {
          // A cada 10 chats, pausa de 100ms
          // eslint-disable-next-line no-await-in-loop
          await delay(SYNC_BATCH_DELAY_MS)
        }

        const progressValue = Math.min(
          85,
          10 + Math.round(((index + 1) / Math.max(totalEvolutionChats, 1)) * 70)
        )

        const progressPayload = {
          type: 'manual',
          status: 'processing',
          step: `Sincronizando chat ${index + 1}/${Math.max(totalEvolutionChats, 1)}...`,
          progress: progressValue,
          contactsProcessed: syncStats.contactsCreated,
          chatsProcessed: syncStats.chatsProcessed,
          messagesProcessed: syncStats.messagesCreated,
          messagesSkipped: syncStats.messagesSkipped,
          totalContacts: totalEvolutionChats,
          totalChats: totalEvolutionChats,
          totalMessages: syncStats.messagesCreated,
          errorsCount: syncStats.errors.length
        }

        await redisService.setSyncProgress(instanceId, progressPayload)
        emitSyncProgress(instanceId, progressPayload)
      }

      const totalChatsAfterSync = await Chat.count(instanceId)
      const totalMessagesAfterSync = await Message.count(null, instanceId)

      await SupabaseInstance.update(instance.id, { last_seen: new Date().toISOString() })

      await redisService.setSyncProgress(instanceId, {
        type: 'manual',
        status: 'processing',
        step: 'Finalizando sincronização...',
        progress: 95,
        contactsProcessed: syncStats.contactsCreated,
        chatsProcessed: syncStats.chatsProcessed,
        messagesProcessed: syncStats.messagesCreated,
        messagesSkipped: syncStats.messagesSkipped,
        totalContacts: totalEvolutionChats,
        totalChats: totalEvolutionChats,
        totalMessages: syncStats.messagesCreated,
        errorsCount: syncStats.errors.length
      })

      emitSyncProgress(instanceId, {
        status: 'processing',
        step: 'Finalizando sincronização...',
        progress: 95,
        contactsProcessed: syncStats.contactsCreated,
        chatsProcessed: syncStats.chatsProcessed,
        messagesProcessed: syncStats.messagesCreated,
        messagesSkipped: syncStats.messagesSkipped,
        totalContacts: totalEvolutionChats,
        totalChats: totalEvolutionChats,
        totalMessages: syncStats.messagesCreated,
        errorsCount: syncStats.errors.length
      })

      const io = socketService.getIO()
      if (io) {
        io.to(`instance_${instance.id}`).emit('chats_update', {
          instanceId: instance.id,
          message: 'Chats sincronizados via Evolution API e salvos no Supabase',
          syncedCount: syncStats.chatsProcessed,
          createdChats: syncStats.chatsCreated,
          createdContacts: syncStats.contactsCreated,
          newMessages: syncStats.messagesCreated,
          skippedMessages: syncStats.messagesSkipped,
          totalChats: totalChatsAfterSync,
          totalMessages: totalMessagesAfterSync,
          errorsCount: syncStats.errors.length,
          errorsSample: syncStats.errors.slice(-5)
        })
        
        // Emitir evento adicional para forçar reload dos chats no frontend com nomes atualizados
        console.log(`📡 Emitindo evento chats_reload para instância ${instanceId}`)
        io.to(`instance_${instance.id}`).emit('chats_reload', {
          instanceId: instance.id,
          reason: 'sync_completed',
          timestamp: new Date().toISOString()
        })
        
        // Também reemitir status de conexão para garantir que está atualizado
        console.log(`📡 Reemitindo status de conexão para instância ${instanceId}`)
        io.to(`instance_${instance.id}`).emit('connection_update', {
          instanceId: instance.id,
          status: instance.status || 'connected',
          profileName: instance.profile_name,
          phone: instance.phone
        })
      }

      emitSyncProgress(instanceId, {
        status: 'completed',
        step: 'Sincronização concluída via Evolution API',
        progress: 100,
        contactsProcessed: syncStats.contactsCreated,
        chatsProcessed: syncStats.chatsProcessed,
        messagesProcessed: syncStats.messagesCreated,
        messagesSkipped: syncStats.messagesSkipped,
        totalContacts: totalEvolutionChats,
        totalChats: totalEvolutionChats,
        totalMessages: syncStats.messagesCreated,
        errorsCount: syncStats.errors.length
      })

      emitSyncComplete(instanceId, true)
      await redisService.deleteSyncProgress(instanceId)

      console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ SINCRONIZAÇÃO CONCLUÍDA COM SUCESSO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Instância: ${evolutionInstanceName}
Resultados:
  📊 Chats da Evolution API: ${totalEvolutionChats}
  ✅ Chats processados: ${syncStats.chatsProcessed}
  🆕 Chats criados: ${syncStats.chatsCreated}
  👥 Contatos criados: ${syncStats.contactsCreated}
  💬 Mensagens criadas: ${syncStats.messagesCreated}
  ⏭️  Mensagens ignoradas: ${syncStats.messagesSkipped}
  ❌ Erros: ${syncStats.errors.length}
  
Total no banco após sync:
  📁 Total de chats: ${totalChatsAfterSync}
  📨 Total de mensagens: ${totalMessagesAfterSync}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `)

      res.json({
        message: 'Sincronização concluída com sucesso via Evolution API',
        evolutionChats: totalEvolutionChats,
        chatsProcessed: syncStats.chatsProcessed,
        chatsCreated: syncStats.chatsCreated,
        contactsCreated: syncStats.contactsCreated,
        messagesCreated: syncStats.messagesCreated,
        messagesSkipped: syncStats.messagesSkipped,
        errorsCount: syncStats.errors.length,
        errorsSample: syncStats.errors.slice(0, 10),
        totalChats: totalChatsAfterSync,
        totalMessages: totalMessagesAfterSync
      })
    } catch (error) {
      console.error('Erro ao sincronizar chats:', error)

      if (req.params?.instanceId) {
        emitSyncComplete(req.params.instanceId, false, error.message)
        await redisService.deleteSyncProgress(req.params.instanceId)
      }

      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  // Obter detalhes de um chat específico
  async getChat(req, res) {
    try {
      const { instanceId, chatId } = req.params

      const instance = await Instance.findOne({
        where: {
          id: instanceId,
          ...(req.user.role !== 'admin' ? { userId: req.user.id } : {})
        }
      })

      if (!instance) {
        return res.status(404).json({ error: 'Instância não encontrada' })
      }

      const chat = await Chat.findOne({
        where: {
          id: chatId,
          instanceId
        },
        include: [Contact]
      })

      if (!chat) {
        return res.status(404).json({ error: 'Chat não encontrado' })
      }

      res.json({ chat })
    } catch (error) {
      console.error('Erro ao obter chat:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  // Marcar mensagens de um chat como lidas
  async markAsRead(req, res) {
    try {
      const { instanceId, chatId } = req.params
      const { readMessages } = req.body || {}

      if (!instanceId) {
        return res.status(400).json({ error: 'Instância inválida' })
      }

      const instance = await Instance.findOne({
        where: {
          id: instanceId,
          ...(req.user?.role !== 'admin' && req.user?.id
            ? { userId: req.user.id }
            : {})
        }
      })

      if (!instance) {
        return res.status(404).json({ error: 'Instância não encontrada' })
      }

      // Tentar localizar o chat via diferentes identificadores
      let chat = null
      if (chatId) {
        chat = await Chat.findById(chatId)

        if (!chat && chatId.includes('@')) {
          chat = await Chat.findOne(chatId, instanceId)
        }

        if (!chat && /^\d+$/.test(chatId)) {
          const remoteFromPhone = `${chatId}@s.whatsapp.net`
          chat = await Chat.findOne(remoteFromPhone, instanceId)
        }
      }

      const defaultRemoteJid = (() => {
        if (Array.isArray(readMessages) && readMessages[0]?.remoteJid) {
          return readMessages[0].remoteJid
        }
        if (chat?.chat_id) {
          return chat.chat_id
        }
        if (chat?.contacts?.phone) {
          return `${chat.contacts.phone}@s.whatsapp.net`
        }
        if (chatId?.includes('@')) {
          return chatId
        }
        if (chatId && /^\d+$/.test(chatId)) {
          return `${chatId}@s.whatsapp.net`
        }
        return null
      })()

      let messagesToMark = Array.isArray(readMessages) ? [...readMessages] : []

      // Fallback: buscar últimas mensagens armazenadas
      if ((!messagesToMark || messagesToMark.length === 0) && chat?.chat_id) {
        const recentMessages = await Message.findByChatId(chat.chat_id, instanceId, {
          limit: 10
        })

        messagesToMark = recentMessages
          .filter(msg => !msg.from_me && msg.message_id)
          .map(msg => ({
            remoteJid: defaultRemoteJid,
            id: msg.message_id,
            fromMe: false
          }))
      }

      const normalizedMessages = (messagesToMark || [])
        .map(message => ({
          remoteJid: message.remoteJid || message.remote_jid || defaultRemoteJid,
          id: message.id || message.messageId || message.message_id,
          fromMe: Boolean(message.fromMe)
        }))
        .filter(message => message.remoteJid && message.id)

      if (normalizedMessages.length === 0) {
        return res.status(400).json({ error: 'Nenhuma mensagem válida para marcar como lida' })
      }

      const evolutionInstanceName =
        instance.evolution_instance_id ||
        instance.evolutionInstanceId ||
        instance.name

      await evolutionApi.markAsRead(evolutionInstanceName, normalizedMessages)

      if (chat?.id) {
        await Chat.update(chat.id, { unread_count: 0 })
      }

      res.status(201).json({ message: 'Read messages', read: 'success' })
    } catch (error) {
      console.error('Erro ao marcar chat como lido:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  // Arquivar/desarquivar chat
  async toggleArchive(req, res) {
    try {
      const { instanceId, chatId } = req.params
      const { archived } = req.body

      const instance = await Instance.findOne({
        where: {
          id: instanceId,
          ...(req.user.role !== 'admin' ? { userId: req.user.id } : {})
        }
      })

      if (!instance) {
        return res.status(404).json({ error: 'Instância não encontrada' })
      }

      const chat = await Chat.findOne({
        where: { id: chatId, instanceId }
      })

      if (!chat) {
        return res.status(404).json({ error: 'Chat não encontrado' })
      }

      await chat.update({ archived: archived === true })

      res.json({
        message: `Chat ${archived ? 'arquivado' : 'desarquivado'} com sucesso`
      })
    } catch (error) {
      console.error('Erro ao arquivar/desarquivar chat:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  // Fixar/desfixar chat
  async togglePin(req, res) {
    try {
      const { instanceId, chatId } = req.params
      const { pinned } = req.body

      const instance = await Instance.findOne({
        where: {
          id: instanceId,
          ...(req.user.role !== 'admin' ? { userId: req.user.id } : {})
        }
      })

      if (!instance) {
        return res.status(404).json({ error: 'Instância não encontrada' })
      }

      const chat = await Chat.findOne({
        where: { id: chatId, instanceId }
      })

      if (!chat) {
        return res.status(404).json({ error: 'Chat não encontrado' })
      }

      await chat.update({ pinned: pinned === true })

      res.json({
        message: `Chat ${pinned ? 'fixado' : 'desfixado'} com sucesso`
      })
    } catch (error) {
      console.error('Erro ao fixar/desfixar chat:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  // Definir presença (digitando, gravando, etc.)
  async setPresence(req, res) {
    try {
      const { instanceId, chatId } = req.params
      const { presence = 'composing' } = req.body // composing, recording, paused

      const instance = await Instance.findOne({
        where: {
          id: instanceId,
          ...(req.user.role !== 'admin' ? { userId: req.user.id } : {})
        }
      })

      if (!instance) {
        return res.status(404).json({ error: 'Instância não encontrada' })
      }

      const chat = await Chat.findOne({
        where: { id: chatId, instanceId },
        include: [Contact]
      })

      if (!chat) {
        return res.status(404).json({ error: 'Chat não encontrado' })
      }

      await evolutionApi.setPresence(
        instance.evolutionInstanceId,
        chat.Contact.phone,
        presence
      )

      res.json({ message: 'Presença definida com sucesso' })
    } catch (error) {
      console.error('Erro ao definir presença:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }
}

module.exports = new ChatController()


