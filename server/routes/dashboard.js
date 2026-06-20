const express = require('express');
const router  = express.Router();
const Sale    = require('../models/Sale');
const Product = require('../models/Product');
const { protect, adminOnly } = require('../middleware/auth');

// GET /api/dashboard
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    // ── Time boundaries ──────────────────────────────────────────────
    const now = new Date();

    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);

    const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd   = new Date(todayEnd);   yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

    const monthStart     = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const sevenDaysAgo = new Date(todayStart); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    // ── Parallel queries ─────────────────────────────────────────────
    const [
      todayAgg,
      yesterdayAgg,
      mtdAgg,
      lastMonthAgg,
      lowStockCount,
      recentSales,
      stockAlerts,
      salesTrend,
      categoryData,
      paymentMethodData,
    ] = await Promise.all([

      Sale.aggregate([
        { $match: { createdAt: { $gte: todayStart, $lte: todayEnd }, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
      ]),

      Sale.aggregate([
        { $match: { createdAt: { $gte: yesterdayStart, $lte: yesterdayEnd }, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
      ]),

      Sale.aggregate([
        { $match: { createdAt: { $gte: monthStart }, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
      ]),

      Sale.aggregate([
        { $match: { createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd }, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
      ]),

      // $expr with $lte works on Atlas — compare stock to reorderLevel field
      Product.countDocuments({
        isActive: true,
        $expr: { $lte: ['$stock', { $ifNull: ['$reorderLevel', 10] }] },
      }),

      Sale.find({ status: 'completed' })
        .sort({ createdAt: -1 })
        .limit(6)
        .select('receiptNumber grandTotal paymentMethod createdAt customerName'),

      Product.find({
        isActive: true,
        $expr: { $lte: ['$stock', { $ifNull: ['$reorderLevel', 10] }] },
      })
        .sort({ stock: 1 })
        .limit(8)
        .select('name stock reorderLevel category'),

      Sale.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo }, status: 'completed' } },
        {
          $group: {
            _id:   { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            total: { $sum: '$grandTotal' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      Sale.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: monthStart } } },
        { $unwind: '$items' },
        {
          $lookup: {
            from: 'products',
            localField: 'items.product',
            foreignField: '_id',
            as: 'prod',
          },
        },
        // fixed: preserveNullAndEmptyArrays (not preserveNullAndEmpty)
        { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id:   { $ifNull: ['$prod.category', 'Uncategorised'] },
            total: { $sum: '$items.subtotal' },
            count: { $sum: '$items.quantity' },
          },
        },
        { $sort: { total: -1 } },
        { $limit: 6 },
      ]),

      Sale.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: monthStart } } },
        {
          $group: {
            _id:   '$paymentMethod',
            total: { $sum: '$grandTotal' },
            count: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
      ]),
    ]);

    // ── Fill every day in the 7-day window with 0 if no sales ────────
    const trendMap = {};
    salesTrend.forEach(d => { trendMap[d._id] = d; });
    const filledTrend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayStart);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      filledTrend.push(trendMap[key] || { _id: key, total: 0, count: 0 });
    }

    // ── Percentage change helper ─────────────────────────────────────
    const pct = (curr, prev) => {
      if (!prev && !curr) return null;
      if (!prev)          return null; // no baseline
      return Math.round(((curr - prev) / prev) * 100);
    };

    const todayRevenue    = todayAgg[0]?.total    || 0;
    const yesterdayRev    = yesterdayAgg[0]?.total || 0;
    const todayOrders     = todayAgg[0]?.count    || 0;
    const yesterdayOrders = yesterdayAgg[0]?.count || 0;
    const mtdRevenue      = mtdAgg[0]?.total      || 0;
    const lastMonthRev    = lastMonthAgg[0]?.total || 0;

    res.json({
      kpis: {
        todaySales:        todayRevenue,
        todayOrders,
        yesterdaySales:    yesterdayRev,
        yesterdayOrders,
        todayVsYesterday:  pct(todayRevenue, yesterdayRev),
        ordersVsYesterday: pct(todayOrders, yesterdayOrders),
        mtdRevenue,
        lastMonthRevenue:  lastMonthRev,
        mtdVsLastMonth:    pct(mtdRevenue, lastMonthRev),
        lowStockCount,
      },
      salesTrend:       filledTrend,
      categoryData,
      paymentMethodData,
      recentSales,
      stockAlerts,
    });

  } catch (err) {
    console.error('Dashboard error:', err.message, err.stack);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
