const express = require('express');
const router = express.Router();
const axios = require('axios');
const { isLoggedIn, isAdmin } = require('../middleware/auth');
const {
  sendTestEmail,
  sendWelcomeEmail,
  sendConcertSubmissionEmail,
  sendConcertApprovalEmail,
  sendConcertRejectionEmail,
  sendTicketPurchaseEmail
} = require('../utils/emailService');

// Get Brevo API key from environment variables
const BREVO_API_KEY = process.env.BREVO_API_KEY;

// Email status dashboard - admin only
router.get('/', isLoggedIn, isAdmin, async (req, res) => {
  res.render('admin/email-status', {
    layout: 'admin',
    currentPath: '/email-status',
    title: 'Email System Status'
  });
});

// Direct test email (for debugging)
router.post('/direct-test', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      req.flash('error', 'Email address is required');
      return res.redirect('/email-status');
    }

    // Create a simple HTML email
    const htmlContent = `
      <html>
        <body>
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #6366f1; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">Rapira Email Test</h1>
            </div>
            <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
              <p>Hello,</p>
              <p>This is a direct test email from Rapira to verify that the email system is working correctly.</p>
              <p>If you're seeing this, it means the direct email test was successful!</p>
              <p>Timestamp: ${new Date().toISOString()}</p>
              <p>Best regards,<br>The Rapira Team</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send using direct API call
    const axios = require('axios');
    const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

    console.log('Sending direct test email to:', email);

    const response = await axios.post(BREVO_API_URL, {
      sender: {
        name: 'Rapira Music Platform',
        email: 'vijaymudaliyar224@gmail.com'
      },
      to: [{
        email: email,
        name: 'Test User'
      }],
      subject: 'Rapira Direct Email Test',
      htmlContent: htmlContent
    }, {
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      }
    });

    console.log('Direct test email sent successfully. Response:', response.status, response.statusText);
    req.flash('success', `Direct test email sent successfully to ${email}. Please check your inbox.`);

  } catch (error) {
    console.error('Direct test email error:', error);

    let errorMessage = 'Failed to send direct test email';

    if (error.response && error.response.data) {
      errorMessage += `: ${error.response.data.message || error.message}`;
      console.error('Error response data:', error.response.data);
    }

    req.flash('error', errorMessage);
  }

  res.redirect('/email-status');
});

// Test all email types
router.post('/test-all', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      req.flash('error', 'Email address is required');
      return res.redirect('/email-status');
    }

    const results = {};
    const mockUser = { email, name: 'Test User', role: 'user' };
    const mockArtist = { email, name: 'Test Artist' };
    const mockConcert = {
      _id: '123456789012345678901234',
      title: 'Test Concert',
      date: new Date(),
      time: '19:00',
      venue: 'Test Venue',
      city: 'Test City',
      description: 'This is a test concert'
    };
    const mockTicket = {
      _id: '123456789012345678901234',
      ticketNumber: 'TICKET-123456',
      quantity: 2,
      totalAmount: 1000,
      attendees: [
        { name: 'Attendee 1', age: 25 },
        { name: 'Attendee 2', age: 30 }
      ]
    };

    // Test welcome email
    try {
      console.log('Testing welcome email to:', email);
      const welcomeResult = await sendWelcomeEmail(mockUser);
      results.welcome = {
        success: welcomeResult.success,
        messageId: welcomeResult.data?.messageId || null,
        error: welcomeResult.error || null
      };
    } catch (error) {
      results.welcome = { success: false, error: error.message };
    }

    // Test concert submission email
    try {
      console.log('Testing concert submission email to:', email);
      const submissionResult = await sendConcertSubmissionEmail(mockArtist, mockConcert);
      results.submission = {
        success: submissionResult.success,
        messageId: submissionResult.data?.messageId || null,
        error: submissionResult.error || null
      };
    } catch (error) {
      results.submission = { success: false, error: error.message };
    }

    // Test concert approval email
    try {
      console.log('Testing concert approval email to:', email);
      const approvalResult = await sendConcertApprovalEmail(mockArtist, mockConcert);
      results.approval = {
        success: approvalResult.success,
        messageId: approvalResult.data?.messageId || null,
        error: approvalResult.error || null
      };
    } catch (error) {
      results.approval = { success: false, error: error.message };
    }

    // Test concert rejection email
    try {
      console.log('Testing concert rejection email to:', email);
      const rejectionResult = await sendConcertRejectionEmail(mockArtist, mockConcert, 'This is a test rejection reason');
      results.rejection = {
        success: rejectionResult.success,
        messageId: rejectionResult.data?.messageId || null,
        error: rejectionResult.error || null
      };
    } catch (error) {
      results.rejection = { success: false, error: error.message };
    }

    // Test ticket purchase email
    try {
      console.log('Testing ticket purchase email to:', email);
      const ticketResult = await sendTicketPurchaseEmail(mockUser, mockTicket, mockConcert);
      results.ticket = {
        success: ticketResult.success,
        messageId: ticketResult.data?.messageId || null,
        error: ticketResult.error || null
      };
    } catch (error) {
      results.ticket = { success: false, error: error.message };
    }

    // Test general email
    try {
      console.log('Testing general email to:', email);
      const generalResult = await sendTestEmail(email);
      results.general = {
        success: generalResult.success,
        messageId: generalResult.data?.messageId || null,
        error: generalResult.error || null
      };
    } catch (error) {
      results.general = { success: false, error: error.message };
    }

    // Calculate overall success rate
    const totalTests = Object.keys(results).length;
    const successfulTests = Object.values(results).filter(r => r.success).length;
    const successRate = Math.round((successfulTests / totalTests) * 100);

    // Store results in session for display
    req.session.emailTestResults = {
      email,
      results,
      successRate,
      timestamp: new Date().toISOString()
    };

    req.flash('success', `Email tests completed with ${successRate}% success rate. Check your inbox at ${email}`);
    res.redirect('/email-status');

  } catch (error) {
    console.error('Email test error:', error);
    req.flash('error', `Failed to run email tests: ${error.message}`);
    res.redirect('/email-status');
  }
});

// Check Brevo API status
router.get('/api-status', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const axios = require('axios');
    const BREVO_API_KEY = process.env.BREVO_API_KEY;

    // Check if API key is configured
    if (!BREVO_API_KEY) {
      return res.json({
        success: false,
        message: 'Brevo API key is not configured'
      });
    }

    // Check API status by making a simple request
    const response = await axios.get('https://api.brevo.com/v3/account', {
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY
      }
    });

    return res.json({
      success: true,
      message: 'Brevo API is working correctly',
      data: {
        plan: response.data.plan,
        credits: response.data.credits,
        firstAndLastName: response.data.firstName + ' ' + response.data.lastName,
        email: response.data.email
      }
    });

  } catch (error) {
    console.error('Brevo API status check error:', error);

    let errorMessage = 'Failed to check Brevo API status';
    let errorDetails = {};

    if (error.response) {
      errorMessage = `Brevo API error: ${error.response.status} ${error.response.statusText}`;
      errorDetails = error.response.data;
    }

    return res.status(500).json({
      success: false,
      message: errorMessage,
      error: errorDetails
    });
  }
});

// Check if IP is authorized in Brevo
router.get('/check-ip-auth', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get client IP address
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (!clientIp) {
      return res.json({
        success: false,
        message: 'Could not determine client IP address'
      });
    }

    // Check if API key is configured
    if (!BREVO_API_KEY) {
      return res.json({
        success: false,
        message: 'Brevo API key is not configured'
      });
    }

    // Make a test request to Brevo API
    try {
      await axios.get('https://api.brevo.com/v3/account', {
        headers: {
          'accept': 'application/json',
          'api-key': BREVO_API_KEY
        }
      });

      // If we get here, the IP is authorized
      return res.json({
        success: true,
        authorized: true,
        ip: clientIp
      });
    } catch (error) {
      // Check if this is an IP authorization error
      const isIPAuthError = error.response &&
                          error.response.data &&
                          error.response.data.message &&
                          error.response.data.message.includes('unrecognised IP address');

      if (isIPAuthError) {
        return res.json({
          success: true,
          authorized: false,
          ip: clientIp,
          message: error.response.data.message
        });
      } else {
        // Some other error
        return res.json({
          success: false,
          message: 'Error checking IP authorization',
          error: error.response ? error.response.data : error.message
        });
      }
    }
  } catch (error) {
    console.error('IP authorization check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check IP authorization',
      error: error.message
    });
  }
});

module.exports = router;
