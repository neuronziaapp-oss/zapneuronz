const { SupabaseInstance, SupabaseContact, SupabaseChat, SupabaseMessage, SupabaseUser } = require('../models/supabase')
// Use SupabaseInstance as Instance for compatibility
const Instance = SupabaseInstance
const evolutionApi = require('../services/evolutionApi')
const redisService = require('../config/redis')
const { emitSyncProgress, emitSyncStart, emitSyncComplete } = require('../services/socket')
const { v4: uuidv4 } = require('uuid')
// ❌ WebSocket desabilitado - usando apenas webhook
// const evolutionWebsocket = require('../services/evolutionWebsocket')

let ngrokServiceInstance
const getNgrokService = () => {
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  if (!ngrokServiceInstance) {
    try {
      // eslint-disable-next-line global-require
      ngrokServiceInstance = require('../services/ngrok')
    } catch (error) {
      console.warn('⚠️ Serviço ngrok indisponível:', error.message)
      return null
    }
  }

  return ngrokServiceInstance
}

class InstanceController {
  // Criar nova instância
  async createInstance(req, res) {
    try {
      const { name } = req.body

      if (!name) {
        return res
          .status(400)
          .json({ error: 'Nome da instância é obrigatório' })
      }

      // Verificar se já existe uma instância com esse nome
      const existingInstance = await SupabaseInstance.findByName(name)
      if (existingInstance) {
        return res
          .status(400)
          .json({ error: 'Já existe uma instância com esse nome' })
      }

  // Criar instância no Evolution API
  // Normalizar nome: sem espaços, sem maiúsculas, adicionar UUID e timestamp
      const normalizedName = name.toLowerCase().replace(/\s+/g, '_')
      const evolutionInstanceId = `${normalizedName}_${uuidv4().substring(0, 8)}_${Date.now()}`
      // Determinar URL do webhook baseado no ambiente
      let webhookBaseUrl = process.env.WEBHOOK_URL

      console.log('🔧 DEBUG - NODE_ENV:', process.env.NODE_ENV)
      console.log('🔧 DEBUG - WEBHOOK_URL do .env:', process.env.WEBHOOK_URL)

      // Em desenvolvimento, sempre usar ngrok se não há URL pública configurada
      if (process.env.NODE_ENV === 'development' && !webhookBaseUrl) {
        const ngrok = getNgrokService()
        if (ngrok) {
          if (!ngrok.isActive()) {
            console.log('🚇 Iniciando túnel ngrok para webhook...')
            await ngrok.startTunnel(3001)
          }
          webhookBaseUrl = ngrok.getWebhookUrl()
        } else {
          console.warn('⚠️ Ngrok não disponível; defina WEBHOOK_URL para webhooks externos.')
        }
      }

      const webhookUrl = webhookBaseUrl ? `${webhookBaseUrl}/${evolutionInstanceId}` : null;

      console.log('🔗 DEBUG - webhookBaseUrl:', webhookBaseUrl)
      console.log('🔗 DEBUG - webhookUrl final:', webhookUrl)
      console.log('🔗 DEBUG - vai configurar webhook?', webhookUrl ? 'SIM' : 'NÃO - WEBHOOK_URL ESTÁ VAZIO!');

      const evolutionResponse = await evolutionApi.createInstance(
        evolutionInstanceId,
        webhookUrl
      )

      try {
        await evolutionApi.setInstanceSettings(evolutionInstanceId)
      } catch (settingsError) {
        console.error(
          'Erro ao configurar opções da instância:',
          settingsError.response?.data || settingsError.message
        )

        // Tentar remover a instância criada para evitar órfãs
        try {
          await evolutionApi.deleteInstance(evolutionInstanceId)
        } catch (cleanupError) {
          console.error(
            'Falha ao remover instância após erro de configuração:',
            cleanupError.response?.data || cleanupError.message
          )
        }

        return res
          .status(500)
          .json({ error: 'Falha ao configurar opções iniciais da instância' })
      }

      // Tentar conectar automaticamente após criar e configurar webhook
      try {
        await evolutionApi.connectInstance(evolutionInstanceId)
      } catch (connectErr) {
        console.warn('Não foi possível conectar imediatamente a instância (tentará depois):', connectErr.response?.data || connectErr.message)
      }

      // Salvar no banco de dados
      const instance = await SupabaseInstance.create({
        name,
        evolution_instance_id: evolutionInstanceId,
        webhook_url: webhookUrl,
        user_id: req.user.id,
        status: 'connecting'
      })

      // ❌ WebSocket desabilitado
      // evolutionWebsocket.ensureConnection(instance).catch(error => {
      //   console.error('⚠️ Falha ao iniciar WebSocket da nova instância:', error.message)
      // })

      res.status(201).json({
        instance: {
          id: instance.id,
          name: instance.name,
          status: instance.status,
          evolutionInstanceId: instance.evolution_instance_id
        },
        evolutionResponse
      })
    } catch (error) {
      console.error('Erro ao criar instância:', error)
      const msg = error?.response?.data || error?.message || 'Erro interno do servidor'
      res.status(500).json({ error: msg })
    }
  }

