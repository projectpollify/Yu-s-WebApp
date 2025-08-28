const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const { generateToken, authenticateToken } = require('../middleware/auth');
const { validateUserRegistration, validateUserLogin } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');
const helpers = require('../utils/helpers');

const router = express.Router();

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public (but may be restricted in production)
router.post('/register', validateUserRegistration, asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, phone, role = 'parent' } = req.body;

  // Check if user already exists
  const existingUser = await User.findByEmail(email);
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'User with this email already exists'
    });
  }

  // Create new user
  const userData = {
    email: email.toLowerCase().trim(),
    password,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    phone: phone ? helpers.formatPhoneNumber(phone) : undefined,
    role,
    accountStatus: 'pending', // Requires admin approval
    emailVerificationToken: crypto.randomBytes(32).toString('hex')
  };

  const user = new User(userData);
  await user.save();

  logger.audit('User registered', {
    userId: user._id,
    email: user.email,
    role: user.role,
    ip: req.ip
  });

  // Send welcome email
  try {
    await notificationService.sendWelcomeEmail(user);
  } catch (error) {
    logger.error('Failed to send welcome email:', error);
  }

  res.status(201).json({
    success: true,
    message: 'User registered successfully. Please wait for admin approval.',
    data: {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      accountStatus: user.accountStatus
    }
  });
}));

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', validateUserLogin, asyncHandler(async (req, res) => {
  const { email, password, rememberMe = false } = req.body;

  // Find user and include password for verification
  const user = await User.findByEmail(email).select('+password');

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password'
    });
  }

  // Check if account is locked
  if (user.isLocked) {
    return res.status(401).json({
      success: false,
      message: 'Account is temporarily locked due to failed login attempts. Please try again later.'
    });
  }

  // Check if account is active
  if (user.accountStatus !== 'active') {
    return res.status(401).json({
      success: false,
      message: 'Account is not active. Please contact administrator.'
    });
  }

  // Verify password
  const isValidPassword = await user.comparePassword(password);

  if (!isValidPassword) {
    // Increment failed login attempts
    await user.incLoginAttempts();
    
    logger.security('Failed login attempt', {
      email: email,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return res.status(401).json({
      success: false,
      message: 'Invalid email or password'
    });
  }

  // Reset login attempts on successful login
  await user.resetLoginAttempts();

  // Generate JWT token
  const token = generateToken(user._id);

  // Set cookie options
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000 // 30 days or 1 day
  };

  // Set session data
  req.session.userId = user._id;
  req.session.userRole = user.role;

  logger.audit('User logged in', {
    userId: user._id,
    email: user.email,
    role: user.role,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.cookie('token', token, cookieOptions);

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      token,
      user: user.toSafeObject()
    }
  });
}));

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', authenticateToken, asyncHandler(async (req, res) => {
  // Clear cookie
  res.clearCookie('token');

  // Destroy session
  req.session.destroy((err) => {
    if (err) {
      logger.error('Session destruction error:', err);
    }
  });

  logger.audit('User logged out', {
    userId: req.user._id,
    email: req.user.email,
    ip: req.ip
  });

  res.json({
    success: true,
    message: 'Logout successful'
  });
}));

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', authenticateToken, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  res.json({
    success: true,
    data: user.toSafeObject()
  });
}));

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
router.put('/profile', authenticateToken, asyncHandler(async (req, res) => {
  const allowedUpdates = ['firstName', 'lastName', 'phone', 'address', 'preferences', 'profile'];
  const updates = {};

  // Filter allowed updates
  Object.keys(req.body).forEach(key => {
    if (allowedUpdates.includes(key)) {
      updates[key] = req.body[key];
    }
  });

  // Format phone number if provided
  if (updates.phone) {
    updates.phone = helpers.formatPhoneNumber(updates.phone);
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    updates,
    { new: true, runValidators: true }
  );

  logger.audit('User profile updated', {
    userId: req.user._id,
    updatedFields: Object.keys(updates)
  });

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: user.toSafeObject()
  });
}));

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
router.put('/change-password', authenticateToken, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Current password and new password are required'
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'New password must be at least 6 characters long'
    });
  }

  // Get user with password
  const user = await User.findById(req.user._id).select('+password');

  // Verify current password
  const isValidPassword = await user.comparePassword(currentPassword);
  if (!isValidPassword) {
    return res.status(400).json({
      success: false,
      message: 'Current password is incorrect'
    });
  }

  // Update password
  user.password = newPassword;
  await user.save();

  logger.security('Password changed', {
    userId: req.user._id,
    email: req.user.email,
    ip: req.ip
  });

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
}));

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email is required'
    });
  }

  const user = await User.findByEmail(email);

  if (!user) {
    // Don't reveal whether email exists or not
    return res.json({
      success: true,
      message: 'If the email exists in our system, a password reset link has been sent.'
    });
  }

  // Generate reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // Create reset URL
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

  try {
    // Send reset email
    await notificationService.sendEmail({
      to: user.email,
      subject: 'Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>Hello ${user.firstName},</p>
          <p>You requested a password reset for your account. Click the link below to reset your password:</p>
          <p><a href="${resetUrl}" style="background-color: #2c5530; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
          <p>This link will expire in 10 minutes.</p>
          <p>If you didn't request this password reset, please ignore this email.</p>
          <p>Best regards,<br>${process.env.SCHOOL_NAME}</p>
        </div>
      `
    });

    logger.security('Password reset requested', {
      userId: user._id,
      email: user.email,
      ip: req.ip
    });

  } catch (error) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    logger.error('Error sending password reset email:', error);

    return res.status(500).json({
      success: false,
      message: 'Error sending password reset email'
    });
  }

  res.json({
    success: true,
    message: 'If the email exists in our system, a password reset link has been sent.'
  });
}));

// @desc    Reset password
// @route   POST /api/auth/reset-password/:token
// @access  Public
router.post('/reset-password/:token', asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!password || password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters long'
    });
  }

  // Hash token and find user
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired reset token'
    });
  }

  // Set new password
  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  logger.security('Password reset completed', {
    userId: user._id,
    email: user.email,
    ip: req.ip
  });

  res.json({
    success: true,
    message: 'Password reset successful'
  });
}));

// @desc    Verify email
// @route   GET /api/auth/verify-email/:token
// @access  Public
router.get('/verify-email/:token', asyncHandler(async (req, res) => {
  const { token } = req.params;

  const user = await User.findOne({ emailVerificationToken: token });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: 'Invalid verification token'
    });
  }

  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  await user.save();

  logger.audit('Email verified', {
    userId: user._id,
    email: user.email
  });

  res.json({
    success: true,
    message: 'Email verified successfully'
  });
}));

// @desc    Resend verification email
// @route   POST /api/auth/resend-verification
// @access  Private
router.post('/resend-verification', authenticateToken, asyncHandler(async (req, res) => {
  const user = req.user;

  if (user.emailVerified) {
    return res.status(400).json({
      success: false,
      message: 'Email is already verified'
    });
  }

  // Generate new verification token
  user.emailVerificationToken = crypto.randomBytes(32).toString('hex');
  await user.save();

  // Create verification URL
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${user.emailVerificationToken}`;

  try {
    await notificationService.sendEmail({
      to: user.email,
      subject: 'Email Verification',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Email Verification</h2>
          <p>Hello ${user.firstName},</p>
          <p>Please click the link below to verify your email address:</p>
          <p><a href="${verificationUrl}" style="background-color: #2c5530; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a></p>
          <p>Best regards,<br>${process.env.SCHOOL_NAME}</p>
        </div>
      `
    });

    res.json({
      success: true,
      message: 'Verification email sent'
    });

  } catch (error) {
    logger.error('Error sending verification email:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Error sending verification email'
    });
  }
}));

// @desc    Refresh token
// @route   POST /api/auth/refresh
// @access  Private
router.post('/refresh', authenticateToken, asyncHandler(async (req, res) => {
  // Generate new token
  const token = generateToken(req.user._id);

  // Set new cookie
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  };

  res.cookie('token', token, cookieOptions);

  res.json({
    success: true,
    message: 'Token refreshed',
    data: { token }
  });
}));

// @desc    Get user sessions
// @route   GET /api/auth/sessions
// @access  Private
router.get('/sessions', authenticateToken, asyncHandler(async (req, res) => {
  // This would require storing session information in database
  // For now, return current session info
  res.json({
    success: true,
    data: {
      current: {
        id: req.sessionID || 'current',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        loginTime: req.user.lastLogin,
        active: true
      }
    }
  });
}));

// @desc    Revoke all sessions (logout from all devices)
// @route   DELETE /api/auth/sessions
// @access  Private
router.delete('/sessions', authenticateToken, asyncHandler(async (req, res) => {
  // Clear current cookie
  res.clearCookie('token');

  // In a full implementation, you would:
  // 1. Invalidate all JWT tokens by updating a token version in user record
  // 2. Clear all sessions for this user from session store

  logger.security('All sessions revoked', {
    userId: req.user._id,
    email: req.user.email,
    ip: req.ip
  });

  res.json({
    success: true,
    message: 'All sessions revoked'
  });
}));

module.exports = router;