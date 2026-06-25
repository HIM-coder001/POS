jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

jest.mock('../middleware/auth', () => ({
  protect: (req, res, next) => next(),
  adminOnly: (req, res, next) => next(),
}));

jest.mock('../middleware/rateLimiter', () => ({
  authLimiter: (req, res, next) => next(),
}));

jest.mock('../middleware/validate', () => (req, res, next) => next());

jest.mock('../utils/logger', () => ({
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  http: jest.fn(),
  stream: { write: jest.fn() },
}));

jest.mock('../models/User');

process.env.EMAIL_USER = 'test@example.com';
process.env.EMAIL_PASS = 'password';
process.env.EMAIL_FROM = 'RetailEdge POS <test@example.com>';
process.env.JWT_SECRET = 'test-jwt-secret';

const request = require('supertest');
const express = require('express');
const nodemailer = require('nodemailer');

const sendMailMock = jest.fn();
const verifyMock = jest.fn();

nodemailer.createTransport.mockReturnValue({
  sendMail: sendMailMock,
  verify: verifyMock,
});

const authRouter = require('../routes/auth');
const User = require('../models/User');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  return app;
}

function buildUser() {
  return {
    _id: 'user-1',
    name: 'Jane Admin',
    email: 'jane@example.com',
    role: 'admin',
    branch: 'Main',
    avatar: '',
    isActive: true,
    otp: undefined,
    otpExpires: undefined,
    matchPassword: jest.fn().mockResolvedValue(true),
    save: jest.fn().mockResolvedValue(true),
  };
}

describe('auth OTP email delivery', () => {
  const app = buildApp();

  beforeEach(() => {
    jest.clearAllMocks();
    sendMailMock.mockReset();
    verifyMock.mockReset();
    nodemailer.createTransport.mockReturnValue({
      sendMail: sendMailMock,
      verify: verifyMock,
    });
  });

  it('sends OTP email during login', async () => {
    const user = buildUser();
    User.findOne.mockResolvedValue(user);
    verifyMock.mockResolvedValue(true);
    sendMailMock.mockResolvedValue({ messageId: 'msg-1' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'secret123' });

    expect(res.status).toBe(200);
    expect(res.body.otpSent).toBe(true);
    expect(verifyMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock.mock.calls[0][0].to).toBe(user.email);
    expect(sendMailMock.mock.calls[0][0].subject).toContain('Login Code');
  });

  it('returns 503 and clears OTP when login email sending fails', async () => {
    const user = buildUser();
    User.findOne.mockResolvedValue(user);
    verifyMock.mockResolvedValue(true);
    sendMailMock.mockRejectedValue(new Error('SMTP down'));

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'secret123' });

    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/Unable to send OTP email/i);
    expect(user.otp).toBeUndefined();
    expect(user.otpExpires).toBeUndefined();
  });

  it('returns 503 when resend OTP email fails', async () => {
    const user = buildUser();
    User.findOne.mockResolvedValue(user);
    verifyMock.mockResolvedValue(true);
    sendMailMock.mockRejectedValue(new Error('SMTP down'));

    const res = await request(app)
      .post('/api/auth/resend-otp')
      .send({ email: user.email });

    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/Unable to resend OTP email/i);
    expect(user.otp).toBeUndefined();
    expect(user.otpExpires).toBeUndefined();
  });

  it('verifies a valid OTP and returns a JWT', async () => {
    const user = buildUser();
    user.otp = '123456';
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    User.findOne.mockResolvedValue(user);

    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: user.email, otp: '123456' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(user.otp).toBeUndefined();
    expect(user.otpExpires).toBeUndefined();
    expect(user.save).toHaveBeenCalled();
  });

  it('rejects an incorrect OTP', async () => {
    const user = buildUser();
    user.otp = '123456';
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    User.findOne.mockResolvedValue(user);

    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: user.email, otp: '654321' });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Incorrect code/i);
    expect(user.save).not.toHaveBeenCalled();
  });

  it('rejects expired OTPs', async () => {
    const user = buildUser();
    user.otp = '123456';
    user.otpExpires = new Date(Date.now() - 60 * 1000);
    User.findOne.mockResolvedValue(user);

    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: user.email, otp: '123456' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/expired/i);
  });
});
