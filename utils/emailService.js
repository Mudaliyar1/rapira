const axios = require('axios');
const nodemailer = require('nodemailer');

// Brevo API configuration
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

// IMPORTANT: This email must be verified in your Brevo account
const SENDER_EMAIL = 'vijaymudaliyar224@gmail.com';
const SENDER_NAME = 'Rapira Music Platform';

// SMTP configuration for fallback
const SMTP_HOST = process.env.SMTP_HOST || 'smtp-relay.brevo.com';
const SMTP_PORT = process.env.SMTP_PORT || 587;
const SMTP_USER = process.env.SMTP_USER || SENDER_EMAIL;
const SMTP_PASS = process.env.SMTP_PASS || BREVO_API_KEY;

// Create a nodemailer transporter for fallback
let transporter;

// Gmail requires special configuration
if (SMTP_HOST === 'smtp.gmail.com') {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS // This should be an App Password if 2FA is enabled
    }
  });
  console.log('Using Gmail SMTP configuration');
} else {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // true for 465, false for other ports
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
  console.log(`Using custom SMTP configuration: ${SMTP_HOST}:${SMTP_PORT}`);
}

// Log email configuration status on startup (but don't expose sensitive details)
console.log('Brevo API Key:', BREVO_API_KEY ? `${BREVO_API_KEY.substring(0, 5)}...${BREVO_API_KEY.substring(BREVO_API_KEY.length - 3)}` : 'Not found');
console.log('Email sender configured as:', `${SENDER_NAME} <${SENDER_EMAIL}>`);
console.log('SMTP fallback configured:', SMTP_HOST ? 'Yes' : 'No');

// IMPORTANT PRODUCTION NOTES:
// 1. If you see a 401 error with message about unrecognized IP address, you MUST authorize your IP at:
//    https://app.brevo.com/security/authorised_ips
// 2. Make sure the sender email (vijaymudaliyar224@gmail.com) is verified in your Brevo account
// 3. For production, ensure your domain has proper SPF and DKIM records to improve deliverability
// 4. Monitor your Brevo dashboard for bounces and complaints
// 5. If using Gmail SMTP as fallback, ensure you have an App Password set up for your account

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
  ARTIST_REJECTION: 9,
  SUBSCRIPTION_CONFIRMATION: 10
};

/**
 * Send email using Brevo API directly with axios
 * @param {Object} options - Email options
 * @param {String} options.to - Recipient email
 * @param {String} options.name - Recipient name
 * @param {Number} options.templateId - Email template ID
 * @param {Object} options.params - Template parameters
 */
const sendEmail = async (options) => {
  try {
    const { to, name, templateId, params, subject, html, text } = options;

    // Check if we're using template or direct email
    if (templateId) {
      // Template email mode
      // Log the email being sent for debugging
      if (Array.isArray(to)) {
        console.log('Sending template email to multiple recipients:', to.length, 'recipients');
      } else {
        console.log('Sending template email to:', to);
      }

      console.log('Template email parameters:', {
        templateId,
        name: name || 'Not provided'
      });

      // Prepare the request payload
      const payload = {
        to: Array.isArray(to)
          ? to.map(email => ({
              email: typeof email === 'object' && email.email ? email.email : email,
              name: name || (typeof email === 'string' ? email.split('@')[0] :
                    typeof email === 'object' && email.name ? email.name : 'User')
            }))
          : [{
              email: to,
              name: name || (typeof to === 'string' ? to.split('@')[0] : 'User')
            }],
        templateId: parseInt(templateId),
        params: params || {},
        sender: {
          email: SENDER_EMAIL,
          name: SENDER_NAME
        },
        // Add replyTo for better deliverability
        replyTo: {
          email: SENDER_EMAIL,
          name: 'Rapira Support'
        }
      };

      // Add message metadata for tracking
      if (!payload.headers) {
        payload.headers = {};
      }
      payload.headers['X-Mailin-Tag'] = `template-${templateId}`;

      // Log the full payload for debugging
      console.log('Email payload:', JSON.stringify(payload));
      console.log('Sending email to:', to, 'with template ID:', templateId);

      // Make the API request
      const response = await axios.post(BREVO_API_URL, payload, {
        headers: {
          'accept': 'application/json',
          'api-key': BREVO_API_KEY,
          'content-type': 'application/json'
        }
      });

      console.log('Email sent successfully. Response:', response.status, response.statusText);
      return { success: true, data: response.data };
    } else if (subject && html) {
      // Direct email mode
      return await sendDirectEmail({ to, name, subject, html, text });
    } else {
      console.error('Missing required email parameters:', { to, templateId, subject, html });
      return { success: false, error: 'Missing required email parameters. Either templateId or subject+html must be provided.' };
    }


  } catch (error) {
    console.error('Error sending email:', error.message);

    // Log detailed error information
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
      console.error('Error response headers:', error.response.headers);

      // Check if this is an IP authorization error
      const isIPAuthError = error.response.data &&
                          error.response.data.message &&
                          error.response.data.message.includes('unrecognised IP address');

      if (isIPAuthError) {
        console.error('IP AUTHORIZATION ERROR: Your current IP address is not authorized in Brevo.');
        console.error('Please go to https://app.brevo.com/security/authorised_ips and add your IP address.');
        console.error('IP mentioned in error:', error.response.data.message.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b|[0-9a-f:]+/i)?.[0] || 'Not found');

        return {
          success: false,
          error: 'IP authorization error',
          details: error.response.data,
          ipAuthError: true,
          message: 'Your IP address is not authorized in Brevo. Please add it in your Brevo account security settings.'
        };
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.error('Error request:', error.request);
    }

    return { success: false, error: error.message, details: error.response?.data };
  }
};

