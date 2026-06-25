/**
 * Property 6: Receipt settings round-trip persistence
 * Validates: Requirements 3.2
 *
 * Generates valid receipt settings objects (font type from enum, font size
 * from enum, boolean toggles, string phone/address); calls PUT /api/settings
 * then GET /api/settings; asserts all 7 receipt fields exactly match saved values.
 *
 * Uses supertest + jest mocks to avoid a real DB connection.
 */

// ── Mocks (must be declared before any require of the mocked modules) ────────

jest.mock('../middleware/auth', () => ({
  protect: (req, res, next) => {
    req.user = { _id: 'mockUserId', role: 'admin', name: 'Test Admin' };
    next();
  },
  adminOnly: (req, res, next) => next(),
}));

jest.mock('../models/BusinessSetting');

// ── App setup ────────────────────────────────────────────────────────────────

const request = require('supertest');
const express = require('express');
const settingsRouter = require('../routes/settings');
const BusinessSetting = require('../models/BusinessSetting');

const app = express();
app.use(express.json());
app.use('/api/settings', settingsRouter);

// ── Receipt settings value enums ─────────────────────────────────────────────

const FONT_TYPES = ['Arial', 'Courier New', 'Georgia', 'Times New Roman', 'Verdana'];
const FONT_SIZES = ['small', 'medium', 'large'];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a random receipt settings object */
function generateReceiptSettings() {
  return {
    receiptPhone: `+254 7${Math.floor(Math.random() * 90000000 + 10000000)}`,
    receiptAddress: `${Math.floor(Math.random() * 999)} Test Street, Nairobi`,
    receiptFontType: FONT_TYPES[Math.floor(Math.random() * FONT_TYPES.length)],
    receiptFontSize: FONT_SIZES[Math.floor(Math.random() * FONT_SIZES.length)],
    receiptShowTaxBreakdown: Math.random() > 0.5,
    receiptShowServedBy: Math.random() > 0.5,
    receiptShowDateTime: Math.random() > 0.5,
  };
}

// ── Test suite ───────────────────────────────────────────────────────────────

describe('Property 6: Receipt settings round-trip persistence', () => {
  afterEach(() => jest.clearAllMocks());

  it('PUT then GET returns the same 7 receipt fields for multiple random payloads', async () => {
    // Run multiple iterations to approximate a property test
    for (let i = 0; i < 10; i++) {
      const receiptSettings = generateReceiptSettings();
      let storedSettings = { _id: 'settingsId', ...receiptSettings };

      // Mock findOne for GET — returns whatever was stored
      BusinessSetting.findOne.mockResolvedValue(storedSettings);

      // Mock findByIdAndUpdate for PUT — returns updated doc
      BusinessSetting.findByIdAndUpdate.mockImplementation((_id, body, _opts) => {
        storedSettings = { ...storedSettings, ...body };
        return Promise.resolve(storedSettings);
      });

      // PUT /api/settings
      const putRes = await request(app)
        .put('/api/settings')
        .send(receiptSettings);

      expect(putRes.status).toBe(200);

      // Update findOne mock to return the updated stored settings
      BusinessSetting.findOne.mockResolvedValue(storedSettings);

      // GET /api/settings
      const getRes = await request(app).get('/api/settings');

      expect(getRes.status).toBe(200);

      // Assert all 7 receipt fields match
      expect(getRes.body.receiptPhone).toBe(receiptSettings.receiptPhone);
      expect(getRes.body.receiptAddress).toBe(receiptSettings.receiptAddress);
      expect(getRes.body.receiptFontType).toBe(receiptSettings.receiptFontType);
      expect(getRes.body.receiptFontSize).toBe(receiptSettings.receiptFontSize);
      expect(getRes.body.receiptShowTaxBreakdown).toBe(receiptSettings.receiptShowTaxBreakdown);
      expect(getRes.body.receiptShowServedBy).toBe(receiptSettings.receiptShowServedBy);
      expect(getRes.body.receiptShowDateTime).toBe(receiptSettings.receiptShowDateTime);

      jest.clearAllMocks();
    }
  });

  it('individual receipt fields persist correctly', async () => {
    // Test each field in isolation
    const testCases = [
      { receiptPhone: '+254 700 111 222' },
      { receiptAddress: '123 Kenyatta Ave, Nairobi' },
      { receiptFontType: 'Courier New' },
      { receiptFontSize: 'large' },
      { receiptShowTaxBreakdown: true },
      { receiptShowServedBy: false },
      { receiptShowDateTime: false },
    ];

    for (const testPayload of testCases) {
      const baseline = {
        _id: 'settingsId',
        receiptPhone: '',
        receiptAddress: '',
        receiptFontType: 'Arial',
        receiptFontSize: 'medium',
        receiptShowTaxBreakdown: false,
        receiptShowServedBy: true,
        receiptShowDateTime: true,
      };

      let stored = { ...baseline };
      BusinessSetting.findOne.mockResolvedValue(stored);
      BusinessSetting.findByIdAndUpdate.mockImplementation((_id, body, _opts) => {
        stored = { ...stored, ...body };
        return Promise.resolve(stored);
      });

      const putRes = await request(app)
        .put('/api/settings')
        .send(testPayload);

      expect(putRes.status).toBe(200);

      BusinessSetting.findOne.mockResolvedValue(stored);

      const getRes = await request(app).get('/api/settings');
      expect(getRes.status).toBe(200);

      // The specific field we set should be updated
      const [key, value] = Object.entries(testPayload)[0];
      expect(getRes.body[key]).toBe(value);

      jest.clearAllMocks();
    }
  });
});
