const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const { supabaseAdmin } = require('../config/supabase')
const SupabaseUser = require('../models/SupabaseUser')
const { isClientAuthorized, getClientInfo } = require('../config/authorizedClients')

/**
 * Garantir que usuário de sistema existe no Supabase
 */
async function ensureSystemUser(id, name, email) {
  try {
    // Verificar se usuário já existe por ID
    const { data: existingUserById, error: errorById } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('id', id)
      .maybeSingle()
    
    if (existingUserById) {
      // Usuário já existe
      return true
    }
    
    // Verificar se já existe usuário com este email (mas ID diferente)
    const { data: existingUserByEmail, error: errorByEmail } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('email', email)
      .maybeSingle()
    
    if (existingUserByEmail) {
      // Usuário com este email existe mas com ID diferente - não criar
      console.log(`⚠️ Usuário com email ${email} já existe com ID diferente`)
      return false
    }
    
    // Criar novo usuário de sistema
    console.log(`🔨 Criando usuário de sistema: ${name}`)
    
    const systemPassword = await bcrypt.hash('system-user-no-login', 12)
    
    const { error } = await supabaseAdmin
      .from('users')
      .insert({
        id,
        name,
        email,
        password: systemPassword,
        role: 'admin',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    
    if (error) {
      console.error('Erro ao criar usuário de sistema:', error)
      return false
    } else {
      console.log(`✅ Usuário de sistema criado: ${name}`)
      return true
    }
  } catch (error) {
    console.error('Erro ao garantir usuário de sistema:', error)
    return false
  }
}

/**
 * Middleware de autenticação para uso em iframe
 * Suporta multi-tenancy através do client_id
 * Aceita API Key via header ou query parameter
 */
const iframeAuth = async (req, res, next) => {
  try {
    console.log('🖼️ IframeAuth: Processando autenticação')
    
    // Buscar client_id dos parâmetros da URL ou headers
    const clientId = req.query.client_id || 
                     req.headers['x-client-id'] || 
                     req.body.client_id

    // Buscar API Key no header ou query params
    const apiKey = req.headers['x-api-key'] || 
                  req.headers['api-key'] || 
                  req.query.api_key ||
                  req.body.api_key

    // Modo iframe simples (sem API Key e sem client_id) - apenas se IFRAME_MODE=true
    const iframeMode = process.env.IFRAME_MODE === 'true'
    
    if (iframeMode && !clientId && !apiKey) {
      console.log('✅ IframeAuth: Modo iframe simples (sem client_id), usando usuário padrão')
      req.apiAuth = {
        authenticated: true,
        method: 'iframe_mode',
        timestamp: new Date().toISOString()
      }
      
      // Usuário padrão para modo iframe sem client_id
      const iframeUserId = 'aee9c880-9205-4c76-b260-062f6772af16'
      req.user = {
        id: iframeUserId,
        name: 'Agent Web Interface',
        email: 'agent-iframe@neurons.local',
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      await ensureSystemUser(iframeUserId, 'Iframe User', 'iframe@system.local')
      console.log('✅ IframeAuth: Usuário padrão definido')
      return next()
    }

    // Se tem client_id, precisa validar API Key
    if (clientId) {
      console.log(`🔑 IframeAuth: client_id detectado: ${clientId}`)
      
      // Validar se cliente está autorizado (se whitelist habilitada)
      if (!isClientAuthorized(clientId)) {
        console.warn(`⚠️ Client ID não autorizado: ${clientId}`)
        return res.status(403).json({ 
          error: 'Client not authorized',
          message: 'This client_id is not authorized to access the application'
        })
      }

      // Obter informações do cliente
      const clientInfo = getClientInfo(clientId)
      if (clientInfo) {
        console.log(`✅ Cliente autorizado: ${clientInfo.name}`)
      }
      
      // Validar API Key obrigatória quando usa client_id
      if (!apiKey) {
        return res.status(401).json({ 
          error: 'API Key required',
          message: 'When using client_id, you must provide an API key in header (x-api-key) or query parameter (api_key)'
        })
      }

      // Validar API Key
      const validApiKey = process.env.IFRAME_API_KEY || process.env.REACT_APP_API_KEY
      if (!validApiKey) {
        console.error('IFRAME_API_KEY not configured in environment')
        return res.status(500).json({ error: 'Server configuration error' })
      }

      if (apiKey !== validApiKey) {
        return res.status(401).json({ 
          error: 'Invalid API Key',
          message: 'The provided API key is not valid'
        })
      }

      // Buscar ou criar usuário para este client_id
      const clientName = req.query.client_name || req.headers['x-client-name'] || null
      const user = await SupabaseUser.findOrCreateByClientId(clientId, clientName)
      
      if (!user) {
        return res.status(500).json({ 
          error: 'User creation failed',
          message: 'Could not create or find user for this client_id'
        })
      }

      // Definir usuário no request
      req.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || 'operator',
        client_id: user.client_id,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }

      req.apiAuth = {
        authenticated: true,
        method: 'api_key_with_client_id',
        client_id: clientId,
        timestamp: new Date().toISOString()
      }

      console.log(`✅ IframeAuth: Usuário autenticado para client_id: ${clientId}`, user.name)
      return next()
    }

    // Caso tenha apenas API Key (sem client_id) - usuário compartilhado
    if (apiKey) {
      const validApiKey = process.env.IFRAME_API_KEY || process.env.REACT_APP_API_KEY
      if (!validApiKey) {
        console.error('IFRAME_API_KEY not configured in environment')
        return res.status(500).json({ error: 'Server configuration error' })
      }

      if (apiKey !== validApiKey) {
        return res.status(401).json({ 
          error: 'Invalid API Key',
          message: 'The provided API key is not valid'
        })
      }

      // API Key válida sem client_id - usuário compartilhado
      const apiKeyUserId = '00000000-0000-0000-0000-000000000002'
      req.user = {
        id: apiKeyUserId,
        name: 'API Key User',
        email: 'apikey@system.local',
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      req.apiAuth = {
        authenticated: true,
        method: 'api_key',
        timestamp: new Date().toISOString()
      }

      await ensureSystemUser(apiKeyUserId, 'API Key User', 'apikey@system.local')
      console.log('✅ IframeAuth: Usuário API Key compartilhado autenticado')
      return next()
    }

    // Nenhum método de autenticação válido
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Provide client_id with API key, or enable IFRAME_MODE in environment'
    })

  } catch (error) {
    console.error('Error in iframe auth middleware:', error)
    res.status(500).json({ error: 'Authentication error', details: error.message })
  }
}

/**
 * Middleware para JWT - usado em multi-tenancy
 */
const jwtAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    
    if (!token) {
      return res.status(401).json({ error: 'Token required' })
    }

    // Verificar e decodificar o token
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    
    // Buscar dados completos do usuário no banco
    const user = await SupabaseUser.findById(decoded.id)
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }
    
    if (!user.is_active) {
      return res.status(401).json({ error: 'User is inactive' })
    }
    
    // Definir usuário no request com todos os dados
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      client_id: user.client_id,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    }
    
    // console.log(`✅ JWT Auth: Usuário autenticado - ${user.name} (client_id: ${user.client_id || 'N/A'})`)
    
    next()
  } catch (error) {
    console.error('JWT Auth error:', error)
    res.status(401).json({ error: 'Invalid token' })
  }
}

