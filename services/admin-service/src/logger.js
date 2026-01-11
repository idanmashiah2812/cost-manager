const pino = require('pino');

function createLogger() {
  const level = process.env.LOG_LEVEL || 'info';

  const isPretty = process.env.NODE_ENV !== 'production';
  if (isPretty) {
    return pino({
      level,
      base: { service: process.env.SERVICE_NAME || 'unknown-service' },
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard' }
      }
    });
  }

  return pino({
    level,
    base: { service: process.env.SERVICE_NAME || 'unknown-service' }
  });
}

module.exports = { createLogger };
