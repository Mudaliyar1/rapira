const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const Concert = require('../models/Concert');
const User = require('../models/User');
const { isLoggedIn } = require('../middleware/auth');
const { createOrder, verifyPayment } = require('../utils/paymentService');
const { sendTicketEmail } = require('../utils/brevoEmailService');
const { getActiveSubscription, applyDiscount } = require('../utils/subscriptionService');
const { isConcertPassed } = require('../utils/ticketHelper');
const path = require('path');
const ejs = require('ejs');

// Book free ticket
router.post('/book-free', isLoggedIn, async (req, res) => {
  try {
    const { concertId, quantity, attendees } = req.body;

    // Validate input
    if (!concertId || !quantity || !attendees) {
      console.log('Missing free ticket data:', { concertId, quantity, attendees });
      req.flash('error', 'Invalid booking data');
      return res.redirect(`/concerts/${concertId}`);
    }

    // Log the received data for debugging
    console.log('Received free booking data:', { concertId, quantity, attendees });

    // Find concert
    const concert = await Concert.findById(concertId);

    if (!concert) {
      req.flash('error', 'Concert not found');
      return res.redirect('/concerts');
    }

    // Check if concert is free
    if (concert.isPaid) {
      req.flash('error', 'This is a paid concert');
      return res.redirect(`/concerts/${concertId}`);
    }

    // Check if concert is approved
    if (concert.status !== 'approved') {
      req.flash('error', 'This concert is not available for booking');
      return res.redirect('/concerts');
    }

    // Check if concert date has passed
    if (new Date(concert.date) < new Date()) {
      req.flash('error', 'This concert has already taken place');
      return res.redirect(`/concerts/${concertId}`);
    }

    // Check if tickets are available
    if (concert.maxTickets > 0 && concert.ticketsSold + parseInt(quantity) > concert.maxTickets) {
      req.flash('error', 'Not enough tickets available');
      return res.redirect(`/concerts/${concertId}/book`);
    }

    // Parse attendees data
    let attendeesList = [];
    if (typeof attendees === 'string') {
      // Single attendee
      const [name, age] = attendees.split('|');
      if (name && age) {
        attendeesList.push({ name, age: parseInt(age) });
      }
    } else if (Array.isArray(attendees)) {
      // Multiple attendees
      for (const attendee of attendees) {
        const [name, age] = attendee.split('|');
        if (name && age) {
          attendeesList.push({ name, age: parseInt(age) });
        }
      }
    } else {
      console.log('Unexpected attendees format for free ticket:', attendees);
      req.flash('error', 'Invalid attendee data format');
      return res.redirect(`/concerts/${concertId}/book`);
    }

    // Validate that we have the correct number of attendees
    if (attendeesList.length !== parseInt(quantity)) {
      console.log(`Free ticket attendee count mismatch: ${attendeesList.length} vs ${quantity}`);
      req.flash('error', 'Attendee count does not match ticket quantity');
      return res.redirect(`/concerts/${concertId}/book`);
    }

    // Create ticket
    const newTicket = new Ticket({
      concert: concertId,
      user: req.session.user.id,
      attendees: attendeesList,
      quantity: parseInt(quantity),
      totalAmount: 0, // Free ticket
      paymentStatus: 'completed' // No payment needed
    });

    await newTicket.save();

    // Update concert ticket count
    concert.ticketsSold += parseInt(quantity);
    await concert.save();

    // Send email notification
    try {
      const user = await User.findById(req.session.user.id);
      if (!user) {
        console.error('User not found for ticket email:', req.session.user.id);
      } else {
        console.log('Sending ticket email to:', user.email);

        // Send ticket email
        const emailResult = await sendTicketEmail(user, newTicket, concert);

        if (emailResult.success) {
          console.log('Ticket email sent successfully to:', user.email);
        } else {
          console.error('Failed to send ticket email:', emailResult.error);
        }
      }
    } catch (emailError) {
      console.error('Error sending ticket purchase email:', emailError);
      // Continue with booking even if email fails
    }

    req.flash('success', 'Ticket booked successfully! A confirmation email has been sent to your email address.');
    res.redirect(`/tickets/${newTicket._id}`);
  } catch (error) {
    console.error('Book free ticket error:', error);
    req.flash('error', 'Failed to book ticket');
    res.redirect(`/concerts/${req.body.concertId}/book`);
  }
});

