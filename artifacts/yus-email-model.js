const mongoose = require('mongoose');

const emailSchema = new mongoose.Schema({
  // Gmail/Email Provider Information
  messageId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  threadId: String,
  
  // Email Headers
  from: {
    email: { type: String, required: true },
    name: String
  },
  to: [{
    email: { type: String, required: true },
    name: String
  }],
  cc: [{
    email: String,
    name: String
  }],
  bcc: [{
    email: String,
    name: String
  }],
  replyTo: {
    email: String,
    name: String
  },
  
  // Email Content
  subject: {
    type: String,
    required: true,
    trim: true
  },
  body: {
    text: String, // Plain text version
    html: String  // HTML version
  },
  snippet: String, // First 100-150 characters for preview
  
  // Email Metadata
  receivedAt: {
    type: Date,
    required: true,
    index: true
  },
  sentAt: Date,
  
  // Attachments
  attachments: [{
    filename: String,
    mimeType: String,
    size: Number,
    attachmentId: String, // Gmail attachment ID
    downloaded: { type: Boolean, default: false },
    localPath: String, // Local file path if downloaded
    virus_scan: {
      scanned: { type: Boolean, default: false },
      clean: Boolean,
      scanDate: Date
    }
  }],
  
  // AI Processing Results
  aiProcessing: {
    processed: { type: Boolean, default: false },
    processedAt: Date,
    processingVersion: String, // Track AI model version used
    
    // AI Classification
    category: {
      type: String,
      enum: [
        'enrollment-inquiry',
        'parent-question',
        'payment-inquiry',
        'schedule-request',
        'complaint',
        'compliment',
        'urgent',
        'vendor',
        'spam',
        'newsletter',
        'administrative',
        'tour-request',
        'general',
        'unclassified'
      ],
      default: 'unclassified'
    },
    
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0
    },
    
    // Sentiment Analysis
    sentiment: {
      type: String,
      enum: ['positive', 'neutral', 'negative'],
      default: 'neutral'
    },
    sentimentScore: {
      type: Number,
      min: -1,
      max: 1,
      default: 0
    },
    
    // Intent Detection
    intents: [{
      intent: String,
      confidence: Number,
      entities: [{
        entity: String,
        value: String,
        confidence: Number
      }]
    }],
    
    // Priority Assessment
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal'
    },
    priorityReason: String,
    
    // Key Information Extraction
    extractedInfo: {
      childName: String,
      childAge: Number,
      parentName: String,
      phoneNumber: String,
      preferredTourDate: Date,
      startDate: Date,
      questions: [String],
      concerns: [String],
      requestedActions: [String]
    },
    
    // Suggested Response
    suggestedResponse: {
      template: String,
      customizedText: String,
      confidence: Number,
      requiresReview: { type: Boolean, default: true }
    },
    
    // Auto-actions performed
    autoActions: [{
      action: String, // 'sent-auto-reply', 'scheduled-tour', 'created-waitlist-entry'
      performedAt: Date,
      details: mongoose.Schema.Types.Mixed,
      success: Boolean,
      error: String
    }]
  },
  
  // Manual Classification & Processing
  manualReview: {
    reviewed: { type: Boolean, default: false },
    reviewedAt: Date,
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    manualCategory: String,
    manualPriority: String,
    reviewNotes: String,
    aiAccurate: Boolean, // Was the AI classification accurate?
    overrideReason: String
  },
  
  // Response Information
  response: {
    status: {
      type: String,
      enum: ['not-required', 'pending', 'drafted', 'sent', 'follow-up-needed'],
      default: 'pending'
    },
    responseType: {
      type: String,
      enum: ['auto-reply', 'template', 'custom', 'forwarded']
    },
    respondedAt: Date,
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    responseMessageId: String,
    responseText: String,
    templateUsed: String,
    followUpDate: Date,
    followUpCompleted: { type: Boolean, default: false }
  },
  
  // Conversation Threading
  conversation: {
    isFirstInThread: { type: Boolean, default: true },
    previousEmails: [String], // Array of messageIds in this conversation
    relatedStudentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student'
    },
    relatedParentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // Flags and Status
  flags: {
    isRead: { type: Boolean, default: false },
    isImportant: { type: Boolean, default: false },
    isStarred: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    requiresAction: { type: Boolean, default: false },
    isSpam: { type: Boolean, default: false }
  },
  
  // Labels/Tags
  labels: [String], // Gmail labels
  customTags: [String], // Custom internal tags
  
  // Integration Data
  integrations: {
    gmail: {
      labelIds: [String],
      threadId: String
    },
    calendar: {
      eventCreated: Boolean,
      eventId: String
    },
    crm: {
      contactId: String,
      opportunityId: String
    }
  },
  
  // Analytics and Metrics
  metrics: {
    responseTime: Number, // Minutes between receipt and response
    escalationLevel: Number, // How many times it was escalated
    customerSatisfaction: Number, // 1-5 rating if provided
    resolutionTime: Number // Minutes to resolve the inquiry
  },
  
  // Notes and Comments
  internalNotes: [{
    date: { type: Date, default: Date.now },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    note: String,
    private: { type: Boolean, default: true }
  }],
  
  // Error Tracking
  errors: [{
    date: { type: Date, default: Date.now },
    type: String, // 'processing', 'response', 'integration'
    message: String,
    stack: String,
    resolved: { type: Boolean, default: false }
  }]

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
emailSchema.index({ messageId: 1 });
emailSchema.index({ receivedAt: -1 });
emailSchema.index({ 'from.email': 1 });
emailSchema.index({ 'aiProcessing.category': 1 });
emailSchema.index({ 'aiProcessing.priority': 1 });
emailSchema.index({ 'aiProcessing.processed': 1 });
emailSchema.index({ 'flags.isRead': 1 });
emailSchema.index({ 'flags.requiresAction': 1 });
emailSchema.index({ 'response.status': 1 });
emailSchema.index({ 'conversation.relatedStudentId': 1 });
emailSchema.index({ 'conversation.relatedParentId': 1 });

