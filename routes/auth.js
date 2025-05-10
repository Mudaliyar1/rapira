const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Artist = require('../models/Artist');
const { isNotLoggedIn, isLoggedIn } = require('../middleware/auth');
const { sendWelcomeEmail, sendPasswordResetEmail } = require('../utils/brevoEmailService');

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

    // Create session
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
        console.error('Session save error:', err);
        req.flash('error', 'Login failed');
        return res.redirect('/auth/login');
      }

      req.flash('success', 'You are now logged in');
      res.redirect('/');
    });
  } catch (error) {
    console.error('Login error:', error);
    req.flash('error', 'Login failed');
    res.redirect('/auth/login');
  }
});

// Register page
router.get('/register', isNotLoggedIn, (req, res) => {
  res.render('auth/register');
});

// Register process
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

    // Create user
    const userRole = role === 'artist' ? 'artist' : 'user';
    const newUser = new User({
      name,
      email,
      password,
      role: userRole
    });

    await newUser.save();

    // If registering as artist, create artist profile
    if (userRole === 'artist') {
      const newArtist = new Artist({
        user: newUser._id,
        stageName: name, // Default to user name, can be updated later
        genre: 'Hip Hop' // Default genre, can be updated later
      });

      await newArtist.save();
    }

    // Send welcome email
    try {
      console.log('Sending welcome email to:', newUser.email);
      const emailResult = await sendWelcomeEmail(newUser);

      if (emailResult.success) {
        console.log('Welcome email sent successfully to:', newUser.email);
      } else {
        console.error('Failed to send welcome email:', emailResult.error);
      }
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError);
      // Continue with registration even if email fails
    }

    req.flash('success', 'Registration successful! You can now log in. A welcome email has been sent to your email address.');
    res.redirect('/auth/login');
  } catch (error) {
    console.error('Registration error:', error);
    req.flash('error', 'Registration failed');
    res.redirect('/auth/register');
  }
});

// Logout
router.get('/logout', isLoggedIn, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.redirect('/');
    }
    res.redirect('/auth/login');
  });
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
