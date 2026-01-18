class ApiError extends Error {
  constructor(statusCode, id, message) {
    super(message);
    this.statusCode = statusCode;
    this.id = id;
  }
}

module.exports = { ApiError };
