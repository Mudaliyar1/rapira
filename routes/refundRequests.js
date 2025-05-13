const express = require('express');
const router = express.Router();
const RefundRequest = require('../models/RefundRequest');
const Ticket = require('../models/Ticket');
const Concert = require('../models/Concert');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { isLoggedIn, isAdmin } = require('../middleware/auth');

// User routes

// Test route
router.get('/test', (req, res) => {
  console.log('Test route accessed');
  res.send('Refund request test route is working!');
});

// View all my refund requests
router.get('/my-requests', isLoggedIn, async (req, res) => {
  try {
    const refundRequests = await RefundRequest.find({ user: req.session.user.id })
      .sort({ createdAt: -1 })
      .populate('ticket')
      .populate('concert');

    res.render('refund-requests/my-requests', { refundRequests });
  } catch (error) {
    console.error('My refund requests error:', error);
    req.flash('error', 'Failed to load your refund requests');
    res.redirect('/users/profile');
  }
});

// View refund request details (user view)
router.get('/view/:id', isLoggedIn, async (req, res) => {
  try {
    const refundRequest = await RefundRequest.findById(req.params.id)
      .populate('ticket')
      .populate('concert');

    if (!refundRequest) {
      req.flash('error', 'Refund request not found');
      return res.redirect('/refund-requests/my-requests');
    }

    // Check if user owns the refund request
    if (refundRequest.user.toString() !== req.session.user.id) {
      req.flash('error', 'You do not have permission to view this refund request');
      return res.redirect('/refund-requests/my-requests');
    }

    res.render('refund-requests/view-request', { refundRequest });
  } catch (error) {
    console.error('View refund request error:', error);
    req.flash('error', 'Failed to load refund request details');
    res.redirect('/refund-requests/my-requests');
  }
});

// Get refund request form
router.get('/request/:ticketId', isLoggedIn, async (req, res) => {
  console.log('Refund request form accessed for ticket:', req.params.ticketId);
  try {
    const ticket = await Ticket.findById(req.params.ticketId)
      .populate('concert')
      .populate('user');

    if (!ticket) {
      req.flash('error', 'Ticket not found');
      return res.redirect('/users/profile');
    }

    // Check if user owns the ticket
    if (ticket.user._id.toString() !== req.session.user.id) {
      req.flash('error', 'You do not have permission to request a refund for this ticket');
      return res.redirect('/users/profile');
    }

    // Check if ticket is eligible for refund (completed status and not already refunded)
    if (ticket.paymentStatus !== 'completed') {
      req.flash('error', 'Only confirmed tickets are eligible for refund');
      return res.redirect(`/tickets/${ticket._id}`);
    }

    // Check if a refund request already exists for this ticket
    const existingRequest = await RefundRequest.findOne({ ticket: ticket._id });
    if (existingRequest) {
      req.flash('info', 'A refund request for this ticket already exists');
      return res.redirect(`/tickets/${ticket._id}`);
    }

    // Check if the concert date has passed
    const concertDate = new Date(ticket.concert.date);
    const currentDate = new Date();
    const isAfterConcert = currentDate > concertDate;

    if (isAfterConcert) {
      req.flash('error', 'Refunds cannot be requested after the concert date has passed');
      return res.redirect(`/tickets/${ticket._id}`);
    }

    console.log('Rendering refund request form for ticket:', ticket.ticketNumber);
    res.render('refund-requests/request-form-new', { ticket });
  } catch (error) {
    console.error('Refund request form error:', error);
    req.flash('error', 'Failed to load refund request form');
    res.redirect('/users/profile');
  }
});

