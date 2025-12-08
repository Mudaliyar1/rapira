const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Artist = require('../models/Artist');
const { isNotLoggedIn, isLoggedIn } = require('../middleware/auth');
const { sendWelcomeEmail, sendPasswordResetEmail, sendEmail } = require('../utils/brevoEmailService');
const DeletedAccount = require('../models/DeletedAccount');
const WebsiteSettings = require('../models/WebsiteSettings');

// Simple session test for production debugging
router.get('/session-test', (req, res) => {
  res.json({
    hasSession: !!req.session,
    sessionId: req.session ? req.session.id : null,
    isLoggedIn: !!(req.session && req.session.user),
    userEmail: req.session && req.session.user ? req.session.user.email : null,
    cookieSettings: req.session ? req.session.cookie : null,
    environment: process.env.NODE_ENV,
    baseUrl: process.env.BASE_URL,
    timestamp: new Date().toISOString()
  });
});

// Session health check route (for debugging)
router.get('/session-check', (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';

  // Get MongoDB connection status
  const mongoStatus = {
    readyState: require('mongoose').connection.readyState,
    readyStateText: ['disconnected', 'connected', 'connecting', 'disconnecting'][require('mongoose').connection.readyState] || 'unknown'
  };

  const sessionInfo = {
    sessionExists: !!req.session,
    sessionID: req.session ? req.session.id : 'none',
    isLoggedIn: req.session && !!req.session.user,
    cookie: req.session ? {
      maxAge: req.session.cookie.maxAge,
      expiresIn: req.session.cookie.maxAge ? Math.floor(req.session.cookie.maxAge / 1000 / 60) + ' minutes' : 'not set',
      expires: req.session.cookie.expires,
      secure: req.session.cookie.secure,
      httpOnly: req.session.cookie.httpOnly,
      domain: req.session.cookie.domain || 'not set',
      sameSite: req.session.cookie.sameSite,
      path: req.session.cookie.path || '/'
    } : 'no cookie',
    user: req.session && req.session.user ? {
      id: req.session.user.id,
      name: req.session.user.name,
      email: req.session.user.email,
      role: req.session.user.role,
      loginTime: req.session.user.loginTime || 'unknown'
    } : 'not logged in',
    environment: {
      nodeEnv: process.env.NODE_ENV || 'not set',
      baseUrl: process.env.BASE_URL || 'not set',
      productionUrl: process.env.PRODUCTION_URL || 'not set',
      // Production settings
      prodCookieSecure: process.env.PROD_SESSION_COOKIE_SECURE || 'not set',
      prodCookieSameSite: process.env.PROD_SESSION_COOKIE_SAMESITE || 'not set',
      prodCookieDomain: process.env.PROD_SESSION_COOKIE_DOMAIN || 'not set',
      // Development settings
      devCookieSecure: process.env.DEV_SESSION_COOKIE_SECURE || 'not set',
      devCookieSameSite: process.env.DEV_SESSION_COOKIE_SAMESITE || 'not set',
      devCookieDomain: process.env.DEV_SESSION_COOKIE_DOMAIN || 'not set'
    },
    headers: {
      host: req.headers.host,
      userAgent: req.headers['user-agent'],
      referer: req.headers.referer || 'none',
      cookie: req.headers.cookie ? 'present' : 'not present'
    },
    mongodb: mongoStatus,
    server: {
      time: new Date().toISOString(),
      uptime: Math.floor(process.uptime()) + ' seconds'
    }
  };

  // Add a test cookie to check if cookies are working
  res.cookie('test_cookie', 'working', {
    maxAge: 60000, // 1 minute
    httpOnly: false // Allow JavaScript to read it
  });

  res.render('auth/session-check', {
    sessionInfo: JSON.stringify(sessionInfo, null, 2),
    isProduction,
    mongoStatus
  });
});

// Login page
router.get('/login', isNotLoggedIn, (req, res) => {
  res.render('auth/login');
});

