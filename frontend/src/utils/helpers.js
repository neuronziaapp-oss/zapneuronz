// Formatação de números de telefone
export const formatPhone = phone => {
  if (!phone) return ''

  // Remove caracteres não numéricos
  const numbers = phone.replace(/\D/g, '')

  // Remove códigos do WhatsApp (@c.us, @g.us)
  let cleanPhone = phone.replace(/@.*$/, '')
  cleanPhone = cleanPhone.replace(/\D/g, '')

  // Formato brasileiro (55 + DDD + número)
  if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
    const ddd = cleanPhone.substring(2, 4)
    const number = cleanPhone.substring(4)

    if (number.length === 9) {
      // Celular: (XX) 9XXXX-XXXX
      return `+55 (${ddd}) ${number.substring(0, 5)}-${number.substring(5)}`
    } else if (number.length === 8) {
      // Fixo: (XX) XXXX-XXXX
      return `+55 (${ddd}) ${number.substring(0, 4)}-${number.substring(4)}`
    }
  }

  // Formato internacional genérico
  if (cleanPhone.length > 10) {
    return `+${cleanPhone}`
  }

  // Retorna o número original se não conseguir formatar
  return phone
}

// Extrair número limpo (apenas dígitos)
export const extractPhoneNumber = phone => {
  if (!phone) return ''
  return phone.replace(/\D/g, '')
}

// Verificar se é número brasileiro
export const isBrazilianNumber = phone => {
  const clean = extractPhoneNumber(phone)
  return clean.length === 13 && clean.startsWith('55')
}

// Verificar se é número de grupo
export const isGroupNumber = phone => {
  return phone && phone.includes('@g.us')
}

// Obter ID do chat (remove @c.us ou @g.us)
export const getChatId = phone => {
  if (!phone) return ''
  return phone.replace(/@.*$/, '')
}

// Formatação de tamanho de arquivo
export const formatFileSize = (bytes, decimals = 2) => {
  if (!bytes || bytes === 0) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

// Truncar texto
export const truncateText = (text, maxLength = 50, suffix = '...') => {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - suffix.length) + suffix
}

// Capitalizar primeira letra
export const capitalize = text => {
  if (!text) return ''
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

// Capitalizar cada palavra
export const capitalizeWords = text => {
  if (!text) return ''
  return text
    .split(' ')
    .map(word => capitalize(word))
    .join(' ')
}

// Remover acentos
export const removeAccents = text => {
  if (!text) return ''
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// Gerar iniciais do nome
export const getInitials = (name, maxChars = 2) => {
  if (!name) return '?'

  const words = name
    .trim()
    .split(' ')
    .filter(word => word.length > 0)

  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].substring(0, maxChars).toUpperCase()

  // Pegar primeira letra de cada palavra, limitado a maxChars
  return words
    .slice(0, maxChars)
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
}

// Gerar cor baseada no texto (para avatars)
export const getColorFromText = text => {
  if (!text) return '#9CA3AF'

  const colors = [
    '#EF4444',
    '#F97316',
    '#F59E0B',
    '#EAB308',
    '#84CC16',
    '#22C55E',
    '#10B981',
    '#06B6D4',
    '#0EA5E9',
    '#3B82F6',
    '#6366F1',
    '#8B5CF6',
    '#A855F7',
    '#D946EF',
    '#EC4899',
    '#F43F5E'
  ]

  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash)
  }

  const index = Math.abs(hash) % colors.length
  return colors[index]
}

// Validar email
export const validateEmail = email => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Validar senha
export const validatePassword = (password, minLength = 6) => {
  if (!password) return { valid: false, message: 'Senha é obrigatória' }
  if (password.length < minLength)
    return {
      valid: false,
      message: `Senha deve ter pelo menos ${minLength} caracteres`
    }
  return { valid: true, message: '' }
}

// Gerar ID único
export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

// Debounce function
export const debounce = (func, wait, immediate = false) => {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      timeout = null
      if (!immediate) func(...args)
    }
    const callNow = immediate && !timeout
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
    if (callNow) func(...args)
  }
}

// Throttle function
export const throttle = (func, limit) => {
  let inThrottle
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

// Deep clone objeto
export const deepClone = obj => {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj.getTime())
  if (obj instanceof Array) return obj.map(item => deepClone(item))
  if (typeof obj === 'object') {
    const copy = {}
    Object.keys(obj).forEach(key => {
      copy[key] = deepClone(obj[key])
    })
    return copy
  }
}

// Verificar se objetos são iguais (shallow comparison)
export const isEqual = (obj1, obj2) => {
  const keys1 = Object.keys(obj1)
  const keys2 = Object.keys(obj2)

  if (keys1.length !== keys2.length) return false

  for (let key of keys1) {
    if (obj1[key] !== obj2[key]) return false
  }

  return true
}

// Agrupar array por propriedade
export const groupBy = (array, key) => {
  return array.reduce((groups, item) => {
    const group = item[key]
    groups[group] = groups[group] || []
    groups[group].push(item)
    return groups
  }, {})
}

// Ordenar array de objetos
export const sortBy = (array, key, direction = 'asc') => {
  return [...array].sort((a, b) => {
    const aVal = a[key]
    const bVal = b[key]

    if (direction === 'desc') {
      return bVal > aVal ? 1 : bVal < aVal ? -1 : 0
    }

    return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
  })
}

// Filtrar array removendo duplicatas
export const unique = (array, key = null) => {
  if (!key) {
    return [...new Set(array)]
  }

  const seen = new Set()
  return array.filter(item => {
    const value = item[key]
    if (seen.has(value)) return false
    seen.add(value)
    return true
  })
}
