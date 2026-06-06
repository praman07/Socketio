require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer Storage Setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = './uploads/';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Append extension
  }
});
const upload = multer({ storage: storage });
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const usersRoutes = require('./routes/users');
const serversRoutes = require('./routes/servers');

const User = require('./models/User');
const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/servers', serversRoutes);

// Static folder for images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Local Upload Endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const fileUrl = `http://localhost:5000/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const io = new Server(server, {
  cors: {
    origin: '*', // For dev
    methods: ['GET', 'POST']
  }
});

// Middleware to authenticate socket
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded.user;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

const onlineUsers = new Map(); // userId -> socketId

io.on('connection', async (socket) => {
  console.log('User connected:', socket.user.id);
  onlineUsers.set(socket.user.id, socket.id);

  // Update status to online
  await User.findByIdAndUpdate(socket.user.id, { status: 'online' });
  io.emit('userStatusUpdate', { userId: socket.user.id, status: 'online' });

  // Join channel rooms
  socket.on('joinChannels', (channelIds) => {
    channelIds.forEach(id => socket.join(id));
  });

  // Private Message
  socket.on('privateMessage', async (data) => {
    const { receiverId, content, fileUrl } = data;
    const msg = new Message({
      sender: socket.user.id,
      receiver: receiverId,
      content,
      fileUrl
    });
    await msg.save();
    await msg.populate('sender', 'username displayName profilePicture');

    // Send to receiver if online
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('newMessage', msg);
    }
    // Send back to sender
    socket.emit('newMessage', msg);
  });

  // Channel Message
  socket.on('channelMessage', async (data) => {
    const { channelId, content, fileUrl } = data;
    const msg = new Message({
      sender: socket.user.id,
      channel: channelId,
      content,
      fileUrl
    });
    await msg.save();
    await msg.populate('sender', 'username displayName profilePicture');

    io.to(channelId).emit('newChannelMessage', msg);
  });

  // Typing indicator
  socket.on('typing', (data) => {
    const receiverSocketId = onlineUsers.get(data.receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('typing', { senderId: socket.user.id, isGroup: false });
    }
  });

  socket.on('channelTyping', (data) => {
    socket.to(data.channelId).emit('typing', { senderId: socket.user.id, channelId: data.channelId, isChannel: true });
  });

  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.user.id);
    onlineUsers.delete(socket.user.id);
    await User.findByIdAndUpdate(socket.user.id, { status: 'offline', lastSeen: Date.now() });
    io.emit('userStatusUpdate', { userId: socket.user.id, status: 'offline', lastSeen: Date.now() });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
