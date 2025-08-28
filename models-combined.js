const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// User Schema (simplified)
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'teacher', 'parent'], default: 'parent' },
  name: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

userSchema.methods.comparePassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Student Schema (simplified)
const studentSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  dateOfBirth: { type: Date, required: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  classroom: { type: String },
  enrollmentStatus: { type: String, enum: ['active', 'inactive', 'waitlist'], default: 'active' },
  enrollmentDate: { type: Date, default: Date.now },
  notes: String,
  createdAt: { type: Date, default: Date.now }
});

// Payment Schema (simplified)
const paymentSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['tuition', 'fee', 'other'], required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  dueDate: Date,
  paidDate: Date,
  description: String,
  createdAt: { type: Date, default: Date.now }
});

// Email Schema (for AI monitoring)
const emailSchema = new mongoose.Schema({
  messageId: { type: String, unique: true },
  from: { type: String, required: true },
  to: String,
  subject: String,
  body: String,
  received: { type: Date, default: Date.now },
  processed: { type: Boolean, default: false },
  category: { type: String, enum: ['inquiry', 'payment', 'absence', 'general', 'urgent'] },
  aiResponse: String,
  requiresAction: { type: Boolean, default: false },
  actionTaken: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = {
  User: mongoose.model('User', userSchema),
  Student: mongoose.model('Student', studentSchema),
  Payment: mongoose.model('Payment', paymentSchema),
  Email: mongoose.model('Email', emailSchema)
};