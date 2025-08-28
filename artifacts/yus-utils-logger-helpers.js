// utils/logger.js
const winston = require('winston');
const path = require('path');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'yus-montessori-school',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          let log = `${timestamp} [${level}]: ${message}`;
          
          // Add metadata if present
          if (Object.keys(meta).length > 0) {
            log += `\n${JSON.stringify(meta, null, 2)}`;
          }
          
          return log;
        })
      )
    }),

    // File transport for all logs
    new winston.transports.File({
      filename: process.env.LOG_FILE || path.join(__dirname, '../logs/app.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: logFormat
    }),

    // Separate file for errors
    new winston.transports.File({
      filename: process.env.ERROR_LOG_FILE || path.join(__dirname, '../logs/error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: logFormat
    })
  ],

  // Handle exceptions
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/exceptions.log')
    })
  ],

  // Handle rejections
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/rejections.log')
    })
  ]
});

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Add request ID to logs if available
logger.addRequestId = (req, res, next) => {
  req.id = require('crypto').randomBytes(16).toString('hex');
  logger.defaultMeta.requestId = req.id;
  next();
};

// Custom log methods for different contexts
logger.audit = (message, meta = {}) => {
  logger.info(message, { ...meta, type: 'AUDIT' });
};

logger.security = (message, meta = {}) => {
  logger.warn(message, { ...meta, type: 'SECURITY' });
};

logger.performance = (message, meta = {}) => {
  logger.info(message, { ...meta, type: 'PERFORMANCE' });
};

logger.database = (message, meta = {}) => {
  logger.info(message, { ...meta, type: 'DATABASE' });
};

logger.email = (message, meta = {}) => {
  logger.info(message, { ...meta, type: 'EMAIL' });
};

logger.payment = (message, meta = {}) => {
  logger.info(message, { ...meta, type: 'PAYMENT' });
};

logger.ai = (message, meta = {}) => {
  logger.info(message, { ...meta, type: 'AI' });
};

// Performance monitoring middleware
logger.performanceMiddleware = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    if (duration > 1000) { // Log slow requests (>1 second)
      logger.performance('Slow request detected', {
        method: req.method,
        url: req.originalUrl,
        duration: `${duration}ms`,
        statusCode: res.statusCode,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
    }
  });
  
  next();
};

module.exports = logger;

// =============================================================================

// utils/helpers.js
const crypto = require('crypto');
const validator = require('validator');

class Helpers {
  
  // Generate secure random strings
  static generateRandomString(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  // Generate secure passwords
  static generatePassword(length = 12) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    return password;
  }

  // Format phone numbers
  static formatPhoneNumber(phone) {
    if (!phone) return null;
    
    // Remove all non-digits
    const cleaned = phone.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX for 10-digit numbers
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    
    // Format as +1 (XXX) XXX-XXXX for 11-digit numbers starting with 1
    if (cleaned.length === 11 && cleaned[0] === '1') {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    
    return phone; // Return original if can't format
  }

  // Validate Canadian postal code
  static isValidPostalCode(postalCode) {
    if (!postalCode) return false;
    const canadianPostalRegex = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d$/i;
    return canadianPostalRegex.test(postalCode.replace(/\s/g, ''));
  }

  // Format Canadian postal code
  static formatPostalCode(postalCode) {
    if (!postalCode || !this.isValidPostalCode(postalCode)) return postalCode;
    
    const cleaned = postalCode.replace(/\s/g, '').toUpperCase();
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
  }

  // Calculate age from date of birth
  static calculateAge(dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  // Format currency
  static formatCurrency(amount, currency = 'CAD') {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  // Format date for display
  static formatDate(date, options = {}) {
    const defaultOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'America/Vancouver'
    };
    
    return new Date(date).toLocaleDateString('en-CA', { ...defaultOptions, ...options });
  }

  // Format datetime for display
  static formatDateTime(date, options = {}) {
    const defaultOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Vancouver'
    };
    
    return new Date(date).toLocaleString('en-CA', { ...defaultOptions, ...options });
  }

  // Sanitize HTML content
  static sanitizeHtml(html) {
    if (!html) return '';
    
    // Basic HTML sanitization - in production, use a library like DOMPurify
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }

  // Generate slug from text
  static generateSlug(text) {
    if (!text) return '';
    
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[-\s]+/g, '-') // Replace spaces and hyphens with single hyphen
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  // Deep clone object
  static deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // Check if object is empty
  static isEmpty(obj) {
    if (obj == null) return true;
    if (Array.isArray(obj) || typeof obj === 'string') return obj.length === 0;
    return Object.keys(obj).length === 0;
  }

  // Capitalize first letter
  static capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  // Format name properly
  static formatName(firstName, lastName) {
    const first = firstName ? this.capitalize(firstName.trim()) : '';
    const last = lastName ? this.capitalize(lastName.trim()) : '';
    return `${first} ${last}`.trim();
  }

  // Generate initials
  static generateInitials(firstName, lastName) {
    const first = firstName ? firstName.charAt(0).toUpperCase() : '';
    const last = lastName ? lastName.charAt(0).toUpperCase() : '';
    return `${first}${last}`;
  }

  // Validate email format
  static isValidEmail(email) {
    return validator.isEmail(email);
  }

  // Generate academic year string
  static getCurrentAcademicYear() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    // Academic year starts in September (month 8)
    if (currentMonth >= 8) {
      return `${currentYear}-${currentYear + 1}`;
    } else {
      return `${currentYear - 1}-${currentYear}`;
    }
  }