// Login process
router.post('/login', isNotLoggedIn, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      req.flash('error', 'Please provide email and password');
      return res.redirect('/auth/login');
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      req.flash('error', 'Invalid email or password');
      return res.redirect('/auth/login');
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      req.flash('error', 'Invalid email or password');
      return res.redirect('/auth/login');
    }

    // Create session with more user data
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage,
      loginTime: new Date().toISOString()
    };

    // Set a flag to indicate this is a fresh login
    req.session.freshLogin = true;

    // Use simple session save for both development and production
    // Session regeneration can cause issues in some hosting environments
    req.session.save(err => {
      if (err) {
        console.error('Session save error:', err);
        req.flash('error', 'Login failed - could not save session');
        return res.redirect('/auth/login');
      }

      // Log successful login for debugging
      console.log(`User logged in successfully: ${user.email} (${user.role})`);
      console.log('Session ID:', req.session.id);
      console.log('Session cookie settings:', JSON.stringify(req.session.cookie));
      console.log('User in session:', req.session.user ? 'Yes' : 'No');
      console.log('Environment:', process.env.NODE_ENV);

      req.flash('success', 'You are now logged in');
      return res.redirect('/');
    });
  } catch (error) {
    console.error('Login error:', error);
    req.flash('error', 'Login failed');
    res.redirect('/auth/login');
  }
});

// Maintenance mode admin login (API endpoint)
router.post('/maintenance-login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if maintenance mode is enabled
    const settings = await WebsiteSettings.getSettings();
    if (!settings.siteSettings.maintenanceMode) {
      return res.status(400).json({
        success: false,
        message: 'Maintenance mode is not enabled'
      });
    }

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials'
      });
    }

    // Check if user is admin
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required during maintenance mode.'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials'
      });
    }

    // Create session for admin
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage,
      loginTime: new Date().toISOString(),
      maintenanceLogin: true // Flag to indicate this was a maintenance login
    };

    // Save session
    req.session.save(err => {
      if (err) {
        console.error('Maintenance login session save error:', err);
        return res.status(500).json({
          success: false,
          message: 'Login failed - session error'
        });
      }

      console.log(`Admin logged in during maintenance mode: ${user.email}`);

      res.json({
        success: true,
        message: 'Admin login successful',
        redirectUrl: '/admin'
      });
    });

  } catch (error) {
    console.error('Maintenance login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
});

// Register page
router.get('/register', isNotLoggedIn, (req, res) => {
  res.render('auth/register');
});

// Register process - step 1: submit details and send OTP
router.post('/register', isNotLoggedIn, async (req, res) => {
  try {
    const { name, email, password, confirmPassword, role } = req.body;

    // Validate input
    if (!name || !email || !password || !confirmPassword) {
      req.flash('error', 'Please fill in all fields');
      return res.redirect('/auth/register');
    }

    if (password !== confirmPassword) {
      req.flash('error', 'Passwords do not match');
      return res.redirect('/auth/register');
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      req.flash('error', 'Email already registered');
      return res.redirect('/auth/register');
    }

    // Generate OTP and store pending registration in session
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    req.session.registerData = {
      name,
      email,
      password,
      role: role === 'artist' ? 'artist' : 'user'
    };
    req.session.registerOTP = otp;
    req.session.registerOTPExpires = Date.now() + 15 * 60 * 1000; // 15 minutes

    // Send OTP email
    await sendEmail({
      to: email,
      toName: name,
      subject: 'Verify your email for Rapira',
      textContent: `Use this OTP to complete your registration: ${otp}. It expires in 15 minutes.`,
      htmlContent: `<p>Hi ${name || 'there'},</p><p>Your OTP to complete registration is <strong>${otp}</strong>.</p><p>This code expires in 15 minutes.</p>`
    });

    req.flash('success', 'OTP sent to your email. Please verify to complete registration.');
    res.redirect('/auth/register/verify');
  } catch (error) {
    console.error('Registration OTP error:', error);
    req.flash('error', 'Could not send OTP. Please try again.');
    res.redirect('/auth/register');
  }
});

// Register verify page
router.get('/register/verify', isNotLoggedIn, (req, res) => {
  if (!req.session.registerData || !req.session.registerOTP) {
    req.flash('error', 'Please start registration again');
    return res.redirect('/auth/register');
  }
  res.render('auth/register-verify', { email: req.session.registerData.email });
});