/**
 * Middleware híbrido - aceita tanto API Key quanto JWT
 * PRIORIDADE: JWT Token > API Key (para multi-tenancy)
 */
const hybridAuth = (req, res, next) => {
  // console.log('🔐 HybridAuth: Processando requisição', req.method, req.path)
  
  // PRIORIDADE 1: JWT Token (usado em multi-tenancy)
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (token) {
    // console.log('🎫 HybridAuth: JWT Token detectado (prioridade), usando jwtAuth')
    return jwtAuth(req, res, next)
  }

  // PRIORIDADE 2: API Key (fallback ou autenticação inicial)
  const apiKey = req.headers['x-api-key'] || 
                req.headers['api-key'] || 
                req.query.api_key ||
                req.body.api_key

  if (apiKey) {
    // console.log('🔑 HybridAuth: API Key detectada, usando iframeAuth')
    return iframeAuth(req, res, next)
  }

  // Nenhum método de auth fornecido
  // console.log('❌ HybridAuth: Nenhum método de autenticação fornecido')
  return res.status(401).json({ 
    error: 'Authentication required',
    message: 'Provide either JWT token (Authorization header) or API key (x-api-key header or api_key parameter)'
  })
}

module.exports = {
  iframeAuth,
  jwtAuth,
  hybridAuth
}