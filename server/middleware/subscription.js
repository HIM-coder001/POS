const BusinessSetting = require('../models/BusinessSetting');
const { isDevelopment } = require('../config/runtime');

const PUBLIC_PATHS = [
  /^\/api\/auth(?:\/|$)/,
  /^\/api\/settings(?:\/|$)/,
  /^\/api\/mpesa(?:\/|$)/,
  /^\/api\/health$/,
];

const requireActiveSubscription = async (req, res, next) => {
  if (isDevelopment()) {
    return next();
  }

  if (PUBLIC_PATHS.some((pattern) => pattern.test(req.originalUrl))) {
    return next();
  }

  try {
    let settings = await BusinessSetting.findOne().select('subscriptionStatus');
    if (!settings) {
      settings = await BusinessSetting.create({});
    }

    if (settings.subscriptionStatus !== 'active') {
      return res.status(402).json({
        message: 'Subscription payment is required to access this section.',
        subscriptionStatus: settings.subscriptionStatus || 'none',
      });
    }

    return next();
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = requireActiveSubscription;
