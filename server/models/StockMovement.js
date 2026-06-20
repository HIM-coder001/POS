const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String },
  type: {
    type: String,
    enum: ['sale', 'purchase', 'adjustment', 'refund'],
    required: true,
  },
  // positive = stock in, negative = stock out
  quantity: { type: Number, required: true },
  balanceBefore: { type: Number },
  balanceAfter: { type: Number },
  reference: { type: String }, // receipt number, PO number, etc.
  reason: { type: String },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  performedByName: { type: String },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('StockMovement', stockMovementSchema);
