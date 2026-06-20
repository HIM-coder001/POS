const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const { protect, adminOnly } = require('../middleware/auth');

// ─── Helper: build date range from query ──────────────────────────────────────
function buildDateRange(from, to, period) {
  let startDate, endDate;
  if (from && to) {
    startDate = new Date(from);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(to);
    endDate.setHours(23, 59, 59, 999);
  } else {
    endDate = new Date();
    startDate = new Date();
    if (period === 'quarter') startDate = new Date(startDate.getFullYear(), startDate.getMonth() - 2, 1);
    else if (period === 'week') { startDate.setDate(startDate.getDate() - 7); startDate.setHours(0, 0, 0, 0); }
    else startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1); // month default
  }
  return { startDate, endDate };
}

// GET /api/reports — full analytics
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { period = 'month', from, to } = req.query;
    const { startDate, endDate } = buildDateRange(from, to, period);
    const dateMatch = { createdAt: { $gte: startDate, $lte: endDate }, status: 'completed' };

    const [revenueStats, categoryBreakdown, bestSellers, peakHours, inventoryVal, dailyTrend, paymentBreakdown] =
      await Promise.all([
        // Revenue & Profit
        Sale.aggregate([
          { $match: dateMatch }, { $unwind: '$items' },
          { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'product' } },
          { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
          { $group: { _id: '$_id', grandTotal: { $first: '$grandTotal' }, vatAmount: { $first: '$vatAmount' }, discount: { $first: '$discount' }, costOfGoods: { $sum: { $multiply: ['$items.quantity', { $ifNull: ['$product.costPrice', 0] }] } } } },
          { $group: { _id: null, totalRevenue: { $sum: '$grandTotal' }, totalVat: { $sum: '$vatAmount' }, totalDiscount: { $sum: '$discount' }, totalCost: { $sum: '$costOfGoods' }, txCount: { $sum: 1 }, avgTransaction: { $avg: '$grandTotal' } } }
        ]),
        // Category breakdown
        Sale.aggregate([
          { $match: dateMatch }, { $unwind: '$items' },
          { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'product' } },
          { $unwind: '$product' },
          { $group: { _id: '$product.category', total: { $sum: '$items.subtotal' }, units: { $sum: '$items.quantity' } } },
          { $sort: { total: -1 } }
        ]),
        // Best sellers
        Sale.aggregate([
          { $match: dateMatch }, { $unwind: '$items' },
          { $group: { _id: '$items.product', name: { $first: '$items.name' }, unitsSold: { $sum: '$items.quantity' }, revenue: { $sum: '$items.subtotal' } } },
          { $sort: { unitsSold: -1 } }, { $limit: 10 }
        ]),
        // Peak hours
        Sale.aggregate([
          { $match: dateMatch },
          { $group: { _id: { $hour: '$createdAt' }, count: { $sum: 1 }, revenue: { $sum: '$grandTotal' } } },
          { $sort: { _id: 1 } }
        ]),
        // Inventory valuation
        Product.aggregate([
          { $match: { isActive: true } },
          { $group: { _id: null, stockValue: { $sum: { $multiply: ['$price', '$stock'] } }, potentialProfit: { $sum: { $multiply: [{ $subtract: ['$price', '$costPrice'] }, '$stock'] } }, lowStockItems: { $sum: { $cond: [{ $lte: ['$stock', '$reorderLevel'] }, 1, 0] } } } }
        ]),
        // Daily trend
        Sale.aggregate([
          { $match: dateMatch }, { $unwind: '$items' },
          { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'product' } },
          { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
          { $group: { _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, saleId: '$_id', grandTotal: '$grandTotal' }, costOfGoods: { $sum: { $multiply: ['$items.quantity', { $ifNull: ['$product.costPrice', 0] }] } } } },
          { $group: { _id: '$_id.date', revenue: { $sum: '$_id.grandTotal' }, profit: { $sum: { $subtract: ['$_id.grandTotal', '$costOfGoods'] } }, count: { $sum: 1 } } },
          { $sort: { _id: 1 } }
        ]),
        // Payment breakdown
        Sale.aggregate([
          { $match: dateMatch },
          { $group: { _id: '$paymentMethod', total: { $sum: '$grandTotal' }, count: { $sum: 1 } } }
        ]),
      ]);

    // Sales count in period
    const salesCount = await Sale.countDocuments(dateMatch);

    res.json({ revenueStats: revenueStats[0] || {}, categoryBreakdown, bestSellers, peakHours, inventoryVal: inventoryVal[0] || {}, dailyTrend, paymentBreakdown, salesCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/reports/sales — paginated sales list for the Sales report tab
router.get('/sales', protect, adminOnly, async (req, res) => {
  try {
    const { from, to, period = 'month', page = 1, limit = 20 } = req.query;
    const { startDate, endDate } = buildDateRange(from, to, period);
    const match = { createdAt: { $gte: startDate, $lte: endDate }, status: 'completed' };
    const total = await Sale.countDocuments(match);
    const sales = await Sale.find(match)
      .populate('cashier', 'name')
      .populate('customer', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    res.json({ sales, total, pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/reports/daily-sales — daily summary grouped by date
router.get('/daily-sales', protect, adminOnly, async (req, res) => {
  try {
    const { from, to, period = 'month' } = req.query;
    const { startDate, endDate } = buildDateRange(from, to, period);
    const rows = await Sale.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate }, status: 'completed' } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, totalRevenue: { $sum: '$grandTotal' }, totalDiscount: { $sum: '$discount' }, totalVat: { $sum: '$vatAmount' }, count: { $sum: 1 }, avgTransaction: { $avg: '$grandTotal' } } },
      { $sort: { _id: -1 } }
    ]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/reports/end-of-day — today's EOD summary
router.get('/end-of-day', protect, adminOnly, async (req, res) => {
  try {
    const { date } = req.query;
    const day = date ? new Date(date) : new Date();
    const start = new Date(day); start.setHours(0, 0, 0, 0);
    const end = new Date(day); end.setHours(23, 59, 59, 999);
    const match = { createdAt: { $gte: start, $lte: end }, status: 'completed' };

    const [summary, byPayment, topProducts] = await Promise.all([
      Sale.aggregate([
        { $match: match },
        { $group: { _id: null, totalRevenue: { $sum: '$grandTotal' }, totalDiscount: { $sum: '$discount' }, totalVat: { $sum: '$vatAmount' }, count: { $sum: 1 }, avgTransaction: { $avg: '$grandTotal' } } }
      ]),
      Sale.aggregate([
        { $match: match },
        { $group: { _id: '$paymentMethod', total: { $sum: '$grandTotal' }, count: { $sum: 1 } } }
      ]),
      Sale.aggregate([
        { $match: match }, { $unwind: '$items' },
        { $group: { _id: '$items.product', name: { $first: '$items.name' }, qty: { $sum: '$items.quantity' }, rev: { $sum: '$items.subtotal' } } },
        { $sort: { qty: -1 } }, { $limit: 5 }
      ])
    ]);

    res.json({ date: day.toISOString().split('T')[0], summary: summary[0] || {}, byPayment, topProducts });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/reports/inventory — inventory report
router.get('/inventory', protect, adminOnly, async (req, res) => {
  try {
    const { search, category, page = 1, limit = 20 } = req.query;
    const query = { isActive: true };
    if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }, { sku: { $regex: search, $options: 'i' } }];
    if (category) query.category = category;
    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .sort({ stock: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    res.json({ products, total, pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/reports/purchases — stock-in cost analysis (derived from products × cost price)
router.get('/purchases', protect, adminOnly, async (req, res) => {
  try {
    const { from, to, period = 'month' } = req.query;
    const { startDate, endDate } = buildDateRange(from, to, period);

    // Purchases = products updated (stock replenished) within the period.
    // We derive from current product cost data grouped by category.
    const [byCategory, topProducts, summary] = await Promise.all([
      // Cost of inventory by category
      Product.aggregate([
        { $match: { isActive: true } },
        { $group: {
          _id: '$category',
          totalUnits: { $sum: '$stock' },
          totalCostValue: { $sum: { $multiply: ['$costPrice', '$stock'] } },
          avgCostPrice: { $avg: '$costPrice' },
          productCount: { $sum: 1 },
        }},
        { $sort: { totalCostValue: -1 } },
      ]),
      // Top products by cost value
      Product.find({ isActive: true })
        .sort({ costPrice: -1 })
        .limit(10)
        .select('name sku category stock costPrice price'),
      // Overall summary
      Product.aggregate([
        { $match: { isActive: true } },
        { $group: {
          _id: null,
          totalStockValue: { $sum: { $multiply: ['$costPrice', '$stock'] } },
          totalRetailValue: { $sum: { $multiply: ['$price', '$stock'] } },
          totalUnits: { $sum: '$stock' },
          totalProducts: { $sum: 1 },
          avgMargin: { $avg: {
            $cond: [
              { $gt: ['$price', 0] },
              { $multiply: [{ $divide: [{ $subtract: ['$price', '$costPrice'] }, '$price'] }, 100] },
              0
            ]
          }},
        }},
      ]),
    ]);

    // Cost of goods sold in period (from sales)
    const cogsSold = await Sale.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate }, status: 'completed' } },
      { $unwind: '$items' },
      { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'prod' } },
      { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
      { $group: {
        _id: null,
        totalCOGS: { $sum: { $multiply: ['$items.quantity', { $ifNull: ['$prod.costPrice', 0] }] } },
        totalRevenue: { $sum: '$items.subtotal' },
        totalUnits: { $sum: '$items.quantity' },
      }},
    ]);

    res.json({
      summary: summary[0] || {},
      cogsSold: cogsSold[0] || { totalCOGS: 0, totalRevenue: 0, totalUnits: 0 },
      byCategory,
      topProducts,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/reports/expenses — expense summary (derived from discounts, VAT, COGS)
router.get('/expenses', protect, adminOnly, async (req, res) => {
  try {
    const { from, to, period = 'month' } = req.query;
    const { startDate, endDate } = buildDateRange(from, to, period);
    const dateMatch = { createdAt: { $gte: startDate, $lte: endDate }, status: 'completed' };

    const [totals, byMethod, daily] = await Promise.all([
      // Expense breakdown from sales
      Sale.aggregate([
        { $match: dateMatch },
        { $unwind: '$items' },
        { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'prod' } },
        { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
        { $group: {
          _id: '$_id',
          grandTotal:   { $first: '$grandTotal' },
          discount:     { $first: '$discount' },
          vatAmount:    { $first: '$vatAmount' },
          cogs: { $sum: { $multiply: ['$items.quantity', { $ifNull: ['$prod.costPrice', 0] }] } },
        }},
        { $group: {
          _id: null,
          totalRevenue:  { $sum: '$grandTotal' },
          totalDiscount: { $sum: '$discount' },
          totalVAT:      { $sum: '$vatAmount' },
          totalCOGS:     { $sum: '$cogs' },
          txCount:       { $sum: 1 },
        }},
      ]),
      // Expenses by payment method (discounts per method)
      Sale.aggregate([
        { $match: dateMatch },
        { $group: {
          _id: '$paymentMethod',
          revenue:  { $sum: '$grandTotal' },
          discount: { $sum: '$discount' },
          vat:      { $sum: '$vatAmount' },
          count:    { $sum: 1 },
        }},
        { $sort: { revenue: -1 } },
      ]),
      // Daily expense trend
      Sale.aggregate([
        { $match: dateMatch },
        { $unwind: '$items' },
        { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'prod' } },
        { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
        { $group: {
          _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, saleId: '$_id', discount: '$discount', vat: '$vatAmount' },
          cogs: { $sum: { $multiply: ['$items.quantity', { $ifNull: ['$prod.costPrice', 0] }] } },
        }},
        { $group: {
          _id: '$_id.date',
          totalDiscount: { $sum: '$_id.discount' },
          totalVAT:      { $sum: '$_id.vat' },
          totalCOGS:     { $sum: '$cogs' },
        }},
        { $sort: { _id: 1 } },
      ]),
    ]);

    res.json({ totals: totals[0] || {}, byMethod, daily });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/reports/pnl — Profit & Loss statement
router.get('/pnl', protect, adminOnly, async (req, res) => {
  try {
    const { from, to, period = 'month' } = req.query;
    const { startDate, endDate } = buildDateRange(from, to, period);
    const dateMatch = { createdAt: { $gte: startDate, $lte: endDate }, status: 'completed' };

    const [income, monthly] = await Promise.all([
      // Full P&L aggregation
      Sale.aggregate([
        { $match: dateMatch },
        { $unwind: '$items' },
        { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'prod' } },
        { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
        { $group: {
          _id: '$_id',
          revenue:    { $first: '$grandTotal' },
          discount:   { $first: '$discount' },
          vatAmount:  { $first: '$vatAmount' },
          cogs: { $sum: { $multiply: ['$items.quantity', { $ifNull: ['$prod.costPrice', 0] }] } },
        }},
        { $group: {
          _id: null,
          grossRevenue:   { $sum: '$revenue' },
          totalDiscounts: { $sum: '$discount' },
          totalVAT:       { $sum: '$vatAmount' },
          totalCOGS:      { $sum: '$cogs' },
          txCount:        { $sum: 1 },
        }},
      ]),
      // Monthly P&L trend
      Sale.aggregate([
        { $match: dateMatch },
        { $unwind: '$items' },
        { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'prod' } },
        { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
        { $group: {
          _id: { month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, saleId: '$_id', revenue: '$grandTotal', discount: '$discount', vat: '$vatAmount' },
          cogs: { $sum: { $multiply: ['$items.quantity', { $ifNull: ['$prod.costPrice', 0] }] } },
        }},
        { $group: {
          _id: '$_id.month',
          revenue:   { $sum: '$_id.revenue' },
          discount:  { $sum: '$_id.discount' },
          vat:       { $sum: '$_id.vat' },
          cogs:      { $sum: '$cogs' },
          txCount:   { $sum: 1 },
        }},
        { $sort: { _id: 1 } },
        { $project: {
          revenue: 1, discount: 1, vat: 1, cogs: 1, txCount: 1,
          grossProfit: { $subtract: ['$revenue', '$cogs'] },
          netProfit: { $subtract: [{ $subtract: ['$revenue', '$cogs'] }, { $add: ['$discount', '$vat'] }] },
        }},
      ]),
    ]);

    const d = income[0] || {};
    const grossRevenue   = d.grossRevenue   || 0;
    const totalCOGS      = d.totalCOGS      || 0;
    const totalDiscounts = d.totalDiscounts || 0;
    const totalVAT       = d.totalVAT       || 0;
    const grossProfit    = grossRevenue - totalCOGS;
    const netProfit      = grossProfit - totalDiscounts - totalVAT;
    const margin         = grossRevenue > 0 ? ((netProfit / grossRevenue) * 100).toFixed(1) : '0.0';

    res.json({
      summary: { grossRevenue, totalCOGS, grossProfit, totalDiscounts, totalVAT, netProfit, margin, txCount: d.txCount || 0 },
      monthly,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/reports/audit-trail — audit log built from sales activity
router.get('/audit-trail', protect, adminOnly, async (req, res) => {
  try {
    const { from, to, period = 'month', search, action, entity, page = 1, limit = 20 } = req.query;
    const { startDate, endDate } = buildDateRange(from, to, period);
    const match = { createdAt: { $gte: startDate, $lte: endDate } };
    const total = await Sale.countDocuments(match);
    const sales = await Sale.find(match)
      .populate('cashier', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    // Map sales to audit entries
    let entries = sales.map(s => ({
      id: s._id,
      date: s.createdAt,
      user: s.cashierName || s.cashier?.name || 'Unknown',
      action: s.status === 'refunded' ? 'Refund' : s.status === 'voided' ? 'Void' : 'Sale',
      entity: 'Sale',
      description: `${s.receiptNumber} • ${s.items.length} item(s) • ${s.paymentMethod.toUpperCase()} • KES ${s.grandTotal.toLocaleString()}`,
      ref: s.receiptNumber,
    }));

    // Client-side filters on mapped entries
    if (search) {
      const q = search.toLowerCase();
      entries = entries.filter(e => e.user.toLowerCase().includes(q) || e.description.toLowerCase().includes(q) || e.ref.toLowerCase().includes(q));
    }
    if (action && action !== 'all') entries = entries.filter(e => e.action.toLowerCase() === action.toLowerCase());
    if (entity && entity !== 'all') entries = entries.filter(e => e.entity.toLowerCase() === entity.toLowerCase());

    res.json({ entries, total, pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/reports/eod-reconcile — save cashier's physical count
router.post('/eod-reconcile', protect, adminOnly, async (req, res) => {
  try {
    const { date, physicalCash, physicalCard, physicalMpesa, notes, closedBy } = req.body;
    const day   = date ? new Date(date) : new Date();
    const start = new Date(day); start.setHours(0,0,0,0);
    const end   = new Date(day); end.setHours(23,59,59,999);
    const match = { createdAt: { $gte: start, $lte: end }, status: 'completed' };

    const byMethod = await Sale.aggregate([
      { $match: match },
      { $group: { _id: '$paymentMethod', total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
    ]);

    const expected = { cash:0, card:0, mpesa:0 };
    byMethod.forEach(m => { if (expected[m._id] !== undefined) expected[m._id] = m.total; });

    const physical = {
      cash:  Number(physicalCash  || 0),
      card:  Number(physicalCard  || 0),
      mpesa: Number(physicalMpesa || 0),
    };

    const discrepancies = {
      cash:  physical.cash  - expected.cash,
      card:  physical.card  - expected.card,
      mpesa: physical.mpesa - expected.mpesa,
    };

    res.json({
      date: day.toISOString().split('T')[0],
      expected,
      physical,
      discrepancies,
      totalExpected: expected.cash + expected.card + expected.mpesa,
      totalPhysical: physical.cash + physical.card + physical.mpesa,
      totalDiscrepancy: discrepancies.cash + discrepancies.card + discrepancies.mpesa,
      notes: notes || '',
      closedBy: closedBy || '',
      closedAt: new Date(),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
