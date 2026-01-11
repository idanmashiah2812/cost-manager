const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    userid: { type: Number, required: true, index: true },
    year: { type: Number, required: true, index: true },
    month: { type: Number, required: true, index: true },

    // The cached computed report (exact structure returned by /api/report)
    costs: { type: Array, required: true },

    computedAt: { type: Date, required: true, default: Date.now }
  },
  { collection: 'reports' }
);

reportSchema.index({ userid: 1, year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Report', reportSchema);
