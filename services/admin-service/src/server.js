require('dotenv').config();

const express = require('express');
const { connectToMongo } = require('./db');
const { createLogger } = require('./logger');
const { requestLogger } = require('./middleware/requestLogger');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandlers');
const { asyncHandler } = require('./utils/asyncHandler');
const { ApiError } = require('./utils/ApiError');
const { auditLog } = require('./logging/auditLog');

const app = express();
const logger = createLogger();

app.use(express.json());
app.use(requestLogger({ logger }));

/**
 * GET /api/about
 * Returns a JSON document describing the developers team.
 *
 * Requirement: do NOT store in DB (must work with empty DB).
 *
 * Env options:
 * - TEAM_MEMBERS_JSON='[{"first_name":"A","last_name":"B"}]'
 */
app.get('/api/about', asyncHandler(async (req, res) => {
  auditLog(logger, { message: 'Endpoint accessed: GET /api/about', req });

  const raw = process.env.TEAM_MEMBERS_JSON;
  if (!raw) {
    return res.json([]);
  }

  let team;
  try {
    team = JSON.parse(raw);
  } catch (e) {
    throw new ApiError(500, 'BAD_TEAM_ENV', 'TEAM_MEMBERS_JSON is not valid JSON');
  }

  if (!Array.isArray(team)) {
    throw new ApiError(500, 'BAD_TEAM_ENV', 'TEAM_MEMBERS_JSON must be a JSON array');
  }

  // Ensure we return ONLY first_name and last_name (no extra data)
  const sanitized = team.map((m) => ({
    first_name: String(m.first_name || ''),
    last_name: String(m.last_name || '')
  }));

  return res.json(sanitized);
}));

app.use(notFoundHandler);
app.use(errorHandler);

// Export app for testing
module.exports = app;

async function start() {
  // Admin service still connects to MongoDB because it must log every request to DB
  await connectToMongo();
  const port = Number(process.env.PORT || 3004);

  app.listen(port, () => {
    logger.info({ port }, `Admin service listening on port ${port}`);
  });
}

if (require.main === module) {
  start().catch((err) => {
    logger.error({ err }, 'Failed to start admin-service');
    process.exit(1);
  });
}
