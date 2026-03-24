const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const app = require('./app');
const { setSocketServer, roomForConversation } = require('./realtime/socketHub');
const PORT = process.env.PORT || 4000;
const { MONGO_URI } = process.env;
if (!MONGO_URI) {
  console.error('MONGO_URI is not set in .env');
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    const server = http.createServer(app);
    const io = new Server(server, {
      cors: {
        origin: '*',
      },
    });

    io.on('connection', (socket) => {
      socket.on('conversation:join', (payload = {}) => {
        const conversationId = String(payload.conversationId || '').trim();
        if (!conversationId) return;
        socket.join(roomForConversation(conversationId));
      });

      socket.on('conversation:leave', (payload = {}) => {
        const conversationId = String(payload.conversationId || '').trim();
        if (!conversationId) return;
        socket.leave(roomForConversation(conversationId));
      });
    });

    setSocketServer(io);
    server.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1);
  });
