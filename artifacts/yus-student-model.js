const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  studentId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  dateOfBirth: {
    type: Date,
    required: [true, 'Date of birth is required']
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer-not-to-say'],
    required: true
  },
  
  // Parent/Guardian Information
  parents: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    relationship: {
      type: String,
      enum: ['mother', 'father', 'guardian', 'grandparent', 'other'],
      required: true
    },
    isPrimary: {
      type: Boolean,
      default: false
    },
    pickupAuthorized: {
      type: Boolean,
      default: true
    }
  }],
  
  // Emergency Contacts (additional to parents)
  emergencyContacts: [{
    name: { type: String, required: true },
    phone: { type: String, required: true },
    relationship: { type: String, required: true },
    priority: { type: Number, default: 1 }, // 1 = highest priority
    pickupAuthorized: { type: Boolean, default: false }
  }],
  
  // Academic Information
  enrollment: {
    status: {
      type: String,
      enum: ['enrolled', 'pending', 'waitlisted', 'graduated', 'withdrawn'],
      default: 'pending'
    },
    startDate: { type: Date, required: true },
    endDate: Date,
    className: String, // Mixed-age classroom name
    academicYear: String,
    schedule: {
      type: String,
      enum: ['full-time', 'part-time', 'morning-only', 'afternoon-only'],
      default: 'full-time'
    },
    daysPerWeek: { type: Number, default: 5, min: 1, max: 7 }
  },
  
  // Montessori-Specific Information
  montessori: {
    previousMontessoriExperience: { type: Boolean, default: false },
    currentCycle: {
      type: String,
      enum: ['toddler', 'primary', 'elementary-lower', 'elementary-upper', 'adolescent'],
      required: true
    },
    observations: [{
      date: { type: Date, default: Date.now },
      observer: { type: String, required: true }, // Teacher name
      workObserved: String,
      concentration: { type: Number, min: 1, max: 5 }, // 1-5 scale
      socialInteraction: { type: Number, min: 1, max: 5 },
      independence: { type: Number, min: 1, max: 5 },
      notes: String,
      developmentalMilestones: [String],
      areasOfInterest: [String],
      challenges: [String]
    }],
    portfolioItems: [{
      date: { type: Date, default: Date.now },
      type: { type: String, enum: ['photo', 'work-sample', 'note', 'video'] },
      title: String,
      description: String,
      fileUrl: String,
      subjects: [String], // Math, Language, Practical Life, etc.
      createdBy: String // Teacher name
    }]
  },
  
  // Health and Medical Information
  health: {
    allergies: [String],
    medications: [{
      name: String,
      dosage: String,
      frequency: String,
      instructions: String,
      prescribedBy: String
    }],
    medicalConditions: [String],
    dietaryRestrictions: [String],
    emergencyMedicalInfo: String,
    doctorName: String,
    doctorPhone: String,
    lastPhysicalExam: Date,
    immunizations: [{
      vaccine: String,
      date: Date,
      boosterDue: Date
    }]
  },
  
  // Behavioral and Social Information
  behavior: {
    specialNeeds: [String],
    behaviorPlan: String,
    adaptations: [String],
    strengths: [String],
    challenges: [String],
    communicationStyle: String,
    socialSkills: {
      sharesWell: Boolean,
      followsRules: Boolean,
      respectsOthers: Boolean,
      worksIndependently: Boolean,
      worksInGroups: Boolean
    }
  },
  
  // Attendance Tracking
  attendance: [{
    date: { type: Date, required: true },
    status: {
      type: String,
      enum: ['present', 'absent', 'late', 'early-dismissal'],
      required: true
    },
    timeIn: Date,
    timeOut: Date,
    notes: String,
    excused: { type: Boolean, default: false },
    reason: String
  }],
  
  // Transportation
  transportation: {
    pickup: {
      method: {
        type: String,
        enum: ['parent', 'bus', 'walk', 'other'],
        default: 'parent'
      },
      authorizedPersons: [String],
      instructions: String
    },
    dropoff: {
      method: {
        type: String,
        enum: ['parent', 'bus', 'walk', 'other'],
        default: 'parent'
      },
      authorizedPersons: [String],
      instructions: String
    }
  },
  
  // Documents and Files
  documents: [{
    name: String,
    type: {
      type: String,
      enum: ['birth-certificate', 'immunization', 'medical-form', 'enrollment-form', 'photo-permission', 'other']
    },
    fileUrl: String,
    uploadDate: { type: Date, default: Date.now },
    expirationDate: Date,
    required: { type: Boolean, default: false },
    approved: { type: Boolean, default: false }
  }],
  
  // Communication Log
  communications: [{
    date: { type: Date, default: Date.now },
    type: { type: String, enum: ['email', 'phone', 'in-person', 'note'] },
    direction: { type: String, enum: ['incoming', 'outgoing'] },
    from: String,
    to: String,
    subject: String,
    message: String,
    priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
    followUpRequired: { type: Boolean, default: false },
    followUpDate: Date,
    resolved: { type: Boolean, default: false }
  }],
  
  // Payment and Financial Information
  financial: {
    tuitionRate: { type: Number, required: true },
    paymentSchedule: {
      type: String,
      enum: ['monthly', 'quarterly', 'semi-annual', 'annual'],
      default: 'monthly'
    },
    scholarshipAmount: { type: Number, default: 0 },
    discounts: [{
      type: String, // 'sibling', 'early-bird', 'financial-need'
      amount: Number,
      percentage: Number,
      description: String
    }],
    paymentHistory: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment'
    }]
  },
  
  // Additional Information
  notes: [{
    date: { type: Date, default: Date.now },
    author: String, // Staff member name
    category: {
      type: String,
      enum: ['general', 'academic', 'behavioral', 'health', 'family', 'administrative']
    },
    content: String,
    confidential: { type: Boolean, default: false },
    important: { type: Boolean, default: false }
  }],
  
  // System Information
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  archiveReason: String,
  tags: [String] // For custom categorization

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
studentSchema.index({ studentId: 1 });
studentSchema.index({ 'parents.userId': 1 });
studentSchema.index({ 'enrollment.status': 1 });
studentSchema.index({ 'enrollment.className': 1 });
studentSchema.index({ 'enrollment.academicYear': 1 });
studentSchema.index({ isActive: 1 });
studentSchema.index({ createdAt: -1 });

