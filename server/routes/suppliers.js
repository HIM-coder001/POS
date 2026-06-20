const express = require('express');
const router = express.Router();
const Supplier = require('../models/Supplier');
const { protect, adminOnly } = require('../middleware/auth');

// GET /api/suppliers — list all active suppliers
router.get('/', protect, async (req, res) => {
  try {
    const suppliers = await Supplier.find({ isActive: true }).sort({ name: 1 });
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/suppliers — create a new supplier
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { name, contact, email, phone, address, reliabilityScore } = req.body;
    if (!name) return res.status(400).json({ message: 'Supplier name is required' });

    const supplier = await Supplier.create({ name, contact, email, phone, address, reliabilityScore });
    res.status(201).json(supplier);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/suppliers/:id — update a supplier
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    res.json(supplier);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/suppliers/:id — soft delete (set isActive = false)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    res.json({ message: 'Supplier deactivated', supplier });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