// Submit refund request
router.post('/submit', isLoggedIn, async (req, res) => {
  try {
    const { ticketId, reason, accountName, accountNumber, ifscCode, bankName } = req.body;

    // Validate input
    if (!ticketId || !reason || !accountName || !accountNumber || !ifscCode || !bankName) {
      req.flash('error', 'All fields are required');
      return res.redirect(`/refund-requests/request/${ticketId}`);
    }

    const ticket = await Ticket.findById(ticketId)
      .populate('concert')
      .populate('user');

    if (!ticket) {
      req.flash('error', 'Ticket not found');
      return res.redirect('/users/profile');
    }

    // Check if user owns the ticket
    if (ticket.user._id.toString() !== req.session.user.id) {
      req.flash('error', 'You do not have permission to request a refund for this ticket');
      return res.redirect('/users/profile');
    }

    // Check if ticket is eligible for refund
    if (ticket.paymentStatus !== 'completed') {
      req.flash('error', 'Only confirmed tickets are eligible for refund');
      return res.redirect(`/tickets/${ticket._id}`);
    }

    // Check if a refund request already exists
    const existingRequest = await RefundRequest.findOne({ ticket: ticket._id });
    if (existingRequest) {
      req.flash('info', 'A refund request for this ticket already exists');
      return res.redirect(`/tickets/${ticket._id}`);
    }

    // Create new refund request
    const refundRequest = new RefundRequest({
      ticket: ticket._id,
      user: req.session.user.id,
      concert: ticket.concert._id,
      reason,
      amount: ticket.totalAmount,
      bankDetails: {
        accountName,
        accountNumber,
        ifscCode,
        bankName
      }
    });

    await refundRequest.save();

    // Create notification for admin
    const notification = new Notification({
      module: 'Refund Request',
      requestId: refundRequest._id,
      modelRef: 'RefundRequest',
      description: `New refund request for ticket #${ticket.ticketNumber} - ${ticket.concert.title}`,
      link: `/admin/refund-requests/${refundRequest._id}`,
      status: 'Pending'
    });

    await notification.save();

    req.flash('success', 'Refund request submitted successfully. You will be notified once it is processed.');
    res.redirect(`/tickets/${ticket._id}`);
  } catch (error) {
    console.error('Submit refund request error:', error);
    req.flash('error', 'Failed to submit refund request');
    res.redirect('/users/profile');
  }
});

// Admin routes

// List all refund requests
router.get('/', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { status } = req.query;

    // Build filter
    const filter = {};
    if (status) {
      filter.status = status;
    }

    const refundRequests = await RefundRequest.find(filter)
      .sort({ createdAt: -1 })
      .populate('user', 'name email')
      .populate('ticket', 'ticketNumber')
      .populate('concert', 'title date');

    res.render('admin/refund-requests/index', {
      layout: 'admin',
      currentPath: '/admin/refund-requests',
      title: 'Refund Requests',
      refundRequests,
      currentStatus: status || 'all'
    });
  } catch (error) {
    console.error('Admin refund requests list error:', error);
    req.flash('error', 'Failed to load refund requests');
    res.redirect('/admin');
  }
});

// View refund request details
router.get('/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const refundRequest = await RefundRequest.findById(req.params.id)
      .populate('user', 'name email')
      .populate('ticket')
      .populate('concert')
      .populate('reviewedBy', 'name');

    if (!refundRequest) {
      req.flash('error', 'Refund request not found');
      return res.redirect('/admin/refund-requests');
    }

    // Mark notification as read
    await Notification.updateMany(
      { requestId: refundRequest._id, modelRef: 'RefundRequest' },
      { $set: { isRead: true, status: 'Reviewed' } }
    );

    res.render('admin/refund-requests/details', {
      layout: 'admin',
      currentPath: '/admin/refund-requests',
      title: 'Refund Request Details',
      refundRequest
    });
  } catch (error) {
    console.error('Admin refund request details error:', error);
    req.flash('error', 'Failed to load refund request details');
    res.redirect('/admin/refund-requests');
  }
});

// Process refund request (approve or reject)
router.post('/:id/process', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { action, adminNotes, transactionId } = req.body;

    if (!action) {
      req.flash('error', 'Action is required');
      return res.redirect(`/admin/refund-requests/${req.params.id}`);
    }

    const refundRequest = await RefundRequest.findById(req.params.id);
    if (!refundRequest) {
      req.flash('error', 'Refund request not found');
      return res.redirect('/admin/refund-requests');
    }

    // Update refund request
    refundRequest.status = action === 'approve' ? 'approved' : 'rejected';
    refundRequest.adminNotes = adminNotes || '';
    refundRequest.reviewedBy = req.session.user.id;
    refundRequest.reviewedAt = new Date();

    if (action === 'approve') {
      refundRequest.transactionId = transactionId || '';
      refundRequest.refundedAt = new Date();

      // Update ticket status to refunded (don't delete it)
      const ticket = await Ticket.findById(refundRequest.ticket);
      if (ticket) {
        ticket.paymentStatus = 'refunded';
        await ticket.save();

        // Update concert ticket count
        const concert = await Concert.findById(refundRequest.concert);
        if (concert) {
          concert.ticketsSold = Math.max(0, concert.ticketsSold - ticket.quantity);
          await concert.save();
        }
      }
    }

    await refundRequest.save();

    req.flash('success', `Refund request ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
    res.redirect('/admin/refund-requests');
  } catch (error) {
    console.error('Process refund request error:', error);
    req.flash('error', 'Failed to process refund request');
    res.redirect(`/admin/refund-requests/${req.params.id}`);
  }
});

module.exports = router;
