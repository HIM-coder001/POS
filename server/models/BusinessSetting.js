const mongoose = require('mongoose');

const businessSettingSchema = new mongoose.Schema({
  name: { type: String, default: 'RetailEdge Main Store' },
  address: { type: String, default: 'Nairobi Central District, Tom Mboya St' },
  phone: { type: String, default: '+254 700 000 000' },
  kraPin: { type: String, default: 'A001234567Z' }, // Tax Identification Number
  receiptHeader: { type: String, default: 'Thank you for choosing RetailEdge!' },
  receiptFooter: { type: String, default: 'Goods once sold cannot be returned. Thank you!' },
  currency: { type: String, default: 'KES' },
  logoUrl: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('BusinessSetting', businessSettingSchema);
