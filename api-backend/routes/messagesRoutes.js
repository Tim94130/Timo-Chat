const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');

// Route pour sauvegarder un message
router.post('/', messageController.createMessage);

// Route pour récupérer l'historique des messages
router.get('/:conversationId', messageController.getMessages);

module.exports = router;