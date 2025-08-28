const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  // Payment Identification
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  
  // Student and Parent Information
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
    index: true
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Payment Details
  amount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: [0, 'Payment amount cannot be negative']
  },
  currency: {
    type: String,
    default: 'CAD',
    enum: ['CAD', 'USD']
  },
  
  // Payment Type and Description
  type: {
    type: String,
    enum: [
      'tuition',
      'registration',
      'late-fee',
      'materials-fee',
      'field-trip',
      'lunch-program',
      'extended-care',
      'summer-camp',
      'other'
    ],
    required: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  
  // Due Dates and Periods
  dueDate: {
    type: Date,
    required: true,
    index: true
  },
  periodStart: Date, // For recurring payments like monthly tuition
  periodEnd: Date,
  academicYear: {
    type: String,
    required: true
  },
  
  // Payment Status
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled', 'overdue'],
    default: 'pending',
    index: true
  },
  
  // Payment Method Information
  paymentMethod: {
    type: {
      type: String,
      enum: ['credit-card', 'debit-card', 'bank-transfer', 'cash', 'cheque', 'e-transfer', 'paypal', 'stripe']
    },
    details: {
      // For card payments
      last4: String,
      brand: String, // visa, mastercard, amex
      expiryMonth: Number,
      expiryYear: Number,
      
      // For bank transfers/e-transfers
      bankName: String,
      accountLast4: String,
      
      // For cheques
      chequeNumber: String,
      
      // General
      holderName: String
    }
  },
  
  // Transaction Information
  transactions: [{
    transactionId: String, // Stripe payment intent ID, bank reference, etc.
    processor: String, // 'stripe', 'paypal', 'manual'
    processedAt: Date,
    amount: Number,
    fee: Number, // Processing fee
    netAmount: Number, // Amount after fees
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'cancelled', 'refunded']
    },
    processorResponse: mongoose.Schema.Types.Mixed, // Raw response from payment processor
    failureReason: String,
    failureCode: String
  }],
  
  // Refund Information
  refunds: [{
    refundId: String,
    amount: Number,
    reason: String,
    processedAt: Date,
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'failed']
    }
  }],
  
  // Late Payment Information
  lateFee: {
    applied: { type: Boolean, default: false },
    amount: { type: Number, default: 0 },
    appliedDate: Date,
    waived: { type: Boolean, default: false },
    waivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    waivedReason: String
  },
  
  // Discounts and Adjustments
  discounts: [{
    type: {
      type: String,
      enum: ['sibling', 'early-bird', 'financial-hardship', 'staff', 'referral', 'other']
    },
    description: String,
    amount: Number,
    percentage: Number,
    appliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    appliedDate: { type: Date, default: Date.now }
  }],
  
  // Payment Plan Information (for split payments)
  paymentPlan: {
    isPaymentPlan: { type: Boolean, default: false },
    totalAmount: Number,
    installmentNumber: Number, // Which installment this is (1, 2, 3, etc.)
    totalInstallments: Number,
    planId: String, // Reference to group related installments
    nextPaymentDate: Date
  },
  
  // Communication and Reminders
  reminders: [{
    type: {
      type: String,
      enum: ['first-notice', 'second-notice', 'final-notice', 'overdue']
    },
    sentDate: Date,
    method: {
      type: String,
      enum: ['email', 'sms', 'phone', 'mail']
    },
    recipient: String, // Email or phone number
    successful: Boolean,
    response: String // Any response received
  }],
  
  // Notes and Comments
  notes: [{
    date: { type: Date, default: Date.now },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    content: String,
    type: {
      type: String,
      enum: ['general', 'payment-issue', 'customer-service', 'administrative']
    },
    private: { type: Boolean, default: false } // Only visible to staff
  }],
  
  // Receipts and Documentation
  receipts: [{
    receiptNumber: String,
    generatedAt: Date,
    filePath: String, // PDF receipt file path
    emailed: { type: Boolean, default: false },
    emailedAt: Date
  }],
  
  // Tax Information (for Canadian tax receipts)
  tax: {
    eligible: { type: Boolean, default: false }, // Eligible for tax receipt
    receiptIssued: { type: Boolean, default: false },
    receiptNumber: String,
    taxYear: Number,
    receiptDate: Date,
    receiptFilePath: String
  },
  
  // Recurring Payment Information
  recurring: {
    isRecurring: { type: Boolean, default: false },
    frequency: {
      type: String,
      enum: ['weekly', 'bi-weekly', 'monthly', 'quarterly', 'semi-annual', 'annual']
    },
    startDate: Date,
    endDate: Date,
    nextPaymentDate: Date,
    subscriptionId: String, // Stripe subscription ID or similar
    active: { type: Boolean, default: true },
    failedAttempts: { type: Number, default: 0 },
    maxFailedAttempts: { type: Number, default: 3 }
  },
  
  // Administrative Information
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  modifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // System flags
  isManual: { type: Boolean, default: false }, // Manually created vs automated
  requiresApproval: { type: Boolean, default: false },
  approved: { type: Boolean, default: false },
  
  // Metadata
  metadata: {
    source: String, // 'web', 'mobile', 'admin-portal', 'automated'
    userAgent: String,
    ipAddress: String,
    sessionId: String
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
paymentSchema.index({ invoiceNumber: 1 });
paymentSchema.index({ studentId: 1, dueDate: -1 });
paymentSchema.index({ parentId: 1, dueDate: -1 });
paymentSchema.index({ status: 1, dueDate: 1 });
paymentSchema.index({ type: 1, academicYear: 1 });
paymentSchema.index({ 'recurring.nextPaymentDate': 1 });
paymentSchema.index({ createdAt: -1 });

// Virtual for days overdue
paymentSchema.virtual('daysOverdue').get(function() {
  if (this.status !== 'overdue' && this.status !== 'pending') return 0;
  if (this.dueDate > new Date()) return 0;
  return Math.floor((Date.now() - this.dueDate.getTime()) / (1000 * 60 * 60 * 24));
});

// Virtual for net amount after discounts
paymentSchema.virtual('netAmount').get(function() {
  let discountAmount = 0;
  this.discounts.forEach(discount => {
    if (discount.percentage) {
      discountAmount += (this.amount * discount.percentage / 100);
    } else {
      discountAmount += discount.amount || 0;
    }
  });
  return Math.max(0, this.amount - discountAmount);
});

// Virtual for total amount due including late fees
paymentSchema.virtual('totalDue').get(function() {
  const lateFeeAmount = this.lateFee.applied && !this.lateFee.waived ? this.lateFee.amount : 0;
  return this.netAmount + lateFeeAmount;
});

// Virtual for payment status display
paymentSchema.virtual('statusDisplay').get(function() {
  if (this.status === 'pending' && this.dueDate < new Date()) {
    return 'overdue';
  }
  return this.status;
});

// Static method to generate invoice number
paymentSchema.statics.generateInvoiceNumber = async function() {
  const currentYear = new Date().getFullYear();
  const count = await this.countDocuments({
    createdAt: {
      $gte: new Date(currentYear, 0, 1),
      $lt: new Date(currentYear + 1, 0, 1)
    }
  });
  return `YMS-${currentYear}-${String(count + 1).padStart(5, '0')}`;
};

// Static method to find overdue payments
paymentSchema.statics.findOverdue = function() {
  return this.find({
    status: 'pending',
    dueDate: { $lt: new Date() }
  });
};

// Static method to find payments due soon
paymentSchema.statics.findDueSoon = function(days = 7) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({
    status: 'pending',
    dueDate: { $gte: new Date(), $lte: futureDate }
  });
};

