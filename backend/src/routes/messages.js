const express = require('express')
const MessageController = require('../controllers/MessageController')
const { hybridAuth } = require('../middleware/iframeAuth')
const upload = require('../middleware/upload')

const router = express.Router()

// Middleware de autenticação híbrida (API Key ou JWT) para todas as rotas
router.use(hybridAuth)

// Rotas de mensagens
router.get('/:instanceId/chats/:chatId/messages', MessageController.getMessages)
router.post(
  '/:instanceId/chats/:chatId/messages/sync',
  MessageController.syncMessages
)
router.post(
  '/:instanceId/chats/:chatId/messages/text',
  MessageController.sendTextMessage
)
router.post(
  '/:instanceId/messages/send-text',
  MessageController.sendTextMessage
)
router.post(
  '/:instanceId/chats/:chatId/messages/media',
  upload.single('media'),
  MessageController.sendMediaMessage
)
router.post(
  '/:instanceId/messages/send-media',
  MessageController.sendMedia
)
router.post(
  '/:instanceId/messages/send-audio',
  MessageController.sendWhatsAppAudio
)
router.post(
  '/:instanceId/messages/send-sticker',
  MessageController.sendSticker
)
router.get('/:instanceId/messages/search', MessageController.searchMessages)
router.get(
  '/:instanceId/messages/:messageId/media',
  MessageController.downloadMedia
)
router.post(
  '/:instanceId/messages/:messageId/base64',
  MessageController.getBase64FromMedia
)
router.delete(
  '/:instanceId/messages/:messageId',
  MessageController.deleteMessage
)

module.exports = router
