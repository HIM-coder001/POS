const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, query } = require('express-validator');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const StockMovement = require('../models/StockMovement');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const logger = require('../utils/logger');

// ── POST /api/sales — create new sale (checkout) ──────────────────────────────
router.post(
  '/',
  protect,
  [
    body('items').isArray({ min: 1 }).withMessage('Cart must have at least one item'),
    body('items.*.productId').isMongoId().withMessage('Invalid product ID'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('paymentMethod').isIn(['cash', 'card', 'mpesa', 'split']).withMessage('Invalid payment method'),
    body('discount').optional().isFloat({ min: 0 }).withMessage('Discount must be non-negative'),
    body('pointsRedeemed').optional().isInt({ min: 0 }).withMessage('Points must be non-negative'),
  ],
  validate,
  async (req, res) => {
    // Use a Mongoose session so all DB writes are atomic.
    // If anything fails mid-sale, all changes (stock, customer, sale doc) are rolled back.
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const {
        items,
        paymentMethod,
        customerId,
        discount = 0,
        mpesaRef,
        pointsRedeemed = 0,
        splitPayments,
      } = req.body;

      // ── Validate and enrich items ────────────────────────────────────────────
      let subtotal = 0;
      const enrichedItems = [];
      const stockMovementDrafts = [];

      for (const item of items) {
        const product = await Product.findById(item.productId).session(session);
        if (!product)
          return res.status(404).json({ message: `Product ${item.productId} not found` });
        if (product.stock < item.quantity)
          return res.status(400).json({ message: `Insufficient stock for "${product.name}". Available: ${product.stock}` });

        const itemSubtotal = product.price * item.quantity;
        subtotal += itemSubtotal;
        enrichedItems.push({
          product: product._id,
          name: product.name,
          sku: product.sku,
          price: product.price,
          quantity: item.quantity,
          subtotal: itemSubtotal,
        });

        const stockBefore = product.stock;
        await Product.findByIdAndUpdate(
          product._id,
          { $inc: { stock: -item.quantity } },
          { session }
        );
        stockMovementDrafts.push({
          product: product._id,
          productName: product.name,
          type: 'sale',
          quantity: -item.quantity,
          balanceBefore: stockBefore,
          balanceAfter: stockBefore - item.quantity,
          performedBy: req.user._id,
          performedByName: req.user.name,
        });
      }

      const vatAmount = subtotal * 0.16;

      // ── Loyalty points redemption ────────────────────────────────────────────
      let customer = null;
      let appliedPointsDiscount = 0;
      if (customerId) {
        customer = await Customer.findById(customerId).session(session);
        if (!customer) return res.status(404).json({ message: 'Customer not found' });

        if (pointsRedeemed > 0) {
          if (customer.loyaltyPoints < pointsRedeemed)
            return res.status(400).json({ message: `Insufficient loyalty points. Balance: ${customer.loyaltyPoints}` });
          appliedPointsDiscount = Number(pointsRedeemed);
        }
      }

      const totalDiscount = Number(discount) + appliedPointsDiscount;
      const grandTotal    = Math.max(0, subtotal + vatAmount - totalDiscount);

      // ── Validate split payments ──────────────────────────────────────────────
      if (paymentMethod === 'split') {
        if (!splitPayments || splitPayments.length === 0)
          return res.status(400).json({ message: 'Split payment breakdown details are required' });
        const sum = splitPayments.reduce((acc, p) => acc + p.amount, 0);
        if (Math.abs(sum - grandTotal) > 0.05)
          return res.status(400).json({
            message: `Split payments sum (${sum.toFixed(2)}) must equal grand total (${grandTotal.toFixed(2)})`,
          });
      }

      // ── Create sale document ─────────────────────────────────────────────────
      const [sale] = await Sale.create([{
        items: enrichedItems,
        subtotal,
        vatAmount,
        discount: totalDiscount,
        grandTotal,
        paymentMethod,
        mpesaRef,
        splitPayments: paymentMethod === 'split' ? splitPayments : [],
        cashier:      req.user._id,
        cashierName:  req.user.name,
        customer:     customerId || null,
        customerName: customer ? customer.name : 'Walk-in',
        branch:       req.user.branch,
      }], { session });

      // ── Create stock movements ───────────────────────────────────────────────
      await StockMovement.insertMany(
        stockMovementDrafts.map(d => ({ ...d, reference: sale.receiptNumber })),
        { session }
      );

      // ── Update customer loyalty ──────────────────────────────────────────────
      if (customer) {
        const pointsEarned  = Math.floor(grandTotal / 10);
        const pointsNetChange = pointsEarned - pointsRedeemed;

        customer.loyaltyPoints += pointsNetChange;
        customer.totalSpend    += grandTotal;
        customer.totalVisits   += 1;
        customer.purchaseHistory.push({
          saleId: sale._id,
          amount: grandTotal,
          items:  enrichedItems.map(i => i.name).join(', '),
        });
        customer.lastPurchase = new Date();
        await customer.save({ session });
      }

      // ── Commit transaction ───────────────────────────────────────────────────
      await session.commitTransaction();
      session.endSession();

      await sale.populate([
        { path: 'cashier',  select: 'name' },
        { path: 'customer', select: 'name phone loyaltyPoints tier' },
      ]);

      logger.info(`Sale created: ${sale.receiptNumber} | ${req.user.name} | KES ${grandTotal}`);
      res.status(201).json(sale);

    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      logger.error(`Sale creation failed: ${error.message}`);
      res.status(500).json({ message: error.message });
    }
  }
);

