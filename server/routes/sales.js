const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const StockMovement = require('../models/StockMovement');
const { protect } = require('../middleware/auth');

// POST /api/sales — create new sale (checkout)
router.post('/', protect, async (req, res) => {
  try {
    const { items, paymentMethod, customerId, discount = 0, mpesaRef, pointsRedeemed = 0, splitPayments } = req.body;

    if (!items || items.length === 0)
      return res.status(400).json({ message: 'No items in cart' });

    // Enrich items and calculate totals
    let subtotal = 0;
    const enrichedItems = [];
    const stockMovementDrafts = []; // collect drafts; backfill receiptNumber after sale created
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) return res.status(404).json({ message: `Product ${item.productId} not found` });
      if (product.stock < item.quantity)
        return res.status(400).json({ message: `Insufficient stock for ${product.name}` });

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

      // Decrement stock
      const stockBefore = product.stock;
      await Product.findByIdAndUpdate(product._id, { $inc: { stock: -item.quantity } });
      stockMovementDrafts.push({
        product: product._id,
        productName: product.name,
        type: 'sale',
        quantity: -item.quantity,
        balanceBefore: stockBefore,
        balanceAfter: stockBefore - item.quantity,
        performedBy: req.user._id,
        performedByName: req.user.name,
        // reference populated after sale is created below
      });
    }

    const vatAmount = subtotal * 0.16;

    // Loyalty points redemption logic: 1 point = 1 KES
    let customer = null;
    let appliedPointsDiscount = 0;
    if (customerId) {
      customer = await Customer.findById(customerId);
      if (!customer) return res.status(404).json({ message: 'Customer not found' });
      
      if (pointsRedeemed > 0) {
        if (customer.loyaltyPoints < pointsRedeemed) {
          return res.status(400).json({ message: `Insufficient loyalty points. Balance: ${customer.loyaltyPoints}` });
        }
        appliedPointsDiscount = Number(pointsRedeemed);
      }
    }

    const totalDiscount = Number(discount) + appliedPointsDiscount;
    const grandTotal = Math.max(0, subtotal + vatAmount - totalDiscount);

    if (paymentMethod === 'split') {
      if (!splitPayments || splitPayments.length === 0) {
        return res.status(400).json({ message: 'Split payment breakdown details are required' });
      }
      const sum = splitPayments.reduce((acc, p) => acc + p.amount, 0);
      if (Math.abs(sum - grandTotal) > 0.05) {
        return res.status(400).json({ message: `Split payments sum (${sum}) must equal grand total (${grandTotal})` });
      }
    }

    const sale = await Sale.create({
      items: enrichedItems,
      subtotal,
      vatAmount,
      discount: totalDiscount,
      grandTotal,
      paymentMethod,
      mpesaRef,
      splitPayments: paymentMethod === 'split' ? splitPayments : [],
      cashier: req.user._id,
      cashierName: req.user.name,
      customer: customerId || null,
      customerName: customer ? customer.name : 'Walk-in',
      branch: req.user.branch,
    });

    // Record stock movements now that we have the receipt number
    await StockMovement.insertMany(
      stockMovementDrafts.map(d => ({ ...d, reference: sale.receiptNumber }))
    );

    // Update customer stats & loyalty points
    if (customer) {
      const pointsEarned = Math.floor(grandTotal / 10);
      const pointsNetChange = pointsEarned - pointsRedeemed;

      customer.loyaltyPoints += pointsNetChange;
      customer.totalSpend += grandTotal;
      customer.totalVisits += 1;
      customer.purchaseHistory.push({
        saleId: sale._id,
        amount: grandTotal,
        items: enrichedItems.map(i => i.name).join(', '),
      });
      customer.lastPurchase = new Date();
      await customer.save(); // Triggers pre('save') to auto-update tier based on points
    }

    await sale.populate([
      { path: 'cashier', select: 'name' },
      { path: 'customer', select: 'name phone loyaltyPoints tier' }
    ]);
    res.status(201).json(sale);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/sales — list sales
router.get('/', protect, async (req, res) => {
  try {
    const { page = 1, limit = 20, date } = req.query;
    const query = { branch: req.user.branch };

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: start, $lte: end };
    }

    const total = await Sale.countDocuments(query);
    const sales = await Sale.find(query)
      .populate('customer', 'name phone')
      .populate('cashier', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ sales, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/sales/:id/refund — refund a completed sale
router.post('/:id/refund', protect, async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: 'Sale not found' });
    if (sale.status !== 'completed') {
      return res.status(400).json({ message: `Sale cannot be refunded — current status: ${sale.status}` });
    }

    const { refundReason } = req.body;

    // Restore stock for each item and record stock movements
    for (const item of sale.items) {
      const product = await Product.findById(item.product);
      if (product) {
        const stockBefore = product.stock;
        await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
        await StockMovement.create({
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
        });
      }
    }

    // Deduct loyalty points earned from original sale
    if (sale.customer) {
      const pointsEarned = Math.floor(sale.grandTotal / 10);
      if (pointsEarned > 0) {
        await Customer.findByIdAndUpdate(sale.customer, {
          $inc: { loyaltyPoints: -pointsEarned },
        });
      }
    }

    // Mark sale as refunded
    sale.status = 'refunded';
    sale.refundedAt = new Date();
    sale.refundReason = refundReason || '';
    await sale.save();

    await sale.populate([
      { path: 'cashier', select: 'name' },
      { path: 'customer', select: 'name phone loyaltyPoints tier' },
    ]);

    res.json(sale);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