  // Listar instâncias do usuário
  async getInstances(req, res) {
    try {
      console.log('🔍 Listando instâncias - User:', req.user ? 'Presente' : 'Não encontrado')
      console.log('🔍 User role:', req.user?.role)
      
      // Se não houver usuário, retornar erro
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' })
      }

      // Buscar instâncias do usuário (ou todas se admin)
      let instances
      instances = await SupabaseInstance.findByUserId(req.user.id)

      console.log(`🔍 Encontradas ${instances ? instances.length : 0} instâncias`)

      // Converter para o formato esperado pelo frontend
      const formattedInstances = instances.map(instance => ({
        id: instance.id,
        name: instance.name,
        evolutionInstanceId: instance.evolution_instance_id,
        status: instance.status || 'disconnected',
        qrCode: instance.qr_code,
        phone: instance.phone,
        profileName: instance.profile_name,
        webhookUrl: instance.webhook_url,
        createdAt: instance.created_at,
        updatedAt: instance.updated_at
      }))

      console.log('✅ Retornando instâncias:', formattedInstances.length)
      res.json({ instances: formattedInstances })
    } catch (error) {
      console.error('Erro ao listar instâncias:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  // Obter detalhes de uma instância
  async getInstance(req, res) {
    try {
      const { id } = req.params

      const whereClause = { id }
      if (req.user.role !== 'admin') {
        whereClause.userId = req.user.id
      }

      const instance = await SupabaseInstance.findOne({
        where: whereClause,
        include: [
          {
            model: require('../models').User,
            attributes: ['name', 'email']
          }
        ]
      })

      if (!instance) {
        return res.status(404).json({ error: 'Instância não encontrada' })
      }

      // Obter status atual do Evolution API
      try {
        const provider = await evolutionApi.getInstanceStatus(
          instance.evolution_instance_id
        )

        const evolutionState = provider?.instance?.state
        let mapped = 'disconnected'
        
        // Usar mesma lógica de mapeamento da getConnectionState para consistência
        if (evolutionState === 'open') {
          try {
            const pairInfo = await evolutionApi.getQRCode(instance.evolution_instance_id)
            const hasPairing = !!(pairInfo?.pairingCode || pairInfo?.code)
            
            if (hasPairing) {
              mapped = 'connecting'
            } else {
              mapped = 'connected'
              
              // Tentar obter informações da instância se ainda não temos
              if (!instance.phone) {
                try {
                  const instanceInfo = await evolutionApi.getInstanceInfo(instance.evolution_instance_id)
                  if (instanceInfo?.owner) {
                    const phone = instanceInfo.owner.replace('@s.whatsapp.net', '')
                    await SupabaseInstance.update(instance.id, { phone })
                  }
                } catch (_) {
                  // Ignorar erro ao obter info da instância
                }
              }
            }
          } catch (_) {
            // Se falhar ao obter pairing info mas estado é open, consideramos conectado
            mapped = 'connected'
          }
        } else if (
          evolutionState === 'connecting' ||
          evolutionState === 'qr' ||
          evolutionState === 'OPENING' ||
          evolutionState === 'PAIRING'
        ) {
          mapped = 'connecting'
        } else if (evolutionState === 'close' || evolutionState === 'CLOSED') {
          mapped = 'disconnected'
        } else {
          mapped = 'disconnected'
        }

        await SupabaseInstance.update(instance.id, {
          status: mapped,
          lastSeen: new Date()
        })
      } catch (evolutionError) {
        console.error(
          'Erro ao obter status da instância no Evolution:',
          evolutionError.message
        )
      }

      res.json({ instance })
    } catch (error) {
      console.error('Erro ao obter instância:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  // Conectar instância
  async connectInstance(req, res) {
    try {
      const { id } = req.params

      const whereClause = { id }
      if (req.user.role !== 'admin') {
        whereClause.userId = req.user.id
      }

      const instance = await SupabaseInstance.findOne({ where: whereClause })
      if (!instance) {
        return res.status(404).json({ error: 'Instância não encontrada' })
      }

      // Conectar no Evolution API
      const evolutionResponse = await evolutionApi.connectInstance(
        instance.evolution_instance_id
      )

      await SupabaseInstance.update(instance.id, {
        status: 'connecting',
        lastSeen: new Date()
      })

      // ❌ WebSocket desabilitado
      // evolutionWebsocket.ensureConnection(instance).catch(error => {
      //   console.error(`⚠️ Falha ao garantir WebSocket ativo para ${instance.evolution_instance_id}:`, error.message)
      // })

      res.json({
        message: 'Comando de conexão enviado',
        evolutionResponse
      })
    } catch (error) {
      console.error('Erro ao conectar instância:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  // Obter QR Code
  async getQRCode(req, res) {
    try {
      const { id } = req.params
      // console.log(`🔍 Solicitação de QR Code para instância: ${id}`)

      const whereClause = { id }
      if (req.user.role !== 'admin') {
        whereClause.userId = req.user.id
      }

      const instance = await SupabaseInstance.findOne({ where: whereClause })
      if (!instance) {
        console.log(`❌ Instância não encontrada: ${id}`)
        return res.status(404).json({ error: 'Instância não encontrada' })
      }

      // console.log(`📱 Instância encontrada: ${instance.evolution_instance_id}, Status: ${instance.status}`)
      const data = await evolutionApi.getQRCode(instance.evolution_instance_id)

        // Evolution connect pode retornar { pairingCode, code, count }
        const normalized = {
          pairingCode: data?.pairingCode || null,
          code: data?.code || null,
          count: data?.count || null
        }

        // Se vier um base64 (alguns servidores), persistimos; caso contrário, só repassamos dados de pareamento
        const base64 = data?.base64 || data?.qrcode || data?.qrCode || null
        if (base64) {
          await SupabaseInstance.update(instance.id, { qr_code: base64 })
        }

        res.json({ qrCode: base64, ...normalized })
    } catch (error) {
        const provider = error.response?.data
        if (provider) {
          console.error('Erro ao obter QR/Pairing (provider):', provider)
          return res.status(502).json({ error: 'Erro ao obter QR do provedor', provider })
        }
        console.error('Erro ao obter QR Code:', error)
        res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  // Obter estado da conexão
  async getConnectionState(req, res) {
    try {
      const { id } = req.params
      // console.log(`📡 Verificando status da instância: ${id}`)

      const whereClause = { id }
      if (req.user.role !== 'admin') {
        whereClause.userId = req.user.id
      }
 
      const instance = await SupabaseInstance.findOne({ where: whereClause })
      if (!instance) {
        // console.log(`❌ Instância não encontrada: ${id}`)
        return res.status(404).json({ error: 'Instância não encontrada' })
      }

      // console.log(`🔍 Consultando Evolution API para: ${instance.evolution_instance_id}`)
      
      let data
      try {
        data = await evolutionApi.getInstanceStatus(instance.evolution_instance_id)
        // console.log('📋 Resposta do Evolution API:', JSON.stringify(data, null, 2))
      } catch (error) {
        // Se instância não existe no provider (404), marcar como órfã
        if (error.response?.status === 404) {
          // console.warn(`🧹 Instância ${instance.evolution_instance_id} não existe no provider. Marcando como órfã.`)
          await SupabaseInstance.update(instance.id, { 
            status: 'error',
            settings: { 
              ...instance.settings, 
              orphaned: true,
              orphanedAt: new Date().toISOString(),
              orphanError: 'Instance not found in provider'
            }
          })
          return res.json({ 
            status: 'error', 
            orphaned: true,
            message: 'Instância não encontrada no provider. Use "Recriar" para gerar uma nova instância.',
            instanceName: data?.instance?.instanceName,
            state: 'not_found'
          })
        }
        throw error
      }

      // Mapear estado Evolution para nosso padrão
      let status = 'disconnected'
      const evolutionState = data?.instance?.state
      const ownerJid = data?.instance?.owner

      // console.log(`🔄 Estado recebido da Evolution: "${evolutionState}" | ownerJid: ${ownerJid || 'n/a'} | phone: ${instance.phone || 'n/a'}`)

      // Atualizar phone se não temos no banco mas temos owner na Evolution
      if (!instance.phone && ownerJid) {
        const phoneNumber = ownerJid.replace('@s.whatsapp.net', '')
        await SupabaseInstance.update(instance.id, { phone: phoneNumber })
      }

      // Mapeamento mais flexível e direto baseado no estado da Evolution API
      if (evolutionState === 'open') {
        // Se o estado é 'open', consideramos conectado
        // Vamos verificar apenas se não há pairingCode ativo (indicaria que ainda está pareando)
        try {
          const pairInfo = await evolutionApi.getQRCode(instance.evolution_instance_id)
          const hasPairing = !!(pairInfo?.pairingCode || pairInfo?.code)
          
          if (hasPairing) {
            // console.log('🔄 Estado open mas ainda tem pairingCode ativo, mantendo connecting')
            status = 'connecting'
          } else {
            // console.log('✅ Estado open e sem pairingCode, definindo como connected')
            status = 'connected'
            
            // Tentar obter informações da instância se ainda não temos o número
            if (!instance.phone && !ownerJid) {
              try {
                const instanceInfo = await evolutionApi.getInstanceInfo(instance.evolution_instance_id)
                if (instanceInfo?.owner) {
                  const phone = instanceInfo.owner.replace('@s.whatsapp.net', '')
                  await SupabaseInstance.update(instance.id, { phone })
                  // console.log('📱 Número da instância atualizado:', phone)
                }
              } catch (infoErr) {
                console.warn('Não foi possível obter info da instância:', infoErr.message)
              }
            }
          }
        } catch (pairErr) {
          // Se falhar ao obter pairing info, mas estado é open, consideramos conectado
          // console.log('✅ Estado open (erro ao verificar pairing, assumindo conectado)')
          status = 'connected'
        }
      } else if (evolutionState === 'connecting' || evolutionState === 'qr' || evolutionState === 'OPENING' || evolutionState === 'PAIRING') {
        status = 'connecting'
      } else if (evolutionState === 'close' || evolutionState === 'CLOSED') {
        status = 'disconnected'
      } else {
        // Estados desconhecidos ou null - marcar como desconectado
        console.warn(`⚠️ Estado desconhecido da Evolution: "${evolutionState}"`)
        status = 'disconnected'
      }

      // console.log(`🎯 Status mapeado (com validação de número): "${status}"`)

      // Limpar flag de órfã se instância voltou a existir
      if (instance.settings?.orphaned) {
        await SupabaseInstance.update(instance.id, { 
          status,
          settings: { 
            ...instance.settings, 
            orphaned: false,
            orphanedAt: null,
            orphanError: null
          }
        })
      } else if (instance.status !== status) {
        //console.log(`🔄 Atualizando status no BD: ${instance.status} → ${status}`)
        await SupabaseInstance.update(instance.id, { status })
      }

      const response = { 
        status,
        instanceName: data?.instance?.instanceName,
        state: data?.instance?.state 
      }
      
      //console.log('✅ Status verificado com sucesso:', response)
      res.json(response)
    } catch (error) {
      const provider = error.response?.data
      if (provider) {
        console.error('Erro ao obter status (provider):', provider)
        return res.status(502).json({ error: 'Erro ao obter status do provedor', provider })
      }
      console.error('Erro ao obter status da instância:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  // Desconectar instância
  async disconnectInstance(req, res) {
    try {
      const { id } = req.params

      const whereClause = { id }
      if (req.user.role !== 'admin') {
        whereClause.userId = req.user.id
      }

      const instance = await SupabaseInstance.findOne({ where: whereClause })
      if (!instance) {
        return res.status(404).json({ error: 'Instância não encontrada' })
      }

      // Verificar se a instância existe no Evolution API antes de tentar desconectar
      try {
        await evolutionApi.getInstanceInfo(instance.evolution_instance_id)
        // Se chegou aqui, a instância existe, pode fazer logout
        await evolutionApi.logoutInstance(instance.evolution_instance_id)
      } catch (evolutionError) {
        // Se a instância não existe (404), apenas atualizar o banco local
        if (evolutionError.response?.status === 404) {
          console.log(`Instância ${instance.evolution_instance_id} não existe na Evolution API, apenas atualizando banco local`)
        } else {
          console.error('Erro ao verificar/desconectar na Evolution API:', evolutionError.response?.data || evolutionError.message)
        }
      }

      await SupabaseInstance.update(instance.id, {
        status: 'disconnected',
        phone: null,
        qrCode: null
      })

      // ❌ WebSocket desabilitado
      // if (instance.evolution_instance_id) {
      //   evolutionWebsocket.disconnectInstance(instance.evolution_instance_id)
      // }

      res.json({ message: 'Instância desconectada com sucesso' })
    } catch (error) {
      console.error('Erro ao desconectar instância:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  // Deletar instância
  async deleteInstance(req, res) {
    try {
      const { id } = req.params

      const whereClause = { id }
      if (req.user.role !== 'admin') {
        whereClause.userId = req.user.id
      }

      const instance = await SupabaseInstance.findOne({ where: whereClause })
      if (!instance) {
        return res.status(404).json({ error: 'Instância não encontrada' })
      }

      // Deletar no Evolution API (se existir)
      try {
        await evolutionApi.getInstanceInfo(instance.evolution_instance_id)
        // Se chegou aqui, a instância existe, pode deletar
        await evolutionApi.deleteInstance(instance.evolution_instance_id)
        console.log(`Instância ${instance.evolution_instance_id} deletada da Evolution API`)
      } catch (evolutionError) {
        // Se a instância não existe (404), apenas deletar do banco local
        if (evolutionError.response?.status === 404) {
          console.log(`Instância ${instance.evolution_instance_id} não existe na Evolution API, apenas deletando do banco local`)
        } else {
          console.error('Erro ao verificar/deletar na Evolution API:', evolutionError.response?.data || evolutionError.message)
        }
      }

      // Deletar instância - CASCADE DELETE will handle related records automatically
      await SupabaseInstance.delete(instance.id)

      // ❌ WebSocket desabilitado
      // if (instance.evolution_instance_id) {
      //   evolutionWebsocket.disconnectInstance(instance.evolution_instance_id)
      // }

      res.json({ message: 'Instância deletada com sucesso' })
    } catch (error) {
      console.error('Erro ao deletar instância:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  // Obter informações do perfil
  async getProfileInfo(req, res) {
    try {
      const { id } = req.params

      const whereClause = { id }
      if (req.user.role !== 'admin') {
        whereClause.userId = req.user.id
      }

      const instance = await SupabaseInstance.findOne({ where: whereClause })
      if (!instance) {
        return res.status(404).json({ error: 'Instância não encontrada' })
      }

      // Verificar se a instância está conectada
      if (instance.status !== 'connected') {
        return res.status(400).json({
          error: 'Instância não está conectada. Conecte a instância primeiro.'
        })
      }

      // Buscar informações da instância na Evolution API para obter o ownerJid
      let phoneNumber = instance.phone
      try {
        const evolutionInfo = await evolutionApi.getInstanceInfo(instance.evolution_instance_id)
        if (evolutionInfo?.owner) {
          phoneNumber = evolutionInfo.owner
          // Atualizar phone no banco se não temos
          if (!instance.phone) {
            await SupabaseInstance.update(instance.id, { phone: evolutionInfo.owner.replace('@s.whatsapp.net', '') })
          }
        }
      } catch (evolutionError) {
        console.log('⚠️ Erro ao buscar info da Evolution API:', evolutionError.message)
        // Se não conseguiu buscar da API, verificar se temos phone no banco
        if (!instance.phone) {
          return res.status(400).json({
            error: 'Número da instância ainda não disponível. Reconecte a instância.'
          })
        }
        phoneNumber = instance.phone.includes('@') ? instance.phone : `${instance.phone}@s.whatsapp.net`
      }

      if (!phoneNumber) {
        return res.status(400).json({
          error: 'Número da instância ainda não disponível. Conclua a conexão (escaneie o QR) e tente novamente.'
        })
      }

      // Primeiro buscar dados da instância via fetchInstances (tem informações mais completas)
      let instanceProfileData = null
      let profileInfo = null
      
      try {
        // console.log('🔍 Buscando dados da instância via fetchInstances...')
        instanceProfileData = await evolutionApi.getInstanceInfo(instance.evolution_instance_id)
        
        // Se fetchInstances não tem profileName ou profilePictureUrl, buscar via fetchProfile
        if (!instanceProfileData?.profileName || !instanceProfileData?.profilePictureUrl) {
          // console.log('📱 Buscando dados adicionais via fetchProfile...')
          profileInfo = await evolutionApi.getContactProfile(
            instance.evolution_instance_id,
            phoneNumber
          )
        }
      } catch (e) {
        console.log('⚠️ Erro ao buscar dados da Evolution API:', e.message)
        // Se falhou fetchInstances, tentar fetchProfile
        try {
          profileInfo = await evolutionApi.getContactProfile(
            instance.evolution_instance_id,
            phoneNumber
          )
        } catch (profileError) {
          console.log('❌ Também falhou fetchProfile:', profileError.message)
        }
      }

      // Atualizar profile_pic_url se obtivemos nova informação
      const newProfilePic = instanceProfileData?.profilePictureUrl || profileInfo?.profilePictureUrl || profileInfo?.picture
      if (newProfilePic && newProfilePic !== instance.profile_pic_url) {
        await SupabaseInstance.update(instance.id, { profile_pic_url: newProfilePic })
      }

      // Normalizar payload básico esperado pelo frontend
      // Priorizar dados da fetchInstances quando disponíveis
      const normalized = {
        name: profileInfo?.name || profileInfo?.pushName || instanceProfileData?.profileName || 'Usuário',
        number: profileInfo?.number || (instanceProfileData?.owner ? instanceProfileData.owner.replace('@s.whatsapp.net', '') : instance.phone),
        profilePictureUrl: profileInfo?.profilePictureUrl || profileInfo?.profilePicture || instanceProfileData?.profilePictureUrl || instance.profile_pic_url || null,
        status: profileInfo?.status || undefined,
        // Adicionar campos extras da Evolution API
        profileName: instanceProfileData?.profileName || profileInfo?.pushName,
        ownerJid: instanceProfileData?.owner
      }

      res.json(normalized)
    } catch (error) {
      console.error('Erro ao obter informações do perfil:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  // Sincronizar dados da instância com Evolution API
  async syncInstanceData(req, res) {
    try {
      const { id } = req.params

      const whereClause = { id }
      if (req.user.role !== 'admin') {
        whereClause.userId = req.user.id
      }

      const instance = await SupabaseInstance.findOne({ where: whereClause })
      if (!instance) {
        return res.status(404).json({ error: 'Instância não encontrada' })
      }

      try {
        // Buscar informações atualizadas da Evolution API usando fetchInstances
        console.log('🔄 Sincronizando dados da Evolution API para:', instance.evolution_instance_id)
        const evolutionInfo = await evolutionApi.getInstanceInfo(instance.evolution_instance_id)
        
        if (evolutionInfo) {
          const updateFields = {}
          
          // Atualizar phone se não temos no banco local ou se mudou
          if (evolutionInfo.owner) {
            const newPhone = evolutionInfo.owner.replace('@s.whatsapp.net', '')
            if (!instance.phone || instance.phone !== newPhone) {
              updateFields.phone = newPhone
            }
          }
          
          // Atualizar profile_pic_url se temos nova informação
          if (evolutionInfo.profilePictureUrl && evolutionInfo.profilePictureUrl !== instance.profile_pic_url) {
            updateFields.profile_pic_url = evolutionInfo.profilePictureUrl
          }
          
          // Atualizar status baseado no connectionStatus da Evolution
          if (evolutionInfo.connectionStatus) {
            const newStatus = evolutionInfo.connectionStatus === 'open' ? 'connected' : 
                             evolutionInfo.connectionStatus === 'close' ? 'disconnected' : 'connecting'
            if (instance.status !== newStatus) {
              updateFields.status = newStatus
            }
          }
          
          // Aplicar atualizações se houver
          if (Object.keys(updateFields).length > 0) {
            console.log('📝 Atualizando campos:', updateFields)
            await SupabaseInstance.update(instance.id, updateFields)
          }
          
          // Retornar dados sincronizados enriquecidos com informações da Evolution API
          const instanceData = instance.toJSON()
          instanceData.ownerJid = evolutionInfo.owner
          instanceData.profileName = evolutionInfo.profileName
          instanceData.profilePictureUrl = evolutionInfo.profilePictureUrl
          instanceData.connectionStatus = evolutionInfo.connectionStatus
          instanceData.evolutionCounts = evolutionInfo.counts
          
          res.json({
            message: 'Dados sincronizados com sucesso',
            instance: instanceData
          })
        } else {
          res.json({
            message: 'Nenhum dado disponível na Evolution API',
            instance: instance.toJSON()
          })
        }
      } catch (evolutionError) {
        if (evolutionError.response?.status === 404) {
          return res.status(404).json({
            error: 'Instância não encontrada na Evolution API',
            orphaned: true
          })
        }
        throw evolutionError
      }
    } catch (error) {
      console.error('Erro ao sincronizar dados da instância:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  // Obter contatos da instância
  async getContacts(req, res) {
    try {
      const { id } = req.params

      const whereClause = { id }
      if (req.user.role !== 'admin') {
        whereClause.userId = req.user.id
      }

      const instance = await SupabaseInstance.findOne({ where: whereClause })
      if (!instance) {
        return res.status(404).json({ error: 'Instância não encontrada' })
      }

      if (instance.status !== 'connected') {
        return res.status(400).json({ error: 'Instância não está conectada' })
      }

      const contacts = await evolutionApi.getContacts(instance.evolution_instance_id)
      res.json({ contacts: contacts || [] })
    } catch (error) {
      console.error('Erro ao obter contatos:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  // Recriar instância órfã
  async recreateInstance(req, res) {
    try {
      const { id } = req.params

      const whereClause = { id }
      if (req.user.role !== 'admin') {
        whereClause.userId = req.user.id
      }

      const instance = await SupabaseInstance.findOne({ where: whereClause })
      if (!instance) {
        return res.status(404).json({ error: 'Instância não encontrada' })
      }

      console.log(`🔄 Recriando instância órfã: ${instance.name}`)

      // Gerar nova evolutionInstanceId
      const normalizedName = instance.name.toLowerCase().replace(/\s+/g, '_')
      const newEvolutionInstanceId = `${normalizedName}_${uuidv4().substring(0, 8)}_${Date.now()}`
      
      // Determinar URL do webhook baseado no ambiente
      let webhookBaseUrl = process.env.WEBHOOK_URL

      // Em desenvolvimento, sempre usar ngrok se não há URL pública configurada
      if (process.env.NODE_ENV === 'development' && !webhookBaseUrl) {
        const ngrok = getNgrokService()
        if (ngrok) {
          if (!ngrok.isActive()) {
            console.log('🚇 Iniciando túnel ngrok para webhook...')
            await ngrok.startTunnel(3001)
          }
          webhookBaseUrl = ngrok.getWebhookUrl()
        } else {
          console.warn('⚠️ Ngrok não disponível; defina WEBHOOK_URL para webhooks externos.')
        }
      }

      const webhookUrl = webhookBaseUrl ? `${webhookBaseUrl}/${newEvolutionInstanceId}` : null;

      // Criar nova instância no Evolution API
      const evolutionResponse = await evolutionApi.createInstance(
        newEvolutionInstanceId,
        webhookUrl
      )

      // Conectar automaticamente
      try {
        await evolutionApi.connectInstance(newEvolutionInstanceId)
      } catch (connectErr) {
        console.warn('Não foi possível conectar imediatamente:', connectErr.message)
      }

      // Atualizar dados da instância existente
      await SupabaseInstance.update(instance.id, {
        evolutionInstanceId: newEvolutionInstanceId,
        webhookUrl,
        status: 'connecting',
        phone: null,
        qrCode: null,
        profile_pic_url: null,
        settings: {
          ...instance.settings,
          orphaned: false,
          orphanedAt: null,
          orphanError: null,
          recreatedAt: new Date().toISOString()
        },
        lastSeen: new Date()
      })

      res.json({
        message: 'Instância recriada com sucesso',
        instance: {
          id: instance.id,
          name: instance.name,
          evolutionInstanceId: newEvolutionInstanceId,
          status: 'connecting'
        },
        evolutionResponse
      })
    } catch (error) {
      console.error('Erro ao recriar instância:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  // Verificar e reconfigurar webhook
  async checkWebhook(req, res) {
    try {
      console.log('🔍 Verificando webhook...')
      // A rota é /instances/:id/webhook — garantir nome correto do parâmetro
      const { id: instanceId } = req.params
      console.log('📋 InstanceId (params.id):', instanceId)

      const instance = await Instance.findByPk(instanceId)
      if (!instance) {
        console.log('❌ Instância não encontrada')
        return res.status(404).json({ error: 'Instância não encontrada' })
      }

      console.log('✅ Instância encontrada:', instance.name)

      // Verificar webhook atual
      let currentWebhook = null
      try {
        currentWebhook = await evolutionApi.findWebhook(instance.evolution_instance_id)
        console.log('🔍 Webhook atual:', JSON.stringify(currentWebhook, null, 2))
      } catch (error) {
        console.log('⚠️ Erro ao buscar webhook atual:', error.message)
      }

      // Obter URL do webhook (ngrok ou local)
      const webhookUrl = await getWebhookUrl()
      
      // Verificar se precisa reconfigurar
  const expectedUrl = `${webhookUrl}/${instance.evolution_instance_id}`
  const needsReconfig = !currentWebhook?.enabled || 
           currentWebhook?.url !== expectedUrl ||
                           !currentWebhook?.events?.includes('MESSAGES_UPSERT')

      let reconfigured = false
      if (needsReconfig) {
        try {
          console.log('🔧 Reconfigurando webhook...')
          await evolutionApi.setWebhook(
            instance.evolution_instance_id, 
            expectedUrl
          )
          reconfigured = true
          console.log('✅ Webhook reconfigurado com sucesso')
        } catch (error) {
          console.error('❌ Erro ao reconfigurar webhook:', error.message)
        }
      }

      res.json({
        instance: {
          id: instance.id,
          name: instance.name,
          evolutionInstanceId: instance.evolution_instance_id
        },
        webhook: {
          current: currentWebhook,
          expected: expectedUrl,
          needsReconfig,
          reconfigured
        }
      })
    } catch (error) {
      console.error('Erro ao verificar webhook:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  // Cleanup method for orphaned Evolution instances
  async cleanupOrphanedInstances(req, res) {
    try {
      console.log('🧹 Iniciando limpeza de instâncias órfãs...')
      
      // Get all instances from Evolution API
      let evolutionInstances = []
      try {
        evolutionInstances = await evolutionApi.getAllInstances()
        console.log(`📊 Encontradas ${evolutionInstances.length} instâncias na Evolution API`)
      } catch (error) {
        console.log('❌ Erro ao conectar com Evolution API:', error.message)
        return res.status(500).json({ error: 'Não foi possível conectar com Evolution API' })
      }

      // Get all instances from our database
      const dbInstances = await SupabaseInstance.findAll()
      console.log(`📊 Encontradas ${dbInstances.length} instâncias no banco de dados`)

      // Create map of our database instances
      const dbInstanceMap = new Map()
      dbInstances.forEach(instance => {
        dbInstanceMap.set(instance.evolution_instance_id, instance)
      })

      // Find orphaned instances in Evolution API
      const orphanedInstances = []
      for (const evolutionInstance of evolutionInstances) {
        if (!dbInstanceMap.has(evolutionInstance.instanceName)) {
          orphanedInstances.push(evolutionInstance)
        }
      }

      console.log(`🔍 Encontradas ${orphanedInstances.length} instâncias órfãs na Evolution API`)

      const results = {
        total_evolution: evolutionInstances.length,
        total_database: dbInstances.length,
        orphaned_found: orphanedInstances.length,
        orphaned_instances: orphanedInstances.map(instance => ({
          name: instance.instanceName,
          state: instance.state,
          connectionStatus: instance.connectionStatus,
          owner: instance.owner
        })),
        cleaned_up: [],
        errors: []
      }

      // If cleanup is requested, delete orphaned instances
      if (req.query.cleanup === 'true') {
        console.log('🗑️ Iniciando limpeza das instâncias órfãs...')
        
        for (const orphanedInstance of orphanedInstances) {
          try {
            console.log(`🗑️ Deletando instância órfã: ${orphanedInstance.instanceName}`)
            await evolutionApi.deleteInstance(orphanedInstance.instanceName)
            results.cleaned_up.push(orphanedInstance.instanceName)
            console.log(`✅ Instância ${orphanedInstance.instanceName} deletada com sucesso`)
          } catch (deleteError) {
            console.error(`❌ Erro ao deletar instância ${orphanedInstance.instanceName}:`, deleteError.message)
            results.errors.push({
              instance: orphanedInstance.instanceName,
              error: deleteError.message
            })
          }
        }
      }

      res.json({
        success: true,
        message: req.query.cleanup === 'true' ? 'Limpeza concluída' : 'Análise concluída (use ?cleanup=true para limpar)',
        ...results
      })

    } catch (error) {
      console.error('❌ Erro durante limpeza de instâncias órfãs:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

  // Reconfigurar webhook de uma instância existente
  async reconfigureWebhook(req, res) {
    try {
      const { id } = req.params

      const instance = await SupabaseInstance.findById(id)
      if (!instance) {
        return res.status(404).json({ error: 'Instância não encontrada' })
      }

      // Obter URL do webhook
      const baseWebhookUrl = await getWebhookUrl()
      const webhookUrl = `${baseWebhookUrl}/api/webhook/${instance.evolution_instance_id}`

      console.log(`🔄 Reconfigurando webhook para ${instance.evolution_instance_id}...`)
      console.log(`📡 URL: ${webhookUrl}`)

      // Reconfigurar webhook
      await evolutionApi.setWebhook(instance.evolution_instance_id, webhookUrl)

      // Atualizar URL no banco
      await SupabaseInstance.update(instance.id, {
        webhook_url: webhookUrl
      })

      res.json({ 
        message: 'Webhook reconfigurado com sucesso',
        webhookUrl 
      })
    } catch (error) {
      console.error('Erro ao reconfigurar webhook:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }

}

// Método helper para obter URL do webhook
async function getWebhookUrl() {
  if (process.env.WEBHOOK_URL) {
    return process.env.WEBHOOK_URL
  }
  console.log('🚧 Usando localhost para webhook')
  return process.env.NGROK_DOMAIN || 'http://localhost:3001'
}

module.exports = new InstanceController()
