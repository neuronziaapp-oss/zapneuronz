const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/database')

const Chat = sequelize.define(
  'Chat',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    chat_id: {
      type: DataTypes.STRING,
      allowNull: false, // ID do chat no WhatsApp
      field: 'chat_id'
    },
    last_message: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'last_message'
    },
    last_message_time: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_message_time'
    },
    unread_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'unread_count'
    },
    pinned: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    archived: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    muted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    instance_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'instance_id',
      references: {
        model: 'Instances',
        key: 'id'
      }
    },
    contact_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'contact_id',
      references: {
        model: 'Contacts',
        key: 'id'
      }
    }
  },
  {
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['chat_id', 'instance_id']
      },
      {
        fields: ['instance_id', 'last_message_time']
      }
    ]
  }
)

module.exports = Chat
