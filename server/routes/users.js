const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');

// GET /api/users
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/users — create user
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { name, email, password, role, branch } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password are required' });
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already in use' });
    const user = await User.create({ name, email, password, role: role || 'cashier', branch: branch || 'Nairobi Main Branch' });
    res.status(201).json({ _id: user._id, name: user.name, email: user.email, role: user.role, branch: user.branch, isActive: user.isActive, createdAt: user.createdAt });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// PUT /api/users/:id
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { name, email, role, branch, isActive, password } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    if (branch) user.branch = branch;
    if (isActive !== undefined) user.isActive = isActive;
    if (password) user.password = password;
    const updated = await user.save();
    res.json({ _id: updated._id, name: updated.name, email: updated.email, role: updated.role, branch: updated.branch, isActive: updated.isActive });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// DELETE /api/users/:id — soft deactivate
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.isActive = false;
    await user.save();
    res.json({ message: 'User deactivated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
