const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true, trim: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    customerName: { type: String, required: true, trim: true },
    customerEmail: { type: String, default: '' },
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        title: { type: String, default: '' },
        price: { type: Number, default: 0 },
        qty: { type: Number, default: 1 },
        imageUrl: { type: String, default: '' },
      },
    ],
    total: { type: Number, required: true, min: 0 },
    paymentStatus: { type: String, enum: ['Paid', 'Unpaid'], default: 'Paid' },
    status: { type: String, enum: ['Shipping', 'Completed', 'Cancelled'], default: 'Shipping' },
    trackingId: { type: String, default: '' },
    origin: { type: String, default: '' },
    destination: { type: String, default: '' },
    courierName: { type: String, default: '' },
    eta: { type: String, default: '' },
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

module.exports = mongoose.model('Order', OrderSchema);