// Specific email functions
const sendWelcomeEmail = async (user) => {
  try {
    if (!user || !user.email) {
      console.error('Invalid user data for welcome email:', user);
      return { success: false, error: 'Invalid user data' };
    }

    console.log('Attempting to send welcome email to:', user.email);

    // Prepare HTML content for the email
    const htmlContent = `
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

    const subject = 'Welcome to Rapira - Your Account Has Been Created';

    // First try: Use Brevo API directly
    try {
      console.log('Using direct email for welcome email to ensure delivery');

      // Create a direct email payload
      const directEmailPayload = {
        sender: {
          name: SENDER_NAME,
          email: SENDER_EMAIL
        },
        replyTo: {
          name: 'Rapira Support',
          email: SENDER_EMAIL
        },
        // Add headers for tracking
        headers: {
          'X-Mailin-Tag': 'welcome-email'
        },
        to: [{
          email: user.email,
          name: user.name || 'New User'
        }],
        subject: subject,
        htmlContent: htmlContent,
        textContent: "Welcome to Rapira! Thank you for creating an account with us. Your account has been successfully created with email: " + user.email + ". You can now log in to your account and start exploring upcoming concerts, booking tickets, and more!"
      };

      // Log the email being sent
      console.log('Sending welcome email to:', user.email);

      // Send direct email
      const response = await axios.post(BREVO_API_URL, directEmailPayload, {
        headers: {
          'accept': 'application/json',
          'api-key': BREVO_API_KEY,
          'content-type': 'application/json'
        }
      });

      console.log('Direct welcome email sent successfully. Response:', response.status, response.statusText);
      return { success: true, data: response.data, method: 'api' };

    } catch (apiError) {
      // If API fails (e.g., due to IP restrictions), try SMTP fallback
      console.error('API welcome email failed:', apiError.message);
      console.log('Trying SMTP fallback for welcome email...');

      // Send using SMTP fallback
      const mailOptions = {
        from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
        to: `"${user.name || 'New User'}" <${user.email}>`,
        replyTo: `"Rapira Support" <${SENDER_EMAIL}>`,
        subject: subject,
        html: htmlContent,
        headers: {
          'X-Mailin-Tag': 'welcome-email-smtp'
        }
      };

      // Send mail with defined transport object
      const info = await transporter.sendMail(mailOptions);

      console.log('SMTP fallback welcome email sent successfully. Message ID:', info.messageId);
      return { success: true, data: info, method: 'smtp' };
    }

  } catch (error) {
    console.error('Error in sendWelcomeEmail:', error);
    return { success: false, error: error.message };
  }
};

const sendConcertSubmissionEmail = async (artist, concert) => {
  try {
    console.log('Attempting to send concert submission email to artist:', artist.email);

    // Format date
    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    // Prepare HTML content for the email
    const htmlContent = `
      <html>
        <body>
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #6366f1; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">Concert Submission Received</h1>
            </div>
            <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
              <p>Hello ${artist.name || 'Artist'},</p>
              <p>Thank you for submitting your concert to Rapira. Your submission has been received and is pending approval.</p>

              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Concert Details:</h3>
                <p><strong>Title:</strong> ${concert.title}</p>
                <p><strong>Date:</strong> ${formatDate(concert.date)}</p>
                <p><strong>Venue:</strong> ${concert.venue}, ${concert.city}</p>
              </div>

              <p>Our team will review your submission and you will receive a notification once it's approved or rejected.</p>
              <p>If you have any questions or need to make changes to your submission, please contact our support team.</p>
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

    const subject = `Your Concert "${concert.title}" Has Been Submitted`;

    // First try: Use Brevo API directly
    try {
      console.log('Using direct email for concert submission to ensure delivery');

      // Create a direct email payload
      const directEmailPayload = {
        sender: {
          name: SENDER_NAME,
          email: SENDER_EMAIL
        },
        replyTo: {
          name: 'Rapira Support',
          email: SENDER_EMAIL
        },
        // Add headers for tracking
        headers: {
          'X-Mailin-Tag': 'concert-submission'
        },
        to: [{
          email: artist.email,
          name: artist.name || 'Artist'
        }],
        subject: subject,
        htmlContent: htmlContent,
        textContent: "Thank you for submitting your concert to Rapira. Your submission has been received and is pending approval. Concert Details: Title: " + concert.title + ", Date: " + formatDate(concert.date) + ", Venue: " + concert.venue + ", " + concert.city
      };

      // Log the email being sent
      console.log('Sending to:', artist.email, 'Subject:', subject);

      // Send direct email
      const response = await axios.post(BREVO_API_URL, directEmailPayload, {
        headers: {
          'accept': 'application/json',
          'api-key': BREVO_API_KEY,
          'content-type': 'application/json'
        }
      });

      console.log('Direct concert submission email sent successfully. Response:', response.status, response.statusText);
      console.log('Message ID:', response.data.messageId);
      return { success: true, data: response.data, method: 'api' };

    } catch (apiError) {
      // If API fails (e.g., due to IP restrictions), try SMTP fallback
      console.error('API email failed:', apiError.message);
      console.log('Trying SMTP fallback for concert submission email...');

      // Send using SMTP fallback
      const mailOptions = {
        from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
        to: `"${artist.name || 'Artist'}" <${artist.email}>`,
        replyTo: `"Rapira Support" <${SENDER_EMAIL}>`,
        subject: subject,
        html: htmlContent,
        headers: {
          'X-Mailin-Tag': 'concert-submission-smtp'
        }
      };

      // Send mail with defined transport object
      const info = await transporter.sendMail(mailOptions);

      console.log('SMTP fallback email sent successfully. Message ID:', info.messageId);
      return { success: true, data: info, method: 'smtp' };
    }

  } catch (error) {
    console.error('Error in sendConcertSubmissionEmail:', error);
    return { success: false, error: error.message };
  }
};

