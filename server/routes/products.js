const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
require('../models/Supplier'); // Register Supplier model for populate()
const { protect, adminOnly } = require('../middleware/auth');

// GET /api/products — list all with search & filter
router.get('/', protect, async (req, res) => {
  try {
    const { search, category, status, page = 1, limit = 20 } = req.query;
    const query = { isActive: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } },
      ];
    }
    if (category) query.category = category;
    if (status === 'low_stock') query.$expr = { $lte: ['$stock', '$reorderLevel'] };
    if (status === 'out_of_stock') query.stock = 0;
    if (status === 'in_stock') query.$expr = { $gt: ['$stock', '$reorderLevel'] };

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate('supplier', 'name')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    res.json({ products, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/products/low-stock — items at or below reorder level
router.get('/low-stock', protect, async (req, res) => {
  try {
    const items = await Product.find({
      isActive: true,
      $expr: { $lte: ['$stock', { $ifNull: ['$reorderLevel', 10] }] },
    }).sort({ stock: 1 }).limit(50).select('name sku stock reorderLevel category image');
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/products/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('supplier', 'name');
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/products
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// POST /api/products/bulk-import
router.post('/bulk-import', protect, adminOnly, async (req, res) => {
  try {
    const { products } = req.body;
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: 'A list of products is required for bulk import' });
    }
    const inserted = await Product.insertMany(products);
    res.status(201).json({ message: `Successfully imported ${inserted.length} products`, products: inserted });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


// PUT /api/products/:id
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// DELETE /api/products/:id (soft delete)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await Product.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Product removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
