const express = require('express');
const router = express.Router();
const axios = require('axios');
const { protect } = require('../middleware/auth');

// Helper: Get M-Pesa OAuth token
const getMpesaToken = async () => {
  const auth = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString('base64');

  const url =
    process.env.MPESA_ENV === 'sandbox'
      ? 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
      : 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';

  const res = await axios.get(url, { headers: { Authorization: `Basic ${auth}` } });
  return res.data.access_token;
};

// Helper: Format phone (254XXXXXXXXX)
const formatPhone = (phone) => {
  phone = phone.replace(/\D/g, '');
  if (phone.startsWith('0')) phone = '254' + phone.slice(1);
  if (phone.startsWith('+')) phone = phone.slice(1);
  return phone;
};

// POST /api/mpesa/stk-push — initiate STK push
router.post('/stk-push', protect, async (req, res) => {
  try {
    const { phone, amount, orderId } = req.body;
    if (!phone || !amount) return res.status(400).json({ message: 'Phone and amount required' });

    const token = await getMpesaToken();
    const timestamp = new Date()
      .toISOString()
      .replace(/[-T:.Z]/g, '')
      .slice(0, 14);
    const password = Buffer.from(
      `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
    ).toString('base64');

    const baseUrl =
      process.env.MPESA_ENV === 'sandbox'
        ? 'https://sandbox.safaricom.co.ke'
        : 'https://api.safaricom.co.ke';

    const payload = {
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.ceil(amount),
      PartyA: formatPhone(phone),
      PartyB: process.env.MPESA_SHORTCODE,
      PhoneNumber: formatPhone(phone),
      CallBackURL: process.env.MPESA_CALLBACK_URL,
      AccountReference: orderId || 'RetailEdge POS',
      TransactionDesc: 'POS Payment',
    };

    const response = await axios.post(
      `${baseUrl}/mpesa/stkpush/v1/processrequest`,
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    res.json({
      success: true,
      checkoutRequestId: response.data.CheckoutRequestID,
      merchantRequestId: response.data.MerchantRequestID,
      message: 'STK Push sent. Customer will be prompted to enter PIN.',
    });
  } catch (error) {
    console.error('M-Pesa STK Push Error:', error.response?.data || error.message);
    res.status(500).json({
      message: 'M-Pesa request failed',
      error: error.response?.data || error.message,
    });
  }
});

// POST /api/mpesa/callback — Safaricom callback
router.post('/callback', express.json(), (req, res) => {
  const { Body } = req.body;
  if (!Body?.stkCallback) return res.status(400).json({ message: 'Invalid callback' });

  const { ResultCode, ResultDesc, CallbackMetadata, CheckoutRequestID } = Body.stkCallback;

  if (ResultCode === 0) {
    const meta = {};
    CallbackMetadata.Item.forEach((item) => {
      meta[item.Name] = item.Value;
    });
    console.log('✅ M-Pesa Payment Success:', {
      CheckoutRequestID,
      MpesaReceiptNumber: meta.MpesaReceiptNumber,
      Amount: meta.Amount,
      PhoneNumber: meta.PhoneNumber,
    });
    // TODO: Update sale record with MpesaReceiptNumber
  } else {
    console.log('❌ M-Pesa Payment Failed:', ResultDesc);
  }

  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

// POST /api/mpesa/query — check STK push status
router.post('/query', protect, async (req, res) => {
  try {
    const { checkoutRequestId } = req.body;
    const token = await getMpesaToken();

    const timestamp = new Date()
      .toISOString()
      .replace(/[-T:.Z]/g, '')
      .slice(0, 14);
    const password = Buffer.from(
      `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
    ).toString('base64');

    const baseUrl =
      process.env.MPESA_ENV === 'sandbox'
        ? 'https://sandbox.safaricom.co.ke'
        : 'https://api.safaricom.co.ke';

    const response = await axios.post(
      `${baseUrl}/mpesa/stkpushquery/v1/query`,
      {
        BusinessShortCode: process.env.MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ message: error.response?.data || error.message });
  }
});

module.exports = router;
