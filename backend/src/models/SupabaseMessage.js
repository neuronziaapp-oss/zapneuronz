const { supabaseAdmin } = require('../config/supabase')

class SupabaseMessage {
  static async create(messageData) {
    try {
      const { data, error } = await supabaseAdmin
        .from('messages')
        .insert(messageData)
        .select()
        .single()
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating message:', error)
      throw error
    }
  }

  static async findById(id) {
    try {
      const { data, error } = await supabaseAdmin
        .from('messages')
        .select(`
          *,
          contacts(*)
        `)
        .eq('id', id)
        .single()
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error finding message by ID:', error)
      return null
    }
  }

  static async findByMessageId(messageId, instanceId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('messages')
        .select('*')
        .eq('message_id', messageId)
        .eq('instance_id', instanceId)
        .single()
      
      if (error && error.code !== 'PGRST116') throw error
      return data
    } catch (error) {
      console.error('Error finding message by message ID:', error)
      return null
    }
  }

  static async findByChatId(chatId, instanceId, options = {}) {
    try {
      let query = supabaseAdmin
        .from('messages')
        .select(`
          *,
          contacts(*)
        `)
        .eq('chat_id', chatId)
        .eq('instance_id', instanceId)

      // Aplicar ordenação (padrão: mais recente primeiro)
      const sortAscending =
        options.order === 'asc' ||
        options.order === 'ASC' ||
        options.ascending === true
      query = query.order('timestamp_msg', { ascending: sortAscending })

      if (options.search) {
        query = query.ilike('content', `%${options.search}%`)
      }
      
      if (options.limit) {
        query = query.limit(options.limit)
      }
      
      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
      }

      // Filtros adicionais
      if (options.before) {
        query = query.lt('timestamp_msg', options.before)
      }

      if (options.after) {
        query = query.gt('timestamp_msg', options.after)
      }

      if (options.messageType) {
        query = query.eq('message_type', options.messageType)
      }
      
      const { data, error } = await query
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error finding messages by chat ID:', error)
      return []
    }
  }

  static async findByInstance(instanceId, options = {}) {
    try {
      let query = supabaseAdmin
        .from('messages')
        .select(`
          *,
          contacts(*)
        `)
        .eq('instance_id', instanceId)
        .order('timestamp_msg', { ascending: false })
      
      if (options.limit) {
        query = query.limit(options.limit)
      }
      
      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
      }
      
      const { data, error } = await query
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error finding messages by instance:', error)
      return []
    }
  }

  static async update(id, updates) {
    try {
      const { data, error } = await supabaseAdmin
        .from('messages')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error updating message:', error)
      throw error
    }
  }

  static async updateStatus(messageId, instanceId, status) {
    try {
      const { data, error } = await supabaseAdmin
        .from('messages')
        .update({ status })
        .eq('message_id', messageId)
        .eq('instance_id', instanceId)
        .select()
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error updating message status:', error)
      throw error
    }
  }

  static async delete(id) {
    try {
      const { error } = await supabaseAdmin
        .from('messages')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      return true
    } catch (error) {
      console.error('Error deleting message:', error)
      throw error
    }
  }

  static async count(chatId, instanceId) {
    try {
      let query = supabaseAdmin
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('instance_id', instanceId)
      
      if (chatId) {
        query = query.eq('chat_id', chatId)
      }
      
      const { count, error } = await query
      
      if (error) throw error
      return count
    } catch (error) {
      console.error('Error counting messages:', error)
      return 0
    }
  }

  static async getLastMessage(chatId, instanceId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .eq('instance_id', instanceId)
        .order('timestamp_msg', { ascending: false })
        .limit(1)
        .single()
      
      if (error && error.code !== 'PGRST116') throw error
      return data
    } catch (error) {
      console.error('Error getting last message:', error)
      return null
    }
  }

  static async getMessageIdsByChat(chatId, instanceId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('messages')
        .select('message_id')
        .eq('chat_id', chatId)
        .eq('instance_id', instanceId)

      if (error) throw error

      const ids = new Set()
      for (const row of data || []) {
        if (row?.message_id) {
          ids.add(row.message_id)
        }
      }

      return ids
    } catch (error) {
      console.error('Error getting message ids by chat:', error)
      return new Set()
    }
  }

  static async searchMessages(instanceId, searchTerm, options = {}) {
    try {
      let query = supabaseAdmin
        .from('messages')
        .select(`
          *,
          contacts(*)
        `)
        .eq('instance_id', instanceId)
        .ilike('content', `%${searchTerm}%`)
        .order('timestamp_msg', { ascending: false })
      
      if (options.limit) {
        query = query.limit(options.limit)
      }
      
      const { data, error } = await query
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error searching messages:', error)
      return []
    }
  }

  static async bulkCreate(messages) {
    try {
      const { data, error } = await supabaseAdmin
        .from('messages')
        .insert(messages)
        .select()
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error bulk creating messages:', error)
      throw error
    }
  }
}

module.exports = SupabaseMessage
