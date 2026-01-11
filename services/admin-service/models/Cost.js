const mongoose = require('mongoose');

/**
 * The assignment asks for `sum` to be a Double.
 * In MongoDB, JS numbers are stored as IEEE-754 doubles by default.
 * If you want an explicit Double type in Mongoose, we load the plugin below.
 */
let DoubleType = Number;
try {
  require('@mongoosejs/double')(mongoose);
  DoubleType = mongoose.Schema.Types.Double;
} catch (e) {
  // Fallback: keep Number if the plugin isn't available.
  DoubleType = Number;
}

const costSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true }, // validate in route
    userid: { type: Number, required: true, index: true },
    sum: { type: DoubleType, required: true },

    // Not required by the project text, but needed for reports + day-of-month
    createdAt: { type: Date, required: true, default: Date.now, index: true }
  },
  { collection: 'costs' }
);

// When using Double plugin, ensure JSON output is a plain JS number:
costSchema.set('toJSON', {
  transform: (doc, ret) => {
    if (ret.sum && typeof ret.sum.valueOf === 'function') ret.sum = ret.sum.valueOf();
    return ret;
  }
});
costSchema.set('toObject', {
  transform: (doc, ret) => {
    if (ret.sum && typeof ret.sum.valueOf === 'function') ret.sum = ret.sum.valueOf();
    return ret;
  }
});

module.exports = mongoose.model('Cost', costSchema);
