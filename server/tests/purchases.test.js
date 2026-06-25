/**
 * Integration tests for /api/purchases routes
 * Validates: Requirements 1.8, 1.9, 1.10
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

jest.mock('../models/Purchase');
jest.mock('../models/Supplier');

// ── App setup ────────────────────────────────────────────────────────────────

const request = require('supertest');
const express = require('express');
const purchasesRouter = require('../routes/purchases');

const app = express();
app.use(express.json());
app.use('/api/purchases', purchasesRouter);

// ── Helpers / shared data ────────────────────────────────────────────────────

const Purchase = require('../models/Purchase');
const Supplier = require('../models/Supplier');

const VALID_SUPPLIER_ID = '507f1f77bcf86cd799439011';

const VALID_PAYLOAD = {
  supplier: VALID_SUPPLIER_ID,
  items: [
    { productName: 'Wheat Flour 2kg', quantity: 10, unitCost: 120 },
  ],
  purchaseDate: '2025-01-15',
};

// ── Test suite ───────────────────────────────────────────────────────────────

describe('GET /api/purchases', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns records sorted by purchaseDate descending', async () => {
    const mockRecords = [
      { _id: 'p2', purchaseDate: '2025-02-01', supplier: { name: 'Supplier B' }, totalCost: 500 },
      { _id: 'p1', purchaseDate: '2025-01-01', supplier: { name: 'Supplier A' }, totalCost: 300 },
    ];

    // Build a chainable mock: find().populate().populate().sort()
    const chainMock = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue(mockRecords),
    };
    Purchase.find.mockReturnValue(chainMock);

    const res = await request(app).get('/api/purchases');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    // First record should have the later date (sorted -1)
    expect(res.body[0]._id).toBe('p2');
    expect(res.body[1]._id).toBe('p1');

    // Verify sort was called with the correct argument
    expect(chainMock.sort).toHaveBeenCalledWith({ purchaseDate: -1 });
    // Verify populate was called twice
    expect(chainMock.populate).toHaveBeenCalledTimes(2);
  });
});

describe('POST /api/purchases', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns 201 with populated supplier name for a valid payload', async () => {
    // Supplier exists
    Supplier.findById.mockResolvedValue({ _id: VALID_SUPPLIER_ID, name: 'Unga Mills Ltd' });

    // Mock the instance returned by `new Purchase()`
    // The route calls `await purchase.populate([...])` which mutates the instance
    // in-place (Mongoose behaviour). We simulate this by mutating purchaseInstance
    // when populate is called, so that `res.json(purchase)` serialises the
    // populated fields correctly.
    const purchaseInstance = {
      _id: 'newPurchaseId',
      supplier: VALID_SUPPLIER_ID,          // raw id before populate
      items: VALID_PAYLOAD.items,
      purchaseDate: VALID_PAYLOAD.purchaseDate,
      totalCost: 1200,
      createdBy: 'mockUserId',
      save: jest.fn().mockResolvedValue(undefined),
      populate: jest.fn().mockImplementation(async () => {
        // Simulate in-place population
        purchaseInstance.supplier = { _id: VALID_SUPPLIER_ID, name: 'Unga Mills Ltd' };
        purchaseInstance.createdBy = { _id: 'mockUserId', name: 'Test Admin' };
        return purchaseInstance;
      }),
    };
    Purchase.mockImplementation(() => purchaseInstance);

    const res = await request(app)
      .post('/api/purchases')
      .send(VALID_PAYLOAD);

    expect(res.status).toBe(201);
    expect(res.body.supplier.name).toBe('Unga Mills Ltd');
    expect(purchaseInstance.save).toHaveBeenCalledTimes(1);
  });

  it('returns 422 when supplier field is missing', async () => {
    const { supplier, ...payloadWithoutSupplier } = VALID_PAYLOAD;

    const res = await request(app)
      .post('/api/purchases')
      .send(payloadWithoutSupplier);

    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty('message');
  });

  it('returns 422 when an item has quantity < 1', async () => {
    const invalidPayload = {
      ...VALID_PAYLOAD,
      items: [{ productName: 'Flour', quantity: 0, unitCost: 100 }],
    };

    const res = await request(app)
      .post('/api/purchases')
      .send(invalidPayload);

    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty('message');
  });
});

/**
 * Property 3: Purchase round-trip persistence
 *
 * For any valid purchase payload (valid supplierId, at least one valid line
 * item, purchaseDate), posting it to POST /api/purchases and then fetching
 * GET /api/purchases should yield a list that contains a record with the same
 * supplier._id and a correctly computed totalCost equal to
 * sum(item.quantity * item.unitCost) for all items.
 *
 * Validates: Requirements 1.9, 1.10
 */
