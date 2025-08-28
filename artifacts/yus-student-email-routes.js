// routes/students.js
const express = require('express');
const Student = require('../models/Student');
const User = require('../models/User');
const { authorize, requireParentAccess, logUserAction } = require('../middleware/auth');
const { validateStudentCreation, validateObjectId, validatePagination } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const helpers = require('../utils/helpers');

const router = express.Router();

// @desc    Get all students (admin/teacher) or own children (parent)
// @route   GET /api/students
// @access  Private
router.get('/', validatePagination, logUserAction('view_students'), asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, status, className, academicYear } = req.query;

  let query = {};

  // Role-based filtering
  if (req.user.role === 'parent') {
    query['parents.userId'] = req.user._id;
  }

  // Search functionality
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { studentId: { $regex: search, $options: 'i' } }
    ];
  }

  // Filter by enrollment status
  if (status) {
    query['enrollment.status'] = status;
  }

  // Filter by class
  if (className) {
    query['enrollment.className'] = className;
  }

  // Filter by academic year
  if (academicYear) {
    query['enrollment.academicYear'] = academicYear;
  }

  // Only show active students by default
  query.isActive = true;

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort: { lastName: 1, firstName: 1 },
    populate: [
      {
        path: 'parents.userId',
        select: 'firstName lastName email phone'
      },
      {
        path: 'createdBy',
        select: 'firstName lastName'
      }
    ]
  };

  const students = await Student.paginate(query, options);

  res.json({
    success: true,
    data: students.docs,
    pagination: {
      page: students.page,
      pages: students.pages,
      total: students.total,
      limit: students.limit
    }
  });
}));

// @desc    Get single student
// @route   GET /api/students/:id
// @access  Private
router.get('/:id', validateObjectId('id'), requireParentAccess, logUserAction('view_student'), asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id)
    .populate('parents.userId', 'firstName lastName email phone address')
    .populate('createdBy', 'firstName lastName')
    .populate('lastModifiedBy', 'firstName lastName');

  if (!student || !student.isActive) {
    return res.status(404).json({
      success: false,
      message: 'Student not found'
    });
  }

  res.json({
    success: true,
    data: student
  });
}));

// @desc    Create new student
// @route   POST /api/students
// @access  Private (Admin/Teacher)
router.post('/', authorize('admin', 'teacher'), validateStudentCreation, logUserAction('create_student'), asyncHandler(async (req, res) => {
  const studentData = {
    ...req.body,
    createdBy: req.user._id,
    lastModifiedBy: req.user._id
  };

  const student = new Student(studentData);
  await student.save();

  await student.populate('parents.userId', 'firstName lastName email phone');

  logger.audit('Student created', {
    studentId: student._id,
    studentName: student.fullName,
    createdBy: req.user._id
  });

  res.status(201).json({
    success: true,
    message: 'Student created successfully',
    data: student
  });
}));

// @desc    Update student
// @route   PUT /api/students/:id
// @access  Private (Admin/Teacher, or parent for limited fields)
router.put('/:id', validateObjectId('id'), requireParentAccess, logUserAction('update_student'), asyncHandler(async (req, res) => {
  let allowedUpdates = [];

  // Define allowed updates based on role
  if (['admin', 'teacher'].includes(req.user.role)) {
    allowedUpdates = [
      'firstName', 'lastName', 'dateOfBirth', 'gender', 'parents', 'emergencyContacts',
      'enrollment', 'montessori', 'health', 'behavior', 'transportation', 'documents',
      'financial', 'notes'
    ];
  } else if (req.user.role === 'parent') {
    allowedUpdates = [
      'emergencyContacts', 'health', 'transportation', 'documents'
    ];
  }

  const updates = {};
  Object.keys(req.body).forEach(key => {
    if (allowedUpdates.includes(key)) {
      updates[key] = req.body[key];
    }
  });

  updates.lastModifiedBy = req.user._id;

  const student = await Student.findByIdAndUpdate(
    req.params.id,
    updates,
    { new: true, runValidators: true }
  ).populate('parents.userId', 'firstName lastName email phone');

  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student not found'
    });
  }

  logger.audit('Student updated', {
    studentId: student._id,
    studentName: student.fullName,
    updatedBy: req.user._id,
    updatedFields: Object.keys(updates)
  });

  res.json({
    success: true,
    message: 'Student updated successfully',
    data: student
  });
}));

