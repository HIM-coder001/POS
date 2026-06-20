const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const { protect } = require('../middleware/auth');

// ── In-memory callback store ──────────────────────────────────────────────────
// Keyed by CheckoutRequestID → { status, mpesaRef, amount, phone, resultDesc }
// status: 'pending' | 'success' | 'failed' | 'cancelled'
const callbackStore = new Map();

// Auto-clean entries older than 10 minutes
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [key, val] of callbackStore.entries()) {
    if (val.timestamp < cutoff) callbackStore.delete(key);
  }
}, 60_000);

// ── Helpers ───────────────────────────────────────────────────────────────────

const getMpesaToken = async () => {
  const isSandbox = process.env.MPESA_ENV === 'sandbox';
  const url = isSandbox
    ? 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
    : 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';

  const auth = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString('base64');

  const { data } = await axios.get(url, {
    headers: { Authorization: `Basic ${auth}` },
    timeout: 10000,
  });
  if (!data.access_token) throw new Error('Empty token from Safaricom OAuth');
  return data.access_token;
};

const getTimestamp = () => {
  const eat = new Date(Date.now() + 3 * 3600 * 1000);
  return eat.toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
};

const getPassword = (shortcode, passkey, timestamp) =>
  Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

const formatPhone = (phone) => {
  let p = String(phone).replace(/\D/g, '');
  if (p.startsWith('0'))    p = '254' + p.slice(1);
  if (p.startsWith('+'))    p = p.slice(1);
  if (!p.startsWith('254')) p = '254' + p;
  return p;
};

const validateEnv = () => {
  const required = ['MPESA_CONSUMER_KEY', 'MPESA_CONSUMER_SECRET', 'MPESA_SHORTCODE', 'MPESA_PASSKEY', 'MPESA_CALLBACK_URL'];
  const missing  = required.filter(k => !process.env[k]);
  if (missing.length) throw new Error(`M-Pesa not configured. Missing: ${missing.join(', ')}`);
  if (process.env.MPESA_ENV !== 'sandbox' && process.env.MPESA_CALLBACK_URL?.includes('yourdomain')) {
    throw new Error('MPESA_CALLBACK_URL must be a real HTTPS URL in production.');
  }
};

// ── POST /api/mpesa/stk-push ──────────────────────────────────────────────────
router.post('/stk-push', protect, async (req, res) => {
  try {
    validateEnv();

    const { phone, amount, orderId } = req.body;
    if (!phone || !amount) return res.status(400).json({ message: 'phone and amount are required' });

    const formattedPhone  = formatPhone(phone);
    const roundedAmount   = Math.max(1, Math.ceil(Number(amount)));
    const token           = await getMpesaToken();
    const timestamp       = getTimestamp();
    const shortcode       = process.env.MPESA_SHORTCODE;
    const password        = getPassword(shortcode, process.env.MPESA_PASSKEY, timestamp);
    const baseUrl         = process.env.MPESA_ENV === 'sandbox'
      ? 'https://sandbox.safaricom.co.ke'
      : 'https://api.safaricom.co.ke';

    const isTill          = /^[89]/.test(String(shortcode));
    const transactionType = isTill ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline';

    const payload = {
      BusinessShortCode: shortcode,
      Password:          password,
      Timestamp:         timestamp,
      TransactionType:   transactionType,
      Amount:            roundedAmount,
      PartyA:            formattedPhone,
      PartyB:            shortcode,
      PhoneNumber:       formattedPhone,
      CallBackURL:       process.env.MPESA_CALLBACK_URL,
      AccountReference:  String(orderId || 'POS').slice(0, 12),
      TransactionDesc:   'POS Payment',
    };

    console.log('📱 STK Push →', { ...payload, Password: '***' });

    const { data } = await axios.post(
      `${baseUrl}/mpesa/stkpush/v1/processrequest`,
      payload,
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 15000 }
    );

    console.log('📱 STK Response:', data);

    if (data.ResponseCode !== '0') {
      return res.status(400).json({
        message: data.ResponseDescription || 'STK Push rejected by Safaricom',
        darajaError: data,
      });
    }

    // Seed the store as 'pending' so polling can start immediately
    callbackStore.set(data.CheckoutRequestID, {
      status:    'pending',
      timestamp: Date.now(),
    });

    res.json({
      success:           true,
      checkoutRequestId: data.CheckoutRequestID,
      merchantRequestId: data.MerchantRequestID,
      message:           "STK Push sent — waiting for customer PIN.",
    });

  } catch (err) {
    const de = err.response?.data;
    console.error('❌ STK Push Error:', de || err.message);
    res.status(500).json({
      message:   de?.errorMessage || de?.ResponseDescription || err.message,
      errorCode: de?.errorCode,
    });
  }
});