const sendConcertApprovalEmail = async (artist, concert) => {
  try {
    console.log('Attempting to send concert approval email to artist:', artist.email);

    // Format date
    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    // Prepare HTML content for the email
    const htmlContent = `
      <html>
        <body>
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #6366f1; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">Concert Approved!</h1>
            </div>
            <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
              <p>Hello ${artist.name || 'Artist'},</p>
              <p>Great news! Your concert submission has been approved and is now live on Rapira.</p>

              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Concert Details:</h3>
                <p><strong>Title:</strong> ${concert.title}</p>
                <p><strong>Date:</strong> ${formatDate(concert.date)}</p>
                <p><strong>Venue:</strong> ${concert.venue?.name || concert.venue}, ${concert.city}</p>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.BASE_URL}/concerts/${concert._id}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">View Your Concert</a>
              </div>

              <p>Users can now view your concert and purchase tickets. You can track ticket sales in your artist dashboard.</p>
              <p>If you have any questions or need to make changes to your concert, please contact our support team.</p>
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

    const subject = `Your Concert "${concert.title}" Has Been Approved`;

    // First try: Use Brevo API directly
    try {
      console.log('Using direct email for concert approval to ensure delivery');

      // Create a direct email payload
      const directEmailPayload = {
        sender: {
          name: SENDER_NAME,
          email: SENDER_EMAIL
        },
        replyTo: {
          name: 'Rapira Support',
          email: SENDER_EMAIL
        },
        // Add headers for tracking
        headers: {
          'X-Mailin-Tag': 'concert-approval'
        },
        to: [{
          email: artist.email,
          name: artist.name || 'Artist'
        }],
        subject: subject,
        htmlContent: htmlContent,
        textContent: "Great news! Your concert submission has been approved and is now live on Rapira. Concert Details: Title: " + concert.title + ", Date: " + formatDate(concert.date) + ", Venue: " + (concert.venue?.name || concert.venue) + ", " + concert.city
      };

      // Log the email being sent
      console.log('Sending to:', artist.email, 'Subject:', subject);

      // Send direct email
      const response = await axios.post(BREVO_API_URL, directEmailPayload, {
        headers: {
          'accept': 'application/json',
          'api-key': BREVO_API_KEY,
          'content-type': 'application/json'
        }
      });

      console.log('Direct concert approval email sent successfully. Response:', response.status, response.statusText);
      console.log('Message ID:', response.data.messageId);
      return { success: true, data: response.data, method: 'api' };

    } catch (apiError) {
      // If API fails (e.g., due to IP restrictions), try SMTP fallback
      console.error('API email failed:', apiError.message);
      console.log('Trying SMTP fallback for concert approval email...');

      // Send using SMTP fallback
      const mailOptions = {
        from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
        to: `"${artist.name || 'Artist'}" <${artist.email}>`,
        replyTo: `"Rapira Support" <${SENDER_EMAIL}>`,
        subject: subject,
        html: htmlContent,
        headers: {
          'X-Mailin-Tag': 'concert-approval-smtp'
        }
      };

      // Send mail with defined transport object
      const info = await transporter.sendMail(mailOptions);

      console.log('SMTP fallback email sent successfully. Message ID:', info.messageId);
      return { success: true, data: info, method: 'smtp' };
    }

  } catch (error) {
    console.error('Error in sendConcertApprovalEmail:', error);
    return { success: false, error: error.message };
  }
};

const sendConcertRejectionEmail = async (artist, concert, reason) => {
  try {
    console.log('Sending concert rejection email to artist:', artist.email);

    // Skip template and use direct email for reliability
    console.log('Using direct email for concert rejection to ensure delivery');

    // Create a direct email payload
    const directEmailPayload = {
      sender: {
        name: SENDER_NAME,
        email: SENDER_EMAIL
      },
      replyTo: {
        name: 'Rapira Support',
        email: SENDER_EMAIL
      },
      // Add headers for tracking
      headers: {
        'X-Mailin-Tag': 'concert-rejection'
      },
      to: [{
        email: artist.email,
        name: artist.name || 'Artist'
      }],
      subject: `Your Concert "${concert.title}" Needs Revision`,
      htmlContent: `
        <html>
          <body>
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #6366f1; padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">Concert Submission Update</h1>
              </div>
              <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
                <p>Hello ${artist.name || 'Artist'},</p>
                <p>Thank you for submitting your concert "${concert.title}" to Rapira. After review, we need some revisions before it can be approved.</p>

                <div style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; margin: 20px 0;">
                  <h3 style="margin-top: 0;">Feedback from our team:</h3>
                  <p>${reason || 'No specific reason provided. Please contact support for more details.'}</p>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                  <a href="${process.env.BASE_URL}/artists/dashboard" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Go to Dashboard</a>
                </div>

                <p>You can edit your concert submission from your artist dashboard and resubmit it for approval.</p>
                <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
                <p>Best regards,<br>The Rapira Team</p>
              </div>
              <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
                <p>&copy; ${new Date().getFullYear()} Rapira. All rights reserved.</p>
                <p><a href="${process.env.BASE_URL}/terms-of-service" style="color: #6b7280;">Terms of Service</a> | <a href="${process.env.BASE_URL}/privacy-policy" style="color: #6b7280;">Privacy Policy</a></p>
              </div>
            </div>
          </body>
        </html>
      `,
      textContent: `Thank you for submitting your concert "${concert.title}" to Rapira. After review, we need some revisions before it can be approved. Feedback: ${reason || 'No specific reason provided. Please contact support for more details.'}`
    };

    // Log the email being sent
    console.log('Concert rejection email payload:', JSON.stringify(directEmailPayload).substring(0, 200) + '...');
    console.log('Sending to:', artist.email, 'Subject:', directEmailPayload.subject);

    // Send direct email
    const response = await axios.post(BREVO_API_URL, directEmailPayload, {
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      }
    });

    console.log('Direct concert rejection email sent successfully. Response:', response.status, response.statusText);
    console.log('Response data:', response.data);
    console.log('Message ID:', response.data.messageId);
    console.log('Concert rejection email sent successfully to:', artist.email);
    return { success: true, data: response.data, method: 'direct' };

  } catch (error) {
    console.error('Error in sendConcertRejectionEmail:', error);
    return { success: false, error: error.message };
  }
};

const sendTicketPurchaseEmail = async (user, ticket, concert) => {
  try {
    if (!user || !user.email || !ticket || !concert) {
      console.error('Invalid data for ticket purchase email:', { user, ticket, concert });
      return { success: false, error: 'Invalid ticket purchase data' };
    }

    console.log('Sending ticket purchase email to:', user.email);

    // Format currency
    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2
      }).format(amount);
    };

    // Format date
    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    // Try to send using template first
    const templateResult = await sendEmail({
      to: user.email,
      name: user.name,
      templateId: templates.TICKET_PURCHASE,
      params: {
        name: user.name || 'Valued Customer',
        concert_title: concert.title,
        concert_date: formatDate(concert.date),
        concert_time: concert.time,
        concert_venue: concert.venue?.name || concert.venue,
        concert_city: concert.city,
        ticket_number: ticket.ticketNumber || ticket._id.toString(),
        ticket_quantity: ticket.quantity,
        ticket_amount: formatCurrency(ticket.totalAmount),
        is_free: ticket.totalAmount === 0,
        attendees: ticket.attendees.map(a => `${a.name} (${a.age})`).join(', '),
        ticket_url: `${process.env.BASE_URL}/tickets/${ticket._id}`,
        current_year: new Date().getFullYear(),
        site_name: 'Rapira',
        site_url: process.env.BASE_URL
      }
    });

    if (templateResult.success) {
      return templateResult;
    }

    // If template fails, try direct email as fallback
    console.log('Template ticket email failed, trying direct email fallback');

    // Format attendees list for HTML
    const attendeesList = ticket.attendees.map(a => `<li>${a.name} (${a.age})</li>`).join('');
    const ticketType = ticket.totalAmount === 0 ? 'Free' : 'Paid';
    const formattedAmount = formatCurrency(ticket.totalAmount);

    // Create a direct email payload
    const directEmailPayload = {
      sender: {
        name: SENDER_NAME,
        email: SENDER_EMAIL
      },
      replyTo: {
        name: 'Rapira Support',
        email: SENDER_EMAIL
      },
      // Add headers for tracking
      headers: {
        'X-Mailin-Tag': 'ticket-purchase'
      },
      to: [{
        email: user.email,
        name: user.name || 'Valued Customer'
      }],
      subject: `Your Rapira Concert Tickets - ${concert.title}`,
      htmlContent: `
        <html>
          <body>
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #6366f1; padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">Your Tickets are Confirmed!</h1>
              </div>
              <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
                <p>Hello ${user.name || 'Valued Customer'},</p>
                <p>Thank you for purchasing tickets to <strong>${concert.title}</strong>. Your booking has been confirmed!</p>

                <div style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; margin: 20px 0;">
                  <h3 style="margin-top: 0;">Ticket Details:</h3>
                  <p><strong>Ticket Number:</strong> ${ticket.ticketNumber || ticket._id.toString()}</p>
                  <p><strong>Concert:</strong> ${concert.title}</p>
                  <p><strong>Date:</strong> ${formatDate(concert.date)}</p>
                  <p><strong>Time:</strong> ${concert.time}</p>
                  <p><strong>Venue:</strong> ${concert.venue?.name || concert.venue}, ${concert.city}</p>
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
      `,
      textContent: `Thank you for purchasing tickets to ${concert.title}. Your booking has been confirmed! Ticket Number: ${ticket.ticketNumber || ticket._id.toString()}, Concert: ${concert.title}, Date: ${formatDate(concert.date)}, Time: ${concert.time}, Venue: ${concert.venue?.name || concert.venue}, ${concert.city}, Ticket Type: ${ticketType}, Number of Tickets: ${ticket.quantity}, Total Amount: ${formattedAmount}`
    };

    // Send direct email
    const response = await axios.post(BREVO_API_URL, directEmailPayload, {
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      }
    });

    console.log('Direct ticket email sent successfully. Response:', response.status, response.statusText);
    return { success: true, data: response.data, method: 'direct' };

  } catch (error) {
    console.error('Error in sendTicketPurchaseEmail:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send a direct email without using templates
 * @param {Object} options - Email options
 */
const sendDirectEmail = async (options) => {
  try {
    const { to, name, subject, html, text } = options;

    // Validate required parameters
    if (!to || !subject || !html) {
      console.error('Missing required direct email parameters:', { to, subject, html });
      return { success: false, error: 'Missing required email parameters' };
    }

    // Ensure text content is provided (required by Brevo API)
    let textContent = text;
    if (!textContent) {
      console.warn('Text content not provided, generating plain text version from HTML');
      // Create a simple text version by removing HTML tags
      textContent = html.replace(/<[^>]*>/g, ' ')
                       .replace(/\s+/g, ' ')
                       .trim();
    }

    // Log recipient information for debugging
    if (Array.isArray(to)) {
      console.log('Sending direct email to multiple recipients:', to);
    } else {
      console.log('Sending direct email to:', to);
    }

    // Prepare the request payload - using the exact same format that worked in our test
    const payload = {
      sender: {
        name: SENDER_NAME,
        email: SENDER_EMAIL
      },
      replyTo: {
        name: 'Rapira Support',
        email: SENDER_EMAIL
      },
      // Add headers for tracking
      headers: {
        'X-Mailin-Tag': 'direct-email'
      },
      to: Array.isArray(to)
        ? to.map(email => ({ email, name: name || (typeof email === 'string' ? email.split('@')[0] : 'User') }))
        : [{ email: to, name: name || (typeof to === 'string' ? to.split('@')[0] : 'User') }],
      subject: subject,
      htmlContent: html,
      textContent: textContent
    };

    console.log('Sending email with payload:', JSON.stringify(payload).substring(0, 200) + '...');

    // Make the API request - using the exact same format that worked in our test
    const response = await axios.post(BREVO_API_URL, payload, {
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      }
    });

    console.log('Direct email sent successfully. Response:', response.status, response.statusText);
    console.log('Response data:', response.data);
    return { success: true, data: response.data, method: 'direct' };
  } catch (error) {
    // Check for specific errors related to recipient format
    if (error.message && error.message.includes('split is not a function')) {
      console.error('Error sending direct email: Invalid recipient format', { to });
      console.error('Recipient data type:', typeof to, 'Value:', to);
      return {
        success: false,
        error: 'Invalid recipient format. Expected string or array of strings.',
        originalError: error.message
      };
    }

    console.error('Error sending direct email:', error.message);

    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', error.response.data);
      console.error('Error response headers:', error.response.headers);
    } else if (error.request) {
      console.error('Error request:', error.request);
    } else {
      console.error('Error message:', error.message);
    }

    return { success: false, error: error.message, details: error.response?.data };
  }
};

/**
 * Send a test email to verify email delivery
 * @param {String} to - Recipient email
 */
const sendTestEmail = async (to) => {
  try {
    console.log('Attempting to send test email to:', to);

    // Prepare HTML content for the email
    const htmlContent = `
      <html>
        <body>
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #6366f1; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">Rapira Email Test</h1>
            </div>
            <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
              <p>Hello,</p>
              <p>This is a test email from Rapira to verify that email delivery is working correctly.</p>
              <p>If you're receiving this email, it means our email system is functioning properly.</p>
              <p>Time sent: ${new Date().toLocaleString()}</p>
              <p>Best regards,<br>The Rapira Team</p>
            </div>
            <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
              <p>&copy; ${new Date().getFullYear()} Rapira. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const subject = 'Rapira Email Test';
    const recipientName = to.split('@')[0];

    // First try: Use Brevo API directly
    try {
      console.log('Using API for test email');

      // Create a direct email payload
      const payload = {
        sender: {
          name: SENDER_NAME,
          email: SENDER_EMAIL
        },
        replyTo: {
          name: 'Rapira Support',
          email: SENDER_EMAIL
        },
        // Add headers for tracking
        headers: {
          'X-Mailin-Tag': 'test-email'
        },
        to: [{
          email: to,
          name: recipientName
        }],
        subject: subject,
        htmlContent: htmlContent,
        textContent: "This is a test email from Rapira to verify that email delivery is working correctly. Time sent: " + new Date().toLocaleString()
      };

      // Send the email via API
      const response = await axios.post(BREVO_API_URL, payload, {
        headers: {
          'accept': 'application/json',
          'api-key': BREVO_API_KEY,
          'content-type': 'application/json'
        }
      });

      console.log('Test email sent successfully via API. Response:', response.status, response.statusText);
      return { success: true, data: response.data, method: 'api' };

    } catch (apiError) {
      // If API fails (e.g., due to IP restrictions), try SMTP fallback
      console.error('API test email failed:', apiError.message);
      console.log('Trying SMTP fallback for test email...');

      // Send using SMTP fallback
      const mailOptions = {
        from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
        to: `"${recipientName}" <${to}>`,
        replyTo: `"Rapira Support" <${SENDER_EMAIL}>`,
        subject: subject,
        html: htmlContent,
        headers: {
          'X-Mailin-Tag': 'test-email-smtp'
        }
      };

      // Send mail with defined transport object
      const info = await transporter.sendMail(mailOptions);

      console.log('SMTP fallback test email sent successfully. Message ID:', info.messageId);
      return { success: true, data: info, method: 'smtp' };
    }

  } catch (error) {
    console.error('Error sending test email:', error.message);

    if (error.response) {
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
    }

    return { success: false, error: error.message, details: error.response?.data };
  }
};

