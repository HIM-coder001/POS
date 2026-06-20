const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: String,
  sku: String,
  price: Number,
  quantity: { type: Number, required: true, min: 1 },
  subtotal: Number,
});

const saleSchema = new mongoose.Schema({
  receiptNumber: { type: String, unique: true },
  items: [saleItemSchema],
  subtotal: { type: Number, required: true },
  vatAmount: { type: Number, default: 0 },
  vatRate: { type: Number, default: 16 },
  discount: { type: Number, default: 0 },
  grandTotal: { type: Number, required: true },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'mpesa', 'split'],
    required: true,
  },
  mpesaRef: { type: String }, // M-Pesa transaction reference
  splitPayments: [{
    method: { type: String, enum: ['cash', 'card', 'mpesa'] },
    amount: { type: Number, required: true },
    ref: { type: String }
  }],
  cashier: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cashierName: String,
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  customerName: String,
  branch: { type: String, default: 'Nairobi Main Branch' },
  status: { type: String, enum: ['completed', 'refunded', 'voided'], default: 'completed' },
  refundedAt: { type: Date },
  refundReason: { type: String },
}, { timestamps: true });

// Auto-generate receipt number
saleSchema.pre('save', async function (next) {
  if (!this.receiptNumber) {
    const count = await this.constructor.countDocuments();
    this.receiptNumber = `POS-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Sale', saleSchema);
