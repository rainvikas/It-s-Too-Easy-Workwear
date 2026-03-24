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
    paymentStatus: { type: String, enum: ['Paid', 'Unpaid'], default: 'Unpaid' },
    paymentMethod: { type: String, enum: ['card', 'bank', 'cash'], default: 'card' },
    paymentProvider: { type: String, enum: ['none', 'manual', 'stripe'], default: 'none' },
    stripeCheckoutSessionId: { type: String, default: null },
    paymentTransactionId: { type: String, default: '' },
    paymentCapturedAt: { type: Date, default: null },
    paymentAmount: { type: Number, default: 0, min: 0 },
    paymentCurrency: { type: String, default: 'AUD' },
    paymentFailureReason: { type: String, default: '' },
    status: {
      type: String,
      enum: ['Pending Payment', 'Shipping', 'Completed', 'Cancelled', 'Returned'],
      default: 'Shipping',
    },
    serviceRequest: {
      type: { type: String, enum: ['cancel', 'return', ''], default: '' },
      reason: { type: String, default: '' },
      status: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
      requestedAt: { type: Date, default: null },
      resolvedAt: { type: Date, default: null },
      resolution: { type: String, default: '' },
      resolvedBy: { type: String, default: '' },
    },
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

OrderSchema.index({ stripeCheckoutSessionId: 1 });

module.exports = mongoose.model('Order', OrderSchema);