// Static method to get payment summary for a student
paymentSchema.statics.getStudentPaymentSummary = async function(studentId) {
  const payments = await this.find({ studentId });
  
  const summary = {
    totalPaid: 0,
    totalPending: 0,
    totalOverdue: 0,
    paymentCount: payments.length,
    lastPaymentDate: null,
    nextDueDate: null
  };
  
  payments.forEach(payment => {
    if (payment.status === 'completed') {
      summary.totalPaid += payment.totalDue;
      if (!summary.lastPaymentDate || payment.updatedAt > summary.lastPaymentDate) {
        summary.lastPaymentDate = payment.updatedAt;
      }
    } else if (payment.status === 'pending') {
      if (payment.dueDate < new Date()) {
        summary.totalOverdue += payment.totalDue;
      } else {
        summary.totalPending += payment.totalDue;
        if (!summary.nextDueDate || payment.dueDate < summary.nextDueDate) {
          summary.nextDueDate = payment.dueDate;
        }
      }
    }
  });
  
  return summary;
};

// Pre-save middleware to generate invoice number
paymentSchema.pre('save', async function(next) {
  if (!this.invoiceNumber) {
    this.invoiceNumber = await this.constructor.generateInvoiceNumber();
  }
  
  // Auto-update status to overdue
  if (this.status === 'pending' && this.dueDate < new Date()) {
    this.status = 'overdue';
  }
  
  next();
});

// Method to mark as paid
paymentSchema.methods.markAsPaid = function(transactionData, userId) {
  this.status = 'completed';
  this.transactions.push({
    ...transactionData,
    processedAt: new Date(),
    status: 'succeeded'
  });
  this.modifiedBy = userId;
  
  return this.save();
};

// Method to apply late fee
paymentSchema.methods.applyLateFee = function(amount, userId) {
  this.lateFee.applied = true;
  this.lateFee.amount = amount;
  this.lateFee.appliedDate = new Date();
  this.modifiedBy = userId;
  
  return this.save();
};

// Method to add discount
paymentSchema.methods.addDiscount = function(discountData, userId) {
  this.discounts.push({
    ...discountData,
    appliedBy: userId,
    appliedDate: new Date()
  });
  this.modifiedBy = userId;
  
  return this.save();
};

// Method to send reminder
paymentSchema.methods.sendReminder = function(reminderType, method, recipient) {
  this.reminders.push({
    type: reminderType,
    sentDate: new Date(),
    method: method,
    recipient: recipient,
    successful: true // This would be set by the actual sending service
  });
  
  return this.save();
};

// Method to generate receipt
paymentSchema.methods.generateReceipt = function() {
  const receiptNumber = `REC-${this.invoiceNumber}-${Date.now()}`;
  
  this.receipts.push({
    receiptNumber: receiptNumber,
    generatedAt: new Date()
  });
  
  return this.save();
};

module.exports = mongoose.model('Payment', paymentSchema);