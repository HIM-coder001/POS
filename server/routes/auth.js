const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { body } = require('express-validator');
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const logger = require('../utils/logger');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '15m' });

// ── Email transporter ─────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   process.env.EMAIL_HOST || 'smtp.gmail.com',
  port:   Number(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // Only disable cert check in development
  ...(process.env.NODE_ENV !== 'production' && {
    tls: { rejectUnauthorized: false },
  }),
});

const sendOTP = async (email, otp, name) => {
  await transporter.sendMail({
    from:    process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to:      email,
    subject: 'RetailEdge POS — Your Login Code',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f8f9fa;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="width:56px;height:56px;background:#00236f;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;">
            <span style="color:white;font-size:28px;">🏪</span>
          </div>
          <h1 style="color:#191c1e;font-size:22px;margin:0;">RetailEdge POS</h1>
        </div>
        <div style="background:white;border-radius:12px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,0.07);">
          <p style="color:#444651;margin-top:0;">Hi <strong>${name}</strong>,</p>
          <p style="color:#444651;">Your login verification code is:</p>
          <div style="text-align:center;margin:24px 0;">
            <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#00236f;font-family:monospace;">${otp}</span>
          </div>
          <p style="color:#757682;font-size:13px;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
          <hr style="border:none;border-top:1px solid #e0e3e5;margin:20px 0;" />
          <p style="color:#9ca3af;font-size:12px;margin:0;">If you didn't request this, you can safely ignore this email.</p>
        </div>
        <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px;">© ${new Date().getFullYear()} RetailEdge POS</p>
      </div>`,
  });
};

const sendPasswordReset = async (email, name, resetUrl) => {
  await transporter.sendMail({
    from:    process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to:      email,
    subject: 'RetailEdge POS — Password Reset Request',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f8f9fa;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="color:#191c1e;font-size:22px;margin:0;">RetailEdge POS</h1>
        </div>
        <div style="background:white;border-radius:12px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,0.07);">
          <p style="color:#444651;margin-top:0;">Hi <strong>${name}</strong>,</p>
          <p style="color:#444651;">You requested a password reset. Click the button below to set a new password:</p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${resetUrl}" style="background:#00236f;color:white;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">Reset Password</a>
          </div>
          <p style="color:#757682;font-size:13px;">This link expires in <strong>1 hour</strong>. If you didn't request a reset, ignore this email.</p>
        </div>
      </div>`,
  });
};

// ── POST /api/auth/login — step 1: validate credentials, send OTP ─────────────
router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('A valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await User.findOne({ email });
      if (!user || !(await user.matchPassword(password)))
        return res.status(401).json({ message: 'Invalid email or password' });

      if (!user.isActive)
        return res.status(403).json({ message: 'Account is deactivated. Contact admin.' });

      const otp = String(Math.floor(100000 + Math.random() * 900000));
      user.otp        = otp;
      user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();

      try {
        await sendOTP(email, otp, user.name);
        res.json({
          otpSent: true,
          email,
          name: user.name,
          role: user.role,
          message: `Verification code sent to ${email}`,
        });
      } catch (mailErr) {
        logger.warn(`Email send failed for ${email}: ${mailErr.message}`);
        // In development only: log OTP to server console
        if (process.env.NODE_ENV === 'development') {
          logger.debug(`📧 OTP for ${email}: ${otp}`);
        }
        res.json({
          otpSent: true,
          email,
          name: user.name,
          role: user.role,
          message: process.env.NODE_ENV === 'development'
            ? `Email not configured — check server console for OTP`
            : `Verification code sent to ${email}`,
          // devOtp only exposed in development AND only when email fails
          ...(process.env.NODE_ENV === 'development' && { devOtp: otp }),
        });
      }
    } catch (error) {
      logger.error(`Login error: ${error.message}`);
      res.status(500).json({ message: 'Server error during login' });
    }
  }
);

// ── POST /api/auth/verify-otp — step 2: verify OTP, return JWT ───────────────
router.post(
  '/verify-otp',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('otp').isLength({ min: 6, max: 6 }).isNumeric().withMessage('OTP must be 6 digits'),
  ],
  validate,
  async (req, res) => {
    try {
      const { email, otp } = req.body;

      const user = await User.findOne({ email });
      if (!user)
        return res.status(404).json({ message: 'User not found' });

      if (!user.otp || !user.otpExpires)
        return res.status(400).json({ message: 'No OTP requested. Please log in again.' });

      if (new Date() > user.otpExpires)
        return res.status(400).json({ message: 'Code has expired. Please log in again.' });

      if (user.otp !== String(otp).trim())
        return res.status(401).json({ message: 'Incorrect code. Please try again.' });

      user.otp        = undefined;
      user.otpExpires = undefined;
      await user.save();

      res.json({
        _id:    user._id,
        name:   user.name,
        email:  user.email,
        role:   user.role,
        branch: user.branch,
        avatar: user.avatar,
        token:  generateToken(user._id),
      });
    } catch (error) {
      logger.error(`OTP verify error: ${error.message}`);
      res.status(500).json({ message: 'Server error during verification' });
    }
  }
);

