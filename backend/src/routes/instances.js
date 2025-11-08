const express = require('express')
const InstanceController = require('../controllers/InstanceController')
const { hybridAuth } = require('../middleware/iframeAuth')

const router = express.Router()

// Middleware de autenticação híbrida (API Key ou JWT) para todas as rotas
router.use(hybridAuth)

// Rotas de instâncias
router.post('/', InstanceController.createInstance)
router.get('/', InstanceController.getInstances)
router.get('/:id', InstanceController.getInstance)
router.post('/:id/connect', InstanceController.connectInstance)
router.get('/:id/qrcode', InstanceController.getQRCode)
router.get('/:id/status', InstanceController.getConnectionState)
router.post('/:id/disconnect', InstanceController.disconnectInstance)
router.delete('/:id', InstanceController.deleteInstance)
router.get('/:id/profile', InstanceController.getProfileInfo)
router.get('/:id/contacts', InstanceController.getContacts)
router.post('/:id/sync', InstanceController.syncInstanceData)
router.get('/:id/webhook', InstanceController.checkWebhook)
router.post('/:id/webhook/reconfigure', InstanceController.reconfigureWebhook)
router.post('/:id/recreate', InstanceController.recreateInstance)
router.get('/admin/cleanup-orphaned', InstanceController.cleanupOrphanedInstances)

module.exports = router
