const axios = require('axios')

class EvolutionAPIService {
  constructor() {
    this.baseURL = process.env.EVOLUTION_API_URL || 'http://localhost:8080'
    this.apiKey = process.env.EVOLUTION_API_KEY

    this.api = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
        apikey: this.apiKey
      },
      timeout: 30000
    })
  }

  // Pequeno util para aguardar entre tentativas
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  sanitizePayload(payload = {}) {
    return Object.entries(payload).reduce((acc, [key, value]) => {
      if (value === undefined || value === null) {
        return acc
      }

      if (Array.isArray(value) && value.length === 0) {
        return acc
      }

      if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
        return acc
      }

      acc[key] = value
      return acc
    }, {})
  }

  // Criar instância
  async createInstance(instanceName, webhookUrl) {
    try {
      // Primeiro, criar a instância com payload mínimo
      const createPayload = {
        instanceName,
        integration: 'WHATSAPP-BAILEYS',
        token: instanceName,
        qrcode: true,
        syncFullHistory: true
        // ❌ RabbitMQ desabilitado - usando apenas webhook
        // rabbitmq: {
        //   enabled: true,
        //   events: [
        //     "APPLICATION_STARTUP",
        //     "MESSAGES_UPSERT"
        //   ]
        // }
      }
      
      console.log('Criando instância com payload:', JSON.stringify(createPayload, null, 2))
      const response = await this.api.post('/instance/create', createPayload)
      
      // Pequena espera inicial para a instância ficar disponível 
      console.log('⏳ Aguardando instância inicializar...')
      await this.sleep(1000)

      // Tentar configurar o webhook com retries (crucial para o app)
      if (webhookUrl) {
        const result = await this.setWebhookWithRetry(instanceName, webhookUrl)
        if (!result) {
          // não conseguiu configurar após tentativas, vamos limpar a instância e falhar
          try {
            console.warn('🗑️ Tentando limpar instância devido a falha no webhook...')
            await this.deleteInstance(instanceName)
          } catch (_) {}
          const err = new Error('Falha ao configurar webhook')
          err.reason = 'webhook'
          throw err
        }
      }

      // ❌ WebSocket desabilitado - usando apenas webhook
      // try {
      //   await this.setWebsocket(instanceName)
      //   console.log('✅ WebSocket configurado durante criação da instância')
      // } catch (wsError) {
      //   console.error('❌ Falha ao configurar WebSocket na criação:', wsError.response?.data || wsError.message)
      //   // Não bloquear a criação se o WebSocket falhar - será reconfigurado posteriormente
      // }
      
      return response.data
    } catch (error) {
      // Log estendido para facilitar debug
      const data = error.response?.data
      if (data) {
        try {
          console.error('Erro ao criar instância (detalhes):', JSON.stringify(data, null, 2))
        } catch (_) {
          console.error('Erro ao criar instância:', data)
        }
      } else {
        console.error('Erro ao criar instância:', error.message)
      }
      throw error
    }
  }

  async setInstanceSettings(instanceName, settings = {}) {
    try {
      const defaultSettings = {
        rejectCall: false,
        msgCall:
          process.env.EVOLUTION_CALL_REJECT_MESSAGE ||
          'Este número não aceita chamadas. Por favor, envie uma mensagem.',
        groupsIgnore: false,
        alwaysOnline: false,
        readMessages: false,
        readStatus: false,
        syncFullHistory: true
      }

      const payload = this.sanitizePayload({
        ...defaultSettings,
        ...settings
      })

      const response = await this.api.post(
        `/settings/set/${instanceName}`,
        payload
      )
      return response.data
    } catch (error) {
      console.error(
        'Erro ao configurar settings:',
        error.response?.data || error.message
      )
      throw error
    }
  }

  // Conectar instância
  async connectInstance(instanceName) {
    try {
      const response = await this.api.get(`/instance/connect/${instanceName}`)
      return response.data
    } catch (error) {
      console.error(
        'Erro ao conectar instância:',
        error.response?.data || error.message
      )
      throw error
    }
  }

  // Obter QR/Pairing via endpoint de conexão (retorna pairingCode/code)
  async getQRCode(instanceName) {
    try {
      const response = await this.api.get(`/instance/connect/${instanceName}`)
      return response.data
    } catch (error) {
      console.error(
        'Erro ao obter QR/Pairing:',
        error.response?.data || error.message
      )
      throw error
    }
  }

  // Status da instância
  async getInstanceStatus(instanceName) {
    try {
      const response = await this.api.get(
        `/instance/connectionState/${instanceName}`
      )
      return response.data
    } catch (error) {
      console.error(
        'Erro ao obter status da instância:',
        error.response?.data || error.message
      )
      throw error
    }
  }

  // Obter informações detalhadas da instância
  async getInstanceInfo(instanceName) {
    try {
      const response = await this.api.get(`/instance/fetchInstances?instanceName=${instanceName}`)
      // A API retorna um array, pegamos o primeiro item
      const instances = response.data
      if (instances && instances.length > 0) {
        const instanceData = instances[0]
        // Retornar dados estruturados da Evolution API
        return {
          id: instanceData.id,
          name: instanceData.name,
          connectionStatus: instanceData.connectionStatus,
          owner: instanceData.ownerJid,
          profileName: instanceData.profileName,
          profilePictureUrl: instanceData.profile_pic_url,
          integration: instanceData.integration,
          token: instanceData.token,
          businessId: instanceData.businessId,
          counts: instanceData._count || {},
          createdAt: instanceData.createdAt,
          updatedAt: instanceData.updatedAt,
          settings: instanceData.Setting
        }
      }
      return null
    } catch (error) {
      console.error(
        'Erro ao obter informações da instância:',
        error.response?.data || error.message
      )
      throw error
    }
  }

  // Buscar todas as instâncias (mais eficiente para sincronização)
  async getAllInstances() {
    try {
      const response = await this.api.get('/instance/fetchInstances')
      return response.data || []
    } catch (error) {
      console.error(
        'Erro ao obter todas as instâncias:',
        error.response?.data || error.message
      )
      throw error
    }
  }

  // Buscar configuração de webhook
  async findWebhook(instanceName) {
    const { data } = await this.api.get(`/webhook/find/${instanceName}`)
    return data
  }

  async findWebsocket(instanceName) {
    console.log(`🔍 GET /websocket/find/${instanceName}`)
    const { data } = await this.api.get(`/websocket/find/${instanceName}`)
    console.log(`📥 Resposta do find:`, JSON.stringify(data, null, 2))
    return data
  }

  // Configurar webhook para uma instância
  async setWebhook(instanceName, webhookUrl, events = []) {
    try {
      const defaultEvents = [
        'APPLICATION_STARTUP',
        'QRCODE_UPDATED',
        'MESSAGES_UPSERT',
        'MESSAGES_UPDATE',
        'MESSAGES_DELETE',
        'SEND_MESSAGE',
        'CONTACTS_UPSERT',
        'CONTACTS_UPDATE',
        'PRESENCE_UPDATE',
        'CHATS_UPSERT',
        'CHATS_UPDATE',
        'CONNECTION_UPDATE'
      ]

      // Headers específicos para ngrok (evitar tela de greetings)
      const webhookHeaders = {};
      if (webhookUrl && webhookUrl.includes('ngrok')) {
        webhookHeaders['ngrok-skip-browser-warning'] = 'true';
        webhookHeaders['User-Agent'] = 'EvolutionAPI-Webhook/1.0';
      }

      // Importante: a Evolution API espera o payload sob a propriedade raiz "webhook"
      const payload = {
        webhook: {
          enabled: true,
          url: webhookUrl,
          // Flags opcionais; alguns servidores aceitam camelCase
          webhookByEvents: false, // ✅ Enviar TODOS os eventos, não filtrar
          webhookBase64: true,
          events: events.length > 0 ? events : defaultEvents,
          // Headers customizados para ngrok
          ...(Object.keys(webhookHeaders).length > 0 && { headers: webhookHeaders })
        }
      }

      console.log('Configurando webhook:', JSON.stringify(payload, null, 2))
      const response = await this.api.post(`/webhook/set/${instanceName}`, payload)
      return response.data
    } catch (error) {
      const data = error.response?.data
      if (data) {
        try {
          console.error('Erro ao configurar webhook (detalhes):', JSON.stringify(data, null, 2))
        } catch (_) {
          console.error('Erro ao configurar webhook:', data)
        }
      } else {
        console.error('Erro ao configurar webhook:', error.message)
      }
      throw error
    }
  }

  async setWebsocket(instanceName, events = []) {
    try {
      const defaultEvents = [
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

      const payload = {
        websocket: {
          enabled: true,
          events: events.length > 0 ? events : defaultEvents
        }
      }

      console.log(`📤 POST /websocket/set/${instanceName}`)
      console.log(`📦 Payload:`, JSON.stringify(payload, null, 2))
      const response = await this.api.post(`/websocket/set/${instanceName}`, payload)
      console.log(`✅ Resposta HTTP ${response.status}:`, JSON.stringify(response.data, null, 2))
      return response.data
    } catch (error) {
      const data = error.response?.data
      if (data) {
        try {
          console.error('Erro ao configurar websocket (detalhes):', JSON.stringify(data, null, 2))
        } catch (_) {
          console.error('Erro ao configurar websocket:', data)
        }
      } else {
        console.error('Erro ao configurar websocket:', error.message)
      }
      throw error
    }
  }

  normalizeWebsocketConfig(config) {
    if (!config || typeof config !== 'object') {
      return {
        enabled: false,
        events: []
      }
    }

    if (config.websocket && typeof config.websocket === 'object') {
      return {
        enabled: Boolean(config.websocket.enabled),
        events: Array.isArray(config.websocket.events)
          ? config.websocket.events
          : [],
        raw: config.websocket
      }
    }

    return {
      enabled: Boolean(config.enabled),
      events: Array.isArray(config.events) ? config.events : [],
      raw: config
    }
  }

  async setWebsocketWithRetry(instanceName, events = [], maxAttempts = 6) {
    let attempt = 0
    let lastErr
    while (attempt < maxAttempts) {
      try {
        if (attempt > 0) {
          const delay = Math.min(5000, 1000 * attempt)
          console.log(`⏳ Aguardando ${delay}ms antes de tentar configurar o websocket (tentativa ${attempt + 1}/${maxAttempts})`)
          await this.sleep(delay)
        }

        // Sempre configurar - não verificar antes
        console.log(`📤 Enviando configuração WebSocket para ${instanceName}...`)
        await this.setWebsocket(instanceName, events)
        
        // Verificar se realmente foi aplicado
        await this.sleep(800)
        try {
          const verification = await this.findWebsocket(instanceName)
          const verifiedNormalized = this.normalizeWebsocketConfig(verification)
          console.log(`🔍 [WebSocket] Verificação pós-configuração:`, JSON.stringify(verifiedNormalized, null, 2))
          
          if (verifiedNormalized.enabled) {
            console.log('✅ WebSocket configurado e CONFIRMADO como ativo')
            return verification
          } else {
            console.error(`❌ Provider NÃO ativou o WebSocket mesmo após POST bem-sucedido!`)
            console.error(`📋 Resposta completa:`, JSON.stringify(verification, null, 2))
            
            // Se não ativou, tentar novamente
            if (attempt < maxAttempts - 1) {
              console.warn(`⚠️ Tentando novamente... (tentativa ${attempt + 1}/${maxAttempts})`)
              attempt += 1
              continue
            } else {
              throw new Error('Evolution API não persistiu a configuração do WebSocket após todas as tentativas')
            }
          }
        } catch (verifyError) {
          if (verifyError.response?.status === 404) {
            console.error(`❌ Endpoint /websocket/find retornou 404 - instância pode não existir`)
            const notFoundError = new Error('Instance not found when verifying websocket')
            notFoundError.code = 'EVOLUTION_INSTANCE_NOT_FOUND'
            notFoundError.providerDetails = verifyError.response?.data || verifyError.message
            throw notFoundError
          }
          console.error(`❌ Erro ao verificar configuração:`, verifyError.message)
          throw verifyError
        }
      } catch (err) {
        lastErr = err
        const status = err.response?.status

        if (status === 404) {
          err.code = 'EVOLUTION_INSTANCE_NOT_FOUND'
          err.providerDetails = err.response?.data || err.message
          throw err
        }

        if (status !== 400 && status !== 409 && status !== 500) {
          throw err
        }
        attempt += 1
      }
    }

    console.warn('⚠️ Não foi possível configurar o websocket após várias tentativas. Prosseguindo sem bloquear. Último erro:', lastErr?.response?.data || lastErr?.message)
    return null
  }

  // Configurar webhook com tentativas e backoff
  async setWebhookWithRetry(instanceName, webhookUrl, maxAttempts = 6) {
    let attempt = 0
    let lastErr
    while (attempt < maxAttempts) {
      try {
        // Algumas instâncias precisam de um pequeno tempo para ficarem disponíveis
        if (attempt > 0) {
          const delay = Math.min(5000, 1000 * attempt) // 1s,2s,3s,4s,5s...
          console.log(`Aguardando ${delay}ms antes de tentar configurar o webhook (tentativa ${attempt + 1}/${maxAttempts})`)
          await this.sleep(delay)
        }

        // Opcional: checar se já há um webhook configurado
        try {
          const current = await this.findWebhook(instanceName)
          if (current?.enabled && current?.url) {
            console.log('Webhook já está configurado:', current)
            return current
          }
        } catch (_) {
          // Ignora 404/erros de find
        }

        const result = await this.setWebhook(instanceName, webhookUrl)
        console.log('✅ Webhook configurado com sucesso')
        return result
      } catch (err) {
        lastErr = err
        // Continua tentando em erros 400/404 que podem indicar indisponibilidade momentânea
        const status = err.response?.status
        if (status !== 400 && status !== 404 && status !== 409 && status !== 500) {
          // Erros não recuperáveis
          throw err
        }
        attempt += 1
      }
    }
    console.warn('⚠️ Não foi possível configurar o webhook após várias tentativas. Prosseguindo sem bloquear. Último erro:', lastErr?.response?.data || lastErr?.message)
    return null
  }

  // Logout da instância
  async logoutInstance(instanceName) {
    try {
      const response = await this.api.delete(`/instance/logout/${instanceName}`)
      return response.data
    } catch (error) {
      console.error(
        'Erro ao fazer logout:',
        error.response?.data || error.message
      )
      throw error
    }
  }

  // Deletar instância
  async deleteInstance(instanceName) {
    try {
      const response = await this.api.delete(`/instance/delete/${instanceName}`)
      return response.data
    } catch (error) {
      console.error(
        'Erro ao deletar instância:',
        error.response?.data || error.message
      )
      throw error
    }
  }

  // Enviar mensagem de texto
  async sendText(instanceName, payload) {
    try {
      const body = this.sanitizePayload(payload)

      const response = await this.api.post(
        `/message/sendText/${instanceName}`,
        body
      )
      return response.data
    } catch (error) {
      console.error(
        'Erro ao enviar mensagem:',
        error.response?.data || error.message
      )
      throw error
    }
  }

  // Enviar mídia
  async sendMediaMessage(
    instanceName,
    number,
    mediaPath,
    mediaType,
    caption = '',
    quotedMessageId = null
  ) {
    try {
      const data = {
        number,
        mediaMessage: {
          mediatype: mediaType,
          media: mediaPath,
          caption
        }
      }

      if (quotedMessageId) {
        data.quoted = {
          key: {
            id: quotedMessageId
          }
        }
      }

      const response = await this.api.post(
        `/message/sendMedia/${instanceName}`,
        data
      )
      return response.data
    } catch (error) {
      console.error(
        'Erro ao enviar mídia:',
        error.response?.data || error.message
      )
      throw error
    }
  }

  async sendMedia(instanceName, payload) {
    try {
      const body = this.sanitizePayload(payload)

      const response = await this.api.post(
        `/message/sendMedia/${instanceName}`,
        body
      )
      return response.data
    } catch (error) {
      console.error(
        'Erro ao enviar mídia (sendMedia):',
        error.response?.data || error.message
      )
      throw error
    }
  }

  async sendWhatsAppAudio(instanceName, payload) {
    try {
      const body = this.sanitizePayload(payload)

      const response = await this.api.post(
        `/message/sendWhatsAppAudio/${instanceName}`,
        body
      )
      return response.data
    } catch (error) {
      console.error(
        'Erro ao enviar áudio:',
        error.response?.data || error.message
      )
      throw error
    }
  }

  async sendSticker(instanceName, payload) {
    try {
      const body = this.sanitizePayload(payload)

      const response = await this.api.post(
        `/message/sendSticker/${instanceName}`,
        body
      )
      return response.data
    } catch (error) {
      console.error(
        'Erro ao enviar sticker:',
        error.response?.data || error.message
      )
      throw error
    }
  }

  // Obter contatos - API correta do Evolution
  async getContacts(instanceName) {
    try {
      const response = await this.api.post(`/chat/findContacts/${instanceName}`, {})
      return response.data
    } catch (error) {
      console.error(
        'Erro ao obter contatos:',
        error.response?.data || error.message
      )
      throw error
    }
  }

  // Obter chats (permite personalização de paginação)
  async getChats(instanceName, options = {}) {
    try {
      const {
        where = {},
        limit = 100,
        page = 1,
        offset = null,
        includeHistory,
        withLastMessage = true
      } = options

      const payload = {
        where,
        limit,
        page,
        withLastMessage
      }

      if (offset !== null && offset !== undefined) {
        payload.offset = offset
      }

      if (includeHistory !== undefined) {
        payload.includeHistory = includeHistory
      }

      const response = await this.api.post(
        `/chat/findChats/${instanceName}`,
        payload
      )

      const chats = response.data
      console.log(
        `📋 ${chats?.length || 0} chats obtidos da Evolution API (página ${page}, limite ${limit})`
      )

      return chats || []
    } catch (error) {
      console.error(
        'Erro ao obter chats:',
        error.response?.data || error.message
      )
      throw error
    }
  }

  // Obter mensagens de um chat - API correta do Evolution com paginação
  async getChatMessages(instanceName, chatId, options = {}) {
    try {
      const { page = 1, offset = 0, limit = 50 } = options;
      
      // Construir o payload baseado no formato da documentação da Evolution API
      const payload = {
        where: {
          key: {
            remoteJid: chatId
          }
        }
      };

      // Adicionar paginação - sempre incluir para garantir funcionamento
      payload.page = page;
      payload.offset = offset;
      payload.limit = limit;

      const response = await this.api.post(`/chat/findMessages/${instanceName}`, payload);
      // console.log(`📨 Mensagens obtidas da Evolution API - Chat: ${chatId}, Página: ${page}, Offset: ${offset}, Limite: ${limit}, Total:`, response);
      return response.data;
    } catch (error) {
      console.error(
        'Erro ao obter mensagens da Evolution API:',
        error.response?.data || error.message
      );
      throw error;
    }
  }

  // Marcar mensagens como lidas
  async markAsRead(instanceName, readMessages) {
    try {
      if (!Array.isArray(readMessages) || readMessages.length === 0) {
        throw new Error('readMessages deve ser um array com pelo menos um item')
      }

      const normalizedMessages = readMessages
        .map(message => ({
          remoteJid: message.remoteJid,
          id: message.id,
          fromMe: Boolean(message.fromMe)
        }))
        .filter(message => message.remoteJid && message.id)

      if (normalizedMessages.length === 0) {
        throw new Error('Nenhuma mensagem válida informada para marcar como lida')
      }

      const payload = {
        readMessages: normalizedMessages
      }

      const response = await this.api.post(
        `/chat/markMessageAsRead/${instanceName}`,
        payload
      )
      return response.data
    } catch (error) {
      console.error(
        'Erro ao marcar mensagens como lidas:',
        error.response?.data || error.message
      )
      throw error
    }
  }

  // Definir presença (online, composing, recording, paused)
  async setPresence(instanceName, chatId, presence) {
    try {
      const response = await this.api.put(`/chat/presence/${instanceName}`, {
        number: chatId,
        presence
      })
      return response.data
    } catch (error) {
      console.error(
        'Erro ao definir presença:',
        error.response?.data || error.message
      )
      throw error
    }
  }

  // Download de mídia
  async downloadMedia(instanceName, messageId) {
    try {
      const response = await this.api.get(
        `/message/downloadMedia/${instanceName}`,
        {
          params: { messageId },
          responseType: 'stream'
        }
      )
      return response.data
    } catch (error) {
      console.error(
        'Erro ao baixar mídia:',
        error.response?.data || error.message
      )
      throw error
    }
  }

  // Não existe endpoint dedicado para perfil da instância na Evolution API.
  // Para obter informações de perfil (foto, nome, status) use getContactProfile
  // passando o número (phone) da instância quando disponível.

  // Obter perfil de um contato específico - API correta do Evolution
  async getContactProfile(instanceName, number) {
    try {
      const response = await this.api.post(`/chat/fetchProfile/${instanceName}`, {
        number: number
      })
      return response.data
    } catch (error) {
      console.error(
        'Erro ao obter perfil do contato:',
        error.response?.data || error.message
      )
      throw error
    }
  }

  // Obter foto de perfil de um contato
  async getProfilePicture(instanceName, remoteJid) {
    try {
      const response = await this.api.get(`/chat/getProfilePicUrl/${instanceName}`, {
        params: {
          number: remoteJid
        }
      })
      
      return response.data?.profilePictureUrl || response.data?.url || null
    } catch (error) {
      // Se der 404 ou outro erro, não tem foto de perfil
      if (error.response?.status === 404) {
        return null
      }
      
      console.warn(
        `Erro ao obter foto de perfil para ${remoteJid}:`,
        error.response?.data || error.message
      )
      return null
    }
  }

  // Obter grupos do WhatsApp
  async getWhatsAppGroups(instanceName, getParticipants = false) {
    try {
      const response = await this.api.get(`/group/fetchAllGroups/${instanceName}`, {
        params: {
          getParticipants
        }
      })
      return response.data
    } catch (error) {
      console.error(
        'Erro ao obter grupos:',
        error.response?.data || error.message
      )
      throw error
    }
  }

  // Buscar contatos específicos com filtro
  async findSpecificContacts(instanceName, contactId = null) {
    try {
      const body = contactId ? { where: { id: contactId } } : {}
      const response = await this.api.post(`/chat/findContacts/${instanceName}`, body)
      return response.data
    } catch (error) {
      console.error(
        'Erro ao buscar contatos específicos:',
        error.response?.data || error.message
      )
      throw error
    }
  }

  // Formatar messageId para o formato esperado pela Evolution API
  formatMessageId(messageId) {
    if (!messageId) return '';
    
    // Se o ID já estiver no formato correto (sem traços, apenas letras e números)
    if (/^[A-Z0-9]+$/.test(messageId)) {
      return messageId;
    }
    
    // Se tiver traços, removê-los
    return messageId.replace(/-/g, '');
  }
  
  // Obter base64 de mensagem de mídia
  async getBase64FromMediaMessage(instanceName, messageKey, convertToMp4 = false) {
    try {
      console.log(`📷 Obtendo base64 da Evolution API - Instance: ${instanceName}`)
      console.log(`📝 MessageKey recebido:`, typeof messageKey === 'string' ? messageKey : JSON.stringify(messageKey))
      console.log(`🎬 ConvertToMp4: ${convertToMp4}`)
      
      // Se messageKey for string, é o messageId antigo - precisa ser convertido para objeto
      let messageKeyObj
      if (typeof messageKey === 'string') {
        const formattedMessageId = this.formatMessageId(messageKey)
        messageKeyObj = {
          id: formattedMessageId
        }
      } else {
        // Se já for objeto, usar diretamente
        messageKeyObj = messageKey
      }
      
      console.log(`📍 URL: ${this.baseURL}/chat/getBase64FromMediaMessage/${instanceName}`)
      
      const payload = {
        message: {
          key: messageKeyObj
        },
        convertToMp4: convertToMp4
      };
      
      console.log(`📦 Payload enviado:`, JSON.stringify(payload, null, 2))
      
      const response = await this.api.post(`/chat/getBase64FromMediaMessage/${instanceName}`, payload)
      
      console.log(`✅ Base64 obtido com sucesso da Evolution API`)
      console.log(`📊 Status da resposta:`, response.status)
      console.log(`🔑 Chaves na resposta:`, Object.keys(response.data))
      
      return response.data
    } catch (error) {
      console.error('❌ Erro ao obter base64 da Evolution API:', {
        message: error.message,
        status: error.response?.status,
        data: JSON.stringify(error.response?.data || {}, null, 2),
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers,
          data: error.config?.data
        }
      })
      throw error
    }
  }

  // Obter informações de um grupo
  async getGroupInfo(instanceName, groupJid) {
    try {
      // Normalizar o groupJid (remover @g.us se já tiver)
      const normalizedGroupJid = groupJid.includes('@') 
        ? groupJid.split('@')[0] 
        : groupJid

      console.log(`🔍 Buscando informações do grupo ${normalizedGroupJid}...`)
      
      const response = await this.api.get(
        `/group/findGroupInfos/${instanceName}`,
        {
          params: {
            groupJid: `${normalizedGroupJid}@g.us`
          }
        }
      )

      console.log(`✅ Informações do grupo obtidas:`, {
        id: response.data?.id,
        subject: response.data?.subject,
        size: response.data?.size
      })

      return response.data
    } catch (error) {
      console.error('❌ Erro ao obter informações do grupo:', {
        groupJid,
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      })
      return null // Retornar null em caso de erro ao invés de lançar exceção
    }
  }

}

module.exports = new EvolutionAPIService()
