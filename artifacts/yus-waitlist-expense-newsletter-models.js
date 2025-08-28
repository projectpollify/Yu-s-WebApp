// models/Waitlist.js
const mongoose = require('mongoose');

const waitlistSchema = new mongoose.Schema({
  // Contact Information
  childName: {
    type: String,
    required: [true, 'Child name is required'],
    trim: true
  },
  dateOfBirth: {
    type: Date,
    required: [true, 'Date of birth is required']
  },
  
  // Parent Information
  parentName: {
    type: String,
    required: [true, 'Parent name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  
  // Waitlist Details
  position: {
    type: Number,
    required: true,
    min: 1
  },
  preferredStartDate: {
    type: Date,
    required: true
  },
  program: {
    type: String,
    enum: ['toddler', 'primary', 'elementary-lower', 'elementary-upper'],
    required: true
  },
  schedule: {
    type: String,
    enum: ['full-time', 'part-time', 'morning-only', 'afternoon-only'],
    default: 'full-time'
  },
  
  // Status and Priority
  status: {
    type: String,
    enum: ['active', 'contacted', 'offered', 'accepted', 'declined', 'expired', 'removed'],
    default: 'active'
  },
  priority: {
    type: String,
    enum: ['normal', 'high', 'sibling', 'staff'],
    default: 'normal'
  },
  
  // AI Insights
  aiInsights: {
    likelihood: {
      type: Number,
      min: 0,
      max: 100,
      default: 50
    },
    factors: [{
      factor: String,
      impact: String, // 'positive', 'negative', 'neutral'
      confidence: Number
    }],
    recommendedAction: String,
    lastAnalyzed: Date
  },
  
  // Communication History
  communications: [{
    date: { type: Date, default: Date.now },
    type: { type: String, enum: ['email', 'phone', 'tour', 'offer'] },
    notes: String,
    staffMember: String,
    followUpRequired: Boolean,
    followUpDate: Date
  }],
  
  // Tour Information
  tourInfo: {
    requested: Boolean,
    scheduled: Date,
    completed: Boolean,
    completedDate: Date,
    feedback: String,
    showedInterest: Boolean
  },
  
  dateAdded: {
    type: Date,
    default: Date.now
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  notes: String,
  
  // When offered enrollment
  offerDetails: {
    offered: Boolean,
    offerDate: Date,
    expirationDate: Date,
    response: String,
    responseDate: Date
  }

}, {
  timestamps: true
});

waitlistSchema.index({ position: 1 });
waitlistSchema.index({ email: 1 });
waitlistSchema.index({ status: 1, program: 1 });
waitlistSchema.index({ preferredStartDate: 1 });

const Waitlist = mongoose.model('Waitlist', waitlistSchema);

// =============================================================================

// models/Expense.js
const expenseSchema = new mongoose.Schema({
  // Basic Expense Information
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount must be positive']
  },
  currency: {
    type: String,
    default: 'CAD'
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
    index: true
  },
  
  // Categorization
  category: {
    type: String,
    enum: [
      'supplies',
      'equipment',
      'maintenance',
      'utilities',
      'insurance',
      'professional-services',
      'marketing',
      'food-program',
      'staff-training',
      'licensing-fees',
      'rent',
      'technology',
      'other'
    ],
    required: true,
    index: true
  },
  subcategory: String,
  
  // Tax Information
  taxInfo: {
    taxDeductible: { type: Boolean, default: false },
    taxCategory: String, // CRA category
    gstHst: Number,
    pst: Number,
    totalTax: Number,
    taxYear: { type: Number, index: true },
    receiptRequired: { type: Boolean, default: false }
  },
  
  // Vendor/Supplier Information
  vendor: {
    name: String,
    email: String,
    phone: String,
    address: String,
    vendorId: String
  },
  
  // Payment Information
  paymentMethod: {
    type: String,
    enum: ['cash', 'credit-card', 'debit-card', 'cheque', 'bank-transfer', 'paypal'],
    required: true
  },
  transactionId: String,
  invoiceNumber: String,
  
  // Receipt and Documentation
  receipts: [{
    filename: String,
    originalName: String,
    mimeType: String,
    size: Number,
    path: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  
  // Approval Workflow
  approval: {
    required: { type: Boolean, default: false },
    approved: { type: Boolean, default: false },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    rejectedReason: String
  },
  
  // Recurring Expense
  recurring: {
    isRecurring: { type: Boolean, default: false },
    frequency: {
      type: String,
      enum: ['monthly', 'quarterly', 'semi-annual', 'annual']
    },
    nextDue: Date,
    endDate: Date
  },
  
  // Administrative
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  notes: String,
  tags: [String],
  
  // Reimbursement (if staff expense)
  reimbursement: {
    isReimbursable: { type: Boolean, default: false },
    claimedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    processed: { type: Boolean, default: false },
    processedDate: Date,
    amount: Number
  }

}, {
  timestamps: true
});

expenseSchema.index({ date: -1, category: 1 });
expenseSchema.index({ 'taxInfo.taxYear': 1 });
expenseSchema.index({ createdBy: 1 });

const Expense = mongoose.model('Expense', expenseSchema);

// =============================================================================

// models/Newsletter.js
const newsletterSchema = new mongoose.Schema({
  // Newsletter Basic Information
  title: {
    type: String,
    required: [true, 'Newsletter title is required'],
    trim: true
  },
  subject: {
    type: String,
    required: [true, 'Email subject is required'],
    trim: true
  },
  
  // Content
  content: {
    html: String,
    text: String, // Plain text version
    markdown: String // Original markdown if using markdown editor
  },
  
  // Newsletter Type and Schedule
  type: {
    type: String,
    enum: ['weekly', 'monthly', 'special', 'announcement', 'event'],
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'sent', 'cancelled'],
    default: 'draft'
  },
  
  // Scheduling
  scheduledDate: Date,
  sentDate: Date,
  
  // AI Generation Information
  aiGenerated: {
    isGenerated: { type: Boolean, default: false },
    prompt: String,
    model: String,
    generatedAt: Date,
    humanEdited: { type: Boolean, default: false },
    editSummary: String
  },
  
  // Content Sources (for AI generation)
  contentSources: [{
    type: {
      type: String,
      enum: ['recent-photos', 'upcoming-events', 'achievements', 'announcements', 'classroom-updates']
    },
    data: mongoose.Schema.Types.Mixed,
    dateRange: {
      start: Date,
      end: Date
    }
  }],
  
  // Recipients
  recipients: {
    groups: [{
      type: String,
      enum: ['all-parents', 'toddler-parents', 'primary-parents', 'elementary-parents', 'staff', 'waitlist']
    }],
    customList: [String], // Array of email addresses
    excludeList: [String], // Array of emails to exclude
    totalCount: { type: Number, default: 0 }
  },
  
  // Delivery Statistics
  deliveryStats: {
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    bounced: { type: Number, default: 0 },
    opened: { type: Number, default: 0 },
    clicked: { type: Number, default: 0 },
    unsubscribed: { type: Number, default: 0 },
    complained: { type: Number, default: 0 }
  },
  
  // Tracking
  tracking: {
    enabled: { type: Boolean, default: true },
    trackingId: String,
    links: [{
      url: String,
      clickCount: { type: Number, default: 0 },
      uniqueClicks: { type: Number, default: 0 }
    }]
  },
  
  // Attachments
  attachments: [{
    filename: String,
    originalName: String,
    mimeType: String,
    size: Number,
    path: String
  }],
  
  // Template Information
  template: {
    used: String, // Template name if used
    customizations: mongoose.Schema.Types.Mixed
  },
  
  // Archive and Organization
  archived: { type: Boolean, default: false },
  tags: [String],
  category: String,
  
  // Administrative
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Approval Workflow (for important newsletters)
  approval: {
    required: { type: Boolean, default: false },
    approved: { type: Boolean, default: false },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    feedback: String
  },
  
  // Version Control
  version: {
    type: Number,
    default: 1
  },
  previousVersions: [{
    version: Number,
    content: mongoose.Schema.Types.Mixed,
    savedAt: Date,
    savedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }]

}, {
  timestamps: true
});

newsletterSchema.index({ status: 1, scheduledDate: 1 });
newsletterSchema.index({ type: 1, createdAt: -1 });
newsletterSchema.index({ createdBy: 1 });
newsletterSchema.index({ sentDate: -1 });

const Newsletter = mongoose.model('Newsletter', newsletterSchema);

// =============================================================================