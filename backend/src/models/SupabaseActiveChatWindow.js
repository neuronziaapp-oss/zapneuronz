const { supabaseAdmin } = require('../config/supabase')

class SupabaseActiveChatWindow {
  static async upsertActiveChat({
    userId,
    instanceId,
    chatUuid,
    chatRemoteId,
    clientId = null
  }) {
    if (!userId || !instanceId || !chatUuid || !chatRemoteId) {
      throw new Error('Missing required fields to upsert active chat window')
    }

    const payload = {
      user_id: userId,
      instance_id: instanceId,
      chat_uuid: chatUuid,
      chat_remote_id: chatRemoteId,
      client_id: clientId || null
    }

    const { data, error } = await supabaseAdmin
      .from('active_chat_windows')
      .upsert(payload, {
        onConflict: 'user_id,instance_id',
        ignoreDuplicates: false
      })
      .select(`
        *,
        chat:chats(*, contacts(*)),
        instance:instances(*)
      `)
      .single()

    if (error) {
      throw error
    }

    return data
  }

  static async getForUser({ userId, instanceId, clientId = null }) {
    if (!userId || !instanceId) {
      throw new Error('Missing required identifiers to get active chat window')
    }

    let query = supabaseAdmin
      .from('active_chat_windows')
      .select(`
        *,
        chat:chats(*, contacts(*)),
        instance:instances(*)
      `)
      .eq('user_id', userId)
      .eq('instance_id', instanceId)
      .order('last_activated_at', { ascending: false })
      .limit(1)

    if (clientId) {
      query = query.eq('client_id', clientId)
    }

    const { data, error } = await query.maybeSingle()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    return data || null
  }

  static async clearForInstance({ userId, instanceId }) {
    if (!userId || !instanceId) {
      throw new Error('Missing required identifiers to clear active chat window')
    }

    const { error } = await supabaseAdmin
      .from('active_chat_windows')
      .delete()
      .eq('user_id', userId)
      .eq('instance_id', instanceId)

    if (error) {
      throw error
    }

    return true
  }
}

module.exports = SupabaseActiveChatWindow
