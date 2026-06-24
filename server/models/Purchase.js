const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema({
  productName: { type: String, required: true, trim: true },
  quantity:    { type: Number, required: true, min: 1 },
  unitCost:    { type: Number, required: true, min: 0.01 },
  subtotal:    { type: Number }, // computed pre-save: quantity * unitCost
});

const purchaseSchema = new mongoose.Schema({
  supplier:     { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  items:        {
    type: [purchaseItemSchema],
    validate: {
      validator: (v) => v.length >= 1,
      message: 'A purchase must have at least one item.',
    },
  },
  purchaseDate: { type: Date, required: true },
  totalCost:    { type: Number, required: true }, // sum of item subtotals, computed pre-save
  createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

// Pre-save hook: compute each item's subtotal, then derive totalCost
purchaseSchema.pre('save', function (next) {
  this.items.forEach((item) => {
    item.subtotal = item.quantity * item.unitCost;
  });
  this.totalCost = this.items.reduce((sum, item) => sum + item.subtotal, 0);
  next();
});

module.exports = mongoose.model('Purchase', purchaseSchema);
