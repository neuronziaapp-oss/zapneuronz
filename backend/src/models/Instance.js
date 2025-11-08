const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/database')

const Instance = sequelize.define('Instance', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  evolutionInstanceId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true // Será preenchido após conectar
  },
  status: {
    type: DataTypes.ENUM('connecting', 'connected', 'disconnected', 'error'),
    defaultValue: 'connecting'
  },
  qrCode: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  profilePicUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  webhookUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  settings: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  lastSeen: {
    type: DataTypes.DATE
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  }
})

module.exports = Instance
