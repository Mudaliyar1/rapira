const axios = require('axios');

// Get Brevo API key from environment variables
const BREVO_API_KEY = process.env.BREVO_API_KEY;

// Check if API key is available
if (!BREVO_API_KEY) {
  console.error('BREVO_API_KEY is not defined in environment variables. Email functionality will not work.');
}

// Determine if we're in production mode
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Send an email using Brevo API
 * @param {Object} options - Email options
 * @param {String} options.to - Recipient email
 * @param {String} options.toName - Recipient name
 * @param {String} options.subject - Email subject
 * @param {String} options.htmlContent - HTML content of the email
 * @param {String} options.textContent - Plain text content of the email
 * @returns {Promise} - A promise that resolves when the email is sent
 */
const sendEmail = async (options) => {
  // Check if API key is available before attempting to send email
  if (!BREVO_API_KEY) {
    console.error('Cannot send email: BREVO_API_KEY is not defined in environment variables');
    return {
      success: false,
      error: 'Email service configuration error. Please contact the administrator.'
    };
  }

  try {
    // Try to send email via Brevo API
    const response = await axios.post(
      'https://api.sendinblue.com/v3/smtp/email',
      {
        sender: {
          name: 'Rapira Music',
          email: 'vijaymudaliyar224@gmail.com' // Use your verified email as sender
        },
        to: [
          {
            email: options.to,
            name: options.toName || options.to
          }
        ],
        subject: options.subject,
        htmlContent: options.htmlContent,
        textContent: options.textContent || 'Please view this email in a HTML compatible email client'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'api-key': BREVO_API_KEY
        }
      }
    );

    console.log('Email sent successfully to:', options.to);
    console.log('Brevo API response:', JSON.stringify(response.data, null, 2));
    console.log('Message ID:', response.data.messageId || 'Not provided');
    return { success: true, data: response.data };
  } catch (error) {
    // Log the error
    console.error('Error sending email:', error.response ? error.response.data : error.message);

    // Check if this is an IP authorization error
    const isIPAuthError = error.response &&
                         error.response.data &&
                         error.response.data.message &&
                         error.response.data.message.includes('unrecognised IP address');

    if (isIPAuthError) {
      // Extract the IP address from the error message
      const ipMatch = error.response.data.message.match(/unrecognised IP address ([\d.:a-f]+)/);
      const ipAddress = ipMatch ? ipMatch[1] : 'unknown';

      console.error(`\n==== BREVO API IP AUTHORIZATION ERROR ====`);
      console.error(`Your server's IP address (${ipAddress}) is not authorized in Brevo.`);
      console.error(`Please add this IP to: https://app.brevo.com/security/authorised_ips`);
      console.error(`====================================\n`);
    }

    // In production, we should not expose sensitive information
    if (isProduction) {
      // In production, if we can't send the email, this is a critical error
      if (isIPAuthError) {
        console.error('CRITICAL: Email sending failed due to IP authorization. Check server logs.');
      }

      return {
        success: false,
        fallback: false,
        error: 'Email service unavailable. Please try again later or contact support.'
      };
    } else {
      // For development/testing, log the email content to console
      console.log('\n==== EMAIL CONTENT (DEVELOPMENT MODE) ====');
      console.log(`To: ${options.to}`);
      console.log(`Subject: ${options.subject}`);
      console.log('Text Content:');
      console.log(options.textContent);
      console.log('====================================\n');

      // Return a fallback response for development
      return {
        success: false,
        fallback: true,
        error: error.response ? error.response.data : error.message,
        to: options.to,
        subject: options.subject,
        textContent: options.textContent
      };
    }
  }
};

/**
 * Send welcome email to a new user
 * @param {Object} user - User object
 * @returns {Promise} - A promise that resolves when the email is sent
 */
const sendWelcomeEmail = async (user) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          border: 1px solid #ddd;
          border-radius: 5px;
        }
        .header {
          background-color: #6366f1;
          color: white;
          padding: 20px;
          text-align: center;
          border-radius: 5px 5px 0 0;
        }
        .content {
          padding: 20px;
        }
        .footer {
          text-align: center;
          margin-top: 20px;
          font-size: 12px;
          color: #666;
        }
        .highlight {
          font-weight: bold;
          color: #6366f1;
        }
        .button {
          display: inline-block;
          padding: 10px 20px;
          background-color: #6366f1;
          color: white;
          text-decoration: none;
          border-radius: 5px;
          margin-top: 15px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Rapira!</h1>
        </div>
        <div class="content">
          <h2>Account Created Successfully</h2>
          <p>Hello ${user.name || 'New User'},</p>
          <p>Thank you for creating an account with Rapira, your ultimate destination for live music events and artist performances.</p>
          <p>Your account has been successfully created with the following details:</p>
          <ul>
            <li><strong>Email:</strong> ${user.email}</li>
            <li><strong>Role:</strong> ${user.role || 'User'}</li>
          </ul>
          <p>You can now log in to your account and start exploring upcoming concerts, booking tickets, and more!</p>
          <a href="${process.env.BASE_URL}/auth/login" class="button">Login to Your Account</a>
          <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
          <p>Thank you for joining Rapira!</p>
          <p>Best regards,<br>The Rapira Team</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Rapira. All rights reserved.</p>
          <p><a href="${process.env.BASE_URL}/terms-of-service" style="color: #6b7280;">Terms of Service</a> | <a href="${process.env.BASE_URL}/privacy-policy" style="color: #6b7280;">Privacy Policy</a></p>
        </div>
      </div>
    </body>
    </html>
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

  return sendEmail({
    to: user.email,
    toName: user.name,
    subject: 'Welcome to Rapira - Your Account Has Been Created',
    htmlContent,
    textContent
  });
};

