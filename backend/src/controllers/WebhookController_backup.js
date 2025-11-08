const { SupabaseInstance, SupabaseContact, SupabaseChat, SupabaseMessage } = require('../models/supabase')
const { getIO, emitSyncStart, emitSyncProgress, emitSyncComplete } = require('../services/socket')
const evolutionApi = require('../services/evolutionApi')
const redisService = require('../config/redis')

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
      // console.log(`📥 Dados:`, JSON.stringify(eventData.data, null, 2))

      // Encontrar instância pelo Evolution ID
      const instance = await SupabaseInstance.findByEvolutionId(instanceName)

      if (!instance) {
        console.warn(`Webhook recebido para instância desconhecida: ${instanceName}`)
        return res.status(404).json({ error: 'Instância não encontrada' })
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
        qr_code_base64: qrData.base64,
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

      await SupabaseInstance.update(instance.id, updateData)

      // Emitir para frontend
      io.to(`instance_${instance.id}`).emit('connection_update', {
        instanceId: instance.id,
        status,
        profileName,
        phone
      })

      console.log(`✅ Status de conexão atualizado: ${status}`)
    } catch (error) {
      console.error('Erro ao atualizar conexão:', error)
    }
  }

  // Processar novas mensagens
  async handleMessagesUpsert(instance, eventData, io) {
    try {
      const messages = eventData.data?.messages || []
      if (!Array.isArray(messages) || messages.length === 0) return

      console.log(`💬 Processando ${messages.length} mensagem(ns)...`)

      for (const msg of messages) {
        await this.processMessage(instance, msg, io)
      }
    } catch (error) {
      console.error('Erro ao processar mensagens:', error)
    }
  }

  // Processar uma mensagem individual
  async processMessage(instance, msg, io) {
    try {
      // Para uma implementação completa, seria necessário migrar toda a lógica
      // Por enquanto, apenas log básico
      console.log(`📝 Mensagem recebida - ID: ${msg.key?.id}, From: ${msg.key?.remoteJid}`)
      
      // TODO: Implementar salvamento completo no Supabase
      // - Salvar mensagem na tabela messages
      // - Atualizar chat na tabela chats
      // - Emitir via Socket.IO
      
    } catch (error) {
      console.error('Erro ao processar mensagem:', error)
    }
  }

  // Atualizar status de mensagens
  async handleMessagesUpdate(instance, eventData, io) {
    try {
      console.log('📤 Atualizando status de mensagens...')
      // TODO: Implementar atualização de status das mensagens
    } catch (error) {
      console.error('Erro ao atualizar mensagens:', error)
    }
  }

  // Atualizar contatos
  async handleContactsUpdate(instance, eventData, io) {
    try {
      console.log('👥 Atualizando contatos...')
      // TODO: Implementar atualização de contatos
    } catch (error) {
      console.error('Erro ao atualizar contatos:', error)
    }
  }

  // Atualizar chats
  async handleChatsUpdate(instance, eventData, io) {
    try {
      console.log('💬 Atualizando chats...')
      // TODO: Implementar atualização de chats
    } catch (error) {
      console.error('Erro ao atualizar chats:', error)
    }
  }

  // Atualizar presença
  async handlePresenceUpdate(instance, eventData, io) {
    try {
      console.log('👀 Atualizando presença...')
      // TODO: Implementar atualização de presença
    } catch (error) {
      console.error('Erro ao atualizar presença:', error)
    }
  }
}

