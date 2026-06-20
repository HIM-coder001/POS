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
    // Strip any huge base64 logo if it exceeds ~1MB to prevent document size errors
    const body = { ...req.body };

    // Validate brandColor format
    if (body.brandColor && !/^#[0-9a-fA-F]{6}$/.test(body.brandColor)) {
      delete body.brandColor; // ignore invalid colour values
    }

    // Warn if logo is very large (base64 images can be huge)
    if (body.logoUrl && body.logoUrl.length > 800_000) {
      return res.status(400).json({
        message: 'Logo image is too large. Please use an image under 500KB or host it externally and use a URL instead.',
      });
    }

    let settings = await BusinessSetting.findOne();
    if (!settings) {
      settings = await BusinessSetting.create(body);
    } else {
      settings = await BusinessSetting.findByIdAndUpdate(settings._id, body, {
        new: true,
        runValidators: true,
      });
    }
    res.json(settings);
  } catch (error) {
    console.error('Settings PUT error:', error.message);
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
