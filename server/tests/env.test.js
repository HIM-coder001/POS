const { getMongoUri, validateServerEnv } = require('../config/env');
const { getNodeEnv, isDevelopment, isProduction } = require('../config/runtime');

describe('server env helpers', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('prefers MONGO_URI but falls back to MONGODB_URI', () => {
    process.env.MONGO_URI = 'mongodb://mongo-uri';
    process.env.MONGODB_URI = 'mongodb://mongodb-uri';
    expect(getMongoUri()).toBe('mongodb://mongo-uri');

    delete process.env.MONGO_URI;
    expect(getMongoUri()).toBe('mongodb://mongodb-uri');
  });

  it('throws when core env vars are missing', () => {
    delete process.env.JWT_SECRET;
    delete process.env.MONGO_URI;
    delete process.env.MONGODB_URI;

    expect(() => validateServerEnv({ warn: jest.fn() })).toThrow(
      /Missing required environment variables/
    );
  });

  it('warns when SMTP creds are missing but still returns mongo config', () => {
    process.env.JWT_SECRET = 'secret';
    process.env.MONGO_URI = 'mongodb://mongo-uri';
    delete process.env.EMAIL_USER;
    delete process.env.EMAIL_PASS;

    const logger = { warn: jest.fn() };
    const config = validateServerEnv(logger);

    expect(config.mongoUri).toBe('mongodb://mongo-uri');
    expect(logger.warn).toHaveBeenCalled();
  });

  it('defaults to development when NODE_ENV is not set', () => {
    delete process.env.NODE_ENV;

    expect(getNodeEnv()).toBe('development');
    expect(isDevelopment()).toBe(true);
    expect(isProduction()).toBe(false);
  });
});
