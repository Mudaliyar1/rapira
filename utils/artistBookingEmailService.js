const axios = require('axios');

// Brevo API configuration
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

// IMPORTANT: This email must be verified in your Brevo account
const SENDER_EMAIL = 'vijaymudaliyar224@gmail.com';
const SENDER_NAME = 'Rapira Music Platform';

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
        name: SENDER_NAME,
        email: SENDER_EMAIL
      },
      replyTo: {
        name: 'Rapira Support',
        email: SENDER_EMAIL
      },
      // Add headers for tracking
      headers: {
        'X-Mailin-Tag': 'artist-booking-request'
      },
      to: recipients,
      subject: subject,
      htmlContent: htmlContent,
      textContent: `New ${request.bookingType === 'artist' ? 'artist' : 'role'} booking request from ${request.name} for ${bookingName}. Event Date: ${eventDate}, Location: ${request.eventCity}, ${request.eventState}. Contact: ${request.email}, ${request.phone}. Notes: ${request.notes || 'None'}`
    };

    // Log the email being sent
    console.log('Sending artist booking request notification to all admins:', recipients.map(r => r.email).join(', '));

    // Send direct email
    const response = await axios.post(BREVO_API_URL, directEmailPayload, {
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      }
    });

    console.log('Artist booking request email sent successfully. Response:', response.status, response.statusText);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error sending artist booking request email:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send an artist booking approval email to the requester
 * @param {Object} request - The booking request object
 * @returns {Promise} - A promise that resolves when the email is sent
 */
const sendArtistBookingApprovalEmail = async (request) => {
  try {
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
          .success-banner { background-color: #4CAF50; color: white; padding: 10px; text-align: center; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Booking Request Approved</h2>
          </div>
          <div class="content">
            <div class="success-banner">
              <h3>Good News! Your booking request has been approved.</h3>
            </div>
            
            <p>Dear ${request.name},</p>
            
            <p>We're pleased to inform you that your booking request has been approved. Our team will be in touch with you shortly to discuss the next steps.</p>
            
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
                <tr>
                  <td>Event Date:</td>
                  <td>${eventDate}</td>
                </tr>
                <tr>
                  <td>Event Location:</td>
                  <td>${request.eventCity}, ${request.eventState}</td>
                </tr>
              </table>
            </div>
            
            <p>If you have any questions or need to make changes to your booking, please contact us at support@rapira.com.</p>
            
            <p>Thank you for choosing Rapira!</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Rapira Music Platform. All rights reserved.</p>
            <p>This is an automated email. Please do not reply to this message.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const subject = `Your Booking Request for ${bookingName} has been Approved`;

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
        'X-Mailin-Tag': 'artist-booking-approval'
      },
      to: [{
        email: request.email,
        name: request.name
      }],
      subject: subject,
      htmlContent: htmlContent,
      textContent: `Good news! Your booking request for ${bookingName} has been approved. Event Date: ${eventDate}, Location: ${request.eventCity}, ${request.eventState}. Our team will be in touch with you shortly to discuss the next steps. Thank you for choosing Rapira!`
    };

    // Log the email being sent
    console.log('Sending artist booking approval email to:', request.email);

    // Send direct email
    const response = await axios.post(BREVO_API_URL, directEmailPayload, {
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      }
    });

    console.log('Artist booking approval email sent successfully. Response:', response.status, response.statusText);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error sending artist booking approval email:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send an artist booking rejection email to the requester
 * @param {Object} request - The booking request object
 * @returns {Promise} - A promise that resolves when the email is sent
 */
const sendArtistBookingRejectionEmail = async (request) => {
  try {
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
          .note-box { background-color: #f5f5f5; padding: 15px; border-left: 4px solid #4a148c; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Booking Request Update</h2>
          </div>
          <div class="content">
            <p>Dear ${request.name},</p>
            
            <p>Thank you for your interest in booking through Rapira. After careful consideration, we regret to inform you that we are unable to fulfill your booking request at this time.</p>
            
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
                  <td>Event Date:</td>
                  <td>${eventDate}</td>
                </tr>
                <tr>
                  <td>Event Location:</td>
                  <td>${request.eventCity}, ${request.eventState}</td>
                </tr>
              </table>
            </div>
            
            <div class="note-box">
              <h4>Reason for Rejection:</h4>
              <p>${request.adminNotes || 'The requested artist/role is not available for the specified date and location.'}</p>
            </div>
            
            <p>We encourage you to explore other artists and roles available on our platform that might better suit your needs.</p>
            
            <p style="text-align: center;">
              <a href="${process.env.BASE_URL || 'http://localhost:3000'}/find-my-artist" class="button">Explore More Options</a>
            </p>
            
            <p>If you have any questions or would like to discuss alternative options, please don't hesitate to contact us.</p>
            
            <p>Thank you for your understanding.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Rapira Music Platform. All rights reserved.</p>
            <p>This is an automated email. Please do not reply to this message.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const subject = `Update on Your Booking Request for ${bookingName}`;

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
        'X-Mailin-Tag': 'artist-booking-rejection'
      },
      to: [{
        email: request.email,
        name: request.name
      }],
      subject: subject,
      htmlContent: htmlContent,
      textContent: `Dear ${request.name}, Thank you for your interest in booking through Rapira. After careful consideration, we regret to inform you that we are unable to fulfill your booking request for ${bookingName} at this time. Reason: ${request.adminNotes || 'The requested artist/role is not available for the specified date and location.'} We encourage you to explore other artists and roles available on our platform that might better suit your needs. Thank you for your understanding.`
    };

    // Log the email being sent
    console.log('Sending artist booking rejection email to:', request.email);

    // Send direct email
    const response = await axios.post(BREVO_API_URL, directEmailPayload, {
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      }
    });

    console.log('Artist booking rejection email sent successfully. Response:', response.status, response.statusText);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error sending artist booking rejection email:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendArtistBookingRequestEmail,
  sendArtistBookingApprovalEmail,
  sendArtistBookingRejectionEmail
};
