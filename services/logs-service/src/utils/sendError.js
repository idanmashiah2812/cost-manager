function sendError(res, statusCode, id, message) {
  return res.status(statusCode).json({ id, message });
}

module.exports = { sendError };