// ── POST /api/auth/resend-otp ─────────────────────────────────────────────────
router.post(
  '/resend-otp',
  authLimiter,
  [body('email').isEmail().normalizeEmail().withMessage('Valid email required')],
  validate,
  async (req, res) => {
    try {
      const { email } = req.body;
      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ message: 'User not found' });

      const otp = String(Math.floor(100000 + Math.random() * 900000));
      user.otp        = otp;
      user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();

      try {
        await sendOTP(email, otp, user.name);
      } catch {
        if (process.env.NODE_ENV === 'development') logger.debug(`📧 Resent OTP for ${email}: ${otp}`);
      }

      res.json({
        message: 'New code sent',
        ...(process.env.NODE_ENV === 'development' && { devOtp: otp }),
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  res.json(req.user);
});

// ── POST /api/auth/register — admin/manager only ─────────────────────────────
router.post(
  '/register',
  protect,
  adminOnly,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('role').isIn(['admin', 'manager', 'cashier']).withMessage('Invalid role'),
  ],
  validate,
  async (req, res) => {
    try {
      const { name, email, password, role, branch } = req.body;
      const exists = await User.findOne({ email });
      if (exists) return res.status(400).json({ message: 'User already exists' });

      const user = await User.create({ name, email, password, role, branch });
      res.status(201).json({
        _id: user._id, name: user.name, email: user.email,
        role: user.role, branch: user.branch,
        token: generateToken(user._id),
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// ── POST /api/auth/forgot-password ────────────────────────────────────────────
router.post(
  '/forgot-password',
  authLimiter,
  [body('email').isEmail().normalizeEmail().withMessage('Valid email is required')],
  validate,
  async (req, res) => {
    try {
      const user = await User.findOne({ email: req.body.email });
      // Always respond 200 — don't reveal whether email exists (prevents user enumeration)
      if (!user) return res.json({ message: 'If that email exists, a reset link has been sent.' });

      // Generate a cryptographically secure reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      user.passwordResetToken   = crypto.createHash('sha256').update(resetToken).digest('hex');
      user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await user.save();

      const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;
      try {
        await sendPasswordReset(user.email, user.name, resetUrl);
      } catch (mailErr) {
        logger.warn(`Password reset email failed: ${mailErr.message}`);
        user.passwordResetToken   = undefined;
        user.passwordResetExpires = undefined;
        await user.save();
        return res.status(500).json({ message: 'Failed to send reset email. Please try again.' });
      }

      res.json({ message: 'If that email exists, a reset link has been sent.' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// ── POST /api/auth/reset-password/:token ──────────────────────────────────────
router.post(
  '/reset-password/:token',
  [body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')],
  validate,
  async (req, res) => {
    try {
      const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
      const user = await User.findOne({
        passwordResetToken:   hashedToken,
        passwordResetExpires: { $gt: new Date() },
      });

      if (!user) return res.status(400).json({ message: 'Reset token is invalid or has expired.' });

      user.password             = req.body.password;
      user.passwordResetToken   = undefined;
      user.passwordResetExpires = undefined;
      await user.save();

      res.json({ message: 'Password reset successful. You can now log in.' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// ── POST /api/auth/verify-manager ────────────────────────────────────────────
router.post('/verify-manager', protect, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password required' });

    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ message: 'Invalid credentials' });

    if (user.role !== 'admin' && user.role !== 'manager')
      return res.status(403).json({ message: 'Override rejected: Admin or Manager only' });

    res.json({ success: true, message: 'Override approved', managerName: user.name });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── PUT /api/auth/profile ─────────────────────────────────────────────────────
router.put(
  '/profile',
  protect,
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('email').optional().isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').optional().isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  validate,
  async (req, res) => {
    try {
      const user = await User.findById(req.user._id);
      if (!user) return res.status(404).json({ message: 'User not found' });

      if (req.body.name)     user.name  = req.body.name;
      if (req.body.email)    user.email = req.body.email;
      if (req.body.password) user.password = req.body.password;

      const updatedUser = await user.save();
      res.json({
        _id: updatedUser._id, name: updatedUser.name, email: updatedUser.email,
        role: updatedUser.role, branch: updatedUser.branch, avatar: updatedUser.avatar,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

module.exports = router;
