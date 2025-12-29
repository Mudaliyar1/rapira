const express = require('express');
const router = express.Router();
const { isLoggedIn, isAdmin } = require('../middleware/auth');
const User = require('../models/User');
const { sendBulkEmail } = require('../utils/emailService');

// GET /admin/compose-email - Show email composition form
router.get('/', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get user counts for different roles to display in the UI
    const userCount = await User.countDocuments({ role: 'user' });
    const artistCount = await User.countDocuments({ role: 'artist' });
    const adminCount = await User.countDocuments({ role: 'admin' });
    const superAdminCount = await User.countDocuments({ role: 'superAdmin' });
    const totalCount = await User.countDocuments();

    res.render('admin/compose-email', {
      layout: 'admin',
      title: 'Compose Email',
      currentPath: '/admin/compose-email',
      userCount,
      artistCount,
      adminCount,
      superAdminCount,
      totalCount
    });
  } catch (error) {
    console.error('Error loading compose email page:', error);
    req.flash('error', 'Failed to load email composition page');
    res.redirect('/admin');
  }
});

// POST /admin/compose-email - Send email to selected users
router.post('/', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { subject, content, recipients } = req.body;

    // Validate required fields
    if (!subject || !content) {
      req.flash('error', 'Subject and content are required');
      return res.redirect('/admin/compose-email');
    }

    let users = [];

    // Determine which users to send the email to based on the recipients selection
    if (recipients === 'all') {
      // Send to all users
      users = await User.find({}).select('name email');
    } else if (recipients === 'users') {
      // Send to users with role 'user'
      users = await User.find({ role: 'user' }).select('name email');
    } else if (recipients === 'artists') {
      // Send to users with role 'artist'
      users = await User.find({ role: 'artist' }).select('name email');
    } else if (recipients === 'admins') {
      // Send to users with role 'admin' or 'superAdmin'
      users = await User.find({ role: { $in: ['admin', 'superAdmin'] } }).select('name email');
    } else if (recipients === 'custom') {
      // Handle custom selection - get user IDs from the customRecipients field
      const customRecipients = req.body.customRecipients;
      const customEmailRecipients = req.body.customEmailRecipients;
      
      // Check if at least one custom field is provided
      if (!customRecipients && !customEmailRecipients) {
        req.flash('error', 'Please enter either user IDs or email addresses for custom recipients');
        return res.redirect('/admin/compose-email');
      }
      
      // Handle user IDs
      if (customRecipients) {
        // Parse the comma-separated list of user IDs
        const userIds = customRecipients.split(',').map(id => id.trim()).filter(id => id);
        
        if (userIds.length > 0) {
          // Find users by their IDs
          const usersFromIds = await User.find({ _id: { $in: userIds } }).select('name email');
          users = users.concat(usersFromIds);
        }
      }
      
      // Handle direct email addresses
      if (customEmailRecipients) {
        // Parse the comma-separated list of email addresses
        const emailAddresses = customEmailRecipients.split(',').map(email => email.trim()).filter(email => email);
        
        if (emailAddresses.length > 0) {
          // Create user objects for direct email addresses
          const emailUsers = emailAddresses.map(email => {
            // Validate email format
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (emailRegex.test(email)) {
              return {
                email: email,
                name: email.split('@')[0] // Use part before @ as name
              };
            }
            return null;
          }).filter(user => user !== null);
          
          users = users.concat(emailUsers);
        }
      }
      
      // Remove duplicates based on email
      const uniqueUsers = [];
      const seenEmails = new Set();
      
      for (const user of users) {
        if (!seenEmails.has(user.email)) {
          seenEmails.add(user.email);
          uniqueUsers.push(user);
        }
      }
      
      users = uniqueUsers;
      
      // Check if any valid recipients were found
      if (users.length === 0) {
        req.flash('error', 'No valid recipients found. Please check user IDs or email addresses format');
        return res.redirect('/admin/compose-email');
      }
    } else if (recipients === 'single') {
      // Handle single user selection
      const singleUserId = req.body.singleUser;
      const singleUserEmail = req.body.singleUserEmail;
      
      // Validate that only one of the fields is provided
      if (singleUserId && singleUserEmail) {
        req.flash('error', 'Please select either a user from the list OR enter an email address, not both');
        return res.redirect('/admin/compose-email');
      }
      
      // Check if direct email is provided
      if (singleUserEmail) {
        // Validate email format
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (emailRegex.test(singleUserEmail)) {
          users = [{
            email: singleUserEmail,
            name: singleUserEmail.split('@')[0] // Use part before @ as name
          }];
        } else {
          req.flash('error', 'Invalid email address format');
          return res.redirect('/admin/compose-email');
        }
      } else if (singleUserId) {
        // Find a single user by ID
        const user = await User.findById(singleUserId).select('name email');
        if (user) {
          users = [user];
        }
      } else {
        req.flash('error', 'Please select a user or enter an email address');
        return res.redirect('/admin/compose-email');
      }
    } else {
      req.flash('error', 'Please select a valid recipient group');
      return res.redirect('/admin/compose-email');
    }

    if (users.length === 0) {
      req.flash('error', 'No users found to send email to');
      return res.redirect('/admin/compose-email');
    }

    // Prepare HTML content with proper styling
    const htmlContent = `
      <html>
        <body>
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #6366f1; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">${subject}</h1>
            </div>
            <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
              ${content}
            </div>
            <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
              <p>&copy; ${new Date().getFullYear()} Rapira. All rights reserved.</p>
              <p><a href="${process.env.BASE_URL}/terms-of-service" style="color: #6b7280;">Terms of Service</a> | <a href="${process.env.BASE_URL}/privacy-policy" style="color: #6b7280;">Privacy Policy</a></p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send the bulk email
    const result = await sendBulkEmail(users, subject, htmlContent);

    if (result.success) {
      req.flash('success', `Email sent successfully to ${result.recipientCount} users`);
    } else {
      console.error('Failed to send bulk email:', result.error);
      req.flash('error', `Failed to send email: ${result.error}`);
    }

    res.redirect('/admin/compose-email');
  } catch (error) {
    console.error('Error sending email:', error);
    req.flash('error', 'Failed to send email');
    res.redirect('/admin/compose-email');
  }
});

// GET /admin/compose-email/users - Get users for single user selection
router.get('/users', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get all users for single user selection dropdown
    const users = await User.find({}).select('name email _id').sort({ name: 1 });
    
    res.json({ success: true, users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

module.exports = router;