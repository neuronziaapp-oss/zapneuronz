const { Server } = require('socket.io')
const jwt = require('jsonwebtoken')
const { SupabaseUser } = require('../models')
const bcrypt = require('bcryptjs')
const { supabaseAdmin } = require('../config/supabase')

/**
 * Garantir que o usuário iframe existe no Supabase
 */
async function ensureIframeUser() {
  const iframeUserId = 'aee9c880-9205-4c76-b260-062f6772af16'
  const iframeName = 'Agent Web Interface'
  const iframeEmail = 'agent-iframe@neurons.local'

  try {
    console.log('🔨 Verificando se usuário iframe existe...')
    
    // Verificar se usuário já existe
    const { data: existingUser, error: selectError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', iframeUserId)
      .single()
    
    if (selectError && selectError.code !== 'PGRST116') {
      throw selectError
    }
    
    if (!existingUser) {
      console.log('🔨 Criando usuário iframe no Supabase...')
      
      // Criar um hash de senha para usuários de sistema
      const systemPassword = await bcrypt.hash('system-user-no-login', 12)
      
      const { error } = await supabaseAdmin
        .from('users')
        .insert({
          id: iframeUserId,
          name: iframeName,
          email: iframeEmail,
          password: systemPassword,
          role: 'admin',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      
      if (error) {
        console.error('❌ Erro ao criar usuário iframe:', error)
      } else {
        console.log('✅ Usuário iframe criado com sucesso!')
      }
    } else {
      console.log('✅ Usuário iframe já existe')
    }
  } catch (error) {
    console.error('❌ Erro ao garantir usuário iframe:', error)
  }
}

let io

const initSocket = server => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling']
  })

  // Middleware de autenticação para Socket.IO (suporta JWT, API Key + iframe mode)
  io.use(async (socket, next) => {
    // console.log('\n================ SOCKET.IO AUTH ================')
    const ts = new Date().toISOString()
    // console.log('📅 Timestamp:', ts)
    try {
      // Fonte oficial de dados de handshake
      const hs = socket.handshake || {}
      const authObj = hs.auth || {}
      const query = hs.query || {}
      const headers = hs.headers || {}

      // Coleta de credenciais
      const token = authObj.token || query.token || extractBearer(headers.authorization)
      const apiKey = headers['x-api-key'] || headers['api-key'] || query.api_key
      const iframeMode = process.env.IFRAME_MODE === 'true'
      
      // Helper para extrair token Bearer
      function extractBearer(auth) {
        if (!auth) return null;
        const parts = auth.split(' ');
        if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
          return parts[1];
        }
        return null;
      }

      // console.log('🔐 Iniciando autenticação Socket.IO')
      // console.log('🧪 handshake.auth:', JSON.stringify(authObj))
      // console.log('🧪 handshake.query:', JSON.stringify(query))
      // console.log('🧪 headers.x-api-key:', headers['x-api-key'] ? 'present' : 'absent')
      // console.log('🔑 JWT token presente?', !!token)
      // console.log('🗝️ API Key presente?', !!apiKey)
      // console.log('🖼️ IFRAME_MODE:', iframeMode)
      // console.log('🔐 IFRAME_API_KEY definido?', !!process.env.IFRAME_API_KEY)

      const iframeUserId = 'aee9c880-9205-4c76-b260-062f6772af16'
      let user = null
      let decoded = null

      // 1. Tentar validar JWT se houver
      if (token) {
        try {
          console.log('🔍 Validando JWT...')
            decoded = jwt.verify(token, process.env.JWT_SECRET)
          // console.log('✅ JWT OK. Payload:', decoded)
          if (decoded.id === iframeUserId) {
            // console.log('🖼️ JWT pertence ao usuário iframe -> garantindo existência')
            await ensureIframeUser()
          }
          user = await SupabaseUser.findById(decoded.id)
        } catch (err) {
          console.log('⚠️ Falha ao validar JWT:', err.message)
        }
      }

      // 2. Fallback: API Key + iframe mode (sem JWT ou JWT inválido)
      if (!user && iframeMode && apiKey && apiKey === process.env.IFRAME_API_KEY) {
        // console.log('🔄 Fallback API Key + IFRAME_MODE')
        await ensureIframeUser()
        user = await SupabaseUser.findById(iframeUserId)
      }

      // 3. Erros
      if (!user) {
        console.log('❌ Autenticação falhou: usuário não encontrado (token/API Key falhos)')
        return next(new Error('Token inválido'))
      }

      if (!user.is_active && !user.isActive) {
        console.log('❌ Usuário inativo:', user.email)
        return next(new Error('Token inválido ou usuário inativo'))
      }

      // 4. Sucesso
      // console.log('✅ Autenticação concluída. Usuário:', user.email)
      socket.user = user
      return next()
    } catch (error) {
      console.log('💣 Erro inesperado na autenticação Socket.IO:', error.message)
      return next(new Error('Token inválido'))
    }
  })

  io.on('connection', socket => {
    console.log('🎉 Nova conexão Socket.IO estabelecida!')
    console.log(`� Usuário: ${socket.user.name} (${socket.user.email})`)
    console.log(`🆔 Socket ID: ${socket.id}`)
    console.log(`🌐 Transport: ${socket.conn.transport.name}`)

    // Entrar em sala da instância
    socket.on('join_instance', instanceId => {
      const roomName = `instance_${instanceId}`
      socket.join(roomName)
      console.log(`✅ SUCESSO: ${socket.user.name} entrou na sala ${roomName}`)
      console.log(`👥 Clientes na sala ${roomName}:`, io.sockets.adapter.rooms.get(roomName)?.size || 0)
      
      // Opcional: confirmar entrada na sala
      socket.emit(`joined_instance_${instanceId}`, { success: true })
    })

    // Sala para progresso de sincronização
    socket.on('join_sync_progress', instanceId => {
      const roomName = `sync_progress_${instanceId}`
      socket.join(roomName)
      console.log(`✅ SUCESSO: ${socket.user.name} acompanhando progresso da sala ${roomName}`)
      console.log(`👥 Clientes na sala ${roomName}:`, io.sockets.adapter.rooms.get(roomName)?.size || 0)
      
      // Opcional: confirmar entrada na sala
      socket.emit(`joined_sync_progress_${instanceId}`, { success: true })
    })

    // Sair da sala de progresso
    socket.on('leave_sync_progress', instanceId => {
      socket.leave(`sync_progress_${instanceId}`)
      console.log(`📊 ${socket.user.name} parou de acompanhar progresso da instância ${instanceId}`)
    })

    // Sair da sala da instância
    socket.on('leave_instance', instanceId => {
      socket.leave(`instance_${instanceId}`)
      console.log(`👤 ${socket.user.name} saiu da instância ${instanceId}`)
    })

    // Indicar que está digitando
    socket.on('typing_start', data => {
      socket.to(`instance_${data.instanceId}`).emit('user_typing', {
        chatId: data.chatId,
        user: socket.user.name,
        isTyping: true
      })
    })

    // Parar de indicar que está digitando
    socket.on('typing_stop', data => {
      socket.to(`instance_${data.instanceId}`).emit('user_typing', {
        chatId: data.chatId,
        user: socket.user.name,
        isTyping: false
      })
    })

    // Marcar mensagem como visualizada
    socket.on('message_seen', data => {
      socket.to(`instance_${data.instanceId}`).emit('message_status_update', {
        messageId: data.messageId,
        status: 'read',
        seenBy: socket.user.name
      })
    })

    // Evento de ping para manter conexão viva
    socket.on('ping', () => {
      socket.emit('pong')
    })

    // Desconexão
    socket.on('disconnect', reason => {
      console.log('💔 Usuário desconectou!')
      console.log(`👤 Usuário: ${socket.user.name} (${socket.user.email})`)
      console.log(`🆔 Socket ID: ${socket.id}`)
      console.log(`📝 Motivo: ${reason}`)
      console.log(`⏰ Timestamp: ${new Date().toISOString()}`)
    })

    // Eventos de erro
    socket.on('error', error => {
      console.error(`Erro no socket do usuário ${socket.user.name}:`, error)
    })
  })

  // Eventos globais para administradores
  io.on('connection', socket => {
    if (socket.user.role === 'admin') {
      socket.join('admin_room')
    }
  })

  console.log('✅ Socket.IO inicializado')
}