const sendArtistApplicationEmail = async (user, artistLevel) => {
  try {
    console.log('Attempting to send artist application email to all admins for user:', user.email);

    // Import User model
    const User = require('../models/User');

    // Find all admin users
    const adminUsers = await User.find({ role: 'admin' });

    if (!adminUsers || adminUsers.length === 0) {
      console.log('No admin users found. Using default admin email.');
      // Use default admin email if no admin users found
      adminUsers.push({ email: process.env.ADMIN_EMAIL || 'admin@rapira.com', name: 'Rapira Admin' });
    }

    console.log(`Found ${adminUsers.length} admin users to notify.`);

    // Prepare HTML content for the email
    const htmlContent = `
      <html>
        <body>
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #6366f1; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">New Artist Application</h1>
            </div>
            <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
              <p>Hello Admin,</p>
              <p>A new artist application has been submitted and is pending your review.</p>

              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Application Details:</h3>
                <p><strong>User:</strong> ${user.name} (${user.email})</p>
                <p><strong>Artist Level:</strong> ${artistLevel}</p>
                <p><strong>Phone Number:</strong> ${user.phoneNumber || 'Not provided'}</p>
                <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.BASE_URL}/artist-applications/admin" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Review Application</a>
              </div>

              <p>Please review this application at your earliest convenience.</p>
              <p>Best regards,<br>The Rapira Team</p>
            </div>
            <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
              <p>&copy; ${new Date().getFullYear()} Rapira. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const subject = `New Artist Application: ${user.name} (${artistLevel})`;

    // Create recipients array for all admin users
    const recipients = adminUsers.map(admin => ({
      email: admin.email,
      name: admin.name || 'Rapira Admin'
    }));

    // Create a direct email payload
    const directEmailPayload = {
      sender: {
        name: SENDER_NAME,
        email: SENDER_EMAIL
      },
      replyTo: {
        name: 'Rapira Support',
        email: SENDER_EMAIL
      },
      // Add headers for tracking
      headers: {
        'X-Mailin-Tag': 'artist-application'
      },
      to: recipients,
      subject: subject,
      htmlContent: htmlContent,
      textContent: "New artist application from " + user.name + " for " + artistLevel + " level."
    };

    // Log the email being sent
    console.log('Sending artist application notification to all admins:', recipients.map(r => r.email).join(', '));

    // Send direct email
    const response = await axios.post(BREVO_API_URL, directEmailPayload, {
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      }
    });

    console.log('Artist application email sent successfully to all admins. Response:', response.status, response.statusText);
    return { success: true, data: response.data, method: 'api', recipientCount: recipients.length };

  } catch (error) {
    console.error('Error in sendArtistApplicationEmail:', error);
    return { success: false, error: error.message };
  }
};

const sendArtistApprovalEmail = async (user, artistLevel) => {
  try {
    console.log('Attempting to send artist approval email to:', user.email);

    // Prepare HTML content for the email
    const htmlContent = `
      <html>
        <body>
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #6366f1; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">Artist Application Approved!</h1>
            </div>
            <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
              <p>Hello ${user.name},</p>
              <p>Congratulations! Your application to become a ${artistLevel} Artist has been approved.</p>

              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Your Artist Details:</h3>
                <p><strong>Artist Level:</strong> ${artistLevel}</p>
                <p><strong>Approved On:</strong> ${new Date().toLocaleString()}</p>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.BASE_URL}/artists/dashboard" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Go to Artist Dashboard</a>
              </div>

              ${artistLevel === 'Beginner' ? `
              <p><strong>Important Note for Beginner Artists:</strong></p>
              <p>As a Beginner Artist, you need to complete the required learning modules before you can create concerts. Visit the Learning page to get started.</p>
              <div style="text-align: center; margin: 20px 0;">
                <a href="${process.env.BASE_URL}/learning" style="background-color: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">Start Learning</a>
              </div>
              ` : ''}

              <p>You can now access all the features available to ${artistLevel} Artists on our platform.</p>
              <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
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

    const subject = `Your Artist Application Has Been Approved - ${artistLevel} Level`;

    // Create a direct email payload
    const directEmailPayload = {
      sender: {
        name: SENDER_NAME,
        email: SENDER_EMAIL
      },
      replyTo: {
        name: 'Rapira Support',
        email: SENDER_EMAIL
      },
      // Add headers for tracking
      headers: {
        'X-Mailin-Tag': 'artist-approval'
      },
      to: [{
        email: user.email,
        name: user.name || 'Artist'
      }],
      subject: subject,
      htmlContent: htmlContent,
      textContent: "Congratulations! Your application to become a " + artistLevel + " Artist has been approved."
    };

    // Log the email being sent
    console.log('Sending artist approval email to:', user.email);

    // Send direct email
    const response = await axios.post(BREVO_API_URL, directEmailPayload, {
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      }
    });

    console.log('Artist approval email sent successfully. Response:', response.status, response.statusText);
    return { success: true, data: response.data, method: 'api' };

  } catch (error) {
    console.error('Error in sendArtistApprovalEmail:', error);
    return { success: false, error: error.message };
  }
};

