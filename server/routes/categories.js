const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const Product = require('../models/Product');
const { protect, adminOnly } = require('../middleware/auth');

// GET /api/categories — list all active categories with product count
router.get('/', protect, async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ name: 1 });

    // Attach product count to each category
    const withCounts = await Promise.all(
      categories.map(async (cat) => {
        const count = await Product.countDocuments({ category: cat.name, isActive: true });
        return { ...cat.toJSON(), productCount: count };
      })
    );

    res.json(withCounts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/categories — create a new category
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: 'Category name is required' });

    const existing = await Category.findOne({ name: { $regex: `^${name}$`, $options: 'i' } });
    if (existing) return res.status(400).json({ message: 'Category already exists' });

    const category = await Category.create({ name: name.trim(), description });
    res.status(201).json(category);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/categories/:id — update category name/description
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { name, description } = req.body;
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found' });

    const oldName = category.name;

    // If name changed, update all products with the old name
    if (name && name.trim() !== oldName) {
      const duplicate = await Category.findOne({
        name: { $regex: `^${name.trim()}$`, $options: 'i' },
        _id: { $ne: category._id },
      });
      if (duplicate) return res.status(400).json({ message: 'Another category with this name already exists' });

      await Product.updateMany({ category: oldName }, { category: name.trim() });
      category.name = name.trim();
    }

    if (description !== undefined) category.description = description;
    await category.save();

    res.json(category);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/categories/:id — soft delete, only if no products use it
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found' });

    const count = await Product.countDocuments({ category: category.name, isActive: true });
    if (count > 0) {
      return res.status(400).json({
        message: `Cannot delete: ${count} product(s) still use this category. Reassign them first.`,
      });
    }

    category.isActive = false;
    await category.save();
    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
