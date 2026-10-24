const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware/auth');
const { getPaymentDetails } = require('../utils/paymentService');
const Ticket = require('../models/Ticket');

const getSessionUserId = (req) => {
  if (!req || !req.session || !req.session.user) return null;
  return String(req.session.user.id || req.session.user._id || '').trim() || null;
};

const isTicketOwnedBySessionUser = (ticketDoc, req) => {
  const sessionUserId = getSessionUserId(req);
  if (!sessionUserId || !ticketDoc) return false;
  const ticketUserId = ticketDoc.user && (ticketDoc.user._id || ticketDoc.user);
  return ticketUserId ? String(ticketUserId) === sessionUserId : false;
};

// Payment success page
router.get('/success', isLoggedIn, async (req, res) => {
  try {
    const { ticket_id } = req.query;
    
    if (!ticket_id) {
      req.flash('error', 'Invalid payment data');
      return res.redirect('/concerts');
    }
    
    const ticket = await Ticket.findById(ticket_id)
      .populate('concert')
      .populate('user');
    
    if (!ticket) {
      req.flash('error', 'Ticket not found');
      return res.redirect('/concerts');
    }
    
    // Check if user owns the ticket
    if (!isTicketOwnedBySessionUser(ticket, req)) {
      req.flash('error', 'You do not have permission to view this ticket');
      return res.redirect('/users/profile');
    }
    
    res.render('payments/success', { ticket });
  } catch (error) {
    console.error('Payment success page error:', error);
    req.flash('error', 'Failed to load payment details');
    res.redirect('/concerts');
  }
});

// Payment failure page
router.get('/failure', isLoggedIn, (req, res) => {
  res.render('payments/failure');
});

// Get payment details
router.get('/details/:paymentId', isLoggedIn, async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    // Get payment details from Razorpay
    const paymentResult = await getPaymentDetails(paymentId);
    
    if (!paymentResult.success) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    
    // Find ticket associated with payment
    const ticket = await Ticket.findOne({ paymentId })
      .populate('concert')
      .populate('user');
    
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    
    // Check if user owns the ticket or is admin
    if (!isTicketOwnedBySessionUser(ticket, req) && req.session.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You do not have permission to view this payment' });
    }
    
    res.json({
      success: true,
      payment: paymentResult.data,
      ticket
    });
  } catch (error) {
    console.error('Get payment details error:', error);
    res.status(500).json({ success: false, message: 'Failed to get payment details' });
  }
});

module.exports = router;
