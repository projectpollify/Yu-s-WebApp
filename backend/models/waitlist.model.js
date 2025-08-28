const mongoose = require('mongoose');

const waitlistSchema = new mongoose.Schema({
  parentName: String,
  parentEmail: { type: String, required: true },
  parentPhone: String,
  childName: { type: String, required: true },
  childBirthDate: Date,
  preferredStartDate: String,
  programType: String,
  emailId: String,
  receivedDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'contacted', 'enrolled', 'withdrawn'], default: 'pending' },
  priority: { type: String, enum: ['urgent', 'normal', 'low'], default: 'normal' },
  notes: String
});

module.exports = mongoose.models.Waitlist || mongoose.model('Waitlist', waitlistSchema);