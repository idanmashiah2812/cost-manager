const crypto = require('crypto');
const Log = require('../../models/Log');

function safeRequestId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Logs every HTTP request to:
 * 1) Console (via Pino)
 * 2) MongoDB `logs` collection
 */
function requestLogger({ logger, serviceName }) {
  const service = serviceName || process.env.SERVICE_NAME || 'unknown-service';

  return function (req, res, next) {
    const start = process.hrtime.bigint();
    const requestId = safeRequestId();
    req.requestId = requestId;

    res.on('finish', async () => {
      const diffMs = Number(process.hrtime.bigint() - start) / 1e6;
      const entry = {
        timestamp: new Date(),
        service,
        level: 'info',
        message: 'HTTP request',
        requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        responseTimeMs: Math.round(diffMs)
      };

      // Console
      logger.info(entry);

      // MongoDB (never break the API if log-write fails)
      try {
        await Log.create(entry);
      } catch (err) {
        logger.error({ err }, 'Failed to write log to MongoDB');
      }
    });

    next();
  };
}

module.exports = { requestLogger };
