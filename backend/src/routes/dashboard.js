const express = require('express')
const { authMiddleware, adminMiddleware } = require('../middleware/auth')
const { getConnectedUsers, getConnectionStats } = require('../services/socket')
const { Instance, Chat, Message, User } = require('../models')

const router = express.Router()

// Middleware de autenticação
router.use(authMiddleware)

// Dashboard geral
router.get('/stats', async (req, res) => {
  try {
    const whereClause = req.user.role === 'admin' ? {} : { userId: req.user.id }

    const [
      totalInstances,
      connectedInstances,
      totalChats,
      totalMessages,
      todayMessages
    ] = await Promise.all([
      Instance.count({ where: whereClause }),
      Instance.count({ where: { ...whereClause, status: 'connected' } }),
      Chat.count({
        include: [
          {
            model: Instance,
            where: whereClause
          }
        ]
      }),
      Message.count({
        include: [
          {
            model: Instance,
            where: whereClause
          }
        ]
      }),
      Message.count({
        where: {
          createdAt: {
            [require('sequelize').Op.gte]: new Date(
              new Date().setHours(0, 0, 0, 0)
            )
          }
        },
        include: [
          {
            model: Instance,
            where: whereClause
          }
        ]
      })
    ])

    const connectionStats = getConnectionStats()

    res.json({
      instances: {
        total: totalInstances,
        connected: connectedInstances,
        disconnected: totalInstances - connectedInstances
      },
      chats: {
        total: totalChats
      },
      messages: {
        total: totalMessages,
        today: todayMessages
      },
      connections: connectionStats
    })
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Usuários conectados (apenas admin)
router.get('/connected-users', adminMiddleware, (req, res) => {
  try {
    const users = getConnectedUsers()
    res.json({ users })
  } catch (error) {
    console.error('Erro ao obter usuários conectados:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Logs de atividade recente
router.get('/activity', async (req, res) => {
  try {
    const { limit = 50 } = req.query
    const whereClause = req.user.role === 'admin' ? {} : { userId: req.user.id }

    // Mensagens recentes
    const recentMessages = await Message.findAll({
      include: [
        {
          model: Instance,
          where: whereClause,
          include: [User]
        },
        {
          model: require('../models').Contact
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit)
    })

    const activity = recentMessages.map(msg => ({
      type: 'message',
      timestamp: msg.createdAt,
      description: `${msg.fromMe ? 'Enviou' : 'Recebeu'} mensagem ${
        msg.messageType === 'text' ? 'de texto' : 'de mídia'
      }`,
      instance: msg.Instance.name,
      user: msg.Instance.User.name,
      contact: msg.Contact?.name || msg.Contact?.pushName || msg.chatId,
      messageType: msg.messageType
    }))

    res.json({ activity })
  } catch (error) {
    console.error('Erro ao obter atividade:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Health check das instâncias
router.get('/health', async (req, res) => {
  try {
    const whereClause = req.user.role === 'admin' ? {} : { userId: req.user.id }

    const instances = await Instance.findAll({
      where: whereClause,
      include: [User],
      attributes: ['id', 'name', 'status', 'phone', 'lastSeen']
    })

    const health = instances.map(instance => ({
      id: instance.id,
      name: instance.name,
      status: instance.status,
      phone: instance.phone,
      lastSeen: instance.lastSeen,
      user: instance.User.name,
      isHealthy:
        instance.status === 'connected' &&
        instance.lastSeen &&
        new Date() - new Date(instance.lastSeen) < 5 * 60 * 1000 // 5 minutos
    }))

    res.json({ instances: health })
  } catch (error) {
    console.error('Erro ao verificar saúde das instâncias:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Relatório de uso (apenas admin)
router.get('/usage-report', adminMiddleware, async (req, res) => {
  try {
    const { startDate, endDate } = req.query

    let dateFilter = {}
    if (startDate || endDate) {
      dateFilter = {
        createdAt: {}
      }
      if (startDate) {
        dateFilter.createdAt[require('sequelize').Op.gte] = new Date(startDate)
      }
      if (endDate) {
        dateFilter.createdAt[require('sequelize').Op.lte] = new Date(endDate)
      }
    }

    // Mensagens por usuário
    const messagesByUser = await Message.findAll({
      where: dateFilter,
      include: [
        {
          model: Instance,
          include: [User]
        }
      ],
      attributes: [
        [
          require('sequelize').fn(
            'COUNT',
            require('sequelize').col('Message.id')
          ),
          'messageCount'
        ]
      ],
      group: ['Instance.User.id', 'Instance.User.name'],
      raw: true
    })

    // Instâncias por usuário
    const instancesByUser = await Instance.findAll({
      include: [User],
      attributes: [
        [
          require('sequelize').fn(
            'COUNT',
            require('sequelize').col('Instance.id')
          ),
          'instanceCount'
        ]
      ],
      group: ['User.id', 'User.name'],
      raw: true
    })

    res.json({
      period: {
        startDate,
        endDate
      },
      messagesByUser,
      instancesByUser
    })
  } catch (error) {
    console.error('Erro ao gerar relatório de uso:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

module.exports = router
