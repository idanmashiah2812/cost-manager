require('dotenv').config();

const express = require('express');
const { connectToMongo } = require('./db');
const { createLogger } = require('./logger');
const { requestLogger } = require('./middleware/requestLogger');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandlers');
const { asyncHandler } = require('./utils/asyncHandler');
const { auditLog } = require('./logging/auditLog');

const Log = require('../models/Log');

const app = express();
const logger = createLogger();

app.use(express.json());
app.use(requestLogger({ logger }));

/**
 * GET /api/logs
 * Returns all logs (optionally limited).
 * Query:
 *  - limit (optional, max 5000)
 */
app.get('/api/logs', asyncHandler(async (req, res) => {
  auditLog(logger, { message: 'Endpoint accessed: GET /api/logs', req });

  const hasLimit = Object.prototype.hasOwnProperty.call(req.query, 'limit');
  const rawLimit = Number(req.query.limit);
  const limit = hasLimit ? Math.min(rawLimit || 0, 5000) : 0;

  let query = Log.find({}, { __v: 0 }).sort({ timestamp: -1 });
  if (hasLimit && limit > 0) query = query.limit(limit);

  const logs = await query.lean();
  return res.json(logs);
}));

app.use(notFoundHandler);
app.use(errorHandler);

// Export app for testing
module.exports = app;

async function start() {
  await connectToMongo();
  const port = Number(process.env.PORT || 3003);

  app.listen(port, () => {
    logger.info({ port }, `Logs service listening on port ${port}`);
  });
}

if (require.main === module) {
  start().catch((err) => {
    logger.error({ err }, 'Failed to start logs-service');
    process.exit(1);
  });
}
