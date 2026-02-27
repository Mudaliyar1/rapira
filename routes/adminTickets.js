const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const Concert = require('../models/Concert');
const User = require('../models/User');
const { isLoggedIn, isAdmin, hasAdminPermission } = require('../middleware/auth');
const { sendTicketEmail } = require('../utils/brevoEmailService');

// Get all concerts for the admin ticket purchase form
router.get('/free-issue', isLoggedIn, hasAdminPermission('manage_free_ticket_issue'), async (req, res) => {
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
router.post('/free-issue', isLoggedIn, hasAdminPermission('manage_free_ticket_issue'), async (req, res) => {
  try {
    console.log('Free ticket purchase request received:', req.body);

    const { concertId, userId, quantity, attendees, ages } = req.body;

    // Validate input
    if (!concertId || !userId || !quantity || (!attendees && !ages)) {
      console.log('Missing required fields:', { concertId, userId, quantity, attendees, ages });
      req.flash('error', 'All fields are required');
      return res.redirect('/admin/tickets/free-issue');
    }

    console.log('Processing free ticket request with data:', { concertId, userId, quantity, attendees, ages });

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

    // For admin free ticket issuance, we only need quantity
    // The attendees data from the form is not required for validation
    // We'll create a generic attendee list based on the quantity
    let attendeesList = [];

    // If specific attendee data was provided, use it; otherwise create generic entries
    if (attendees && ages) {
      console.log('Processing attendees data:', { attendees, ages });

      // Handle the case where we have separate attendees and ages arrays
      if ((Array.isArray(attendees) && Array.isArray(ages)) ||
        (typeof attendees === 'string' && typeof ages === 'string')) {

        // Convert to arrays if they're strings
        const attendeesArray = Array.isArray(attendees) ? attendees : [attendees];
        const agesArray = Array.isArray(ages) ? ages : [ages];

        console.log('Attendees array:', attendeesArray);
        console.log('Ages array:', agesArray);

        // Make sure we have the same number of attendees and ages
        if (attendeesArray.length !== agesArray.length) {
          console.log('Mismatch between attendees and ages count:', {
            attendeesCount: attendeesArray.length,
            agesCount: agesArray.length
          });
          req.flash('error', 'Mismatch between number of attendees and ages');
          return res.redirect('/admin/tickets/free-issue');
        }

        // Combine attendees and ages
        for (let i = 0; i < attendeesArray.length; i++) {
          const name = attendeesArray[i];
          const age = agesArray[i];

          console.log('Processing attendee:', { name, age });

          if (name && name.trim() !== '' && age && !isNaN(parseInt(age))) {
            attendeesList.push({ name: name.trim(), age: parseInt(age) });
          }
        }
      }
      // Handle the legacy format where attendees contains "name|age" format
      else if (typeof attendees === 'string' && !ages) {
        console.log('Processing legacy string format attendees');
        const attendeePairs = attendees.split(',').filter(pair => pair.trim() !== '');
        console.log('Attendee pairs:', attendeePairs);
        for (const pair of attendeePairs) {
          const [name, age] = pair.split('|');
          console.log('Processing pair:', { name, age });
          if (name && age && name.trim() !== '' && !isNaN(parseInt(age))) {
            attendeesList.push({ name: name.trim(), age: parseInt(age) });
          }
        }
      }
      // Handle the legacy format where attendees is an array of "name|age" strings
      else if (Array.isArray(attendees) && !ages) {
        console.log('Processing legacy array format attendees');
        for (const attendee of attendees) {
          const [name, age] = attendee.split('|');
          if (name && age && name.trim() !== '' && !isNaN(parseInt(age))) {
            attendeesList.push({ name: name.trim(), age: parseInt(age) });
          }
        }
      }
      else {
        console.log('Invalid attendee data format:', { attendeesType: typeof attendees, agesType: typeof ages, attendees, ages });
        req.flash('error', 'Invalid attendee data format');
        return res.redirect('/admin/tickets/free-issue');
      }
    }

    // If we don't have enough attendees for the requested quantity, create generic ones
    if (attendeesList.length < requestedQuantity) {
      // Add generic attendee entries to match the requested quantity
      for (let i = attendeesList.length; i < requestedQuantity; i++) {
        attendeesList.push({
          name: `Attendee ${i + 1}`,
          age: 18 // Default age
        });
      }
    }

    console.log('Final attendees list:', attendeesList);

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