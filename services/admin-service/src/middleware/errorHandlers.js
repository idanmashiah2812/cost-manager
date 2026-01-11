const { ApiError } = require('../utils/ApiError');
const { sendError } = require('../utils/sendError');

function notFoundHandler(req, res) {
  return sendError(res, 404, 'NOT_FOUND', `No route for ${req.method} ${req.originalUrl}`);
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // If it's our own typed error, use it.
  if (err instanceof ApiError) {
    return sendError(res, err.statusCode, err.id, err.message);
  }

  // Mongoose duplicate key (unique index)
  if (err && err.code === 11000) {
    return sendError(res, 409, 'DUPLICATE_KEY', 'Duplicate key error');
  }

  // Mongoose validation error
  if (err && err.name === 'ValidationError') {
    return sendError(res, 400, 'VALIDATION_ERROR', err.message);
  }

  // Default
  console.error(err); // keep a fallback
  return sendError(res, 500, 'INTERNAL_ERROR', 'Unexpected server error');
}

module.exports = { notFoundHandler, errorHandler };
