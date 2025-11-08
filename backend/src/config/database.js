const { Sequelize } = require('sequelize')
require('dotenv').config()

const sequelize = new Sequelize({
  dialect: process.env.DB_DIALECT || 'sqlite',
  storage: process.env.DB_STORAGE || './database.sqlite',
  logging: false, // Desabilitar logs do Sequelize
  define: {
    timestamps: true,
    underscored: true
  },
  pool: {
    max: 1, // SQLite funciona melhor com conexão única
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  dialectOptions: {
    // Configurações específicas do SQLite para melhor concorrência
    options: {
      timeout: 20000,
      busyTimeout: 30000
    }
  },
  retry: {
    match: [
      /SQLITE_BUSY/,
      /SQLITE_LOCKED/,
      /database is locked/,
      /connection timeout/
    ],
    max: 3
  }
})

// Função para testar conexão
const testConnection = async () => {
  try {
    await sequelize.authenticate()
    console.log('✅ Conexão com banco de dados estabelecida com sucesso.')
  } catch (error) {
    console.error('❌ Erro ao conectar com banco de dados:', error)
  }
}

module.exports = { sequelize, testConnection }
