const express = require('express');
const router = express.Router();
const { isLoggedIn, isAdmin, hasAdminPermission } = require('../middleware/auth');
const { sendBulkEmail } = require('../utils/emailService');

// GET /admin/basic-email - Show basic email composition form
router.get('/', isLoggedIn, hasAdminPermission('manage_basic_email'), (req, res) => {
  try {
    res.render('admin/basic-email', {
      layout: 'admin',
      title: 'Basic Email',
      currentPath: '/admin/basic-email'
    });
  } catch (error) {
    console.error('Error loading basic email page:', error);
    req.flash('error', 'Failed to load email composition page');
    res.redirect('/admin');
  }
});

// POST /admin/basic-email - Send email to entered addresses
router.post('/', isLoggedIn, hasAdminPermission('manage_basic_email'), async (req, res) => {
  try {
    const { subject, content, email } = req.body;

    // Validate required fields
    if (!subject || !content) {
      req.flash('error', 'Subject and content are required');
      return res.redirect('/admin/basic-email');
    }

    // Process email addresses
    let emailAddresses = [];

    // If email is a string (single email), convert to array
    if (typeof email === 'string' && email.trim() !== '') {
      emailAddresses = [email];
    }
    // If email is an array (multiple emails), use as is
    else if (Array.isArray(email)) {
      emailAddresses = email.filter(addr => addr && addr.trim() !== '');
    }

    // Validate email format and create user objects
    const validEmails = [];
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    for (const addr of emailAddresses) {
      if (emailRegex.test(addr.trim())) {
        validEmails.push({
          email: addr.trim(),
          name: addr.trim().split('@')[0] // Use part before @ as name
        });
      }
    }

    if (validEmails.length === 0) {
      req.flash('error', 'Please enter at least one valid email address');
      return res.redirect('/admin/basic-email');
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
    const result = await sendBulkEmail(validEmails, subject, htmlContent);

    if (result.success) {
      if (result.failedCount && result.failedCount > 0) {
        req.flash('success', `Email sent privately to ${result.sentCount} recipient(s). Failed for ${result.failedCount} recipient(s).`);
      } else {
        req.flash('success', `Email sent privately to ${result.sentCount || result.recipientCount} recipient(s)`);
      }
    } else {
      console.error('Failed to send bulk email:', result.error);
      req.flash('error', `Failed to send email: ${result.error}`);
    }

    res.redirect('/admin/basic-email');
  } catch (error) {
    console.error('Error sending email:', error);
    req.flash('error', 'Failed to send email');
    res.redirect('/admin/basic-email');
  }
});

module.exports = router;