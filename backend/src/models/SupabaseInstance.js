const { supabaseAdmin } = require('../config/supabase')

class SupabaseInstance {
  static async findById(id) {
    try {
      const { data, error } = await supabaseAdmin
        .from('instances')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error finding instance by ID:', error)
      return null
    }
  }

  static async findByEvolutionId(evolutionInstanceId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('instances')
        .select('*')
        .eq('evolution_instance_id', evolutionInstanceId)
        .single()
      
      if (error && error.code !== 'PGRST116') throw error
      return data
    } catch (error) {
      console.error('Error finding instance by Evolution ID:', error)
      return null
    }
  }

  static async findByName(name) {
    try {
      const { data, error } = await supabaseAdmin
        .from('instances')
        .select('*')
        .eq('name', name)
        .single()
      
      if (error && error.code !== 'PGRST116') throw error
      return data
    } catch (error) {
      console.error('Error finding instance by name:', error)
      return null
    }
  }

  static async create(instanceData) {
    try {
      const { data, error } = await supabaseAdmin
        .from('instances')
        .insert(instanceData)
        .select()
        .single()
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating instance:', error)
      throw error
    }
  }

  static async update(id, updates) {
    try {
      const { data, error } = await supabaseAdmin
        .from('instances')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error updating instance:', error)
      throw error
    }
  }

  static async updateStatus(id, status, additionalData = {}) {
    const updates = { status, ...additionalData }
    return this.update(id, updates)
  }

  static async updateQrCode(id, qrCode) {
    return this.update(id, { qr_code: qrCode })
  }

  static async updateWebhook(id, webhookUrl) {
    return this.update(id, { webhook_url: webhookUrl })
  }

  static async findAll(options = {}) {
    try {
      let query = supabaseAdmin.from('instances').select('*')
      
      if (options.where) {
        Object.entries(options.where).forEach(([key, value]) => {
          query = query.eq(key, value)
        })
      }
      
      if (options.order) {
        query = query.order(options.order.field, { ascending: options.order.direction === 'ASC' })
      }
      
      const { data, error } = await query
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error finding instances:', error)
      return []
    }
  }

  static async findByUserId(userId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('instances')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error finding instances by user:', error)
      return []
    }
  }

  static async delete(id) {
    try {
      const { error } = await supabaseAdmin
        .from('instances')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      return true
    } catch (error) {
      console.error('Error deleting instance:', error)
      throw error
    }
  }

  static async getConnectedInstances() {
    try {
      const { data, error } = await supabaseAdmin
        .from('instances')
        .select('*')
        .eq('status', 'connected')
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error getting connected instances:', error)
      return []
    }
  }

  static async updateLastSeen(id) {
    return this.update(id, { last_seen: new Date().toISOString() })
  }

  static async updateSettings(id, settings) {
    const instance = await this.findById(id)
    if (!instance) throw new Error('Instance not found')

    const currentSettings = instance.settings || {}
    const newSettings = { ...currentSettings, ...settings }
    
    return this.update(id, { settings: newSettings })
  }

  // Compatibility method for Sequelize-style findOne
  static async findOne(options = {}) {
    try {
      let query = supabaseAdmin.from('instances').select('*')
      
      if (options.where) {
        Object.entries(options.where).forEach(([key, value]) => {
          // Map Sequelize field names to Supabase field names
          const fieldMap = {
            'userId': 'user_id',
            'evolutionInstanceId': 'evolution_instance_id'
          }
          const supabaseKey = fieldMap[key] || key
          query = query.eq(supabaseKey, value)
        })
      }
      
      const { data, error } = await query.single()
      
      if (error && error.code !== 'PGRST116') throw error
      return data
    } catch (error) {
      console.error('Error in findOne:', error)
      return null
    }
  }
}

module.exports = SupabaseInstance