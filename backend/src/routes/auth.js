const express = require('express')
const AuthController = require('../controllers/AuthController')
const { authMiddleware, adminMiddleware } = require('../middleware/auth')

const router = express.Router()

// Rotas públicas
router.post('/login', AuthController.login)
router.post('/register', AuthController.register)

// Endpoint para verificar se registro está habilitado
router.get('/registration-status', (req, res) => {
  res.json({
    enabled: process.env.ALLOW_USER_REGISTRATION === 'true',
    iframeMode: process.env.IFRAME_MODE === 'true'
  })
})

// Endpoint para obter token no modo iframe
router.get('/iframe-token', AuthController.getIframeToken)

// Endpoints para autenticação multi-tenancy com client_id
router.post('/client/authenticate', AuthController.authenticateClient)
router.get('/client/validate', AuthController.validateClient)

// Rotas protegidas
router.use(authMiddleware)

// Verificar token
router.get('/verify', AuthController.verifyToken)

// Alterar senha (qualquer usuário logado)
router.put('/change-password', AuthController.changePassword)

// Rotas de administração
router.use(adminMiddleware)

// Gerenciar usuários
router.post('/users', AuthController.createUser)
router.get('/users', AuthController.getUsers)
router.put('/users/:id/toggle-status', AuthController.toggleUserStatus)

module.exports = router
