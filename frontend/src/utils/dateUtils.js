// Formatação de data e hora
export const formatDate = (date, options = {}) => {
  if (!date) return ''

  const dateObj = new Date(date)
  const now = new Date()
  const diffInHours = (now - dateObj) / (1000 * 60 * 60)

  const defaultOptions = {
    showTime: true,
    showDate: true,
    short: false,
    ...options
  }

  // Se é hoje, mostrar apenas a hora
  if (diffInHours < 24 && dateObj.toDateString() === now.toDateString()) {
    if (defaultOptions.short) {
      return dateObj.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      })
    }
    return dateObj.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Se foi ontem
  if (diffInHours < 48 && diffInHours >= 24) {
    if (defaultOptions.short) {
      return 'Ontem'
    }
    return defaultOptions.showTime
      ? `Ontem às ${dateObj.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit'
        })}`
      : 'Ontem'
  }

  // Se foi esta semana
  if (diffInHours < 168) {
    // 7 dias
    const dayNames = [
      'Domingo',
      'Segunda',
      'Terça',
      'Quarta',
      'Quinta',
      'Sexta',
      'Sábado'
    ]
    const dayName = dayNames[dateObj.getDay()]

    if (defaultOptions.short) {
      return dayName.substring(0, 3)
    }
    return defaultOptions.showTime
      ? `${dayName} às ${dateObj.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit'
        })}`
      : dayName
  }

  // Para datas mais antigas
  if (defaultOptions.short) {
    return dateObj.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit'
    })
  }

  return dateObj.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(defaultOptions.showTime && {
      hour: '2-digit',
      minute: '2-digit'
    })
  })
}

// Formatação de data relativa (ex: "2 horas atrás")
export const formatRelativeTime = date => {
  if (!date) return ''

  const dateObj = new Date(date)
  const now = new Date()
  const diffInSeconds = Math.floor((now - dateObj) / 1000)

  const intervals = [
    { label: 'ano', seconds: 31536000 },
    { label: 'mês', seconds: 2592000 },
    { label: 'semana', seconds: 604800 },
    { label: 'dia', seconds: 86400 },
    { label: 'hora', seconds: 3600 },
    { label: 'minuto', seconds: 60 }
  ]

  for (const interval of intervals) {
    const count = Math.floor(diffInSeconds / interval.seconds)
    if (count >= 1) {
      return count === 1
        ? `há 1 ${interval.label}`
        : `há ${count} ${interval.label}${count > 1 ? 's' : ''}`
    }
  }

  return 'agora mesmo'
}

// Formatação de tempo de duração
export const formatDuration = seconds => {
  if (!seconds || seconds < 0) return '0:00'

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

// Verificar se é hoje
export const isToday = date => {
  if (!date) return false
  const dateObj = new Date(date)
  const today = new Date()
  return dateObj.toDateString() === today.toDateString()
}

// Verificar se foi ontem
export const isYesterday = date => {
  if (!date) return false
  const dateObj = new Date(date)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return dateObj.toDateString() === yesterday.toDateString()
}

// Verificar se é da mesma semana
export const isThisWeek = date => {
  if (!date) return false
  const dateObj = new Date(date)
  const now = new Date()
  const diffInHours = (now - dateObj) / (1000 * 60 * 60)
  return diffInHours < 168 // 7 dias
}

// Agrupar mensagens por data
export const groupMessagesByDate = messages => {
  const groups = []
  let currentGroup = null

  messages.forEach(message => {
    const messageDate = new Date(message.timestamp).toDateString()

    if (!currentGroup || currentGroup.date !== messageDate) {
      currentGroup = {
        date: messageDate,
        dateObj: new Date(message.timestamp),
        messages: []
      }
      groups.push(currentGroup)
    }

    currentGroup.messages.push(message)
  })

  return groups
}

// Obter label da data para agrupamento
export const getDateGroupLabel = date => {
  const dateObj = new Date(date)

  if (isToday(dateObj)) {
    return 'Hoje'
  }

  if (isYesterday(dateObj)) {
    return 'Ontem'
  }

  if (isThisWeek(dateObj)) {
    const dayNames = [
      'Domingo',
      'Segunda-feira',
      'Terça-feira',
      'Quarta-feira',
      'Quinta-feira',
      'Sexta-feira',
      'Sábado'
    ]
    return dayNames[dateObj.getDay()]
  }

  return dateObj.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}