const sendArtistRejectionEmail = async (user, artistLevel, reason) => {
  try {
    console.log('Attempting to send artist rejection email to:', user.email);

    // Prepare HTML content for the email
    const htmlContent = `
      <html>
        <body>
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #6366f1; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">Artist Application Update</h1>
            </div>
            <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
              <p>Hello ${user.name},</p>
              <p>Thank you for your interest in becoming a ${artistLevel} Artist on Rapira.</p>
              <p>After careful review, we regret to inform you that your application has not been approved at this time.</p>

              ${reason ? `
              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Feedback from our team:</h3>
                <p>${reason}</p>
              </div>
              ` : ''}

              <p>You are welcome to apply again in the future with updated information.</p>
              <p>If you have any questions or need further clarification, please don't hesitate to contact our support team.</p>
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

    const subject = `Update on Your Artist Application`;

    // Create a direct email payload
    const directEmailPayload = {
      sender: {
        name: SENDER_NAME,
        email: SENDER_EMAIL
      },
      replyTo: {
        name: 'Rapira Support',
        email: SENDER_EMAIL
      },
      // Add headers for tracking
      headers: {
        'X-Mailin-Tag': 'artist-rejection'
      },
      to: [{
        email: user.email,
        name: user.name || 'Artist'
      }],
      subject: subject,
      htmlContent: htmlContent,
      textContent: "Your application to become a " + artistLevel + " Artist has not been approved at this time." + (reason ? " Reason: " + reason : "")
    };

    // Log the email being sent
    console.log('Sending artist rejection email to:', user.email);

    // Send direct email
    const response = await axios.post(BREVO_API_URL, directEmailPayload, {
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      }
    });

    console.log('Artist rejection email sent successfully. Response:', response.status, response.statusText);
    return { success: true, data: response.data, method: 'api' };

  } catch (error) {
    console.error('Error in sendArtistRejectionEmail:', error);
    return { success: false, error: error.message };
  }
};

const sendTeamBookingRequestEmail = async (request, role) => {
  try {
    console.log('Attempting to send team booking request notification to admins');

    // Import User model
    const User = require('../models/User');

    // Find all admin users
    const adminUsers = await User.find({ role: 'admin' });

    if (!adminUsers || adminUsers.length === 0) {
      console.log('No admin users found. Using default admin email.');
      // Use default admin email if no admin users found
      adminUsers.push({ email: process.env.ADMIN_EMAIL || 'admin@rapira.com', name: 'Rapira Admin' });
    }

    console.log(`Found ${adminUsers.length} admin users to notify.`);

    // Prepare HTML content for the email
    const htmlContent = `
      <html>
        <body>
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #6366f1; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">New Team Booking Request</h1>
            </div>
            <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
              <p>Hello Admin,</p>
              <p>A new team booking request has been submitted and is pending your review.</p>

              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Request Details:</h3>
                <p><strong>Name:</strong> ${request.name}</p>
                <p><strong>Email:</strong> ${request.email}</p>
                <p><strong>Phone:</strong> ${request.phone}</p>
                <p><strong>Role:</strong> ${role.name}</p>
                <p><strong>Location:</strong> ${request.city}, ${request.state}</p>
                <p><strong>Submitted:</strong> ${new Date(request.createdAt).toLocaleString()}</p>
              </div>

              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Message:</h3>
                <p>${request.message}</p>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.BASE_URL}/admin/team-requirement/requests/${request._id}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Review Request</a>
              </div>

              <p>Please review this request at your earliest convenience.</p>
              <p>Best regards,<br>The Rapira Team</p>
            </div>
            <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
              <p>&copy; ${new Date().getFullYear()} Rapira. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const subject = `New Team Booking Request: ${role.name} in ${request.city}`;

    // Create recipients array for all admin users
    const recipients = adminUsers.map(admin => ({
      email: admin.email,
      name: admin.name || 'Rapira Admin'
    }));

    // Create a direct email payload
    const directEmailPayload = {
      sender: {
        name: SENDER_NAME,
        email: SENDER_EMAIL
      },
      replyTo: {
        name: 'Rapira Support',
        email: SENDER_EMAIL
      },
      // Add headers for tracking
      headers: {
        'X-Mailin-Tag': 'team-booking-request'
      },
      to: recipients,
      subject: subject,
      htmlContent: htmlContent,
      textContent: `New team booking request from ${request.name} for ${role.name} role in ${request.city}, ${request.state}. Contact: ${request.email}, ${request.phone}. Message: ${request.message}`
    };

    // Log the email being sent
    console.log('Sending team booking request notification to all admins:', recipients.map(r => r.email).join(', '));

    // Send direct email
    const response = await axios.post(BREVO_API_URL, directEmailPayload, {
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      }
    });

    console.log('Team booking request email sent successfully to all admins. Response:', response.status, response.statusText);
    return { success: true, data: response.data, method: 'api', recipientCount: recipients.length };

  } catch (error) {
    console.error('Error in sendTeamBookingRequestEmail:', error);
    return { success: false, error: error.message };
  }
};