// Create order for paid ticket
router.post('/create-order', isLoggedIn, async (req, res) => {
  try {
    const { concertId, quantity, attendees } = req.body;

    // Validate input
    if (!concertId || !quantity || !attendees) {
      console.log('Missing data:', { concertId, quantity, attendees });
      return res.status(400).json({
        success: false,
        message: 'Invalid booking data',
        details: 'Missing required fields: concertId, quantity, or attendees'
      });
    }

    // Log the received data for debugging
    console.log('Received booking data:', {
      concertId,
      quantity,
      attendeesCount: Array.isArray(attendees) ? attendees.length : 1
    });

    // Find concert
    const concert = await Concert.findById(concertId);

    if (!concert) {
      return res.status(404).json({ success: false, message: 'Concert not found' });
    }

    // Check if concert is paid
    if (!concert.isPaid) {
      return res.status(400).json({ success: false, message: 'This is a free concert' });
    }

    // Check if concert is approved
    if (concert.status !== 'approved') {
      return res.status(400).json({ success: false, message: 'This concert is not available for booking' });
    }

    // Check if concert date has passed
    if (new Date(concert.date) < new Date()) {
      return res.status(400).json({ success: false, message: 'This concert has already taken place' });
    }

    // Check if tickets are available
    if (concert.maxTickets > 0 && concert.ticketsSold + parseInt(quantity) > concert.maxTickets) {
      return res.status(400).json({ success: false, message: 'Not enough tickets available' });
    }

    // Parse attendees data
    let attendeesList = [];
    if (typeof attendees === 'string') {
      // Single attendee
      const [name, age] = attendees.split('|');
      attendeesList.push({ name, age: parseInt(age) });
    } else if (Array.isArray(attendees)) {
      // Multiple attendees
      for (const attendee of attendees) {
        const [name, age] = attendee.split('|');
        if (name && age) {
          attendeesList.push({ name, age: parseInt(age) });
        }
      }
    } else {
      console.log('Unexpected attendees format:', attendees);
      return res.status(400).json({ success: false, message: 'Invalid attendee data format' });
    }

    // Validate that we have the correct number of attendees
    if (attendeesList.length !== parseInt(quantity)) {
      console.log(`Attendee count mismatch: ${attendeesList.length} vs ${quantity}`);
      return res.status(400).json({
        success: false,
        message: 'Attendee count does not match ticket quantity',
        details: `Expected ${quantity} attendees but received ${attendeesList.length}`
      });
    }

    // Check if user has an active subscription and apply discount if applicable
    let originalAmount = concert.price * parseInt(quantity);
    let totalAmount = originalAmount;
    let discountApplied = false;
    let discountPercentage = 0;
    let discountType = 'none';

    // Get active subscription for the user
    const activeSubscription = await getActiveSubscription(req.session.user.id);

    if (activeSubscription && activeSubscription.plan && activeSubscription.plan.discountPercentage > 0) {
      // Apply subscription discount
      discountPercentage = activeSubscription.plan.discountPercentage;
      totalAmount = applyDiscount(originalAmount, activeSubscription);
      discountApplied = true;
      discountType = 'subscription';

      console.log(`Applied subscription discount: ${discountPercentage}% - Original: ${originalAmount}, Discounted: ${totalAmount}`);
    }
    
    // Get website settings for ticket commission
    const WebsiteSettings = require('../models/WebsiteSettings');
    const settings = await WebsiteSettings.getSettings();
    const ticketCommissionEnabled = settings.ticketCommissionSettings?.enabled || false;
    const ticketCommissionPercentage = settings.ticketCommissionSettings?.percentage || 0;
    
    // Apply commission if enabled
    if (ticketCommissionEnabled) {
      const commissionAmount = (totalAmount * ticketCommissionPercentage) / 100;
      totalAmount = totalAmount + commissionAmount;
      console.log(`Applied ticket commission: ${ticketCommissionPercentage}% - Commission: ${commissionAmount}, Total: ${totalAmount}`);
    }

    // Create temporary ticket
    const tempTicket = new Ticket({
      concert: concertId,
      user: req.session.user.id,
      attendees: attendeesList,
      quantity: parseInt(quantity),
      totalAmount,
      originalAmount: discountApplied ? originalAmount : undefined,
      discountApplied,
      discountPercentage,
      discountType,
      commissionApplied: ticketCommissionEnabled,
      commissionPercentage: ticketCommissionPercentage,
      commissionAmount: ticketCommissionEnabled ? (originalAmount * ticketCommissionPercentage) / 100 : 0,
      paymentStatus: 'pending'
    });

    await tempTicket.save();

    // Check if Razorpay API keys are configured
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      console.error('Razorpay API keys are not configured');

      // Update ticket to indicate payment gateway issue
      tempTicket.notes = 'Payment gateway configuration issue';
      await tempTicket.save();

      return res.status(503).json({
        success: false,
        message: 'Payment service is currently unavailable',
        errorType: 'CONFIGURATION_ERROR',
        ticket: tempTicket._id
      });
    }

    // Ensure minimum amount is at least 1 rupee (Razorpay requirement)
    let finalAmount = totalAmount;
    let paymentAmount = totalAmount;
    if (finalAmount < 1) {
      console.log(`Amount ${finalAmount} is less than minimum 1 rupee, setting to minimum 1 rupee for payment`);
      finalAmount = 1;
    }

    // Create Razorpay order with timeout
    console.log('Creating order with amount:', finalAmount);

    // Set a timeout for the Razorpay API call
    const orderPromise = createOrder({
      amount: finalAmount,
      receipt: tempTicket._id.toString(),
      notes: {
        concertId: concertId,
        userId: req.session.user.id,
        quantity: quantity,
        originalAmount: paymentAmount // Store the original amount for reference
      }
    });

    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Payment gateway timeout')), 15000); // 15 second timeout
    });

    // Race the order creation against the timeout
    const orderResult = await Promise.race([orderPromise, timeoutPromise])
      .catch(error => {
        console.error('Order creation error or timeout:', error);
        return {
          success: false,
          error: error.message || 'Payment gateway timeout',
          code: 'TIMEOUT'
        };
      });

    console.log('Order result:', orderResult);

    if (!orderResult.success) {
      // Update ticket with error information
      tempTicket.notes = `Payment order creation failed: ${orderResult.error || 'Unknown error'}`;
      await tempTicket.save();

      // Return detailed error information
      return res.status(503).json({
        success: false,
        message: 'Failed to create payment order',
        errorType: orderResult.code || 'PAYMENT_GATEWAY_ERROR',
        details: orderResult.error || 'Unknown payment gateway error',
        ticket: tempTicket._id
      });
    }

    // Update ticket with order ID
    tempTicket.orderId = orderResult.data.id;
    await tempTicket.save();

    // Return order details
    res.json({
      success: true,
      order: orderResult.data,
      ticket: tempTicket._id,
      key: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Create order error:', error);

    // Provide more detailed error information
    let errorMessage = 'Failed to create order';
    let errorType = 'SERVER_ERROR';

    if (error.name === 'ValidationError') {
      errorMessage = 'Invalid data provided';
      errorType = 'VALIDATION_ERROR';
    } else if (error.name === 'MongoError' || error.name === 'MongoServerError') {
      errorMessage = 'Database error';
      errorType = 'DATABASE_ERROR';
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      errorMessage = 'Payment gateway connection failed';
      errorType = 'NETWORK_ERROR';
    }

    res.status(500).json({
      success: false,
      message: errorMessage,
      errorType: errorType,
      details: error.message
    });
  }
});

