const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const Purchase = require('../models/Purchase');
const Supplier = require('../models/Supplier');
const { protect, adminOnly } = require('../middleware/auth');
const validate = require('../middleware/validate');

// ── GET /api/purchases — list all purchases ───────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const purchases = await Purchase.find()
      .populate('supplier', 'name')
      .populate('createdBy', 'name')
      .sort({ purchaseDate: -1 });

    res.json(purchases);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── POST /api/purchases — record a new purchase ───────────────────────────────
router.post(
  '/',
  protect,
  adminOnly,
  [
    body('supplier')
      .notEmpty().withMessage('Supplier is required')
      .isMongoId().withMessage('Supplier must be a valid ID'),

    body('items')
      .isArray({ min: 1 }).withMessage('Items must be a non-empty array'),

    body('items.*.productName')
      .notEmpty().withMessage('Each item must have a product name'),

    body('items.*.quantity')
      .isInt({ min: 1 }).withMessage('Each item quantity must be an integer ≥ 1'),

    body('items.*.unitCost')
      .isFloat({ gt: 0 }).withMessage('Each item unit cost must be a number > 0'),

    body('purchaseDate')
      .notEmpty().withMessage('Purchase date is required')
      .isISO8601().withMessage('Purchase date must be a valid ISO 8601 date'),
  ],
  validate,
  async (req, res) => {
    try {
      const { supplier, items, purchaseDate } = req.body;

      // Verify the supplier exists
      const supplierDoc = await Supplier.findById(supplier);
      if (!supplierDoc) {
        return res.status(400).json({ message: 'Supplier not found' });
      }

      // Build the purchase — pre-save hook computes subtotals and totalCost
      const purchase = new Purchase({
        supplier,
        items,
        purchaseDate,
        totalCost: 0, // will be overwritten by pre-save hook
        createdBy: req.user._id,
      });

      await purchase.save();

      // Return the populated document
      await purchase.populate([
        { path: 'supplier', select: 'name' },
        { path: 'createdBy', select: 'name' },
      ]);

      res.status(201).json(purchase);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

module.exports = router;
