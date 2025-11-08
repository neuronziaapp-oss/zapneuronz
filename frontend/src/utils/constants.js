// Constantes da aplicação
export const APP_NAME = 'WhatsApp Web Clone'
export const VERSION = '1.0.0'

// URLs da API
export const API_BASE_URL =
  process.env.REACT_APP_API_URL || 'http://localhost:3001/api'
export const WEBSOCKET_URL =
  process.env.REACT_APP_WS_URL || 'http://localhost:3001'

// Configurações de autenticação
export const AUTH_TOKEN_KEY = 'whatsapp_token'
export const AUTH_USER_KEY = 'whatsapp_user'
export const TOKEN_EXPIRY_BUFFER = 5 * 60 * 1000 // 5 minutos em ms

// Configurações de chat
export const MAX_MESSAGE_LENGTH = 4096
export const MAX_CAPTION_LENGTH = 1024
export const TYPING_INDICATOR_TIMEOUT = 3000 // 3 segundos
export const MESSAGE_FETCH_LIMIT = 50
export const CHAT_FETCH_LIMIT = 20

// Configurações de arquivo
export const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp'
]
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg']
export const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/m4a'
]
export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv'
]

// Tipos de mensagem
export const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  DOCUMENT: 'document',
  LOCATION: 'location',
  CONTACT: 'contact',
  STICKER: 'sticker'
}

// Status da mensagem
export const MESSAGE_STATUS = {
  SENDING: 'sending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed'
}

// Status da instância do WhatsApp
export const INSTANCE_STATUS = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  QR_CODE: 'qr_code',
  ERROR: 'error'
}

// Status de presença
export const PRESENCE_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  TYPING: 'typing',
  RECORDING: 'recording'
}

// Tipos de chat
export const CHAT_TYPES = {
  PRIVATE: 'private',
  GROUP: 'group'
}

// Configurações de notificação
export const NOTIFICATION_TYPES = {
  NEW_MESSAGE: 'new_message',
  NEW_CHAT: 'new_chat',
  TYPING: 'typing',
  PRESENCE: 'presence',
  INSTANCE_STATUS: 'instance_status'
}

// Configurações de tema
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark'
}

// Configurações de idioma
export const LANGUAGES = {
  PT_BR: 'pt-BR',
  EN_US: 'en-US',
  ES_ES: 'es-ES'
}

// Configurações de layout
export const SIDEBAR_WIDTH = 400
export const CHAT_HEADER_HEIGHT = 60
export const MESSAGE_INPUT_HEIGHT = 60
export const AVATAR_SIZE_SMALL = 32
export const AVATAR_SIZE_MEDIUM = 40
export const AVATAR_SIZE_LARGE = 48

// Configurações de scroll
export const SCROLL_THRESHOLD = 100
export const INFINITE_SCROLL_THRESHOLD = 200

// Configurações de pesquisa
export const SEARCH_DEBOUNCE_DELAY = 300
export const MIN_SEARCH_LENGTH = 2
export const MAX_SEARCH_RESULTS = 50

// Configurações de cache
export const CACHE_DURATION = {
  CONTACTS: 5 * 60 * 1000, // 5 minutos
  CHATS: 2 * 60 * 1000, // 2 minutos
  MESSAGES: 1 * 60 * 1000, // 1 minuto
  MEDIA: 10 * 60 * 1000 // 10 minutos
}

// Regex patterns
export const REGEX_PATTERNS = {
  PHONE: /^[\+]?[1-9][\d]{0,15}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  URL: /(https?:\/\/(?:[-\w.])+(?::[0-9]+)?(?:\/(?:[\w\/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:[\w.])*)?)?)/gi,
  MENTION: /@(\d+)/g,
  HASHTAG: /#[\w]+/g
}

