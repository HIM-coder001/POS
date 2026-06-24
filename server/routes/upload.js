const express   = require('express');
const router    = express.Router();
const cloudinary = require('../config/cloudinary');
const { protect } = require('../middleware/auth');

// POST /api/upload/image
// Body: { data: "data:image/jpeg;base64,..." }  OR  { url: "https://..." }
// Returns: { url, publicId }
router.post('/image', protect, async (req, res) => {
  try {
    const { data, url, folder = 'retailedge/products' } = req.body;

    let result;

    if (data) {
      // Base64 upload (from file picker)
      if (!data.startsWith('data:image/')) {
        return res.status(400).json({ message: 'Invalid image data. Must be a base64 data URL.' });
      }
      result = await cloudinary.uploader.upload(data, {
        folder,
        transformation: [
          { width: 800, height: 800, crop: 'limit' }, // max 800×800
          { quality: 'auto:good' },
          { fetch_format: 'auto' },
        ],
      });
    } else if (url) {
      // URL upload (fetch from remote)
      result = await cloudinary.uploader.upload(url, {
        folder,
        transformation: [
          { width: 800, height: 800, crop: 'limit' },
          { quality: 'auto:good' },
          { fetch_format: 'auto' },
        ],
      });
    } else {
      return res.status(400).json({ message: 'Provide either data (base64) or url.' });
    }

    res.json({
      url:      result.secure_url,
      publicId: result.public_id,
      width:    result.width,
      height:   result.height,
    });
  } catch (err) {
    console.error('Cloudinary upload error:', err.message);
    res.status(500).json({ message: err.message || 'Image upload failed' });
  }
});

// DELETE /api/upload/image/:publicId — remove image from Cloudinary
router.delete('/image/:publicId', protect, async (req, res) => {
  try {
    const publicId = decodeURIComponent(req.params.publicId);
    await cloudinary.uploader.destroy(publicId);
    res.json({ message: 'Image deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