// Verify payment
router.post('/verify-payment', isLoggedIn, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      ticket_id,
      is_mock_payment
    } = req.body;

    // Log payment verification attempt
    console.log('Payment verification attempt:', {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      ticketId: ticket_id,
      isMockPayment: is_mock_payment === 'true'
    });

    // Always verify the payment signature
    const verificationResult = verifyPayment({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature
    });

    // Check verification result
    if (!verificationResult.success) {
      console.error('Payment verification failed:', verificationResult);
      req.flash('error', 'Payment verification failed');
      return res.redirect(`/concerts`);
    }

    // Find and update ticket
    const ticket = await Ticket.findById(ticket_id);

    if (!ticket) {
      console.error('Ticket not found:', ticket_id);
      req.flash('error', 'Ticket not found');
      return res.redirect('/concerts');
    }

    // Update ticket payment details
    ticket.paymentId = razorpay_payment_id;
    ticket.paymentStatus = 'completed';

    await ticket.save();
    console.log('Ticket updated with payment details:', {
      ticketId: ticket._id,
      paymentId: ticket.paymentId,
      status: ticket.paymentStatus
    });

    // Update concert ticket count
    const concert = await Concert.findById(ticket.concert);
    if (!concert) {
      console.error('Concert not found for ticket:', ticket.concert);
      req.flash('error', 'Concert information not found');
      return res.redirect('/concerts');
    }

    concert.ticketsSold += ticket.quantity;
    await concert.save();
    console.log('Concert ticket count updated:', {
      concertId: concert._id,
      ticketsSold: concert.ticketsSold
    });

    // Send email notification
    try {
      const user = await User.findById(req.session.user.id);
      if (!user) {
        console.error('User not found for paid ticket email:', req.session.user.id);
      } else {
        console.log('Sending paid ticket email to:', user.email);

        // Send ticket email
        const emailResult = await sendTicketEmail(user, ticket, concert);

        if (emailResult.success) {
          console.log('Paid ticket email sent successfully to:', user.email);
        } else {
          console.error('Failed to send paid ticket email:', emailResult.error);
        }
      }
    } catch (emailError) {
      console.error('Error sending paid ticket purchase email:', emailError);
      // Continue with booking even if email fails
    }

    // Set success message
    req.flash('success', 'Payment successful! Ticket booked. A confirmation email has been sent to your email address.');

    res.redirect(`/tickets/${ticket._id}`);
  } catch (error) {
    console.error('Verify payment error:', error);
    req.flash('error', 'Payment verification failed: ' + (error.message || 'Unknown error'));
    res.redirect('/concerts');
  }
});

