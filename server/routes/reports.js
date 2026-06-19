const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const { protect, adminOnly } = require('../middleware/auth');

// GET /api/reports — full analytics
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { period = 'month' } = req.query;

    let startDate = new Date();
    if (period === 'month') startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    else if (period === 'quarter') startDate = new Date(startDate.getFullYear(), startDate.getMonth() - 2, 1);
    else if (period === 'week') { startDate.setDate(startDate.getDate() - 7); startDate.setHours(0,0,0,0); }

    const [revenueStats, categoryBreakdown, bestSellers, peakHours, inventoryVal] = await Promise.all([
      // Revenue & Profit
      Sale.aggregate([
        { $match: { createdAt: { $gte: startDate }, status: 'completed' } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$grandTotal' },
            totalVat: { $sum: '$vatAmount' },
            totalDiscount: { $sum: '$discount' },
            txCount: { $sum: 1 },
            avgTransaction: { $avg: '$grandTotal' },
          },
        },
      ]),

      // Sales by Category
      Sale.aggregate([
        { $match: { createdAt: { $gte: startDate }, status: 'completed' } },
        { $unwind: '$items' },
        {
          $lookup: {
            from: 'products', localField: 'items.product',
            foreignField: '_id', as: 'product',
          },
        },
        { $unwind: '$product' },
        {
          $group: {
            _id: '$product.category',
            total: { $sum: '$items.subtotal' },
            units: { $sum: '$items.quantity' },
          },
        },
        { $sort: { total: -1 } },
      ]),

      // Best Sellers
      Sale.aggregate([
        { $match: { createdAt: { $gte: startDate }, status: 'completed' } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.product',
            name: { $first: '$items.name' },
            unitsSold: { $sum: '$items.quantity' },
            revenue: { $sum: '$items.subtotal' },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
      ]),

      // Peak hours heatmap
      Sale.aggregate([
        { $match: { createdAt: { $gte: startDate }, status: 'completed' } },
        {
          $group: {
            _id: { $hour: '$createdAt' },
            count: { $sum: 1 },
            revenue: { $sum: '$grandTotal' },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Inventory valuation
      Product.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            stockValue: { $sum: { $multiply: ['$price', '$stock'] } },
            potentialProfit: { $sum: { $multiply: [{ $subtract: ['$price', '$costPrice'] }, '$stock'] } },
            lowStockItems: {
              $sum: { $cond: [{ $lte: ['$stock', '$reorderLevel'] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    // Daily revenue trend
    const dailyTrend = await Sale.aggregate([
      { $match: { createdAt: { $gte: startDate }, status: 'completed' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$grandTotal' },
          profit: { $sum: { $subtract: ['$grandTotal', '$vatAmount'] } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Payment method breakdown
    const paymentBreakdown = await Sale.aggregate([
      { $match: { createdAt: { $gte: startDate }, status: 'completed' } },
      { $group: { _id: '$paymentMethod', total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
    ]);

    res.json({
      revenueStats: revenueStats[0] || {},
      categoryBreakdown,
      bestSellers,
      peakHours,
      inventoryVal: inventoryVal[0] || {},
      dailyTrend,
      paymentBreakdown,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
