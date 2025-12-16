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
    
    // Log the structure of stored tokens for debugging
    console.log('Stored token data structure:');
    for (let [key, value] of activeTokens.entries()) {
      console.log(`  Token: ${key}`);
      console.log(`    createdAt: ${value.createdAt} (type: ${typeof value.createdAt})`);
      console.log(`    expiresAt: ${value.expiresAt} (type: ${typeof value.expiresAt})`);
    }
    
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

// Test route to verify API is working
router.get('/admin/ticket-validation/test', isLoggedIn, isAdmin, (req, res) => {
  res.json({ message: 'API is working', timestamp: new Date().toISOString() });
});

// Test route to verify active links functionality
router.get('/admin/ticket-validation/debug-active-links', isLoggedIn, isAdmin, (req, res) => {
  try {
    console.log('Debug: Fetching active validation links...');
    console.log('Debug: User:', req.user);
    console.log('Debug: Active tokens map size:', activeTokens.size);
    console.log('Debug: Active tokens keys:', Array.from(activeTokens.keys()));
    
    // Convert Map to array of objects
    const links = Array.from(activeTokens.entries()).map(([token, data]) => {
      console.log(`Debug: Processing token: ${token}`, data);
      
      // Handle both Date objects and timestamps for expiresAt
      let expiresAtFormatted;
      if (typeof data.expiresAt === 'number') {
        // It's a timestamp
        console.log('Debug: expiresAt is a number:', data.expiresAt);
        expiresAtFormatted = new Date(data.expiresAt).toISOString();
      } else if (data.expiresAt instanceof Date) {
        // It's already a Date object
        console.log('Debug: expiresAt is a Date object:', data.expiresAt);
        expiresAtFormatted = data.expiresAt.toISOString();
      } else {
        // Fallback
        console.log('Debug: expiresAt is something else:', typeof data.expiresAt, data.expiresAt);
        expiresAtFormatted = new Date(data.expiresAt).toISOString();
      }
      
      console.log('Debug: Formatted expiresAt:', expiresAtFormatted);
      
      const result = {
        token,
        createdAt: data.createdAt.toISOString(),
        expiresAt: expiresAtFormatted
      };
      
      console.log('Debug: Result for token:', token, result);
      return result;
    });
    
    console.log('Debug: Processed links:', links);
    
    res.json({ 
      links, 
      message: 'Debug successful',
      user: req.user,
      tokenCount: activeTokens.size
    });
  } catch (error) {
    console.error('Debug: Error fetching active links:', error);
    res.status(500).json({ 
      message: 'Debug failed: ' + error.message,
      error: error.toString()
    });
  }
});

// Get active validation links (for admin panel)
router.get('/admin/ticket-validation/active-links', isLoggedIn, isAdmin, (req, res) => {
  try {
    console.log('Fetching active validation links...');
    console.log('User:', req.user);
    console.log('Active tokens map size:', activeTokens.size);
    console.log('Active tokens keys:', Array.from(activeTokens.keys()));
    
    // Convert Map to array of objects
    const links = Array.from(activeTokens.entries()).map(([token, data]) => {
      console.log(`Processing token: ${token}`, data);
      
      // Handle both Date objects and timestamps for expiresAt
      let expiresAtFormatted;
      if (typeof data.expiresAt === 'number') {
        // It's a timestamp
        console.log('expiresAt is a number:', data.expiresAt);
        expiresAtFormatted = new Date(data.expiresAt).toISOString();
      } else if (data.expiresAt instanceof Date) {
        // It's already a Date object
        console.log('expiresAt is a Date object:', data.expiresAt);
        expiresAtFormatted = data.expiresAt.toISOString();
      } else {
        // Fallback
        console.log('expiresAt is something else:', typeof data.expiresAt, data.expiresAt);
        expiresAtFormatted = new Date(data.expiresAt).toISOString();
      }
      
      console.log('Formatted expiresAt:', expiresAtFormatted);
      
      const result = {
        token,
        createdAt: data.createdAt.toISOString(),
        expiresAt: expiresAtFormatted
      };
      
      console.log('Result for token:', token, result);
      return result;
    });
    
    console.log('Processed links:', links);
    
    res.json({ links });
  } catch (error) {
    console.error('Error fetching active links:', error);
    res.status(500).json({ message: 'Failed to fetch active links: ' + error.message });
  }
});

// Invalidate a specific validation link (for admin panel)
router.post('/admin/ticket-validation/invalidate/:token', isLoggedIn, isAdmin, (req, res) => {
  try {
    const { token } = req.params;
    if (activeTokens.has(token)) {
      activeTokens.delete(token);
      return res.json({ success: true, message: 'Validation link invalidated successfully' });
    }
    res.status(404).json({ success: false, message: 'Validation link not found' });
  } catch (error) {
    console.error('Error invalidating link:', error);
    res.status(500).json({ success: false, message: 'Failed to invalidate link' });
  }
});