// View ticket
router.get('/:id', isLoggedIn, async (req, res) => {
  try {
    // Validate if the ID is a valid MongoDB ObjectId
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      req.flash('error', 'Invalid ticket ID');
      return res.redirect('/tickets');
    }

    const ticket = await Ticket.findById(req.params.id)
      .populate('user');

    if (!ticket) {
      req.flash('error', 'Ticket not found');
      return res.redirect('/users/profile');
    }

    // Manually populate concert and venue to ensure all data is loaded
    const Concert = require('../models/Concert');
    const Venue = require('../models/Venue');
    
    const concert = await Concert.findById(ticket.concert).populate('venue');
    if (!concert) {
      req.flash('error', 'Concert not found');
      return res.redirect('/users/profile');
    }
    
    // Replace the ticket's concert with the fully populated concert
    ticket.concert = concert;

    // Check if user owns the ticket or is admin
    if (ticket.user._id.toString() !== req.session.user.id && req.session.user.role !== 'admin') {
      req.flash('error', 'You do not have permission to view this ticket');
      return res.redirect('/users/profile');
    }

    // Check if the ticket is completed
    if (ticket.paymentStatus !== 'completed' && req.session.user.role !== 'admin') {
      req.flash('error', 'This ticket is not yet confirmed');
      return res.redirect('/users/profile');
    }

    // Check if concert exists and handle deleted concerts
    let isDeletedConcert = false;

    if (ticket.concert) {
      // Concert is already populated with venue from our manual population above
      // Just populate artist details if needed
      if (!ticket.concert.artist || !ticket.concert.artist.user) {
        const Concert = require('../models/Concert');
        const concertWithArtist = await Concert.findById(ticket.concert._id)
          .populate({
            path: 'artist',
            populate: { path: 'user', select: 'name' }
          });
        if (concertWithArtist) {
          ticket.concert.artist = concertWithArtist.artist;
        }
      }

      if (!ticket.concert) {
        isDeletedConcert = true;
      }
    } else {
      isDeletedConcert = true;
    }

    // Check if there's a refund request for this ticket
    const RefundRequest = require('../models/RefundRequest');
    const refundRequest = await RefundRequest.findOne({ ticket: ticket._id });
    
    // Check if concert date has passed
    const isPastConcert = ticket.concert && isConcertPassed(ticket.concert.date, ticket.concert.time);

    res.render('tickets/show', {
      ticket,
      concert: ticket.concert,
      isDeletedConcert,
      refundRequest,
      isPastConcert
    });
  } catch (error) {
    console.error('View ticket error:', error);
    req.flash('error', 'Failed to load ticket');
    res.redirect('/users/profile');
  }
});