// Register verify process
router.post('/register/verify', isNotLoggedIn, async (req, res) => {
  try {
    const { otp } = req.body;

    if (!req.session.registerData || !req.session.registerOTP || !req.session.registerOTPExpires) {
      req.flash('error', 'Please start registration again');
      return res.redirect('/auth/register');
    }

    if (!otp) {
      req.flash('error', 'Please enter the OTP');
      return res.redirect('/auth/register/verify');
    }

    if (Date.now() > req.session.registerOTPExpires) {
      req.flash('error', 'OTP has expired. Please register again.');
      req.session.registerData = null;
      req.session.registerOTP = null;
      req.session.registerOTPExpires = null;
      return res.redirect('/auth/register');
    }

    if (otp.trim() !== req.session.registerOTP) {
      req.flash('error', 'Invalid OTP');
      return res.redirect('/auth/register/verify');
    }

    // Create user using stored data
    const { name, email, password, role } = req.session.registerData;

    // Double-check email still not taken
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      req.flash('error', 'Email already registered');
      req.session.registerData = null;
      req.session.registerOTP = null;
      req.session.registerOTPExpires = null;
      return res.redirect('/auth/register');
    }

    const newUser = new User({ name, email, password, role });
    await newUser.save();

    // Check if there's a deleted account with same email and remove it
    const deletedWithSameEmail = await DeletedAccount.findOneAndDelete({ email });
    if (deletedWithSameEmail) {
      console.log(`Removed deleted account record for email: ${email}`);
    }

    if (role === 'artist') {
      const newArtist = new Artist({
        user: newUser._id,
        stageName: name,
        genre: 'Hip Hop'
      });
      await newArtist.save();
    }

    // Clear session temp data
    req.session.registerData = null;
    req.session.registerOTP = null;
    req.session.registerOTPExpires = null;

    // Send welcome email
    try {
      console.log('Sending welcome email to:', newUser.email);
      const emailResult = await sendWelcomeEmail(newUser);
      if (!emailResult.success) {
        console.error('Failed to send welcome email:', emailResult.error);
      }
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError);
    }

    req.flash('success', 'Registration successful! You can now log in.');
    res.redirect('/auth/login');
  } catch (error) {
    console.error('Registration verify error:', error);
    req.flash('error', 'Registration failed');
    res.redirect('/auth/register');
  }
});

