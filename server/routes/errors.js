const express = require('express');
const ErrorLog = require('../models/ErrorLog');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

router.get('/', requireAdmin, async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
    const skip = (page - 1) * limit;
    const [total, data] = await Promise.all([
      ErrorLog.countDocuments(),
      ErrorLog.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
    ]);
    res.json({ data, total, page, limit });
  } catch (err) {
    console.error('Error fetching error logs', err);
    res.status(500).json({ message: 'Failed to fetch error logs' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { message, status, endpoint, method, source, country, timezone, locale, lat, lng } =
      req.body;
    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }
    const log = await ErrorLog.create({
      message,
      status: Number(status) || 0,
      endpoint: endpoint || '',
      method: method || '',
      source: source || 'admin',
      country: country || '',
      timezone: timezone || '',
      locale: locale || '',
      lat: typeof lat === 'number' ? lat : Number(lat),
      lng: typeof lng === 'number' ? lng : Number(lng),
    });
    res.status(201).json(log);
  } catch (err) {
    console.error('Error creating error log', err);
    res.status(500).json({ message: 'Failed to create error log' });
  }
});

module.exports = router;
