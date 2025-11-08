const { supabaseAdmin } = require('../config/supabase')

class SupabaseContact {
  static async findOrCreate(phone, instanceId, defaults = {}) {
    try {
      // Primeiro tenta encontrar
      let contact = await this.findOne(phone, instanceId)
      
      if (contact) {
        return { data: contact, created: false }
      }

      // Se não existe, cria
      const contactData = {
        phone,
        instance_id: instanceId,
        ...defaults
      }

      const { data, error } = await supabaseAdmin
        .from('contacts')
        .insert(contactData)
        .select()
        .single()
      
      if (error) throw error
      return { data, created: true }
    } catch (error) {
      // Se erro de constraint, tenta buscar novamente
      if (error.code === '23505') { // unique violation
        const contact = await this.findOne(phone, instanceId)
        if (contact) {
          return { data: contact, created: false }
        }
      }
      
      console.error('Error in Contact.findOrCreate:', error)
      throw error
    }
  }

  static async findOne(phone, instanceId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('contacts')
        .select('*')
        .eq('phone', phone)
        .eq('instance_id', instanceId)
        .single()
      
      if (error && error.code !== 'PGRST116') throw error
      return data
    } catch (error) {
      console.error('Error finding contact:', error)
      return null
    }
  }

  static async findById(id) {
    try {
      const { data, error } = await supabaseAdmin
        .from('contacts')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error finding contact by ID:', error)
      return null
    }
  }

  static async findByInstance(instanceId, options = {}) {
    try {
      let query = supabaseAdmin
        .from('contacts')
        .select('*')
        .eq('instance_id', instanceId)
      
      if (options.limit) {
        query = query.limit(options.limit)
      }
      
      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
      }

      if (options.order) {
        query = query.order(options.order.field, { ascending: options.order.direction === 'ASC' })
      }
      
      const { data, error } = await query
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error finding contacts by instance:', error)
      return []
    }
  }

  static async update(id, updates) {
    try {
      const { data, error } = await supabaseAdmin
        .from('contacts')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error updating contact:', error)
      throw error
    }
  }

  static async destroy(conditions) {
    try {
      let query = supabaseAdmin.from('contacts').delete()
      
      // Aplicar condições where
      Object.entries(conditions.where).forEach(([key, value]) => {
        if (value === null) {
          query = query.is(key, null)
        } else {
          query = query.eq(key, value)
        }
      })
      
      const { error } = await query
      
      if (error) throw error
      return true
    } catch (error) {
      console.error('Error destroying contacts:', error)
      throw error
    }
  }

  static async count(instanceId) {
    try {
      const { count, error } = await supabaseAdmin
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('instance_id', instanceId)
      
      if (error) throw error
      return count
    } catch (error) {
      console.error('Error counting contacts:', error)
      return 0
    }
  }

  static async bulkCreate(contacts) {
    try {
      const { data, error } = await supabaseAdmin
        .from('contacts')
        .insert(contacts)
        .select()
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error bulk creating contacts:', error)
      throw error
    }
  }
}

module.exports = SupabaseContact