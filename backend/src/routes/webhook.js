const express = require('express')
const WebhookController = require('../controllers/WebhookController')

const router = express.Router()

// Rota para receber webhooks do Evolution API
router.post('/:instanceName', WebhookController.handleWebhook)

module.exports = router
