require('dotenv').config();
const axios = require('axios');

// Brevo API configuration
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * Send a direct email using Brevo API
 * @param {Object} options - Email options
 * @param {String} options.to - Recipient email
 * @param {String} options.name - Recipient name
 * @param {String} options.subject - Email subject
 * @param {String} options.html - HTML content
 * @param {String} options.text - Plain text content
 */
const sendEmail = async (options) => {
  try {
    const { to, name, subject, html, text } = options;

    // Validate required parameters
    if (!to || !subject || !html) {
      console.error('Missing required email parameters:', { to, subject });
      return { success: false, error: 'Missing required email parameters' };
    }

    console.log('Sending email to:', to);

    // Prepare the request payload
    const payload = {
      sender: {
        name: 'Rapira Music',
        email: 'vijaymudaliyar224@gmail.com'
      },
      to: [{
        email: to,
        name: name || to.split('@')[0]
      }],
      subject: subject,
      htmlContent: html,
      textContent: text || ''
    };

    console.log('Sending email with payload:', JSON.stringify(payload).substring(0, 200) + '...');

    // Make the API request
    const response = await axios.post(BREVO_API_URL, payload, {
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      }
    });

    console.log('Email sent successfully. Response:', response.status, response.statusText);
    console.log('Response data:', response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error sending email:', error.message);

    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', error.response.data);
    } else if (error.request) {
      console.error('Error request:', error.request);
    } else {
      console.error('Error message:', error.message);
    }

    return { success: false, error: error.message };
  }
};

/**
 * Send a welcome email to a new user
 * @param {Object} user - User object
 */
