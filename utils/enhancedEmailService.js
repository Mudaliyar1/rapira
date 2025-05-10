const axios = require('axios');
const nodemailer = require('nodemailer');
// Load environment variables from .env file if not already loaded
require('dotenv').config();

// Import IP registration utility
const { checkAndRegisterIP } = require('./ipRegistration');

// Environment detection
const isDevelopment = process.env.NODE_ENV !== 'production';
const isProduction = process.env.NODE_ENV === 'production';

// Brevo API configuration
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_API_URL = 'https://api.sendinblue.com/v3/smtp/email';

// IMPORTANT: This email must be verified in your Brevo account
const SENDER_EMAIL = 'vijaymudaliyar224@gmail.com';
const SENDER_NAME = 'Rapira Music Platform';

// SMTP configuration for fallback
let smtpTransporter = null;

// Check if API key is available
if (!BREVO_API_KEY) {
  console.error('BREVO_API_KEY is not defined in environment variables. Email functionality will not work.');
}

// Log email configuration status on startup (but don't expose sensitive details)
console.log('Brevo API Key:', BREVO_API_KEY ? `${BREVO_API_KEY.substring(0, 5)}...${BREVO_API_KEY.substring(BREVO_API_KEY.length - 3)}` : 'Not found');
console.log('Email sender configured as:', `${SENDER_NAME} <${SENDER_EMAIL}>`);
console.log('Environment:', isDevelopment ? 'Development' : 'Production');

// Print IP authorization instructions
console.log('\n==== IMPORTANT: BREVO EMAIL SETUP ====');
console.log('If you see IP authorization errors, run the IP check tool:');
console.log('  node check-ip.js');
console.log('This will show your current IP and provide instructions for manual authorization.');
console.log('For production deployment, you must manually authorize your server\'s IP addresses at:');
console.log('  https://app.brevo.com/security/authorised_ips');
console.log('For Render deployment: Add all Render outbound IPs listed at:');
console.log('  https://render.com/docs/static-outbound-ip-addresses');
console.log('In development mode, emails will be logged to the console when IP is not authorized');
console.log('====================================\n');

// Check IP authorization on startup
if (BREVO_API_KEY) {
  const { getCurrentIP } = require('./ipRegistration');
  getCurrentIP()
    .then(ipAddresses => {
      console.log(`Detected IP addresses: IPv4=${ipAddresses.ipv4 || 'Not detected'}, IPv6=${ipAddresses.ipv6 || 'Not detected'}`);
      console.log(`To authorize these IPs, run: node check-ip.js`);
    })
    .catch(error => {
      console.error('Error detecting IP addresses:', error.message);
    });
}

// Try to set up SMTP transport for Gmail fallback in development
if (isDevelopment && process.env.GMAIL_USER && process.env.GMAIL_PASS) {
  try {
    smtpTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
      }
    });
    console.log('SMTP fallback configured for development');
  } catch (error) {
    console.error('Failed to configure SMTP fallback:', error.message);
  }
}

// Automatically check and register IP on startup
if (BREVO_API_KEY) {
  checkAndRegisterIP()
    .then(result => {
      if (result.success) {
        console.log(`IP Check Result: ${result.message}`);
      } else {
        console.warn(`IP Check Warning: ${result.message}`);
      }
    })
    .catch(error => {
      console.error('Error during IP registration check:', error.message);
    });
}

// Email templates
const templates = {
  WELCOME_USER: 1,
  CONCERT_SUBMISSION: 2,
  CONCERT_APPROVED: 3,
  CONCERT_REJECTED: 4,
  TICKET_PURCHASE: 5,
  PASSWORD_RESET: 6,
  ARTIST_APPLICATION: 7,
  ARTIST_APPROVAL: 8,
  ARTIST_REJECTION: 9
};

/**
 * Helper function to format currency
 * @param {Number} amount - Amount to format
 * @returns {String} - Formatted currency string
 */
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(amount);
};

/**
 * Helper function to format date
 * @param {Date} date - Date to format
 * @returns {String} - Formatted date string
 */
const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Send an email using Brevo API
 * @param {Object} options - Email options
 * @param {String} options.to - Recipient email
 * @param {String} options.name - Recipient name
 * @param {String} options.subject - Email subject
 * @param {String} options.html - HTML content of the email
 * @param {String} options.text - Plain text content of the email
 * @param {Number} options.templateId - Template ID (optional)
 * @param {Object} options.params - Template parameters (optional)
 * @returns {Promise} - Promise that resolves with the result
 */
