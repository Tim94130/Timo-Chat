const Conversation = require('../models/conversationModel');

// Fonction pour créer une conversation
const createConversation = async (req, res) => {
  const { participants } = req.body;

  const newConversation = new Conversation({
    participants,
  });

  try {
    await newConversation.save();
    res.status(201).json(newConversation);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la création de la conversation', error });
  }
};

// Fonction pour récupérer toutes les conversations d'un utilisateur
const getUserConversations = async (req, res) => {
  const { userId } = req.params;

  try {
    const conversations = await Conversation.find({ participants: userId }).populate('participants');
    res.status(200).json(conversations);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des conversations', error });
  }
};

module.exports = {
  createConversation,
  getUserConversations,
};
