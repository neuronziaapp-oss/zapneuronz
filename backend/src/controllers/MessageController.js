const { SupabaseMessage, SupabaseChat, SupabaseContact, SupabaseInstance } = require('../models/supabase')
// Aliases para compatibilidade
const Message = SupabaseMessage
const Chat = SupabaseChat
const Contact = SupabaseContact
const Instance = SupabaseInstance
const evolutionApi = require('../services/evolutionApi')
const fs = require('fs').promises
const path = require('path')

class MessageController {
  // Obter mensagens de um chat
  async getMessages(req, res) {
    try {
      const { instanceId, chatId } = req.params
      const { page = 1, limit = 50, search = '' } = req.query

      if (req.user?.role !== 'admin' && req.user?.id) {
        const instance = await Instance.findById(instanceId)
        if (!instance || instance.user_id !== req.user.id) {
          return res.status(404).json({ error: 'Inst�ncia n�o encontrada' })
        }
      }

      const instance = await Instance.findById(instanceId)

      if (!instance) {
        return res.status(404).json({ error: 'Inst�ncia n�o encontrada' })
      }

      const normalizedChatId = MessageController.normalizeRemoteJid(chatId)

      if (!normalizedChatId) {
        return res.status(400).json({ error: 'Identificador de chat inv�lido' })
      }

      const currentPage = Math.max(parseInt(page, 10) || 1, 1)
      const pageSize = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200)
      const offset = (currentPage - 1) * pageSize

      const queryOptions = {
        limit: pageSize,
        offset,
        order: 'asc'
      }

      if (typeof search === 'string' && search.trim() !== '') {
        queryOptions.search = search.trim()
      }

      const supabaseMessages = await Message.findByChatId(
        normalizedChatId,
        instanceId,
        queryOptions
      )

      const totalMessages = await Message.count(normalizedChatId, instanceId)

      const formattedMessages = (supabaseMessages || []).map(msg => {
        let metadata = msg.metadata

        if (metadata && typeof metadata === 'string') {
          try {
            metadata = JSON.parse(metadata)
          } catch (parseError) {
            metadata = null
          }
        }

        if (!metadata || typeof metadata !== 'object') {
          metadata = {}
        }

        const locationMetadata = metadata.location || null
        const stickerMetadata = metadata.sticker || null
        const rawMessage = metadata.rawMessage || null

        const status = msg.status || (msg.from_me ? 'sent' : 'received')
        const timestampIso = msg.timestamp_msg
        const mediaUrl = msg.media_url || null
        const mediaPath = msg.media_path || mediaUrl || null

        const isGroupMessage = normalizedChatId?.endsWith('@g.us') || false
        
        // Para mensagens de grupo, tentar extrair o pushName do metadata ou do participante
        let displayName = msg.contacts?.push_name || msg.contacts?.name || null
        if (isGroupMessage && metadata?.pushName) {
          displayName = metadata.pushName
        } else if (isGroupMessage && msg.participant) {
          // Se não tem pushName no metadata, usar o número do participante
          displayName = displayName || msg.participant.split('@')[0]
        }

        return {
          id: msg.id,
          messageId: msg.message_id,
          fromMe: msg.from_me,
          content: msg.content,
          messageType: msg.message_type || 'text',
          timestamp: timestampIso,
          status,
          mediaPath,
          mediaMimeType: msg.media_mime_type || null,
          mediaUrl,
          remoteJid: normalizedChatId,
          participant: msg.participant || null,
          isGroupMessage: isGroupMessage,
          pushName: displayName,
          contact: msg.contacts || null,
          message: rawMessage,
          location: locationMetadata,
          mapsUrl: locationMetadata?.url || null,
          locationThumbnail: locationMetadata?.thumbnail || null,
          sticker: stickerMetadata,
          metadata,
          source: 'supabase'
        }
      })

      res.json({
        messages: formattedMessages,
        pagination: {
          currentPage,
          totalPages: totalMessages > 0 ? Math.ceil(totalMessages / pageSize) : 0,
          totalMessages,
          hasMore: offset + formattedMessages.length < totalMessages
        }
      })
    } catch (error) {
      console.error('Erro ao obter mensagens:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  static normalizeRemoteJid(identifier) {
    if (!identifier || typeof identifier !== 'string') {
      return null
    }

    let value = identifier.trim()

    if (!value) {
      return null
    }

    if (!value.includes('@')) {
      return value.includes('-')
        ? `${value}@g.us`
        : `${value}@s.whatsapp.net`
    }

    const [userPart, domainPart] = value.split('@')
    const user = (userPart || '').trim()
    const domain = (domainPart || 's.whatsapp.net').toLowerCase()

    if (!user) {
      return null
    }

    if (domain === 'g.us') {
      return `${user}@g.us`
    }

    if (domain === 's.whatsapp.net') {
      return `${user}@s.whatsapp.net`
    }

    if (domain === 'broadcast') {
      return `${user}@broadcast`
    }

    return `${user}@${domain}`
  }

  // Helper para extrair conteúdo da mensagem
  static extractMessageContent(message, locationMetadata = null) {
    if (!message) return 'Mensagem sem conteúdo';
    
    // Mensagem de texto simples
    if (message.conversation) {
      return message.conversation;
    }
    
    // Mensagem de texto estendida
    if (message.extendedTextMessage?.text) {
      return message.extendedTextMessage.text;
    }
    
    // Mensagens de mídia com caption
    if (message.imageMessage?.caption) {
      return message.imageMessage.caption;
    }
    
    if (message.videoMessage?.caption) {
      return message.videoMessage.caption;
    }
    
    if (message.documentMessage?.caption) {
      return message.documentMessage.caption;
    }
    
    // Mensagens de mídia sem caption - mostrar tipo + nome do arquivo se disponível
    if (message.imageMessage) {
      return '📷 Imagem';
    }
    
    if (message.videoMessage) {
      return '🎥 Vídeo';
    }
    
    if (message.audioMessage) {
      return '🎵 Áudio';
    }
    
    if (message.documentMessage) {
      const fileName = message.documentMessage.fileName || 'Documento';
      return `📄 ${fileName}`;
    }
    
    if (message.stickerMessage) {
      return '😄 Sticker';
    }
    
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
    
    if (message.contactMessage) {
      return '👤 Contato';
    }
    
    return 'Mensagem de mídia';
  }

  // Helper para determinar tipo da mensagem
  static getMessageType(message) {
    if (!message) return 'text';
    
    if (message.conversation) return 'text';
    if (message.extendedTextMessage) return 'text';
    if (message.imageMessage) return 'image';
    if (message.videoMessage) return 'video';
    if (message.audioMessage) return 'audio';
    if (message.documentMessage) return 'document';
    if (message.stickerMessage) return 'sticker';
    if (message.locationMessage) return 'location';
    if (message.contactMessage) return 'contact';
    
    return 'text';
  }

  static normalizeMessageType(messageType) {
    if (!messageType) return 'text';

    if (messageType === 'stickerMessage') return 'sticker';
    if (messageType === 'imageMessage') return 'imageMessage';
    if (messageType === 'videoMessage') return 'videoMessage';
    if (messageType === 'audioMessage') return 'audioMessage';
    if (messageType === 'documentMessage') return 'documentMessage';

    return messageType;
  }

  static normalizeJid(jid) {
    if (!jid) return null;
    const value = String(jid).trim();
    if (!value) return null;

    if (value.includes('@')) {
      const [user, domain] = value.split('@');
      return `${user}@${(domain || '').toLowerCase()}`;
    }

    const digitsOnly = value.replace(/\D+/g, '');
    if (!digitsOnly) return null;

    return `${digitsOnly}@s.whatsapp.net`;
  }

  static getInstanceOwnerJid(instance) {
    if (!instance) return null;

    const candidates = [
      instance.ownerJid,
      instance.owner_jid,
      instance.ownerjid,
      instance.owner,
      instance.owner_id,
      instance.ownerId,
      instance.owner_phone ? `${instance.owner_phone}@s.whatsapp.net` : null,
      instance.phone ? `${String(instance.phone).replace(/\D+/g, '')}@s.whatsapp.net` : null
    ];

    for (const candidate of candidates) {
      const normalized = MessageController.normalizeJid(candidate);
      if (normalized) {
        return normalized;
      }
    }

    return null;
  }

  static isTruthyFlag(flag) {
    if (flag === undefined || flag === null) return false;
    if (typeof flag === 'boolean') return flag;
    if (typeof flag === 'number') return flag !== 0;
    if (typeof flag === 'string') {
      const normalized = flag.trim().toLowerCase();
      return ['true', '1', 'yes', 'y'].includes(normalized);
    }
    return Boolean(flag);
  }

  static isMessageFromMe(messageRecord, instance) {
    if (!messageRecord || typeof messageRecord !== 'object') {
      return false;
    }

    const directFlags = [
      messageRecord.key?.fromMe,
      messageRecord.fromMe,
      messageRecord.self,
      messageRecord.me,
      messageRecord.message?.key?.fromMe
    ];

    if (directFlags.some(flag => MessageController.isTruthyFlag(flag))) {
      return true;
    }

    const ownerJid = MessageController.getInstanceOwnerJid(instance);
    if (!ownerJid) {
      return false;
    }

    const normalizedOwner = MessageController.normalizeJid(ownerJid);
    const participantCandidates = [
      messageRecord.key?.participant,
      messageRecord.participant,
      messageRecord.author,
      messageRecord.from,
      messageRecord.message?.key?.participant,
      messageRecord.message?.participant,
      messageRecord.sender,
      messageRecord.pushName
    ];

    for (const candidate of participantCandidates) {
      const normalizedCandidate = MessageController.normalizeJid(candidate);
      if (normalizedCandidate && normalizedCandidate === normalizedOwner) {
        return true;
      }
    }

    return false;
  }

  static normalizeRemoteJid(identifier) {
    if (!identifier || typeof identifier !== 'string') {
      return null
    }

    let value = identifier.trim()

    if (!value) {
      return null
    }

    if (!value.includes('@')) {
      return value.includes('-')
        ? `${value}@g.us`
        : `${value}@s.whatsapp.net`
    }

    const [userPart, domainPart] = value.split('@')
    const user = (userPart || '').trim()
    const domain = (domainPart || 's.whatsapp.net').toLowerCase()

    if (!user) {
      return null
    }

    if (domain === 'g.us') {
      return `${user}@g.us`
    }

    if (domain === 's.whatsapp.net') {
      return `${user}@s.whatsapp.net`
    }

    if (domain === 'broadcast') {
      return `${user}@broadcast`
    }

    return `${user}@${domain}`
  }

  // Helper para extrair caminho da mídia
  static getMediaPath(message) {
    if (!message) return null;
    
    if (message.imageMessage?.url) return message.imageMessage.url;
    if (message.videoMessage?.url) return message.videoMessage.url;
    if (message.audioMessage?.url) return message.audioMessage.url;
    if (message.documentMessage?.url) return message.documentMessage.url;
    if (message.stickerMessage?.url) return message.stickerMessage.url;
    
    return null;
  }

  static normalizeRemoteJid(identifier) {
    if (!identifier || typeof identifier !== 'string') {
      return null
    }

    let value = identifier.trim()

    if (!value) {
      return null
    }

    if (!value.includes('@')) {
      return value.includes('-')
        ? `${value}@g.us`
        : `${value}@s.whatsapp.net`
    }

    const [userPart, domainPart] = value.split('@')
    const user = (userPart || '').trim()
    const domain = (domainPart || 's.whatsapp.net').toLowerCase()

    if (!user) {
      return null
    }

    if (domain === 'g.us') {
      return `${user}@g.us`
    }

    if (domain === 's.whatsapp.net') {
      return `${user}@s.whatsapp.net`
    }

    if (domain === 'broadcast') {
      return `${user}@broadcast`
    }

    return `${user}@${domain}`
  }

  // Helper para extrair mime type da mídia
  static getMediaMimeType(message) {
    if (!message) return null;
    
    if (message.imageMessage?.mimetype) return message.imageMessage.mimetype;
    if (message.videoMessage?.mimetype) return message.videoMessage.mimetype;
    if (message.audioMessage?.mimetype) return message.audioMessage.mimetype;
    if (message.documentMessage?.mimetype) return message.documentMessage.mimetype;
    if (message.stickerMessage?.mimetype) return message.stickerMessage.mimetype || 'image/webp';
    
    return null;
  }

  static getStickerData(message) {
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

  static getLocationData(message) {
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

  static getEvolutionInstanceName(instance) {
    if (!instance) return null;

    return (
      instance.evolution_instance_id ||
      instance.evolutionInstanceId ||
      instance.evolution_instanceId ||
      instance.evolutioninstanceid ||
      instance.name
    );
  }

  // Enviar mensagem de texto via Evolution API
  async sendTextMessage(req, res) {
    try {
      const { instanceId, chatId } = req.params
      const {
        number: bodyNumber,
        text,
        message,
        delay,
        linkPreview,
        mentionsEveryOne,
        mentioned,
        quoted,
        quotedMessageId,
        options = {}
      } = req.body || {}

      const rawNumber = bodyNumber || options.number || req.body?.chatId || chatId
      const normalizedNumber = rawNumber
        ? String(rawNumber).split('@')[0].replace(/\s+/g, '')
        : null

      if (!normalizedNumber) {
        return res.status(400).json({ error: 'Número do contato não informado' })
      }

      const finalText = (text ?? message ?? '').toString().trim()

      if (!finalText) {
        return res.status(400).json({ error: 'Mensagem não pode estar vazia' })
      }

      const instance = await Instance.findById(instanceId)

      if (!instance) {
        return res.status(404).json({ error: 'Instância não encontrada' })
      }

      if (
        req.user?.role !== 'admin' &&
        req.user?.id &&
        instance.user_id &&
        instance.user_id !== req.user.id
      ) {
        return res.status(403).json({ error: 'Acesso negado à instância' })
      }

      if (instance.status && instance.status !== 'connected') {
        return res.status(400).json({ error: 'Instância não está conectada' })
      }

      const evolutionInstanceName = MessageController.getEvolutionInstanceName(instance)

      if (!evolutionInstanceName) {
        return res.status(400).json({ error: 'Instância Evolution inválida' })
      }

      const quotedPayload = quotedMessageId
        ? {
            key: {
              id: quotedMessageId
            }
          }
        : quoted

      const payload = {
        number: normalizedNumber,
        text: finalText,
        delay,
        linkPreview,
        mentionsEveryOne,
        mentioned,
        quoted: quotedPayload
      }

      Object.keys(payload).forEach(key => {
        if (
          payload[key] === undefined ||
          payload[key] === null ||
          (Array.isArray(payload[key]) && payload[key].length === 0) ||
          (typeof payload[key] === 'object' && Object.keys(payload[key]).length === 0)
        ) {
          delete payload[key]
        }
      })

      const evolutionResponse = await evolutionApi.sendText(
        evolutionInstanceName,
        payload
      )

      res.status(201).json({
        number: normalizedNumber,
        chatId: chatId || normalizedNumber,
        text: finalText,
        evolution: evolutionResponse
      })
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error)
      const status = error.response?.status || 500
      res.status(status).json({
        error: error.response?.data?.error || 'Erro ao enviar mensagem',
        details: error.response?.data || error.message
      })
    }
  }

  // Enviar mídia
  async sendMediaMessage(req, res) {
    try {
      const { instanceId, chatId } = req.params
      const { caption = '', quotedMessageId } = req.body

      if (!req.file) {
        return res.status(400).json({ error: 'Arquivo de mídia é obrigatório' })
      }

      const instance = await Instance.findOne({
        where: {
          id: instanceId,
          ...(req.user.role !== 'admin' ? { userId: req.user.id } : {})
        }
      })

      if (!instance) {
        return res.status(404).json({ error: 'Instância não encontrada' })
      }

      if (instance.status !== 'connected') {
        return res.status(400).json({ error: 'Instância não está conectada' })
      }

      const chat = await Chat.findOne({
        where: { id: chatId, instanceId },
        include: [Contact]
      })

      if (!chat) {
        return res.status(404).json({ error: 'Chat não encontrado' })
      }

      // Determinar tipo de mídia
      const mimeType = req.file.mimetype
      let mediaType = 'document'

      if (mimeType.startsWith('image/')) {
        mediaType = 'image'
      } else if (mimeType.startsWith('video/')) {
        mediaType = 'video'
      } else if (mimeType.startsWith('audio/')) {
        mediaType = 'audio'
      }

      // Enviar mídia via Evolution API
      const mediaPath = req.file.path
      const evolutionInstanceName = MessageController.getEvolutionInstanceName(instance)

      if (!evolutionInstanceName) {
        return res.status(400).json({ error: 'Instância Evolution inválida' })
      }

      const evolutionResponse = await evolutionApi.sendMediaMessage(
        evolutionInstanceName,
        chat.Contact.phone,
        mediaPath,
        mediaType,
        caption,
        quotedMessageId
      )

      // Salvar mensagem no banco
      const messageRecord = await Message.create({
        messageId: evolutionResponse.key?.id || `temp_${Date.now()}`,
        fromMe: true,
        chatId: chat.Contact.phone,
        messageType: mediaType,
        content: caption,
        mediaPath: mediaPath,
        mediaMimeType: mimeType,
        mediaSize: req.file.size,
        timestamp: new Date(),
        status: 'sent',
        instanceId: instance.id,
        contactId: chat.contactId,
        quotedMessage: quotedMessageId ? { id: quotedMessageId } : null
      })

      // Atualizar última mensagem do chat
      const lastMessage =
        caption ||
        `📎 ${
          mediaType === 'image'
            ? 'Imagem'
            : mediaType === 'video'
            ? 'Vídeo'
            : mediaType === 'audio'
            ? 'Áudio'
            : 'Documento'
        }`

      await chat.update({
        lastMessage,
        lastMessageTime: new Date()
      })

      res.json({
        message: messageRecord,
        evolutionResponse
      })
    } catch (error) {
      console.error('Erro ao enviar mídia:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  // Enviar mídia via Evolution API (base64/URL)
  async sendMedia(req, res) {
    try {
      const { instanceId } = req.params
      const {
        number,
        mediatype,
        mimetype,
        caption = '',
        media,
        fileName,
        delay,
        linkPreview,
        mentionsEveryOne,
        mentioned,
        quoted,
        chatId
      } = req.body || {}

      if (!number || !media || !mediatype || !mimetype || !fileName) {
        return res.status(400).json({
          error:
            'Campos obrigatórios ausentes. Informe number, media, mediatype, mimetype e fileName.'
        })
      }

      const instance = await Instance.findById(instanceId)

      if (!instance) {
        return res.status(404).json({ error: 'Instância não encontrada' })
      }

      if (req.user?.role !== 'admin' && req.user?.id && instance.user_id && instance.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Acesso negado à instância' })
      }

      if (instance.status && instance.status !== 'connected') {
        return res.status(400).json({ error: 'Instância não está conectada' })
      }

      const evolutionInstanceName = MessageController.getEvolutionInstanceName(instance)

      if (!evolutionInstanceName) {
        return res.status(400).json({ error: 'Instância Evolution inválida' })
      }

      const payload = {
        number,
        mediatype,
        mimetype,
        caption,
        media,
        fileName,
        delay,
        linkPreview,
        mentionsEveryOne,
        mentioned,
        quoted
      }

      Object.keys(payload).forEach(key => {
        if (payload[key] === undefined || payload[key] === null || (Array.isArray(payload[key]) && payload[key].length === 0)) {
          delete payload[key]
        }
      })

      const evolutionResponse = await evolutionApi.sendMedia(
        evolutionInstanceName,
        payload
      )

      res.status(201).json({
        number,
        chatId: chatId || number,
        mediatype,
        caption,
        fileName,
        evolution: evolutionResponse
      })
    } catch (error) {
      console.error('Erro ao enviar mídia (API):', error.response?.data || error.message)
      const status = error.response?.status || 500
      res.status(status).json({
        error: error.response?.data?.error || 'Erro ao enviar mídia',
        details: error.response?.data || error.message
      })
    }
  }

  // Enviar áudio via Evolution API
  async sendWhatsAppAudio(req, res) {
    try {
      const { instanceId } = req.params
      const {
        number,
        audio,
        mimetype,
        ptt,
        delay,
        linkPreview,
        mentionsEveryOne,
        mentioned,
        quoted,
        chatId,
        seconds,
        fileName,
        metadata
      } = req.body || {}

      if (!number || !audio) {
        return res.status(400).json({
          error: 'Campos obrigatórios ausentes. Informe number e audio.'
        })
      }

      const instance = await Instance.findById(instanceId)

      if (!instance) {
        return res.status(404).json({ error: 'Instância não encontrada' })
      }

      if (req.user?.role !== 'admin' && req.user?.id && instance.user_id && instance.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Acesso negado à instância' })
      }

      if (instance.status && instance.status !== 'connected') {
        return res.status(400).json({ error: 'Instância não está conectada' })
      }

      const evolutionInstanceName = MessageController.getEvolutionInstanceName(instance)

      if (!evolutionInstanceName) {
        return res.status(400).json({ error: 'Instância Evolution inválida' })
      }

      const payload = {
        number,
        audio,
        mimetype,
        ptt,
        delay,
        linkPreview,
        mentionsEveryOne,
        mentioned,
        quoted,
        seconds,
        fileName,
        metadata
      }

      Object.keys(payload).forEach(key => {
        if (payload[key] === undefined || payload[key] === null || (Array.isArray(payload[key]) && payload[key].length === 0)) {
          delete payload[key]
        }
      })

      const evolutionResponse = await evolutionApi.sendWhatsAppAudio(
        evolutionInstanceName,
        payload
      )

      res.status(200).json({
        number,
        chatId: chatId || number,
        evolution: evolutionResponse
      })
    } catch (error) {
      console.error('Erro ao enviar áudio (API):', error.response?.data || error.message)
      const status = error.response?.status || 500
      res.status(status).json({
        error: error.response?.data?.error || 'Erro ao enviar áudio',
        details: error.response?.data || error.message
      })
    }
  }

  // Enviar sticker via Evolution API
  async sendSticker(req, res) {
    try {
      const { instanceId } = req.params
      const {
        number,
        sticker,
        delay,
        linkPreview,
        mentionsEveryOne,
        mentioned,
        quoted,
        chatId
      } = req.body || {}

      if (!number || !sticker) {
        return res.status(400).json({
          error: 'Campos obrigatórios ausentes. Informe number e sticker.'
        })
      }

      const instance = await Instance.findById(instanceId)

      if (!instance) {
        return res.status(404).json({ error: 'Instância não encontrada' })
      }

      if (req.user?.role !== 'admin' && req.user?.id && instance.user_id && instance.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Acesso negado à instância' })
      }

      if (instance.status && instance.status !== 'connected') {
        return res.status(400).json({ error: 'Instância não está conectada' })
      }

      const evolutionInstanceName = MessageController.getEvolutionInstanceName(instance)

      if (!evolutionInstanceName) {
        return res.status(400).json({ error: 'Instância Evolution inválida' })
      }

      const payload = {
        number,
        sticker,
        delay,
        linkPreview,
        mentionsEveryOne,
        mentioned,
        quoted
      }

      Object.keys(payload).forEach(key => {
        if (payload[key] === undefined || payload[key] === null || (Array.isArray(payload[key]) && payload[key].length === 0)) {
          delete payload[key]
        }
      })

      const evolutionResponse = await evolutionApi.sendSticker(
        evolutionInstanceName,
        payload
      )

      res.status(200).json({
        number,
        chatId: chatId || number,
        evolution: evolutionResponse
      })
    } catch (error) {
      console.error('Erro ao enviar sticker (API):', error.response?.data || error.message)
      const status = error.response?.status || 500
      res.status(status).json({
        error: error.response?.data?.error || 'Erro ao enviar sticker',
        details: error.response?.data || error.message
      })
    }
  }

  // Sincronizar mensagens de um chat
  async syncMessages(req, res) {
    try {
      const { instanceId, chatId } = req.params
      const { limit = 50 } = req.query

      const instance = await Instance.findById(instanceId)

      if (!instance) {
        return res.status(404).json({ error: 'Inst�ncia n�o encontrada' })
      }

      if (
        req.user?.role !== 'admin' &&
        req.user?.id &&
        instance.user_id &&
        instance.user_id !== req.user.id
      ) {
        return res.status(403).json({ error: 'Acesso negado � inst�ncia' })
      }

      const normalizedChatId = MessageController.normalizeRemoteJid(chatId)

      if (!normalizedChatId) {
        return res.status(400).json({ error: 'Identificador de chat inv�lido' })
      }

      const pageSize = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200)

      const recentMessages = await Message.findByChatId(normalizedChatId, instanceId, {
        limit: pageSize,
        order: 'desc'
      })

      const totalMessages = await Message.count(normalizedChatId, instanceId)

      res.json({
        message: 'Mensagens dispon�veis via Supabase. Sincroniza��o manual n�o � mais necess�ria.',
        syncedCount: 0,
        updatedCount: 0,
        totalMessages,
        recentMessages: recentMessages || [],
        source: 'supabase'
      })
    } catch (error) {
      console.error('Erro ao sincronizar mensagens:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  // Download de mídia
  async downloadMedia(req, res) {
    try {
      const { instanceId, messageId } = req.params

      const instance = await Instance.findOne({
        where: {
          id: instanceId,
          ...(req.user.role !== 'admin' ? { userId: req.user.id } : {})
        }
      })

      if (!instance) {
        return res.status(404).json({ error: 'Instância não encontrada' })
      }

      const message = await Message.findOne({
        where: {
          id: messageId,
          instanceId
        }
      })

      if (!message) {
        return res.status(404).json({ error: 'Mensagem não encontrada' })
      }

      // Se já tem arquivo local, servir diretamente
      if (
        message.mediaPath &&
        (await fs
          .access(message.mediaPath)
          .then(() => true)
          .catch(() => false))
      ) {
        return res.sendFile(path.resolve(message.mediaPath))
      }

      // Caso contrário, baixar do Evolution API
      const evolutionInstanceName = MessageController.getEvolutionInstanceName(instance)

      if (!evolutionInstanceName) {
        return res.status(400).json({ error: 'Instância Evolution inválida' })
      }

      const mediaStream = await evolutionApi.downloadMedia(
        evolutionInstanceName,
        message.messageId
      )

      // Salvar arquivo localmente
      const fileName = `${message.messageId}_${Date.now()}`
      const filePath = path.join('uploads', fileName)

      const fileStream = require('fs').createWriteStream(filePath)
      mediaStream.pipe(fileStream)

      await new Promise((resolve, reject) => {
        fileStream.on('finish', resolve)
        fileStream.on('error', reject)
      })

      // Atualizar caminho no banco
      await message.update({ mediaPath: filePath })

      res.sendFile(path.resolve(filePath))
    } catch (error) {
      console.error('Erro ao baixar mídia:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  // Buscar mensagens em todos os chats
  async searchMessages(req, res) {
    try {
      const { instanceId } = req.params
      const { query, page = 1, limit = 50 } = req.query

      if (!query || query.trim() === '') {
        return res.status(400).json({ error: 'Query de busca é obrigatória' })
      }

      const instance = await Instance.findOne({
        where: {
          id: instanceId,
          ...(req.user.role !== 'admin' ? { userId: req.user.id } : {})
        }
      })

      if (!instance) {
        return res.status(404).json({ error: 'Instância não encontrada' })
      }

      const offset = (page - 1) * limit

      const messages = await Message.findAndCountAll({
        where: {
          instanceId,
          content: {
            [Op.like]: `%${query}%`
          },
          deleted: false
        },
        include: [Contact],
        order: [['timestamp', 'DESC']],
        limit: parseInt(limit),
        offset
      })

      res.json({
        messages: messages.rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(messages.count / limit),
          totalMessages: messages.count,
          hasMore: offset + messages.rows.length < messages.count
        },
        query
      })
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  // Deletar mensagem
  async deleteMessage(req, res) {
    try {
      const { instanceId, messageId } = req.params

      const instance = await Instance.findOne({
        where: {
          id: instanceId,
          ...(req.user.role !== 'admin' ? { userId: req.user.id } : {})
        }
      })

      if (!instance) {
        return res.status(404).json({ error: 'Instância não encontrada' })
      }

      const message = await Message.findOne({
        where: {
          id: messageId,
          instanceId,
          fromMe: true // Só pode deletar mensagens próprias
        }
      })

      if (!message) {
        return res
          .status(404)
          .json({ error: 'Mensagem não encontrada ou não pode ser deletada' })
      }

      await message.update({ deleted: true })

      res.json({ message: 'Mensagem deletada com sucesso' })
    } catch (error) {
      console.error('Erro ao deletar mensagem:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  // Obter mídia em base64 da Evolution API
  async getBase64FromMedia(req, res) {
    try {
      const { instanceId, messageId } = req.params
      const { convertToMp4 } = req.query

      console.log(`📷 MessageController.getBase64FromMedia RECEBIDO:`, {
        instanceId,
        messageId,
        convertToMp4: convertToMp4 === 'true',
        query: req.query,
        body: req.body,
        headers: req.headers
      })

      // Verificar se usuário tem acesso à instância (se não for autenticação via API)
      if (req.user?.role !== 'admin' && req.user?.id) {
        const instance = await Instance.findById(instanceId)
        if (!instance || instance.user_id !== req.user.id) {
          console.log(`❌ Instância não encontrada ou sem permissão: ${instanceId}`)
          return res.status(404).json({ error: 'Instância não encontrada' })
        }
      }

      // Buscar instância para obter o nome para a Evolution API
      const instance = await Instance.findById(instanceId)
      
      if (!instance) {
        return res.status(404).json({ error: 'Instância não encontrada' })
      }
      
      console.log(`🔍 Dados da instância:`, {
        id: instance.id,
        name: instance.name, 
        evolution_instance_id: instance.evolution_instance_id
      })

      try {
        console.log(`📝 Verificando formatação do messageId: "${messageId}"`)
        
        // Determinar se deve converter para MP4 com base no parâmetro da query
        const shouldConvertToMp4 = req.query.convertToMp4 === 'true'
        console.log(`🎬 Converter para MP4: ${shouldConvertToMp4}`)
        
        // Fazer chamada para Evolution API usando evolution_instance_id
        const base64Data = await evolutionApi.getBase64FromMediaMessage(
          instance.evolution_instance_id, 
          messageId,
          shouldConvertToMp4
        )
        
        console.log(`📷 Base64 obtido com sucesso da Evolution API para messageId: ${messageId}`)
        
        res.json(base64Data)
      } catch (evolutionError) {
        console.error('Erro na Evolution API:', evolutionError)
        
        if (evolutionError.response?.status === 404) {
          return res.status(404).json({ error: 'Mensagem ou mídia não encontrada' })
        }
        
        return res.status(500).json({ 
          error: 'Erro ao obter mídia da Evolution API',
          details: evolutionError.message 
        })
      }
    } catch (error) {
      console.error('Erro ao obter base64 da mídia:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }
}

module.exports = new MessageController()



