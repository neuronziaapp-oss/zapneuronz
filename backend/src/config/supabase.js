const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase URL and Service Key are required')
}

// Cliente para operações administrativas (backend)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Cliente para operações do frontend (com chave anônima)
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey)

module.exports = {
  supabaseAdmin,
  supabaseClient,
  supabaseUrl,
  supabaseAnonKey
}