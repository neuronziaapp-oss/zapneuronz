import { io } from 'socket.io-client'

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001'

class SocketService {
  constructor() {
    this.socket = null
    this.connected = false
    this.listeners = new Map()
  }

  // Conectar ao WebSocket
  connect() {
    const token = localStorage.getItem('whatsapp_token')

    console.log('🔌 Tentando conectar socket...')
    console.log('🔍 Token presente:', !!token)
    console.log('🔍 Socket URL:', SOCKET_URL)

    if (!token) {
      console.warn('⚠️ Tentativa de conectar socket sem token')
      return
    }

    if (this.socket?.connected) {
      console.log('✅ Socket já conectado, reutilizando')
      return this.socket
    }

    console.log('🚀 Criando nova conexão socket...')
    const apiKey = process.env.REACT_APP_API_KEY || localStorage.getItem('api_key')
    console.log('🔍 API Key presente:', !!apiKey)

    this.socket = io(SOCKET_URL, {
      auth: { token }, // padrão socket.io (handshake.auth.token)
      query: { token, api_key: apiKey }, // fallback via querystring
      extraHeaders: apiKey ? { 'x-api-key': apiKey } : {},
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    })

    console.log('📡 Socket criado, configurando listeners...')

    this.setupEventListeners()

    return this.socket
  }

