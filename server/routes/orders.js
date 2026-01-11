const express = require('express');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const requireAdmin = require('../middleware/requireAdmin');

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
      paymentStatus: paymentStatus || 'Paid',
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
    const { paymentStatus, status, total, trackingId, origin, destination, courierName, eta } =
      req.body;
    const update = {};
    if (paymentStatus) update.paymentStatus = paymentStatus;
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
