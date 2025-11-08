const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/database')

const Contact = sequelize.define(
  'Contact',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    pushName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    profilePicUrl: {
      type: DataTypes.STRING,
      allowNull: true
    },
    isGroup: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    groupMetadata: {
      type: DataTypes.JSON,
      allowNull: true
    },
    lastSeen: {
      type: DataTypes.DATE
    },
    isBlocked: {
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
    }
  },
  {
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['phone', 'instance_id']
      }
    ]
  }
)

module.exports = Contact
