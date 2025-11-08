import { toast } from 'react-hot-toast'

class NotificationService {
  constructor() {
    this.permission = 'default'
    this.requestPermission()
  }

  // Solicitar permissão para notificações
  async requestPermission() {
    if ('Notification' in window) {
      this.permission = await Notification.requestPermission()
    }
  }

  // Verificar se notificações são suportadas e permitidas
  isSupported() {
    return 'Notification' in window && this.permission === 'granted'
  }

  // Mostrar notificação do sistema
  showNotification(title, options = {}) {
    if (!this.isSupported()) {
      console.warn('Notificações não são suportadas ou não foram permitidas')
      return null
    }

    const defaultOptions = {
      icon: '/images/logo.png',
      badge: '/images/logo.png',
      tag: 'whatsapp-message',
      requireInteraction: false,
      silent: false,
      ...options
    }

    try {
      const notification = new Notification(title, defaultOptions)

      // Auto fechar após timeout
      if (defaultOptions.requireInteraction === false) {
        setTimeout(() => {
          notification.close()
        }, process.env.REACT_APP_NOTIFICATION_TIMEOUT || 5000)
      }

      return notification
    } catch (error) {
      console.error('Erro ao mostrar notificação:', error)
      return null
    }
  }

  // Notificação de nova mensagem
  showMessageNotification(contact, message, options = {}) {
    const title = contact.name || contact.pushName || contact.phone
    const body = this.truncateMessage(message)

    return this.showNotification(title, {
      body,
      icon: contact.profilePicUrl || '/images/default-avatar.png',
      tag: `message-${contact.phone}`,
      data: {
        type: 'message',
        chatId: contact.phone,
        contactId: contact.id
      },
      ...options
    })
  }

  // Notificação de nova instância conectada
  showInstanceConnectedNotification(instanceName) {
    return this.showNotification('WhatsApp Conectado', {
      body: `A instância ${instanceName} foi conectada com sucesso!`,
      icon: '/images/logo.png',
      tag: 'instance-connected',
      data: {
        type: 'instance_connected',
        instanceName
      }
    })
  }

  // Notificação de instância desconectada
  showInstanceDisconnectedNotification(instanceName) {
    return this.showNotification('WhatsApp Desconectado', {
      body: `A instância ${instanceName} foi desconectada.`,
      icon: '/images/logo.png',
      tag: 'instance-disconnected',
      data: {
        type: 'instance_disconnected',
        instanceName
      }
    })
  }

  // Toast de sucesso
  showSuccess(message, options = {}) {
    return toast.success(message, {
      duration: 4000,
      position: 'top-right',
      style: {
        background: '#10B981',
        color: '#FFFFFF'
      },
      ...options
    })
  }

  // Toast de erro
  showError(message, options = {}) {
    return toast.error(message, {
      duration: 6000,
      position: 'top-right',
      style: {
        background: '#EF4444',
        color: '#FFFFFF'
      },
      ...options
    })
  }

  // Toast de aviso
  showWarning(message, options = {}) {
    return toast(message, {
      duration: 5000,
      position: 'top-right',
      icon: '⚠️',
      style: {
        background: '#F59E0B',
        color: '#FFFFFF'
      },
      ...options
    })
  }

  // Toast de informação
  showInfo(message, duration = 4000, options = {}) {
    // Se duration for um objeto, considere-o como options
    if (typeof duration === 'object') {
      options = duration;
      duration = 4000;
    }
    
    console.log('📣 Mostrando notificação info com duração:', duration)
    
    return toast(message, {
      duration: duration,
      position: 'top-center', // Centralizado para maior visibilidade
      icon: '💡',
      style: {
        background: '#3B82F6',
        color: '#FFFFFF',
        fontSize: '1rem',
        padding: '16px',
        maxWidth: '500px' // Notificações mais largas para dicas importantes
      },
      ...options
    })
  }

  // Toast de carregamento
  showLoading(message, options = {}) {
    return toast.loading(message, {
      position: 'top-right',
      style: {
        background: '#6B7280',
        color: '#FFFFFF'
      },
      ...options
    })
  }

  // Atualizar toast existente
  updateToast(toastId, message, type = 'success') {
    const toastOptions = {
      success: {
        style: { background: '#10B981', color: '#FFFFFF' }
      },
      error: {
        style: { background: '#EF4444', color: '#FFFFFF' }
      },
      loading: {
        style: { background: '#6B7280', color: '#FFFFFF' }
      }
    }

    return toast[type](message, {
      id: toastId,
      ...toastOptions[type]
    })
  }

  // Descartar toast
  dismiss(toastId) {
    return toast.dismiss(toastId)
  }

  // Descartar todos os toasts
  dismissAll() {
    return toast.dismiss()
  }

  // Utilitário para truncar mensagem
  truncateMessage(message, maxLength = 50) {
    if (!message) return 'Nova mensagem'

    if (typeof message === 'string') {
      if (message.length <= maxLength) return message
      return message.substring(0, maxLength) + '...'
    }

    // Para mensagens de mídia
    if (message.type) {
      switch (message.type) {
        case 'image':
          return '📷 Imagem'
        case 'video':
          return '🎥 Vídeo'
        case 'audio':
          return '🎵 Áudio'
        case 'document':
          return '📄 Documento'
        case 'sticker':
        case 'stickerMessage':
          return '😄 Figurinha'
        case 'location':
          return '📍 Localização'
        default:
          return 'Nova mensagem'
      }
    }

    return 'Nova mensagem'
  }

  // Configurar click handler para notificações
  setClickHandler(handler) {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
        handler(event.data)
      }
    })
  }

  // Verificar se o usuário está "ausente" (tab não focada)
  isUserAway() {
    return document.hidden || !document.hasFocus()
  }

  // Verificar permissão atual
  getPermission() {
    return this.permission
  }

  // Forçar nova solicitação de permissão
  async forceRequestPermission() {
    if ('Notification' in window) {
      this.permission = await Notification.requestPermission()
      return this.permission
    }
    return 'unsupported'
  }
}

// Exportar instância única
const notificationService = new NotificationService()
export default notificationService
