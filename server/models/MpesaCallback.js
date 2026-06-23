const mongoose = require('mongoose');

/**
 * MpesaCallback — persists STK Push payment status to MongoDB.
 * Replaces the in-memory Map in mpesa.js so payment state survives
 * server restarts, crashes, and multi-process deployments.
 *
 * TTL index auto-deletes documents older than 1 hour.
 */
const mpesaCallbackSchema = new mongoose.Schema({
  checkoutRequestId: { type: String, required: true, unique: true, index: true },
  merchantRequestId: { type: String },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed', 'cancelled'],
    default: 'pending',
  },
  mpesaRef:    { type: String },   // MpesaReceiptNumber on success
  amount:      { type: Number },
  phone:       { type: String },
  resultDesc:  { type: String },
  resultCode:  { type: Number },
  createdAt:   { type: Date, default: Date.now, expires: 3600 }, // TTL: 1 hour
});

module.exports = mongoose.model('MpesaCallback', mpesaCallbackSchema);
