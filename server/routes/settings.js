const express = require('express');
const router = express.Router();
const BusinessSetting = require('../models/BusinessSetting');
const { protect, adminOnly } = require('../middleware/auth');

// GET /api/settings — get current business settings
router.get('/', protect, async (req, res) => {
  try {
    let settings = await BusinessSetting.findOne();
    if (!settings) {
      // Create default settings if none exist
      settings = await BusinessSetting.create({});
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/settings — update business settings (Admin/Manager only)
router.put('/', protect, adminOnly, async (req, res) => {
  try {
    let settings = await BusinessSetting.findOne();
    if (!settings) {
      settings = await BusinessSetting.create(req.body);
    } else {
      settings = await BusinessSetting.findByIdAndUpdate(settings._id, req.body, {
        new: true,
        runValidators: true,
      });
    }
    res.json(settings);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