// ── POST /api/mpesa/callback — Safaricom hits this after customer acts ─────────
router.post('/callback', express.json(), (req, res) => {
  try {
    const { Body } = req.body || {};
    if (!Body?.stkCallback) return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

    const { ResultCode, ResultDesc, CallbackMetadata, CheckoutRequestID } = Body.stkCallback;

    // ResultCode 0 = paid, 1032 = cancelled by user, others = failed
    if (ResultCode === 0) {
      const meta = {};
      (CallbackMetadata?.Item || []).forEach(item => { meta[item.Name] = item.Value; });

      console.log('✅ M-Pesa Paid:', {
        CheckoutRequestID,
        receipt: meta.MpesaReceiptNumber,
        amount:  meta.Amount,
        phone:   meta.PhoneNumber,
      });

      callbackStore.set(CheckoutRequestID, {
        status:     'success',
        mpesaRef:   meta.MpesaReceiptNumber,
        amount:     meta.Amount,
        phone:      meta.PhoneNumber,
        timestamp:  Date.now(),
      });

    } else {
      const isCancelled = ResultCode === 1032;
      console.log(isCancelled ? '🚫 M-Pesa Cancelled:' : '❌ M-Pesa Failed:', ResultCode, ResultDesc);

      callbackStore.set(CheckoutRequestID, {
        status:     isCancelled ? 'cancelled' : 'failed',
        resultDesc: ResultDesc,
        resultCode: ResultCode,
        timestamp:  Date.now(),
      });
    }

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

  } catch (err) {
    console.error('Callback parse error:', err);
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' }); // always ACK Safaricom
  }
});

// ── GET /api/mpesa/status/:checkoutRequestId — frontend polls this ────────────
router.get('/status/:checkoutRequestId', protect, (req, res) => {
  const entry = callbackStore.get(req.params.checkoutRequestId);

  if (!entry) {
    // Not yet received — still pending
    return res.json({ status: 'pending' });
  }

  res.json(entry);
});

// ── POST /api/mpesa/query — manual Daraja status query (fallback) ─────────────
router.post('/query', protect, async (req, res) => {
  try {
    validateEnv();
    const { checkoutRequestId } = req.body;
    if (!checkoutRequestId) return res.status(400).json({ message: 'checkoutRequestId is required' });

    const token     = await getMpesaToken();
    const timestamp = getTimestamp();
    const shortcode = process.env.MPESA_SHORTCODE;
    const password  = getPassword(shortcode, process.env.MPESA_PASSKEY, timestamp);
    const baseUrl   = process.env.MPESA_ENV === 'sandbox'
      ? 'https://sandbox.safaricom.co.ke'
      : 'https://api.safaricom.co.ke';

    const { data } = await axios.post(
      `${baseUrl}/mpesa/stkpushquery/v1/query`,
      { BusinessShortCode: shortcode, Password: password, Timestamp: timestamp, CheckoutRequestID: checkoutRequestId },
      { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }
    );

    res.json(data);
  } catch (err) {
    const de = err.response?.data;
    console.error('❌ M-Pesa Query Error:', de || err.message);
    res.status(500).json({ message: de?.errorMessage || err.message, errorCode: de?.errorCode });
  }
});

module.exports = router;
