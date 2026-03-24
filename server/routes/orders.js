const express = require('express');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Conversation = require('../models/Conversation');
const requireAdmin = require('../middleware/requireAdmin');
const { emitConversationMessage } = require('../realtime/socketHub');

const router = express.Router();

const buildOrderNumber = () => `ORD-${Date.now().toString().slice(-6)}`;

router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    const orders = await Order.find(filter).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.error('Error fetching orders', err);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const {
      orderNumber,
      customerId,
      customerName,
      customerEmail,
      items,
      total,
      paymentStatus,
      paymentMethod,
      paymentProvider,
      paymentCapturedAt,
      paymentAmount,
      paymentCurrency,
      paymentTransactionId,
      status,
      trackingId,
      origin,
      destination,
      courierName,
      eta,
      clientMeta,
    } = req.body;

    let resolvedCustomerName = customerName;
    let resolvedCustomerEmail = customerEmail;
    if (customerId) {
      const customer = await Customer.findById(customerId);
      if (customer) {
        resolvedCustomerName = customer.name;
        resolvedCustomerEmail = customer.email;
      }
    }

    const order = await Order.create({
      orderNumber: orderNumber || buildOrderNumber(),
      customer: customerId || undefined,
      customerName: resolvedCustomerName || 'Guest',
      customerEmail: resolvedCustomerEmail || '',
      items: Array.isArray(items) ? items : [],
      total: Number.isFinite(Number(total)) ? Number(total) : 0,
      paymentStatus: paymentStatus || 'Unpaid',
      paymentMethod: ['card', 'bank', 'cash'].includes(String(paymentMethod || '').toLowerCase())
        ? String(paymentMethod).toLowerCase()
        : 'cash',
      paymentProvider: ['none', 'manual', 'stripe'].includes(String(paymentProvider || '').toLowerCase())
        ? String(paymentProvider).toLowerCase()
        : 'manual',
      paymentCapturedAt: paymentCapturedAt ? new Date(paymentCapturedAt) : null,
      paymentAmount: Number.isFinite(Number(paymentAmount)) ? Number(paymentAmount) : 0,
      paymentCurrency: String(paymentCurrency || 'AUD').toUpperCase(),
      paymentTransactionId: paymentTransactionId || '',
      status: status || 'Shipping',
      trackingId: trackingId || '',
      origin: origin || '',
      destination: destination || '',
      courierName: courierName || '',
      eta: eta || '',
      clientMeta: clientMeta || {},
    });

    res.status(201).json(order);
  } catch (err) {
    console.error('Error creating order', err);
    res.status(500).json({ message: 'Failed to create order' });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { paymentStatus, paymentMethod, status, total, trackingId, origin, destination, courierName, eta } =
      req.body;
    const update = {};
    if (paymentStatus) update.paymentStatus = paymentStatus;
    if (paymentMethod && ['card', 'bank', 'cash'].includes(String(paymentMethod).toLowerCase())) {
      update.paymentMethod = String(paymentMethod).toLowerCase();
    }
    if (status) update.status = status;
    if (total !== undefined) update.total = Number(total);
    if (trackingId !== undefined) update.trackingId = trackingId;
    if (origin !== undefined) update.origin = origin;
    if (destination !== undefined) update.destination = destination;
    if (courierName !== undefined) update.courierName = courierName;
    if (eta !== undefined) update.eta = eta;
    const order = await Order.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json(order);
  } catch (err) {
    console.error('Error updating order', err);
    res.status(500).json({ message: 'Failed to update order' });
  }
});

router.put('/:id/request', requireAdmin, async (req, res) => {
  try {
    const decision = (req.body?.decision || '').toString().trim().toLowerCase();
    const note = (req.body?.note || '').toString().trim();
    const conversationId = (req.body?.conversationId || '').toString().trim();

    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ message: 'Decision must be approve or reject' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const requestType = (order.serviceRequest?.type || '').toString();
    const requestStatus = (order.serviceRequest?.status || '').toString();
    if (!requestType || requestStatus !== 'pending') {
      return res.status(400).json({ message: 'No pending request exists for this order' });
    }

    const resolvedStatus = decision === 'approve' ? 'approved' : 'rejected';
    const resolvedAt = new Date();
    order.serviceRequest.status = resolvedStatus;
    order.serviceRequest.resolvedAt = resolvedAt;
    order.serviceRequest.resolution = note;
    order.serviceRequest.resolvedBy = req.user?.name || 'Admin';

    if (decision === 'approve') {
      if (requestType === 'cancel') order.status = 'Cancelled';
      if (requestType === 'return') order.status = 'Returned';
    }

    await order.save();

    let conversation = null;
    if (conversationId) {
      conversation = await Conversation.findById(conversationId);
    }
    if (!conversation && order.customer) {
      conversation = await Conversation.findOne({ customer: order.customer });
    }
    if (!conversation && order.customerEmail) {
      conversation = await Conversation.findOne({ customerEmail: order.customerEmail.toLowerCase() });
    }

    let adminMessage = null;
    if (conversation) {
      for (let index = conversation.messages.length - 1; index >= 0; index -= 1) {
        const message = conversation.messages[index];
        if (
          String(message?.requestMeta?.orderId || '') === String(order._id) &&
          message?.requestMeta?.type === requestType &&
          message?.requestMeta?.status === 'pending'
        ) {
          message.requestMeta.status = resolvedStatus;
          message.requestMeta.handledAt = resolvedAt;
          message.requestMeta.handledBy = req.user?.name || 'Admin';
          message.requestMeta.resolution = note;
          break;
        }
      }

      const actionWord = requestType === 'cancel' ? 'Cancellation' : 'Return';
      const adminText = `Order ${order.orderNumber}: ${actionWord} request ${decision === 'approve' ? 'approved' : 'rejected'}${
        note ? ` - ${note}` : ''
      }`;
      adminMessage = {
        sender: 'admin',
        text: adminText,
        sentAt: resolvedAt,
        requestMeta: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          type: requestType,
          status: resolvedStatus,
          handledAt: resolvedAt,
          handledBy: req.user?.name || 'Admin',
          resolution: note,
        },
      };

      conversation.messages.push(adminMessage);
      conversation.lastMessageText = adminText;
      conversation.lastMessageAt = resolvedAt;
      await conversation.save();
      const emittedMessage = conversation.messages[conversation.messages.length - 1];
      emitConversationMessage(conversation._id, {
        conversationId: String(conversation._id),
        message: emittedMessage,
        preview: {
          _id: conversation._id,
          customer: conversation.customer,
          customerName: conversation.customerName,
          customerEmail: conversation.customerEmail,
          customerAvatarUrl: conversation.customerAvatarUrl,
          customerLocation: conversation.customerLocation,
          customerStatus: conversation.customerStatus,
          unreadForAdmin: conversation.unreadForAdmin,
          lastMessageText: conversation.lastMessageText,
          lastMessageAt: conversation.lastMessageAt,
          totalMessages: conversation.messages?.length || 0,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
        },
      });
    }

    res.json({
      message: `Request ${decision === 'approve' ? 'approved' : 'rejected'} successfully`,
      order,
      serviceRequest: order.serviceRequest,
      conversationId: conversation?._id || null,
      adminMessage,
    });
  } catch (err) {
    console.error('Error resolving order request', err);
    res.status(500).json({ message: 'Failed to resolve order request' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const deleted = await Order.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Error deleting order', err);
    res.status(500).json({ message: 'Failed to delete order' });
  }
});

module.exports = router;