const sendTeamBookingApprovalEmail = async (request, role) => {
  try {
    console.log('Attempting to send team booking approval email to:', request.email);

    // Prepare HTML content for the email
    const htmlContent = `
      <html>
        <body>
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #6366f1; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">Your Booking Request is Approved!</h1>
            </div>
            <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
              <p>Hello ${request.name},</p>
              <p>We're pleased to inform you that your booking request for the ${role.name} role has been approved.</p>

              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Booking Details:</h3>
                <p><strong>Role:</strong> ${role.name}</p>
                <p><strong>Location:</strong> ${request.city}, ${request.state}</p>
                <p><strong>Approved On:</strong> ${new Date().toLocaleString()}</p>
                ${request.adminNotes ? `<p><strong>Admin Notes:</strong> ${request.adminNotes}</p>` : ''}
              </div>

              <p>Our team will be in touch with you shortly to discuss the next steps.</p>
              <p>If you have any questions or need further information, please don't hesitate to contact us.</p>
              <p>Best regards,<br>The Rapira Team</p>
            </div>
            <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
              <p>&copy; ${new Date().getFullYear()} Rapira. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const subject = `Your ${role.name} Booking Request Has Been Approved`;

    // Create a direct email payload
    const directEmailPayload = {
      sender: {
        name: SENDER_NAME,
        email: SENDER_EMAIL
      },
      replyTo: {
        name: 'Rapira Support',
        email: SENDER_EMAIL
      },
      // Add headers for tracking
      headers: {
        'X-Mailin-Tag': 'team-booking-approval'
      },
      to: [{
        email: request.email,
        name: request.name
      }],
      subject: subject,
      htmlContent: htmlContent,
      textContent: `Your booking request for the ${role.name} role in ${request.city}, ${request.state} has been approved. Our team will be in touch with you shortly to discuss the next steps. ${request.adminNotes ? `Admin Notes: ${request.adminNotes}` : ''}`
    };

    // Log the email being sent
    console.log('Sending team booking approval email to:', request.email);

    // Send direct email
    const response = await axios.post(BREVO_API_URL, directEmailPayload, {
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      }
    });

    console.log('Team booking approval email sent successfully. Response:', response.status, response.statusText);
    return { success: true, data: response.data, method: 'api' };

  } catch (error) {
    console.error('Error in sendTeamBookingApprovalEmail:', error);
    return { success: false, error: error.message };
  }
};

const sendTeamBookingRejectionEmail = async (request, role) => {
  try {
    console.log('Attempting to send team booking rejection email to:', request.email);

    // Prepare HTML content for the email
    const htmlContent = `
      <html>
        <body>
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #6366f1; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">Booking Request Update</h1>
            </div>
            <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
              <p>Hello ${request.name},</p>
              <p>Thank you for your interest in booking the ${role.name} role with Rapira.</p>
              <p>After careful review, we regret to inform you that we are unable to approve your booking request at this time.</p>

              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Feedback from our team:</h3>
                <p>${request.adminNotes || 'No specific reason provided.'}</p>
              </div>

              <p>You are welcome to submit another request in the future or explore other roles that might better match your requirements.</p>
              <p>If you have any questions or need further clarification, please don't hesitate to contact our support team.</p>
              <p>Best regards,<br>The Rapira Team</p>
            </div>
            <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
              <p>&copy; ${new Date().getFullYear()} Rapira. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const subject = `Update on Your ${role.name} Booking Request`;

    // Create a direct email payload
    const directEmailPayload = {
      sender: {
        name: SENDER_NAME,
        email: SENDER_EMAIL
      },
      replyTo: {
        name: 'Rapira Support',
        email: SENDER_EMAIL
      },
      // Add headers for tracking
      headers: {
        'X-Mailin-Tag': 'team-booking-rejection'
      },
      to: [{
        email: request.email,
        name: request.name
      }],
      subject: subject,
      htmlContent: htmlContent,
      textContent: `Thank you for your interest in booking the ${role.name} role with Rapira. After careful review, we regret to inform you that we are unable to approve your booking request at this time. Reason: ${request.adminNotes || 'No specific reason provided.'}`
    };

    // Log the email being sent
    console.log('Sending team booking rejection email to:', request.email);

    // Send direct email
    const response = await axios.post(BREVO_API_URL, directEmailPayload, {
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      }
    });

    console.log('Team booking rejection email sent successfully. Response:', response.status, response.statusText);
    return { success: true, data: response.data, method: 'api' };

  } catch (error) {
    console.error('Error in sendTeamBookingRejectionEmail:', error);
    return { success: false, error: error.message };
  }
};

