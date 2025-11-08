const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/database')

const Message = sequelize.define(
  'Message',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    messageId: {
      type: DataTypes.STRING,
      allowNull: false // ID da mensagem do WhatsApp
    },
    fromMe: {
      type: DataTypes.BOOLEAN,
      allowNull: false
    },
    chatId: {
      type: DataTypes.STRING,
      allowNull: false // ID do chat no WhatsApp
    },
    participant: {
      type: DataTypes.STRING,
      allowNull: true // Para mensagens de grupo
    },
    messageType: {
      type: DataTypes.ENUM(
        'text',
        'image',
        'video',
        'audio',
        'document',
        'sticker',
        'location',
        'contact',
        'system'
      ),
      allowNull: false
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    mediaUrl: {
      type: DataTypes.STRING,
      allowNull: true
    },
    mediaPath: {
      type: DataTypes.STRING,
      allowNull: true // Caminho local do arquivo
    },
    mediaMimeType: {
      type: DataTypes.STRING,
      allowNull: true
    },
    mediaSize: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    quotedMessage: {
      type: DataTypes.JSON,
      allowNull: true
    },
    mentions: {
      type: DataTypes.JSON,
      allowNull: true
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'sent', 'delivered', 'read', 'failed'),
      defaultValue: 'pending'
    },
    edited: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    deleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    instanceId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Instances',
        key: 'id'
      }
    },
    contactId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Contacts',
        key: 'id'
      }
    }
  },
  {
    indexes: [
      {
        fields: ['chat_id', 'instance_id', 'timestamp']
      },
      {
        fields: ['message_id', 'instance_id']
      }
    ]
  }
)

module.exports = Message