const sendWelcomeEmail = async (user) => {
  try {
    if (!user || !user.email) {
      console.error('Invalid user data for welcome email:', user);
      return { success: false, error: 'Invalid user data' };
    }

    console.log('Sending welcome email to:', user.email);

    // Create HTML content for the welcome email
    const welcomeHtml = `
      <html>
        <body>
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #6366f1; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">Welcome to Rapira!</h1>
            </div>
            <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
              <p>Hello ${user.name || 'New User'},</p>
              <p>Thank you for creating an account with Rapira, your ultimate destination for live music events and artist performances.</p>
              <p>Your account has been successfully created with the following details:</p>
              <ul>
                <li><strong>Email:</strong> ${user.email}</li>
                <li><strong>Role:</strong> ${user.role || 'User'}</li>
              </ul>
              <p>You can now log in to your account and start exploring upcoming concerts, booking tickets, and more!</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.BASE_URL}/auth/login" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Login to Your Account</a>
              </div>
              <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
              <p>Thank you for joining Rapira!</p>
              <p>Best regards,<br>The Rapira Team</p>
            </div>
            <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
              <p>&copy; ${new Date().getFullYear()} Rapira. All rights reserved.</p>
              <p><a href="${process.env.BASE_URL}/terms-of-service" style="color: #6b7280;">Terms of Service</a> | <a href="${process.env.BASE_URL}/privacy-policy" style="color: #6b7280;">Privacy Policy</a></p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Create plain text content for the welcome email
    const welcomeText = `Hello ${user.name},

Thank you for creating an account with Rapira, your ultimate destination for live music events and artist performances.

Your account has been successfully created!

You can now log in to your account and start exploring upcoming concerts, booking tickets, and more!

Login here: ${process.env.BASE_URL}/auth/login

Best regards,
The Rapira Team`;

    return await sendEmail({
      to: user.email,
      name: user.name,
      subject: 'Welcome to Rapira - Your Account Has Been Created',
      html: welcomeHtml,
      text: welcomeText
    });
  } catch (error) {
    console.error('Error in sendWelcomeEmail:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send a ticket purchase confirmation email
 * @param {Object} user - User object
 * @param {Object} ticket - Ticket object
 * @param {Object} concert - Concert object
 */
const sendTicketEmail = async (user, ticket, concert) => {
  try {
    if (!user || !user.email || !ticket || !concert) {
      console.error('Invalid data for ticket email:', { user, ticket, concert });
      return { success: false, error: 'Invalid ticket data' };
    }

    console.log('Sending ticket email to:', user.email);

    // Format date
    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    // Format attendees list for HTML
    const attendeesList = ticket.attendees.map(a => `<li>${a.name} (${a.age})</li>`).join('');
    const ticketType = ticket.totalAmount === 0 ? 'Free' : 'Paid';
    const formattedAmount = ticket.totalAmount === 0 ? 'Free' : `₹${ticket.totalAmount}`;

    // Create HTML content for the ticket email
    const ticketHtml = `
      <html>
        <body>
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #6366f1; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">Your Tickets are Confirmed!</h1>
            </div>
            <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
              <p>Hello ${user.name || 'Valued Customer'},</p>
              <p>Thank you for booking tickets to <strong>${concert.title}</strong>. Your booking has been confirmed!</p>

              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Ticket Details:</h3>
                <p><strong>Ticket Number:</strong> ${ticket.ticketNumber || ticket._id.toString()}</p>
                <p><strong>Concert:</strong> ${concert.title}</p>
                <p><strong>Date:</strong> ${formatDate(concert.date)}</p>
                <p><strong>Time:</strong> ${concert.time}</p>
                <p><strong>Venue:</strong> ${concert.venue}, ${concert.city}</p>
                <p><strong>Ticket Type:</strong> ${ticketType}</p>
                <p><strong>Number of Tickets:</strong> ${ticket.quantity}</p>
                <p><strong>Total Amount:</strong> ${formattedAmount}</p>

                <h4>Attendees:</h4>
                <ul>
                  ${attendeesList}
                </ul>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.BASE_URL}/tickets/${ticket._id}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">View Ticket Details</a>
              </div>

              <p>Please arrive at least 30 minutes before the event starts. You may be asked to show this ticket confirmation along with a valid ID.</p>
              <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
              <p>We hope you enjoy the concert!</p>
              <p>Best regards,<br>The Rapira Team</p>
            </div>
            <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
              <p>&copy; ${new Date().getFullYear()} Rapira. All rights reserved.</p>
              <p><a href="${process.env.BASE_URL}/terms-of-service" style="color: #6b7280;">Terms of Service</a> | <a href="${process.env.BASE_URL}/privacy-policy" style="color: #6b7280;">Privacy Policy</a></p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Create plain text content for the ticket email
    const ticketText = `Hello ${user.name},

Thank you for booking tickets to ${concert.title}. Your booking has been confirmed!

Ticket Details:
Ticket Number: ${ticket.ticketNumber || ticket._id.toString()}
Concert: ${concert.title}
Date: ${formatDate(concert.date)}
Time: ${concert.time}
Venue: ${concert.venue}, ${concert.city}
Ticket Type: ${ticketType}
Number of Tickets: ${ticket.quantity}
Total Amount: ${formattedAmount}

Attendees: ${ticket.attendees.map(a => `${a.name} (${a.age})`).join(', ')}

Please arrive at least 30 minutes before the event starts. You may be asked to show this ticket confirmation along with a valid ID.

View your ticket here: ${process.env.BASE_URL}/tickets/${ticket._id}

Best regards,
The Rapira Team`;

    return await sendEmail({
      to: user.email,
      name: user.name,
      subject: `Your Rapira Concert Tickets - ${concert.title}`,
      html: ticketHtml,
      text: ticketText
    });
  } catch (error) {
    console.error('Error in sendTicketEmail:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send a password reset email with OTP
 * @param {Object} user - User object
 * @param {String} otp - One-time password
 */
const sendPasswordResetEmail = async (user, otp) => {
  try {
    if (!user || !user.email || !otp) {
      console.error('Invalid data for password reset email:', { user, otp });
      return { success: false, error: 'Invalid password reset data' };
    }

    console.log('Sending password reset email to:', user.email);

    // Create HTML content for the password reset email
    const resetHtml = `
      <html>
        <body>
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #6366f1; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">Rapira Music</h1>
            </div>
            <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
              <h2 style="text-align: center;">Password Reset Request</h2>
              <p>Hello ${user.name},</p>
              <p>We received a request to reset your password. Please use the following One-Time Password (OTP) to reset your password:</p>

              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center;">
                <h2 style="font-size: 24px; letter-spacing: 5px;">${otp}</h2>
              </div>

              <p>This OTP will expire in 15 minutes.</p>
              <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
              <p>Thank you,<br>The Rapira Team</p>
            </div>
            <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
              <p>&copy; ${new Date().getFullYear()} Rapira. All rights reserved.</p>
              <p><a href="${process.env.BASE_URL}/terms-of-service" style="color: #6b7280;">Terms of Service</a> | <a href="${process.env.BASE_URL}/privacy-policy" style="color: #6b7280;">Privacy Policy</a></p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Create plain text content for the password reset email
    const resetText = `Hello ${user.name},

We received a request to reset your password. Please use the following One-Time Password (OTP) to reset your password:

${otp}

This OTP will expire in 15 minutes.

If you did not request a password reset, please ignore this email or contact support if you have concerns.

Thank you,
The Rapira Team`;

    return await sendEmail({
      to: user.email,
      name: user.name,
      subject: 'Rapira - Password Reset OTP',
      html: resetHtml,
      text: resetText
    });
  } catch (error) {
    console.error('Error in sendPasswordResetEmail:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendTicketEmail,
  sendPasswordResetEmail
};
