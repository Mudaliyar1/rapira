const express = require('express');
const router = express.Router();
const { isLoggedIn, isAdmin } = require('../middleware/auth');
const Contact = require('../models/Contact');

// Get all contact messages
router.get('/', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get query parameters for filtering
    const { status, sort = 'newest' } = req.query;
    
    // Build query
    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Determine sort order
    let sortOption = { createdAt: -1 }; // Default: newest first
    if (sort === 'oldest') {
      sortOption = { createdAt: 1 };
    } else if (sort === 'unread') {
      sortOption = { status: 1, createdAt: -1 };
    }
    
    // Get contact messages
    const messages = await Contact.find(query).sort(sortOption);
    
    // Get counts for each status
    const newCount = await Contact.countDocuments({ status: 'new' });
    const readCount = await Contact.countDocuments({ status: 'read' });
    const repliedCount = await Contact.countDocuments({ status: 'replied' });
    const archivedCount = await Contact.countDocuments({ status: 'archived' });
    const totalCount = await Contact.countDocuments();
    
    res.render('admin/contact-messages', {
      layout: 'admin',
      title: 'Contact Messages',
      currentPath: '/admin/contact-messages',
      messages,
      filters: {
        status: status || 'all',
        sort: sort || 'newest'
      },
      counts: {
        new: newCount,
        read: readCount,
        replied: repliedCount,
        archived: archivedCount,
        total: totalCount
      }
    });
  } catch (error) {
    console.error('Error fetching contact messages:', error);
    req.flash('error', 'Failed to load contact messages');
    res.redirect('/admin');
  }
});

// View a single message
router.get('/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const message = await Contact.findById(req.params.id);
    
    if (!message) {
      req.flash('error', 'Message not found');
      return res.redirect('/admin/contact-messages');
    }
    
    // If message is new, mark it as read
    if (message.status === 'new') {
      message.status = 'read';
      await message.save();
    }
    
    res.render('admin/contact-message-detail', {
      layout: 'admin',
      title: 'Message Details',
      currentPath: '/admin/contact-messages',
      message
    });
  } catch (error) {
    console.error('Error fetching message details:', error);
    req.flash('error', 'Failed to load message details');
    res.redirect('/admin/contact-messages');
  }
});

// Update message status
router.post('/:id/status', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['new', 'read', 'replied', 'archived'].includes(status)) {
      req.flash('error', 'Invalid status');
      return res.redirect('/admin/contact-messages');
    }
    
    await Contact.findByIdAndUpdate(req.params.id, { status });
    
    req.flash('success', 'Message status updated');
    res.redirect(`/admin/contact-messages/${req.params.id}`);
  } catch (error) {
    console.error('Error updating message status:', error);
    req.flash('error', 'Failed to update message status');
    res.redirect('/admin/contact-messages');
  }
});

// Delete a message
router.delete('/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    await Contact.findByIdAndDelete(req.params.id);
    
    req.flash('success', 'Message deleted successfully');
    res.redirect('/admin/contact-messages');
  } catch (error) {
    console.error('Error deleting message:', error);
    req.flash('error', 'Failed to delete message');
    res.redirect('/admin/contact-messages');
  }
});

module.exports = router;