// Invalidate all validation links (for admin panel)
router.post('/admin/ticket-validation/invalidate-all', isLoggedIn, isAdmin, (req, res) => {
  try {
    const count = activeTokens.size;
    activeTokens.clear();
    res.json({ success: true, message: `Successfully invalidated ${count} validation link(s)` });
  } catch (error) {
    console.error('Error invalidating all links:', error);
    res.status(500).json({ success: false, message: 'Failed to invalidate links' });
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
    return res.render('tickets/direct-camera-validation', {
      layout: false,
      token: token, // Still pass token to prevent JS errors
      error: 'Invalid or expired validation link. Please generate a new link from admin panel.'
    });
  }
  
  // Check if token has expired (24 hours)
  if (Date.now() > tokenData.expiresAt) {
    console.log('Token expired');
    activeTokens.delete(token); // Clean up expired token
    return res.render('tickets/direct-camera-validation', {
      layout: false,
      token: token, // Still pass token to prevent JS errors
      error: 'Validation link has expired. Please generate a new link from admin panel.'
    });
  }
  
  console.log('Token is valid');
  
  // Token is valid and not expired, render the validation page
  // Explicitly set error to null to prevent any previous error values from persisting
  res.render('tickets/direct-camera-validation', {
    layout: false,
    token,
    error: null
  });
});

// Direct access to robust validation page (without token validation)
router.get('/tickets/validate-robust', (req, res) => {
  // Generate a temporary token for this session
  const token = uuidv4();
  const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // Expires in 24 hours
  
  // Store token with expiration
  activeTokens.set(token, { createdAt: new Date(), expiresAt });
  
  console.log('Generated temporary token for robust validation:', token);
  
  // Render the robust validation page
  res.render('tickets/validate-robust', {
    layout: false,
    token,
    error: null
  });
});

// Direct access to robust validation page with specific token
router.get('/tickets/validate-robust/:token', (req, res) => {
  const { token } = req.params;
  
  console.log('Accessing robust validation with token:', token);
  
  // Check if token is valid
  const tokenData = activeTokens.get(token);
  
  // If no token data found, generate a new one
  if (!tokenData) {
    console.log('Token not found, generating new one');
    const newToken = uuidv4();
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // Expires in 24 hours
    
    // Store token with expiration
    activeTokens.set(newToken, { createdAt: new Date(), expiresAt });
    
    // Redirect to the new token URL
    return res.redirect(`/tickets/validate-robust/${newToken}`);
  }
  
  // Check if token has expired (24 hours)
  if (Date.now() > tokenData.expiresAt) {
    console.log('Token expired, generating new one');
    activeTokens.delete(token); // Clean up expired token
    
    // Generate a new token
    const newToken = uuidv4();
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // Expires in 24 hours
    
    // Store token with expiration
    activeTokens.set(newToken, { createdAt: new Date(), expiresAt });
    
    // Redirect to the new token URL
    return res.redirect(`/tickets/validate-robust/${newToken}`);
  }
  
  console.log('Using existing valid token');
  
  // Token is valid and not expired, render the validation page
  res.render('tickets/validate-robust', {
    layout: false,
    token,
    error: null
  });
});

// Camera test page
router.get('/tickets/camera-test', (req, res) => {
  res.render('tickets/camera-test', {
    layout: false
  });
});

// Simple camera test page
router.get('/tickets/simple-camera-test', (req, res) => {
  res.render('tickets/simple-camera-test', {
    layout: false
  });
});

// Direct camera validation page
router.get('/tickets/direct-camera-validation/:token', (req, res) => {
  const { token } = req.params;
  
  console.log('Accessing direct camera validation with token:', token);
  
  // Check if token is valid
  const tokenData = activeTokens.get(token);
  
  // If no token data found, show error
  if (!tokenData) {
    console.log('Token not found for direct camera validation');
    return res.render('tickets/direct-camera-validation', {
      layout: false,
      token: token,
      error: 'Invalid or expired validation link. Please generate a new link from admin panel.'
    });
  }
  
  // Check if token has expired (24 hours)
  if (Date.now() > tokenData.expiresAt) {
    console.log('Token expired for direct camera validation');
    activeTokens.delete(token); // Clean up expired token
    
    return res.render('tickets/direct-camera-validation', {
      layout: false,
      token: token,
      error: 'Validation link has expired. Please generate a new link from admin panel.'
    });
  }
  
  console.log('Token is valid for direct camera validation');
  
  // Token is valid and not expired, render the validation page
  res.render('tickets/direct-camera-validation', {
    layout: false,
    token,
    error: null
  });
});

// Direct access to direct camera validation page (without token validation)
router.get('/tickets/direct-camera-validation', (req, res) => {
  // Generate a temporary token for this session
  const token = uuidv4();
  const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // Expires in 24 hours
  
  // Store token with expiration
  activeTokens.set(token, { createdAt: new Date(), expiresAt });
  
  console.log('Generated temporary token for direct camera validation:', token);
  
  // Render the direct camera validation page
  res.render('tickets/direct-camera-validation', {
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
