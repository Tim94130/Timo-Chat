const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');

// Route pour créer une conversation
router.post('/', conversationController.createConversation);

// Route pour récupérer les conversations d'un utilisateur
router.get('/:userId', conversationController.getUserConversations);

module.exports = router;
