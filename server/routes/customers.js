const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const { protect } = require('../middleware/auth');

// GET /api/customers
router.get('/', protect, async (req, res) => {
  try {
    const { search, tier, page = 1, limit = 20 } = req.query;
    const query = {};
    if (search) query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
    if (tier) query.tier = tier;

    const total = await Customer.countDocuments(query);
    const customers = await Customer.find(query)
      .sort({ totalSpend: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .select('-purchaseHistory');

    res.json({ customers, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/customers/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/customers
router.post('/', protect, async (req, res) => {
  try {
    const exists = await Customer.findOne({ phone: req.body.phone });
    if (exists) return res.status(400).json({ message: 'Customer with this phone already exists' });
    const customer = await Customer.create(req.body);
    res.status(201).json(customer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// PUT /api/customers/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json(customer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// DELETE /api/customers/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    await Customer.findByIdAndDelete(req.params.id);
    res.json({ message: 'Customer removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