// Virtual for full name
studentSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for age calculation
studentSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

// Virtual for attendance rate (last 30 days)
studentSchema.virtual('attendanceRate').get(function() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentAttendance = this.attendance.filter(a => a.date >= thirtyDaysAgo);
  
  if (recentAttendance.length === 0) return null;
  
  const presentDays = recentAttendance.filter(a => a.status === 'present').length;
  return Math.round((presentDays / recentAttendance.length) * 100);
});

// Static method to generate student ID
studentSchema.statics.generateStudentId = async function() {
  const currentYear = new Date().getFullYear().toString().slice(-2);
  const count = await this.countDocuments();
  return `YMS${currentYear}${String(count + 1).padStart(4, '0')}`;
};

// Pre-save middleware to generate student ID if not provided
studentSchema.pre('save', async function(next) {
  if (!this.studentId) {
    this.studentId = await this.constructor.generateStudentId();
  }
  next();
});

// Method to add observation
studentSchema.methods.addObservation = function(observationData) {
  this.montessori.observations.push({
    ...observationData,
    date: new Date()
  });
  return this.save();
};

// Method to add communication entry
studentSchema.methods.addCommunication = function(communicationData) {
  this.communications.push({
    ...communicationData,
    date: new Date()
  });
  return this.save();
};

// Method to get primary parent
studentSchema.methods.getPrimaryParent = function() {
  return this.parents.find(p => p.isPrimary) || this.parents[0];
};

// Method to check if student is currently enrolled
studentSchema.methods.isCurrentlyEnrolled = function() {
  return this.enrollment.status === 'enrolled' && this.isActive;
};

// Static method to find students by parent
studentSchema.statics.findByParent = function(parentUserId) {
  return this.find({ 'parents.userId': parentUserId, isActive: true });
};

// Static method to find students by class
studentSchema.statics.findByClass = function(className) {
  return this.find({ 
    'enrollment.className': className, 
    'enrollment.status': 'enrolled',
    isActive: true 
  });
};

// Method to calculate outstanding balance
studentSchema.methods.calculateOutstandingBalance = async function() {
  const Payment = mongoose.model('Payment');
  const payments = await Payment.find({ 
    studentId: this._id, 
    status: { $in: ['completed', 'pending'] }
  });
  
  const totalPaid = payments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);
  
  const totalDue = payments.reduce((sum, p) => sum + p.amount, 0);
  
  return totalDue - totalPaid;
};

module.exports = mongoose.model('Student', studentSchema);