const Message = require('../models/messageModel');

// Fonction pour sauvegarder un message
const createMessage = async (req, res) => {
  const { senderId, conversationId, text } = req.body;

  const newMessage = new Message({
    senderId,
    conversationId,
    text,
  });

  try {
    await newMessage.save();
    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la sauvegarde du message', error });
  }
};

// Fonction pour récupérer l'historique des messages
const getMessages = async (req, res) => {
  const { conversationId } = req.params;

  try {
    const messages = await Message.find({ conversationId }).sort({ createdAt: -1 });
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des messages', error });
  }
};

module.exports = {
  createMessage,
  getMessages,
};