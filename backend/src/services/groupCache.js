/**
 * Cache de informações de grupos do WhatsApp
 * Evita múltiplas requisições à Evolution API para o mesmo grupo
 */

class GroupCache {
  constructor() {
    // Map: instanceId -> Map(groupJid -> { data, timestamp })
    this.cache = new Map()
    
    // Tempo de expiração do cache (24 horas - otimizado para grandes volumes)
    this.CACHE_TTL = 24 * 60 * 60 * 1000 // 24 horas em milissegundos
    
    // Tempo mínimo entre requisições para o mesmo grupo (30 segundos - mais conservador)
    this.MIN_REQUEST_INTERVAL = 30 * 1000
    
    // Map para rastrear requisições em andamento
    // Evita múltiplas requisições simultâneas para o mesmo grupo
    this.pendingRequests = new Map()
    
    // Limpar cache expirado a cada 30 minutos (menos frequente)
    setInterval(() => this.cleanExpiredCache(), 30 * 60 * 1000)
  }

  /**
   * Obter informações do grupo do cache ou buscar da API
   */
  async getGroupInfo(instanceId, groupJid, fetchFunction) {
    const cacheKey = this.getCacheKey(instanceId, groupJid)
    const now = Date.now()
    
    // Verificar se há cache válido
    const cached = this.getFromCache(instanceId, groupJid)
    if (cached) {
      const age = now - cached.timestamp
      if (age < this.CACHE_TTL) {
        console.log(`✅ [GroupCache] Cache hit para ${groupJid} (idade: ${Math.round(age / 1000)}s)`)
        return cached.data
      }
    }
    
    // Verificar se já há uma requisição em andamento para este grupo
    const pendingKey = `${instanceId}:${groupJid}`
    if (this.pendingRequests.has(pendingKey)) {
      console.log(`⏳ [GroupCache] Aguardando requisição em andamento para ${groupJid}`)
      return this.pendingRequests.get(pendingKey)
    }
    
    // Verificar se já fizemos uma requisição recentemente (rate limiting)
    if (cached && (now - cached.timestamp) < this.MIN_REQUEST_INTERVAL) {
      console.log(`⏱️ [GroupCache] Rate limit ativo para ${groupJid}, usando cache antigo`)
      return cached.data
    }
    
    // Buscar da API
    console.log(`🔍 [GroupCache] Cache miss para ${groupJid}, buscando da API...`)
    
    try {
      // Criar promise e adicionar ao map de pendentes
      const fetchPromise = fetchFunction()
      this.pendingRequests.set(pendingKey, fetchPromise)
      
      const data = await fetchPromise
      
      // Remover das requisições pendentes
      this.pendingRequests.delete(pendingKey)
      
      if (data) {
        // Salvar no cache
        this.setCache(instanceId, groupJid, data)
        console.log(`💾 [GroupCache] Dados salvos no cache para ${groupJid}`)
        return data
      }
      
      // Se não obteve dados mas tinha cache, retornar cache antigo
      if (cached) {
        console.log(`⚠️ [GroupCache] Falha ao buscar, usando cache antigo para ${groupJid}`)
        return cached.data
      }
      
      return null
    } catch (error) {
      // Remover das requisições pendentes em caso de erro
      this.pendingRequests.delete(pendingKey)
      
      console.error(`❌ [GroupCache] Erro ao buscar grupo ${groupJid}:`, error.message)
      
      // Se tinha cache, retornar mesmo sendo antigo
      if (cached) {
        console.log(`⚠️ [GroupCache] Erro na API, usando cache antigo para ${groupJid}`)
        return cached.data
      }
      
      return null
    }
  }

  /**
   * Gerar chave única para o cache
   */
  getCacheKey(instanceId, groupJid) {
    return `${instanceId}:${groupJid}`
  }

  /**
   * Obter do cache
   */
  getFromCache(instanceId, groupJid) {
    if (!this.cache.has(instanceId)) {
      return null
    }
    
    const instanceCache = this.cache.get(instanceId)
    return instanceCache.get(groupJid) || null
  }

  /**
   * Salvar no cache
   */
  setCache(instanceId, groupJid, data) {
    if (!this.cache.has(instanceId)) {
      this.cache.set(instanceId, new Map())
    }
    
    const instanceCache = this.cache.get(instanceId)
    instanceCache.set(groupJid, {
      data,
      timestamp: Date.now()
    })
  }

  /**
   * Invalidar cache de um grupo específico
   */
  invalidate(instanceId, groupJid) {
    if (!this.cache.has(instanceId)) {
      return
    }
    
    const instanceCache = this.cache.get(instanceId)
    instanceCache.delete(groupJid)
    console.log(`🗑️ [GroupCache] Cache invalidado para ${groupJid}`)
  }

  /**
   * Invalidar todo o cache de uma instância
   */
  invalidateInstance(instanceId) {
    if (this.cache.has(instanceId)) {
      this.cache.delete(instanceId)
      console.log(`🗑️ [GroupCache] Cache invalidado para instância ${instanceId}`)
    }
  }

  /**
   * Limpar cache expirado
   */
  cleanExpiredCache() {
    const now = Date.now()
    let cleaned = 0
    
    for (const [instanceId, instanceCache] of this.cache.entries()) {
      for (const [groupJid, cached] of instanceCache.entries()) {
        const age = now - cached.timestamp
        if (age > this.CACHE_TTL) {
          instanceCache.delete(groupJid)
          cleaned++
        }
      }
      
      // Se a instância ficou vazia, remover
      if (instanceCache.size === 0) {
        this.cache.delete(instanceId)
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 [GroupCache] ${cleaned} entradas expiradas removidas`)
    }
  }

  /**
   * Obter estatísticas do cache
   */
  getStats() {
    let totalGroups = 0
    const instanceStats = {}
    
    for (const [instanceId, instanceCache] of this.cache.entries()) {
      instanceStats[instanceId] = instanceCache.size
      totalGroups += instanceCache.size
    }
    
    return {
      totalGroups,
      instances: Object.keys(instanceStats).length,
      pendingRequests: this.pendingRequests.size,
      instanceStats
    }
  }
}

module.exports = new GroupCache()
