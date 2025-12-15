const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const Concert = require('../models/Concert');
const User = require('../models/User');
const { v4: uuidv4 } = require('uuid');
const { isLoggedIn, isAdmin } = require('../middleware/auth');

// Store active validation tokens in memory (in production, use Redis or database)
const activeTokens = new Map();

// Get admin ticket validation page
router.get('/admin/ticket-validation', isLoggedIn, isAdmin, (req, res) => {
  try {
    // Generate a unique validation token
    const token = uuidv4();
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // Expires in 24 hours
    
    // Store token with expiration
    activeTokens.set(token, { createdAt: new Date(), expiresAt });
    
    // Generate validation URL with token
    const validationUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/tickets/validate/${token}`;
    
    console.log('Generated token:', token);
    console.log('Token expires at:', new Date(expiresAt));
    console.log('Validation URL:', validationUrl);
    console.log('Active tokens map size:', activeTokens.size);
    console.log('All active tokens:', Array.from(activeTokens.keys()));
    
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
router.post('/api/tickets/validate/:token/:id', async (req, res) => {
  try {
    const { token, id: ticketIdentifier } = req.params;
    
    // Check if token is valid and not expired
    const tokenData = activeTokens.get(token);
    if (!tokenData) {
      return res.status(401).json({ message: 'Invalid or expired validation link. Please generate a new link from admin panel.' });
    }
    
    if (Date.now() > tokenData.expiresAt) {
      activeTokens.delete(token); // Clean up expired token
      return res.status(401).json({ message: 'Validation link has expired. Please generate a new link from admin panel.' });
    }
    
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
          ticketNumber: ticket.ticketNumber,
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
        ticketNumber: ticket.ticketNumber,
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

// Public validation page with token
router.get('/tickets/validate/:token', (req, res) => {
  const { token } = req.params;
  
  console.log('Received token:', token);
  console.log('Active tokens map size:', activeTokens.size);
  console.log('Active tokens keys:', Array.from(activeTokens.keys()));
  
  // Always pass the token to the template, even when showing errors
  // This prevents ReferenceError in JavaScript functions
  
  // Check if token is valid
  const tokenData = activeTokens.get(token);
  
  console.log('Token data:', tokenData);
  
  // If no token data found, show error message
  if (!tokenData) {
    console.log('Token not found in activeTokens');
    return res.render('tickets/validate-simple', {
      layout: false,
      token: token, // Still pass token to prevent JS errors
      error: 'Invalid or expired validation link. Please generate a new link from admin panel.'
    });
  }
  
  // Check if token has expired (24 hours)
  if (Date.now() > tokenData.expiresAt) {
    console.log('Token expired');
    activeTokens.delete(token); // Clean up expired token
    return res.render('tickets/validate-simple', {
      layout: false,
      token: token, // Still pass token to prevent JS errors
      error: 'Validation link has expired. Please generate a new link from admin panel.'
    });
  }
  
  console.log('Token is valid');
  
  // Token is valid and not expired, render the validation page
  // Explicitly set error to null to prevent any previous error values from persisting
  res.render('tickets/validate-simple', {
    layout: false,
    token,
    error: null
  });
});

// API endpoint to invalidate a token (optional - for manual cleanup)
router.post('/api/tickets/invalidate/:token', isLoggedIn, isAdmin, (req, res) => {
  const { token } = req.params;
  if (activeTokens.has(token)) {
    activeTokens.delete(token);
    return res.status(200).json({ message: 'Validation link invalidated successfully' });
  }
  res.status(404).json({ message: 'Validation link not found' });
});

module.exports = router;
