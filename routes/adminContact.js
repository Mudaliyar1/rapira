const express = require('express');
const router = express.Router();
const { isLoggedIn, isAdmin, hasAdminPermission } = require('../middleware/auth');
const Contact = require('../models/Contact');

// Get all contact messages
router.get('/', isLoggedIn, hasAdminPermission('manage_contact_messages'), async (req, res) => {
  try {
    // Get search parameters
    const { search, status, dateRange, sortBy, sortOrder } = req.query;

    // Build filter object
    const filter = {};

    // Status filter
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
      } else if (dateRange === 'this-year') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const endOfYear = new Date(now.getFullYear(), 11, 31);
        filter.createdAt = { $gte: startOfYear, $lte: endOfYear };
      }
    }

    // Build sort options
    let sortOptions = { createdAt: -1 }; // Default sort
    if (sortBy) {
      const order = sortOrder === 'asc' ? 1 : -1;
      sortOptions = { [sortBy]: order };
    }

    // Get contact messages with filters
    let messages = await Contact.find(filter).sort(sortOptions);

    // Apply text search
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      messages = messages.filter(message => {
        const name = (message.name || '').toLowerCase();
        const email = (message.email || '').toLowerCase();
        const subject = (message.subject || '').toLowerCase();
        const messageText = (message.message || '').toLowerCase();

        return name.includes(searchTerm) ||
          email.includes(searchTerm) ||
          subject.includes(searchTerm) ||
          messageText.includes(searchTerm);
      });
    }

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
      searchParams: {
        search: search || '',
        status: status || 'all',
        dateRange: dateRange || 'all',
        sortBy: sortBy || 'createdAt',
        sortOrder: sortOrder || 'desc'
      },
      stats: {
        new: newCount,
        read: readCount,
        replied: repliedCount,
        archived: archivedCount,
        total: totalCount,
        filtered: messages.length
      }
    });
  } catch (error) {
    console.error('Error fetching contact messages:', error);
    req.flash('error', 'Failed to load contact messages');
    res.redirect('/admin');
  }
});

// Export contact messages to CSV
router.get('/export', isLoggedIn, hasAdminPermission('manage_contact_messages'), async (req, res) => {
  try {
    // Get search parameters (same as main route)
    const { search, status, dateRange, sortBy, sortOrder } = req.query;

    // Build filter object
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
      } else if (dateRange === 'this-year') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const endOfYear = new Date(now.getFullYear(), 11, 31);
        filter.createdAt = { $gte: startOfYear, $lte: endOfYear };
      }
    }

    // Build sort options
    let sortOptions = { createdAt: -1 };
    if (sortBy) {
      const order = sortOrder === 'asc' ? 1 : -1;
      sortOptions = { [sortBy]: order };
    }

    // Get messages with filters
    let messages = await Contact.find(filter).sort(sortOptions);

    // Apply text search
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      messages = messages.filter(message => {
        const name = (message.name || '').toLowerCase();
        const email = (message.email || '').toLowerCase();
        const subject = (message.subject || '').toLowerCase();
        const messageText = (message.message || '').toLowerCase();

        return name.includes(searchTerm) ||
          email.includes(searchTerm) ||
          subject.includes(searchTerm) ||
          messageText.includes(searchTerm);
      });
    }

    // Generate CSV content
    const csvHeader = 'Name,Email,Subject,Message,Status,Date Received\n';
    const csvRows = messages.map(message => {
      const name = `"${(message.name || '').replace(/"/g, '""')}"`;
      const email = `"${(message.email || '').replace(/"/g, '""')}"`;
      const subject = `"${(message.subject || '').replace(/"/g, '""')}"`;
      const messageText = `"${(message.message || '').replace(/"/g, '""')}"`;
      const status = message.status || '';
      const dateReceived = new Date(message.createdAt).toLocaleDateString();

      return `${name},${email},${subject},${messageText},${status},${dateReceived}`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // Set response headers for file download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `contact_messages_export_${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Export contact messages error:', error);
    req.flash('error', 'Failed to export contact messages');
    res.redirect('/admin/contact-messages');
  }
});

// View a single message
router.get('/:id', isLoggedIn, hasAdminPermission('manage_contact_messages'), async (req, res) => {
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
router.post('/:id/status', isLoggedIn, hasAdminPermission('manage_contact_messages'), async (req, res) => {
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

// Delete Contact Message Confirmation Page
router.get('/delete/:id/confirm', isLoggedIn, hasAdminPermission('manage_contact_messages'), async (req, res) => {
  try {
    const message = await Contact.findById(req.params.id);

    if (!message) {
      req.flash('error', 'Contact message not found');
      return res.redirect('/admin/contact-messages');
    }

    res.render('admin/contact-messages/delete-message-confirm', {
      layout: 'admin',
      currentPath: '/admin/contact-messages',
      title: 'Delete Contact Message',
      message
    });
  } catch (error) {
    console.error('Error loading delete confirmation:', error);
    req.flash('error', 'Failed to load delete confirmation page');
    res.redirect('/admin/contact-messages');
  }
});

// Delete a message (POST route)
router.post('/delete/:id', isLoggedIn, hasAdminPermission('manage_contact_messages'), async (req, res) => {
  try {
    const message = await Contact.findById(req.params.id);

    if (!message) {
      req.flash('error', 'Contact message not found');
      return res.redirect('/admin/contact-messages');
    }

    // Store info for success message
    const senderName = message.name || 'Unknown Sender';
    const subject = message.subject || 'No Subject';

    await Contact.findByIdAndDelete(req.params.id);

    req.flash('success', `Successfully deleted message from ${senderName} (${subject})`);
    res.redirect('/admin/contact-messages');
  } catch (error) {
    console.error('Error deleting message:', error);
    req.flash('error', 'Failed to delete message');
    res.redirect('/admin/contact-messages');
  }
});

// Bulk Delete Contact Messages
router.post('/bulk-delete', isLoggedIn, hasAdminPermission('manage_contact_messages'), async (req, res) => {
  try {
    const { messageIds } = req.body;

    if (!messageIds || messageIds.length === 0) {
      req.flash('error', 'No messages selected for deletion');
      return res.redirect('/admin/contact-messages');
    }

    // Ensure messageIds is an array
    const idsArray = Array.isArray(messageIds) ? messageIds : [messageIds];

    // Delete the messages
    const deleteResult = await Contact.deleteMany({ _id: { $in: idsArray } });

    req.flash('success', `Successfully deleted ${deleteResult.deletedCount} contact message(s)`);
    res.redirect('/admin/contact-messages');
  } catch (error) {
    console.error('Error bulk deleting messages:', error);
    req.flash('error', 'Failed to delete selected messages');
    res.redirect('/admin/contact-messages');
  }
});

// Delete a message (legacy DELETE route - keeping for compatibility)
router.delete('/:id', isLoggedIn, hasAdminPermission('manage_contact_messages'), async (req, res) => {
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
