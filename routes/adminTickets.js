const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const Concert = require('../models/Concert');
const User = require('../models/User');
const { isLoggedIn, isAdmin } = require('../middleware/auth');
const { sendTicketEmail } = require('../utils/brevoEmailService');

// Get all concerts for the admin ticket purchase form
router.get('/free-issue', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get all approved concerts
    const concerts = await Concert.find({ status: 'approved' })
      .sort({ date: 1 })
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name' }
      });

    // Add ticket availability information to each concert
    const concertsWithAvailability = concerts.map(concert => {
      const concertObj = concert.toObject();
      
      // Calculate ticket availability
      if (concert.maxTickets > 0) {
        const remainingTickets = concert.maxTickets - concert.ticketsSold;
        concertObj.ticketsRemaining = remainingTickets;
        concertObj.isSoldOut = remainingTickets === 0;
        concertObj.isLowAvailability = remainingTickets > 0 && remainingTickets <= 5;
        concertObj.displayText = `${remainingTickets} remaining`;
        concertObj.statusClass = remainingTickets === 0 ? 'text-danger' : 
                               remainingTickets <= 5 ? 'text-warning' : 'text-success';
      } else {
        concertObj.ticketsRemaining = -1; // Indicates unlimited
        concertObj.isSoldOut = false;
        concertObj.isLowAvailability = false;
        concertObj.displayText = 'Unlimited tickets';
        concertObj.statusClass = 'text-success';
      }
      
      return concertObj;
    });

    res.render('admin/tickets/free-purchase', {
      layout: 'admin',
      currentPath: '/admin/tickets/free-issue',
      title: 'Free Ticket Purchase',
      concerts: concertsWithAvailability
    });
  } catch (error) {
    console.error('Admin free ticket purchase form error:', error);
    req.flash('error', 'Failed to load ticket purchase form');
    res.redirect('/admin');
  }
});

// Handle admin free ticket purchase
router.post('/free-issue', isLoggedIn, isAdmin, async (req, res) => {
  try {
    console.log('Free ticket purchase request received:', req.body);
    
    const { concertId, userId, quantity, attendees } = req.body;

    // Validate input
    if (!concertId || !userId || !quantity || !attendees) {
      console.log('Missing required fields:', { concertId, userId, quantity, attendees });
      req.flash('error', 'All fields are required');
      return res.redirect('/admin/tickets/free-issue');
    }
    
    console.log('Processing free ticket request with data:', { concertId, userId, quantity, attendees });

    // Find concert
    console.log('Looking up concert by ID:', concertId);
    const concert = await Concert.findById(concertId);
    console.log('Concert lookup result:', concert);
    if (!concert) {
      req.flash('error', 'Concert not found');
      return res.redirect('/admin/tickets/free-issue');
    }

    // Check if concert is approved
    if (concert.status !== 'approved') {
      req.flash('error', 'This concert is not available for booking');
      return res.redirect('/admin/tickets/free-issue');
    }

    // Check if concert date has passed
    if (new Date(concert.date) < new Date()) {
      req.flash('error', 'This concert has already taken place');
      return res.redirect('/admin/tickets/free-issue');
    }

    // Check if tickets are available
    const requestedQuantity = parseInt(quantity);
    if (concert.maxTickets > 0 && concert.ticketsSold + requestedQuantity > concert.maxTickets) {
      const remainingTickets = concert.maxTickets - concert.ticketsSold;
      req.flash('error', `Not enough tickets available. Only ${remainingTickets} ticket(s) remaining.`);
      return res.redirect('/admin/tickets/free-issue');
    }

    // Find user by email
    console.log('Looking up user by email:', userId);
    const user = await User.findOne({ email: userId });
    console.log('User lookup result:', user);
    if (!user) {
      req.flash('error', 'User not found with that email address');
      return res.redirect('/admin/tickets/free-issue');
    }

    // Parse attendees data
    let attendeesList = [];
    console.log('Parsing attendees data:', attendees);
    if (typeof attendees === 'string') {
      // Handle comma-separated format: "name|age,name|age"
      console.log('Processing string format attendees');
      const attendeePairs = attendees.split(',').filter(pair => pair.trim() !== '');
      console.log('Attendee pairs:', attendeePairs);
      for (const pair of attendeePairs) {
        const [name, age] = pair.split('|');
        console.log('Processing pair:', { name, age });
        if (name && age && name.trim() !== '' && !isNaN(parseInt(age))) {
          attendeesList.push({ name: name.trim(), age: parseInt(age) });
        }
      }
    } else if (Array.isArray(attendees)) {
      // Handle array format: ["name|age", "name|age"]
      console.log('Processing array format attendees');
      for (const attendee of attendees) {
        const [name, age] = attendee.split('|');
        if (name && age && name.trim() !== '' && !isNaN(parseInt(age))) {
          attendeesList.push({ name: name.trim(), age: parseInt(age) });
        }
      }
    } else {
      console.log('Invalid attendee data format:', typeof attendees, attendees);
      req.flash('error', 'Invalid attendee data format');
      return res.redirect('/admin/tickets/free-issue');
    }
    
    console.log('Parsed attendees list:', attendeesList);
    
    // Validate that we have the correct number of attendees
    if (attendeesList.length !== requestedQuantity) {
      console.log('Attendee count mismatch:', { attendeesListLength: attendeesList.length, requestedQuantity });
      req.flash('error', 'Attendee count does not match ticket quantity');
      return res.redirect('/admin/tickets/free-issue');
    }

    // Create ticket
    console.log('Creating ticket with data:', {
      concert: concertId,
      user: user._id,
      attendees: attendeesList,
      quantity: requestedQuantity,
      totalAmount: 0,
      paymentId: 'ADMIN_FREE_TICKET',
      paymentStatus: 'completed',
      orderId: 'ADMIN_FREE_ORDER'
    });
    
    const newTicket = new Ticket({
      concert: concertId,
      user: user._id, // Use user ID, not email
      attendees: attendeesList,
      quantity: requestedQuantity,
      totalAmount: 0, // Free ticket
      paymentId: 'ADMIN_FREE_TICKET',
      paymentStatus: 'completed', // No payment needed
      orderId: 'ADMIN_FREE_ORDER'
    });

    await newTicket.save();
    console.log('Ticket created successfully:', newTicket._id);

    // Update concert ticket count
    concert.ticketsSold += requestedQuantity;
    await concert.save();

    // Send email notification to user
    try {
      const emailResult = await sendTicketEmail(user, newTicket, concert);

      if (emailResult.success) {
        console.log('Ticket email sent successfully to:', user.email);
      } else {
        console.error('Failed to send ticket email:', emailResult.error);
      }
    } catch (emailError) {
      console.error('Error sending ticket purchase email:', emailError);
      // Continue with booking even if email fails
    }

    req.flash('success', `Free ticket booked successfully for ${user.name}! A confirmation email has been sent to their email address.`);
    res.redirect('/admin/tickets/free-issue');
  } catch (error) {
    console.error('Admin free ticket purchase error:', error);
    req.flash('error', 'Failed to book free ticket');
    res.redirect('/admin/tickets/free-issue');
  }
});

module.exports = router;