const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO não foi inicializado')
  }
  return io
}

// Emitir notificação para administradores
const emitToAdmins = (event, data) => {
  if (io) {
    io.to('admin_room').emit(event, data)
  }
}

// Emitir para todos os usuários conectados
const emitToAll = (event, data) => {
  if (io) {
    io.emit(event, data)
  }
}

// Emitir para usuários específicos de uma instância
const emitToInstance = (instanceId, event, data) => {
  if (io) {
    io.to(`instance_${instanceId}`).emit(event, data)
  }
}

// Emitir progresso de sincronização
const emitSyncProgress = (instanceId, progress) => {
  if (io) {
    const room = `sync_progress_${instanceId}`
    const clients = io.sockets.adapter.rooms.get(room)
    const clientCount = clients ? clients.size : 0
    
    // console.log(`📊 Enviando progresso para ${clientCount} cliente(s) na sala ${room}:`, progress)
    
    io.to(room).emit('SYNC_PROGRESS', {
      instanceId,
      type: progress.type || 'manual', // Garantir que type sempre está presente
      ...progress,
      timestamp: new Date().toISOString()
    })
    
    if (clientCount === 0) {
      console.log(`⚠️ Nenhum cliente conectado à sala de progresso ${room}`)
    }
  }
}

// Emitir início de sincronização
const emitSyncStart = (instanceId, type = 'manual') => {
  if (io) {
    const room = `sync_progress_${instanceId}`
    const clients = io.sockets.adapter.rooms.get(room)
    const clientCount = clients ? clients.size : 0
    
    const startData = {
      instanceId,
      type, // 'auto' | 'manual'
      status: 'starting',
      step: 'Iniciando sincronização...',
      progress: 0,
      timestamp: new Date().toISOString()
    }

    // console.log(`🚀 Iniciando sync ${type} (${clientCount} clientes)`)
    io.to(room).emit('SYNC_START', startData)
    
    if (clientCount === 0) {
      console.log(`⚠️ Nenhum cliente conectado à sala de start ${room}`)
    }
  }
}