/**
 * Send password reset OTP email
 * @param {Object} user - User object
 * @param {String} otp - One-time password
 * @returns {Promise} - A promise that resolves when the email is sent
 */
const sendPasswordResetEmail = async (user, otp) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          border: 1px solid #ddd;
          border-radius: 5px;
        }
        .header {
          background-color: #6366f1;
          color: white;
          padding: 20px;
          text-align: center;
          border-radius: 5px 5px 0 0;
        }
        .content {
          padding: 20px;
        }
        .otp {
          font-size: 24px;
          font-weight: bold;
          text-align: center;
          margin: 20px 0;
          padding: 10px;
          background-color: #f8f9fa;
          border-radius: 5px;
          letter-spacing: 5px;
        }
        .footer {
          text-align: center;
          margin-top: 20px;
          font-size: 12px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Rapira Music</h1>
        </div>
        <div class="content">
          <h2>Password Reset Request</h2>
          <p>Hello ${user.name || 'User'},</p>
          <p>We received a request to reset your password. Please use the following One-Time Password (OTP) to reset your password:</p>
          <div class="otp">${otp}</div>
          <p>This OTP will expire in 15 minutes.</p>
          <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
          <p>Thank you,<br>Rapira Team</p>
        </div>
        <div class="footer">
          <p>This is an automated email. Please do not reply to this message.</p>
          <p>&copy; ${new Date().getFullYear()} Rapira. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    Rapira Music - Password Reset Request

    Hello ${user.name || 'User'},

    We received a request to reset your password. Please use the following One-Time Password (OTP) to reset your password:

    ${otp}

    This OTP will expire in 15 minutes.

    If you did not request a password reset, please ignore this email or contact support if you have concerns.

    Thank you,
    Rapira Team

    This is an automated email. Please do not reply to this message.
    © ${new Date().getFullYear()} Rapira. All rights reserved.
  `;

  return sendEmail({
    to: user.email,
    toName: user.name,
    subject: 'Rapira - Password Reset OTP',
    htmlContent,
    textContent
  });
};

/**
 * Send ticket purchase confirmation email
 * @param {Object} user - User object
 * @param {Object} ticket - Ticket object
 * @param {Object} concert - Concert object
 * @returns {Promise} - A promise that resolves when the email is sent
 */
const sendTicketEmail = async (user, ticket, concert) => {
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

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          border: 1px solid #ddd;
          border-radius: 5px;
        }
        .header {
          background-color: #6366f1;
          color: white;
          padding: 20px;
          text-align: center;
          border-radius: 5px 5px 0 0;
        }
        .content {
          padding: 20px;
        }
        .ticket-details {
          background-color: #f8f9fa;
          border-radius: 8px;
          padding: 15px;
          margin: 20px 0;
        }
        .footer {
          text-align: center;
          margin-top: 20px;
          font-size: 12px;
          color: #666;
        }
        .button {
          display: inline-block;
          padding: 10px 20px;
          background-color: #6366f1;
          color: white;
          text-decoration: none;
          border-radius: 5px;
          margin-top: 15px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Your Tickets are Confirmed!</h1>
        </div>
        <div class="content">
          <p>Hello ${user.name || 'Valued Customer'},</p>
          <p>Thank you for booking tickets to <strong>${concert.title}</strong>. Your booking has been confirmed!</p>

          <div class="ticket-details">
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

          <a href="${process.env.BASE_URL}/tickets/${ticket._id}" class="button">View Ticket Details</a>

          <p>Please arrive at least 30 minutes before the event starts. You may be asked to show this ticket confirmation along with a valid ID.</p>
          <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
          <p>We hope you enjoy the concert!</p>
          <p>Best regards,<br>The Rapira Team</p>
        </div>
        <div class="footer">
          <p>This is an automated email. Please do not reply to this message.</p>
          <p>&copy; ${new Date().getFullYear()} Rapira. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    Your Tickets are Confirmed!

    Hello ${user.name || 'Valued Customer'},

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

    We hope you enjoy the concert!

    Best regards,
    The Rapira Team

    This is an automated email. Please do not reply to this message.
    © ${new Date().getFullYear()} Rapira. All rights reserved.
  `;

  return sendEmail({
    to: user.email,
    toName: user.name,
    subject: `Your Rapira Concert Tickets - ${concert.title}`,
    htmlContent,
    textContent
  });
};

