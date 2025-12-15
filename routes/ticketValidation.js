const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const Concert = require('../models/Concert');
const User = require('../models/User');
const { isLoggedIn, isAdmin } = require('../middleware/auth');

// Get admin ticket validation page
router.get('/admin/ticket-validation', isLoggedIn, isAdmin, (req, res) => {
  try {
    // Generate a validation URL (in a real app, this would be a unique token)
    const validationUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/tickets/validate`;
    
    res.render('admin/ticket-validation', {
      layout: 'admin',
      currentPath: '/admin/ticket-validation',
      title: 'Ticket Validation',
      validationUrl
    });
  } catch (error) {
    console.error('Admin ticket validation page error:', error);
    req.flash('error', 'Failed to load ticket validation page');
    res.redirect('/admin');
  }
});

// API endpoint to validate ticket (public endpoint)
router.post('/api/tickets/validate/:id', async (req, res) => {
  try {
    const ticketIdentifier = req.params.id;
    
    // Find ticket by ticketNumber or _id
    let ticket = await Ticket.findOne({ ticketNumber: ticketIdentifier })
      .populate({
        path: 'concert',
        select: 'title date'
      })
      .populate({
        path: 'user',
        select: 'name'
      });
    
    // If not found by ticketNumber, try by _id
    if (!ticket) {
      ticket = await Ticket.findById(ticketIdentifier)
        .populate({
          path: 'concert',
          select: 'title date'
        })
        .populate({
          path: 'user',
          select: 'name'
        });
    }
    
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    // Check if concert exists and hasn't been deleted
    if (!ticket.concert) {
      return res.status(400).json({ message: 'Concert no longer available' });
    }
    
    // Check if ticket has been refunded
    if (ticket.paymentStatus === 'refunded') {
      return res.status(400).json({ message: 'This ticket has been refunded and is invalid' });
    }
    
    // Check if ticket is already marked as attended
    if (ticket.attended) {
      return res.status(200).json({
        message: 'Ticket already validated',
        ticket: {
          _id: ticket._id,
          ticketNumber: ticket.ticketNumber, // Include ticketNumber in response
          concert: {
            title: ticket.concert.title,
            date: ticket.concert.date
          },
          user: {
            name: ticket.user.name
          },
          quantity: ticket.quantity,
          attended: ticket.attended,
          attendedAt: ticket.attendedAt
        }
      });
    }
    
    // Mark ticket as attended
    ticket.attended = true;
    ticket.attendedAt = new Date();
    await ticket.save();
    
    // Return success response
    res.status(200).json({
      message: 'Ticket validated successfully',
      ticket: {
        _id: ticket._id,
        ticketNumber: ticket.ticketNumber, // Include ticketNumber in response
        concert: {
          title: ticket.concert.title,
          date: ticket.concert.date
        },
        user: {
          name: ticket.user.name
        },
        quantity: ticket.quantity,
        attended: ticket.attended,
        attendedAt: ticket.attendedAt
      }
    });
  } catch (error) {
    console.error('Ticket validation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Public validation page
router.get('/tickets/validate', (req, res) => {
  res.render('tickets/validate', {
    layout: false
  });
});

module.exports = router;