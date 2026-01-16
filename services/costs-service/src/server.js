require('dotenv').config();

const express = require('express');
const { connectToMongo } = require('./db');
const { createLogger } = require('./logger');
const { requestLogger } = require('./middleware/requestLogger');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandlers');
const { ApiError } = require('./utils/ApiError');
const { asyncHandler } = require('./utils/asyncHandler');
const { auditLog } = require('./logging/auditLog');
const { ALLOWED_CATEGORIES, CATEGORY_REPORT_ORDER } = require('./constants/categories');

const Cost = require('../models/Cost');
const Report = require('../models/Report');
const User = require('../models/User');

const app = express();
const logger = createLogger();

app.use(express.json());
app.use(requestLogger({ logger }));

function monthStartUTC(year, month) {
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
}
function nextMonthStartUTC(year, month) {
  return new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
}

function isPastMonth(year, month, now = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  return year < y || (year === y && month < m);
}


async function buildMonthlyReport(userid, year, month) {
  const start = monthStartUTC(year, month);
  const end = nextMonthStartUTC(year, month);

  const rows = await Cost.aggregate([
    { $match: { userid, createdAt: { $gte: start, $lt: end } } },
    {
      $project: {
        _id: 0,
        category: 1,
        description: 1,
        // Force JS-friendly numeric output even if stored as BSON Double
        sum: { $toDouble: '$sum' },
        day: { $dayOfMonth: '$createdAt' }
      }
    },
    { $sort: { day: 1 } },
    {
      $group: {
        _id: '$category',
        items: { $push: { sum: '$sum', description: '$description', day: '$day' } }
      }
    }
  ]);

  const byCategory = new Map(rows.map((r) => [r._id, r.items]));

  const costs = CATEGORY_REPORT_ORDER.map((cat) => ({
    [cat]: byCategory.get(cat) || []
  }));

  return { userid, year, month, costs };
}


/**
 * POST /api/add
 * Add a new cost item.
 * Body: { description, category, userid, sum, createdAt? }
 *
 * Rules:
 * - If createdAt is missing => server uses request time
 * - If createdAt is provided => must NOT be in the past (tolerance: 5 seconds)
 */
app.post('/api/add', asyncHandler(async (req, res) => {
  auditLog(logger, { message: 'Endpoint accessed: POST /api/add (add cost)', req });

  const { description, category, userid, sum, createdAt } = req.body || {};

  if (typeof description !== 'string' || !description.trim()) {
    throw new ApiError(400, 'INVALID_DESCRIPTION', '`description` must be a non-empty String');
  }
  if (typeof category !== 'string' || !category.trim()) {
    throw new ApiError(400, 'INVALID_CATEGORY', '`category` must be a non-empty String');
  }
  if (!ALLOWED_CATEGORIES.includes(category)) {
    throw new ApiError(400, 'UNSUPPORTED_CATEGORY', `Category must be one of: ${ALLOWED_CATEGORIES.join(', ')}`);
  }
  if (typeof userid !== 'number' || Number.isNaN(userid)) {
    throw new ApiError(400, 'INVALID_USERID', '`userid` must be a Number');
  }
  if (typeof sum !== 'number' || Number.isNaN(sum)) {
    throw new ApiError(400, 'INVALID_SUM', '`sum` must be a Number');
  }

  // Optional: verify that the user exists (helps keep DB consistent)
  const enforceUserExists = (process.env.ENFORCE_USER_EXISTS ?? 'true').toLowerCase() === 'true';
  if (enforceUserExists) {
    const user = await User.findOne({ id: userid }).lean();
    if (!user) {
      throw new ApiError(404, 'USER_NOT_FOUND', `No user with id=${userid}`);
    }
  }

  const now = new Date();
  let dt = now;
  if (createdAt !== undefined) {
    dt = new Date(createdAt);
    if (Number.isNaN(dt.getTime())) {
      throw new ApiError(400, 'INVALID_DATE', '`createdAt` must be a valid Date/ISO string');
    }
  }

  // Disallow past date-times (with small tolerance to avoid "network jitter" failures)
  const toleranceMs = 5000;
  if (dt.getTime() < now.getTime() - toleranceMs) {
    throw new ApiError(400, 'PAST_DATE_NOT_ALLOWED', 'Adding costs with dates in the past is not allowed');
  }

  const cost = await Cost.create({
    description: description.trim(),
    category,
    userid,
    sum,
    createdAt: dt
  });

  return res.status(201).json({
    description: cost.description,
    category: cost.category,
    userid: cost.userid,
    sum: Number(cost.sum),
    createdAt: cost.createdAt
  });
}));

/**
 * GET /api/report?id=<userid>&year=<year>&month=<month>
 *
 * Reply example:
 * {
 *   "userid": 123123,
 *   "year": 2025,
 *   "month": 11,
 *   "costs": [
 *     { "food": [ { "sum": 12, "description": "choco", "day": 17 } ] },
 *     { "education": [] },
 *     { "health": [] },
 *     { "housing": [] },
 *     { "sports": [] }
 *   ]
 * }
 *
 * Computed design pattern:
 * - if month already passed => cache in `reports` collection
 */
app.get('/api/report', asyncHandler(async (req, res) => {
  auditLog(logger, { message: 'Endpoint accessed: GET /api/report', req });

  const userid = Number(req.query.id);
  const year = Number(req.query.year);
  const month = Number(req.query.month);

  if (Number.isNaN(userid)) throw new ApiError(400, 'INVALID_ID', '`id` (userid) must be a Number');
  if (Number.isNaN(year) || year < 1970) throw new ApiError(400, 'INVALID_YEAR', '`year` must be a Number (>= 1970)');
  if (Number.isNaN(month) || month < 1 || month > 12) throw new ApiError(400, 'INVALID_MONTH', '`month` must be a Number (1..12)');

  const past = isPastMonth(year, month);

  if (past) {
    const cached = await Report.findOne({ userid, year, month }, { _id: 0, __v: 0, computedAt: 0 }).lean();
    if (cached) {
      return res.json({ userid: cached.userid, year: cached.year, month: cached.month, costs: cached.costs });
    }

    const computed = await buildMonthlyReport(userid, year, month);

    // Cache it (computed design pattern)
    try {
      await Report.create({ userid, year, month, costs: computed.costs });
    } catch (err) {
      // In case of race/duplicate (two requests at once), ignore duplicate key
      if (err.code !== 11000) throw err;
    }

    return res.json(computed);
  }

  // Current or future month: compute on-demand (do not cache)
  const computed = await buildMonthlyReport(userid, year, month);
  return res.json(computed);
}));

// --- Middleware ---
app.use(notFoundHandler);
app.use(errorHandler);

// --- Start ---
async function start() {
  await connectToMongo();
  const port = Number(process.env.PORT || 3002);

  app.listen(port, () => {
    logger.info({ port }, `Costs service listening on port ${port}`);
  });
}

// Export app for testing
module.exports = app;

if (require.main === module) {
  start().catch((err) => {
    logger.error({ err }, 'Failed to start costs-service');
    process.exit(1);
  });
}