// Cancel payment
router.get('/cancel-payment/:id', isLoggedIn, async (req, res) => {
  try {
    const ticketId = req.params.id;

    // Find the ticket
    const ticket = await Ticket.findById(ticketId);

    if (!ticket) {
      req.flash('error', 'Ticket not found');
      return res.redirect('/concerts');
    }

    // Check if the ticket belongs to the current user
    if (ticket.user.toString() !== req.session.user.id) {
      req.flash('error', 'You do not have permission to cancel this payment');
      return res.redirect('/concerts');
    }

    // Check if the ticket is still pending
    if (ticket.paymentStatus !== 'pending') {
      req.flash('error', 'This payment cannot be cancelled');
      return res.redirect('/concerts');
    }

    // Delete the ticket
    await Ticket.findByIdAndDelete(ticketId);

    req.flash('info', 'Payment cancelled');
    res.redirect('/concerts');
  } catch (error) {
    console.error('Cancel payment error:', error);
    req.flash('error', 'Failed to cancel payment');
    res.redirect('/concerts');
  }
});

// Download ticket as PDF (redirects to HTML version for now)
router.get('/:id/download', isLoggedIn, async (req, res) => {
  try {
    // Redirect to HTML version since PDF generation requires puppeteer
    return res.redirect(`/tickets/${req.params.id}/download-html`);
  } catch (error) {
    console.error('Download ticket error:', error);
    req.flash('error', 'Failed to generate ticket PDF');
    res.redirect(`/tickets/${req.params.id}`);
  }
});

