const express = require('express');
const app = express();
const port = 4001;
require('dotenv').config();
const mongoose = require('mongoose');
const mongoURI = process.env.MONGO_URI;
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const socketIo = require('socket.io');
const cors = require('cors');
const http = require('http');
const Message = require('./models/messageModel')

app.use(express.json());
app.use(cors());

// Socket IO CONFIG
const server = http.createServer(app); 
const io = socketIo(server, {
  cors: {
    origin: 'http://localhost:5173',
  },
})

let socketsConnected = new Set();
let users = {};
let lastMessageTime = {};
const MESSAGE_LIMIT = 10 * 1000;
const INACTIVITY_LIMIT = 1 * 60 * 1000;
const DISCONNECT_LIMIT = 5 * 60 * 1000; 
let inactivityTimers = {};
let disconnectTimers = {};
let userStatus = {};

const welcomeMessages = [
  "Bienvenue dans le chat !",
  "Salut ! Heureux de te voir ici.",
  "Bienvenue, amuse-toi bien !",
  "Hello ! Prêt à discuter ?",
  "Bienvenue à bord !",
];

io.on('connection', (socket) => {
  console.log(`New client connected : ${socket.id}`)
  socketsConnected.add(socket.id);

  socket.on('setUsername', (username) => {
    users[socket.id] = username;
    userStatus[socket.id] = 'en ligne';
    console.log("Liste d'utilisateurs : ", users);
    io.emit('updateUserList', users);

    const welcomeMessage = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
    socket.emit('notification', `${welcomeMessage} ${username}`);

    socket.broadcast.emit('notification', `${username} a rejoint le chat`);

    startInactivityTimer(socket.id);
  })

  socket.on('message', async (message) => {
    resetInactivityTimer(socket.id);
    
    const currentTime = Date.now();
    if (lastMessageTime[socket.id] && (currentTime - lastMessageTime[socket.id]) < MESSAGE_LIMIT) {
      console.log(`Message ignoré pour ${socket.id} : envoi trop rapide.`);
      return;
    }

    lastMessageTime[socket.id] = currentTime;

    userStatus[socket.id] = 'en ligne';
    io.emit('userStatusUpdate', { userId: socket.id, status: 'en ligne' });

    if (message.text.startsWith('!')) {
      handleChatBotCommands(socket, message.text);
      return;
    }

    const bannedWords = ['cul', 'con', 'fdp'];

    // Fonction pour remplacer les mots inappropriés par des astérisques
    const filterMessage = (text) => {
      let filteredText = text;
      bannedWords.forEach((word) => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const replacement = '*'.repeat(word.length);
        filteredText = filteredText.replace(regex, replacement);
      });
      return filteredText;
    };

    // Remplacer le texte du message
    message.text = filterMessage(message.text);

    console.log("Message : ", message);

    if (message.recipientId === 'All') {
      io.emit('message', message);
    } else {
      io.to(message.recipientId).emit('privateMessage', message);
      socket.emit('privateMessage', message);
    }
  });

  const handleChatBotCommands = (socket, command) => {
    let response;
  
    switch (command) {
      case '!help':
        response = "Commandes disponibles : !help, !joke, !time";
        break;
      case '!joke':
        response = "Pourquoi les plongeurs plongent-ils toujours en arrière et jamais en avant ? Parce que sinon ils tombent dans le bateau !";
        break;
      case '!time':
        response = `Il est actuellement ${new Date().toLocaleTimeString()}.`;
        break;
      default:
        response = "Commande inconnue. Tapez !help pour voir les commandes disponibles.";
    }
  
    socket.emit('message', { text: response, author: 'ChatBot', date: new Date().toLocaleString() });
  };

  socket.on('typing', ({recipientId, feedback}) => {
    if (recipientId === 'All') {
      socket.broadcast.emit('typing', {recipientId, feedback});
    } else {
      socket.to(recipientId).emit('typing', {recipientId, feedback});
    }
  })

  socket.on('stopTyping', (recipientId) => {
    if (recipientId === 'All') {
      socket.broadcast.emit('typing', {recipientId, feedback: ''});
    } else {
      socket.to(recipientId).emit('typing', {recipientId, feedback: ''});
    }
  })

  io.emit('clientsTotal', socketsConnected.size);

  socket.on('disconnect', () => {
    console.log(`Client disconnected : ${socket.id}`);
    const username = users[socket.id];
    socketsConnected.delete(socket.id);
    delete users[socket.id];
    clearTimeout(inactivityTimers[socket.id]);
    clearTimeout(disconnectTimers[socket.id]); // Clear disconnect timer
    delete inactivityTimers[socket.id];
    delete disconnectTimers[socket.id];
    delete userStatus[socket.id];
    io.emit('updateUserList', users);
    io.emit('clientsTotal', socketsConnected.size);
    // Notifier les autres utilisateurs qu'un utilisateur a quitté
    socket.broadcast.emit('logout', `${username} a quitté le chat`);
  });
});

const startInactivityTimer = (socketId) => {
  inactivityTimers[socketId] = setTimeout(() => {
    console.log(`User ${users[socketId]} has been inactive for too long. Setting status to inactive...`);
    userStatus[socketId] = 'inactif';
    io.emit('userStatusUpdate', { userId: socketId, status: 'inactif' });

    // Start disconnect timer after setting status to inactive
    startDisconnectTimer(socketId);
  }, INACTIVITY_LIMIT);
};

const startDisconnectTimer = (socketId) => {
  disconnectTimers[socketId] = setTimeout(() => {
    console.log(`User ${users[socketId]} has been inactive for too long. Disconnecting...`);
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.disconnect();
    }
  }, DISCONNECT_LIMIT);
};

const resetInactivityTimer = (socketId) => {
  clearTimeout(inactivityTimers[socketId]);
  clearTimeout(disconnectTimers[socketId]);
  startInactivityTimer(socketId);
};

// ROUTES CONFIG
const apiRoutes = require('./routes');
app.use('/api', apiRoutes);

// SWAGGER INIT CONFIG
const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info : {
      title: 'NodeJS B3',
      version: '1.0',
      description: 'Une API de fou malade',
      contact: {
        name: 'Chris'
      },
      servers : [
        {
          url: 'http://localhost:4001'
        },
      ],
    },
  },
  apis: [
    `${__dirname}/routes.js`,
    `${__dirname}/routes/*.js`,
    `${__dirname}/models/*.js`,
    `${__dirname}/controllers/*.js`,
  ],
};
const swaggerDocs = swaggerJSDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Connect to the database
mongoose.connect(mongoURI, {})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.log(`MongoDB connection error: ${err}`))

app.get('/', (req, res) => {
 res.send("Hello, bienvue sur le serveur"); 
})

// Server.listen a la place de app.listen
server.listen(port, () => {
  console.log("Serveur en ligne port 4001");
})