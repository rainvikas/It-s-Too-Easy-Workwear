const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, default: '', trim: true, lowercase: true },
    phone: { type: String, default: '' },
    purchasesTotal: { type: Number, default: 0 },
    orderCount: { type: Number, default: 0 },
    address: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
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

module.exports = mongoose.model('Customer', CustomerSchema);
