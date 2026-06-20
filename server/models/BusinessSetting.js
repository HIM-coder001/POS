const mongoose = require('mongoose');

const businessSettingSchema = new mongoose.Schema({
  // Business Information
  name:           { type: String,  default: 'Beauty Park' },
  address:        { type: String,  default: 'Nairobi' },
  phone:          { type: String,  default: '+254 7XX XXX XXX' },
  email:          { type: String,  default: 'info@business.co.ke' },
  kraPin:         { type: String,  default: 'A001234567Z' },
  industry:       { type: String,  default: 'Clothing & Apparel' },
  logoUrl:        { type: String,  default: '' },

  // Tax & Regional
  currency:       { type: String,  default: 'KES' },
  timezone:       { type: String,  default: 'Africa/Nairobi' },
  vatEnabled:     { type: Boolean, default: true },
  vatRate:        { type: Number,  default: 16 },

  // Receipt
  receiptHeader:  { type: String,  default: 'Thank you for shopping with us!' },
  receiptFooter:  { type: String,  default: 'Goods once sold cannot be returned. Thank you!' },
  receiptShowLogo:{ type: Boolean, default: true },

  // Business Rules
  preventOverselling:          { type: Boolean, default: true },
  requireManagerApprovalRemove:{ type: Boolean, default: false },
  allowDiscounts:              { type: Boolean, default: true },
  requireCustomerOnSale:       { type: Boolean, default: false },
  allowRefunds:                { type: Boolean, default: true },

  // Numbering
  receiptPrefix:   { type: String,  default: 'POS' },
  receiptNextNum:  { type: Number,  default: 1 },

  // Branding / Theme
  brandColor:      { type: String,  default: '#00236f' },
  brandColorName:  { type: String,  default: 'Navy Blue' },

  // Payment Gateways — which methods are enabled at checkout
  gatewayMpesa:    { type: Boolean, default: true  },
  gatewayCash:     { type: Boolean, default: true  },
  gatewayCard:     { type: Boolean, default: true  },
  gatewaySplit:    { type: Boolean, default: true  },
}, { timestamps: true });

module.exports = mongoose.model('BusinessSetting', businessSettingSchema);