// Send refund request approval email
const sendRefundApprovalEmail = async (user, refundRequest, ticket, concert) => {
  try {
    console.log('Attempting to send refund approval email to user:', user.email);

    // Format date
    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    // Format currency
    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
      }).format(amount);
    };

    // Prepare HTML content for the email
    const htmlContent = `
      <html>
        <body>
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #6366f1; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">Refund Request Approved</h1>
            </div>
            <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
              <p>Hello ${user.name || 'User'},</p>
              <p>Good news! Your refund request has been approved and processed.</p>

              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Refund Details:</h3>
                <p><strong>Concert:</strong> ${concert.title}</p>
                <p><strong>Ticket Number:</strong> ${ticket.ticketNumber}</p>
                <p><strong>Refund Amount:</strong> ${formatCurrency(refundRequest.amount)}</p>
                <p><strong>Refund Date:</strong> ${formatDate(refundRequest.refundedAt)}</p>
                ${refundRequest.transactionId ? `<p><strong>Transaction ID:</strong> ${refundRequest.transactionId}</p>` : ''}
              </div>

              <p>The refund has been processed to the bank account you provided in your request. Please allow 3-5 business days for the amount to be credited to your account.</p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.BASE_URL}/refund-requests/view/${refundRequest._id}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">View Refund Details</a>
              </div>

              <p>If you have any questions or concerns about your refund, please contact our support team.</p>
              <p>Thank you for using Rapira!</p>
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

    const subject = `Your Refund Request for ${concert.title} Has Been Approved`;
    const textContent = `Good news! Your refund request for ticket #${ticket.ticketNumber} for the concert "${concert.title}" has been approved. The refund amount of ${formatCurrency(refundRequest.amount)} has been processed to your bank account. Please allow 3-5 business days for the amount to be credited.`;

    // Use Brevo API directly - use the correct API URL
    try {
      console.log('Using Brevo API for refund approval email');

      // Create a direct email payload
      const directEmailPayload = {
        sender: {
          name: SENDER_NAME,
          email: SENDER_EMAIL
        },
        replyTo: {
          name: 'Rapira Support',
          email: SENDER_EMAIL
        },
        to: [{
          email: user.email,
          name: user.name || 'User'
        }],
        subject: subject,
        htmlContent: htmlContent,
        textContent: textContent
      };

      // Log the email being sent
      console.log('Sending refund approval email to:', user.email);

      // Send direct email using the correct API endpoint
      const response = await axios.post('https://api.sendinblue.com/v3/smtp/email', directEmailPayload, {
        headers: {
          'Content-Type': 'application/json',
          'api-key': BREVO_API_KEY
        }
      });

      console.log('Refund approval email sent successfully. Response:', response.status, response.statusText);
      return { success: true, data: response.data, method: 'api' };

    } catch (apiError) {
      console.error('Failed to send refund approval email:', apiError.message);

      // Log more detailed error information
      if (apiError.response) {
        console.error('Error response data:', apiError.response.data);
        console.error('Error response status:', apiError.response.status);
      }

      // Return error but don't throw - allow the process to continue
      return {
        success: false,
        error: apiError.message,
        details: apiError.response?.data || 'No additional details'
      };
    }
  } catch (error) {
    console.error('Error in sendRefundApprovalEmail:', error);
    return { success: false, error: error.message };
  }
};

// Send refund request rejection email
const sendRefundRejectionEmail = async (user, refundRequest, ticket, concert) => {
  try {
    console.log('Attempting to send refund rejection email to user:', user.email);

    // Format date
    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    // Format currency
    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
      }).format(amount);
    };

    // Prepare HTML content for the email
    const htmlContent = `
      <html>
        <body>
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #6366f1; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">Refund Request Update</h1>
            </div>
            <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
              <p>Hello ${user.name || 'User'},</p>
              <p>We have reviewed your refund request for the concert "${concert.title}" and we regret to inform you that we are unable to approve it at this time.</p>

              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Request Details:</h3>
                <p><strong>Concert:</strong> ${concert.title}</p>
                <p><strong>Ticket Number:</strong> ${ticket.ticketNumber}</p>
                <p><strong>Requested Amount:</strong> ${formatCurrency(refundRequest.amount)}</p>
                <p><strong>Request Date:</strong> ${formatDate(refundRequest.createdAt)}</p>
                ${refundRequest.adminNotes ? `<p><strong>Reason for Rejection:</strong> ${refundRequest.adminNotes}</p>` : ''}
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.BASE_URL}/refund-requests/view/${refundRequest._id}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">View Request Details</a>
              </div>

              <p>If you have any questions or would like to discuss this further, please contact our support team.</p>
              <p>Thank you for your understanding.</p>
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

    const subject = `Update on Your Refund Request for ${concert.title}`;
    const textContent = `We have reviewed your refund request for ticket #${ticket.ticketNumber} for the concert "${concert.title}" and we regret to inform you that we are unable to approve it at this time. ${refundRequest.adminNotes ? `Reason: ${refundRequest.adminNotes}` : ''}`;

    // Use Brevo API directly with the correct API URL
    try {
      console.log('Using Brevo API for refund rejection email');

      // Create a direct email payload
      const directEmailPayload = {
        sender: {
          name: SENDER_NAME,
          email: SENDER_EMAIL
        },
        replyTo: {
          name: 'Rapira Support',
          email: SENDER_EMAIL
        },
        to: [{
          email: user.email,
          name: user.name || 'User'
        }],
        subject: subject,
        htmlContent: htmlContent,
        textContent: textContent
      };

      // Log the email being sent
      console.log('Sending refund rejection email to:', user.email);

      // Send direct email using the correct API endpoint
      const response = await axios.post('https://api.sendinblue.com/v3/smtp/email', directEmailPayload, {
        headers: {
          'Content-Type': 'application/json',
          'api-key': BREVO_API_KEY
        }
      });

      console.log('Refund rejection email sent successfully. Response:', response.status, response.statusText);
      return { success: true, data: response.data, method: 'api' };

    } catch (apiError) {
      console.error('Failed to send refund rejection email:', apiError.message);

      // Log more detailed error information
      if (apiError.response) {
        console.error('Error response data:', apiError.response.data);
        console.error('Error response status:', apiError.response.status);
      }

      // Return error but don't throw - allow the process to continue
      return {
        success: false,
        error: apiError.message,
        details: apiError.response?.data || 'No additional details'
      };
    }
  } catch (error) {
    console.error('Error in sendRefundRejectionEmail:', error);
    return { success: false, error: error.message };
  }
};