// Logout
router.get('/logout', (req, res) => {
  // Get the user info for logging
  const userEmail = req.session && req.session.user ? req.session.user.email : 'unknown';
  const isProduction = process.env.NODE_ENV === 'production';

  // Log the logout attempt
  console.log(`Logout attempt for user ${userEmail} in ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);

  // Different logout strategies for development and production
  if (!isProduction) {
    // Development: simpler approach
    if (req.session) {
      // Destroy the session
      req.session.destroy((err) => {
        if (err) {
          console.error(`Logout error for user ${userEmail} (development):`, err);
        } else {
          console.log(`User logged out successfully (development): ${userEmail}`);
        }

        // Clear the session cookie
        res.clearCookie('connect.sid');

        // Redirect to login page
        res.redirect('/auth/login');
      });
    } else {
      console.log('No session found during logout (development)');
      res.redirect('/auth/login');
    }
  } else {
    // Production: more thorough approach
    if (req.session) {
      // First clear the user property
      req.session.user = null;

      // Then regenerate the session to ensure complete cleanup
      req.session.regenerate((err) => {
        if (err) {
          console.error(`Logout error for user ${userEmail} (production):`, err);
          return res.redirect('/');
        }

        console.log(`User logged out successfully (production): ${userEmail}`);

        // Clear any cookies
        res.clearCookie('connect.sid');
        if (process.env.PROD_SESSION_COOKIE_DOMAIN) {
          res.clearCookie('connect.sid', {
            domain: process.env.PROD_SESSION_COOKIE_DOMAIN,
            path: '/'
          });
        }

        // Redirect to login page
        res.redirect('/auth/login');
      });
    } else {
      console.log('No session found during logout (production)');
      res.redirect('/auth/login');
    }
  }
});

// Forgot password page
router.get('/forgot-password', isNotLoggedIn, (req, res) => {
  // Check if this is a resend OTP request
  const { email, resend } = req.query;

  if (email && resend === 'true') {
    // Pre-fill the email field if it's a resend request
    return res.render('auth/forgot-password', { prefillEmail: email });
  }

  res.render('auth/forgot-password', { prefillEmail: null });
});

// Forgot password process
router.post('/forgot-password', isNotLoggedIn, async (req, res) => {
  try {
    const { email } = req.body;

    // Validate input
    if (!email) {
      req.flash('error', 'Please provide your email');
      return res.redirect('/auth/forgot-password');
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal that the email doesn't exist
      req.flash('success', 'If your email is registered, you will receive password reset instructions');
      return res.redirect('/auth/login');
    }

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in user record with expiration time (15 minutes)
    user.resetPasswordOTP = otp;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
    await user.save();

    // Send password reset email with OTP
    try {
      const emailResult = await sendPasswordResetEmail(user, otp);

      if (emailResult.success) {
        console.log('Password reset email sent successfully to:', user.email);
        req.flash('success', 'A password reset OTP has been sent to your email address. Please check your inbox and enter it below.');
      } else {
        console.error('Failed to send password reset email:', emailResult.error);
        req.flash('error', 'Failed to send password reset email. Please try again.');
        return res.redirect('/auth/forgot-password');
      }
    } catch (emailError) {
      console.error('Error sending password reset email:', emailError);
      req.flash('error', 'An error occurred while sending the password reset email. Please try again.');
      return res.redirect('/auth/forgot-password');
    }

    // Redirect to reset password page with email parameter
    res.redirect(`/auth/reset-password?email=${encodeURIComponent(email)}`);
  } catch (error) {
    console.error('Forgot password error:', error);
    req.flash('error', 'Something went wrong');
    res.redirect('/auth/forgot-password');
  }
});

// Reset password page
router.get('/reset-password', isNotLoggedIn, (req, res) => {
  const { email } = req.query;

  if (!email) {
    req.flash('error', 'Email is required');
    return res.redirect('/auth/forgot-password');
  }

  res.render('auth/reset-password', { email });
});

// Set new password page
router.get('/set-new-password', isNotLoggedIn, (req, res) => {
  const { email, otp } = req.query;

  if (!email || !otp) {
    req.flash('error', 'Invalid request');
    return res.redirect('/auth/forgot-password');
  }

  // Verify OTP is valid before showing the set password page
  User.findOne({
    email,
    resetPasswordOTP: otp,
    resetPasswordExpires: { $gt: Date.now() }
  }).then(user => {
    if (!user) {
      req.flash('error', 'Invalid or expired OTP');
      return res.redirect(`/auth/reset-password?email=${encodeURIComponent(email)}`);
    }

    res.render('auth/set-new-password', { email, otp });
  }).catch(error => {
    console.error('Error verifying OTP:', error);
    req.flash('error', 'Something went wrong');
    res.redirect('/auth/forgot-password');
  });
});

// Verify OTP process
router.post('/verify-otp', isNotLoggedIn, async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Validate input
    if (!email || !otp) {
      req.flash('error', 'Email and OTP are required');
      return res.redirect(`/auth/reset-password?email=${encodeURIComponent(email)}`);
    }

    // Find user
    const user = await User.findOne({
      email,
      resetPasswordOTP: otp,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      req.flash('error', 'Invalid or expired OTP');
      return res.redirect(`/auth/reset-password?email=${encodeURIComponent(email)}`);
    }

    // If OTP is valid, redirect to set new password page
    res.render('auth/set-new-password', { email, otp });
  } catch (error) {
    console.error('OTP verification error:', error);
    req.flash('error', 'Something went wrong');
    res.redirect('/auth/forgot-password');
  }
});

// Set new password process
router.post('/set-new-password', isNotLoggedIn, async (req, res) => {
  try {
    const { email, otp, password, confirmPassword } = req.body;

    // Validate input
    if (!email || !otp || !password || !confirmPassword) {
      req.flash('error', 'All fields are required');
      return res.render('auth/set-new-password', { email, otp });
    }

    if (password !== confirmPassword) {
      req.flash('error', 'Passwords do not match');
      return res.render('auth/set-new-password', { email, otp });
    }

    // Find user
    const user = await User.findOne({
      email,
      resetPasswordOTP: otp,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      req.flash('error', 'Invalid or expired OTP');
      return res.redirect(`/auth/reset-password?email=${encodeURIComponent(email)}`);
    }

    // Update password
    user.password = password;
    user.resetPasswordOTP = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Automatically log in the user after password reset
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage
    };

    // Save the session before redirecting to ensure it's stored
    req.session.save(err => {
      if (err) {
        console.error('Session save error after password reset:', err);
        req.flash('error', 'Password reset successful, but login failed. Please log in manually.');
        return res.redirect('/auth/login');
      }

      req.flash('success', 'Password has been reset successfully. You are now logged in.');
      res.redirect('/');
    });
  } catch (error) {
    console.error('Reset password error:', error);
    req.flash('error', 'Something went wrong');
    res.redirect('/auth/forgot-password');
  }
});

module.exports = router;