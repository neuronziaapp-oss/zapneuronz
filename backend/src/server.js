const express = require('express')
const http = require('http')
const cors = require('cors')
const helmet = require('helmet')
const compression = require('compression')
const rateLimit = require('express-rate-limit')
const path = require('path')
require('dotenv').config()

// Importar configuração do Supabase
const { supabaseAdmin } = require('./config/supabase')

// Importar serviços
const { initSocket } = require('./services/socket')
const redisService = require('./config/redis')
const { Instance } = require('./models/supabase')
// ❌ WebSocket desabilitado - usando apenas webhook
// const evolutionWebsocket = require('./services/evolutionWebsocket')

// Ngrok só é necessário em desenvolvimento; carrega sob demanda
let ngrokService
const loadNgrokService = () => {
  if (!ngrokService) {
    // eslint-disable-next-line global-require
    ngrokService = require('./services/ngrok')
  }
  return ngrokService
}

// Importar rotas
const authRoutes = require('./routes/auth')
const instanceRoutes = require('./routes/instances')
const chatRoutes = require('./routes/chats')
const messageRoutes = require('./routes/messages')
const webhookRoutes = require('./routes/webhook')
const dashboardRoutes = require('./routes/dashboard')

// Configurações
const PORT = process.env.PORT || 3001
const NODE_ENV = process.env.NODE_ENV || 'development'

// Criar aplicação Express
const app = express()
const server = http.createServer(app)

// ✅ CONFIGURAR TRUST PROXY PRIMEIRO (necessário para Docker/Nginx)
app.set('trust proxy', true)

// Middlewares de segurança
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
)
app.use(compression())

// Rate limiting com configuração para Docker/Proxy
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: NODE_ENV === 'production' ? 1000 : 10000,
  message: {
    error: 'Muitas tentativas. Tente novamente em 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Desabilitar validações para evitar erro com proxy
  validate: false,
  // Usar header correto para identificar IP através de proxy
  keyGenerator: (req) => {
    return req.ip || 
           req.headers['x-real-ip'] || 
           req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
           req.socket.remoteAddress || 
           'unknown'
  }
})

app.use('/api/', limiter)

// CORS
const allowedOrigins = [
  'http://localhost:3000',
  'https://app.zapneuronz.com.br',
  process.env.FRONTEND_URL
].filter(Boolean) // Remove valores undefined

const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sem origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true)
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      console.warn('CORS bloqueado para origem:', origin)
      callback(null, true) // Em produção com iframe, é mais flexível permitir
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}

app.use(cors(corsOptions))

