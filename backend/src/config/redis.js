const Redis = require('ioredis')
const config = require('./database')

class RedisService {
  constructor() {
    this.client = null
    this.isConnected = false
  }

  async connect() {
    try {
      // Configuração do Redis - adapte conforme sua VPS
      this.client = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || null,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 30000,
        connectionName: 'WppWeb-Backend',
        keyPrefix: 'wppweb:',
      })

      // Conectar
      await this.client.connect()
      this.isConnected = true

      console.log('✅ Redis conectado com sucesso')

      // Event listeners
      this.client.on('error', (err) => {
        console.error('❌ Erro no Redis:', err)
        this.isConnected = false
      })

      this.client.on('close', () => {
        console.warn('⚠️ Conexão Redis fechada')
        this.isConnected = false
      })

      this.client.on('reconnecting', () => {
        console.log('🔄 Reconectando ao Redis...')
      })

    } catch (error) {
      console.warn('⚠️ Redis não disponível, continuando sem cache:', error.message)
      this.isConnected = false
    }
  }

  // Cache de progresso de sincronização
  async setSyncProgress(instanceId, progress) {
    if (!this.isConnected) return false
    try {
      const key = `sync:progress:${instanceId}`
      await this.client.setex(key, 300, JSON.stringify(progress)) // 5 minutos TTL
      return true
    } catch (error) {
      console.error('Erro ao salvar progresso no Redis:', error)
      return false
    }
  }

  async getSyncProgress(instanceId) {
    if (!this.isConnected) return null
    try {
      const key = `sync:progress:${instanceId}`
      const data = await this.client.get(key)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error('Erro ao ler progresso do Redis:', error)
      return null
    }
  }

  async deleteSyncProgress(instanceId) {
    if (!this.isConnected) return false
    try {
      const key = `sync:progress:${instanceId}`
      await this.client.del(key)
      return true
    } catch (error) {
      console.error('Erro ao deletar progresso do Redis:', error)
      return false
    }
  }

  // Cache de dados da Evolution API
  async cacheEvolutionData(instanceId, type, data, ttl = 60) {
    if (!this.isConnected) return false
    try {
      const key = `evolution:${type}:${instanceId}`
      await this.client.setex(key, ttl, JSON.stringify(data))
      return true
    } catch (error) {
      console.error('Erro ao cachear dados Evolution:', error)
      return false
    }
  }

  async getCachedEvolutionData(instanceId, type) {
    if (!this.isConnected) return null
    try {
      const key = `evolution:${type}:${instanceId}`
      const data = await this.client.get(key)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error('Erro ao ler cache Evolution:', error)
      return null
    }
  }

  // Rate limiting para sincronização
  async checkSyncRateLimit(instanceId, limit = 3, window = 60) {
    if (!this.isConnected) return true // Permitir se Redis não estiver disponível
    try {
      const key = `rate:sync:${instanceId}`
      const count = await this.client.incr(key)
      
      if (count === 1) {
        await this.client.expire(key, window)
      }
      
      console.log(`🔄 Rate limit check: ${count}/${limit} para instância ${instanceId}`)
      return count <= limit
    } catch (error) {
      console.error('Erro no rate limiting:', error)
      return true // Permitir em caso de erro
    }
  }

  // Limpeza de cache
  async clearInstanceCache(instanceId) {
    if (!this.isConnected) return false
    try {
      const patterns = [
        `sync:progress:${instanceId}`,
        `evolution:*:${instanceId}`,
        `rate:sync:${instanceId}`
      ]
      
      for (const pattern of patterns) {
        const keys = await this.client.keys(pattern)
        if (keys.length > 0) {
          await this.client.del(...keys)
        }
      }
      
      return true
    } catch (error) {
      console.error('Erro ao limpar cache:', error)
      return false
    }
  }

  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.disconnect()
      this.isConnected = false
      console.log('🔌 Redis desconectado')
    }
  }
}

// Singleton
const redisService = new RedisService()

module.exports = redisService