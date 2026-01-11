const express = require('express');
const Customer = require('../models/Customer');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const customers = await Customer.find().sort({ createdAt: -1 });
    res.json(customers);
  } catch (err) {
    console.error('Error fetching customers', err);
    res.status(500).json({ message: 'Failed to fetch customers' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      purchasesTotal,
      orderCount,
      address,
      status,
      avatarUrl,
      clientMeta,
    } = req.body;
    const customer = await Customer.create({
      name,
      email,
      phone,
      purchasesTotal: Number.isFinite(Number(purchasesTotal)) ? Number(purchasesTotal) : 0,
      orderCount: Number.isFinite(Number(orderCount)) ? Number(orderCount) : 0,
      address,
      avatarUrl,
      status: status || 'active',
      clientMeta: clientMeta || {},
    });
    res.status(201).json(customer);
  } catch (err) {
    console.error('Error creating customer', err);
    res.status(500).json({ message: 'Failed to create customer' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.json(customer);
  } catch (err) {
    console.error('Error fetching customer', err);
    res.status(500).json({ message: 'Failed to fetch customer' });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { name, email, phone, purchasesTotal, orderCount, address, status, avatarUrl } =
      req.body;
    const update = {
      name,
      email,
      phone,
      purchasesTotal: Number.isFinite(Number(purchasesTotal)) ? Number(purchasesTotal) : 0,
      orderCount: Number.isFinite(Number(orderCount)) ? Number(orderCount) : 0,
      address,
      avatarUrl,
      status,
    };
    const customer = await Customer.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.json(customer);
  } catch (err) {
    console.error('Error updating customer', err);
    res.status(500).json({ message: 'Failed to update customer' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const deleted = await Customer.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Error deleting customer', err);
    res.status(500).json({ message: 'Failed to delete customer' });
  }
});

module.exports = router;
