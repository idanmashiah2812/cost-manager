const Log = require('../../models/Log');

/**
 * Write an additional "endpoint accessed" (or any custom) log entry.
 * We intentionally do not throw if logging fails.
 */
function auditLog(logger, { level = 'info', message, req, meta = {}, serviceName }) {
  const service = serviceName || process.env.SERVICE_NAME || 'unknown-service';

  const entry = {
    timestamp: new Date(),
    service,
    level,
    message,
    requestId: req?.requestId,
    method: req?.method,
    path: req?.originalUrl,
    meta
  };

  // Console
  if (level === 'error') logger.error(entry);
  else if (level === 'warn') logger.warn(entry);
  else logger.info(entry);

  // MongoDB (fire-and-forget)
  Log.create(entry).catch((err) => {
    logger.error({ err }, 'Failed to write audit log to MongoDB');
  });
}

module.exports = { auditLog };
