const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema(
  {
    sku: { type: String, default: '' },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, default: 0, min: 0 },
    color: { type: String, default: '' },
    sizes: { type: [String], default: [] },
    category: { type: String, default: 'general' },
    status: { type: String, enum: ['available', 'out-of-stock'], default: 'available' },
    imageUrl: { type: String, default: '' },
    inStock: { type: Boolean, default: true },
    clientMeta: {
      country: { type: String, default: '' },
      timezone: { type: String, default: '' },
      locale: { type: String, default: '' },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', ProductSchema);