// ── GET /api/sales — list sales ───────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const { page = 1, limit = 20, date } = req.query;
    const query = { branch: req.user.branch };

    if (date) {
      const start = new Date(date); start.setHours(0, 0, 0, 0);
      const end   = new Date(date); end.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: start, $lte: end };
    }

    const total = await Sale.countDocuments(query);
    const sales = await Sale.find(query)
      .populate('customer', 'name phone')
      .populate('cashier',  'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ sales, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── POST /api/sales/:id/refund — refund a completed sale ─────────────────────
router.post('/:id/refund', protect, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const sale = await Sale.findById(req.params.id).session(session);
    if (!sale) return res.status(404).json({ message: 'Sale not found' });
    if (sale.status !== 'completed')
      return res.status(400).json({ message: `Sale cannot be refunded — current status: ${sale.status}` });

    const { refundReason } = req.body;

    // Restore stock for each item
    for (const item of sale.items) {
      const product = await Product.findById(item.product).session(session);
      if (product) {
        const stockBefore = product.stock;
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stock: item.quantity } },
          { session }
        );
        await StockMovement.create([{
          product: item.product,
          productName: item.name,
          type: 'refund',
          quantity: item.quantity,
          balanceBefore: stockBefore,
          balanceAfter: stockBefore + item.quantity,
          reference: sale.receiptNumber,
          reason: refundReason || 'Refund',
          performedBy: req.user._id,
          performedByName: req.user.name,
        }], { session });
      }
    }

    // Deduct loyalty points earned from original sale
    if (sale.customer) {
      const pointsEarned = Math.floor(sale.grandTotal / 10);
      if (pointsEarned > 0) {
        await Customer.findByIdAndUpdate(
          sale.customer,
          { $inc: { loyaltyPoints: -pointsEarned } },
          { session }
        );
      }
    }

    sale.status       = 'refunded';
    sale.refundedAt   = new Date();
    sale.refundReason = refundReason || '';
    await sale.save({ session });

    await session.commitTransaction();
    session.endSession();

    await sale.populate([
      { path: 'cashier',  select: 'name' },
      { path: 'customer', select: 'name phone loyaltyPoints tier' },
    ]);

    logger.info(`Refund processed: ${sale.receiptNumber} | by ${req.user.name}`);
    res.json(sale);

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error(`Refund failed: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