// Virtual for age of email
emailSchema.virtual('ageInHours').get(function() {
  return Math.floor((Date.now() - this.receivedAt.getTime()) / (1000 * 60 * 60));
});

// Virtual for response time in SLA
emailSchema.virtual('isWithinSLA').get(function() {
  const slaHours = {
    'urgent': 1,
    'high': 4,
    'normal': 24,
    'low': 72
  };
  
  const targetHours = slaHours[this.aiProcessing.priority] || 24;
  return this.ageInHours <= targetHours;
});

// Virtual for full sender name
emailSchema.virtual('senderDisplay').get(function() {
  return this.from.name || this.from.email;
});

// Static method to find unprocessed emails
emailSchema.statics.findUnprocessed = function() {
  return this.find({ 'aiProcessing.processed': false });
};

// Static method to find emails requiring action
emailSchema.statics.findRequiringAction = function() {
  return this.find({ 'flags.requiresAction': true, 'flags.isArchived': false });
};

// Static method to find emails by category
emailSchema.statics.findByCategory = function(category) {
  return this.find({ 'aiProcessing.category': category });
};

// Static method to find overdue emails
emailSchema.statics.findOverdue = function() {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return this.find({
    receivedAt: { $lt: twentyFourHoursAgo },
    'response.status': { $in: ['pending', 'drafted'] },
    'flags.isArchived': false
  });
};

// Method to mark as processed
emailSchema.methods.markAsProcessed = function(aiResults) {
  this.aiProcessing = {
    ...this.aiProcessing,
    ...aiResults,
    processed: true,
    processedAt: new Date()
  };
  return this.save();
};

// Method to add response
emailSchema.methods.addResponse = function(responseData, userId) {
  this.response = {
    ...this.response,
    ...responseData,
    respondedAt: new Date(),
    respondedBy: userId,
    status: 'sent'
  };
  this.flags.requiresAction = false;
  return this.save();
};

// Method to add internal note
emailSchema.methods.addInternalNote = function(note, userId, isPrivate = true) {
  this.internalNotes.push({
    note: note,
    author: userId,
    private: isPrivate,
    date: new Date()
  });
  return this.save();
};

// Method to link to student/parent
emailSchema.methods.linkToContact = function(studentId, parentId) {
  this.conversation.relatedStudentId = studentId;
  this.conversation.relatedParentId = parentId;
  return this.save();
};

// Method to escalate priority
emailSchema.methods.escalate = function(reason) {
  const priorityLevels = ['low', 'normal', 'high', 'urgent'];
  const currentIndex = priorityLevels.indexOf(this.aiProcessing.priority);
  
  if (currentIndex < priorityLevels.length - 1) {
    this.aiProcessing.priority = priorityLevels[currentIndex + 1];
    this.aiProcessing.priorityReason = reason;
    this.metrics.escalationLevel = (this.metrics.escalationLevel || 0) + 1;
  }
  
  return this.save();
};

// Pre-save middleware
emailSchema.pre('save', function(next) {
  // Auto-set flags based on content
  if (this.aiProcessing.priority === 'urgent' || this.aiProcessing.priority === 'high') {
    this.flags.requiresAction = true;
    this.flags.isImportant = true;
  }
  
  // Set snippet if not provided
  if (!this.snippet && this.body.text) {
    this.snippet = this.body.text.substring(0, 150) + '...';
  }
  
  next();
});

module.exports = mongoose.model('Email', emailSchema);