// Emitir fim de sincronização
const emitSyncComplete = (instanceId, success = true, error = null) => {
  if (io) {
    const room = `sync_progress_${instanceId}`
    const clients = io.sockets.adapter.rooms.get(room)
    const clientCount = clients ? clients.size : 0
    
    const completeData = {
      instanceId,
      status: success ? 'completed' : 'error',
      step: success ? 'Sincronização concluída!' : 'Erro na sincronização',
      progress: success ? 100 : 0,
      error,
      timestamp: new Date().toISOString()
    }
    
    console.log(`${success ? '✅' : '❌'} Sync finalizado (${clientCount} clientes)`)
    io.to(room).emit('SYNC_COMPLETE', completeData)
    
    if (clientCount === 0) {
      console.log(`⚠️ Nenhum cliente conectado à sala de complete ${room}`)
    }
  }
}

// Obter usuários conectados
const getConnectedUsers = () => {
  if (!io) return []

  const users = []
  const sockets = io.sockets.sockets

  sockets.forEach(socket => {
    if (socket.user) {
      users.push({
        id: socket.user.id,
        name: socket.user.name,
        email: socket.user.email,
        role: socket.user.role,
        connectedAt: socket.handshake.time
      })
    }
  })

  return users
}

// Obter estatísticas de conexão
const getConnectionStats = () => {
  if (!io)
    return { totalConnections: 0, adminConnections: 0, operatorConnections: 0 }

  const sockets = io.sockets.sockets
  let totalConnections = 0
  let adminConnections = 0
  let operatorConnections = 0

  sockets.forEach(socket => {
    if (socket.user) {
      totalConnections++
      if (socket.user.role === 'admin') {
        adminConnections++
      } else {
        operatorConnections++
      }
    }
  })

  return {
    totalConnections,
    adminConnections,
    operatorConnections
  }
}

module.exports = {
  initSocket,
  getIO,
  emitToAdmins,
  emitToAll,
  emitToInstance,
  emitSyncProgress,
  emitSyncStart,
  emitSyncComplete,
  getConnectedUsers,
  getConnectionStats
}
