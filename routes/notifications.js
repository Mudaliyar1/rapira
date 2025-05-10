const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const { isLoggedIn, isAdmin } = require('../middleware/auth');

// Notification utility function to create notifications
const createNotification = async (module, requestId, modelRef, description, link) => {
  try {
    const notification = new Notification({
      module,
      requestId,
      modelRef,
      description,
      link
    });

    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};

// Get all notifications for admin dashboard
router.get('/', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get query parameters for filtering
    const { status, module, read } = req.query;

    // Build filter object
    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (module) {
      filter.module = module;
    }

    if (read === 'true') {
      filter.isRead = true;
    } else if (read === 'false') {
      filter.isRead = false;
    }

    // Get notifications with pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const totalCount = await Notification.countDocuments(filter);

    // Get notifications
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get unique modules for filter dropdown
    const modules = await Notification.distinct('module');

    // Get counts for dashboard
    const pendingCount = await Notification.countDocuments({ status: 'Pending' });
    const unreadCount = await Notification.countDocuments({ isRead: false });

    res.render('admin/notifications/index', {
      layout: 'admin',
      currentPath: '/admin/notifications',
      title: 'Notification Management',
      notifications,
      modules,
      filter: {
        status,
        module,
        read
      },
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      },
      counts: {
        pending: pendingCount,
        unread: unreadCount
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    req.flash('error', 'Failed to load notifications');
    res.redirect('/admin');
  }
});

// Mark notification as read
router.post('/mark-read/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    notification.isRead = true;
    await notification.save();

    return res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read'
    });
  }
});

// Mark all notifications as read
router.post('/mark-all-read', isLoggedIn, isAdmin, async (req, res) => {
  try {
    await Notification.updateMany(
      { isRead: false },
      { $set: { isRead: true } }
    );

    return res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read'
    });
  }
});

// Get unread notification count (for AJAX requests)
router.get('/unread-count', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ isRead: false });

    return res.json({
      success: true,
      count
    });
  } catch (error) {
    console.error('Error getting unread notification count:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get unread notification count'
    });
  }
});

// Get notification counts by module (for dashboard)
router.get('/module-counts', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get all pending notifications
    const notifications = await Notification.find({ status: 'Pending' });

    // Count notifications by module
    const counts = {};
    notifications.forEach(notification => {
      const module = notification.module;
      counts[module] = (counts[module] || 0) + 1;
    });

    // Get total count
    const total = notifications.length;

    return res.json({
      success: true,
      counts,
      total
    });
  } catch (error) {
    console.error('Error getting notification module counts:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get notification module counts'
    });
  }
});

// Delete a notification - POST route for direct form submissions
router.post('/delete/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      req.flash('error', 'Notification not found');
      return res.redirect('/admin/notifications');
    }

    await Notification.findByIdAndDelete(req.params.id);

    req.flash('success', 'Notification deleted successfully');
    return res.redirect('/admin/notifications');
  } catch (error) {
    console.error('Error deleting notification:', error);
    req.flash('error', 'Failed to delete notification');
    return res.redirect('/admin/notifications');
  }
});

// Delete a notification (supports both DELETE and POST with _method=DELETE)
router.delete('/delete/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    await Notification.findByIdAndDelete(req.params.id);

    // Check if the request expects JSON or HTML
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.json({
        success: true,
        message: 'Notification deleted successfully'
      });
    } else {
      // For form submissions, redirect back with a flash message
      req.flash('success', 'Notification deleted successfully');
      return res.redirect('/admin/notifications');
    }
  } catch (error) {
    console.error('Error deleting notification:', error);

    // Check if the request expects JSON or HTML
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.status(500).json({
        success: false,
        message: 'Failed to delete notification'
      });
    } else {
      // For form submissions, redirect back with a flash message
      req.flash('error', 'Failed to delete notification');
      return res.redirect('/admin/notifications');
    }
  }
});

// Delete all notifications - POST route for direct form submissions
router.post('/delete-all', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get filter parameters
    const { status, module, read } = req.body;

    // Build filter object
    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (module) {
      filter.module = module;
    }

    if (read === 'true') {
      filter.isRead = true;
    } else if (read === 'false') {
      filter.isRead = false;
    }

    // Delete notifications based on filter
    const result = await Notification.deleteMany(filter);
    const message = `${result.deletedCount} notifications deleted successfully`;

    req.flash('success', message);
    return res.redirect('/admin/notifications');
  } catch (error) {
    console.error('Error deleting all notifications:', error);
    req.flash('error', 'Failed to delete notifications');
    return res.redirect('/admin/notifications');
  }
});

// Delete all notifications (supports both DELETE and POST with _method=DELETE)
router.delete('/delete-all', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get filter parameters
    const { status, module, read } = req.body;

    // Build filter object
    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (module) {
      filter.module = module;
    }

    if (read === 'true') {
      filter.isRead = true;
    } else if (read === 'false') {
      filter.isRead = false;
    }

    // Delete notifications based on filter
    const result = await Notification.deleteMany(filter);
    const message = `${result.deletedCount} notifications deleted successfully`;

    // Check if the request expects JSON or HTML
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.json({
        success: true,
        message: message
      });
    } else {
      // For form submissions, redirect back with a flash message
      req.flash('success', message);
      return res.redirect('/admin/notifications');
    }
  } catch (error) {
    console.error('Error deleting all notifications:', error);

    // Check if the request expects JSON or HTML
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.status(500).json({
        success: false,
        message: 'Failed to delete notifications'
      });
    } else {
      // For form submissions, redirect back with a flash message
      req.flash('error', 'Failed to delete notifications');
      return res.redirect('/admin/notifications');
    }
  }
});

// Export the router and the createNotification utility function
module.exports = {
  router,
  createNotification
};