// Download ticket as HTML
router.get('/:id/download-html', isLoggedIn, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate({
        path: 'concert',
        populate: { path: 'venue' }
      })
      .populate('user');

    if (!ticket) {
      req.flash('error', 'Ticket not found');
      return res.redirect('/users/profile');
    }

    // Check if user owns the ticket or is admin
    if (ticket.user._id.toString() !== req.session.user.id && req.session.user.role !== 'admin') {
      req.flash('error', 'You do not have permission to download this ticket');
      return res.redirect('/users/profile');
    }

    // Check if concert exists and handle deleted concerts
    let concert = ticket.concert;
    let isDeletedConcert = false;

    if (!concert) {
      isDeletedConcert = true;
    }

    // Check if there's a refund request for this ticket
    const RefundRequest = require('../models/RefundRequest');
    const refundRequest = await RefundRequest.findOne({ ticket: ticket._id });

    // Render the ticket template with wrapper to HTML
    const ticketHtml = await ejs.renderFile(
      path.join(__dirname, '../views/tickets/html-template-wrapper.ejs'),
      { ticket, concert, isDeletedConcert, refundRequest, downloadMode: true }
    );

    // Set response headers
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename=Rapira_Ticket_${ticket._id}.html`);

    // Send the HTML
    res.send(ticketHtml);

  } catch (error) {
    console.error('Download HTML ticket error:', error);
    req.flash('error', 'Failed to generate ticket HTML');
    res.redirect(`/tickets/${req.params.id}`);
  }
});

// List user tickets
router.get('/', isLoggedIn, async (req, res) => {
  try {
    console.log('Tickets request received from user:', req.session.user.id);
    console.log('Headers:', req.headers);

    // Only show completed tickets
    const tickets = await Ticket.find({
      user: req.session.user.id,
      paymentStatus: 'completed'
    })
      .sort({ createdAt: -1 })
      .populate({
        path: 'concert',
        populate: { path: 'venue' }
      });

    console.log('Tickets found in database:', tickets.length);

    // Check if the request wants JSON (from profile page AJAX)
    // More reliable check for JSON request
    const wantsJson =
      req.xhr ||
      (req.headers.accept && req.headers.accept.indexOf('application/json') > -1) ||
      (req.query.format === 'json');

    if (wantsJson) {
      // Format tickets for JSON response
      const formattedTickets = tickets.map(ticket => {
        const isPast = ticket.concert && isConcertPassed(ticket.concert.date, ticket.concert.time);
        return {
          id: ticket._id,
          concertTitle: ticket.concert ? ticket.concert.title : 'Concert Unavailable',
          concertDate: ticket.concert ? ticket.concert.date : null,
          venue: ticket.concert ? ticket.concert.venue : 'N/A',
          quantity: ticket.quantity,
          status: ticket.paymentStatus,
          isPastConcert: isPast
        };
      });

      // Add debug log
      console.log('Returning JSON tickets data:', formattedTickets.length, 'tickets found');

      // Set proper content type header
      res.setHeader('Content-Type', 'application/json');
      return res.json({ tickets: formattedTickets });
    }

    // Regular page request
    console.log('Rendering tickets/index view');
    
    // Add isPastConcert property to each ticket
    const ticketsWithPastStatus = tickets.map(ticket => {
      const isPast = ticket.concert && isConcertPassed(ticket.concert.date, ticket.concert.time);
      return {
        ...ticket.toObject(),
        isPastConcert: isPast
      };
    });
    
    res.render('tickets/index', { tickets: ticketsWithPastStatus });
  } catch (error) {
    console.error('List tickets error:', error);
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
      return res.status(500).json({ error: 'Failed to load tickets', message: error.message });
    }
    req.flash('error', 'Failed to load tickets');
    res.redirect('/users/profile');
  }
});

// Show delete confirmation page for a ticket
router.get('/:id/delete', isLoggedIn, async (req, res) => {
  try {
    // Validate if the ID is a valid MongoDB ObjectId
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      req.flash('error', 'Invalid ticket ID');
      return res.redirect('/tickets');
    }

    const ticket = await Ticket.findById(req.params.id)
      .populate('user')
      .populate({
        path: 'concert',
        populate: { path: 'venue' }
      });

    if (!ticket) {
      req.flash('error', 'Ticket not found');
      return res.redirect('/tickets');
    }

    // Check if user owns the ticket
    if (ticket.user._id.toString() !== req.session.user.id) {
      req.flash('error', 'You do not have permission to delete this ticket');
      return res.redirect('/tickets');
    }

    // Check if the concert date has passed
    const isPastConcert = ticket.concert && isConcertPassed(ticket.concert.date, ticket.concert.time);
    if (!isPastConcert) {
      req.flash('error', 'You can only delete tickets for past concerts');
      return res.redirect('/tickets');
    }

    // Check if the ticket is completed
    if (ticket.paymentStatus !== 'completed') {
      req.flash('error', 'Only completed tickets can be deleted');
      return res.redirect('/tickets');
    }

    res.render('tickets/delete-confirmation', { ticket });
  } catch (error) {
    console.error('Delete confirmation page error:', error);
    req.flash('error', 'Failed to load delete confirmation page');
    res.redirect('/tickets');
  }
});

// Delete a ticket
router.post('/:id/delete', isLoggedIn, async (req, res) => {
  try {
    // Validate if the ID is a valid MongoDB ObjectId
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      req.flash('error', 'Invalid ticket ID');
      return res.redirect('/tickets');
    }

    const ticket = await Ticket.findById(req.params.id)
      .populate('user')
      .populate({
        path: 'concert',
        populate: { path: 'venue' }
      });

    if (!ticket) {
      req.flash('error', 'Ticket not found');
      return res.redirect('/tickets');
    }

    // Check if user owns the ticket
    if (ticket.user._id.toString() !== req.session.user.id) {
      req.flash('error', 'You do not have permission to delete this ticket');
      return res.redirect('/tickets');
    }

    // Check if the concert date has passed
    const isPastConcert = ticket.concert && isConcertPassed(ticket.concert.date, ticket.concert.time);
    if (!isPastConcert) {
      req.flash('error', 'You can only delete tickets for past concerts');
      return res.redirect('/tickets');
    }

    // Check if the ticket is completed
    if (ticket.paymentStatus !== 'completed') {
      req.flash('error', 'Only completed tickets can be deleted');
      return res.redirect('/tickets');
    }

    // Delete the ticket
    await Ticket.findByIdAndDelete(req.params.id);

    req.flash('success', 'Ticket deleted successfully');
    res.redirect('/tickets');
  } catch (error) {
    console.error('Delete ticket error:', error);
    req.flash('error', 'Failed to delete ticket');
    res.redirect('/tickets');
  }
});

module.exports = router;