// Parser JSON
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Servir arquivos estáticos (uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

// Middleware de logging
if (NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`)
    next()
  })
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: NODE_ENV
  })
})

// Rotas da API
app.use('/api/auth', authRoutes)
app.use('/api/instances', instanceRoutes)
app.use('/api', chatRoutes)
app.use('/api', messageRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/webhook', webhookRoutes)

// Middleware para rotas não encontradas
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint não encontrado' })
})

// Middleware de tratamento de erros global
app.use((error, req, res, next) => {
  console.error('Erro não tratado:', error)

  // Erro do Multer (upload)
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'Arquivo muito grande. Tamanho máximo: 50MB'
    })
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      error: 'Campo de arquivo inválido'
    })
  }

  // Erro de JWT
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Token inválido' })
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expirado' })
  }

  // Erro do Sequelize
  if (error.name === 'SequelizeValidationError') {
    return res.status(400).json({
      error: 'Dados inválidos',
      details: error.errors.map(e => e.message)
    })
  }

  if (error.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({
      error: 'Registro duplicado',
      field: error.errors[0]?.path
    })
  }

  // Erro genérico
  res.status(500).json({
    error:
      NODE_ENV === 'production' ? 'Erro interno do servidor' : error.message
  })
})

// Testar conexão com Supabase
const testSupabaseConnection = async () => {
  try {
    console.log('🔗 Testando conexão com Supabase...')
    
    // Teste simples de conexão
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('count', { count: 'exact', head: true })
    
    if (error) {
      throw error
    }
    
    console.log('✅ Conexão com Supabase estabelecida com sucesso')
  } catch (error) {
    console.error('❌ Erro ao conectar com Supabase:', error.message)
    console.error('📝 Verifique as variáveis SUPABASE_URL e SUPABASE_SERVICE_KEY')
    console.warn('⚠️ Servidor continuará iniciando para permitir diagnóstico...')
    // Não lançar erro em produção para permitir que o servidor suba
    if (process.env.NODE_ENV !== 'production') {
      throw error
    }
  }
}

// Verificar e inicializar ngrok se há instâncias ativas
const checkAndInitializeNgrok = async () => {
  try {
    // Só verificar em ambiente de desenvolvimento
    if (process.env.NODE_ENV !== 'development' || process.env.WEBHOOK_URL) {
      return
    }

    const ngrok = loadNgrokService()

    // Opção 1: Sempre iniciar ngrok em desenvolvimento (descomente a linha abaixo)
    const alwaysStartNgrok = true
    
    // Opção 2: Só iniciar se há instâncias conectadas (padrão atual)
    // const alwaysStartNgrok = false

    if (alwaysStartNgrok) {
      if (!ngrok.isActive()) {
        console.log('🚇 Iniciando túnel ngrok (desenvolvimento)...')
        await ngrok.startTunnel(3001)
        console.log('✅ Túnel ngrok ativado')
      } else {
        console.log('✅ Túnel ngrok já está ativo')
      }
      return
    }

    // Verificar se há instâncias no banco
    const instances = await Instance.findAll({
      where: { status: 'connected' }
    })

    if (instances.length > 0) {
      console.log(`🔍 Encontradas ${instances.length} instância(s) ativa(s)`)
      
      if (!ngrok.isActive()) {
        console.log('🚇 Iniciando túnel ngrok para instâncias existentes...')
        await ngrok.startTunnel(3001)
        console.log('✅ Túnel ngrok ativado para instâncias existentes')
      } else {
        console.log('✅ Túnel ngrok já está ativo')
      }
    } else {
      console.log('📝 Nenhuma instância ativa encontrada - ngrok não iniciado')
    }
  } catch (error) {
    console.error('❌ Erro ao verificar instâncias para ngrok:', error.message)
  }
}

// Inicializar servidor
const startServer = async () => {
  try {
    console.log('🔄 Iniciando servidor...')

    // Testar conexão com Supabase
    await testSupabaseConnection()

    // Conectar ao Redis
    await redisService.connect()

    // Inicializar Socket.IO
    initSocket(server)

    // ❌ WebSocket desabilitado - usando apenas webhook
    // await evolutionWebsocket.initialize()

    // Verificar se há instâncias ativas e inicializar ngrok se necessário
    await checkAndInitializeNgrok()

    // Criar diretório de uploads se não existir
    const fs = require('fs')
    const uploadsDir = path.join(__dirname, '../uploads')
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
      console.log('📁 Diretório de uploads criado')
    }

    // Iniciar servidor
    server.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`)
      console.log(`🌍 Ambiente: ${NODE_ENV}`)
      console.log(`🔗 API: http://localhost:${PORT}/api`)
      console.log(`📡 WebSocket: http://localhost:${PORT}`)

      if (NODE_ENV === 'development') {
        console.log(`📋 Health Check: http://localhost:${PORT}/health`)
        console.log(`📁 Uploads: http://localhost:${PORT}/uploads`)
      }
    })

    // Tratamento de shutdown graceful
    const gracefulShutdown = async signal => {
      console.log(`\n📴 Recebido ${signal}. Iniciando shutdown graceful...`)

      // Fechar túnel ngrok se estiver ativo
      if (NODE_ENV === 'development') {
        const ngrok = loadNgrokService()
        if (ngrok.isActive()) {
          await ngrok.stopTunnel()
        }
      }

    // Desconectar Redis
    await redisService.disconnect()

    // ❌ WebSocket desabilitado
    // await evolutionWebsocket.shutdown()

      server.close(err => {
        if (err) {
          console.error('❌ Erro durante shutdown:', err)
          process.exit(1)
        }

        console.log('✅ Servidor fechado com sucesso')
        process.exit(0)
      })

      // Forçar fechamento após 10 segundos
      setTimeout(() => {
        console.log('⚠️ Forçando fechamento do servidor...')
        process.exit(1)
      }, 10000)
    }

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error)
    process.exit(1)
  }
}

// Tratar erros não capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
})

process.on('uncaughtException', error => {
  console.error('❌ Uncaught Exception:', error)
  process.exit(1)
})

// Inicializar aplicação
startServer()
