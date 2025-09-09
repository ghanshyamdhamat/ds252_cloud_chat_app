const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/chatdb';
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now }
});

// Message Schema
const messageSchema = new mongoose.Schema({
  sender: { type: String, required: true },
  recipient: { type: String, required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  messageType: { type: String, enum: ['text', 'image', 'file'], default: 'text' },
  isRead: { type: Boolean, default: false }
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);

// API Routes

// Register/Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, email } = req.body;
    let user = await User.findOne({ $or: [{ username }, { email }] });
    
    if (!user) {
      user = new User({ username, email, isOnline: true });
      await user.save();
    } else {
      user.isOnline = true;
      await user.save();
    }
    
    res.json({ success: true, user: { id: user._id, username: user.username, email: user.email } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search users
app.get('/api/users/search', async (req, res) => {
  try {
    const { query } = req.query;
    const users = await User.find({
      username: { $regex: query, $options: 'i' }
    }).select('username email isOnline lastSeen');
    
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get message history between two users
app.get('/api/messages/:user1/:user2', async (req, res) => {
  try {
    const { user1, user2 } = req.params;
    const messages = await Message.find({
      $or: [
        { sender: user1, recipient: user2 },
        { sender: user2, recipient: user1 }
      ]
    }).sort({ timestamp: 1 });
    
    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user's conversations
app.get('/api/conversations/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    // Get all messages involving the user
    const messages = await Message.find({
      $or: [{ sender: username }, { recipient: username }]
    }).sort({ timestamp: -1 });

    // Group by conversation partner and get latest message
    const conversations = {};
    
    messages.forEach(message => {
      const partner = message.sender === username ? message.recipient : message.sender;
      if (!conversations[partner] || conversations[partner].timestamp < message.timestamp) {
        conversations[partner] = {
          partner,
          lastMessage: message.content,
          timestamp: message.timestamp,
          unreadCount: 0 // Will be calculated separately
        };
      }
    });

    res.json({ success: true, conversations: Object.values(conversations) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Socket.IO connection handling
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // User joins with username
  socket.on('join', async (username) => {
    socket.username = username;
    connectedUsers.set(username, socket.id);
    
    // Update user online status
    await User.findOneAndUpdate(
      { username },
      { isOnline: true, lastSeen: new Date() }
    );

    // Notify others about online status
    socket.broadcast.emit('userOnline', username);
    
    // Send current online users to the new user
    const onlineUsers = Array.from(connectedUsers.keys());
    socket.emit('onlineUsers', onlineUsers);
  });

  // Handle sending messages
  socket.on('sendMessage', async (data) => {
    try {
      const { sender, recipient, content, messageType = 'text' } = data;
      
      // Save message to database
      const message = new Message({
        sender,
        recipient,
        content,
        messageType,
        timestamp: new Date()
      });
      
      await message.save();

      // Send to recipient if online
      const recipientSocketId = connectedUsers.get(recipient);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('newMessage', {
          id: message._id,
          sender,
          recipient,
          content,
          timestamp: message.timestamp,
          messageType
        });
      }

      // Confirm to sender
      socket.emit('messageDelivered', {
        id: message._id,
        sender,
        recipient,
        content,
        timestamp: message.timestamp,
        messageType
      });

    } catch (error) {
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle typing indicators
  socket.on('typing', (data) => {
    const { recipient, isTyping } = data;
    const recipientSocketId = connectedUsers.get(recipient);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('userTyping', {
        username: socket.username,
        isTyping
      });
    }
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    if (socket.username) {
      connectedUsers.delete(socket.username);
      
      // Update user offline status
      await User.findOneAndUpdate(
        { username: socket.username },
        { isOnline: false, lastSeen: new Date() }
      );

      // Notify others about offline status
      socket.broadcast.emit('userOffline', socket.username);
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});