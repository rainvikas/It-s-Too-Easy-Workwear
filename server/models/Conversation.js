const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema(
  {
    sender: { type: String, enum: ['customer', 'admin'], required: true },
    text: { type: String, required: true, trim: true },
    sentAt: { type: Date, default: Date.now },
    productCard: {
      title: { type: String, default: '' },
      imageUrl: { type: String, default: '' },
      price: { type: Number, default: 0 },
      stockLabel: { type: String, default: '' },
    },
    requestMeta: {
      orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
      orderNumber: { type: String, default: '' },
      type: { type: String, enum: ['cancel', 'return', ''], default: '' },
      status: { type: String, enum: ['pending', 'approved', 'rejected', ''], default: '' },
      handledAt: { type: Date, default: null },
      handledBy: { type: String, default: '' },
      resolution: { type: String, default: '' },
    },
  },
  { _id: true }
);

const ConversationSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    customerName: { type: String, required: true, trim: true },
    customerEmail: { type: String, default: '', trim: true, lowercase: true },
    customerAvatarUrl: { type: String, default: '' },
    customerLocation: { type: String, default: '' },
    customerStatus: { type: String, enum: ['online', 'offline'], default: 'offline' },
    unreadForAdmin: { type: Number, default: 0, min: 0 },
    lastMessageText: { type: String, default: '' },
    lastMessageAt: { type: Date, default: Date.now },
    messages: { type: [MessageSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Conversation', ConversationSchema);
