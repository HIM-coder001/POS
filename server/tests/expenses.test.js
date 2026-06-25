/**
 * Integration tests for /api/expenses routes
 * Validates: Requirements 2.7, 2.8, 2.11
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

jest.mock('../models/Expense');

// ── App setup ────────────────────────────────────────────────────────────────

const request = require('supertest');
const express = require('express');
const expensesRouter = require('../routes/expenses');
const Expense = require('../models/Expense');

const app = express();
app.use(express.json());
app.use('/api/expenses', expensesRouter);

// ── Helpers / shared data ────────────────────────────────────────────────────

const VALID_PAYLOAD = {
  category: 'Utilities',
  description: 'Monthly electricity bill',
  amount: 2500.00,
  date: '2025-01-15',
};

// ── Test suite ───────────────────────────────────────────────────────────────

describe('GET /api/expenses', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns records sorted by date descending', async () => {
    const mockRecords = [
      { _id: 'e2', date: '2025-02-01', category: 'Rent', amount: 15000 },
      { _id: 'e1', date: '2025-01-01', category: 'Utilities', amount: 2500 },
    ];

    // Build a chainable mock: find().populate().sort()
    const chainMock = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue(mockRecords),
    };
    Expense.find.mockReturnValue(chainMock);

    const res = await request(app).get('/api/expenses');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    // First record should have the later date (sorted -1)
    expect(res.body[0]._id).toBe('e2');
    expect(res.body[1]._id).toBe('e1');

    // Verify sort was called with the correct argument
    expect(chainMock.sort).toHaveBeenCalledWith({ date: -1 });
    // Verify populate was called
    expect(chainMock.populate).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/expenses', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns 201 with valid payload', async () => {
    const expenseInstance = {
      _id: 'newExpenseId',
      ...VALID_PAYLOAD,
      createdBy: 'mockUserId',
      save: jest.fn().mockResolvedValue(undefined),
      populate: jest.fn().mockImplementation(async () => {
        expenseInstance.createdBy = { _id: 'mockUserId', name: 'Test Admin' };
        return expenseInstance;
      }),
    };
    Expense.mockImplementation(() => expenseInstance);

    const res = await request(app)
      .post('/api/expenses')
      .send(VALID_PAYLOAD);

    expect(res.status).toBe(201);
    expect(expenseInstance.save).toHaveBeenCalledTimes(1);
  });

  it('returns 422 when amount is 0', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .send({ ...VALID_PAYLOAD, amount: 0 });

    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty('message');
  });

  it('returns 422 when category exceeds 100 characters', async () => {
    const longCategory = 'A'.repeat(101);

    const res = await request(app)
      .post('/api/expenses')
      .send({ ...VALID_PAYLOAD, category: longCategory });

    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty('message');
  });
});

describe('DELETE /api/expenses/:id', () => {
  afterEach(() => jest.clearAllMocks());

  it('removes the record and returns 200', async () => {
    const mockExpense = {
      _id: 'expenseToDelete',
      category: 'Utilities',
      amount: 2500,
    };
    Expense.findByIdAndDelete.mockResolvedValue(mockExpense);

    const res = await request(app).delete('/api/expenses/expenseToDelete');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
    expect(Expense.findByIdAndDelete).toHaveBeenCalledWith('expenseToDelete');
  });
});