// @desc    Add observation to student
// @route   POST /api/students/:id/observations
// @access  Private (Admin/Teacher)
router.post('/:id/observations', validateObjectId('id'), authorize('admin', 'teacher'), logUserAction('add_observation'), asyncHandler(async (req, res) => {
  const { observer, workObserved, concentration, socialInteraction, independence, notes, developmentalMilestones, areasOfInterest, challenges } = req.body;

  const student = await Student.findById(req.params.id);
  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student not found'
    });
  }

  const observationData = {
    observer: observer || `${req.user.firstName} ${req.user.lastName}`,
    workObserved,
    concentration,
    socialInteraction,
    independence,
    notes,
    developmentalMilestones,
    areasOfInterest,
    challenges
  };

  await student.addObservation(observationData);

  logger.audit('Observation added', {
    studentId: student._id,
    studentName: student.fullName,
    observer: observationData.observer,
    addedBy: req.user._id
  });

  res.status(201).json({
    success: true,
    message: 'Observation added successfully'
  });
}));

// @desc    Add communication entry
// @route   POST /api/students/:id/communications
// @access  Private
router.post('/:id/communications', validateObjectId('id'), requireParentAccess, logUserAction('add_communication'), asyncHandler(async (req, res) => {
  const { type, direction, from, to, subject, message, priority, followUpRequired, followUpDate } = req.body;

  const student = await Student.findById(req.params.id);
  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student not found'
    });
  }

  const communicationData = {
    type,
    direction,
    from: from || `${req.user.firstName} ${req.user.lastName}`,
    to,
    subject,
    message,
    priority,
    followUpRequired,
    followUpDate
  };

  await student.addCommunication(communicationData);

  res.status(201).json({
    success: true,
    message: 'Communication entry added successfully'
  });
}));

// @desc    Get student payment summary
// @route   GET /api/students/:id/payments
// @access  Private
router.get('/:id/payments', validateObjectId('id'), requireParentAccess, logUserAction('view_student_payments'), asyncHandler(async (req, res) => {
  const Payment = require('../models/Payment');
  
  const summary = await Payment.getStudentPaymentSummary(req.params.id);

  res.json({
    success: true,
    data: summary
  });
}));

// @desc    Get student attendance
// @route   GET /api/students/:id/attendance
// @access  Private
router.get('/:id/attendance', validateObjectId('id'), requireParentAccess, asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  const student = await Student.findById(req.params.id);
  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student not found'
    });
  }

  let attendance = student.attendance;

  // Filter by date range if provided
  if (startDate || endDate) {
    attendance = attendance.filter(entry => {
      const entryDate = new Date(entry.date);
      if (startDate && entryDate < new Date(startDate)) return false;
      if (endDate && entryDate > new Date(endDate)) return false;
      return true;
    });
  }

  // Calculate attendance statistics
  const totalDays = attendance.length;
  const presentDays = attendance.filter(entry => entry.status === 'present').length;
  const absentDays = attendance.filter(entry => entry.status === 'absent').length;
  const lateDays = attendance.filter(entry => entry.status === 'late').length;

  res.json({
    success: true,
    data: {
      attendance: attendance.sort((a, b) => new Date(b.date) - new Date(a.date)),
      statistics: {
        totalDays,
        presentDays,
        absentDays,
        lateDays,
        attendanceRate: totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0
      }
    }
  });
}));

// @desc    Archive student (soft delete)
// @route   DELETE /api/students/:id
// @access  Private (Admin only)
router.delete('/:id', validateObjectId('id'), authorize('admin'), logUserAction('archive_student'), asyncHandler(async (req, res) => {
  const { archiveReason } = req.body;

  const student = await Student.findByIdAndUpdate(
    req.params.id,
    {
      isActive: false,
      archiveReason: archiveReason || 'Archived by administrator',
      lastModifiedBy: req.user._id
    },
    { new: true }
  );

  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student not found'
    });
  }

  logger.audit('Student archived', {
    studentId: student._id,
    studentName: student.fullName,
    reason: archiveReason,
    archivedBy: req.user._id
  });

  res.json({
    success: true,
    message: 'Student archived successfully'
  });
}));

module.exports = router;

// =============================================================================

// routes/emails.js
const express = require('express');
const Email = require('../models/Email');
const { authorize, logUserAction } = require('../middleware/auth');
const { validateEmailProcessing, validatePagination, validateDateRange } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');
const emailService = require('../services/emailService');
const aiService = require('../services/aiService');
const logger = require('../utils/logger');

const router = express.Router();

