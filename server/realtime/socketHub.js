let ioServer = null;

const roomForConversation = (conversationId) => `conversation:${String(conversationId || '')}`;

const setSocketServer = (io) => {
  ioServer = io;
};

const emitConversationMessage = (conversationId, payload) => {
  if (!ioServer || !conversationId) return;
  ioServer.to(roomForConversation(conversationId)).emit('conversation:message', payload);
};

module.exports = {
  setSocketServer,
  emitConversationMessage,
  roomForConversation,
};

