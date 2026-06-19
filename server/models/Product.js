const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  sku: { type: String, required: true, unique: true, uppercase: true },
  category: {
    type: String,
    required: true,
    enum: ['Groceries', 'Electronics', 'Dairy', 'Beverages', 'Bakery', 'Grains', 'FMCG', 'Snacks', 'Other'],
  },
  price: { type: Number, required: true, min: 0 },
  costPrice: { type: Number, default: 0 },
  image: { type: String, default: '' },
  stock: { type: Number, default: 0, min: 0 },
  reorderLevel: { type: Number, default: 10 },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  barcode: { type: String, default: '' },
  unit: { type: String, default: 'unit' }, // e.g., 'unit', 'kg', 'litre'
  vatApplicable: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true },
  branch: { type: String, default: 'Nairobi Main Branch' },
}, { timestamps: true });

// Virtual: stock status
productSchema.virtual('stockStatus').get(function () {
  if (this.stock === 0) return 'out_of_stock';
  if (this.stock <= this.reorderLevel) return 'low_stock';
  return 'in_stock';
});

productSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);