// @desc    Get all emails
// @route   GET /api/emails
// @access  Private (Admin/Teacher)
router.get('/', authorize('admin', 'teacher'), validatePagination, validateDateRange, logUserAction('view_emails'), asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, category, priority, processed, requiresAction, search, startDate, endDate } = req.query;

  let query = {};

  // Filter by category
  if (category) {
    query['aiProcessing.category'] = category;
  }

  // Filter by priority
  if (priority) {
    query['aiProcessing.priority'] = priority;
  }

  // Filter by processed status
  if (processed !== undefined) {
    query['aiProcessing.processed'] = processed === 'true';
  }

  // Filter by requires action flag
  if (requiresAction !== undefined) {
    query['flags.requiresAction'] = requiresAction === 'true';
  }

  // Search functionality
  if (search) {
    query.$or = [
      { subject: { $regex: search, $options: 'i' } },
      { 'from.email': { $regex: search, $options: 'i' } },
      { 'from.name': { $regex: search, $options: 'i' } },
      { snippet: { $regex: search, $options: 'i' } }
    ];
  }

  // Date range filter
  if (startDate || endDate) {
    query.receivedAt = {};
    if (startDate) query.receivedAt.$gte = new Date(startDate);
    if (endDate) query.receivedAt.$lte = new Date(endDate);
  }

  // Exclude deleted emails
  query['flags.isDeleted'] = { $ne: true };

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort: { receivedAt: -1 },
    populate: [
      {
        path: 'conversation.relatedStudentId',
        select: 'firstName lastName studentId'
      },
      {
        path: 'conversation.relatedParentId',
        select: 'firstName lastName email'
      }
    ]
  };

  const emails = await Email.paginate(query, options);

  res.json({
    success: true,
    data: emails.docs,
    pagination: {
      page: emails.page,
      pages: emails.pages,
      total: emails.total,
      limit: emails.limit
    }
  });
}));

// @desc    Get single email
// @route   GET /api/emails/:id
// @access  Private (Admin/Teacher)
router.get('/:id', authorize('admin', 'teacher'), logUserAction('view_email'), asyncHandler(async (req, res) => {
  const email = await Email.findById(req.params.id)
    .populate('conversation.relatedStudentId', 'firstName lastName studentId')
    .populate('conversation.relatedParentId', 'firstName lastName email')
    .populate('manualReview.reviewedBy', 'firstName lastName')
    .populate('response.respondedBy', 'firstName lastName')
    .populate('internalNotes.author', 'firstName lastName');

  if (!email || email.flags.isDeleted) {
    return res.status(404).json({
      success: false,
      message: 'Email not found'
    });
  }

  // Mark as read if not already read
  if (!email.flags.isRead) {
    email.flags.isRead = true;
    await email.save();
  }

  res.json({
    success: true,
    data: email
  });
}));

// @desc    Fetch new emails from Gmail
// @route   POST /api/emails/fetch
// @access  Private (Admin/Teacher)
router.post('/fetch', authorize('admin', 'teacher'), logUserAction('fetch_emails'), asyncHandler(async (req, res) => {
  const newEmails = await emailService.fetchNewEmails();

  logger.audit('Emails fetched', {
    count: newEmails.length,
    fetchedBy: req.user._id
  });

  res.json({
    success: true,
    message: `${newEmails.length} new emails fetched`,
    data: { count: newEmails.length }
  });
}));

// @desc    Process email with AI
// @route   POST /api/emails/:id/process
// @access  Private (Admin/Teacher)
router.post('/:id/process', authorize('admin', 'teacher'), logUserAction('process_email'), asyncHandler(async (req, res) => {
  const email = await Email.findById(req.params.id);

  if (!email) {
    return res.status(404).json({
      success: false,
      message: 'Email not found'
    });
  }

  if (email.aiProcessing.processed) {
    return res.status(400).json({
      success: false,
      message: 'Email has already been processed'
    });
  }

  const analysis = await aiService.processEmail(email);

  logger.audit('Email processed by AI', {
    emailId: email._id,
    category: analysis.category,
    priority: analysis.priority,
    processedBy: req.user._id
  });

  res.json({
    success: true,
    message: 'Email processed successfully',
    data: analysis
  });
}));

// @desc    Update email flags
// @route   PATCH /api/emails/:id/flags
// @access  Private (Admin/Teacher)
router.patch('/:id/flags', authorize('admin', 'teacher'), logUserAction('update_email_flags'), asyncHandler(async (req, res) => {
  const { isRead, isImportant, isStarred, isArchived, requiresAction } = req.body;

  const updateData = {};
  if (isRead !== undefined) updateData['flags.isRead'] = isRead;
  if (isImportant !== undefined) updateData['flags.isImportant'] = isImportant;
  if (isStarred !== undefined) updateData['flags.isStarred'] = isStarred;
  if (isArchived !== undefined) updateData['flags.isArchived'] = isArchived;
  if (requiresAction !== undefined) updateData['flags.requiresAction'] = requiresAction;

  const email = await Email.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true }
  );

  if (!email) {
    return res.status(404).json({
      success: false,
      message: 'Email not found'
    });
  }

  res.json({
    success: true,
    message: 'Email flags updated successfully',
    data: email.flags
  });
}));

