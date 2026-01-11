const mongoose = require('mongoose');

const ErrorLogSchema = new mongoose.Schema(
  {
    message: { type: String, required: true },
    status: { type: Number, default: 0 },
    endpoint: { type: String, default: '' },
    method: { type: String, default: '' },
    source: { type: String, default: 'admin' },
    country: { type: String, default: '' },
    timezone: { type: String, default: '' },
    locale: { type: String, default: '' },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ErrorLog', ErrorLogSchema);
