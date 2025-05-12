const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const Concert = require('../models/Concert');
const User = require('../models/User');
const { isLoggedIn } = require('../middleware/auth');
const { createOrder, verifyPayment } = require('../utils/paymentService');
const { sendTicketEmail } = require('../utils/brevoEmailService');
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
      return res.status(400).json({ success: false, message: 'Invalid booking data' });
    }

    // Log the received data for debugging
    console.log('Received booking data:', { concertId, quantity, attendees });

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
      return res.status(400).json({ success: false, message: 'Attendee count does not match ticket quantity' });
    }

    // Calculate total amount
    const totalAmount = concert.price * parseInt(quantity);

    // Create temporary ticket
    const tempTicket = new Ticket({
      concert: concertId,
      user: req.session.user.id,
      attendees: attendeesList,
      quantity: parseInt(quantity),
      totalAmount,
      paymentStatus: 'pending'
    });

    await tempTicket.save();

    // Create Razorpay order
    console.log('Creating order with amount:', totalAmount);
    const orderResult = await createOrder({
      amount: totalAmount,
      receipt: tempTicket._id.toString(),
      notes: {
        concertId: concertId,
        userId: req.session.user.id,
        quantity: quantity
      }
    });

    console.log('Order result:', orderResult);

    if (!orderResult.success) {
      return res.status(500).json({ success: false, message: 'Failed to create payment order' });
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
    res.status(500).json({ success: false, message: 'Failed to create order' });
  }
});

// Verify payment
router.post('/verify-payment', isLoggedIn, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, ticket_id } = req.body;

    // Verify payment signature
    const verificationResult = verifyPayment({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature
    });

    if (!verificationResult.success) {
      req.flash('error', 'Payment verification failed');
      return res.redirect(`/concerts`);
    }

    // Find and update ticket
    const ticket = await Ticket.findById(ticket_id);

    if (!ticket) {
      req.flash('error', 'Ticket not found');
      return res.redirect('/concerts');
    }

    // Update ticket payment details
    ticket.paymentId = razorpay_payment_id;
    ticket.paymentStatus = 'completed';
    await ticket.save();

    // Update concert ticket count
    const concert = await Concert.findById(ticket.concert);
    concert.ticketsSold += ticket.quantity;
    await concert.save();

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

    req.flash('success', 'Payment successful! Ticket booked. A confirmation email has been sent to your email address.');
    res.redirect(`/tickets/${ticket._id}`);
  } catch (error) {
    console.error('Verify payment error:', error);
    req.flash('error', 'Payment verification failed');
    res.redirect('/concerts');
  }
});

// View ticket
router.get('/:id', isLoggedIn, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('concert')
      .populate('user');

    if (!ticket) {
      req.flash('error', 'Ticket not found');
      return res.redirect('/users/profile');
    }

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
    let concert = null;
    let isDeletedConcert = false;

    if (ticket.concert) {
      // Get artist details if concert exists
      concert = await Concert.findById(ticket.concert._id)
        .populate({
          path: 'artist',
          populate: { path: 'user', select: 'name' }
        });

      if (!concert) {
        isDeletedConcert = true;
      }
    } else {
      isDeletedConcert = true;
    }

    res.render('tickets/show', { ticket, concert, isDeletedConcert });
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
      .populate('concert')
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
    let concert = null;
    let isDeletedConcert = false;

    if (ticket.concert) {
      concert = await Concert.findById(ticket.concert._id);
      if (!concert) {
        isDeletedConcert = true;
      }
    } else {
      isDeletedConcert = true;
    }

    // Render the ticket template to HTML
    const ticketHtml = await ejs.renderFile(
      path.join(__dirname, '../views/tickets/html-template.ejs'),
      { ticket, concert, isDeletedConcert }
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
      .populate('concert');

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
        return {
          id: ticket._id,
          concertTitle: ticket.concert ? ticket.concert.title : 'Concert Unavailable',
          concertDate: ticket.concert ? ticket.concert.date : null,
          venue: ticket.concert ? ticket.concert.venue : 'N/A',
          quantity: ticket.quantity,
          status: ticket.paymentStatus
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
    res.render('tickets/index', { tickets });
  } catch (error) {
    console.error('List tickets error:', error);
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
      return res.status(500).json({ error: 'Failed to load tickets', message: error.message });
    }
    req.flash('error', 'Failed to load tickets');
    res.redirect('/users/profile');
  }
});

module.exports = router;
