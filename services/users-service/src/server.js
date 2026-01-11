require('dotenv').config();

const express = require('express');
const { connectToMongo } = require('./db');
const { createLogger } = require('./logger');
const { requestLogger } = require('./middleware/requestLogger');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandlers');
const { ApiError } = require('./utils/ApiError');
const { asyncHandler } = require('./utils/asyncHandler');
const { auditLog } = require('./logging/auditLog');

const User = require('../models/User');
const Cost = require('../models/Cost');

const app = express();
const logger = createLogger();

app.use(express.json());
app.use(requestLogger({ logger }));

// --- Routes ---

/**
 * POST /api/add
 * Add a new user.
 * Body: { id, first_name, last_name, birthday }
 */
app.post('/api/add', asyncHandler(async (req, res) => {
  auditLog(logger, { message: 'Endpoint accessed: POST /api/add (add user)', req });

  const { id, first_name, last_name, birthday } = req.body || {};

  if (typeof id !== 'number' || Number.isNaN(id)) {
    throw new ApiError(400, 'INVALID_ID', '`id` must be a Number');
  }
  if (typeof first_name !== 'string' || !first_name.trim()) {
    throw new ApiError(400, 'INVALID_FIRST_NAME', '`first_name` must be a non-empty String');
  }
  if (typeof last_name !== 'string' || !last_name.trim()) {
    throw new ApiError(400, 'INVALID_LAST_NAME', '`last_name` must be a non-empty String');
  }
  const bday = new Date(birthday);
  if (!birthday || Number.isNaN(bday.getTime())) {
    throw new ApiError(400, 'INVALID_BIRTHDAY', '`birthday` must be a valid Date/ISO string');
  }

  const existing = await User.findOne({ id }).lean();
  if (existing) {
    throw new ApiError(409, 'USER_EXISTS', `User with id=${id} already exists`);
  }

  const user = await User.create({ id, first_name: first_name.trim(), last_name: last_name.trim(), birthday: bday });
  return res.status(201).json({
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    birthday: user.birthday
  });
}));

/**
 * GET /api/users
 * List all users.
 */
app.get('/api/users', asyncHandler(async (req, res) => {
  auditLog(logger, { message: 'Endpoint accessed: GET /api/users', req });

  const users = await User.find({}, { _id: 0, __v: 0 }).sort({ id: 1 }).lean();
  return res.json(users);
}));

/**
 * GET /api/users/:id
 * Get a user's details + total costs.
 * Reply: { first_name, last_name, id, total }
 */
app.get('/api/users/:id', asyncHandler(async (req, res) => {
  auditLog(logger, { message: 'Endpoint accessed: GET /api/users/:id', req });

  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    throw new ApiError(400, 'INVALID_ID', 'User id must be a Number');
  }

  const user = await User.findOne({ id }, { _id: 0, __v: 0 }).lean();
  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', `No user with id=${id}`);
  }

  const agg = await Cost.aggregate([
    { $match: { userid: id } },
    { $group: { _id: null, total: { $sum: '$sum' } } }
  ]);

  const total = agg.length ? Number(agg[0].total) : 0;

  return res.json({
    first_name: user.first_name,
    last_name: user.last_name,
    id: user.id,
    total
  });
}));

// --- Middleware ---
app.use(notFoundHandler);
app.use(errorHandler);

// --- Start ---
async function start() {
  await connectToMongo();
  const port = Number(process.env.PORT || 3001);

  app.listen(port, () => {
    logger.info({ port }, `Users service listening on port ${port}`);
  });
}

start().catch((err) => {
  logger.error({ err }, 'Failed to start users-service');
  process.exit(1);
});
