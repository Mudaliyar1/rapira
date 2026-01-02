const express = require('express');
const router = express.Router();
const RefundRequest = require('../models/RefundRequest');
const Ticket = require('../models/Ticket');
const Concert = require('../models/Concert');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { isLoggedIn, isAdmin } = require('../middleware/auth');
const {
  sendRefundApprovalEmail,
  sendRefundRejectionEmail
} = require('../utils/emailService');

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
      .populate('ticket', 'ticketNumber concert user attendees quantity totalAmount originalAmount discountApplied discountPercentage discountType paymentId orderId paymentStatus purchaseDate')
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
      // If the request was rejected, allow the user to reapply
      if (existingRequest.status === 'rejected') {
        console.log('Previous refund request was rejected, allowing reapplication');
      } else {
        // For pending or approved requests, don't allow reapplication
        req.flash('info', 'A refund request for this ticket already exists');
        return res.redirect(`/tickets/${ticket._id}`);
      }
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
      // If the request was rejected, allow the user to reapply by updating the existing request
      if (existingRequest.status === 'rejected') {
        console.log('Updating previously rejected refund request');

        // Update the existing request with new information
        existingRequest.reason = reason;
        existingRequest.status = 'pending'; // Reset status to pending
        existingRequest.adminNotes = ''; // Clear previous admin notes
        existingRequest.reviewedBy = null;
        existingRequest.reviewedAt = null;
        existingRequest.bankDetails = {
          accountName,
          accountNumber,
          ifscCode,
          bankName
        };

        await existingRequest.save();

        // Create notification for admin about the reapplication
        const notification = new Notification({
          module: 'Refund Request',
          requestId: existingRequest._id,
          modelRef: 'RefundRequest',
          description: `Reapplication for refund request for ticket #${ticket.ticketNumber} - ${ticket.concert.title}`,
          link: `/admin/refund-requests/${existingRequest._id}`,
          status: 'Pending'
        });

        await notification.save();

        req.flash('success', 'Refund request resubmitted successfully. You will be notified once it is processed.');
        return res.redirect(`/tickets/${ticket._id}`);
      } else {
        // For pending or approved requests, don't allow reapplication
        req.flash('info', 'A refund request for this ticket already exists');
        return res.redirect(`/tickets/${ticket._id}`);
      }
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
    // Get search parameters
    const { search, status, dateRange, amountRange, sortBy, sortOrder } = req.query;

    // Build filter
    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }

    // Date range filter
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      if (dateRange === 'today') {
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        const endOfDay = new Date(now.setHours(23, 59, 59, 999));
        filter.createdAt = { $gte: startOfDay, $lte: endOfDay };
      } else if (dateRange === 'this-week') {
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));
        filter.createdAt = { $gte: startOfWeek, $lte: endOfWeek };
      } else if (dateRange === 'this-month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        filter.createdAt = { $gte: startOfMonth, $lte: endOfMonth };
      }
    }

    // Amount range filter
    if (amountRange && amountRange !== 'all') {
      if (amountRange === 'under-500') {
        filter.amount = { $lt: 500 };
      } else if (amountRange === '500-1000') {
        filter.amount = { $gte: 500, $lte: 1000 };
      } else if (amountRange === 'over-1000') {
        filter.amount = { $gt: 1000 };
      }
    }

    // Build sort options
    let sortOptions = { createdAt: -1 }; // Default sort
    if (sortBy) {
      const order = sortOrder === 'asc' ? 1 : -1;
      sortOptions = { [sortBy]: order };
    }

    // Get refund requests with filters
    let refundRequests = await RefundRequest.find(filter)
      .sort(sortOptions)
      .populate('user', 'name email')
      .populate('ticket', 'ticketNumber paymentId')
      .populate('concert', 'title date')
      .populate('reviewedBy', 'name');

    // Apply text search on populated data
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      refundRequests = refundRequests.filter(request => {
        const userName = (request.user ? request.user.name : '').toLowerCase();
        const userEmail = (request.user ? request.user.email : '').toLowerCase();
        const concertTitle = (request.concert ? request.concert.title : '').toLowerCase();
        const ticketNumber = (request.ticket ? request.ticket.ticketNumber : '').toLowerCase();
        const reason = (request.reason || '').toLowerCase();

        return userName.includes(searchTerm) ||
               userEmail.includes(searchTerm) ||
               concertTitle.includes(searchTerm) ||
               ticketNumber.includes(searchTerm) ||
               reason.includes(searchTerm);
      });
    }

    // Get statistics
    const totalRequests = await RefundRequest.countDocuments();
    const pendingRequests = await RefundRequest.countDocuments({ status: 'pending' });
    const approvedRequests = await RefundRequest.countDocuments({ status: 'approved' });
    const rejectedRequests = await RefundRequest.countDocuments({ status: 'rejected' });
    const totalRefundAmount = await RefundRequest.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    res.render('admin/refund-requests/index', {
      layout: 'admin',
      currentPath: '/admin/refund-requests',
      title: 'Refund Requests',
      refundRequests,
      searchParams: {
        search: search || '',
        status: status || 'all',
        dateRange: dateRange || 'all',
        amountRange: amountRange || 'all',
        sortBy: sortBy || 'createdAt',
        sortOrder: sortOrder || 'desc'
      },
      stats: {
        total: totalRequests,
        pending: pendingRequests,
        approved: approvedRequests,
        rejected: rejectedRequests,
        totalAmount: totalRefundAmount.length > 0 ? totalRefundAmount[0].total : 0,
        filtered: refundRequests.length
      },
      currentStatus: status || 'all'
    });
  } catch (error) {
    console.error('Admin refund requests list error:', error);
    req.flash('error', 'Failed to load refund requests');
    res.redirect('/admin');
  }
});

