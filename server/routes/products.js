const express = require('express');
const multer = require('multer');
const path = require('path');
const Product = require('../models/Product');

const router = express.Router();

// Simple auth middleware for admin-only operations
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  return next();
};

// Configure multer storage for local uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({ storage });

// POST /api/products - create product with optional image
router.post('/', upload.single('image'), requireAdmin, async (req, res) => {
  try {
    const { title, description, price, sizes, category, inStock } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : '';

    const product = new Product({
      title,
      description,
      price,
      category,
      inStock: inStock !== 'false', // default true
      sizes: Array.isArray(sizes)
        ? sizes
        : typeof sizes === 'string' && sizes.length
        ? sizes.split(',').map((s) => s.trim())
        : [],
      imageUrl,
    });

    const saved = await product.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error('Error creating product', err);
    res.status(500).json({ message: 'Failed to create product' });
  }
});

// GET /api/products - list all products
router.get('/', async (_req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error('Error fetching products', err);
    res.status(500).json({ message: 'Failed to fetch products' });
  }
});

// GET /api/products/:id - single product
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (err) {
    console.error('Error fetching product', err);
    res.status(500).json({ message: 'Failed to fetch product' });
  }
});

// PUT /api/products/:id - update product (with optional image)
router.put('/:id', upload.single('image'), requireAdmin, async (req, res) => {
  try {
    const { title, description, price, sizes, category, inStock } = req.body;
    const update = {
      title,
      description,
      price,
      category,
      inStock: inStock !== 'false',
    };
    if (sizes) {
      update.sizes = Array.isArray(sizes)
        ? sizes
        : typeof sizes === 'string'
        ? sizes.split(',').map((s) => s.trim())
        : [];
    }
    if (req.file) {
      update.imageUrl = `/uploads/${req.file.filename}`;
    }

    const product = await Product.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (err) {
    console.error('Error updating product', err);
    res.status(500).json({ message: 'Failed to update product' });
  }
});

// DELETE /api/products/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Error deleting product', err);
    res.status(500).json({ message: 'Failed to delete product' });
  }
});

module.exports = router;