  // Get next academic year
  static getNextAcademicYear() {
    const current = this.getCurrentAcademicYear();
    const startYear = parseInt(current.split('-')[0]);
    return `${startYear + 1}-${startYear + 2}`;
  }

  // Calculate business days between dates (excludes weekends)
  static calculateBusinessDays(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let businessDays = 0;
    
    while (start <= end) {
      const dayOfWeek = start.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
        businessDays++;
      }
      start.setDate(start.getDate() + 1);
    }
    
    return businessDays;
  }

  // Check if date is a school day (Monday-Friday, not holidays)
  static isSchoolDay(date, holidays = []) {
    const dayOfWeek = new Date(date).getDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const isHoliday = holidays.some(holiday => 
      new Date(holiday).toDateString() === new Date(date).toDateString()
    );
    
    return isWeekday && !isHoliday;
  }

  // Generate QR code data URL (placeholder - would use actual QR library in production)
  static generateQRCode(data) {
    // This would integrate with a QR code library like 'qrcode'
    return `data:image/svg+xml;base64,${Buffer.from(`<svg>QR:${data}</svg>`).toString('base64')}`;
  }

  // Mask sensitive data for logging
  static maskSensitiveData(data, fields = ['password', 'token', 'secret', 'key']) {
    const masked = { ...data };
    
    fields.forEach(field => {
      if (masked[field]) {
        masked[field] = '***MASKED***';
      }
    });
    
    return masked;
  }

  // Generate file name with timestamp
  static generateFileName(originalName, prefix = '') {
    const timestamp = Date.now();
    const extension = originalName.split('.').pop();
    const baseName = originalName.split('.').slice(0, -1).join('.');
    const safeName = this.generateSlug(baseName);
    
    return `${prefix}${prefix ? '_' : ''}${safeName}_${timestamp}.${extension}`;
  }

  // Convert bytes to human readable format
  static formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  // Debounce function
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Throttle function
  static throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // Retry function with exponential backoff
  static async retry(fn, maxAttempts = 3, delay = 1000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error;
        }
        
        const waitTime = delay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  // Safe JSON parse
  static safeJsonParse(str, defaultValue = null) {
    try {
      return JSON.parse(str);
    } catch (error) {
      return defaultValue;
    }
  }

  // Generate color from string (for avatars, etc.)
  static stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 65%, 50%)`;
  }
}

module.exports = Helpers;

// =============================================================================

// utils/constants.js
module.exports = {
  // User roles
  USER_ROLES: {
    ADMIN: 'admin',
    TEACHER: 'teacher',
    PARENT: 'parent'
  },

  // Account statuses
  ACCOUNT_STATUS: {
    ACTIVE: 'active',
    SUSPENDED: 'suspended',
    PENDING: 'pending',
    INACTIVE: 'inactive'
  },

  // Student enrollment statuses
  ENROLLMENT_STATUS: {
    ENROLLED: 'enrolled',
    PENDING: 'pending',
    WAITLISTED: 'waitlisted',
    GRADUATED: 'graduated',
    WITHDRAWN: 'withdrawn'
  },

  // Montessori cycles
  MONTESSORI_CYCLES: {
    TODDLER: 'toddler',
    PRIMARY: 'primary',
    ELEMENTARY_LOWER: 'elementary-lower',
    ELEMENTARY_UPPER: 'elementary-upper',
    ADOLESCENT: 'adolescent'
  },

  // Payment types
  PAYMENT_TYPES: {
    TUITION: 'tuition',
    REGISTRATION: 'registration',
    LATE_FEE: 'late-fee',
    MATERIALS_FEE: 'materials-fee',
    FIELD_TRIP: 'field-trip',
    LUNCH_PROGRAM: 'lunch-program',
    EXTENDED_CARE: 'extended-care',
    SUMMER_CAMP: 'summer-camp',
    OTHER: 'other'
  },

  // Payment statuses
  PAYMENT_STATUS: {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    REFUNDED: 'refunded',
    CANCELLED: 'cancelled',
    OVERDUE: 'overdue'
  },

  // Email categories
  EMAIL_CATEGORIES: {
    ENROLLMENT_INQUIRY: 'enrollment-inquiry',
    PARENT_QUESTION: 'parent-question',
    PAYMENT_INQUIRY: 'payment-inquiry',
    SCHEDULE_REQUEST: 'schedule-request',
    COMPLAINT: 'complaint',
    COMPLIMENT: 'compliment',
    URGENT: 'urgent',
    VENDOR: 'vendor',
    SPAM: 'spam',
    NEWSLETTER: 'newsletter',
    ADMINISTRATIVE: 'administrative',
    TOUR_REQUEST: 'tour-request',
    GENERAL: 'general',
    UNCLASSIFIED: 'unclassified'
  },

  // Priority levels
  PRIORITY_LEVELS: {
    LOW: 'low',
    NORMAL: 'normal',
    HIGH: 'high',
    URGENT: 'urgent'
  },

  // Sentiment types
  SENTIMENT_TYPES: {
    POSITIVE: 'positive',
    NEUTRAL: 'neutral',
    NEGATIVE: 'negative'
  },

  // Expense categories
  EXPENSE_CATEGORIES: {
    SUPPLIES: 'supplies',
    EQUIPMENT: 'equipment',
    MAINTENANCE: 'maintenance',
    UTILITIES: 'utilities',
    INSURANCE: 'insurance',
    PROFESSIONAL_SERVICES: 'professional-services',
    MARKETING: 'marketing',
    FOOD_PROGRAM: 'food-program',
    STAFF_TRAINING: 'staff-training',
    LICENSING_FEES: 'licensing-fees',
    RENT: 'rent',
    TECHNOLOGY: 'technology',
    OTHER: 'other'
  },

  // Newsletter types
  NEWSLETTER_TYPES: {
    WEEKLY: 'weekly',
    MONTHLY: 'monthly',
    SPECIAL: 'special',
    ANNOUNCEMENT: 'announcement',
    EVENT: 'event'
  },

  // Waitlist statuses
  WAITLIST_STATUS: {
    ACTIVE: 'active',
    CONTACTED: 'contacted',
    OFFERED: 'offered',
    ACCEPTED: 'accepted',
    DECLINED: 'declined',
    EXPIRED: 'expired',
    REMOVED: 'removed'
  },

  // File upload limits
  FILE_LIMITS: {
    MAX_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_TYPES: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  },

  // School settings
  SCHOOL_SETTINGS: {
    DEFAULT_CURRENCY: 'CAD',
    DEFAULT_TIMEZONE: 'America/Vancouver',
    ACADEMIC_YEAR_START_MONTH: 8, // September (0-based)
    BUSINESS_HOURS: {
      START: '08:00',
      END: '17:00'
    },
    LATE_PAYMENT_GRACE_DAYS: 5,
    DEFAULT_LATE_FEE: 25.00
  },

  // API limits
  API_LIMITS: {
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
    RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
    RATE_LIMIT_MAX: 100
  },

  // Email templates
  EMAIL_TEMPLATES: {
    WELCOME: 'welcome',
    PAYMENT_CONFIRMATION: 'payment_confirmation',
    PAYMENT_REMINDER: 'payment_reminder',
    OVERDUE_NOTICE: 'overdue_notice',
    TOUR_REQUEST_RESPONSE: 'tour_request_response',
    ENROLLMENT_CONFIRMATION: 'enrollment_confirmation',
    NEWSLETTER: 'newsletter'
  },

  // Canadian provinces
  CANADIAN_PROVINCES: {
    AB: 'Alberta',
    BC: 'British Columbia',
    MB: 'Manitoba',
    NB: 'New Brunswick',
    NL: 'Newfoundland and Labrador',
    NS: 'Nova Scotia',
    ON: 'Ontario',
    PE: 'Prince Edward Island',
    QC: 'Quebec',
    SK: 'Saskatchewan',
    NT: 'Northwest Territories',
    NU: 'Nunavut',
    YT: 'Yukon'
  },

  // Common validation patterns
  VALIDATION_PATTERNS: {
    POSTAL_CODE: /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d$/i,
    PHONE: /^(\+?1[-.\s]?)?(\(?[0-9]{3}\)?[-.\s]?)?[0-9]{3}[-.\s]?[0-9]{4}$/,
    STUDENT_ID: /^YMS\d{6}$/,
    INVOICE_NUMBER: /^YMS-\d{4}-\d{5}$/
  },

  // HTTP status codes
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500
  },

  // Error types
  ERROR_TYPES: {
    VALIDATION_ERROR: 'validation_error',
    AUTHENTICATION_ERROR: 'authentication_error',
    AUTHORIZATION_ERROR: 'authorization_error',
    NOT_FOUND_ERROR: 'not_found_error',
    DUPLICATE_ERROR: 'duplicate_error',
    PAYMENT_ERROR: 'payment_error',
    EMAIL_ERROR: 'email_error',
    AI_ERROR: 'ai_error',
    DATABASE_ERROR: 'database_error',
    EXTERNAL_API_ERROR: 'external_api_error'
  }
};