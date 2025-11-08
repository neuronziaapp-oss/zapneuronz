const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const { User } = require('../models/supabase')
const SupabaseUser = require('../models/SupabaseUser')

class AuthController {
  // Login
  async login(req, res) {
    try {
      const { email, password } = req.body

      if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios' })
      }

      const user = await User.findByEmail(email)

      if (!user || !user.is_active) {
        return res.status(401).json({ error: 'Credenciais inválidas' })
      }

      // Verificar senha
      const passwordMatch = await bcrypt.compare(password, user.password)
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Credenciais inválidas' })
      }

      // Atualizar último login
      await User.updateLastLogin(user.id)

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.SESSION_TIMEOUT || '24h' }
      )

      res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      })
    } catch (error) {
      console.error('Erro no login:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  // Verificar token
  async verifyToken(req, res) {
    try {
      res.json({
        user: {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role
        }
      })
    } catch (error) {
      console.error('Erro na verificação de token:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  // Obter token para modo iframe
  async getIframeToken(req, res) {
    try {
      // Verificar se está no modo iframe
      const iframeMode = process.env.IFRAME_MODE === 'true'
      if (!iframeMode) {
        return res.status(403).json({ error: 'Modo iframe não está ativo' })
      }

      console.log('🔑 Gerando token para modo iframe...')
      
      // Dados do usuário iframe (mesmo do iframeAuth.js)
      const iframeUser = {
        id: 'aee9c880-9205-4c76-b260-062f6772af16',
        name: 'Agent Web Interface',
        email: 'agent-iframe@neurons.local',
        role: 'admin'
      }

      // Gerar token JWT
      const token = jwt.sign(
        { 
          id: iframeUser.id, 
          email: iframeUser.email, 
          role: iframeUser.role 
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.SESSION_TIMEOUT || '24h' }
      )

      console.log('✅ Token iframe gerado com sucesso')

      res.json({
        token,
        user: iframeUser
      })
    } catch (error) {
      console.error('Erro ao gerar token iframe:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  // Autenticar com client_id para multi-tenancy
  async authenticateClient(req, res) {
    try {
      const { client_id, client_name, api_key } = req.body

      // Validar parâmetros obrigatórios
      if (!client_id) {
        return res.status(400).json({ 
          error: 'client_id is required',
          message: 'Provide a unique client_id to authenticate'
        })
      }

      if (!api_key) {
        return res.status(400).json({ 
          error: 'api_key is required',
          message: 'Provide API key for authentication'
        })
      }

      // Validar API Key
      const validApiKey = process.env.IFRAME_API_KEY || process.env.REACT_APP_API_KEY
      if (!validApiKey) {
        console.error('IFRAME_API_KEY not configured in environment')
        return res.status(500).json({ error: 'Server configuration error' })
      }

      if (api_key !== validApiKey) {
        return res.status(401).json({ 
          error: 'Invalid API Key',
          message: 'The provided API key is not valid'
        })
      }

      console.log(`🔑 Autenticando client_id: ${client_id}`)

      // Buscar ou criar usuário para este client_id
      const user = await SupabaseUser.findOrCreateByClientId(client_id, client_name)

      if (!user) {
        return res.status(500).json({ 
          error: 'User creation failed',
          message: 'Could not create or find user for this client_id'
        })
      }

      // Gerar token JWT para o cliente
      const token = jwt.sign(
        { 
          id: user.id, 
          email: user.email, 
          role: user.role,
          client_id: user.client_id
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.SESSION_TIMEOUT || '24h' }
      )

      console.log(`✅ Token gerado com sucesso para client_id: ${client_id}`)

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          client_id: user.client_id
        }
      })
    } catch (error) {
      console.error('Erro ao autenticar cliente:', error)
      res.status(500).json({ 
        error: 'Authentication error',
        message: error.message 
      })
    }
  }

  // Validar client_id (endpoint para verificar se client_id existe)
  async validateClient(req, res) {
    try {
      const { client_id } = req.query

      if (!client_id) {
        return res.status(400).json({ 
          error: 'client_id is required'
        })
      }

      const user = await SupabaseUser.findByClientId(client_id)

      res.json({
        exists: !!user,
        client_id: client_id,
        user: user ? {
          id: user.id,
          name: user.name,
          email: user.email,
          created_at: user.created_at
        } : null
      })
    } catch (error) {
      console.error('Erro ao validar cliente:', error)
      res.status(500).json({ 
        error: 'Validation error',
        message: error.message 
      })
    }
  }

  // Registro de novo usuário (se habilitado)
  async register(req, res) {
    try {
      // Verificar se registro está habilitado
      const allowRegistration = process.env.ALLOW_USER_REGISTRATION === 'true'
      if (!allowRegistration) {
        return res.status(403).json({ 
          error: 'Registro de usuários não está habilitado',
          message: 'Entre em contato com o administrador para criar sua conta'
        })
      }

      const { name, email, password, confirmPassword } = req.body

      // Validações
      if (!name || !email || !password || !confirmPassword) {
        return res.status(400).json({ 
          error: 'Todos os campos são obrigatórios',
          fields: ['name', 'email', 'password', 'confirmPassword']
        })
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ error: 'Senhas não coincidem' })
      }

      if (password.length < 6) {
        return res.status(400).json({ 
          error: 'Senha deve ter pelo menos 6 caracteres' 
        })
      }

      // Validar formato do email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Email inválido' })
      }

      // Verificar se usuário já existe
      const existingUser = await User.findByEmail(email)
      if (existingUser) {
        return res.status(400).json({ 
          error: 'Este email já está cadastrado',
          message: 'Tente fazer login ou usar outro email'
        })
      }

      // Hash da senha
      const hashedPassword = await bcrypt.hash(
        password, 
        parseInt(process.env.BCRYPT_ROUNDS) || 12
      )

      // Criar usuário
      const newUser = await User.create({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role: 'operator', // Usuários registrados são sempre operadores
        is_active: true
      })

      // Gerar token para login automático
      const token = jwt.sign(
        { id: newUser.id, email: newUser.email, role: newUser.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.SESSION_TIMEOUT || '24h' }
      )

      res.status(201).json({
        message: 'Usuário criado com sucesso',
        token,
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role
        }
      })
    } catch (error) {
      console.error('Erro no registro:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  // Alterar senha
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body

      if (!currentPassword || !newPassword) {
        return res
          .status(400)
          .json({ error: 'Senha atual e nova senha são obrigatórias' })
      }

      if (newPassword.length < 6) {
        return res
          .status(400)
          .json({ error: 'Nova senha deve ter pelo menos 6 caracteres' })
      }

      const user = await User.findById(req.user.id)

      // Verificar senha atual
      const passwordMatch = await bcrypt.compare(currentPassword, user.password)
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Senha atual incorreta' })
      }

      // Hash da nova senha
      const hashedPassword = await bcrypt.hash(
        newPassword, 
        parseInt(process.env.BCRYPT_ROUNDS) || 12
      )

      await User.update(user.id, { password: hashedPassword })

      res.json({ message: 'Senha alterada com sucesso' })
    } catch (error) {
      console.error('Erro ao alterar senha:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  // Criar usuário (apenas admin)
  async createUser(req, res) {
    try {
      const { name, email, password, role = 'operator' } = req.body

      if (!name || !email || !password) {
        return res
          .status(400)
          .json({ error: 'Nome, email e senha são obrigatórios' })
      }

      if (password.length < 6) {
        return res
          .status(400)
          .json({ error: 'Senha deve ter pelo menos 6 caracteres' })
      }

      const existingUser = await User.findOne({ where: { email } })
      if (existingUser) {
        return res.status(400).json({ error: 'Email já está em uso' })
      }

      const user = await User.create({
        name,
        email,
        password,
        role
      })

      res.status(201).json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      })
    } catch (error) {
      console.error('Erro ao criar usuário:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  // Listar usuários (apenas admin)
  async getUsers(req, res) {
    try {
      const users = await User.findAll({
        attributes: [
          'id',
          'name',
          'email',
          'role',
          'isActive',
          'lastLogin',
          'createdAt'
        ],
        order: [['createdAt', 'DESC']]
      })

      res.json({ users })
    } catch (error) {
      console.error('Erro ao listar usuários:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  // Ativar/desativar usuário (apenas admin)
  async toggleUserStatus(req, res) {
    try {
      const { id } = req.params
      const { isActive } = req.body

      const user = await User.findByPk(id)
      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' })
      }

      // Não permitir desativar o próprio usuário
      if (user.id === req.user.id) {
        return res
          .status(400)
          .json({ error: 'Você não pode desativar sua própria conta' })
      }

      await user.update({ isActive })

      res.json({
        message: `Usuário ${isActive ? 'ativado' : 'desativado'} com sucesso`
      })
    } catch (error) {
      console.error('Erro ao alterar status do usuário:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }
}

module.exports = new AuthController()