// Export refund requests to CSV
router.get('/export', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get search parameters (same as main route)
    const { search, status, dateRange, amountRange, sortBy, sortOrder } = req.query;

    // Build filter
    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }

    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      if (dateRange === 'today') {
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        const endOfDay = new Date(now.setHours(23, 59, 59, 999));
        filter.createdAt = { $gte: startOfDay, $lte: endOfDay };
      } else if (dateRange === 'this-week') {
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));
        filter.createdAt = { $gte: startOfWeek, $lte: endOfWeek };
      } else if (dateRange === 'this-month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        filter.createdAt = { $gte: startOfMonth, $lte: endOfMonth };
      }
    }

    if (amountRange && amountRange !== 'all') {
      if (amountRange === 'under-500') {
        filter.amount = { $lt: 500 };
      } else if (amountRange === '500-1000') {
        filter.amount = { $gte: 500, $lte: 1000 };
      } else if (amountRange === 'over-1000') {
        filter.amount = { $gt: 1000 };
      }
    }

    // Build sort options
    let sortOptions = { createdAt: -1 };
    if (sortBy) {
      const order = sortOrder === 'asc' ? 1 : -1;
      sortOptions = { [sortBy]: order };
    }

    // Get refund requests with filters
    let refundRequests = await RefundRequest.find(filter)
      .sort(sortOptions)
      .populate('user', 'name email')
      .populate('ticket', 'ticketNumber paymentId')
      .populate('concert', 'title date')
      .populate('reviewedBy', 'name');

    // Apply text search
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      refundRequests = refundRequests.filter(request => {
        const userName = (request.user ? request.user.name : '').toLowerCase();
        const userEmail = (request.user ? request.user.email : '').toLowerCase();
        const concertTitle = (request.concert ? request.concert.title : '').toLowerCase();
        const ticketNumber = (request.ticket ? request.ticket.ticketNumber : '').toLowerCase();
        const reason = (request.reason || '').toLowerCase();

        return userName.includes(searchTerm) ||
               userEmail.includes(searchTerm) ||
               concertTitle.includes(searchTerm) ||
               ticketNumber.includes(searchTerm) ||
               reason.includes(searchTerm);
      });
    }

    // Generate CSV content
    const csvHeader = 'Request ID,User Name,Email,Concert,Ticket Number,Payment ID,Amount,Status,Reason,Request Date,Reviewed By,Reviewed Date,Transaction ID\n';
    const csvRows = refundRequests.map(request => {
      const requestId = `"${request._id.toString().slice(-6).toUpperCase()}"`;
      const userName = `"${(request.user ? request.user.name : '').replace(/"/g, '""')}"`;
      const userEmail = `"${(request.user ? request.user.email : '').replace(/"/g, '""')}"`;
      const concertTitle = `"${(request.concert ? request.concert.title : '').replace(/"/g, '""')}"`;
      const ticketNumber = `"${(request.ticket ? request.ticket.ticketNumber : '').replace(/"/g, '""')}"`;
      const paymentId = `"${(request.ticket ? request.ticket.paymentId : '').replace(/"/g, '""')}"`;
      const amount = request.amount || 0;
      const status = request.status || '';
      const reason = `"${(request.reason || '').replace(/"/g, '""')}"`;
      const requestDate = new Date(request.createdAt).toLocaleDateString();
      const reviewedBy = `"${(request.reviewedBy ? request.reviewedBy.name : '').replace(/"/g, '""')}"`;
      const reviewedDate = request.reviewedAt ? new Date(request.reviewedAt).toLocaleDateString() : '';
      const transactionId = `"${(request.transactionId || '').replace(/"/g, '""')}"`;

      return `${requestId},${userName},${userEmail},${concertTitle},${ticketNumber},${paymentId},${amount},${status},${reason},${requestDate},${reviewedBy},${reviewedDate},${transactionId}`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // Set response headers for file download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `refund_requests_export_${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Export refund requests error:', error);
    req.flash('error', 'Failed to export refund requests');
    res.redirect('/admin/refund-requests');
  }
});