/**
 * Send an artist booking request notification email to admin
 * @param {Object} request - The booking request object
 * @returns {Promise} - A promise that resolves when the email is sent
 */
const sendArtistBookingRequestEmail = async (request) => {
  try {
    // Get all admin users
    const User = require('../models/User');
    const adminUsers = await User.find({ role: 'admin' });

    if (!adminUsers || adminUsers.length === 0) {
      console.error('No admin users found to send notification');
      return { success: false, error: 'No admin users found' };
    }

    // Get the artist or role details
    let bookingName = '';
    let bookingLocation = '';

    if (request.bookingType === 'artist') {
      const Artist = require('../models/Artist');
      const artist = await Artist.findById(request.artist).populate('user', 'name');

      if (artist) {
        bookingName = artist.stageName || artist.user.name;
        bookingLocation = artist.city && artist.state ? `${artist.city}, ${artist.state}` : 'N/A';
      } else {
        bookingName = 'Unknown Artist';
        bookingLocation = 'N/A';
      }
    } else {
      const ArtistRoleSlot = require('../models/ArtistRoleSlot');
      const roleSlot = await ArtistRoleSlot.findById(request.roleSlot);

      if (roleSlot) {
        bookingName = roleSlot.name;
        bookingLocation = `${roleSlot.city}, ${roleSlot.state}`;
      } else {
        bookingName = 'Unknown Role';
        bookingLocation = 'N/A';
      }
    }

    // Format the event date
    const eventDate = new Date(request.eventDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Create HTML content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4a148c; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #777; }
          .button { display: inline-block; background-color: #4a148c; color: white; text-decoration: none; padding: 10px 20px; border-radius: 5px; }
          .details { margin: 20px 0; }
          .details table { width: 100%; border-collapse: collapse; }
          .details table td { padding: 8px; border-bottom: 1px solid #ddd; }
          .details table td:first-child { font-weight: bold; width: 40%; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>New Artist Booking Request</h2>
          </div>
          <div class="content">
            <p>A new booking request has been submitted through the Find My Artist page.</p>

            <div class="details">
              <h3>Booking Details:</h3>
              <table>
                <tr>
                  <td>Booking Type:</td>
                  <td>${request.bookingType === 'artist' ? 'Artist' : 'Role'}</td>
                </tr>
                <tr>
                  <td>Name:</td>
                  <td>${bookingName}</td>
                </tr>
                <tr>
                  <td>Location:</td>
                  <td>${bookingLocation}</td>
                </tr>
              </table>

              <h3>Requester Information:</h3>
              <table>
                <tr>
                  <td>Name:</td>
                  <td>${request.name}</td>
                </tr>
                <tr>
                  <td>Email:</td>
                  <td>${request.email}</td>
                </tr>
                <tr>
                  <td>Phone:</td>
                  <td>${request.phone}</td>
                </tr>
                <tr>
                  <td>Event Location:</td>
                  <td>${request.eventCity}, ${request.eventState}</td>
                </tr>
                <tr>
                  <td>Event Date:</td>
                  <td>${eventDate}</td>
                </tr>
                <tr>
                  <td>Notes:</td>
                  <td>${request.notes || 'No additional notes provided'}</td>
                </tr>
              </table>
            </div>

            <p>Please review this request in the admin dashboard:</p>
            <p style="text-align: center;">
              <a href="${process.env.BASE_URL || 'http://localhost:3000'}/admin/find-my-artist/booking-requests/${request._id}" class="button">View Request</a>
            </p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Rapira Music Platform. All rights reserved.</p>
            <p>This is an automated email. Please do not reply to this message.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const subject = `New ${request.bookingType === 'artist' ? 'Artist' : 'Role'} Booking Request: ${bookingName}`;

    // Create recipients array for all admin users
    const recipients = adminUsers.map(admin => ({
      email: admin.email,
      name: admin.name || 'Rapira Admin'
    }));

    // Create a direct email payload
    const directEmailPayload = {
      sender: {
        name: 'Rapira Music',
        email: 'vijaymudaliyar224@gmail.com'
      },
      to: recipients,
      subject: subject,
      htmlContent: htmlContent,
      textContent: `New ${request.bookingType === 'artist' ? 'artist' : 'role'} booking request from ${request.name} for ${bookingName}. Event Date: ${eventDate}, Location: ${request.eventCity}, ${request.eventState}. Contact: ${request.email}, ${request.phone}. Notes: ${request.notes || 'None'}`
    };

    // Log the email being sent
    console.log('Sending artist booking request notification to all admins:', recipients.map(r => r.email).join(', '));

    // Send direct email
    const response = await axios.post(
      'https://api.sendinblue.com/v3/smtp/email',
      directEmailPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'api-key': BREVO_API_KEY
        }
      }
    );

    console.log('Artist booking request email sent successfully. Response:', response.status, response.statusText);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error sending artist booking request email:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendTicketEmail,
  sendArtistBookingRequestEmail
};
