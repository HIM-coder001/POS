const winston = require('winston');
const path = require('path');
const { isProduction, getNodeEnv } = require('../config/runtime');

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

const logger = winston.createLogger({
  level: isProduction() ? 'info' : 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    logFormat
  ),
  transports: [
    // Always log to console (colorized in dev, plain in prod)
    new winston.transports.Console({
      format: isProduction()
        ? combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true }), logFormat)
        : combine(colorize(), timestamp({ format: 'HH:mm:ss' }), errors({ stack: true }), logFormat),
    }),
  ],
});

// In production, also write to log files
if (isProduction()) {
  logger.add(new winston.transports.File({
    filename: path.join(__dirname, '../logs/error.log'),
    level: 'error',
  }));
  logger.add(new winston.transports.File({
    filename: path.join(__dirname, '../logs/combined.log'),
  }));
}

// Morgan-compatible stream for HTTP request logging
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = logger;
