import {
  MESSAGE_TYPES,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  ALLOWED_AUDIO_TYPES,
  ALLOWED_DOCUMENT_TYPES
} from './constants'

// Verificar se é tipo de mídia
export const isMediaType = type => {
  return [
    MESSAGE_TYPES.IMAGE,
    MESSAGE_TYPES.VIDEO,
    MESSAGE_TYPES.AUDIO,
    MESSAGE_TYPES.DOCUMENT
  ].includes(type)
}

// Verificar se é imagem
export const isImageType = mimeType => {
  return ALLOWED_IMAGE_TYPES.includes(mimeType)
}

// Verificar se é vídeo
export const isVideoType = mimeType => {
  return ALLOWED_VIDEO_TYPES.includes(mimeType)
}

// Verificar se é áudio
export const isAudioType = mimeType => {
  return ALLOWED_AUDIO_TYPES.includes(mimeType)
}

// Verificar se é documento
export const isDocumentType = mimeType => {
  return ALLOWED_DOCUMENT_TYPES.includes(mimeType)
}

// Obter tipo de mídia baseado no MIME type
export const getMediaType = mimeType => {
  if (isImageType(mimeType)) return MESSAGE_TYPES.IMAGE
  if (isVideoType(mimeType)) return MESSAGE_TYPES.VIDEO
  if (isAudioType(mimeType)) return MESSAGE_TYPES.AUDIO
  if (isDocumentType(mimeType)) return MESSAGE_TYPES.DOCUMENT
  return MESSAGE_TYPES.DOCUMENT // fallback
}

// Obter extensão do arquivo
export const getFileExtension = filename => {
  if (!filename) return ''
  return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2)
}

// Obter nome do arquivo sem extensão
export const getFileNameWithoutExtension = filename => {
  if (!filename) return ''
  return filename.replace(/\.[^/.]+$/, '')
}

// Obter ícone para tipo de arquivo
export const getFileIcon = mimeType => {
  if (isImageType(mimeType)) return '🖼️'
  if (isVideoType(mimeType)) return '🎥'
  if (isAudioType(mimeType)) return '🎵'

  // Documentos específicos
  if (mimeType === 'application/pdf') return '📄'
  if (mimeType.includes('word')) return '📝'
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet'))
    return '📊'
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation'))
    return '📈'
  if (mimeType === 'text/plain') return '📃'
  if (mimeType === 'text/csv') return '📋'

  return '📎' // arquivo genérico
}

// Validar arquivo antes do upload
export const validateFile = (file, maxSize) => {
  const errors = []

  if (!file) {
    errors.push('Nenhum arquivo selecionado')
    return { valid: false, errors }
  }

  // Verificar tamanho
  if (file.size > maxSize) {
    errors.push(
      `Arquivo muito grande. Máximo permitido: ${formatFileSize(maxSize)}`
    )
  }

  // Verificar tipo
  const allowedTypes = [
    ...ALLOWED_IMAGE_TYPES,
    ...ALLOWED_VIDEO_TYPES,
    ...ALLOWED_AUDIO_TYPES,
    ...ALLOWED_DOCUMENT_TYPES
  ]

  if (!allowedTypes.includes(file.type)) {
    errors.push('Tipo de arquivo não suportado')
  }

  return {
    valid: errors.length === 0,
    errors,
    type: getMediaType(file.type)
  }
}

// Criar URL de preview para arquivo
export const createFilePreview = file => {
  if (!file) return null

  // Apenas para imagens e vídeos
  if (isImageType(file.type) || isVideoType(file.type)) {
    return URL.createObjectURL(file)
  }

  return null
}

// Limpar URL de preview
export const revokeFilePreview = url => {
  if (url) {
    URL.revokeObjectURL(url)
  }
}

// Converter arquivo para base64
export const fileToBase64 = file => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result)
    reader.onerror = error => reject(error)
  })
}

// Converter base64 para blob
export const base64ToBlob = (base64, mimeType) => {
  const byteCharacters = atob(base64.split(',')[1])
  const byteNumbers = new Array(byteCharacters.length)

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }

  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type: mimeType })
}

// Redimensionar imagem
export const resizeImage = (
  file,
  maxWidth = 800,
  maxHeight = 600,
  quality = 0.8
) => {
  return new Promise(resolve => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      // Calcular novas dimensões
      let { width, height } = img

      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height
          height = maxHeight
        }
      }

      // Redimensionar
      canvas.width = width
      canvas.height = height

      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(resolve, file.type, quality)
    }

    img.src = URL.createObjectURL(file)
  })
}

// Extrair metadados de mídia
export const extractMediaMetadata = file => {
  return new Promise(resolve => {
    const metadata = {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    }

    if (isImageType(file.type)) {
      const img = new Image()
      img.onload = () => {
        metadata.width = img.width
        metadata.height = img.height
        metadata.aspectRatio = img.width / img.height
        resolve(metadata)
      }
      img.onerror = () => resolve(metadata)
      img.src = URL.createObjectURL(file)
    } else if (isVideoType(file.type)) {
      const video = document.createElement('video')
      video.onloadedmetadata = () => {
        metadata.width = video.videoWidth
        metadata.height = video.videoHeight
        metadata.duration = video.duration
        metadata.aspectRatio = video.videoWidth / video.videoHeight
        resolve(metadata)
      }
      video.onerror = () => resolve(metadata)
      video.src = URL.createObjectURL(file)
    } else if (isAudioType(file.type)) {
      const audio = document.createElement('audio')
      audio.onloadedmetadata = () => {
        metadata.duration = audio.duration
        resolve(metadata)
      }
      audio.onerror = () => resolve(metadata)
      audio.src = URL.createObjectURL(file)
    } else {
      resolve(metadata)
    }
  })
}

// Comprimir arquivo de áudio
export const compressAudio = (file, quality = 0.7) => {
  return new Promise((resolve, reject) => {
    const audio = new Audio(URL.createObjectURL(file))
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    // Para áudios, apenas reduzimos a qualidade mantendo o formato
    // Implementação simplificada - em produção usar bibliotecas como FFmpeg.wasm
    resolve(file)
  })
}

// Gerar thumbnail para vídeo
export const generateVideoThumbnail = (file, timeOffset = 1) => {
  return new Promise(resolve => {
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      video.currentTime = Math.min(timeOffset, video.duration)
    }

    video.onseeked = () => {
      ctx.drawImage(video, 0, 0)
      canvas.toBlob(resolve, 'image/jpeg', 0.8)
    }

    video.onerror = () => resolve(null)
    video.src = URL.createObjectURL(file)
  })
}

// Download de arquivo
export const downloadFile = (url, filename) => {
  const link = document.createElement('a')
  link.href = url
  link.download = filename || 'download'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Compartilhar arquivo (Web Share API)
export const shareFile = async (file, title, text) => {
  if (
    navigator.share &&
    navigator.canShare &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        files: [file],
        title,
        text
      })
      return true
    } catch (error) {
      console.error('Erro ao compartilhar:', error)
      return false
    }
  }
  return false
}

// Utilitário para formatFileSize (importado de helpers.js)
const formatFileSize = (bytes, decimals = 2) => {
  if (!bytes || bytes === 0) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}
