const jwt = require('jsonwebtoken')
const { User } = require('../models')

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '')

    if (!token) {
      return res.status(401).json({ error: 'Token de acesso requerido' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findByPk(decoded.id)

    if (!user || !user.isActive) {
      return res
        .status(401)
        .json({ error: 'Token inválido ou usuário inativo' })
    }

    req.user = user
    next()
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token inválido' })
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' })
    }
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res
      .status(403)
      .json({ error: 'Acesso negado. Apenas administradores.' })
  }
  next()
}

module.exports = { authMiddleware, adminMiddleware }
