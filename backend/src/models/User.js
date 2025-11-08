const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/database')
const bcrypt = require('bcryptjs')

const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('admin', 'operator'),
      defaultValue: 'operator'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    lastLogin: {
      type: DataTypes.DATE
    }
  },
  {
    hooks: {
      beforeCreate: async user => {
        user.password = await bcrypt.hash(
          user.password,
          parseInt(process.env.BCRYPT_ROUNDS) || 12
        )
      },
      beforeUpdate: async user => {
        if (user.changed('password')) {
          user.password = await bcrypt.hash(
            user.password,
            parseInt(process.env.BCRYPT_ROUNDS) || 12
          )
        }
      }
    }
  }
)

User.prototype.checkPassword = async function (password) {
  return await bcrypt.compare(password, this.password)
}

module.exports = User
