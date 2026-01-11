const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

const buildMonthKeys = () => {
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    months.push({ key, label: date.toLocaleString('en-US', { month: 'short' }) });
  }
  return months;
};

router.get('/summary', requireAdmin, async (_req, res) => {
  try {
    const [totalProducts, totalCustomers, totalTransactions, revenueAgg] = await Promise.all([
      Product.countDocuments(),
      Customer.countDocuments(),
      Order.countDocuments(),
      Order.aggregate([
        { $match: { paymentStatus: 'Paid' } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
    ]);
    const totalRevenue = revenueAgg?.[0]?.total || 0;
    res.json({ totalRevenue, totalCustomers, totalTransactions, totalProducts });
  } catch (err) {
    console.error('Error building summary', err);
    res.status(500).json({ message: 'Failed to load summary' });
  }
});

router.get('/sales', requireAdmin, async (_req, res) => {
  try {
    const months = buildMonthKeys();
    const orders = await Order.find().select('total createdAt paymentStatus').lean();
    const totals = months.reduce((acc, m) => ({ ...acc, [m.key]: 0 }), {});
    orders.forEach((order) => {
      if (order.paymentStatus !== 'Paid' || !order.createdAt) return;
      const created = new Date(order.createdAt);
      if (Number.isNaN(created.getTime())) return;
      const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
      if (key in totals) totals[key] += order.total;
    });
    res.json({
      labels: months.map((m) => m.label),
      values: months.map((m) => Number(totals[m.key].toFixed(2))),
    });
  } catch (err) {
    console.error('Error building sales chart', err);
    res.status(500).json({ message: 'Failed to load sales' });
  }
});

router.get('/profile', requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('Error fetching profile', err);
    res.status(500).json({ message: 'Failed to load profile' });
  }
});

router.put('/profile', requireAdmin, async (req, res) => {
  try {
    const {
      name,
      email,
      firstName,
      lastName,
      phone,
      country,
      address,
      gender,
      birthDate,
      avatarUrl,
      companyLogoUrl,
    } = req.body;
    const update = {
      name,
      email,
      firstName,
      lastName,
      phone,
      country,
      address,
      gender,
      birthDate,
      avatarUrl,
      companyLogoUrl,
    };
    const user = await User.findByIdAndUpdate(req.user.id, update, {
      new: true,
      runValidators: true,
    }).select('-passwordHash');
    res.json(user);
  } catch (err) {
    console.error('Error updating profile', err);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

router.put('/password', requireAdmin, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'Missing password fields' });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const valid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ message: 'Invalid password' });
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: 'Password updated' });
  } catch (err) {
    console.error('Error updating password', err);
    res.status(500).json({ message: 'Failed to update password' });
  }
});

module.exports = router;
