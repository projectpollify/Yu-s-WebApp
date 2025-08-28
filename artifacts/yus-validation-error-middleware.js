// middleware/validation.js
const { body, param, query, validationResult } = require('express-validator');
const logger = require('../utils/logger');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }));

    logger.warn('Validation errors:', {
      url: req.originalUrl,
      method: req.method,
      errors: errorMessages,
      userId: req.user?.id
    });

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errorMessages
    });
  }
  
  next();
};

// User registration validation
const validateUserRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .isLength({ min: 6, max: 128 })
    .withMessage('Password must be between 6 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name is required and must be less than 50 characters'),
  
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name is required and must be less than 50 characters'),
  
  body('phone')
    .optional()
    .isMobilePhone('any', { strictMode: false })
    .withMessage('Please provide a valid phone number'),
  
  body('role')
    .optional()
    .isIn(['admin', 'teacher', 'parent'])
    .withMessage('Role must be admin, teacher, or parent'),
  
  handleValidationErrors
];

// User login validation
const validateUserLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  handleValidationErrors
];

// Student creation validation
const validateStudentCreation = [
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name is required and must be less than 50 characters'),
  
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name is required and must be less than 50 characters'),
  
  body('dateOfBirth')
    .isISO8601()
    .withMessage('Please provide a valid date of birth')
    .custom((value) => {
      const birthDate = new Date(value);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      
      if (age < 0 || age > 18) {
        throw new Error('Student age must be between 0 and 18 years');
      }
      return true;
    }),
  
  body('gender')
    .isIn(['male', 'female', 'other', 'prefer-not-to-say'])
    .withMessage('Gender must be male, female, other, or prefer-not-to-say'),
  
  body('parents')
    .isArray({ min: 1 })
    .withMessage('At least one parent is required'),
  
  body('parents.*.relationship')
    .isIn(['mother', 'father', 'guardian', 'grandparent', 'other'])
    .withMessage('Parent relationship must be mother, father, guardian, grandparent, or other'),
  
  body('enrollment.startDate')
    .isISO8601()
    .withMessage('Please provide a valid enrollment start date'),
  
  body('enrollment.status')
    .optional()
    .isIn(['enrolled', 'pending', 'waitlisted', 'graduated', 'withdrawn'])
    .withMessage('Invalid enrollment status'),
  
  body('montessori.currentCycle')
    .isIn(['toddler', 'primary', 'elementary-lower', 'elementary-upper', 'adolescent'])
    .withMessage('Invalid Montessori cycle'),
  
  handleValidationErrors
];

// Payment creation validation
const validatePaymentCreation = [
  body('studentId')
    .isMongoId()
    .withMessage('Invalid student ID'),
  
  body('amount')
    .isFloat({ min: 0 })
    .withMessage('Amount must be a positive number'),
  
  body('type')
    .isIn(['tuition', 'registration', 'late-fee', 'materials-fee', 'field-trip', 'lunch-program', 'extended-care', 'summer-camp', 'other'])
    .withMessage('Invalid payment type'),
  
  body('description')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Description is required and must be less than 200 characters'),
  
  body('dueDate')
    .isISO8601()
    .withMessage('Please provide a valid due date'),
  
  body('academicYear')
    .matches(/^\d{4}-\d{4}$/)
    .withMessage('Academic year must be in format YYYY-YYYY (e.g., 2024-2025)'),
  
  handleValidationErrors
];

// Email processing validation
const validateEmailProcessing = [
  body('messageId')
    .notEmpty()
    .withMessage('Message ID is required'),
  
  body('from.email')
    .isEmail()
    .withMessage('Valid sender email is required'),
  
  body('subject')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Subject is required'),
  
  body('body.text')
    .optional()
    .isLength({ max: 10000 })
    .withMessage('Email body text is too long'),
  
  body('receivedAt')
    .isISO8601()
    .withMessage('Valid received date is required'),
  
  handleValidationErrors
];

// Expense creation validation
const validateExpenseCreation = [
  body('description')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Description is required and must be less than 200 characters'),
  
  body('amount')
    .isFloat({ min: 0 })
    .withMessage('Amount must be a positive number'),
  
  body('date')
    .isISO8601()
    .withMessage('Please provide a valid date'),
  
  body('category')
    .isIn(['supplies', 'equipment', 'maintenance', 'utilities', 'insurance', 'professional-services', 'marketing', 'food-program', 'staff-training', 'licensing-fees', 'rent', 'technology', 'other'])
    .withMessage('Invalid expense category'),
  
  body('paymentMethod')
    .isIn(['cash', 'credit-card', 'debit-card', 'cheque', 'bank-transfer', 'paypal'])
    .withMessage('Invalid payment method'),
  
  handleValidationErrors
];

