const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
require('../models/Supplier'); // Register Supplier model for populate()
const { protect, adminOnly } = require('../middleware/auth');

// GET /api/inventory — list all inventory with stock levels
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { warehouse, status, page = 1, limit = 20 } = req.query;
    const query = { isActive: true };

    if (status === 'low') query.$expr = { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$reorderLevel'] }] };
    if (status === 'out') query.stock = 0;
    if (status === 'ok') query.$expr = { $gt: ['$stock', '$reorderLevel'] };

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate('supplier', 'name reliabilityScore')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ stock: 1 }); // lowest stock first

    // Summary stats
    const stats = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalValue: { $sum: { $multiply: ['$price', '$stock'] } },
          lowStockCount: {
            $sum: { $cond: [{ $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$reorderLevel'] }] }, 1, 0] },
          },
          outOfStockCount: { $sum: { $cond: [{ $eq: ['$stock', 0] }, 1, 0] } },
          totalItems: { $sum: 1 },
        },
      },
    ]);

    res.json({
      products,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      stats: stats[0] || { totalValue: 0, lowStockCount: 0, outOfStockCount: 0, totalItems: 0 },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/inventory/:id/adjust — stock adjustment
router.put('/:id/adjust', protect, adminOnly, async (req, res) => {
  try {
    const { adjustment, reason } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    product.stock = Math.max(0, product.stock + adjustment);
    await product.save();

    res.json({ message: 'Stock adjusted', product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/inventory/:id/reorder — update reorder level
router.put('/:id/reorder', protect, adminOnly, async (req, res) => {
  try {
    const { reorderLevel } = req.body;
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { reorderLevel },
      { new: true }
    );
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
