const express = require('express');

const Conversation = require('../models/Conversation');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const requireAdmin = require('../middleware/requireAdmin');
const { emitConversationMessage } = require('../realtime/socketHub');

const router = express.Router();

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const messageTemplate = [
  'Hi, I want to make enquiries about your product.',
  'Can I get discount for bulk quantity?',
  'What is the expected delivery timeline?',
  'Please share available sizes and stock.',
];

const toPreview = (conversation) => {
  const last = conversation.messages?.[conversation.messages.length - 1];
  return {
    _id: conversation._id,
    customer: conversation.customer,
    customerName: conversation.customerName,
    customerEmail: conversation.customerEmail,
    customerAvatarUrl: conversation.customerAvatarUrl,
    customerLocation: conversation.customerLocation,
    customerStatus: conversation.customerStatus,
    unreadForAdmin: conversation.unreadForAdmin,
    lastMessageText: conversation.lastMessageText || last?.text || '',
    lastMessageAt: conversation.lastMessageAt || last?.sentAt || conversation.updatedAt,
    totalMessages: conversation.messages?.length || 0,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
};

const ensureSeedConversations = async () => {
  const existingCount = await Conversation.countDocuments();
  if (existingCount > 0) return { created: 0, total: existingCount };

  const [customers, products] = await Promise.all([
    Customer.find().select('name email avatarUrl address').lean(),
    Product.find().select('title imageUrl price quantity').lean(),
  ]);

  if (!customers.length) return { created: 0, total: existingCount };

  const docs = customers.slice(0, 10).map((customer, idx) => {
    const product = products.length ? products[idx % products.length] : null;
    const firstMessage = {
      sender: 'customer',
      text: messageTemplate[idx % messageTemplate.length],
      sentAt: new Date(Date.now() - idx * 1000 * 60 * 35),
      productCard: product
        ? {
            title: product.title,
            imageUrl: product.imageUrl || '',
            price: Number(product.price) || 0,
            stockLabel: `${Number(product.quantity) || 0} In Stock`,
          }
        : undefined,
    };

    return {
      customer: customer._id,
      customerName: customer.name,
      customerEmail: customer.email || '',
      customerAvatarUrl: customer.avatarUrl || '',
      customerLocation: customer.address || '',
      customerStatus: idx % 3 === 0 ? 'online' : 'offline',
      unreadForAdmin: idx % 2 === 0 ? 2 : 0,
      lastMessageText: firstMessage.text,
      lastMessageAt: firstMessage.sentAt,
      messages: [firstMessage],
      createdAt: firstMessage.sentAt,
      updatedAt: firstMessage.sentAt,
    };
  });

  await Conversation.insertMany(docs);
  const total = await Conversation.countDocuments();
  return { created: docs.length, total };
};

router.post('/seed', requireAdmin, async (_req, res) => {
  try {
    const data = await ensureSeedConversations();
    res.json(data);
  } catch (err) {
    console.error('Error seeding conversations', err);
    res.status(500).json({ message: 'Failed to seed messages' });
  }
});

router.get('/conversations', requireAdmin, async (req, res) => {
  try {
    const search = (req.query.search || '').toString().trim();
    const filter = {};

    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      filter.$or = [
        { customerName: regex },
        { customerEmail: regex },
        { customerLocation: regex },
        { lastMessageText: regex },
      ];
    }

    const conversations = await Conversation.find(filter)
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .lean();

    res.json(conversations.map(toPreview));
  } catch (err) {
    console.error('Error fetching conversations', err);
    res.status(500).json({ message: 'Failed to fetch conversations' });
  }
});

router.post('/conversations', requireAdmin, async (req, res) => {
  try {
    const {
      customerId,
      customerName,
      customerEmail,
      customerAvatarUrl,
      customerLocation,
      initialMessage,
    } = req.body;

    let customer = null;
    if (customerId) {
      customer = await Customer.findById(customerId).select('name email avatarUrl address').lean();
    }

    if (customer?._id) {
      const existing = await Conversation.findOne({ customer: customer._id });
      if (existing) {
        return res.json(existing);
      }
    }

    const messageText = (initialMessage || 'Hello').toString().trim();
    const now = new Date();

    const conversation = await Conversation.create({
      customer: customer?._id || null,
      customerName: customer?.name || customerName || 'New Customer',
      customerEmail: customer?.email || customerEmail || '',
      customerAvatarUrl: customer?.avatarUrl || customerAvatarUrl || '',
      customerLocation: customer?.address || customerLocation || '',
      customerStatus: 'online',
      unreadForAdmin: 0,
      lastMessageText: messageText,
      lastMessageAt: now,
      messages: [
        {
          sender: 'admin',
          text: messageText,
          sentAt: now,
        },
      ],
    });

    res.status(201).json(conversation);
  } catch (err) {
    console.error('Error creating conversation', err);
    res.status(500).json({ message: 'Failed to create conversation' });
  }
});

router.get('/conversations/:id', requireAdmin, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id).lean();
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });
    res.json(conversation);
  } catch (err) {
    console.error('Error fetching conversation', err);
    res.status(500).json({ message: 'Failed to fetch conversation' });
  }
});

router.get('/conversations/:id/messages', requireAdmin, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id).lean();
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    res.json({
      conversation: toPreview(conversation),
      messages: conversation.messages || [],
    });
  } catch (err) {
    console.error('Error fetching messages', err);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

router.post('/conversations/:id/messages', requireAdmin, async (req, res) => {
  try {
    const text = (req.body?.text || '').toString().trim();
    const sender = req.body?.sender === 'customer' ? 'customer' : 'admin';
    if (!text) return res.status(400).json({ message: 'Message text is required' });

    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    const message = {
      sender,
      text,
      sentAt: new Date(),
    };

    if (req.body?.productId) {
      const product = await Product.findById(req.body.productId).select('title imageUrl price quantity').lean();
      if (product) {
        message.productCard = {
          title: product.title,
          imageUrl: product.imageUrl || '',
          price: Number(product.price) || 0,
          stockLabel: `${Number(product.quantity) || 0} In Stock`,
        };
      }
    }

    conversation.messages.push(message);
    conversation.lastMessageText = message.text;
    conversation.lastMessageAt = message.sentAt;
    if (sender === 'customer') {
      conversation.unreadForAdmin += 1;
    }
    await conversation.save();

    const emittedMessage = conversation.messages[conversation.messages.length - 1];
    const preview = toPreview(conversation);
    emitConversationMessage(conversation._id, {
      conversationId: String(conversation._id),
      message: emittedMessage,
      preview,
    });

    res.status(201).json({ message: emittedMessage });
  } catch (err) {
    console.error('Error sending message', err);
    res.status(500).json({ message: 'Failed to send message' });
  }
});

router.put('/conversations/:id/read', requireAdmin, async (req, res) => {
  try {
    const conversation = await Conversation.findByIdAndUpdate(
      req.params.id,
      { unreadForAdmin: 0 },
      { new: true }
    ).lean();

    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });
    res.json(toPreview(conversation));
  } catch (err) {
    console.error('Error updating read state', err);
    res.status(500).json({ message: 'Failed to update read state' });
  }
});

module.exports = router;