const sendEmail = async (options) => {
  const { to, name, templateId, params, subject, html, text } = options;

  // Check if API key is available before attempting to send email
  if (!BREVO_API_KEY) {
    console.error('Cannot send email: BREVO_API_KEY is not defined in environment variables');
    return {
      success: false,
      error: 'Email service configuration error. Please contact the administrator.'
    };
  }

  // Validate required parameters
  if (!to) {
    console.error('Missing recipient email address');
    return { success: false, error: 'Missing recipient email address' };
  }

  if (!templateId && (!subject || !html)) {
    console.error('Missing required email parameters:', { templateId, subject, html });
    return { success: false, error: 'Missing required email parameters. Either templateId or subject+html must be provided.' };
  }

  try {
    let payload;

    if (templateId) {
      // Template email mode
      console.log('Sending template email with parameters:', {
        to,
        name,
        templateId
      });

      payload = {
        sender: {
          name: SENDER_NAME,
          email: SENDER_EMAIL
        },
        to: Array.isArray(to)
            ? to.map(email => ({ email, name: name || email.split('@')[0] }))
            : [{ email: to, name: name || to.split('@')[0] }],
        templateId: parseInt(templateId),
        params: params || {}
      };
    } else {
      // Direct email mode
      console.log('Sending direct email to:', to);

      payload = {
        sender: {
          name: SENDER_NAME,
          email: SENDER_EMAIL
        },
        to: Array.isArray(to)
            ? to.map(email => ({ email, name: name || email.split('@')[0] }))
            : [{ email: to, name: name || to.split('@')[0] }],
        subject: subject,
        htmlContent: html,
        textContent: text || 'Please view this email in a HTML compatible email client'
      };
    }

    // Add replyTo for better deliverability
    payload.replyTo = {
      name: 'Rapira Support',
      email: SENDER_EMAIL
    };

    try {
      // Try to send email via Brevo API
      const response = await axios.post(
        BREVO_API_URL,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'api-key': BREVO_API_KEY
          }
        }
      );

      console.log('Email sent successfully to:', Array.isArray(to) ? to.join(', ') : to);
      console.log('Brevo API response:', response.status, response.statusText);
      console.log('Message ID:', response.data.messageId || 'Not provided');
      return { success: true, data: response.data };
    } catch (apiError) {
      // Check if this is an IP authorization error
      const isIPAuthError = apiError.response &&
                          apiError.response.data &&
                          apiError.response.data.message &&
                          apiError.response.data.message.includes('unrecognised IP address');

      if (isIPAuthError) {
        // Extract IP address from error message
        const ipMatch = apiError.response.data.message.match(/unrecognised IP address ([0-9a-f:.]+)/i);
        const ipAddress = ipMatch ? ipMatch[1] : 'unknown';

        console.error(`\n==== BREVO API IP AUTHORIZATION ERROR ====`);
        console.error(`Your server's IP address (${ipAddress}) is not authorized in Brevo.`);
        console.error(`Run the IP check tool to see your current IPs and authorization status:`);
        console.error(`  node check-ip.js`);

        // Get current IP addresses for better error reporting
        const { getCurrentIP } = require('./ipRegistration');
        const ipAddresses = await getCurrentIP();

        console.error(`\nDetected IP addresses:`);
        console.error(`IPv4: ${ipAddresses.ipv4 || 'Not detected'}`);
        console.error(`IPv6: ${ipAddresses.ipv6 || 'Not detected'}`);
        console.error(`\nYou need to manually authorize these IPs at:`);
        console.error(`https://app.brevo.com/security/authorised_ips`);
        console.error(`====================================\n`);

        // Try SMTP fallback in development mode
        if (isDevelopment && smtpTransporter) {
          try {
            console.log('Attempting to send via SMTP fallback...');

            const mailOptions = {
              from: `"${SENDER_NAME}" <${process.env.GMAIL_USER}>`,
              to: Array.isArray(to)
                  ? to.map(email => `"${name || email.split('@')[0]}" <${email}>`).join(',')
                  : `"${name || to.split('@')[0]}" <${to}>`,
              replyTo: `"Rapira Support" <${SENDER_EMAIL}>`,
              subject: templateId ? `Template ID: ${templateId}` : subject,
              html: html || `<p>Template ID: ${templateId}</p><pre>${JSON.stringify(params, null, 2)}</pre>`,
              text: text || `Template ID: ${templateId}\n${JSON.stringify(params, null, 2)}`
            };

            const info = await smtpTransporter.sendMail(mailOptions);
            console.log('SMTP fallback email sent successfully. Message ID:', info.messageId);
            return {
              success: true,
              data: info,
              method: 'smtp-fallback',
              message: 'Email sent via SMTP fallback due to Brevo IP authorization issue'
            };
          } catch (smtpError) {
            console.error('SMTP fallback failed:', smtpError.message);
            // Continue to development mode logging
          }
        }

        // In development mode, log the email content for debugging
        if (isDevelopment) {
          console.log(`\n==== EMAIL CONTENT (DEVELOPMENT MODE) ====`);
          console.log(`To: ${Array.isArray(to) ? to.join(', ') : to}`);
          console.log(`Subject: ${subject || (templateId ? 'Template ID: ' + templateId : 'No subject')}`);
          console.log('Text Content:');
          console.log(text || 'No text content provided');
          console.log(`====================================\n`);

          // Return success in development mode so the app continues to work
          return {
            success: true,
            fallback: true,
            method: 'development-log',
            message: 'Email content logged in development mode. IP authorization required for actual delivery.',
            error: apiError.response ? apiError.response.data : apiError.message,
            to: to,
            subject: subject || (templateId ? 'Template ID: ' + templateId : 'No subject')
          };
        }

        // In production, return a specific error about IP authorization
        return {
          success: false,
          error: 'IP authorization required',
          message: `Your server's IP address (${ipAddress}) is not authorized in Brevo. Please add this IP to: https://app.brevo.com/security/authorised_ips`,
          ipAddress: ipAddress
        };
      }

      // For other API errors, throw to be caught by the outer catch
      throw apiError;
    }
  } catch (error) {
    // Log the error
    console.error('Error sending email:', error.message);

    // In production, we should not expose sensitive information
    if (isProduction) {
      return {
        success: false,
        error: 'Email service unavailable. Please try again later or contact support.'
      };
    } else {
      // For development/testing, log the email content to console
      console.log('\n==== EMAIL CONTENT (DEVELOPMENT MODE - ERROR) ====');
      console.log(`To: ${Array.isArray(to) ? to.join(', ') : to}`);
      console.log(`Subject: ${subject || (templateId ? 'Template ID: ' + templateId : 'No subject')}`);
      console.log(`Error: ${error.message}`);
      console.log('====================================\n');

      // Return a fallback response for development
      return {
        success: true, // Return success in development so the app continues to work
        fallback: true,
        method: 'development-log',
        error: error.message,
        to: to,
        subject: subject || (templateId ? 'Template ID: ' + templateId : 'No subject')
      };
    }
  }
};

