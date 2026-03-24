const express = require('express');

const Review = require('../models/Review');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const REVIEW_TEMPLATES = [
  'Lorem ipsum is simply dummy text of the printing and typesetting industry.',
  'It is a long established fact that a reader will be distracted by readable content.',
  'There are many variations of passages of Lorem Ipsum available.',
  'The quality is good and delivery was smooth. I recommend this item.',
  'Looks exactly as expected. Material feels durable for regular use.',
];

const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const seedReviews = async (count = 8) => {
  const existingCount = await Review.countDocuments();
  if (existingCount > 0) return { created: 0, total: existingCount };

  const [products, customers] = await Promise.all([
    Product.find().select('title imageUrl').lean(),
    Customer.find().select('name address').lean(),
  ]);

  if (!products.length || !customers.length) {
    return { created: 0, total: existingCount };
  }

  const docs = Array.from({ length: count }).map((_, index) => {
    const product = products[index % products.length];
    const customer = customers[(index * 2) % customers.length];
    const rating = [4, 5, 4.5, 3.5, 4][index % 5];
    return {
      product: product._id,
      productName: product.title,
      productImageUrl: product.imageUrl || '',
      customer: customer._id,
      customerName: customer.name,
      customerLocation: customer.address || 'Accra, Ghana',
      rating,
      reviewText: randomFrom(REVIEW_TEMPLATES),
      status: 'pending',
      createdAt: new Date(Date.now() - index * 1000 * 60 * 45),
      updatedAt: new Date(Date.now() - index * 1000 * 60 * 45),
    };
  });

  await Review.insertMany(docs);
  const total = await Review.countDocuments();
  return { created: docs.length, total };
};

router.post('/seed', requireAdmin, async (req, res) => {
  try {
    const count = Number.isFinite(Number(req.body?.count)) ? Number(req.body.count) : 8;
    const data = await seedReviews(Math.min(Math.max(count, 1), 40));
    res.json(data);
  } catch (err) {
    console.error('Error seeding reviews', err);
    res.status(500).json({ message: 'Failed to seed reviews' });
  }
});

router.get('/', requireAdmin, async (req, res) => {
  try {
    const page = Number.isFinite(Number(req.query.page)) ? Math.max(Number(req.query.page), 1) : 1;
    const limit = Number.isFinite(Number(req.query.limit)) ? Math.min(Math.max(Number(req.query.limit), 1), 50) : 10;
    const status = (req.query.status || 'all').toLowerCase();
    const sortBy = (req.query.sortBy || 'mostRecent').toString();
    const search = (req.query.search || '').toString().trim();

    const filter = {};
    if (status !== 'all') filter.status = status;
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      filter.$or = [
        { productName: regex },
        { customerName: regex },
        { customerLocation: regex },
        { reviewText: regex },
      ];
    }

    let sort = { createdAt: -1 };
    if (sortBy === 'highestRating') sort = { rating: -1, createdAt: -1 };
    if (sortBy === 'lowestRating') sort = { rating: 1, createdAt: -1 };

    const [data, total] = await Promise.all([
      Review.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Review.countDocuments(filter),
    ]);

    res.json({ data, total, page, limit });
  } catch (err) {
    console.error('Error fetching reviews', err);
    res.status(500).json({ message: 'Failed to fetch reviews' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const {
      productId,
      productName,
      productImageUrl,
      customerId,
      customerName,
      customerLocation,
      rating,
      reviewText,
      status,
    } = req.body;

    const product = productId ? await Product.findById(productId).select('title imageUrl').lean() : null;
    const customer = customerId ? await Customer.findById(customerId).select('name address').lean() : null;

    const review = await Review.create({
      product: product?._id || productId || null,
      productName: product?.title || productName || 'Unknown Product',
      productImageUrl: product?.imageUrl || productImageUrl || '',
      customer: customer?._id || customerId || null,
      customerName: customer?.name || customerName || 'Guest Customer',
      customerLocation: customer?.address || customerLocation || '',
      rating: Number(rating) || 4,
      reviewText: reviewText || 'No review text provided.',
      status: status || 'pending',
    });

    res.status(201).json(review);
  } catch (err) {
    console.error('Error creating review', err);
    res.status(500).json({ message: 'Failed to create review' });
  }
});

router.put('/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved', 'cancelled', 'pending'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const review = await Review.findByIdAndUpdate(
      req.params.id,
      {
        status,
        moderatedAt: status === 'pending' ? null : new Date(),
        moderatedBy: status === 'pending' ? null : req.user?.id || null,
      },
      { new: true, runValidators: true }
    );

    if (!review) return res.status(404).json({ message: 'Review not found' });
    res.json(review);
  } catch (err) {
    console.error('Error updating review status', err);
    res.status(500).json({ message: 'Failed to update review status' });
  }
});

module.exports = router;