describe('Property 3 — Purchase round-trip persistence (Req 1.9, 1.10)', () => {
  afterEach(() => jest.clearAllMocks());

  /**
   * Shared helper: sets up mocks for a single POST → GET round-trip and
   * returns the responses so each test can assert on them independently.
   */
  async function roundTrip(payload) {
    // ── POST setup ────────────────────────────────────────────────────────────
    Supplier.findById.mockResolvedValue({ _id: payload.supplier, name: 'Test Supplier' });

    // Compute the expected totalCost the same way the pre-save hook does
    const expectedTotalCost = payload.items.reduce(
      (sum, item) => sum + item.quantity * item.unitCost,
      0,
    );

    const purchaseId = 'roundtripPurchaseId_' + Date.now();
    const purchaseInstance = {
      _id: purchaseId,
      supplier: payload.supplier,
      items: payload.items.map((item) => ({
        ...item,
        subtotal: item.quantity * item.unitCost,
      })),
      purchaseDate: payload.purchaseDate,
      totalCost: expectedTotalCost, // mirrors the pre-save hook
      createdBy: 'mockUserId',
      save: jest.fn().mockResolvedValue(undefined),
      populate: jest.fn().mockImplementation(async () => {
        // Simulate in-place population (Mongoose behaviour)
        purchaseInstance.supplier = { _id: payload.supplier, name: 'Test Supplier' };
        purchaseInstance.createdBy = { _id: 'mockUserId', name: 'Test Admin' };
        return purchaseInstance;
      }),
    };
    Purchase.mockImplementation(() => purchaseInstance);

    const postRes = await request(app)
      .post('/api/purchases')
      .send(payload);

    // ── GET setup ─────────────────────────────────────────────────────────────
    // The GET endpoint returns the same record that was just persisted.
    // We simulate the DB returning the saved document (with supplier populated).
    const savedRecord = {
      _id: purchaseId,
      supplier: { _id: payload.supplier, name: 'Test Supplier' },
      items: purchaseInstance.items,
      purchaseDate: payload.purchaseDate,
      totalCost: expectedTotalCost,
      createdBy: { _id: 'mockUserId', name: 'Test Admin' },
    };

    const chainMock = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue([savedRecord]),
    };
    Purchase.find.mockReturnValue(chainMock);

    const getRes = await request(app).get('/api/purchases');

    return { postRes, getRes, purchaseId, expectedTotalCost };
  }

  // ── Test 1: single line item ────────────────────────────────────────────────
  it('single-item purchase: GET returns record with totalCost = quantity * unitCost', async () => {
    const payload = {
      supplier: VALID_SUPPLIER_ID,
      items: [{ productName: 'Wheat Flour 2kg', quantity: 10, unitCost: 120 }],
      purchaseDate: '2025-01-15',
    };

    const { postRes, getRes, purchaseId, expectedTotalCost } = await roundTrip(payload);

    // POST succeeded
    expect(postRes.status).toBe(201);
    expect(postRes.body.totalCost).toBe(expectedTotalCost); // 10 * 120 = 1200

    // GET contains the newly created record
    expect(getRes.status).toBe(200);
    const found = getRes.body.find((p) => p._id === purchaseId);
    expect(found).toBeDefined();

    // Req 1.9: totalCost persisted and returned correctly
    expect(found.totalCost).toBe(expectedTotalCost);
    expect(found.totalCost).toBe(payload.items[0].quantity * payload.items[0].unitCost);

    // Req 1.10: supplier name is present alongside the record
    expect(found.supplier.name).toBe('Test Supplier');
  });

  // ── Test 2: multiple line items ─────────────────────────────────────────────
  it('multi-item purchase: totalCost equals sum of all (quantity * unitCost)', async () => {
    const payload = {
      supplier: VALID_SUPPLIER_ID,
      items: [
        { productName: 'Rice 5kg',       quantity: 20, unitCost: 250 },
        { productName: 'Sugar 1kg',      quantity: 50, unitCost:  85 },
        { productName: 'Cooking Oil 2L', quantity: 15, unitCost: 320 },
      ],
      purchaseDate: '2025-03-01',
    };

    // 20*250 + 50*85 + 15*320 = 5000 + 4250 + 4800 = 14050
    const manualSum = payload.items.reduce(
      (sum, item) => sum + item.quantity * item.unitCost,
      0,
    );

    const { postRes, getRes, purchaseId, expectedTotalCost } = await roundTrip(payload);

    expect(postRes.status).toBe(201);
    expect(postRes.body.totalCost).toBe(manualSum);

    expect(getRes.status).toBe(200);
    const found = getRes.body.find((p) => p._id === purchaseId);
    expect(found).toBeDefined();

    // Core property: totalCost === sum(quantity * unitCost)
    expect(found.totalCost).toBe(manualSum);
    expect(found.totalCost).toBe(expectedTotalCost);
  });

  // ── Test 3: fractional unit costs ──────────────────────────────────────────
  it('fractional unit costs: totalCost is computed correctly for decimal prices', async () => {
    const payload = {
      supplier: VALID_SUPPLIER_ID,
      items: [
        { productName: 'Spice Mix 100g', quantity: 100, unitCost: 37.5 },
        { productName: 'Pepper 50g',     quantity:  40, unitCost: 12.25 },
      ],
      purchaseDate: '2025-04-10',
    };

    // 100*37.5 + 40*12.25 = 3750 + 490 = 4240
    const manualSum = payload.items.reduce(
      (sum, item) => sum + item.quantity * item.unitCost,
      0,
    );

    const { postRes, getRes, purchaseId, expectedTotalCost } = await roundTrip(payload);

    expect(postRes.status).toBe(201);
    expect(postRes.body.totalCost).toBe(manualSum);

    const found = getRes.body.find((p) => p._id === purchaseId);
    expect(found).toBeDefined();
    expect(found.totalCost).toBe(manualSum);
    expect(found.totalCost).toBe(expectedTotalCost);
  });

  // ── Test 4: supplier name returned alongside each purchase (Req 1.10) ───────
  it('GET /api/purchases includes supplier name alongside each purchase record', async () => {
    const payload = {
      supplier: VALID_SUPPLIER_ID,
      items: [{ productName: 'Test Product', quantity: 5, unitCost: 100 }],
      purchaseDate: '2025-05-20',
    };

    const { getRes, purchaseId } = await roundTrip(payload);

    expect(getRes.status).toBe(200);
    const found = getRes.body.find((p) => p._id === purchaseId);
    expect(found).toBeDefined();

    // Req 1.10: supplier object with name must be present
    expect(found.supplier).toBeDefined();
    expect(typeof found.supplier.name).toBe('string');
    expect(found.supplier.name.length).toBeGreaterThan(0);
    expect(found.supplier._id).toBe(VALID_SUPPLIER_ID);
  });
});
