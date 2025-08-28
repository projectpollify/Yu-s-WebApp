const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// Verify JWT token middleware
const authenticateToken = async (req, res, next) => {
  try {
    // Get token from header or cookie
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : req.cookies.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.'
      });
    }

    // Check if user account is active
    if (user.accountStatus !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Account is not active. Please contact administrator.'
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(401).json({
        success: false,
        message: 'Account is temporarily locked due to failed login attempts.'
      });
    }

    // Attach user to request
    req.user = user;
    next();

  } catch (error) {
    logger.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server error during authentication.'
    });
  }
};

// Role-based authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}`
      });
    }

    next();
  };
};

// Permission-based authorization
const requirePermission = (resource, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    // Admin users have all permissions
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user has specific permission
    if (!req.user.hasPermission(resource, action)) {
      return res.status(403).json({
        success: false,
        message: `Insufficient permissions for ${action} on ${resource}`
      });
    }

    next();
  };
};

// Parent access control - can only access their own children's data
const requireParentAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    // Admin and teachers can access all data
    if (['admin', 'teacher'].includes(req.user.role)) {
      return next();
    }

    // For parents, check if they have access to the requested student
    if (req.user.role === 'parent') {
      const studentId = req.params.studentId || req.params.id || req.body.studentId;
      
      if (studentId) {
        const Student = require('../models/Student');
        const student = await Student.findById(studentId);
        
        if (!student) {
          return res.status(404).json({
            success: false,
            message: 'Student not found.'
          });
        }

        // Check if the user is a parent of this student
        const isParent = student.parents.some(parent => 
          parent.userId.toString() === req.user._id.toString()
        );

        if (!isParent) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. You can only access your own children\'s data.'
          });
        }
      }
    }

    next();

  } catch (error) {
    logger.error('Parent access control error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during authorization.'
    });
  }
};

// API key authentication (for external integrations)
const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: 'API key required.'
      });
    }

    // Find user by API key
    const user = await User.findOne({ apiKey, accountStatus: 'active' });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid API key.'
      });
    }

    req.user = user;
    next();

  } catch (error) {
    logger.error('API key authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during API key authentication.'
    });
  }
};

// Rate limiting per user
const rateLimitPerUser = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const userRequests = new Map();

  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user._id.toString();
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get user's request history
    if (!userRequests.has(userId)) {
      userRequests.set(userId, []);
    }

    const requests = userRequests.get(userId);
    
    // Remove old requests
    const recentRequests = requests.filter(timestamp => timestamp > windowStart);
    userRequests.set(userId, recentRequests);

    // Check if user exceeded rate limit
    if (recentRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }

    // Add current request
    recentRequests.push(now);
    next();
  };
};

// Two-factor authentication verification
const requireTwoFactor = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    // Skip 2FA check if not enabled for user
    if (!req.user.twoFactorEnabled) {
      return next();
    }

    const twoFactorCode = req.headers['x-2fa-code'] || req.body.twoFactorCode;
    
    if (!twoFactorCode) {
      return res.status(401).json({
        success: false,
        message: 'Two-factor authentication code required.',
        requiresTwoFactor: true
      });
    }

    // Verify 2FA code (implementation would depend on your 2FA provider)
    const isValidCode = await verifyTwoFactorCode(req.user.twoFactorSecret, twoFactorCode);
    
    if (!isValidCode) {
      return res.status(401).json({
        success: false,
        message: 'Invalid two-factor authentication code.'
      });
    }

    next();

  } catch (error) {
    logger.error('Two-factor authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during two-factor authentication.'
    });
  }
};

// Verify 2FA code helper function
const verifyTwoFactorCode = async (secret, code) => {
  // This would integrate with your 2FA provider (Google Authenticator, Authy, etc.)
  // For now, return true as placeholder
  return true;
};

// Session validation
const validateSession = async (req, res, next) => {
  try {
    if (req.session && req.session.userId) {
      const user = await User.findById(req.session.userId).select('-password');
      
      if (user && user.accountStatus === 'active') {
        req.user = user;
        return next();
      }
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid session. Please login again.'
    });

  } catch (error) {
    logger.error('Session validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during session validation.'
    });
  }
};

// Middleware to log user actions
const logUserAction = (action) => {
  return (req, res, next) => {
    if (req.user) {
      logger.info(`User action: ${action}`, {
        userId: req.user._id,
        userEmail: req.user.email,
        userRole: req.user.role,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
    }
    next();
  };
};

module.exports = {
  generateToken,
  authenticateToken,
  authorize,
  requirePermission,
  requireParentAccess,
  authenticateApiKey,
  rateLimitPerUser,
  requireTwoFactor,
  validateSession,
  logUserAction
};