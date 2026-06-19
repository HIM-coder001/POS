const mongoose = require('mongoose');

const purchaseHistorySchema = new mongoose.Schema({
  saleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
  amount: Number,
  items: String,
  date: { type: Date, default: Date.now },
});

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  loyaltyPoints: { type: Number, default: 0 },
  totalSpend: { type: Number, default: 0 },
  totalVisits: { type: Number, default: 0 },
  tier: {
    type: String,
    enum: ['Bronze', 'Silver', 'Gold', 'Platinum'],
    default: 'Bronze',
  },
  purchaseHistory: [purchaseHistorySchema],
  lastPurchase: { type: Date },
  branch: { type: String, default: 'Nairobi Main Branch' },
  notes: { type: String },
}, { timestamps: true });

// Update tier based on points
customerSchema.pre('save', function (next) {
  if (this.loyaltyPoints >= 2000) this.tier = 'Platinum';
  else if (this.loyaltyPoints >= 1000) this.tier = 'Gold';
  else if (this.loyaltyPoints >= 400) this.tier = 'Silver';
  else this.tier = 'Bronze';
  next();
});

module.exports = mongoose.model('Customer', customerSchema);
