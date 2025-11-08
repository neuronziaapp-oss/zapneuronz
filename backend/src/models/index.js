// Legacy Sequelize models (deprecated - use Supabase models instead)
const User = require('./User')
const Instance = require('./Instance') 
const Contact = require('./Contact')
const Message = require('./Message')
const Chat = require('./Chat')

// Supabase models (current)
const {
  SupabaseUser,
  SupabaseInstance,
  SupabaseContact,
  SupabaseChat,
  SupabaseMessage
} = require('./supabase')

// Legacy function - no longer used with Supabase
const syncDatabase = async () => {
  console.log('⚠️ syncDatabase() é desnecessário com Supabase')
  console.log('✅ Usando Supabase - sem necessidade de sincronização')
}

module.exports = {
  // Legacy Sequelize exports (for compatibility)
  User,
  Instance,
  Contact,
  Message,
  Chat,
  syncDatabase,
  
  // New Supabase exports (recommended)
  SupabaseUser,
  SupabaseInstance,
  SupabaseContact,
  SupabaseChat,
  SupabaseMessage
}
