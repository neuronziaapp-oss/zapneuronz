const multer = require('multer')
const path = require('path')
const { v4: uuidv4 } = require('uuid')

// Configuração de armazenamento
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/')
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(
      file.originalname
    )}`
    cb(null, uniqueName)
  }
})

// Filtro de arquivos
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    // Imagens
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    // Documentos
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    // Áudio
    'audio/mpeg',
    'audio/wav',
    'audio/mp4',
    'audio/ogg',
    // Vídeo
    'video/mp4',
    'video/avi',
    'video/mov',
    'video/mkv'
  ]

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Tipo de arquivo não permitido'), false)
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
})

module.exports = upload
