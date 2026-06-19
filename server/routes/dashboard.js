const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const { protect, adminOnly } = require('../middleware/auth');

// GET /api/dashboard — KPIs for today
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Month to date
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [todaySales, mtdSales, totalOrders, lowStockCount, recentSales, stockAlerts] = await Promise.all([
      // Today's total sales
      Sale.aggregate([
        { $match: { createdAt: { $gte: today, $lte: todayEnd }, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
      ]),
      // Month to date
      Sale.aggregate([
        { $match: { createdAt: { $gte: monthStart }, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
      ]),
      Sale.countDocuments({ createdAt: { $gte: today, $lte: todayEnd }, status: 'completed' }),
      // Low stock
      Product.countDocuments({ isActive: true, $expr: { $lte: ['$stock', '$reorderLevel'] } }),
      // Recent 5 transactions
      Sale.find({ status: 'completed' })
        .populate('customer', 'name')
        .sort({ createdAt: -1 })
        .limit(5)
        .select('receiptNumber grandTotal paymentMethod createdAt customerName'),
      // Stock alerts (low/out)
      Product.find({ isActive: true, $expr: { $lte: ['$stock', '$reorderLevel'] } })
        .limit(5)
        .select('name stock reorderLevel image category'),
    ]);

    // Last 7 days sales trend
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const salesTrend = await Sale.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo }, status: 'completed' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: '$grandTotal' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Category distribution
    const categoryData = await Sale.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: monthStart } } },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productInfo',
        },
      },
      { $unwind: '$productInfo' },
      { $group: { _id: '$productInfo.category', total: { $sum: '$items.subtotal' } } },
      { $sort: { total: -1 } },
    ]);

    res.json({
      kpis: {
        todaySales: todaySales[0]?.total || 0,
        todayOrders: todaySales[0]?.count || 0,
        mtdRevenue: mtdSales[0]?.total || 0,
        totalOrders,
        lowStockCount,
      },
      salesTrend,
      categoryData,
      recentSales,
      stockAlerts,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