// @desc    Add internal note to email
// @route   POST /api/emails/:id/notes
// @access  Private (Admin/Teacher)
router.post('/:id/notes', authorize('admin', 'teacher'), logUserAction('add_email_note'), asyncHandler(async (req, res) => {
  const { note, private: isPrivate = true } = req.body;

  if (!note || note.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Note content is required'
    });
  }

  const email = await Email.findById(req.params.id);

  if (!email) {
    return res.status(404).json({
      success: false,
      message: 'Email not found'
    });
  }

  await email.addInternalNote(note.trim(), req.user._id, isPrivate);

  res.status(201).json({
    success: true,
    message: 'Note added successfully'
  });
}));

// @desc    Generate AI response for email
// @route   POST /api/emails/:id/generate-response
// @access  Private (Admin/Teacher)
router.post('/:id/generate-response', authorize('admin', 'teacher'), logUserAction('generate_email_response'), asyncHandler(async (req, res) => {
  const { template } = req.body;

  const email = await Email.findById(req.params.id);

  if (!email) {
    return res.status(404).json({
      success: false,
      message: 'Email not found'
    });
  }

  const generatedResponse = await aiService.generateEmailResponse(email, template);

  res.json({
    success: true,
    message: 'Response generated successfully',
    data: {
      response: generatedResponse,
      template: template
    }
  });
}));

// @desc    Send email response
// @route   POST /api/emails/:id/respond
// @access  Private (Admin/Teacher)
router.post('/:id/respond', authorize('admin', 'teacher'), logUserAction('send_email_response'), asyncHandler(async (req, res) => {
  const { responseText, responseType = 'custom', templateUsed } = req.body;

  if (!responseText || responseText.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Response text is required'
    });
  }

  const email = await Email.findById(req.params.id);

  if (!email) {
    return res.status(404).json({
      success: false,
      message: 'Email not found'
    });
  }

  // Send email response
  const emailData = {
    to: email.from.email,
    subject: `Re: ${email.subject}`,
    text: responseText,
    html: responseText.replace(/\n/g, '<br>')
  };

  const result = await emailService.sendEmail(emailData);

  // Update email with response information
  const responseData = {
    responseType,
    responseText,
    responseMessageId: result.messageId,
    templateUsed
  };

  await email.addResponse(responseData, req.user._id);

  logger.audit('Email response sent', {
    emailId: email._id,
    originalSender: email.from.email,
    respondedBy: req.user._id,
    responseType
  });

  res.json({
    success: true,
    message: 'Response sent successfully'
  });
}));

// @desc    Link email to student/parent
// @route   PATCH /api/emails/:id/link
// @access  Private (Admin/Teacher)
router.patch('/:id/link', authorize('admin', 'teacher'), logUserAction('link_email'), asyncHandler(async (req, res) => {
  const { studentId, parentId } = req.body;

  const email = await Email.findById(req.params.id);

  if (!email) {
    return res.status(404).json({
      success: false,
      message: 'Email not found'
    });
  }

  await email.linkToContact(studentId, parentId);

  res.json({
    success: true,
    message: 'Email linked successfully'
  });
}));

// @desc    Get email statistics
// @route   GET /api/emails/stats
// @access  Private (Admin/Teacher)
router.get('/stats/overview', authorize('admin', 'teacher'), logUserAction('view_email_stats'), asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(days));

  const stats = await Email.aggregate([
    {
      $match: {
        receivedAt: { $gte: startDate },
        'flags.isDeleted': { $ne: true }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        processed: {
          $sum: {
            $cond: ['$aiProcessing.processed', 1, 0]
          }
        },
        requiresAction: {
          $sum: {
            $cond: ['$flags.requiresAction', 1, 0]
          }
        },
        responded: {
          $sum: {
            $cond: [{ $eq: ['$response.status', 'sent'] }, 1, 0]
          }
        },
        categoryCounts: {
          $push: '$aiProcessing.category'
        },
        priorityCounts: {
          $push: '$aiProcessing.priority'
        }
      }
    }
  ]);

  const result = stats[0] || {
    total: 0,
    processed: 0,
    requiresAction: 0,
    responded: 0,
    categoryCounts: [],
    priorityCounts: []
  };

  // Count categories and priorities
  const categoryStats = {};
  const priorityStats = {};

  result.categoryCounts.forEach(category => {
    if (category) {
      categoryStats[category] = (categoryStats[category] || 0) + 1;
    }
  });

  result.priorityCounts.forEach(priority => {
    if (priority) {
      priorityStats[priority] = (priorityStats[priority] || 0) + 1;
    }
  });

  res.json({
    success: true,
    data: {
      period: `${days} days`,
      overview: {
        total: result.total,
        processed: result.processed,
        requiresAction: result.requiresAction,
        responded: result.responded,
        responseRate: result.total > 0 ? Math.round((result.responded / result.total) * 100) : 0
      },
      categories: categoryStats,
      priorities: priorityStats
    }
  });
}));

module.exports = router;