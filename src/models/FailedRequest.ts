const mongoose = require('mongoose');

const FailedRequestSchema = new mongoose.Schema({
  ip: { type: String, required: true, index: true },
  timestamp: { type: Date, default: Date.now, index: true },
  reason: { type: String, required: true },
  headers: { type: Object },
  endpoint: { type: String, required: true }
}, {
  // Add TTL index to automatically remove old records
  expires: 60 * 60 * 24 * 30 // 30 days
});

export const FailedRequest = mongoose.model('FailedRequest', FailedRequestSchema);