// View refund request details
router.get('/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const refundRequest = await RefundRequest.findById(req.params.id)
      .populate('ticket', 'ticketNumber concert user attendees quantity totalAmount originalAmount discountApplied discountPercentage discountType paymentId orderId paymentStatus purchaseDate')
      .populate('concert')
      .populate('reviewedBy', 'name')
      .populate('user', 'name email');
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

    // Get user, ticket, and concert details for email
    const user = await User.findById(refundRequest.user);
    const ticket = await Ticket.findById(refundRequest.ticket);
    const concert = await Concert.findById(refundRequest.concert);

    if (!user || !ticket || !concert) {
      req.flash('error', 'Could not find all required information');
      return res.redirect(`/admin/refund-requests/${req.params.id}`);
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
      if (ticket) {
        ticket.paymentStatus = 'refunded';
        await ticket.save();

        // Update concert ticket count
        if (concert) {
          concert.ticketsSold = Math.max(0, concert.ticketsSold - ticket.quantity);
          await concert.save();
        }
      }
    }

    await refundRequest.save();

    // Send email notification based on action
    let emailResult;
    if (action === 'approve') {
      // Send approval email
      emailResult = await sendRefundApprovalEmail(user, refundRequest, ticket, concert);
      if (emailResult.success) {
        console.log(`Refund approval email sent to ${user.email}`);
      } else {
        console.error(`Failed to send refund approval email to ${user.email}:`, emailResult.error);
      }
    } else {
      // Send rejection email
      emailResult = await sendRefundRejectionEmail(user, refundRequest, ticket, concert);
      if (emailResult.success) {
        console.log(`Refund rejection email sent to ${user.email}`);
      } else {
        console.error(`Failed to send refund rejection email to ${user.email}:`, emailResult.error);
      }
    }

    // Add email status to flash message
    const emailStatus = emailResult && emailResult.success
      ? "Email notification sent to user."
      : "Note: Email notification could not be sent to user.";

    req.flash('success', `Refund request ${action === 'approve' ? 'approved' : 'rejected'} successfully. ${emailStatus}`);
    res.redirect('/admin/refund-requests');
  } catch (error) {
    console.error('Process refund request error:', error);
    req.flash('error', 'Failed to process refund request');
    res.redirect(`/admin/refund-requests/${req.params.id}`);
  }
});

// POST /admin/refund-requests/:id/delete - Delete individual refund request
router.post('/:id/delete', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const refundRequest = await RefundRequest.findById(req.params.id);
    
    if (!refundRequest) {
      req.flash('error', 'Refund request not found');
      return res.redirect('/admin/refund-requests');
    }

    // Delete the refund request
    await RefundRequest.findByIdAndDelete(req.params.id);
    
    req.flash('success', 'Refund request deleted successfully');
    res.redirect('/admin/refund-requests');

  } catch (error) {
    console.error('Error deleting refund request:', error);
    req.flash('error', 'Failed to delete refund request');
    res.redirect(`/admin/refund-requests`);
  }
});

module.exports = router;
