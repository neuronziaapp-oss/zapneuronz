const { supabaseAdmin } = require('../config/supabase')

class SupabaseChat {
  static async findOrCreate(chatId, instanceId, defaults = {}) {
    try {
      // Primeiro tenta encontrar
      let chat = await this.findOne(chatId, instanceId)
      
      if (chat) {
        return { data: chat, created: false }
      }

      // Se não existe, cria
      const chatData = {
        chat_id: chatId,
        instance_id: instanceId,
        ...defaults
      }

      const { data, error } = await supabaseAdmin
        .from('chats')
        .insert(chatData)
        .select()
        .single()
      
      if (error) throw error
      return { data, created: true }
    } catch (error) {
      // Se erro de constraint, tenta buscar novamente
      if (error.code === '23505') { // unique violation
        const chat = await this.findOne(chatId, instanceId)
        if (chat) {
          return { data: chat, created: false }
        }
      }
      
      console.error('Error in Chat.findOrCreate:', error)
      throw error
    }
  }

  static async findOne(chatId, instanceId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('chats')
        .select(`
          *,
          contacts(*)
        `)
        .eq('chat_id', chatId)
        .eq('instance_id', instanceId)
        .single()
      
      if (error && error.code !== 'PGRST116') throw error
      return data
    } catch (error) {
      console.error('Error finding chat:', error)
      return null
    }
  }

  static async findById(id) {
    try {
      const { data, error } = await supabaseAdmin
        .from('chats')
        .select(`
          *,
          contacts(*)
        `)
        .eq('id', id)
        .single()
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error finding chat by ID:', error)
      return null
    }
  }

  static async findByInstance(instanceId, options = {}) {
    try {
      let query = supabaseAdmin
        .from('chats')
        .select(`
          *,
          contacts(*)
        `)
        .eq('instance_id', instanceId)
      
      if (options.limit) {
        query = query.limit(options.limit)
      }
      
      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
      }

      // Ordenar por última mensagem por padrão
      query = query.order('last_message_time', { ascending: false, nullsLast: true })
      
      const { data, error } = await query
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error finding chats by instance:', error)
      return []
    }
  }

  static async update(id, updates) {
    try {
      const { data, error } = await supabaseAdmin
        .from('chats')
        .update(updates)
        .eq('id', id)
        .select(`
          *,
          contacts(*)
        `)
        .single()
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error updating chat:', error)
      throw error
    }
  }

  static async updateLastMessage(chatId, instanceId, messageData, timestamp) {
    try {
      const { data, error } = await supabaseAdmin
        .from('chats')
        .update({
          last_message: messageData,
          last_message_time: timestamp
        })
        .eq('chat_id', chatId)
        .eq('instance_id', instanceId)
        .select()
        .single()
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error updating chat last message:', error)
      throw error
    }
  }

  static async incrementUnreadCount(chatId, instanceId) {
    try {
      console.log(`📊 [incrementUnreadCount] Tentando incrementar contador para chat: ${chatId}, instância: ${instanceId}`)
      
      // Buscar contagem atual
      const chat = await this.findOne(chatId, instanceId)
      if (!chat) {
        console.warn(`⚠️ [incrementUnreadCount] Chat não encontrado: ${chatId}`)
        return null
      }

      const currentCount = chat.unread_count || 0
      const newCount = currentCount + 1
      
      console.log(`📈 [incrementUnreadCount] Incrementando de ${currentCount} para ${newCount}`)
      
      const { data, error } = await supabaseAdmin
        .from('chats')
        .update({ unread_count: newCount })
        .eq('chat_id', chatId)
        .eq('instance_id', instanceId)
        .select()
        .single()
      
      if (error) {
        console.error(`❌ [incrementUnreadCount] Erro ao atualizar:`, error)
        throw error
      }
      
      console.log(`✅ [incrementUnreadCount] Contador atualizado com sucesso para ${newCount}`)
      return data
    } catch (error) {
      console.error('Error incrementing unread count:', error)
      throw error
    }
  }

  static async markAsRead(chatId, instanceId) {
    return this.update(null, { unread_count: 0 }, {
      where: { chat_id: chatId, instance_id: instanceId }
    })
  }

  static async destroy(conditions) {
    try {
      let query = supabaseAdmin.from('chats').delete()
      
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
      console.error('Error destroying chats:', error)
      throw error
    }
  }

  static async count(instanceId) {
    try {
      const { count, error } = await supabaseAdmin
        .from('chats')
        .select('*', { count: 'exact', head: true })
        .eq('instance_id', instanceId)
      
      if (error) throw error
      return count
    } catch (error) {
      console.error('Error counting chats:', error)
      return 0
    }
  }
}

module.exports = SupabaseChat