const { SupabaseInstance, SupabaseContact, SupabaseChat, SupabaseMessage } = require('../models/supabase')
const { getIO, emitSyncStart, emitSyncProgress, emitSyncComplete } = require('../services/socket')
const evolutionApi = require('../services/evolutionApi')
// ❌ WebSocket desabilitado - usando apenas webhook
// const evolutionWebsocket = require('../services/evolutionWebsocket')
const groupCache = require('../services/groupCache')
const redisService = require('../config/redis')

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

class WebhookController {
  constructor() {
    // Bind methods to ensure correct 'this' context
    this.handleWebhook = this.handleWebhook.bind(this)
    this.handleQRCodeUpdate = this.handleQRCodeUpdate.bind(this)
    this.handleConnectionUpdate = this.handleConnectionUpdate.bind(this)
    this.handleMessagesUpsert = this.handleMessagesUpsert.bind(this)
    this.handleMessagesUpdate = this.handleMessagesUpdate.bind(this)
    this.handleContactsUpdate = this.handleContactsUpdate.bind(this)
    this.handleChatsUpdate = this.handleChatsUpdate.bind(this)
    this.handlePresenceUpdate = this.handlePresenceUpdate.bind(this)
  }

  // Processar webhooks do Evolution API
  async handleWebhook(req, res) {
    try {
      // Adicionar headers para ngrok (evitar tela de greetings)
      res.setHeader('ngrok-skip-browser-warning', 'true');
      res.setHeader('User-Agent', 'WppWeb-Webhook/1.0');

      const { instanceName } = req.params
      const eventData = req.body

      console.log(`📥 WEBHOOK RECEBIDO - Instância: ${instanceName}`)
      console.log(`📥 Evento: ${eventData.event}`)
      
      // ⚠️ LOG ESPECIAL: Detectar mensagens privadas
      if (eventData.event === 'messages.upsert') {
        const msgData = eventData.data;
        const remoteJid = msgData?.key?.remoteJid || msgData?.remoteJid;
        const isGroup = remoteJid?.endsWith('@g.us');
        console.log(`🔍 [WEBHOOK] Tipo de mensagem: ${isGroup ? 'GRUPO 👥' : 'PRIVADA 👤'}`);
        console.log(`🔍 [WEBHOOK] RemoteJid: ${remoteJid}`);
      }
      
      // Clone the data and suppress large base64 string
      const logData = JSON.parse(JSON.stringify(eventData.data || {}));
      if (logData.qrcode && logData.qrcode.base64) {
        logData.qrcode.base64 = '[BASE64_QR_CODE_SUPPRESSED]';
      }
      console.log(`📥 Dados:`, JSON.stringify(logData, null, 2));

      // Encontrar instância pelo Evolution ID
      const instance = await SupabaseInstance.findByEvolutionId(instanceName)

      if (!instance) {
        console.warn(`⚠️  Webhook recebido para instância desconhecida: ${instanceName}`)
        console.warn(`⚠️  Isso pode indicar instâncias criadas fora do sistema`)
        console.warn(`⚠️  Respondendo 200 OK para evitar spam de tentativas`)
        return res.status(200).json({ 
          success: true, 
          message: 'Webhook recebido mas instância não está no banco de dados' 
        })
      }

      const io = getIO()

      // Processar diferentes tipos de eventos
      const evt = (eventData.event || '').toUpperCase().replace('.', '_')
      console.log(`🔄 Evento normalizado: "${eventData.event}" → "${evt}"`)
      
      switch (evt) {
        case 'QRCODE_UPDATED':
          await this.handleQRCodeUpdate(instance, eventData, io)
          break

        case 'CONNECTION_UPDATE':
          await this.handleConnectionUpdate(instance, eventData, io)
          break

        case 'MESSAGES_UPSERT':
          await this.handleMessagesUpsert(instance, eventData, io)
          break

        case 'MESSAGES_UPDATE':
          await this.handleMessagesUpdate(instance, eventData, io)
          break

        case 'CONTACTS_UPSERT':
        case 'CONTACTS_UPDATE':
          await this.handleContactsUpdate(instance, eventData, io)
          break

        case 'CHATS_UPSERT':
        case 'CHATS_UPDATE':
          await this.handleChatsUpdate(instance, eventData, io)
          break

        case 'PRESENCE_UPDATE':
          await this.handlePresenceUpdate(instance, eventData, io)
          break

        case 'APPLICATION_STARTUP':
          console.log('⚙️ Evolution API iniciou e confirmou webhook ativo')
          break

        default:
          console.log(`Evento não processado: ${eventData.event}`)
      }

      res.status(200).json({ success: true })
    } catch (error) {
      console.error('Erro ao processar webhook:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  // Atualizar QR Code
  async handleQRCodeUpdate(instance, eventData, io) {
    try {
      const qrData = eventData.data?.qrcode
      if (!qrData) return

      console.log('📱 Atualizando QR Code...')
      
      // Atualizar instância no banco
      await SupabaseInstance.update(instance.id, {
        status: 'qr_code',
        qr_code: qrData.code,
        updated_at: new Date().toISOString()
      })

      // Emitir para frontend via Socket.IO
      io.to(`instance_${instance.id}`).emit('qrcode_updated', {
        instanceId: instance.id,
        qrCode: qrData.code,
        qrCodeBase64: qrData.base64
      })

      console.log('✅ QR Code atualizado')
    } catch (error) {
      console.error('Erro ao atualizar QR Code:', error)
    }
  }

  // Atualizar status de conexão
  async handleConnectionUpdate(instance, eventData, io) {
    try {
      const connectionData = eventData.data?.connection
      if (!connectionData) return

      console.log('🔌 Atualizando status de conexão:', connectionData.state)
      
      let status = 'disconnected'
      let profileName = null
      let phone = null

      switch (connectionData.state) {
        case 'open':
          status = 'connected'
          // Tentar extrair informações do número
          if (connectionData.instance?.profileName) {
            profileName = connectionData.instance.profileName
          }
          if (connectionData.instance?.ownerJid) {
            phone = connectionData.instance.ownerJid.replace('@s.whatsapp.net', '')
          }
          break
        case 'connecting':
          status = 'connecting'
          break
        case 'close':
        default:
          status = 'disconnected'
          break
      }

      // Atualizar no banco
      const updateData = {
        status,
        updated_at: new Date().toISOString()
      }
      
      if (profileName) updateData.profile_name = profileName
      if (phone) updateData.phone = phone

      const dbInstance = await SupabaseInstance.update(instance.id, updateData)
      const instanceRecord = dbInstance || { ...instance, ...updateData }

      // Emitir para frontend
      io.to(`instance_${instanceRecord.id}`).emit('connection_update', {
        instanceId: instanceRecord.id,
        status,
        profileName,
        phone
      })

      console.log(`✅ Status de conexão atualizado: ${status}`)

      // Se a instância foi conectada, garantir WebSocket e iniciar sincronização automática
      if (status === 'connected') {
        console.log(`🚀 Instância conectada, garantindo WebSocket e sincronização: ${instanceRecord.evolution_instance_id}`)

        try {
          const wsResult = await evolutionApi.setWebsocketWithRetry(instanceRecord.evolution_instance_id)
          if (wsResult) {
            console.log('✅ WebSocket confirmado na Evolution API após conexão')
            await evolutionWebsocket.clearUnavailableFlag(instanceRecord)
          }
        } catch (wsError) {
          console.error('❌ Erro ao garantir WebSocket após conexão:', wsError.response?.data || wsError.message)
        }

        evolutionWebsocket.ensureConnection(instanceRecord).catch(wsErr => {
          console.error(`❌ Falha ao iniciar WebSocket local para ${instanceRecord.evolution_instance_id}:`, wsErr.message)
        })

        // Aguardar um pouco para estabilizar a conexão antes da sincronização
        setTimeout(async () => {
          try {
            const ChatController = require('./ChatController')
            await ChatController.syncChats({ params: { instanceId: instanceRecord.id }, user: { role: 'admin' } }, { json: () => {} })
            console.log(`✅ Sincronização automática concluída para instância: ${instanceRecord.id}`)
          } catch (syncError) {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      console.error(`❌ Erro na sincronização automática para instância ${instanceRecord.id}:`, syncError.message)
          }
        }, 3000)
      }
    } catch (error) {
      console.error('Erro ao atualizar conexão:', error)
    }
  }

  // Processar novas mensagens
  async handleMessagesUpsert(instance, eventData, io) {
    try {
      // O formato do evento messages.upsert pode variar
      // Ele pode ter uma lista de mensagens em eventData.data.messages
      // Ou pode ter a mensagem diretamente em eventData.data
      
      let messages = [];
      
      if (eventData.data && Array.isArray(eventData.data.messages)) {
        // Formato com array de mensagens
        messages = eventData.data.messages;
      } else if (eventData.data && eventData.data.key && eventData.data.message) {
        // Mensagem única diretamente no objeto data
        messages = [eventData.data];
      } else if (Array.isArray(eventData.data)) {
        // Mensagens em array direto no data
        messages = eventData.data;
      }
      
      if (messages.length === 0) {
        console.log('⚠️ Nenhuma mensagem encontrada no evento:', JSON.stringify(eventData.data));
        return;
      }

      console.log(`💬 Processando ${messages.length} mensagem(ns)...`);

      for (const msg of messages) {
        await this.processMessage(instance, msg, io);
      }
    } catch (error) {
      console.error('Erro ao processar mensagens:', error);
    }
  }

  // Processar uma mensagem individual  
  async processMessage(instance, msg, io) {
    try {
      // Log mais detalhado da mensagem
      console.log(`📝 Processando mensagem - ID: ${msg.key?.id}, From: ${msg.key?.remoteJid}, FromMe: ${msg.key?.fromMe}`)
      console.log(`💬 Timestamp: ${msg.messageTimestamp}, Type: ${this.getMessageType(msg.message)}`)
      
      // Processar dados da mensagem para o formato esperado pelo frontend
      const locationMetadata = this.getLocationData(msg.message)
      const rawMessageType = locationMetadata
        ? 'location'
        : msg.messageType || this.getMessageType(msg.message)
      const messageType = this.normalizeMessageType(rawMessageType)
      const content = this.extractMessageContent(msg.message, locationMetadata)
      
      // Normalizar o JID para obter o chatId
      let chatId = msg.key.remoteJid
      if (chatId.includes('@')) {
        chatId = chatId.split('@')[0]
      }
      
      // Verificar se é mensagem de grupo
      const isGroupMessage = msg.key.remoteJid?.endsWith('@g.us')
      const participant = msg.key.participant || null
      
      console.log(`🔍 Mensagem de ${isGroupMessage ? 'GRUPO' : 'contato individual'}`)
      if (isGroupMessage) {
        console.log(`👥 Participante: ${participant}`)
        console.log(`👤 Push Name: ${msg.pushName}`)
      }
      
      // Formatar mensagem para o frontend
      const formattedMessage = {
        id: msg.key.id,
        key: msg.key,
        fromMe: msg.key.fromMe,
        chatId: chatId,
        remoteJid: msg.key.remoteJid,
        messageType,
        content,
        timestamp: new Date(msg.messageTimestamp * 1000).toISOString(),
        status: normalizeMessageStatus(msg.status || msg.key.status || null, msg.key.fromMe),
        pushName: msg.pushName || chatId,
        participant: participant,
        isGroupMessage: isGroupMessage,
        source: 'webhook',
        mediaPath: this.getMediaPath(msg.message),
        mediaMimeType: this.getMediaMimeType(msg.message),
        message: msg.message || null,
        location: locationMetadata,
        mapsUrl: locationMetadata?.url || null,
        locationThumbnail: locationMetadata?.thumbnail || null,
        sticker: this.getStickerData(msg.message)
      }

      const mediaSize = this.getMediaSize(msg.message)

      try {
        await this.persistMessageToSupabase(instance, {
          raw: msg,
          messageType,
          content,
          timestamp: formattedMessage.timestamp,
          status: formattedMessage.status,
          mediaPath: formattedMessage.mediaPath,
          mediaMimeType: formattedMessage.mediaMimeType,
          mediaUrl: formattedMessage.mediaPath || null,
          mediaSize,
          location: locationMetadata,
          sticker: formattedMessage.sticker,
          pushName: formattedMessage.pushName
        })
      } catch (persistError) {
        console.error('Erro ao persistir mensagem no Supabase:', persistError)
      }
      
      // SEMPRE emitir mensagem via Socket.IO para frontend (mesmo se já existe)
      console.log(`🔔 Emitindo evento message_received para instance_${instance.id}`)
      console.log(`📨 Tipo: ${isGroupMessage ? 'GRUPO' : 'PRIVADA'}`)
      console.log(`📨 ChatId: ${chatId}`)
      console.log(`📨 RemoteJid: ${msg.key.remoteJid}`)
      console.log(`📨 FromMe: ${msg.key.fromMe}`)
      console.log(`📨 Content: "${formattedMessage.content?.slice(0, 50)}"`)
      
      io.to(`instance_${instance.id}`).emit('message_received', {
        instanceId: instance.id,
        chatId: chatId,
        message: formattedMessage
      })
      
      console.log(`✅ Evento message_received emitido: chatId=${chatId}, isGroup=${isGroupMessage}`)
      
    } catch (error) {
      console.error('Erro ao processar mensagem:', error)
    }
  }
  
  // Helper para determinar tipo da mensagem
  getMessageType(message) {
    if (!message) return 'unknown';
    
    if (message.conversation) return 'text';
    if (message.extendedTextMessage) return 'text';
    if (message.imageMessage) return 'image';
    if (message.videoMessage) return 'video';
    if (message.audioMessage) return 'audio';
    if (message.documentMessage) return 'document';
    if (message.stickerMessage) return 'sticker';
    if (message.locationMessage) return 'location';
    if (message.contactMessage) return 'contact';
    
    return Object.keys(message)[0] || 'unknown';
  }
  
  // Helper para extrair conteúdo da mensagem
  extractMessageContent(message, locationMetadata = null) {
    if (!message) return '';
    
    if (message.conversation) return message.conversation;
    if (message.extendedTextMessage) return message.extendedTextMessage.text;
    if (message.imageMessage) return message.imageMessage.caption || 'Imagem';
    if (message.videoMessage) return message.videoMessage.caption || 'Vídeo';
    if (message.audioMessage) return 'Áudio';
    if (message.documentMessage) return message.documentMessage.fileName || 'Documento';
  if (message.stickerMessage) return '😄 Sticker';
    if (message.locationMessage) {
      if (locationMetadata) {
        if (locationMetadata.label) {
          return `📍 ${locationMetadata.label}`;
        }

        if (typeof locationMetadata.latitude === 'number' && typeof locationMetadata.longitude === 'number') {
          return `📍 ${locationMetadata.latitude.toFixed(6)}, ${locationMetadata.longitude.toFixed(6)}`;
        }
      }

      const lat = message.locationMessage.degreesLatitude ?? message.locationMessage.latitude;
      const lon = message.locationMessage.degreesLongitude ?? message.locationMessage.longitude;

      if (typeof lat === 'number' && typeof lon === 'number') {
        return `📍 ${lat.toFixed(6)}, ${lon.toFixed(6)}`;
      }

      return '📍 Localização';
    }
    if (message.contactMessage) return message.contactMessage.displayName || 'Contato';
    
    return 'Mensagem';
  }

  getMediaPath(message) {
    if (!message) return null;

    if (message.imageMessage?.url) return message.imageMessage.url;
    if (message.videoMessage?.url) return message.videoMessage.url;
    if (message.audioMessage?.url) return message.audioMessage.url;
    if (message.documentMessage?.url) return message.documentMessage.url;
    if (message.stickerMessage?.url) return message.stickerMessage.url;

    return null;
  }

  getMediaMimeType(message) {
    if (!message) return null;

    if (message.imageMessage?.mimetype) return message.imageMessage.mimetype;
    if (message.videoMessage?.mimetype) return message.videoMessage.mimetype;
    if (message.audioMessage?.mimetype) return message.audioMessage.mimetype;
    if (message.documentMessage?.mimetype) return message.documentMessage.mimetype;
    if (message.stickerMessage?.mimetype) return message.stickerMessage.mimetype || 'image/webp';

    return null;
  }

  getMediaSize(message) {
    if (!message) return null;

    if (message.imageMessage?.fileLength) return Number(message.imageMessage.fileLength) || null;
    if (message.videoMessage?.fileLength) return Number(message.videoMessage.fileLength) || null;
    if (message.audioMessage?.fileLength) return Number(message.audioMessage.fileLength) || null;
    if (message.documentMessage?.fileLength) return Number(message.documentMessage.fileLength) || null;
    if (message.stickerMessage?.fileLength) return Number(message.stickerMessage.fileLength) || null;

    return null;
  }

  getStickerData(message) {
    const sticker = message?.stickerMessage;
    if (!sticker) return null;

    return {
      isAnimated: Boolean(sticker.isAnimated),
      isLottie: Boolean(sticker.isLottie),
      mimetype: sticker.mimetype || 'image/webp',
      fileSha256: sticker.fileSha256 || null,
      fileEncSha256: sticker.fileEncSha256 || null,
      mediaKey: sticker.mediaKey || null,
      fileLength: sticker.fileLength || null,
      directPath: sticker.directPath || null
    };
  }

  normalizeMessageType(messageType) {
    if (!messageType) return 'text';

    const type = messageType.toString().toLowerCase();

    if (type === 'conversation' || type === 'text' || type === 'extendedtextmessage') {
      return 'text';
    }

    if (type === 'imagemessage' || type === 'image') {
      return 'image';
    }

    if (type === 'videomessage' || type === 'video') {
      return 'video';
    }

    if (type === 'audiomessage' || type === 'audio') {
      return 'audio';
    }

    if (type === 'documentmessage' || type === 'document') {
      return 'document';
    }

    if (type === 'stickermessage' || type === 'sticker') {
      return 'sticker';
    }

    if (type === 'locationmessage' || type === 'location') {
      return 'location';
    }

    if (type === 'contactmessage' || type === 'contact') {
      return 'contact';
    }

    if (type === 'system' || type === 'notification') {
      return 'system';
    }

    return 'text';
  }

  getLocationData(message) {
    const location = message?.locationMessage;
    if (!location) return null;

    const latitude = location.degreesLatitude ?? location.latitude ?? location.lat ?? null;
    const longitude = location.degreesLongitude ?? location.longitude ?? location.lng ?? null;

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return null;
    }

    const label = location.name || location.address || location.caption || location.description || null;
    const thumbnail = location.jpegThumbnail || null;
    const url = `https://www.google.com/maps?q=${latitude},${longitude}`;

    return {
      latitude,
      longitude,
      label,
      thumbnail,
      url,
      address: location.address || null,
      name: location.name || null,
      description: location.caption || location.description || null
    };
  }

  normalizeRemoteJid(identifier) {
    if (!identifier || typeof identifier !== 'string') {
      return null;
    }

    let value = identifier.trim();

    if (!value) {
      return null;
    }

    if (!value.includes('@')) {
      return value.includes('-') ? `${value}@g.us` : `${value}@s.whatsapp.net`;
    }

    const [userPart, domainPart] = value.split('@');
    const user = (userPart || '').trim();
    const domain = (domainPart || 's.whatsapp.net').toLowerCase();

    if (!user) {
      return null;
    }

    if (domain === 'g.us') {
      return `${user}@g.us`;
    }

    if (domain === 's.whatsapp.net') {
      return `${user}@s.whatsapp.net`;
    }

    if (domain === 'broadcast') {
      return `${user}@broadcast`;
    }

    return `${user}@${domain}`;
  }

  async persistMessageToSupabase(instance, normalized) {
    try {
      const rawMessage = normalized?.raw;
      const messageKey = rawMessage?.key;

      if (!messageKey?.remoteJid || !messageKey?.id) {
        return;
      }

      const remoteJid = this.normalizeRemoteJid(messageKey.remoteJid);
      if (!remoteJid) {
        return;
      }

      const phoneNumber = remoteJid.includes('@') ? remoteJid.split('@')[0] : remoteJid;
      const isGroup = remoteJid.endsWith('@g.us');
  const timestampIso = normalized.timestamp || new Date().toISOString();
  const status = normalizeMessageStatus(normalized.status, messageKey.fromMe);

      // Para grupos, tentar extrair metadata do grupo
      let groupMetadata = null
      if (isGroup) {
        // Tentar extrair metadata da mensagem raw
        groupMetadata = rawMessage?.chat || rawMessage?.groupMetadata || null
        
        // Se não houver metadata, criar um objeto básico com o que temos
        if (!groupMetadata) {
          groupMetadata = {
            id: phoneNumber,
            subject: normalized.pushName || phoneNumber
          }
        }
      }

      const contactDefaults = {
        name: normalized.pushName || phoneNumber,
        push_name: normalized.pushName || null,
        profile_pic_url: rawMessage?.profilePicUrl || null,
        is_group: isGroup,
        group_metadata: groupMetadata,
        last_seen: timestampIso
      };

      const contactResult = await SupabaseContact.findOrCreate(phoneNumber, instance.id, contactDefaults);
      let contact = contactResult.data;

      // Atualizar contato se necessário
      if (contact) {
        const updateData = { last_seen: timestampIso }
        let needsUpdate = false
        
        // Atualizar pushName se mudou
        if (normalized.pushName && normalized.pushName !== contact.push_name) {
          updateData.push_name = normalized.pushName
          updateData.name = contact.name || normalized.pushName
          needsUpdate = true
        }
        
        // Atualizar group_metadata para grupos se estiver vazio ou mudou
        if (isGroup && groupMetadata) {
          const currentMetadata = contact.group_metadata
          const hasNoMetadata = !currentMetadata || Object.keys(currentMetadata).length === 0
          const metadataChanged = JSON.stringify(currentMetadata) !== JSON.stringify(groupMetadata)
          
          if (hasNoMetadata || metadataChanged) {
            updateData.group_metadata = groupMetadata
            needsUpdate = true
          }
        }
        
        // Buscar informações atualizadas do grupo da Evolution API usando cache
        if (isGroup && remoteJid.includes('@g.us')) {
          console.log(`🔍 [Webhook] Tentando buscar nome do grupo ${remoteJid}...`)
          console.log(`📝 [Webhook] Instance ID: ${instance.evolution_instance_id}`)
          try {
            const groupInfo = await groupCache.getGroupInfo(
              instance.evolution_instance_id,
              remoteJid,
              () => evolutionApi.getGroupInfo(instance.evolution_instance_id, remoteJid)
            )
            
            if (groupInfo && groupInfo.subject) {
              // Atualizar metadata com informações da API (sobrescreve webhook metadata)
              updateData.group_metadata = {
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
              needsUpdate = true
              console.log(`✅ [Webhook] Metadata do grupo ${remoteJid} obtida da API: "${groupInfo.subject}"`)
            }
          } catch (groupError) {
            console.warn(`⚠️ [Webhook] Falha ao buscar info do grupo ${remoteJid}:`, groupError.message)
          }
        }
        
        if (needsUpdate) {
          try {
            contact = await SupabaseContact.update(contact.id, updateData);
          } catch (updateError) {
            console.warn('Falha ao atualizar contato no Supabase:', updateError.message || updateError);
          }
        } else {
          // Apenas atualizar last_seen se não houver outras mudanças
          try {
            await SupabaseContact.update(contact.id, { last_seen: timestampIso });
          } catch (updateError) {
            console.warn('Falha ao atualizar last_seen do contato:', updateError.message || updateError);
          }
        }
      }

      const lastMessageSummary = {
        id: messageKey.id,
        content: normalized.content,
        messageType: normalized.messageType,
        fromMe: Boolean(messageKey.fromMe),
        timestamp: timestampIso,
        status
      };

      const chatDefaults = {
        contact_id: contact?.id || null,
        last_message: lastMessageSummary,
        last_message_time: timestampIso,
        unread_count: messageKey.fromMe ? 0 : 1,
        pinned: false,
        archived: false
      };

      const chatResult = await SupabaseChat.findOrCreate(remoteJid, instance.id, chatDefaults);
      const chatRecord = chatResult.data;

      if (contact?.id && chatRecord && !chatRecord.contact_id) {
        try {
          await SupabaseChat.update(chatRecord.id, { contact_id: contact.id });
        } catch (updateError) {
          console.warn('Falha ao vincular contato ao chat:', updateError.message || updateError);
        }
      }

      const existingMessage = await SupabaseMessage.findByMessageId(messageKey.id, instance.id);
      
      if (existingMessage) {
        console.log(`⚠️ Mensagem ${messageKey.id} JÁ EXISTE no banco`)
        console.log(`📋 Dados: RemoteJid=${remoteJid}, FromMe=${Boolean(messageKey.fromMe)}, Content="${normalized.content?.slice(0, 30)}"`)
      } else {
        console.log(`✨ Mensagem ${messageKey.id} é NOVA - será salva no banco`)
      }

      const metadata = {
        rawMessage: rawMessage.message || null,
        location: normalized.location || null,
        sticker: normalized.sticker || null,
        pushName: normalized.pushName || null,
        webhookSource: 'evolution'
      };

      if (normalized.mediaPath) {
        metadata.media = {
          ...(metadata.media || {}),
          path: normalized.mediaPath
        };
      }

      if (normalized.mediaUrl) {
        metadata.media = {
          ...(metadata.media || {}),
          url: normalized.mediaUrl
        };
      }

      if (normalized.mediaMimeType) {
        metadata.media = {
          ...(metadata.media || {}),
          mimetype: normalized.mediaMimeType
        };
      }

      if (normalized.mediaSize) {
        metadata.media = {
          ...(metadata.media || {}),
          size: normalized.mediaSize
        };
      }

      const quotedId =
        rawMessage.message?.extendedTextMessage?.contextInfo?.stanzaId ||
        rawMessage.message?.extendedTextMessage?.contextInfo?.stanzaID ||
        null;

      if (!existingMessage) {
        console.log(`💾 Salvando NOVA mensagem no banco: ${messageKey.id}`)
        console.log(`📝 Dados da mensagem:`, {
          message_id: messageKey.id,
          from_me: Boolean(messageKey.fromMe),
          chat_id: remoteJid,
          participant: messageKey.participant || null,
          content: normalized.content?.slice(0, 50),
          isGroup: isGroup
        })
        
        const messagePayload = {
          message_id: messageKey.id,
          from_me: Boolean(messageKey.fromMe),
          chat_id: remoteJid,
          participant: messageKey.participant || null,
          message_type: normalized.messageType || 'text',
          content: normalized.content,
          media_url: normalized.mediaUrl || null,
          media_path: normalized.mediaPath || null,
          media_size: normalized.mediaSize || null,
          media_mime_type: normalized.mediaMimeType || null,
          timestamp_msg: timestampIso,
          status,
          quoted_message_id: quotedId,
          metadata,
          instance_id: instance.id,
          chat_table_id: chatRecord?.id || null,
          contact_id: contact?.id || null
        };

        const savedMessage = await SupabaseMessage.create(messagePayload);
        console.log(`✅ Mensagem salva no banco com ID: ${savedMessage?.id}`)
        
        await SupabaseChat.updateLastMessage(remoteJid, instance.id, lastMessageSummary, timestampIso);

        // Incrementar contador de não lidas se a mensagem não for enviada por mim
        if (!messagePayload.from_me) {
          console.log(`📊 Mensagem recebida de terceiro - incrementando unread_count para chat ${remoteJid}`)
          try {
            let updatedChat = null
            if (chatResult.created && chatRecord?.id) {
              // Chat novo - definir contador inicial como 1
              updatedChat = await SupabaseChat.update(chatRecord.id, { unread_count: 1 });
              console.log(`✅ Chat novo - unread_count definido como 1`)
            } else if (chatRecord?.id) {
              // Chat existente - incrementar contador
              updatedChat = await SupabaseChat.incrementUnreadCount(remoteJid, instance.id);
              console.log(`✅ Chat existente - unread_count incrementado`)
            } else {
              console.warn(`⚠️ Chat não encontrado para incrementar contador: ${remoteJid}`)
            }
            
            // Emitir evento de atualização do chat com o novo contador via Socket.IO
            if (updatedChat) {
              const io = require('../services/socket').getIO()
              io.to(`instance_${instance.id}`).emit('chat_unread_updated', {
                instanceId: instance.id,
                chatId: remoteJid,
                unreadCount: updatedChat.unread_count || 0
              })
              console.log(`📢 Evento chat_unread_updated emitido - unreadCount: ${updatedChat.unread_count}`)
            }
          } catch (updateError) {
            console.error(`❌ Erro ao atualizar unread_count:`, updateError.message || updateError);
          }
        } else {
          console.log(`📤 Mensagem enviada por mim - não incrementar contador`)
        }
      } else {
        console.log(`⚠️ Mensagem ${messageKey.id} JÁ EXISTE no banco - pulando persistência`)
        console.log(`⚠️ RemoteJid: ${remoteJid}, FromMe: ${Boolean(messageKey.fromMe)}`)
        
        // Atualizar apenas o status se mudou
        if (status && existingMessage.status !== status) {
          try {
            await SupabaseMessage.update(existingMessage.id, { status });
            console.log(`✅ Status da mensagem atualizado de ${existingMessage.status} para ${status}`)
          } catch (updateError) {
            console.warn('Falha ao atualizar status da mensagem no Supabase:', updateError.message || updateError);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao persistir mensagem no Supabase:', error);
    }
  }

  // Atualizar status de mensagens
  async handleMessagesUpdate(instance, eventData, io) {
    try {
      console.log('Atualizando status de mensagens...')

      const updates = eventData.data?.updates || []
      for (const update of updates) {
        const messageId = update.key?.id
        const rawStatus =
          update.update?.status ||
          update.update?.statusCode ||
          update.status ||
          update.update?.to ||
          update.update?.statusMessage ||
          null
        const statusNormalized = normalizeMessageStatus(rawStatus, Boolean(update.key?.fromMe))

        if (messageId && statusNormalized) {
          try {
            await SupabaseMessage.updateStatus(messageId, instance.id, statusNormalized)
          } catch (statusError) {
            console.warn('Falha ao atualizar status da mensagem no Supabase:', statusError.message || statusError)
          }
        }

        io.to(`instance_${instance.id}`).emit('message_status_update', {
          instanceId: instance.id,
          messageId,
          status: statusNormalized
        })
      }
    } catch (error) {
      console.error('Erro ao atualizar mensagens:', error)
    }
  }

  // Atualizar contatos
  async handleContactsUpdate(instance, eventData, io) {
    try {
      console.log('👥 Atualizando contatos...')
      
      const contacts = eventData.data?.contacts || []
      console.log(`📋 ${contacts.length} contato(s) para processar`)
      
      // TODO: Implementar salvamento de contatos no Supabase
      
      // Emitir atualização via Socket.IO
      io.to(`instance_${instance.id}`).emit('contacts_updated', {
        instanceId: instance.id,
        count: contacts.length
      })
      
    } catch (error) {
      console.error('Erro ao atualizar contatos:', error)
    }
  }

  // Atualizar chats
  async handleChatsUpdate(instance, eventData, io) {
    try {
      console.log('💬 Atualizando chats...')
      
      const chats = eventData.data?.chats || []
      console.log(`📋 ${chats.length} chat(s) para processar`)
      
      // TODO: Implementar salvamento de chats no Supabase
      
      // Emitir atualização via Socket.IO
      io.to(`instance_${instance.id}`).emit('chats_updated', {
        instanceId: instance.id,
        count: chats.length
      })
      
    } catch (error) {
      console.error('Erro ao atualizar chats:', error)
    }
  }

  // Atualizar presença
  async handlePresenceUpdate(instance, eventData, io) {
    try {
      console.log('👀 Atualizando presença...')
      
      const presence = eventData.data?.presence
      if (presence) {
        console.log(`📋 Presença: ${presence.from} - ${presence.presences?.[0]?.presence}`)
        
        // Emitir atualização via Socket.IO
        io.to(`instance_${instance.id}`).emit('presence_updated', {
          instanceId: instance.id,
          from: presence.from,
          presence: presence.presences?.[0]?.presence
        })
      }
    } catch (error) {
      console.error('Erro ao atualizar presença:', error)
    }
  }
}

module.exports = new WebhookController()