// Cores do WhatsApp
export const WHATSAPP_COLORS = {
  PRIMARY: '#00A884',
  PRIMARY_DARK: '#008069',
  SECONDARY: '#25D366',
  BACKGROUND: '#111B21',
  BACKGROUND_LIGHT: '#F0F2F5',
  SIDEBAR: '#202C33',
  SIDEBAR_LIGHT: '#FFFFFF',
  CHAT_BACKGROUND: '#0B141A',
  CHAT_BACKGROUND_LIGHT: '#EFEAE2',
  MESSAGE_OUT: '#005C4B',
  MESSAGE_IN: '#202C33',
  MESSAGE_OUT_LIGHT: '#D9FDD3',
  MESSAGE_IN_LIGHT: '#FFFFFF',
  TEXT_PRIMARY: '#E9EDEF',
  TEXT_PRIMARY_LIGHT: '#111B21',
  TEXT_SECONDARY: '#8696A0',
  TEXT_SECONDARY_LIGHT: '#667781',
  BORDER: '#2A3942',
  BORDER_LIGHT: '#E9EDEF',
  SUCCESS: '#00A884',
  ERROR: '#F15C6D',
  WARNING: '#FFAB00',
  INFO: '#54C7EC'
}

// Z-index layers
export const Z_INDEX = {
  DROPDOWN: 1000,
  MODAL: 1050,
  POPOVER: 1060,
  TOOLTIP: 1070,
  TOAST: 1080,
  LOADING: 1090
}

// Configurações de animação
export const ANIMATION_DURATION = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500
}

// Breakpoints para responsividade
export const BREAKPOINTS = {
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
  '2XL': 1536
}

// Atalhos de teclado
export const KEYBOARD_SHORTCUTS = {
  SEND_MESSAGE: ['Enter'],
  NEW_LINE: ['Shift+Enter'],
  SEARCH: ['Ctrl+K', 'Cmd+K'],
  ESCAPE: ['Escape'],
  ARCHIVE_CHAT: ['Ctrl+E', 'Cmd+E'],
  DELETE_CHAT: ['Ctrl+D', 'Cmd+D'],
  MUTE_CHAT: ['Ctrl+M', 'Cmd+M']
}

// Configurações de Evolution API
export const EVOLUTION_API = {
  WEBHOOK_EVENTS: [
    'APPLICATION_STARTUP',
    'QRCODE_UPDATED',
    'CONNECTION_UPDATE',
    'MESSAGES_UPSERT',
    'MESSAGES_UPDATE',
    'PRESENCE_UPDATE',
    'CHATS_UPSERT',
    'CHATS_UPDATE',
    'CHATS_DELETE',
    'CONTACTS_UPSERT',
    'CONTACTS_UPDATE',
    'GROUPS_UPSERT',
    'GROUPS_UPDATE',
    'GROUP_PARTICIPANTS_UPDATE'
  ],
  DEFAULT_SETTINGS: {
    rejectCall: false,
    msgCall: 'Sistema não aceita chamadas de voz/vídeo',
    groupsIgnore: false,
    alwaysOnline: false,
    readMessages: false,
    readStatus: false,
    syncFullHistory: false
  }
}

// Mensagens do sistema
export const SYSTEM_MESSAGES = {
  WELCOME: 'Bem-vindo ao WhatsApp Web Clone!',
  INSTANCE_CONNECTING: 'Conectando à sua conta do WhatsApp...',
  INSTANCE_CONNECTED: 'Conectado com sucesso!',
  INSTANCE_DISCONNECTED: 'Desconectado do WhatsApp',
  QR_CODE_SCAN: 'Escaneie o código QR com seu celular',
  CONNECTION_ERROR: 'Erro de conexão. Tente novamente.',
  MESSAGE_FAILED: 'Falha ao enviar mensagem',
  FILE_TOO_LARGE: 'Arquivo muito grande',
  INVALID_FILE_TYPE: 'Tipo de arquivo não suportado',
  NETWORK_ERROR: 'Erro de rede. Verifique sua conexão.'
}

// Configurações de desenvolvimento
export const DEV_CONFIG = {
  LOG_LEVEL: process.env.NODE_ENV === 'development' ? 'debug' : 'error',
  API_TIMEOUT: 30000, // 30 segundos
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000 // 1 segundo
}