// Newsletter creation validation
const validateNewsletterCreation = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title is required and must be less than 100 characters'),
  
  body('subject')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Email subject is required and must be less than 200 characters'),
  
  body('type')
    .isIn(['weekly', 'monthly', 'special', 'announcement', 'event'])
    .withMessage('Invalid newsletter type'),
  
  body('content.html')
    .optional()
    .isLength({ min: 1 })
    .withMessage('Newsletter content is required'),
  
  body('scheduledDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid scheduled date'),
  
  handleValidationErrors
];

// Waitlist entry validation
const validateWaitlistEntry = [
  body('childName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Child name is required and must be less than 50 characters'),
  
  body('dateOfBirth')
    .isISO8601()
    .withMessage('Please provide a valid date of birth'),
  
  body('parentName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Parent name is required and must be less than 50 characters'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('phone')
    .isMobilePhone('any', { strictMode: false })
    .withMessage('Please provide a valid phone number'),
  
  body('preferredStartDate')
    .isISO8601()
    .withMessage('Please provide a valid preferred start date'),
  
  body('program')
    .isIn(['toddler', 'primary', 'elementary-lower', 'elementary-upper'])
    .withMessage('Invalid program selection'),
  
  handleValidationErrors
];

// MongoDB ObjectId validation
const validateObjectId = (field) => [
  param(field)
    .isMongoId()
    .withMessage(`Invalid ${field} format`),
  
  handleValidationErrors
];

// Date range validation
const validateDateRange = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date')
    .custom((endDate, { req }) => {
      if (req.query.startDate && endDate) {
        const start = new Date(req.query.startDate);
        const end = new Date(endDate);
        if (end <= start) {
          throw new Error('End date must be after start date');
        }
      }
      return true;
    }),
  
  handleValidationErrors
];

// Pagination validation
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateUserRegistration,
  validateUserLogin,
  validateStudentCreation,
  validatePaymentCreation,
  validateEmailProcessing,
  validateExpenseCreation,
  validateNewsletterCreation,
  validateWaitlistEntry,
  validateObjectId,
  validateDateRange,
  validatePagination
};

// =============================================================================

// middleware/errorHandler.js
const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error('Error Handler:', {
    error: error.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    timestamp: new Date().toISOString()
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message, statusCode: 400 };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { message, statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { message, statusCode: 401 };
  }

  // Multer errors (file upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'File size too large';
    error = { message, statusCode: 400 };
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    const message = 'Too many files';
    error = { message, statusCode: 400 };
  }

  // Rate limiting error
  if (err.statusCode === 429) {
    const message = 'Too many requests, please try again later';
    error = { message, statusCode: 429 };
  }

  // Database connection errors
  if (err.name === 'MongoNetworkError' || err.name === 'MongooseServerSelectionError') {
    const message = 'Database connection error';
    error = { message, statusCode: 500 };
  }

  // Stripe payment errors
  if (err.type === 'StripeCardError') {
    const message = err.message || 'Payment processing error';
    error = { message, statusCode: 400 };
  }

  if (err.type === 'StripeInvalidRequestError') {
    const message = 'Invalid payment request';
    error = { message, statusCode: 400 };
  }

  // Gmail API errors
  if (err.code === 403 && err.errors?.[0]?.reason === 'rateLimitExceeded') {
    const message = 'Gmail API rate limit exceeded';
    error = { message, statusCode: 429 };
  }

  // OpenAI API errors
  if (err.status === 429 && err.code === 'rate_limit_exceeded') {
    const message = 'AI service rate limit exceeded';
    error = { message, statusCode: 429 };
  }

  if (err.status === 401 && err.code === 'invalid_api_key') {
    const message = 'AI service authentication failed';
    error = { message, statusCode: 500 };
  }

  // Default error
  const statusCode = error.statusCode || err.statusCode || 500;
  const message = error.message || 'Server Error';

  // Don't expose internal errors in production
  const response = {
    success: false,
    message: process.env.NODE_ENV === 'production' && statusCode === 500 
      ? 'Internal server error' 
      : message
  };

  // Add error details in development
  if (process.env.NODE_ENV === 'development') {
    response.error = error;
    response.stack = err.stack;
  }

  // Add request ID for tracking
  response.requestId = req.id || 'unknown';

  res.status(statusCode).json(response);
};

// Not found handler
const notFound = (req, res, next) => {
  const error = new Error(`Not found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

// Async handler wrapper to catch async errors
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  errorHandler,
  notFound,
  asyncHandler
};