// Function to send bulk emails to multiple users
const sendBulkEmail = async (recipients, subject, htmlContent, textContent = null) => {
  try {
    console.log('Attempting to send bulk email to', recipients.length, 'recipients');
    
    // If no text content is provided, generate it from HTML
    if (!textContent) {
      textContent = htmlContent.replace(/<[^>]*>/g, ' ')
                       .replace(/\s+/g, ' ')
                       .trim();
    }
    
    // Prepare the request payload for multiple recipients
    const payload = {
      sender: {
        name: SENDER_NAME,
        email: SENDER_EMAIL
      },
      replyTo: {
        name: 'Rapira Support',
        email: SENDER_EMAIL
      },
      // Add headers for tracking
      headers: {
        'X-Mailin-Tag': 'bulk-email'
      },
      to: recipients.map(recipient => ({
        email: recipient.email,
        name: recipient.name || recipient.email.split('@')[0]
      })),
      subject: subject,
      htmlContent: htmlContent,
      textContent: textContent
    };
    
    // Log the email being sent
    console.log('Sending bulk email to:', recipients.map(r => r.email).join(', '));
    
    // Send the email
    const response = await axios.post(BREVO_API_URL, payload, {
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      }
    });
    
    console.log('Bulk email sent successfully. Response:', response.status, response.statusText);
    return { success: true, data: response.data, method: 'api', recipientCount: recipients.length };
    
  } catch (error) {
    console.error('Error in sendBulkEmail:', error);
    
    if (error.response) {
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
    } else if (error.request) {
      console.error('Error request:', error.request);
    } else {
      console.error('Error message:', error.message);
    }
    
    return { success: false, error: error.message, details: error.response?.data };
  }
};

module.exports = {
  templates,
  sendEmail,
  sendDirectEmail,
  sendWelcomeEmail,
  sendConcertSubmissionEmail,
  sendConcertApprovalEmail,
  sendConcertRejectionEmail,
  sendTicketPurchaseEmail,
  sendTestEmail,
  sendArtistApplicationEmail,
  sendArtistApprovalEmail,
  sendArtistRejectionEmail,
  sendTeamBookingRequestEmail,
  sendTeamBookingApprovalEmail,
  sendTeamBookingRejectionEmail,
  sendRefundApprovalEmail,
  sendRefundRejectionEmail,
  sendBulkEmail
};

/**
 * Send subscription confirmation email
 * @param {Object} user - User object
 * @param {Object} subscription - Subscription object
 * @param {Object} plan - Subscription plan object
 */
const sendSubscriptionConfirmationEmail = async (user, subscription, plan) => {
  try {
    console.log('Attempting to send subscription confirmation email to:', user.email);

    // Format dates
    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    // Calculate days remaining
    const daysRemaining = Math.ceil((new Date(subscription.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));

    // Prepare HTML content for the email
    const htmlContent = `
      <html>
        <body>
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #6366f1; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">Subscription Confirmed!</h1>
            </div>
            <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
              <p>Hello ${user.name || 'Valued Customer'},</p>
              <p>Thank you for subscribing to Rapira! Your subscription has been successfully activated.</p>

              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Subscription Details:</h3>
                <p><strong>Plan:</strong> ${plan.name}</p>
                <p><strong>Price:</strong> ₹${plan.price}</p>
                <p><strong>Purchase Date:</strong> ${formatDate(subscription.purchaseDate)}</p>
                <p><strong>Expiry Date:</strong> ${formatDate(subscription.expiryDate)} (${daysRemaining} days remaining)</p>
                <p><strong>Benefits:</strong> ${plan.benefits}</p>
                ${plan.discountPercentage > 0 ? `<p><strong>Discount:</strong> ${plan.discountPercentage}% off on all ticket purchases</p>` : ''}
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.BASE_URL}/subscriptions/my-subscriptions" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">View My Subscription</a>
              </div>

              <p>You can now enjoy all the benefits of your subscription. If you have any questions or need assistance, please contact our support team.</p>
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

    const subject = `Your Rapira ${plan.name} Subscription is Active`;

    // First try: Use Brevo API directly
    try {
      console.log('Using direct email for subscription confirmation to ensure delivery');

      // Create a direct email payload
      const directEmailPayload = {
        sender: {
          name: SENDER_NAME,
          email: SENDER_EMAIL
        },
        replyTo: {
          name: 'Rapira Support',
          email: SENDER_EMAIL
        },
        // Add headers for tracking
        headers: {
          'X-Mailin-Tag': 'subscription-confirmation'
        },
        to: [{
          email: user.email,
          name: user.name || 'Subscriber'
        }],
        subject: subject,
        htmlContent: htmlContent,
        textContent: `Thank you for subscribing to Rapira! Your ${plan.name} subscription has been successfully activated. Purchase Date: ${formatDate(subscription.purchaseDate)}, Expiry Date: ${formatDate(subscription.expiryDate)} (${daysRemaining} days remaining). Benefits: ${plan.benefits}`
      };

      // Log the email being sent
      console.log('Sending subscription confirmation email to:', user.email);

      // Send direct email
      const response = await axios.post(BREVO_API_URL, directEmailPayload, {
        headers: {
          'accept': 'application/json',
          'api-key': BREVO_API_KEY,
          'content-type': 'application/json'
        }
      });

      console.log('Direct subscription confirmation email sent successfully. Response:', response.status, response.statusText);
      return { success: true, data: response.data, method: 'api' };

    } catch (apiError) {
      // If API fails (e.g., due to IP restrictions), try SMTP fallback
      console.error('API subscription confirmation email failed:', apiError.message);
      console.log('Trying SMTP fallback for subscription confirmation email...');

      // Send using SMTP fallback
      const mailOptions = {
        from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
        to: `"${user.name || 'Subscriber'}" <${user.email}>`,
        replyTo: `"Rapira Support" <${SENDER_EMAIL}>`,
        subject: subject,
        html: htmlContent,
        headers: {
          'X-Mailin-Tag': 'subscription-confirmation-smtp'
        }
      };

      // Send mail with defined transport object
      const info = await transporter.sendMail(mailOptions);

      console.log('SMTP fallback subscription confirmation email sent successfully. Message ID:', info.messageId);
      return { success: true, data: info, method: 'smtp' };
    }

  } catch (error) {
    console.error('Error in sendSubscriptionConfirmationEmail:', error);
    return { success: false, error: error.message };
  }
};

module.exports.sendSubscriptionConfirmationEmail = sendSubscriptionConfirmationEmail;
