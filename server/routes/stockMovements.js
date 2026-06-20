const express = require('express');
const router = express.Router();
const StockMovement = require('../models/StockMovement');
const { protect, adminOnly } = require('../middleware/auth');

// GET /api/stock-movements — paginated list, admin only
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { productId, type, page = 1, limit = 20 } = req.query;
    const query = {};

    if (productId) query.product = productId;
    if (type) query.type = type;

    const total = await StockMovement.countDocuments(query);
    const movements = await StockMovement.find(query)
      .populate('product', 'name sku')
      .populate('performedBy', 'name')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({
      movements,
      total,
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