/**
 * Send a welcome email to a new user
 * @param {Object} user - User object
 * @returns {Promise} - Promise that resolves with the result
 */
const sendWelcomeEmail = async (user) => {
  if (!user || !user.email) {
    console.error('Invalid user data for welcome email:', user);
    return { success: false, error: 'Invalid user data' };
  }

  console.log('Sending welcome email to:', user.email);

  const subject = 'Welcome to Rapira - Your Account Has Been Created';
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #333;">Welcome to Rapira!</h1>
      </div>

      <p style="font-size: 16px; line-height: 1.5; color: #333;">Hello ${user.name || 'New User'},</p>

      <p style="font-size: 16px; line-height: 1.5; color: #333;">Thank you for creating an account with Rapira, your ultimate destination for live music events and artist performances.</p>

      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="font-size: 16px; font-weight: bold; color: #333; margin: 0;">Your account has been successfully created!</p>
      </div>

      <p style="font-size: 16px; line-height: 1.5; color: #333;">You can now log in to your account and start exploring upcoming concerts, booking tickets, and more!</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.BASE_URL}/auth/login" style="background-color: #4CAF50; color: white; padding: 12px 25px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Login to Your Account</a>
      </div>

      <p style="font-size: 16px; line-height: 1.5; color: #333;">If you have any questions or need assistance, please don't hesitate to contact our support team.</p>

      <p style="font-size: 16px; line-height: 1.5; color: #333;">Thank you for joining Rapira!</p>

      <p style="font-size: 16px; line-height: 1.5; color: #333;">Best regards,<br>The Rapira Team</p>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #888; font-size: 12px;">
        &copy; ${new Date().getFullYear()} Rapira. All rights reserved.
      </div>
    </div>
  `;

  const textContent = `
    Welcome to Rapira!

    Hello ${user.name || 'New User'},

    Thank you for creating an account with Rapira, your ultimate destination for live music events and artist performances.

    Your account has been successfully created!

    You can now log in to your account and start exploring upcoming concerts, booking tickets, and more!

    Login here: ${process.env.BASE_URL}/auth/login

    If you have any questions or need assistance, please don't hesitate to contact our support team.

    Thank you for joining Rapira!

    Best regards,
    The Rapira Team

    © ${new Date().getFullYear()} Rapira. All rights reserved.
  `;

  try {
    // First try: Use Brevo API directly
    return await sendEmail({
      to: user.email,
      name: user.name,
      subject,
      html: htmlContent,
      text: textContent
    });
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send a password reset email with OTP
 * @param {Object} user - User object
 * @param {String} otp - One-time password
 * @returns {Promise} - Promise that resolves with the result
 */
const sendPasswordResetEmail = async (user, otp) => {
  if (!user || !user.email || !otp) {
    console.error('Invalid data for password reset email:', { user, otp });
    return { success: false, error: 'Invalid password reset data' };
  }

  console.log('Sending password reset email to:', user.email);

  const subject = 'Rapira - Password Reset Request';
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #333;">Password Reset Request</h1>
      </div>

      <p style="font-size: 16px; line-height: 1.5; color: #333;">Hello ${user.name || 'User'},</p>

      <p style="font-size: 16px; line-height: 1.5; color: #333;">We received a request to reset your password for your Rapira account. Please use the following One-Time Password (OTP) to complete the process:</p>

      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center;">
        <p style="font-size: 24px; font-weight: bold; color: #333; margin: 0; letter-spacing: 5px;">${otp}</p>
      </div>

      <p style="font-size: 16px; line-height: 1.5; color: #333;">This OTP will expire in 15 minutes. If you did not request a password reset, please ignore this email or contact our support team if you have concerns.</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.BASE_URL}/auth/reset-password" style="background-color: #4CAF50; color: white; padding: 12px 25px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Reset Your Password</a>
      </div>

      <p style="font-size: 16px; line-height: 1.5; color: #333;">Best regards,<br>The Rapira Team</p>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #888; font-size: 12px;">
        &copy; ${new Date().getFullYear()} Rapira. All rights reserved.
      </div>
    </div>
  `;

  const textContent = `
    Password Reset Request

    Hello ${user.name || 'User'},

    We received a request to reset your password for your Rapira account. Please use the following One-Time Password (OTP) to complete the process:

    ${otp}

    This OTP will expire in 15 minutes. If you did not request a password reset, please ignore this email or contact our support team if you have concerns.

    Reset your password here: ${process.env.BASE_URL}/auth/reset-password

    Best regards,
    The Rapira Team

    © ${new Date().getFullYear()} Rapira. All rights reserved.
  `;

  try {
    return await sendEmail({
      to: user.email,
      name: user.name,
      subject,
      html: htmlContent,
      text: textContent
    });
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send a ticket purchase confirmation email
 * @param {Object} user - User object
 * @param {Object} ticket - Ticket object
 * @param {Object} concert - Concert object
 * @returns {Promise} - Promise that resolves with the result
 */
const sendTicketEmail = async (user, ticket, concert) => {
  if (!user || !user.email || !ticket || !concert) {
    console.error('Invalid data for ticket email:', { user, ticket, concert });
    return { success: false, error: 'Invalid ticket data' };
  }

  console.log('Sending ticket confirmation email to:', user.email);

  const subject = `Your Rapira Concert Tickets - ${concert.title}`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #333;">Your Concert Tickets</h1>
      </div>

      <p style="font-size: 16px; line-height: 1.5; color: #333;">Hello ${user.name || 'Valued Customer'},</p>

      <p style="font-size: 16px; line-height: 1.5; color: #333;">Thank you for your purchase! Your tickets for the following concert have been confirmed:</p>

      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h2 style="color: #333; margin-top: 0;">${concert.title}</h2>
        <p style="font-size: 16px; line-height: 1.5; color: #333; margin: 5px 0;"><strong>Date:</strong> ${formatDate(concert.date)}</p>
        <p style="font-size: 16px; line-height: 1.5; color: #333; margin: 5px 0;"><strong>Time:</strong> ${concert.time}</p>
        <p style="font-size: 16px; line-height: 1.5; color: #333; margin: 5px 0;"><strong>Venue:</strong> ${concert.venue}, ${concert.city}</p>
        <p style="font-size: 16px; line-height: 1.5; color: #333; margin: 5px 0;"><strong>Ticket Number:</strong> ${ticket.ticketNumber || ticket._id.toString()}</p>
        <p style="font-size: 16px; line-height: 1.5; color: #333; margin: 5px 0;"><strong>Quantity:</strong> ${ticket.quantity}</p>
        <p style="font-size: 16px; line-height: 1.5; color: #333; margin: 5px 0;"><strong>Amount:</strong> ${formatCurrency(ticket.totalAmount)}</p>
        <p style="font-size: 16px; line-height: 1.5; color: #333; margin: 5px 0;"><strong>Attendees:</strong> ${ticket.attendees.map(a => `${a.name} (${a.age})`).join(', ')}</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.BASE_URL}/tickets/${ticket._id}" style="background-color: #4CAF50; color: white; padding: 12px 25px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">View Your Tickets</a>
      </div>

      <p style="font-size: 16px; line-height: 1.5; color: #333;">Please bring a printed copy of your tickets or show them on your mobile device at the entrance. We recommend arriving at least 30 minutes before the event starts.</p>

      <p style="font-size: 16px; line-height: 1.5; color: #333;">We hope you enjoy the concert!</p>

      <p style="font-size: 16px; line-height: 1.5; color: #333;">Best regards,<br>The Rapira Team</p>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #888; font-size: 12px;">
        <p>This is an automated email. Please do not reply to this message.</p>
        <p>&copy; ${new Date().getFullYear()} Rapira. All rights reserved.</p>
      </div>
    </div>
  `;

  const textContent = `
    Your Concert Tickets

    Hello ${user.name || 'Valued Customer'},

    Thank you for your purchase! Your tickets for the following concert have been confirmed:

    ${concert.title}
    Date: ${formatDate(concert.date)}
    Time: ${concert.time}
    Venue: ${concert.venue}, ${concert.city}
    Ticket Number: ${ticket.ticketNumber || ticket._id.toString()}
    Quantity: ${ticket.quantity}
    Amount: ${formatCurrency(ticket.totalAmount)}
    Attendees: ${ticket.attendees.map(a => `${a.name} (${a.age})`).join(', ')}

    View your tickets here: ${process.env.BASE_URL}/tickets/${ticket._id}

    Please bring a printed copy of your tickets or show them on your mobile device at the entrance. We recommend arriving at least 30 minutes before the event starts.

    We hope you enjoy the concert!

    Best regards,
    The Rapira Team

    This is an automated email. Please do not reply to this message.
    © ${new Date().getFullYear()} Rapira. All rights reserved.
  `;

  try {
    return await sendEmail({
      to: user.email,
      name: user.name,
      subject,
      html: htmlContent,
      text: textContent
    });
  } catch (error) {
    console.error('Failed to send ticket email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send a test email to verify email functionality
 * @param {String} to - Recipient email
 * @param {String} recipientName - Recipient name
 * @returns {Promise} - Promise that resolves with the result
 */
const sendTestEmail = async (to, recipientName = 'Test User') => {
  if (!to) {
    console.error('Missing recipient email for test email');
    return { success: false, error: 'Missing recipient email' };
  }

  console.log('Sending test email to:', to);

  const subject = 'Rapira Email Test';
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #333;">Rapira Email Test</h1>
      </div>

      <p style="font-size: 16px; line-height: 1.5; color: #333;">Hello ${recipientName},</p>

      <p style="font-size: 16px; line-height: 1.5; color: #333;">This is a test email from the Rapira platform to verify that email functionality is working correctly.</p>

      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="font-size: 16px; font-weight: bold; color: #333; margin: 0;">If you're seeing this email, it means the email system is working!</p>
      </div>

      <p style="font-size: 16px; line-height: 1.5; color: #333;">This email was sent at: ${new Date().toLocaleString()}</p>

      <p style="font-size: 16px; line-height: 1.5; color: #333;">Best regards,<br>The Rapira Team</p>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #888; font-size: 12px;">
        <p>This is a test email. Please ignore.</p>
        <p>&copy; ${new Date().getFullYear()} Rapira. All rights reserved.</p>
      </div>
    </div>
  `;

  const textContent = `
    Rapira Email Test

    Hello ${recipientName},

    This is a test email from the Rapira platform to verify that email functionality is working correctly.

    If you're seeing this email, it means the email system is working!

    This email was sent at: ${new Date().toLocaleString()}

    Best regards,
    The Rapira Team

    This is a test email. Please ignore.
    © ${new Date().getFullYear()} Rapira. All rights reserved.
  `;

  try {
    return await sendEmail({
      to,
      name: recipientName,
      subject,
      html: htmlContent,
      text: textContent
    });
  } catch (error) {
    console.error('Failed to send test email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendTicketEmail,
  sendTestEmail,
  templates
};