  // Desconectar
  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.connected = false
    }
  }

  // Configurar listeners básicos
  setupEventListeners() {
    if (!this.socket) return

    this.socket.on('connect', () => {
      this.connected = true
      this.isConnected = true
      console.log('✅ Socket CONECTADO com sucesso!')
      console.log('🔗 Socket ID:', this.socket.id)
      console.log('🌐 Transport:', this.socket.io.engine?.transport?.name)
      console.log('🔄 isConnected agora é:', this.isConnected)
      this.emit('connection_status', { connected: true })
    })

    this.socket.on('disconnect', reason => {
      this.connected = false
      this.isConnected = false
      console.log('❌ Socket DESCONECTADO!')
      console.log('📝 Motivo:', reason)
      console.log('🔄 isConnected agora é:', this.isConnected)
      this.emit('connection_status', { connected: false, reason })

      // Tentar reconectar após 5 segundos se não foi desconexão manual
      if (reason !== 'io client disconnect') {
        setTimeout(() => {
          if (!this.connected) {
            this.reconnect()
          }
        }, 5000)
      }
    })

    this.socket.on('connect_error', error => {
      console.error('🚨 ERRO de conexão Socket.io:')
      console.error('💥 Error message:', error.message)
      console.error('🔍 Error details:', error)
      console.error('📊 Error type:', error.type)
      console.error('📡 Error description:', error.description)
      this.emit('connection_error', error)
    })

    // Eventos do WhatsApp
    this.socket.on('qrcode_updated', data => {
      this.emit('qrcode_updated', data)
    })

    this.socket.on('connection_update', data => {
      this.emit('connection_update', data)
    })
    
    this.socket.on('SYNC_PROGRESS', data => {
      console.log('🔄 Socket recebeu evento SYNC_PROGRESS:', data)
      this.emit('SYNC_PROGRESS', data)
    })
    
    this.socket.on('SYNC_START', data => {
      console.log('🔄 Socket recebeu evento SYNC_START:', data)
      this.emit('SYNC_START', data)
    })

    this.socket.on('new_message', data => {
      this.emit('new_message', data)
    })

    this.socket.on('message_update', data => {
      this.emit('message_update', data)
    })
    
    this.socket.on('message_received', data => {
      console.log('📩 Socket recebeu evento message_received:', data)
      this.emit('message_received', data)
    })
    
    this.socket.on('chat_unread_updated', data => {
      console.log('📬 Socket recebeu evento chat_unread_updated:', data)
      this.emit('chat_unread_updated', data)
    })

    this.socket.on('new_notification', data => {
      this.emit('new_notification', data)
    })

    this.socket.on('presence_update', data => {
      this.emit('presence_update', data)
    })

    this.socket.on('contacts_update', data => {
      this.emit('contacts_update', data)
    })

    this.socket.on('chats_reload', data => {
      console.log('🔄 Socket recebeu evento chats_reload:', data)
      this.emit('chats_reload', data)
    })

    this.socket.on('chats_update', data => {
      this.emit('chats_update', data)
    })

    this.socket.on('user_typing', data => {
      this.emit('user_typing', data)
    })

    // Resposta ao ping
    this.socket.on('pong', () => {
      // Manter conexão viva
    })
  }

  // Reconectar
  reconnect() {
    if (!this.connected && localStorage.getItem('whatsapp_token')) {
      console.log('🔄 Tentando reconectar socket...')
      this.connect()
    }
  }

  // Emitir evento interno (para components)
  emit(event, data) {
    const callbacks = this.listeners.get(event) || []
    callbacks.forEach(callback => {
      try {
        callback(data)
      } catch (error) {
        console.error(`Erro ao executar callback para evento ${event}:`, error)
      }
    })
  }

  // Adicionar listener para evento interno
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event).push(callback)
  }

  // Remover listener
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event)
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  // Entrar em sala de instância
  joinInstance(instanceId) {
    console.log(`🚪 Tentando entrar na sala da instância: ${instanceId}`)
    console.log(`🔍 Socket exists:`, !!this.socket)
    console.log(`🔍 Socket connected:`, this.socket?.connected)
    console.log(`� isConnected flag:`, this.isConnected)
    
    if (this.socket?.connected) {
      this.socket.emit('join_instance', instanceId)
      console.log(`✅ Evento 'join_instance' enviado para: ${instanceId}`)
      
      // Adicionar listener para confirmação (se o backend enviar)
      this.socket.once(`joined_instance_${instanceId}`, () => {
        console.log(`🎉 Confirmação: entrou na sala da instância ${instanceId}`)
      })
    } else {
      console.error(`❌ FALHA: Não foi possível entrar na sala da instância ${instanceId}`)
      console.log(`🔍 Socket exists:`, !!this.socket)
      console.log(`🔍 Socket connected:`, this.socket?.connected)
      console.log(`🔍 Socket ID:`, this.socket?.id)
      console.log(`🔍 Connection state:`, this.socket?.connected ? 'CONECTADO' : 'DESCONECTADO')
    }
  }

  // Entrar na sala de progresso de sincronização
  joinSyncProgress(instanceId) {
    console.log(`📊 Tentando entrar na sala de progresso: ${instanceId}`)
    console.log(`🔍 Socket exists:`, !!this.socket)
    console.log(`🔍 Socket connected:`, this.socket?.connected)
    console.log(`🔍 isConnected flag:`, this.isConnected)
    
    // Tentar reconectar se o socket não estiver conectado
    if (!this.socket?.connected) {
      console.log('🔄 Tentando reconectar socket antes de entrar na sala de progresso')
      this.connect()
    }
    
    if (this.socket) {
      this.socket.emit('join_sync_progress', instanceId)
      console.log(`✅ Evento 'join_sync_progress' enviado para: ${instanceId}`)
      
      // Adicionar listener para confirmação (se o backend enviar)
      this.socket.once(`joined_sync_progress_${instanceId}`, () => {
        console.log(`🎉 Confirmação: entrou na sala de progresso ${instanceId}`)
      })
    } else {
      console.error(`❌ FALHA: Não foi possível entrar na sala de progresso ${instanceId}`)
      console.log(`🔍 Socket exists:`, !!this.socket)
      console.log(`🔍 Socket connected:`, this.socket?.connected)
      console.log(`🔍 Socket ID:`, this.socket?.id)
      console.log(`🔍 Connection state:`, this.socket?.connected ? 'CONECTADO' : 'DESCONECTADO')
    }
  }

  // Sair da sala de instância
  leaveInstance(instanceId) {
    if (this.socket?.connected) {
      this.socket.emit('leave_instance', instanceId)
      console.log(`👤 Saindo da instância: ${instanceId}`)
    }
  }

  // Indicar que está digitando
  startTyping(instanceId, chatId) {
    if (this.socket?.connected) {
      this.socket.emit('typing_start', { instanceId, chatId })
    }
  }

  // Parar de indicar que está digitando
  stopTyping(instanceId, chatId) {
    if (this.socket?.connected) {
      this.socket.emit('typing_stop', { instanceId, chatId })
    }
  }

  // Marcar mensagem como vista
  markMessageAsSeen(instanceId, messageId) {
    if (this.socket?.connected) {
      this.socket.emit('message_seen', { instanceId, messageId })
    }
  }

  // Ping para manter conexão
  ping() {
    if (this.socket?.connected) {
      this.socket.emit('ping')
    }
  }

  // Verificar se está conectado
  isConnected() {
    return this.connected && this.socket?.connected
  }

  // Obter ID do socket
  getId() {
    return this.socket?.id
  }

  // Limpar todos os listeners internos
  clearListeners() {
    this.listeners.clear()
  }
}

// Exportar instância única
const socketService = new SocketService()
export default socketService
