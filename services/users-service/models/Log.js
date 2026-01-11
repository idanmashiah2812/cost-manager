const mongoose = require('mongoose');

const logSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, required: true, default: Date.now, index: true },
    service: { type: String, required: true },
    level: { type: String, required: true },
    message: { type: String, required: true },

    requestId: { type: String },
    method: { type: String },
    path: { type: String },
    statusCode: { type: Number },
    responseTimeMs: { type: Number },

    meta: { type: mongoose.Schema.Types.Mixed }
  },
  { collection: 'logs' }
);

module.exports = mongoose.model('Log', logSchema);