module.exports = new WebhookController()

  // Atualizar QR Code
  async handleQRCodeUpdate(instance, eventData, io) {
    try {
      const qrCode = eventData.data?.qrcode
      if (qrCode) {
        await instance.update({
          qrCode,
          status: 'connecting'
        })

        io.to(`instance_${instance.id}`).emit('qrcode_updated', {
          instanceId: instance.id,
          qrCode
        })

        console.log(`QR Code atualizado para instância ${instance.name}`)
      }
    } catch (error) {
      console.error('Erro ao processar atualização de QR Code:', error)
    }
  }

  // Atualizar status da conexão
  async handleConnectionUpdate(instance, eventData, io) {
    try {
      const connectionState = eventData.data?.state
      const phone = eventData.data?.number

      console.log(`🔄 CONNECTION UPDATE - Instância: ${instance.name}`)
      console.log(`🔄 Estado: ${connectionState}`)
      console.log(`🔄 Phone: ${phone}`)

      let status = 'disconnected'
      switch (connectionState) {
        case 'open':
          // Só considerar conectado quando o provider sinaliza 'open' e temos o número da instância
          status = phone ? 'connected' : 'connecting'
          break
        case 'connecting':
        case 'qr':
        case 'OPENING':
        case 'PAIRING':
          status = 'connecting'
          break
        case 'close':
        default:
          status = 'disconnected'
          break
      }

      const updateData = {
        status,
        lastSeen: new Date()
      }

      // Persistir phone somente quando a conexão estiver realmente aberta
      if (connectionState === 'open' && phone) {
        updateData.phone = phone
      }

      // Se desconectou, limpe o phone e o QR (forçará novo pareamento)
      if (status === 'disconnected') {
        updateData.phone = null
        updateData.qrCode = null
      }

      if (status === 'connected') {
        updateData.qrCode = null // Limpar QR Code quando conectado
      }

      await instance.update(updateData)

      io.to(`instance_${instance.id}`).emit('connection_update', {
        instanceId: instance.id,
        status,
        phone
      })

      // Iniciar sincronização automática quando conecta pela primeira vez
      if (status === 'connected' && phone) {
        console.log(`🚀 Iniciando sincronização automática para instância ${instance.name}`)
        
        // Executar sincronização em background (não bloquear webhook)
        setImmediate(() => {
          this.performAutoSync(instance).catch(error => {
            console.error(`❌ Erro na sincronização automática da instância ${instance.name}:`, error)
          })
        })
      }

      console.log(
        `Status de conexão atualizado para instância ${instance.name}: ${status}`
      )
    } catch (error) {
      console.error('Erro ao processar atualização de conexão:', error)
    }
  }

  // Processar novas mensagens
  async handleMessagesUpsert(instance, eventData, io) {
    try {
      console.log('📨 Processando messages.upsert...')
      console.log('📋 Estrutura dos dados:', JSON.stringify(eventData, null, 2))
      
      // A Evolution API pode enviar dados diretamente (objeto único) ou em array
      let messages = []
      
      if (eventData.data && Array.isArray(eventData.data)) {
        messages = eventData.data
      } else if (eventData.data) {
        messages = [eventData.data]
      } else if (eventData.key && eventData.message) {
        // Dados vêm diretamente no eventData
        messages = [eventData]
      }
      
      console.log(`📊 Total de mensagens para processar: ${messages.length}`)
      
      if (messages.length === 0) {
        console.log('⚠️ Nenhuma mensagem encontrada no evento')
        return
      }

      for (const msg of messages) {
        if (msg && msg.key) {
          console.log(`📝 Processando mensagem: ${msg.key.id} de ${msg.key.remoteJid}`)
          await this.processMessage(instance, msg, io)
        } else {
          console.log('⚠️ Mensagem inválida:', JSON.stringify(msg, null, 2))
        }
      }
    } catch (error) {
      console.error('Erro ao processar mensagens upsert:', error)
    }
  }

  // Processar atualizações de mensagens
  async handleMessagesUpdate(instance, eventData, io) {
    try {
      const updates = eventData.data?.messages || []

      for (const update of updates) {
        await Message.update(
          { status: this.mapMessageStatus(update.update?.status) },
          {
            where: {
              messageId: update.key.id,
              instanceId: instance.id
            }
          }
        )

        io.to(`instance_${instance.id}`).emit('message_update', {
          instanceId: instance.id,
          messageId: update.key.id,
          status: this.mapMessageStatus(update.update?.status)
        })
      }
    } catch (error) {
      console.error('Erro ao processar atualizações de mensagens:', error)
    }
  }

  // Processar mensagem individual
  async processMessage(instance, msg, io) {
    try {
      // Verificar se mensagem já existe
      const existingMessage = await Message.findOne({
        where: {
          messageId: msg.key.id,
          instanceId: instance.id
        }
      })

      if (existingMessage) {
        return // Mensagem já processada
      }

      // Encontrar ou criar contato usando Supabase
      const contactPhone = msg.key.remoteJid
      const contactDefaults = {
        name: msg.pushName || null,
        push_name: msg.pushName || null,
        is_group: contactPhone.includes('@g.us'),
        last_seen: new Date().toISOString()
      }

      const contactResult = await Contact.findOrCreate(
        contactPhone,
        instance.id,
        contactDefaults
      )
      const contact = contactResult.data

      // Encontrar ou criar chat usando Supabase
      const chatDefaults = {
        contact_id: contact.id,
        last_message_time: new Date(msg.messageTimestamp * 1000).toISOString()
      }

      const chatResult = await Chat.findOrCreate(
        contactPhone,
        instance.id,
        chatDefaults
      )
      const chat = chatResult.data

      // Processar conteúdo da mensagem
      const messageData = this.extractMessageContent(msg)

      // Criar mensagem usando Supabase
      const message = await Message.create({
        message_id: msg.key.id,
        from_me: msg.key.fromMe,
        chat_id: contactPhone,
        participant: msg.key.participant || null,
        message_type: messageData.type,
        content: messageData.content,
        media_mime_type: messageData.mediaMimeType,
        timestamp_msg: new Date(msg.messageTimestamp * 1000).toISOString(),
        status: msg.key.fromMe ? 'sent' : 'delivered',
        instance_id: instance.id,
        contact_id: contact.id,
        quoted_message_id: messageData.quotedMessage?.id || null,
        metadata: {
          mentions: messageData.mentions || []
        }
      })

      // Atualizar chat com última mensagem usando Supabase
      const lastMessageContent =
        messageData.content || this.getMediaDescription(messageData.type)
      
      // Criar objeto JSON para lastMessage
      const lastMessageObj = {
        content: lastMessageContent,
        type: messageData.type,
        fromMe: msg.key.fromMe,
        timestamp: msg.messageTimestamp * 1000
      }

      await Chat.update(chat.id, {
        last_message: lastMessageObj,
        last_message_time: new Date(msg.messageTimestamp * 1000).toISOString(),
        unread_count: msg.key.fromMe ? chat.unread_count : (chat.unread_count || 0) + 1
      })

      // Emitir evento via WebSocket
      io.to(`instance_${instance.id}`).emit('new_message', {
        instanceId: instance.id,
        chatId: chat.id,
        message: {
          ...message.toJSON(),
          Contact: contact
        }
      })

      // Emitir evento para atualizar lista de chats
      io.to(`instance_${instance.id}`).emit('chats_update', {
        instanceId: instance.id,
        action: 'message_received',
        chatId: chat.id
      })

      // Se não é mensagem própria, emitir notificação
      if (!msg.key.fromMe) {
        io.to(`instance_${instance.id}`).emit('new_notification', {
          instanceId: instance.id,
          chatId: chat.id,
          contact: {
            name: contact.name || contact.pushName || contact.phone,
            phone: contact.phone,
            profilePicUrl: contact.profilePicUrl
          },
          message: lastMessageContent,
          timestamp: message.timestamp
        })
      }

      console.log(
        `Nova mensagem processada para ${contact.name || contact.phone}`
      )
    } catch (error) {
      console.error('Erro ao processar mensagem:', error)
    }
  }

  // Atualizar contatos
  async handleContactsUpdate(instance, eventData, io) {
    try {
      // Os dados podem vir em diferentes estruturas dependendo da Evolution API
      let contactsData = eventData.data?.contacts || eventData.data || eventData || []
      
      // Garantir que sempre seja um array
      const contacts = Array.isArray(contactsData) ? contactsData : [contactsData]

      console.log(`📋 Processando ${contacts.length} contatos para instância ${instance.name}`)

      // Processar contatos sequencialmente com retry para evitar SQLite locks
      let processedCount = 0
      for (const contactData of contacts) {
        // Usar remoteJid como identificador principal
        const contactId = contactData.remoteJid || contactData.id
        if (!contactId) continue

        // Extrair número de telefone do remoteJid (remover @s.whatsapp.net)
        const phoneNumber = contactId.includes('@') ? contactId.split('@')[0] : contactId

        let retryCount = 0
        const maxRetries = 3
        
        while (retryCount < maxRetries) {
          try {
            console.log(`📋 Debug - Processando contato:`, {
              contactId,
              phoneNumber,
              instanceId: instance.id,
              instanceName: instance.name,
              contactData: {
                name: contactData.name || 'sem nome',
                pushName: contactData.pushName || 'sem pushName',
                hasProfilePic: !!contactData.profilePicUrl
              }
            })
            
            // Usar findOrCreate + update para melhor controle de erros
            const [contact, created] = await Contact.findOrCreate({
              where: {
                phone: phoneNumber,
                instanceId: instance.id
              },
              defaults: {
                name: contactData.name || contactData.pushName || phoneNumber,
                pushName: contactData.pushName,
                profilePicUrl: contactData.profilePicUrl,
                isGroup: contactId.includes('@g.us'),
                lastSeen: new Date()
              }
            })

            // Se já existia, atualizar os dados
            if (!created) {
              await contact.update({
                name: contactData.name || contactData.pushName || contact.name || phoneNumber,
                pushName: contactData.pushName || contact.pushName,
                profilePicUrl: contactData.profilePicUrl || contact.profilePicUrl,
                isGroup: contactId.includes('@g.us'),
                lastSeen: new Date()
              })
            }
            
            console.log(`✅ Contato processado: ${contactId} (${created ? 'criado' : 'atualizado'})`)
            processedCount++
            break // Sucesso, sair do loop de retry
            
          } catch (error) {
            console.log(`❌ Erro detalhado ao processar contato ${contactId}:`, {
              name: error.name,
              message: error.message,
              original: error.original,
              errors: error.errors,
              instanceId: instance.id
            })
            retryCount++
            
            if (error.name === 'SequelizeTimeoutError' || error.original?.code === 'SQLITE_BUSY') {
              // SQLite busy - aguardar um pouco antes de tentar novamente
              await new Promise(resolve => setTimeout(resolve, 100 * retryCount))
              
              if (retryCount === maxRetries) {
                console.error(`❌ Falha ao processar contato ${contactId} após ${maxRetries} tentativas:`, error.message)
              }
            } else {
              console.error(`❌ Erro ao processar contato ${contactId}:`, error.message)
              break // Erro não relacionado a lock, parar retry
            }
          }
        }
        
        // Pequeno delay entre contatos para reduzir pressão no banco
        if (contacts.length > 10) {
          await new Promise(resolve => setTimeout(resolve, 5))
        }
      }

      console.log(`✅ Processados ${processedCount}/${contacts.length} contatos para instância ${instance.name}`)

      io.to(`instance_${instance.id}`).emit('contacts_update', {
        instanceId: instance.id,
        contacts: processedCount
      })
    } catch (error) {
      console.error('Erro ao processar atualizações de contatos:', error)
    }
  }

  // Atualizar chats
  async handleChatsUpdate(instance, eventData, io) {
    try {
      console.log('💬 Processando chats.update...')
      
      // A Evolution API pode enviar dados como array direto em .data ou em .data.chats
      const chats = Array.isArray(eventData.data) ? eventData.data : (eventData.data?.chats || [])
      
      console.log(`📋 Processando ${chats.length} chats`)

      for (const chatData of chats) {
        // Usar remoteJid como identificador principal (estrutura da Evolution)
        const chatId = chatData.remoteJid || chatData.id
        if (!chatId) continue
        
        console.log(`💬 Atualizando chat: ${chatId}`)
        
        // Encontrar contato
        const contact = await Contact.findOne({
          where: {
            phone: chatId,
            instanceId: instance.id
          }
        })

        if (contact) {
          console.log(`📋 Debug - Processando chat:`, {
            chatId,
            instanceId: instance.id,
            contactId: contact.id,
            chatData: {
              unreadCount: chatData.unreadCount,
              pin: chatData.pin,
              archived: chatData.archived
            }
          })
          
          const [chat] = await Chat.findOrCreate({
            where: {
              chatId: chatId,
              instanceId: instance.id
            },
            defaults: {
              contactId: contact.id,
              unreadCount: chatData.unreadCount || 0,
              pinned: chatData.pin || false,
              archived: chatData.archived || false
            }
          })

          // Atualizar dados do chat se necessário
          const updateData = {}
          if (chatData.unreadCount !== undefined) updateData.unreadCount = chatData.unreadCount
          if (chatData.pin !== undefined) updateData.pinned = chatData.pin
          if (chatData.archived !== undefined) updateData.archived = chatData.archived
          
          if (Object.keys(updateData).length > 0) {
            await chat.update(updateData)
          }
        } else {
          console.log(`⚠️ Contato não encontrado para chat: ${chatId}`)
        }
      }

      io.to(`instance_${instance.id}`).emit('chats_update', {
        instanceId: instance.id,
        chats: chats.length
      })
    } catch (error) {
      console.error('Erro ao processar atualizações de chats:', error)
    }
  }

  // Atualizar presença
  async handlePresenceUpdate(instance, eventData, io) {
    try {
      const presenceData = eventData.data

      io.to(`instance_${instance.id}`).emit('presence_update', {
        instanceId: instance.id,
        chatId: presenceData.id,
        presence: presenceData.presences
      })
    } catch (error) {
      console.error('Erro ao processar atualização de presença:', error)
    }
  }

  // Extrair conteúdo da mensagem
  extractMessageContent(msg) {
    const message = msg.message || {}

    if (message.conversation) {
      return {
        type: 'text',
        content: message.conversation
      }
    }

    if (message.extendedTextMessage) {
      return {
        type: 'text',
        content: message.extendedTextMessage.text,
        quotedMessage:
          message.extendedTextMessage.contextInfo?.quotedMessage || null,
        mentions: message.extendedTextMessage.contextInfo?.mentionedJid || null
      }
    }

    if (message.imageMessage) {
      return {
        type: 'image',
        content: message.imageMessage.caption || '',
        mediaMimeType: message.imageMessage.mimetype
      }
    }

    if (message.videoMessage) {
      return {
        type: 'video',
        content: message.videoMessage.caption || '',
        mediaMimeType: message.videoMessage.mimetype
      }
    }

    if (message.audioMessage) {
      return {
        type: 'audio',
        content: '',
        mediaMimeType: message.audioMessage.mimetype
      }
    }

    if (message.documentMessage) {
      return {
        type: 'document',
        content:
          message.documentMessage.title ||
          message.documentMessage.fileName ||
          '',
        mediaMimeType: message.documentMessage.mimetype
      }
    }

    if (message.stickerMessage) {
      return {
        type: 'sticker',
        content: '',
        mediaMimeType: message.stickerMessage.mimetype
      }
    }

    if (message.locationMessage) {
      return {
        type: 'location',
        content: `${message.locationMessage.degreesLatitude}, ${message.locationMessage.degreesLongitude}`
      }
    }

    return {
      type: 'system',
      content: 'Mensagem de sistema'
    }
  }

  // Mapear status da mensagem
  mapMessageStatus(status) {
    switch (status) {
      case 0:
        return 'pending'
      case 1:
        return 'sent'
      case 2:
        return 'delivered'
      case 3:
        return 'read'
      default:
        return 'pending'
    }
  }

  // Sincronização automática após conexão
  async performAutoSync(instance) {
    try {
      const instanceId = instance.id
      
      // Rate limiting - máximo 1 auto-sync por 60 segundos por instância
      const canSync = await redisService.checkSyncRateLimit(`auto_${instanceId}`, 1, 60)
      if (!canSync) {
        console.log(`⏸️ Auto-sync bloqueado por rate limit para instância ${instance.name}`)
        return
      }

      console.log(`🚀 Iniciando sincronização automática para instância ${instance.name}`)

      // Emitir início da sincronização
      emitSyncStart(instanceId, 'auto')
      
      // Salvar progresso inicial no Redis
      await redisService.setSyncProgress(instanceId, {
        type: 'auto',
        status: 'starting',
        step: 'Obtendo dados da Evolution API...',
        progress: 5,
        contactsProcessed: 0,
        chatsProcessed: 0,
        totalContacts: 0,
        totalChats: 0
      })

      // Emitir progresso inicial
      emitSyncProgress(instanceId, {
        status: 'starting',
        step: 'Obtendo dados da Evolution API...',
        progress: 5,
        contactsProcessed: 0,
        chatsProcessed: 0,
        totalContacts: 0,
        totalChats: 0
      })

      // Aguardar 2 segundos para instância estar totalmente pronta
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Obter chats do Evolution API (já inclui fotos de perfil otimizadas)
      const evolutionChats = await evolutionApi.getChats(instance.evolutionInstanceId)
      
      // Filtrar chats válidos
      const validChats = evolutionChats.filter(chat => {
        return chat.remoteJid && chat.remoteJid !== 'status@broadcast'
      })

      console.log(`📋 Auto-sync: Processando ${validChats.length} chats válidos`)

      // Atualizar progresso com totais
      await redisService.setSyncProgress(instanceId, {
        type: 'auto',
        status: 'processing',
        step: `Sincronizando ${validChats.length} chats automaticamente...`,
        progress: 10,
        contactsProcessed: 0,
        chatsProcessed: 0,
        totalContacts: validChats.length,
        totalChats: validChats.length
      })

      emitSyncProgress(instanceId, {
        status: 'processing',
        step: `Sincronizando ${validChats.length} chats automaticamente...`,
        progress: 10,
        contactsProcessed: 0,
        chatsProcessed: 0,
        totalContacts: validChats.length,
        totalChats: validChats.length
      })

      let processedCount = 0

      // Processar em lotes menores para auto-sync
      const batchSize = 20
      for (let i = 0; i < validChats.length; i += batchSize) {
        const batch = validChats.slice(i, i + batchSize)
        
        // Processar batch
        for (const chat of batch) {
          try {
            await this.processAutoSyncChat(chat, instance)
            processedCount++

            // Emitir progresso a cada 5 chats processados
            if (processedCount % 5 === 0 || processedCount === validChats.length) {
              const currentProgress = Math.round((processedCount / validChats.length) * 80) + 10 // 10-90%
              
              await redisService.setSyncProgress(instanceId, {
                type: 'auto',
                status: 'processing',
                step: `Processando ${processedCount}/${validChats.length} chats...`,
                progress: currentProgress,
                contactsProcessed: processedCount,
                chatsProcessed: processedCount,
                totalContacts: validChats.length,
                totalChats: validChats.length
              })

              emitSyncProgress(instanceId, {
                status: 'processing',
                step: `Processando ${processedCount}/${validChats.length} chats...`,
                progress: currentProgress,
                contactsProcessed: processedCount,
                chatsProcessed: processedCount,
                totalContacts: validChats.length,
                totalChats: validChats.length
              })
            }
          } catch (error) {
            console.error(`❌ Erro ao processar chat ${chat.remoteJid}:`, error)
            // Continuar com próximo chat
          }
        }

        // Pequena pausa entre lotes para não sobrecarregar
        if (i + batchSize < validChats.length) {
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      }

      // Finalizar progresso
      await redisService.setSyncProgress(instanceId, {
        type: 'auto',
        status: 'finalizing',
        step: 'Finalizando sincronização automática...',
        progress: 95,
        contactsProcessed: processedCount,
        chatsProcessed: processedCount,
        totalContacts: validChats.length,
        totalChats: validChats.length
      })

      // Atualizar última sincronização
      await instance.update({ lastSeen: new Date() })

      // Concluir progresso
      emitSyncComplete(instanceId, true)
      await redisService.deleteSyncProgress(instanceId)

      console.log(`✅ Auto-sync concluído para instância ${instance.name}: ${processedCount} chats processados`)

    } catch (error) {
      console.error(`❌ Erro na sincronização automática:`, error)
      
      // Emitir erro no progresso
      emitSyncComplete(instance.id, false, error.message)
      await redisService.deleteSyncProgress(instance.id)
    }
  }

  // Processar um chat na sincronização automática
  async processAutoSyncChat(chat, instance) {
    // Extrair número do telefone
    const phoneNumber = chat.remoteJid?.includes('@') 
      ? chat.remoteJid.split('@')[0] 
      : chat.remoteJid

    if (!phoneNumber || phoneNumber.trim() === '') {
      return
    }

    // Processar contato
    const contactData = {
      phone: phoneNumber.trim(),
      instanceId: instance.id,
      name: chat.pushName ? chat.pushName.trim() : null,
      pushName: chat.pushName ? chat.pushName.trim() : null,
      profilePicUrl: chat.profilePicUrl || null,
      isGroup: chat.remoteJid?.includes('@g.us') || false,
      groupMetadata: chat.remoteJid?.includes('@g.us') ? JSON.stringify(chat) : null,
      isBlocked: false,
      lastSeen: new Date()
    }

    // Usar upsert para contato
    const [contact] = await Contact.upsert(contactData, {
      where: {
        phone: phoneNumber.trim(),
        instanceId: instance.id
      }
    })

    // Buscar contato para garantir ID correto
    const contactRecord = await Contact.findOne({
      where: {
        phone: phoneNumber.trim(),
        instanceId: instance.id
      }
    })

    if (!contactRecord) return

    // Processar chat
    let lastMessage = null
    let lastMessageTime = null

    if (chat.lastMessage?.message?.conversation) {
      lastMessage = chat.lastMessage.message.conversation
      lastMessageTime = chat.lastMessage.messageTimestamp ? 
        new Date(chat.lastMessage.messageTimestamp * 1000) : null
    }

    const defaultMessage = chat.remoteJid?.includes('@g.us') ? '👥 Grupo do WhatsApp' : '💬 Conversa ativa'
    
    const lastMessageObj = {
      content: lastMessage || defaultMessage,
      type: 'text',
      fromMe: false,
      timestamp: lastMessageTime || new Date()
    }

    const chatData = {
      contactId: contactRecord.id,
      last_message: lastMessageObj,
      last_message_time: lastMessageTime || (chat.updatedAt ? new Date(chat.updatedAt) : null),
      unread_count: chat.unreadCount || 0,
      pinned: chat.pin || chat.pinned || false,
      archived: chat.archived || false
    }

    // Verificar se chat já existe
    const existingChat = await Chat.findOne({
      where: {
        chat_id: chat.remoteJid,
        instance_id: instance.id
      }
    })

    if (!existingChat) {
      // Criar novo chat
      await Chat.create({
        chat_id: chat.remoteJid.trim(),
        instance_id: instance.id,
        contact_id: contactRecord.id,
        ...chatData
      })
    } else {
      // Atualizar chat existente
      await existingChat.update({
        ...chatData,
        lastMessageTime: chatData.lastMessageTime || existingChat.lastMessageTime
      })
    }
  }

  // Obter descrição da mídia
  getMediaDescription(type) {
    switch (type) {
      case 'image':
        return '📷 Imagem'
      case 'video':
        return '🎥 Vídeo'
      case 'audio':
        return '🎵 Áudio'
      case 'document':
        return '📄 Documento'
      case 'sticker':
        return '😄 Figurinha'
      case 'location':
        return '📍 Localização'
      default:
        return 'Mensagem'
    }
  }
}

module.exports = new WebhookController()
