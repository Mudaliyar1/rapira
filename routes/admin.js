const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('../models/User');
const UserRole = require('../models/UserRole');
const Role = require('../models/Role');
const Artist = require('../models/Artist');
const Venue = require('../models/Venue');
const Concert = require('../models/Concert');
const Ticket = require('../models/Ticket');
const Content = require('../models/Content');
const Page = require('../models/Page');
const DeletedAccount = require('../models/DeletedAccount');
const ArtistPost = require('../models/ArtistPost');
const Transaction = require('../models/Transaction');
const ArtistUnblockRequest = require('../models/ArtistUnblockRequest');
const AccountRecoveryToken = require('../models/AccountRecoveryToken');
const { deleteMedia } = require('../utils/mediaService');
const { isLoggedIn, isAdmin, hasAdminPermission } = require('../middleware/auth');
const { sendConcertApprovalEmail, sendConcertRejectionEmail, sendTestEmail, sendDirectEmail } = require('../utils/emailService');
const { sendAccountDeletionNotification } = require('../utils/brevoEmailService');
const { getAllCollectionStats, formatBytes } = require('../utils/storageStats');
const bcrypt = require('bcryptjs');

// Permission denied page
router.get('/permission-denied', isLoggedIn, (req, res) => {
  res.render('admin/permission-denied', {
    layout: 'admin',
    currentPath: '/admin',
    title: 'Permission Denied'
  });
});

// Test email route
router.get('/test-email', isLoggedIn, hasAdminPermission('manage_admins'), async (req, res) => {
  try {
    const email = req.query.email || req.session.user.email;

    if (!email) {
      req.flash('error', 'No email provided');
      return res.redirect('/admin');
    }

    console.log('Testing email delivery to:', email);
    const result = await sendTestEmail(email);

    if (result.success) {
      req.flash('success', `Test email sent successfully to ${email} using ${result.method} method`);
    } else {
      req.flash('error', `Failed to send test email: ${result.error}`);
    }

    res.redirect('/admin');
  } catch (error) {
    console.error('Test email error:', error);
    req.flash('error', 'Failed to send test email');
    res.redirect('/admin');
  }
});

// Admin dashboard
router.get('/', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const user = req.session.user;
    const isSuperAdmin = user.role === 'superAdmin' || user.isSuperAdmin;
    const perms = user.adminPermissions || [];

    // If not Super Admin and doesn't have dashboard permission, redirect to first available feature
    if (!isSuperAdmin && !perms.includes('manage_dashboard')) {
      const PERMISSION_TO_PATH = {
        'manage_users_list': '/admin/users',
        'manage_live_users': '/admin/live-users',
        'manage_artists': '/admin/artists',
        'manage_artist_beat_purchases': '/admin/artist-beat-purchases',
        'manage_unblock_requests': '/admin/unblock-requests',
        'manage_artist_applications': '/artist-applications/admin',
        'manage_producer_applications': '/producer-applications/admin',
        'manage_distributor_applications': '/distributor-applications/admin',
        'manage_distributor_list': '/distributor-applications/admin/list',
        'manage_producers': '/admin/producers',
        'manage_producer_beats': '/admin/producers/beats',
        'manage_producer_unblock': '/admin/producers/unblock-requests',
        'manage_follower_analytics': '/admin/follower-analytics',
        'manage_artist_upgrades': '/admin/artist-upgrade-requests',
        'manage_roles': '/roles',
        'manage_user_roles': '/roles/user-roles',
        'manage_deleted_accounts': '/admin/deleted-accounts',
        'manage_concerts_list': '/admin/concerts',
        'manage_venues': '/admin/venues',
        'manage_venue_requests': '/admin/venue-requests',
        'manage_venue_edit_requests': '/admin/venue-edit-requests',
        'manage_venue_bookings': '/admin/venue-bookings',
        'manage_concerts_pending': '/admin/concerts/pending',
        'manage_concert_edit_requests': '/admin/concert-edit-requests',
        'manage_tickets': '/admin/tickets',
        'manage_free_ticket_issue': '/admin/tickets/free-issue',
        'manage_refund_requests': '/admin/refund-requests',
        'manage_daily_concerts': '/admin/daily-concerts',
        'manage_content_feature': '/admin/content',
        'manage_artist_posts': '/admin/posts',
        'manage_pages': '/admin/pages',
        'manage_about_us': '/admin/about-us',
        'manage_learning_modules': '/learning/admin',
        'manage_notifications': '/admin/notifications',
        'manage_website_settings': '/admin/website-settings',
        'manage_storage_management': '/admin/storage-management',
        'manage_payments': '/admin/payments',
        'manage_revenue_analysis': '/admin/revenue-analysis',
        'manage_admins': '/admin/super/manage-admins'
      };

      // Find the first permission that has a path
      const firstAvailablePerm = perms.find(p => PERMISSION_TO_PATH[p]);

      if (firstAvailablePerm) {
        return res.redirect(PERMISSION_TO_PATH[firstAvailablePerm]);
      } else {
        req.flash('error', 'You do not have access to any admin features.');
        return res.redirect('/');
      }
    }

    // Get counts for dashboard
    const userCount = await User.countDocuments();
    const artistCount = await Artist.countDocuments();
    const concertCount = await Concert.countDocuments();
    const ticketCount = await Ticket.countDocuments();
    const contentCount = await Content.countDocuments();

    // Get pending concerts
    const pendingConcerts = await Concert.countDocuments({ status: 'pending' });

    // Get recent tickets
    const recentTickets = await Ticket.find()
      .sort({ purchaseDate: -1 })
      .limit(5)
      .populate('user', 'name email')
      .populate('concert', 'title date');

    // Get upcoming concerts
    const upcomingConcerts = await Concert.find({
      status: 'approved',
      date: { $gte: new Date() }
    })
      .sort({ date: 1 })
      .limit(5)
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name' }
      });

    // Calculate revenue
    const tickets = await Ticket.find({ paymentStatus: 'completed' });
    const totalRevenue = tickets.reduce((sum, ticket) => sum + ticket.totalAmount, 0);

    // Get concert stats
    const paidConcerts = await Concert.countDocuments({ isPaid: true });
    const freeConcerts = await Concert.countDocuments({ isPaid: false });

    // Get popular cities
    const cities = await Concert.aggregate([
      { $group: { _id: '$city', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Get distribution stats
    const DistributionRequest = require('../models/DistributionRequest');
    const distEarnings = await DistributionRequest.find({ paymentStatus: 'paid' });
    const totalDistRevenue = distEarnings.reduce((sum, req) => sum + (req.totalPaid || 0), 0);
    const distStats = {
      paid: await DistributionRequest.countDocuments({ paymentStatus: 'paid' }),
      free: await DistributionRequest.countDocuments({ paymentStatus: 'free' }),
      pending: await DistributionRequest.countDocuments({ status: 'pending' })
    };

    res.render('admin/dashboard-fixed', {
      layout: 'admin',
      currentPath: '/admin',
      counts: {
        users: userCount,
        artists: artistCount,
        concerts: concertCount,
        tickets: ticketCount,
        content: contentCount,
        pendingConcerts
      },
      recentTickets,
      upcomingConcerts,
      totalRevenue,
      concertStats: {
        paid: paidConcerts,
        free: freeConcerts
      },
      popularCities: cities,
      distStats,
      totalDistRevenue,
      user: req.session.user // Pass the user object to the template
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    req.flash('error', 'Failed to load admin dashboard');
    res.redirect('/');
  }
});

// Live Users by Page - dashboard view
router.get('/live-users', isLoggedIn, hasAdminPermission('manage_live_users'), async (req, res) => {
  try {
    const initialPage = req.query.page || '';
    const threshold = new Date(Date.now() - 10 * 1000); // last 10 seconds
    const users = await User.find({
      lastPageUpdate: { $gte: threshold }
    }).select('_id name email role currentPage lastPageUpdate');

    // Group by currentPage
    const pageMap = new Map();
    users.forEach(u => {
      const page = u.currentPage || 'Unknown';
      if (!pageMap.has(page)) pageMap.set(page, []);
      pageMap.get(page).push(u);
    });

    const pages = Array.from(pageMap.entries()).map(([page, list]) => ({
      page,
      count: list.length
    })).sort((a, b) => b.count - a.count || a.page.localeCompare(b.page));

    let initialPageUsers = [];
    if (initialPage && pageMap.has(initialPage)) {
      initialPageUsers = pageMap.get(initialPage).map(u => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        currentPage: u.currentPage || 'Unknown',
        lastPageUpdate: u.lastPageUpdate
      }));
    }

    res.render('admin/live-users', {
      layout: 'admin',
      currentPath: '/admin/live-users',
      title: 'Live Users by Page',
      pages,
      users,
      initialPage,
      initialPageUsers
    });
  } catch (error) {
    console.error('Live users view error:', error);
    req.flash('error', 'Failed to load live users');
    res.redirect('/admin');
  }
});

// Live Users by Page - JSON data for polling
router.get('/live-users/data', isLoggedIn, hasAdminPermission('manage_live_users'), async (req, res) => {
  try {
    const threshold = new Date(Date.now() - 10 * 1000);
    const users = await User.find({
      lastPageUpdate: { $gte: threshold }
    }).select('_id name email role currentPage lastPageUpdate');

    const pageMap = new Map();
    users.forEach(u => {
      const page = u.currentPage || 'Unknown';
      if (!pageMap.has(page)) pageMap.set(page, []);
      pageMap.get(page).push({
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        currentPage: page,
        lastPageUpdate: u.lastPageUpdate
      });
    });

    const pages = Array.from(pageMap.entries()).map(([page, list]) => ({
      page,
      count: list.length,
      users: list
    })).sort((a, b) => b.count - a.count || a.page.localeCompare(b.page));

    res.json({
      success: true,
      totalOnline: users.length,
      pages
    });
  } catch (error) {
    console.error('Live users data error:', error);
    res.json({ success: false, message: 'Failed to load data' });
  }
});

// Manage users
router.get('/users', isLoggedIn, hasAdminPermission('manage_users_list'), async (req, res) => {
  try {
    const dummyDataHelper = require('../utils/dummyDataHelper');

    // Get search parameters
    const { search, role, status, sortBy, sortOrder } = req.query;

    // Build search query
    let query = {};

    // Text search (name or email)
    if (search && search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { email: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    // Role filter (supports base roles + venue/custom roles)
    if (role && role !== 'all') {
      if (['user', 'artist', 'admin'].includes(role)) {
        query.role = role;
      } else if (role === 'venue') {
        const venueRoleIds = await Role.find({ name: { $regex: '^venue$', $options: 'i' } })
          .select('_id')
          .lean();
        const assignedVenueUsers = venueRoleIds.length
          ? await UserRole.find({ role: { $in: venueRoleIds.map(r => r._id) } }).distinct('user')
          : [];
        const ownedVenueUsers = await Venue.find({ createdBy: { $exists: true, $ne: null } }).distinct('createdBy');
        const venueUserIds = Array.from(new Set([
          ...assignedVenueUsers.map(id => id.toString()),
          ...ownedVenueUsers.map(id => id.toString())
        ]));
        query._id = { $in: venueUserIds.length ? venueUserIds : ['__none__'] };
      } else {
        // Fallback: match custom role name
        const targetRoles = await Role.find({ name: { $regex: `^${role}$`, $options: 'i' } })
          .select('_id')
          .lean();
        const matchedUsers = targetRoles.length
          ? await UserRole.find({ role: { $in: targetRoles.map(r => r._id) } }).distinct('user')
          : [];
        query._id = { $in: matchedUsers.length ? matchedUsers : ['__none__'] };
      }
    }

    // Status filter (verified/unverified)
    if (status && status !== 'all') {
      query.isVerified = status === 'verified';
    }

    // Build sort options
    let sortOptions = { createdAt: -1 }; // Default sort
    if (sortBy) {
      const order = sortOrder === 'asc' ? 1 : -1;
      sortOptions = { [sortBy]: order };
    }

    // Execute query for real users
    const realUsers = await User.find(query).sort(sortOptions);

    // Fetch assigned roles for these users (for multi-role display)
    let userRoleMap = {};
    if (realUsers.length) {
      const userIds = realUsers.map(u => u._id);
      const userRoles = await UserRole.find({ user: { $in: userIds } })
        .populate('role', 'name icon')
        .lean();

      userRoles.forEach(assignment => {
        if (!assignment.role) return;
        const uid = assignment.user.toString();
        const rid = assignment.role._id.toString();
        if (!userRoleMap[uid]) userRoleMap[uid] = [];
        const exists = userRoleMap[uid].some(r => r.id === rid);
        if (!exists) {
          userRoleMap[uid].push({
            id: rid,
            name: assignment.role.name,
            icon: assignment.role.icon || 'bi-person'
          });
        }
      });

      // Mark users who own a venue
      const venues = await Venue.find({ createdBy: { $in: userIds } }).select('createdBy').lean();
      const venueOwners = new Set(venues.map(v => v.createdBy.toString()));
      venueOwners.forEach(uid => {
        if (!userRoleMap[uid]) userRoleMap[uid] = [];
        const exists = userRoleMap[uid].some(r => r.name && r.name.toLowerCase() === 'venue');
        if (!exists) {
          userRoleMap[uid].push({ id: `venue-${uid}`, name: 'Venue', icon: 'bi-building' });
        }
      });
    }

    // Merge with dummy data if enabled
    const userResult = await dummyDataHelper.mergeWithDummyData(realUsers, 'users', { shuffle: true });

    // Attach assigned roles to each user (post-merge to align with shuffled data)
    if (userResult.data && userResult.data.length) {
      userResult.data.forEach(u => {
        const uid = u && u._id && u._id.toString ? u._id.toString() : null;
        u.assignedRoles = uid && userRoleMap[uid] ? userRoleMap[uid] : [];
      });
    }

    // Get total counts for stats (only real data)
    const totalUsers = await User.countDocuments();
    const verifiedUsers = await User.countDocuments({ isVerified: true });
    const adminUsers = await User.countDocuments({ role: 'admin' });
    const artistUsers = await User.countDocuments({ role: 'artist' });

    res.render('admin/users-new', {
      layout: 'admin',
      currentPath: '/admin/users',
      users: userResult.data,
      searchParams: {
        search: search || '',
        role: role || 'all',
        status: status || 'all',
        sortBy: sortBy || 'createdAt',
        sortOrder: sortOrder || 'desc'
      },
      stats: {
        total: totalUsers,
        verified: verifiedUsers,
        admin: adminUsers,
        artist: artistUsers,
        filtered: userResult.totalCount,
        realCount: userResult.realCount,
        dummyCount: userResult.dummyCount
      },
      hasDummyData: userResult.hasDummyData
    });
  } catch (error) {
    console.error('Manage users error:', error);
    req.flash('error', 'Failed to load users');
    res.redirect('/admin');
  }
});

// View user details page
router.get('/users/:id/details', isLoggedIn, hasAdminPermission('manage_users_list'), async (req, res) => {
  try {
    const Ticket = require('../models/Ticket');
    const UserSubscription = require('../models/UserSubscription');
    const Cart = require('../models/Cart');
    const ActivityLogger = require('../utils/activityLogger');

    const user = await User.findById(req.params.id);
    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/admin/users');
    }

    // Get artist data if user is an artist
    let artist = null;
    if (user.role === 'artist') {
      artist = await Artist.findOne({ user: user._id })
        .populate('blockHistory.blockedBy', 'name')
        .populate('blockHistory.unblockedBy', 'name');
    }

    // Get user's tickets
    const tickets = await Ticket.find({ user: user._id })
      .populate('concert', 'title date')
      .sort({ createdAt: -1 });

    // Get user's subscriptions
    const subscriptions = await UserSubscription.find({ user: user._id })
      .sort({ createdAt: -1 });

    // Get user's cart items (pending purchases)
    const cart = await Cart.findOne({ user: user._id })
      .populate('items.product');

    // Get user's activity history (last 100 entries)
    let activityHistory = await ActivityLogger.getUserHistory(user._id, 100);

    // Advanced filters for activity history
    const {
      type: filterType = 'all',
      performedBy: filterPerformedBy = 'all',
      desc: filterDesc = '',
      oldValue: filterOldValue = '',
      newValue: filterNewValue = '',
      startDate: filterStartDate = '',
      endDate: filterEndDate = ''
    } = req.query;

    // Apply filters in-memory (activityHistory already includes latest 100)
    if (filterType && filterType !== 'all') {
      activityHistory = activityHistory.filter(a => a.activityType === filterType);
    }

    if (filterPerformedBy && filterPerformedBy !== 'all') {
      if (filterPerformedBy === 'self') {
        activityHistory = activityHistory.filter(a => !a.performedBy);
      } else if (filterPerformedBy === 'admin') {
        activityHistory = activityHistory.filter(a => !!a.performedBy);
      }
    }

    if (filterDesc && filterDesc.trim()) {
      const d = filterDesc.trim().toLowerCase();
      activityHistory = activityHistory.filter(a => (a.description || '').toLowerCase().includes(d));
    }

    if (filterOldValue && filterOldValue.trim()) {
      const ov = filterOldValue.trim().toLowerCase();
      activityHistory = activityHistory.filter(a => (a.oldValue || '').toLowerCase().includes(ov));
    }

    if (filterNewValue && filterNewValue.trim()) {
      const nv = filterNewValue.trim().toLowerCase();
      activityHistory = activityHistory.filter(a => (a.newValue || '').toLowerCase().includes(nv));
    }

    if ((filterStartDate && filterStartDate.trim()) || (filterEndDate && filterEndDate.trim())) {
      const start = filterStartDate ? new Date(filterStartDate + 'T00:00:00.000Z') : null;
      const end = filterEndDate ? new Date(filterEndDate + 'T23:59:59.999Z') : null;
      activityHistory = activityHistory.filter(a => {
        const ts = new Date(a.createdAt);
        if (start && ts < start) return false;
        if (end && ts > end) return false;
        return true;
      });
    }

    // Limit and View More mechanics
    const parsedLimit = parseInt(req.query.limit, 10);
    const filterLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 3;
    const activityTotal = activityHistory.length;
    const activityHistoryDisplay = activityHistory.slice(0, Math.min(filterLimit, activityTotal));
    const hasMore = activityTotal > activityHistoryDisplay.length;
    const nextLimit = Math.min(filterLimit + 3, activityTotal || filterLimit + 3);

    // Get password-related activities
    const passwordChanges = activityHistory.filter(a => a.activityType === 'password_change');
    const lastPasswordChange = passwordChanges.length > 0 ? passwordChanges[0].createdAt : user.createdAt;
    const totalPasswordChanges = passwordChanges.length;
    const failedLogins = activityHistory.filter(a => a.activityType === 'failed_login').length;
    const successfulLogins = activityHistory.filter(a => a.activityType === 'login').length;

    // Calculate activity stats
    const ticketCount = tickets.length;
    const ticketsPurchased = tickets.filter(t => t.paymentStatus === 'completed').length;
    const refundedTickets = tickets.filter(t => t.paymentStatus === 'refunded').length;
    const activeSubscriptions = subscriptions.filter(s => s.status === 'active').length;
    const totalSpent = tickets
      .filter(t => t.paymentStatus === 'completed' && t.paymentId !== 'ADMIN_FREE_TICKET')
      .reduce((sum, t) => sum + (t.totalAmount || 0), 0);

    // Load additional assigned roles (e.g., Venue) for the user
    const userRoles = await UserRole.find({ user: user._id })
      .populate('role', 'name icon')
      .lean();
    const assignedRoles = userRoles
      .filter(ur => ur.role)
      .map(ur => ({
        id: ur.role._id.toString(),
        name: ur.role.name,
        icon: ur.role.icon || 'bi-person'
      }));

    // If the user owns a venue, add a Venue role badge
    const hasVenue = await Venue.exists({ createdBy: user._id });
    if (hasVenue) {
      const alreadyVenue = assignedRoles.some(r => r.name && r.name.toLowerCase() === 'venue');
      if (!alreadyVenue) {
        assignedRoles.push({ id: `venue-${user._id.toString()}`, name: 'Venue', icon: 'bi-building' });
      }
    }

    res.render('admin/user-details', {
      layout: 'admin',
      currentPath: '/admin/users',
      user,
      artist,
      assignedRoles,
      tickets,
      subscriptions,
      cart,
      activityHistory,
      activityHistoryDisplay,
      stats: {
        ticketCount,
        ticketsPurchased,
        refundedTickets,
        activeSubscriptions,
        totalSpent,
        lastLogin: user.lastLogin,
        currentLoginTime: user.currentLoginTime,
        isOnline: user.isOnline,
        lastPasswordChange,
        totalPasswordChanges,
        failedLogins,
        successfulLogins,
        accountAge: Math.floor((new Date() - user.createdAt) / (1000 * 60 * 60 * 24))
      },
      // Pass filter values and type options to view
      activityFilters: {
        filterType,
        filterPerformedBy,
        filterDesc,
        filterOldValue,
        filterNewValue,
        filterStartDate,
        filterEndDate
      },
      activityTypes: [
        'login',
        'logout',
        'failed_login',
        'password_change',
        'profile_update',
        'profile_image_change',
        'email_change',
        'name_change',
        'role_change'
      ],
      activityTotal,
      hasMore,
      nextLimit,
      activityLimit: filterLimit,
      activityFilters: {
        ...(
          typeof activityFilters !== 'undefined' ? activityFilters : {}
        ),
        filterLimit
      }
    });
  } catch (error) {
    console.error('View user details error:', error);
    req.flash('error', 'Failed to load user details');
    res.redirect('/admin/users');
  }
});

// Admin force password reset
router.post('/users/:id/reset-password', isLoggedIn, hasAdminPermission('manage_users_list'), async (req, res) => {
  try {
    const { newPassword, confirmPassword, notifyUser } = req.body;
    const ActivityLogger = require('../utils/activityLogger');

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      req.flash('error', 'Passwords do not match');
      return res.redirect(`/admin/users/${req.params.id}/details`);
    }

    // Validate password length
    if (newPassword.length < 6) {
      req.flash('error', 'Password must be at least 6 characters');
      return res.redirect(`/admin/users/${req.params.id}/details`);
    }

    // Find user
    const user = await User.findById(req.params.id);
    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/admin/users');
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Log the password change by admin
    await ActivityLogger.log({
      userId: user._id,
      activityType: 'password_change',
      description: `Password was reset by admin ${req.session.user.name}`,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      performedBy: req.session.user.id
    });

    // Send email notification if checked
    if (notifyUser) {
      const { sendEmail } = require('../utils/brevoEmailService');
      try {
        await sendEmail({
          to: user.email,
          subject: 'Your Password Has Been Reset',
          html: `
            <h2>Password Reset Notification</h2>
            <p>Hello ${user.name},</p>
            <p>Your password has been reset by an administrator.</p>
            <p>If you did not request this change, please contact support immediately.</p>
            <p>You can now log in with your new password.</p>
            <hr>
            <p style="color: #666; font-size: 12px;">This is an automated message from RAPIRA.</p>
          `
        });
      } catch (emailError) {
        console.error('Failed to send password reset notification:', emailError);
      }
    }

    req.flash('success', `Password reset successfully for ${user.name}`);
    res.redirect(`/admin/users/${user._id}/details`);
  } catch (error) {
    console.error('Admin password reset error:', error);
    req.flash('error', 'Failed to reset password');
    res.redirect(`/admin/users/${req.params.id}/details`);
  }
});

// Export users to CSV
router.get('/users/export', isLoggedIn, hasAdminPermission('manage_users_list'), async (req, res) => {
  try {
    // Get search parameters (same as main users route)
    const { search, role, status, sortBy, sortOrder } = req.query;

    // Build search query
    let query = {};

    // Text search (name or email)
    if (search && search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { email: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    // Role filter
    if (role && role !== 'all') {
      query.role = role;
    }

    // Status filter (verified/unverified)
    if (status && status !== 'all') {
      query.isVerified = status === 'verified';
    }

    // Build sort options
    let sortOptions = { createdAt: -1 }; // Default sort
    if (sortBy) {
      const order = sortOrder === 'asc' ? 1 : -1;
      sortOptions = { [sortBy]: order };
    }

    // Execute query
    const users = await User.find(query).sort(sortOptions);

    // Generate CSV content
    const csvHeader = 'Name,Email,Role,Verified,Join Date,City,Bio\n';
    const csvRows = users.map(user => {
      const name = `"${user.name.replace(/"/g, '""')}"`;
      const email = `"${user.email.replace(/"/g, '""')}"`;
      const role = user.role;
      const verified = user.isVerified ? 'Yes' : 'No';
      const joinDate = new Date(user.createdAt).toLocaleDateString();
      const city = `"${(user.city || '').replace(/"/g, '""')}"`;
      const bio = `"${(user.bio || '').replace(/"/g, '""')}"`;

      return `${name},${email},${role},${verified},${joinDate},${city},${bio}`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // Set response headers for file download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `users_export_${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Export users error:', error);
    req.flash('error', 'Failed to export users');
    res.redirect('/admin/users');
  }
});

// Add user page
router.get('/users/add', isLoggedIn, hasAdminPermission('manage_users_list'), (req, res) => {
  res.render('admin/add-user-new', {
    layout: 'admin',
    currentPath: '/admin/users'
  });
});

// Add user process
router.post('/users/add', isLoggedIn, hasAdminPermission('manage_users_list'), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validate input
    if (!name || !email || !password || !role) {
      req.flash('error', 'Please fill in all fields');
      return res.redirect('/admin/users/add');
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      req.flash('error', 'Email already registered');
      return res.redirect('/admin/users/add');
    }

    // Create user
    const newUser = new User({
      name,
      email,
      password,
      role
    });

    await newUser.save();

    // If creating an artist, create artist profile
    if (role === 'artist') {
      const newArtist = new Artist({
        user: newUser._id,
        stageName: name, // Default to user name, can be updated later
        genre: 'Hip Hop' // Default genre, can be updated later
      });

      await newArtist.save();
    }

    req.flash('success', 'User added successfully');
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Add user error:', error);
    req.flash('error', 'Failed to add user');
    res.redirect('/admin/users/add');
  }
});

// Edit user page
router.get('/users/:id/edit', isLoggedIn, hasAdminPermission('manage_users_list'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/admin/users');
    }

    // Protection: Administrator accounts must be managed through the dedicated Admin Management panel
    if (user.role === 'admin' || user.role === 'superAdmin') {
      req.flash('info', 'Administrator accounts must be managed through the Admin Management panel.');
      return res.redirect('/admin/super/manage-admins');
    }

    let producerRole = await Role.findOne({ name: { $regex: '^producer$', $options: 'i' } });
    const hasProducerRole = producerRole
      ? await UserRole.exists({ user: user._id, role: producerRole._id })
      : false;

    let distributorRole = await Role.findOne({ name: { $regex: '^distributor$', $options: 'i' } });
    const hasDistributorRole = distributorRole
      ? await UserRole.exists({ user: user._id, role: distributorRole._id })
      : false;

    res.render('admin/edit-user', {
      user,
      hasProducerRole,
      hasDistributorRole,
      layout: 'admin',
      currentPath: '/admin/users'
    });
  } catch (error) {
    console.error('Edit user error:', error);
    req.flash('error', 'Failed to load user');
    res.redirect('/admin/users');
  }
});

// GET Delete Confirmation Page
router.get('/users/:id/delete-confirm', isLoggedIn, hasAdminPermission('manage_users_list'), async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      req.flash('error', 'User not found');
      return res.redirect('/admin/users');
    }

    // Protection: Cannot delete admins here
    if (targetUser.role === 'admin' || targetUser.role === 'superAdmin') {
      req.flash('error', 'Administrator accounts cannot be deleted from the general user list.');
      return res.redirect('/admin/super/manage-admins');
    }

    res.render('admin/confirm-delete-user', {
      layout: 'admin',
      currentPath: '/admin/users',
      title: 'Confirm Delete User',
      targetUser
    });
  } catch (error) {
    console.error('Delete confirm error:', error);
    res.redirect('/admin/users');
  }
});

// Update user
router.post('/users/:id/update', isLoggedIn, hasAdminPermission('manage_users_list'), async (req, res) => {
  try {
    const { role, makeProducer, makeDistributor } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/admin/users');
    }

    // Protection: Admins cannot be modified via this route
    if (user.role === 'admin' || user.role === 'superAdmin') {
      req.flash('error', 'Administrator protection enabled. Use Admin Management panel.');
      return res.redirect('/admin/super/manage-admins');
    }

    // Only update role if it's different
    if (user.role !== role) {
      // If changing to artist, create artist profile if it doesn't exist
      if (role === 'artist' && user.role !== 'artist') {
        const existingArtist = await Artist.findOne({ user: user._id });

        if (!existingArtist) {
          const newArtist = new Artist({
            user: user._id,
            stageName: user.name,
            genre: 'Hip Hop'
          });

          await newArtist.save();
        }
      }
      // If changing from artist to user, delete the artist profile
      else if (role === 'user' && user.role === 'artist') {
        const artist = await Artist.findOne({ user: user._id });

        if (artist) {
          // Delete artist's concerts
          await Concert.deleteMany({ artist: artist._id });
          console.log(`Deleted all concerts for artist ${artist._id}`);

          // Delete artist's content
          await Content.deleteMany({ artist: artist._id });
          console.log(`Deleted all content for artist ${artist._id}`);

          // Delete artist profile
          await Artist.findByIdAndDelete(artist._id);
          console.log(`Deleted artist profile ${artist._id} when changing user role from artist to user`);
        }
      }

      user.role = role;
    }

    let producerRole = await Role.findOne({ name: { $regex: '^producer$', $options: 'i' } });
    if (!producerRole && makeProducer === 'on') {
      producerRole = new Role({
        name: 'Producer',
        description: 'Music producer role with artist messaging access',
        icon: 'bi-mic-fill',
        createdBy: req.session.user.id
      });
      await producerRole.save();
    }

    if (producerRole) {
      if (makeProducer === 'on') {
        await UserRole.findOneAndUpdate(
          { user: user._id, role: producerRole._id },
          { user: user._id, role: producerRole._id },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } else {
        await UserRole.findOneAndDelete({ user: user._id, role: producerRole._id });
      }
    }

    let distributorRole = await Role.findOne({ name: { $regex: '^distributor$', $options: 'i' } });
    if (!distributorRole && makeDistributor === 'on') {
      distributorRole = new Role({
        name: 'Distributor',
        description: 'Music and Video content distributor',
        icon: 'bi-box-seam',
        createdBy: req.session.user.id
      });
      await distributorRole.save();
    }

    if (distributorRole) {
      if (makeDistributor === 'on') {
        await UserRole.findOneAndUpdate(
          { user: user._id, role: distributorRole._id },
          { user: user._id, role: distributorRole._id },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } else {
        await UserRole.findOneAndDelete({ user: user._id, role: distributorRole._id });
      }
    }

    await user.save();

    req.flash('success', 'User updated successfully');
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Update user error:', error);
    req.flash('error', 'Failed to update user');
    res.redirect(`/admin/users/${req.params.id}/edit`);
  }
});

// Delete user
router.post('/users/:id/delete', isLoggedIn, hasAdminPermission('manage_users_list'), async (req, res) => {
  try {
    const userId = req.params.id;
    const targetUser = await User.findById(userId);

    if (!targetUser) {
      req.flash('error', 'User not found');
      return res.redirect('/admin/users');
    }

    // Safety: Prevent deleting self
    if (userId === req.session.user.id) {
      req.flash('error', 'You cannot delete your own account.');
      return res.redirect('/admin/users');
    }

    // Protection: Cannot delete admins or superAdmins from here
    if (targetUser.role === 'admin' || targetUser.role === 'superAdmin') {
      req.flash('error', 'Administrators can only be deleted via the Admin Management panel.');
      return res.redirect('/admin/super/manage-admins');
    }

    // Safety: Standard admins cannot delete super admins (even if they bypass the UI)
    if (req.session.user.role !== 'superAdmin' && targetUser.role === 'superAdmin') {
      req.flash('error', 'Only Super Admins can manage Super Admin accounts.');
      return res.redirect('/admin/users');
    }

    const user = targetUser;

    // Check if user is an artist
    if (user.role === 'artist') {
      // Find artist profile
      const artist = await Artist.findOne({ user: user._id });

      if (artist) {
        // Delete artist's concerts
        await Concert.deleteMany({ artist: artist._id });
        console.log(`Deleted all concerts for artist ${artist._id}`);

        // Delete artist's content
        await Content.deleteMany({ artist: artist._id });
        console.log(`Deleted all content for artist ${artist._id}`);

        // Delete artist profile
        await Artist.findByIdAndDelete(artist._id);
        console.log(`Deleted artist profile ${artist._id}`);
      }
    }

    // Delete user's tickets
    await Ticket.deleteMany({ user: user._id });
    console.log(`Deleted all tickets for user ${user._id}`);

    // Generate recovery token (valid for 30 days) 
    const recoveryToken = crypto.randomBytes(32).toString('hex');
    const recoveryTokenDoc = new AccountRecoveryToken({
      user: user._id,
      email: user.email,
      token: recoveryToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });

    await recoveryTokenDoc.save();
    console.log(`Created recovery token for deleted user: ${user._id}`);

    // Send account deletion notification email with recovery option
    try {
      await sendAccountDeletionNotification(user, recoveryToken);
      console.log(`Deletion notification email sent to ${user.email}`);
    } catch (emailError) {
      console.error(`Failed to send deletion notification email: ${emailError.message}`);
      // Don't fail the deletion process if email fails
    }

    // Delete user
    await User.findByIdAndDelete(req.params.id);
    console.log(`Deleted user ${user._id}`);

    req.flash('success', 'User deleted successfully');
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Delete user error:', error);
    req.flash('error', 'Failed to delete user');
    res.redirect('/admin/users');
  }
});

// Manage concerts
router.get('/concerts', isLoggedIn, hasAdminPermission('manage_concerts_list'), async (req, res) => {
  try {
    const dummyDataHelper = require('../utils/dummyDataHelper');

    // Get search parameters
    const { search, status, dateRange, venue, sortBy, sortOrder } = req.query;

    // Build filter object
    const filter = {};

    // Status filter
    if (status && status !== 'all') {
      filter.status = status;
    }

    // Date range filter
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      if (dateRange === 'upcoming') {
        filter.date = { $gte: now };
      } else if (dateRange === 'past') {
        filter.date = { $lt: now };
      } else if (dateRange === 'this-month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        filter.date = { $gte: startOfMonth, $lte: endOfMonth };
      }
    }

    // Build sort options
    let sortOptions = { createdAt: -1 }; // Default sort
    if (sortBy) {
      const order = sortOrder === 'asc' ? 1 : -1;
      sortOptions = { [sortBy]: order };
    }

    // Get real concerts with filters
    let realConcerts = await Concert.find(filter)
      .sort(sortOptions)
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name' }
      })
      .populate('venue', 'name city address');

    // Apply text search on populated data
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      realConcerts = realConcerts.filter(concert => {
        const title = (concert.title || '').toLowerCase();
        const venueName = (concert.venue && concert.venue.name ? concert.venue.name : '').toLowerCase();
        const city = (concert.city || '').toLowerCase();
        const artistName = (concert.artist && concert.artist.user ? concert.artist.user.name : '').toLowerCase();

        return title.includes(searchTerm) ||
          venueName.includes(searchTerm) ||
          city.includes(searchTerm) ||
          artistName.includes(searchTerm);
      });
    }

    // Venue filter (after population)
    if (venue && venue !== 'all') {
      realConcerts = realConcerts.filter(concert =>
        (concert.venue ? (typeof concert.venue === 'string' ? concert.venue : (concert.venue.name || concert.venue.toString())) : '').toLowerCase().includes(venue.toLowerCase())
      );
    }

    // Merge with dummy data if enabled
    const concertResult = await dummyDataHelper.mergeWithDummyData(realConcerts, 'concerts', { shuffle: true });

    // Get statistics (only real data)
    const totalConcerts = await Concert.countDocuments();
    const approvedConcerts = await Concert.countDocuments({ status: 'approved' });
    const pendingConcerts = await Concert.countDocuments({ status: 'pending' });
    const rejectedConcerts = await Concert.countDocuments({ status: 'rejected' });
    const upcomingConcerts = await Concert.countDocuments({
      status: 'approved',
      date: { $gte: new Date() }
    });

    // Get unique venues for filter dropdown
    // First get all concerts with populated venues
    const concertsWithVenues = await Concert.find().populate('venue');
    const venues = [...new Set(concertsWithVenues
      .filter(c => c.venue)
      .map(c => {
        // Handle both string venues and populated venue objects
        if (typeof c.venue === 'string') {
          return c.venue.trim();
        } else if (c.venue && typeof c.venue === 'object' && c.venue.name) {
          return c.venue.name.trim();
        }
        return null;
      })
      .filter(v => v && v.length > 0)
    )].sort();

    res.render('admin/concerts-new', {
      layout: 'admin',
      currentPath: '/admin/concerts',
      title: 'Manage Concerts',
      concerts: concertResult.data,
      venues,
      searchParams: {
        search: search || '',
        status: status || 'all',
        dateRange: dateRange || 'all',
        venue: venue || 'all',
        sortBy: sortBy || 'createdAt',
        sortOrder: sortOrder || 'desc'
      },
      stats: {
        total: totalConcerts,
        approved: approvedConcerts,
        pending: pendingConcerts,
        rejected: rejectedConcerts,
        upcoming: upcomingConcerts,
        filtered: concertResult.totalCount,
        realCount: concertResult.realCount,
        dummyCount: concertResult.dummyCount
      },
      venues,
      hasDummyData: concertResult.hasDummyData
    });
  } catch (error) {
    console.error('Manage concerts error:', error);
    req.flash('error', 'Failed to load concerts');
    res.redirect('/admin');
  }
});

// Export concerts to CSV
router.get('/concerts/export', isLoggedIn, hasAdminPermission('manage_concerts_list'), async (req, res) => {
  try {
    // Get search parameters (same as main concerts route)
    const { search, status, dateRange, venue, sortBy, sortOrder } = req.query;

    // Build filter object
    const filter = {};

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      if (dateRange === 'upcoming') {
        filter.date = { $gte: now };
      } else if (dateRange === 'past') {
        filter.date = { $lt: now };
      } else if (dateRange === 'this-month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        filter.date = { $gte: startOfMonth, $lte: endOfMonth };
      }
    }

    // Build sort options
    let sortOptions = { createdAt: -1 };
    if (sortBy) {
      const order = sortOrder === 'asc' ? 1 : -1;
      sortOptions = { [sortBy]: order };
    }

    // Get concerts with filters
    let concerts = await Concert.find(filter)
      .sort(sortOptions)
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name' }
      });

    // Apply text search
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      concerts = concerts.filter(concert => {
        const title = (concert.title || '').toLowerCase();
        const venue = (concert.venue ? (typeof concert.venue === 'string' ? concert.venue : (concert.venue.name || concert.venue.toString())) : '').toLowerCase();
        const city = (concert.city || '').toLowerCase();
        const artistName = (concert.artist && concert.artist.user ? concert.artist.user.name : '').toLowerCase();

        return title.includes(searchTerm) ||
          venue.includes(searchTerm) ||
          city.includes(searchTerm) ||
          artistName.includes(searchTerm);
      });
    }

    // Venue filter
    if (venue && venue !== 'all') {
      concerts = concerts.filter(concert =>
        (concert.venue ? (typeof concert.venue === 'string' ? concert.venue : (concert.venue.name || concert.venue.toString())) : '').toLowerCase().includes(venue.toLowerCase())
      );
    }

    // Generate CSV content
    const csvHeader = 'Title,Artist,Venue,City,Date,Time,Status,Ticket Price,Max Tickets,Tickets Sold,Created Date\n';
    const csvRows = concerts.map(concert => {
      const title = `"${(concert.title || '').replace(/"/g, '""')}"`;
      const artist = `"${(concert.artist && concert.artist.user ? concert.artist.user.name : '').replace(/"/g, '""')}"`;
      const venue = `"${(concert.venue || '').replace(/"/g, '""')}"`;
      const city = `"${(concert.city || '').replace(/"/g, '""')}"`;
      const date = concert.date ? new Date(concert.date).toLocaleDateString() : '';
      const time = concert.time || '';
      const status = concert.status || '';
      const ticketPrice = concert.ticketPrice || 0;
      const maxTickets = concert.maxTickets || 0;
      const ticketsSold = concert.ticketsSold || 0;
      const createdDate = new Date(concert.createdAt).toLocaleDateString();

      return `${title},${artist},${venue},${city},${date},${time},${status},${ticketPrice},${maxTickets},${ticketsSold},${createdDate}`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // Set response headers for file download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `concerts_export_${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Export concerts error:', error);
    req.flash('error', 'Failed to export concerts');
    res.redirect('/admin/concerts');
  }
});

// Concert details
router.get('/concerts/:id/details', isLoggedIn, hasAdminPermission('manage_concerts_list'), async (req, res) => {
  try {
    const concert = await Concert.findById(req.params.id)
      .populate({
        path: 'artist',
        populate: { path: 'user' }
      })
      .populate('venue'); // Populate venue details

    if (!concert) {
      req.flash('error', 'Concert not found');
      return res.redirect('/admin/concerts');
    }

    // Get ticket count for this concert
    const ticketCount = await Ticket.countDocuments({ concert: concert._id, paymentStatus: 'completed' });

    // Get payment IDs from tickets if concert doesn't have them
    let paymentIds = [];
    let orderIds = [];

    if (!concert.paymentId || !concert.orderId) {
      const tickets = await Ticket.find({
        concert: concert._id,
        paymentStatus: 'completed',
        $or: [
          { paymentId: { $exists: true, $ne: '' } },
          { orderId: { $exists: true, $ne: '' } }
        ]
      }).select('paymentId orderId');

      paymentIds = [...new Set(tickets.map(t => t.paymentId).filter(id => id))];
      orderIds = [...new Set(tickets.map(t => t.orderId).filter(id => id))];
    }

    // Venue payment breakdown
    const totalCost = concert.venueBooking?.totalVenueCost || 0;
    const commissionPercentage = concert.venueBooking?.adminCommission?.percentage || 0;
    const storedCommission = concert.venueBooking?.adminCommission?.advanceAmount;
    const commissionPaid = Number.isFinite(storedCommission) && storedCommission > 0
      ? storedCommission
      : (concert.venueBooking?.isPaid && commissionPercentage > 0
        ? (totalCost * commissionPercentage) / 100
        : 0);
    const artistPaidDirect = concert.venueBooking?.amountPaidByArtist || 0;
    const totalArtistPaid = commissionPaid + artistPaidDirect;
    // Calculate total expected payment (venue cost + commission)
    const totalExpectedPayment = totalCost + commissionPaid;
    const remainingBalance = Math.max(totalExpectedPayment - totalArtistPaid, 0);

    let paymentStatus = 'Unpaid';
    let paymentBadge = 'bg-secondary';
    if (totalArtistPaid >= totalExpectedPayment && totalExpectedPayment > 0) {
      paymentStatus = 'Full Paid';
      paymentBadge = 'bg-success';
    } else if (totalArtistPaid > 0) {
      paymentStatus = 'Partial Paid';
      paymentBadge = 'bg-warning text-dark';
    }

    // Get tickets for revenue breakdown
    const tickets = await Ticket.find({ concert: concert._id, paymentStatus: 'completed' });

    let totalPlatformFees = 0;
    let artistNetIncome = 0;
    let totalTicketRevenue = 0;

    tickets.forEach(ticket => {
      const commission = ticket.commissionAmount || 0;
      const total = ticket.totalAmount || 0;
      totalPlatformFees += commission;
      artistNetIncome += (total - commission);
      totalTicketRevenue += total;
    });

    res.render('admin/concert-details-new', {
      layout: 'admin',
      currentPath: '/admin/concerts',
      title: 'Concert Details',
      concert,
      ticketCount,
      paymentIds,
      orderIds,
      venueFinancials: {
        totalCost,
        commissionPercentage,
        commissionPaid,
        artistPaidDirect,
        totalArtistPaid,
        totalExpectedPayment,
        remainingBalance,
        paymentStatus,
        paymentBadge
      },
      totalPlatformFees,
      artistNetIncome,
      totalTicketRevenue,
      tickets,
      toISTDateString: require('../utils/dateFormatter').toISTDateString
    });
  } catch (error) {
    console.error('Concert details error:', error);
    req.flash('error', 'Failed to load concert details');
    res.redirect('/admin/concerts');
  }
});

// Update concert payment details
router.post('/concerts/:id/update-payment', isLoggedIn, hasAdminPermission('manage_concerts_list'), async (req, res) => {
  try {
    const { isPaid, amountPaidByArtist, commissionPaid } = req.body;
    const concert = await Concert.findById(req.params.id);

    if (!concert) {
      req.flash('error', 'Concert not found');
      return res.redirect('/admin/concerts');
    }

    if (!concert.venueBooking) {
      concert.venueBooking = {};
    }

    concert.venueBooking.isPaid = isPaid === 'on';
    concert.venueBooking.amountPaidByArtist = parseFloat(amountPaidByArtist) || 0;

    if (!concert.venueBooking.adminCommission) {
      concert.venueBooking.adminCommission = { percentage: 0, advanceAmount: 0 };
    }
    concert.venueBooking.adminCommission.advanceAmount = parseFloat(commissionPaid) || 0;

    await concert.save();

    req.flash('success', 'Payment details updated successfully');
    res.redirect(`/admin/concerts/${concert._id}/details`);
  } catch (error) {
    console.error('Update payment error:', error);
    req.flash('error', 'Failed to update payment details');
    res.redirect(`/admin/concerts/${req.params.id}/details`);
  }
});

// Update artist payout details
router.post('/concerts/:id/update-payout', isLoggedIn, hasAdminPermission('manage_concerts_list'), async (req, res) => {
  try {
    const { amount, status, transactionId, notes } = req.body;
    const concert = await Concert.findById(req.params.id);

    if (!concert) {
      req.flash('error', 'Concert not found');
      return res.redirect('/admin/concerts');
    }

    // Validate amount doesn't exceed artist net income
    const tickets = await Ticket.find({ concert: concert._id, paymentStatus: 'completed' });
    let maxArtistNetIncome = 0;
    tickets.forEach(ticket => {
      maxArtistNetIncome += ((ticket.totalAmount || 0) - (ticket.commissionAmount || 0));
    });

    const payoutAmount = parseFloat(amount) || 0;
    if (payoutAmount > maxArtistNetIncome + 0.01) { // Add small buffer for float precision
      req.flash('error', `Payout amount (₹${payoutAmount}) cannot exceed artist net income (₹${maxArtistNetIncome.toFixed(2)})`);
      return res.redirect(`/admin/concerts/${concert._id}/details`);
    }

    if (!concert.artistPayout) {
      concert.artistPayout = { amount: 0, status: 'pending' };
    }

    concert.artistPayout.amount = payoutAmount;
    concert.artistPayout.status = status;
    concert.artistPayout.transactionId = transactionId || '';
    concert.artistPayout.notes = notes || '';

    if (status === 'paid' && !concert.artistPayout.payoutDate) {
      concert.artistPayout.payoutDate = new Date();
    }

    await concert.save();

    req.flash('success', 'Artist payout updated successfully');
    res.redirect(`/admin/concerts/${concert._id}/details`);
  } catch (error) {
    console.error('Update payout error:', error);
    req.flash('error', 'Failed to update payout details');
    res.redirect(`/admin/concerts/${req.params.id}/details`);
  }
});

// Pending concerts
router.get('/concerts/pending', isLoggedIn, hasAdminPermission('manage_concerts_list'), async (req, res) => {
  try {
    // Get search parameters
    const { search, dateRange, sortBy, sortOrder } = req.query;

    // Build filter object (always pending status)
    const filter = { status: 'pending' };

    // Date range filter
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      if (dateRange === 'upcoming') {
        filter.date = { $gte: now };
      } else if (dateRange === 'past') {
        filter.date = { $lt: now };
      } else if (dateRange === 'this-week') {
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));
        filter.date = { $gte: startOfWeek, $lte: endOfWeek };
      }
    }

    // Build sort options
    let sortOptions = { createdAt: -1 }; // Default sort
    if (sortBy) {
      const order = sortOrder === 'asc' ? 1 : -1;
      sortOptions = { [sortBy]: order };
    }

    // Get pending concerts with filters
    let pendingConcerts = await Concert.find(filter)
      .sort(sortOptions)
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name email' }
      })
      .populate('venue', 'name city address');

    // Apply text search on populated data
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      pendingConcerts = pendingConcerts.filter(concert => {
        const title = (concert.title || '').toLowerCase();
        const venue = (concert.venue ? (typeof concert.venue === 'string' ? concert.venue : (concert.venue.name || concert.venue.toString())) : '').toLowerCase();
        const city = (concert.city || '').toLowerCase();
        const artistName = (concert.artist && concert.artist.user ? concert.artist.user.name : '').toLowerCase();
        const artistEmail = (concert.artist && concert.artist.user ? concert.artist.user.email : '').toLowerCase();

        return title.includes(searchTerm) ||
          venue.includes(searchTerm) ||
          city.includes(searchTerm) ||
          artistName.includes(searchTerm) ||
          artistEmail.includes(searchTerm);
      });
    }

    // Get statistics
    const totalPending = await Concert.countDocuments({ status: 'pending' });
    const upcomingPending = await Concert.countDocuments({
      status: 'pending',
      date: { $gte: new Date() }
    });
    const pastPending = await Concert.countDocuments({
      status: 'pending',
      date: { $lt: new Date() }
    });

    res.render('admin/pending-concerts-new', {
      layout: 'admin',
      currentPath: '/admin/concerts/pending',
      title: 'Pending Concerts',
      pendingConcerts,
      searchParams: {
        search: search || '',
        dateRange: dateRange || 'all',
        sortBy: sortBy || 'createdAt',
        sortOrder: sortOrder || 'desc'
      },
      stats: {
        total: totalPending,
        upcoming: upcomingPending,
        past: pastPending,
        filtered: pendingConcerts.length
      }
    });
  } catch (error) {
    console.error('Pending concerts error:', error);
    req.flash('error', 'Failed to load pending concerts');
    res.redirect('/admin');
  }
});

// Approve concert
router.post('/concerts/:id/approve', isLoggedIn, hasAdminPermission('manage_concerts_list'), async (req, res) => {
  try {
    const concert = await Concert.findById(req.params.id)
      .populate({
        path: 'artist',
        populate: { path: 'user' }
      })
      .populate('venue');

    if (!concert) {
      req.flash('error', 'Concert not found');
      return res.redirect('/admin/concerts/pending');
    }

    // Update concert status
    concert.status = 'approved';
    await concert.save();

    // Update notification status
    const { updateNotificationStatus } = require('../utils/notificationService');
    await updateNotificationStatus('Concert', concert._id, 'approved');

    // Send email notification to artist
    try {
      console.log('Attempting to send concert approval email to artist:', concert.artist.user.email);
      const emailResult = await sendConcertApprovalEmail(concert.artist.user, concert);

      if (emailResult.success) {
        console.log('Concert approval email sent successfully to:', concert.artist.user.email);
        console.log('Email message ID:', emailResult.data?.messageId || 'Not available');
      } else {
        console.error('Failed to send concert approval email:', emailResult.error);
      }
    } catch (emailError) {
      console.error('Error sending concert approval email:', emailError);
      // Continue with the process even if email fails
    }

    // Send email notification to venue owner
    try {
      if (concert.venue && concert.venue.contactPerson && concert.venue.contactPerson.email) {
        console.log('Attempting to send concert approval email to venue owner:', concert.venue.contactPerson.email);

        const venueEmail = concert.venue.contactPerson.email;
        const venueName = concert.venue.contactPerson.name || 'Venue Owner';

        const venueApprovalHTML = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px;">
              <h1 style="margin: 0; font-size: 28px;">Concert Approved ✅</h1>
            </div>
            <div style="background: white; padding: 30px; margin-top: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <p style="font-size: 16px; color: #333;">Dear ${venueName},</p>
              <p style="font-size: 16px; color: #555; line-height: 1.6;">Good news! The concert request for <strong>${concert.title}</strong> at your venue has been <strong style="color: #667eea;">APPROVED</strong> by our admin team.</p>
              <div style="background: #f0f4ff; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0;">
                <h3 style="color: #667eea; margin: 0 0 15px 0;">Concert Details:</h3>
                <p style="margin: 8px 0; color: #333;"><strong>Concert:</strong> ${concert.title}</p>
                <p style="margin: 8px 0; color: #333;"><strong>Artist:</strong> ${concert.artist.user.name || 'Artist'}</p>
                <p style="margin: 8px 0; color: #333;"><strong>Venue:</strong> ${concert.venue.name}</p>
                <p style="margin: 8px 0; color: #333;"><strong>Date:</strong> ${new Date(concert.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p style="margin: 8px 0; color: #333;"><strong>Status:</strong> <span style="color: #4caf50; font-weight: bold;">APPROVED</span></p>
              </div>
              <p style="font-size: 16px; color: #555; line-height: 1.6;">The concert is now officially scheduled at your venue. Please coordinate with the artist for any final arrangements.</p>
              <p style="font-size: 16px; color: #333; margin-top: 20px;">Best regards,<br><strong>RAPIRA Admin Team</strong></p>
            </div>
          </div>
        `;

        const venueEmailResult = await sendDirectEmail({
          to: venueEmail,
          name: venueName,
          subject: `Concert Approved at Your Venue - ${concert.title}`,
          html: venueApprovalHTML
        });

        if (venueEmailResult.success || venueEmailResult.status === 201) {
          console.log('Concert approval email sent successfully to venue owner:', venueEmail);
          console.log('Venue email message ID:', venueEmailResult.data?.messageId || venueEmailResult.messageId || 'Not available');
        } else {
          console.error('Failed to send venue approval email:', venueEmailResult.error);
        }
      }
    } catch (venueEmailError) {
      console.error('Error sending venue approval email:', venueEmailError);
      // Continue with the process even if email fails
    }

    req.flash('success', 'Concert approved successfully');
    res.redirect('/admin/concerts/pending');
  } catch (error) {
    console.error('Approve concert error:', error);
    req.flash('error', 'Failed to approve concert');
    res.redirect('/admin/concerts/pending');
  }
});

// Reject concert
router.post('/concerts/:id/reject', isLoggedIn, hasAdminPermission('manage_concerts_list'), async (req, res) => {
  try {
    const { reason } = req.body;

    const concert = await Concert.findById(req.params.id)
      .populate({
        path: 'artist',
        populate: { path: 'user' }
      })
      .populate('venue');

    if (!concert) {
      req.flash('error', 'Concert not found');
      return res.redirect('/admin/concerts/pending');
    }

    // Update concert status
    concert.status = 'rejected';
    await concert.save();

    // Update notification status
    const { updateNotificationStatus } = require('../utils/notificationService');
    await updateNotificationStatus('Concert', concert._id, 'rejected');

    // Send email notification to artist
    try {
      console.log('Attempting to send concert rejection email to artist:', concert.artist.user.email);
      const emailResult = await sendConcertRejectionEmail(concert.artist.user, concert, reason);

      if (emailResult.success) {
        console.log('Concert rejection email sent successfully to:', concert.artist.user.email);
        console.log('Email message ID:', emailResult.data?.messageId || 'Not available');
      } else {
        console.error('Failed to send concert rejection email:', emailResult.error);
      }
    } catch (emailError) {
      console.error('Error sending concert rejection email:', emailError);
      // Continue with the process even if email fails
    }

    // Send email notification to venue owner
    try {
      if (concert.venue && concert.venue.contactPerson && concert.venue.contactPerson.email) {
        console.log('Attempting to send concert rejection email to venue owner:', concert.venue.contactPerson.email);

        const venueEmail = concert.venue.contactPerson.email;
        const venueName = concert.venue.contactPerson.name || 'Venue Owner';

        const venueRejectionHTML = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
            <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 8px;">
              <h1 style="margin: 0; font-size: 28px;">Concert Rejected ❌</h1>
            </div>
            <div style="background: white; padding: 30px; margin-top: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <p style="font-size: 16px; color: #333;">Dear ${venueName},</p>
              <p style="font-size: 16px; color: #555; line-height: 1.6;">The concert request for <strong>${concert.title}</strong> at your venue has been <strong style="color: #f5576c;">REJECTED</strong> by our admin team.</p>
              <div style="background: #ffe6e6; border-left: 4px solid #f5576c; padding: 20px; margin: 20px 0;">
                <h3 style="color: #f5576c; margin: 0 0 15px 0;">Concert Details:</h3>
                <p style="margin: 8px 0; color: #333;"><strong>Concert:</strong> ${concert.title}</p>
                <p style="margin: 8px 0; color: #333;"><strong>Artist:</strong> ${concert.artist.user.name || 'Artist'}</p>
                <p style="margin: 8px 0; color: #333;"><strong>Venue:</strong> ${concert.venue.name}</p>
                <p style="margin: 8px 0; color: #333;"><strong>Date:</strong> ${new Date(concert.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p style="margin: 8px 0; color: #333;"><strong>Status:</strong> <span style="color: #d32f2f; font-weight: bold;">REJECTED</span></p>
              </div>
              ${reason ? `<div style="background: #f5f5f5; border-left: 4px solid #757575; padding: 15px; margin: 20px 0;">
                <p style="margin: 0 0 8px 0; color: #333; font-weight: bold;">Reason:</p>
                <p style="margin: 0; color: #555;">${reason}</p>
              </div>` : ''}
              <p style="font-size: 16px; color: #555; line-height: 1.6;">This concert will not be scheduled at your venue. Thank you for your understanding.</p>
              <p style="font-size: 16px; color: #333; margin-top: 20px;">Best regards,<br><strong>RAPIRA Admin Team</strong></p>
            </div>
          </div>
        `;

        const venueEmailResult = await sendDirectEmail({
          to: venueEmail,
          name: venueName,
          subject: `Concert Rejected at Your Venue - ${concert.title}`,
          html: venueRejectionHTML
        });

        if (venueEmailResult.success || venueEmailResult.status === 201) {
          console.log('Concert rejection email sent successfully to venue owner:', venueEmail);
          console.log('Venue email message ID:', venueEmailResult.data?.messageId || venueEmailResult.messageId || 'Not available');
        } else {
          console.error('Failed to send venue rejection email:', venueEmailResult.error);
        }
      }
    } catch (venueEmailError) {
      console.error('Error sending venue rejection email:', venueEmailError);
      // Continue with the process even if email fails
    }

    req.flash('success', 'Concert rejected successfully');
    res.redirect('/admin/concerts/pending');
  } catch (error) {
    console.error('Reject concert error:', error);
    req.flash('error', 'Failed to reject concert');
    res.redirect('/admin/concerts/pending');
  }
});

// Cancel concert
router.post('/concerts/:id/cancel', isLoggedIn, hasAdminPermission('manage_concerts_list'), async (req, res) => {
  try {
    const { reason } = req.body;

    const concert = await Concert.findById(req.params.id)
      .populate({
        path: 'artist',
        populate: { path: 'user' }
      });

    if (!concert) {
      req.flash('error', 'Concert not found');
      return res.redirect('/admin/concerts');
    }

    // Update concert status
    concert.status = 'cancelled';
    await concert.save();

    // Update notification status
    const { updateNotificationStatus } = require('../utils/notificationService');
    await updateNotificationStatus('Concert', concert._id, 'cancelled');

    // TODO: Send email notification to artist and ticket holders
    // This would require implementing a new email function

    req.flash('success', 'Concert cancelled successfully');
    res.redirect('/admin/concerts');
  } catch (error) {
    console.error('Cancel concert error:', error);
    req.flash('error', 'Failed to cancel concert');
    res.redirect(`/admin/concerts/${req.params.id}/details`);
  }
});

// Delete concert
router.get('/concerts/:id/delete-confirm', isLoggedIn, hasAdminPermission('manage_concerts_list'), async (req, res) => {
  try {
    const concert = await Concert.findById(req.params.id);
    if (!concert) {
      req.flash('error', 'Concert not found');
      return res.redirect('/admin/concerts');
    }

    res.render('admin/confirm-delete-concert', {
      layout: 'admin',
      currentPath: '/admin/concerts',
      title: 'Confirm Delete Concert',
      concert
    });
  } catch (error) {
    console.error('Delete concert confirm error:', error);
    res.redirect('/admin/concerts');
  }
});

router.post('/concerts/:id/delete', isLoggedIn, hasAdminPermission('manage_concerts_list'), async (req, res) => {
  try {
    const concert = await Concert.findById(req.params.id);

    if (!concert) {
      req.flash('error', 'Concert not found');
      return res.redirect('/admin/concerts');
    }

    // Check if there are tickets for this concert
    const ticketCount = await Ticket.countDocuments({ concert: concert._id });

    if (ticketCount > 0) {
      // Delete all tickets for this concert
      await Ticket.deleteMany({ concert: concert._id });
      console.log(`Deleted ${ticketCount} tickets for concert ${concert._id}`);
    }

    // Delete the concert
    await Concert.findByIdAndDelete(req.params.id);
    console.log(`Deleted concert ${concert._id}`);

    req.flash('success', 'Concert deleted successfully');
    res.redirect('/admin/concerts');
  } catch (error) {
    console.error('Delete concert error:', error);
    req.flash('error', 'Failed to delete concert');
    res.redirect('/admin/concerts');
  }
});

// Manage artists
router.get('/artists', isLoggedIn, hasAdminPermission('manage_artists'), async (req, res) => {
  try {
    // First, clean up any orphaned artist records (artists without valid users)
    const orphanedArtists = await Artist.find().populate('user');
    for (const artist of orphanedArtists) {
      if (!artist.user) {
        console.log(`Found orphaned artist record: ${artist._id}. Deleting...`);
        // Delete artist's concerts
        await Concert.deleteMany({ artist: artist._id });
        // Delete artist's content
        await Content.deleteMany({ artist: artist._id });
        // Delete artist profile
        await Artist.findByIdAndDelete(artist._id);
      }
    }

    // Fix mismatches between user roles and artist profiles
    // Case 1: Users with role 'artist' but no artist profile
    const artistUsers = await User.find({ role: 'artist' });
    for (const user of artistUsers) {
      const artistProfile = await Artist.findOne({ user: user._id });
      if (!artistProfile) {
        console.log(`Found user ${user._id} with role 'artist' but no artist profile. Creating default profile...`);
        const newArtist = new Artist({
          user: user._id,
          stageName: user.name,
          genre: 'Hip Hop'
        });
        await newArtist.save();
      }
    }

    // Case 2: Users with artist profiles but role is not 'artist'
    const allArtistProfiles = await Artist.find().populate('user');
    for (const artist of allArtistProfiles) {
      if (artist.user && artist.user.role !== 'artist') {
        console.log(`Found user ${artist.user._id} with role '${artist.user.role}' but has artist profile ${artist._id}. Updating role...`);
        artist.user.role = 'artist';
        await artist.user.save();
      }
    }

    // Get search parameters
    const { search, genre, status, featured, level, state, city, sortBy, sortOrder } = req.query;

    // Build search query
    let query = {};

    // State filter
    if (state && state.trim()) {
      query.state = { $regex: state.trim(), $options: 'i' };
    }

    // City filter
    if (city && city.trim()) {
      query.city = { $regex: city.trim(), $options: 'i' };
    }

    // Genre filter
    if (genre && genre !== 'all') {
      query.genre = { $regex: genre, $options: 'i' };
    }

    // Status filter (verified/unverified)
    if (status && status !== 'all') {
      query.verified = status === 'verified';
    }

    // Featured filter
    if (featured && featured !== 'all') {
      query.featuredArtist = featured === 'featured';
    }

    // Artist level filter
    if (level && level !== 'all') {
      query.artistLevel = level;
    }

    // Build sort options
    let sortOptions = { createdAt: -1 }; // Default sort
    if (sortBy) {
      const order = sortOrder === 'asc' ? 1 : -1;
      sortOptions = { [sortBy]: order };
    }

    // Get artists with filters
    let artists = await Artist.find(query)
      .populate('user', 'name email')
      .sort(sortOptions)
      .then(artists => artists.filter(artist => artist.user));

    // Apply text search on populated data
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      artists = artists.filter(artist => {
        const stageName = (artist.stageName || '').toLowerCase();
        const userName = (artist.user ? artist.user.name : '').toLowerCase();
        const userEmail = (artist.user ? artist.user.email : '').toLowerCase();
        const genre = (artist.genre || '').toLowerCase();

        return stageName.includes(searchTerm) ||
          userName.includes(searchTerm) ||
          userEmail.includes(searchTerm) ||
          genre.includes(searchTerm);
      });
    }

    // Get statistics
    const totalArtists = await Artist.countDocuments();
    const verifiedArtists = await Artist.countDocuments({ verified: true });
    const featuredArtists = await Artist.countDocuments({ featuredArtist: true });
    const beginnerArtists = await Artist.countDocuments({ artistLevel: 'Beginner' });
    const intermediateArtists = await Artist.countDocuments({ artistLevel: 'Intermediate' });
    const establishedArtists = await Artist.countDocuments({ artistLevel: 'Established' });

    // Get unique genres, states, and cities for filter dropdowns
    const allArtists = await Artist.find().distinct('genre');
    const genres = allArtists.filter(g => g && g !== 'Not specified').sort();

    const allStates = await Artist.find().distinct('state');
    const statesList = allStates.filter(s => s && s.trim() !== '').sort();

    const allCities = await Artist.find().distinct('city');
    const citiesList = allCities.filter(c => c && c.trim() !== '').sort();

    res.render('admin/artists-new', {
      layout: 'admin',
      currentPath: '/admin/artists',
      title: 'Manage Artists',
      artists,
      searchParams: {
        search: search || '',
        genre: genre || 'all',
        status: status || 'all',
        featured: featured || 'all',
        level: level || 'all',
        state: state || '',
        city: city || '',
        sortBy: sortBy || 'createdAt',
        sortOrder: sortOrder || 'desc'
      },
      stats: {
        total: totalArtists,
        verified: verifiedArtists,
        featured: featuredArtists,
        beginner: beginnerArtists,
        intermediate: intermediateArtists,
        established: establishedArtists,
        filtered: artists.length
      },
      genres,
      states: statesList,
      cities: citiesList
    });
  } catch (error) {
    console.error('Manage artists error:', error);
    req.flash('error', 'Failed to load artists');
    res.redirect('/admin');
  }
});

// Export artists to CSV
router.get('/artists/export', isLoggedIn, hasAdminPermission('manage_artists'), async (req, res) => {
  try {
    // Get search parameters (same as main artists route)
    const { search, genre, status, featured, level, state, city, sortBy, sortOrder } = req.query;

    // Build search query
    let query = {};

    // State filter
    if (state && state.trim()) {
      query.state = { $regex: state.trim(), $options: 'i' };
    }

    // City filter
    if (city && city.trim()) {
      query.city = { $regex: city.trim(), $options: 'i' };
    }

    // Genre filter
    if (genre && genre !== 'all') {
      query.genre = { $regex: genre, $options: 'i' };
    }

    // Status filter (verified/unverified)
    if (status && status !== 'all') {
      query.verified = status === 'verified';
    }

    // Featured filter
    if (featured && featured !== 'all') {
      query.featuredArtist = featured === 'featured';
    }

    // Artist level filter
    if (level && level !== 'all') {
      query.artistLevel = level;
    }

    // Build sort options
    let sortOptions = { createdAt: -1 }; // Default sort
    if (sortBy) {
      const order = sortOrder === 'asc' ? 1 : -1;
      sortOptions = { [sortBy]: order };
    }

    // Get artists with filters
    let artists = await Artist.find(query)
      .populate('user', 'name email')
      .sort(sortOptions)
      .then(artists => artists.filter(artist => artist.user));

    // Apply text search on populated data
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      artists = artists.filter(artist => {
        const stageName = (artist.stageName || '').toLowerCase();
        const userName = (artist.user ? artist.user.name : '').toLowerCase();
        const userEmail = (artist.user ? artist.user.email : '').toLowerCase();
        const genre = (artist.genre || '').toLowerCase();

        return stageName.includes(searchTerm) ||
          userName.includes(searchTerm) ||
          userEmail.includes(searchTerm) ||
          genre.includes(searchTerm);
      });
    }

    // Generate CSV content
    const csvHeader = 'Stage Name,User Name,Email,Genre,Artist Level,Verified,Featured,Years Active,Join Date,City,State\n';
    const csvRows = artists.map(artist => {
      const stageName = `"${(artist.stageName || '').replace(/"/g, '""')}"`;
      const userName = `"${(artist.user ? artist.user.name : '').replace(/"/g, '""')}"`;
      const email = `"${(artist.user ? artist.user.email : '').replace(/"/g, '""')}"`;
      const genre = `"${(artist.genre || '').replace(/"/g, '""')}"`;
      const level = artist.artistLevel || 'Beginner';
      const verified = artist.verified ? 'Yes' : 'No';
      const featured = artist.featuredArtist ? 'Yes' : 'No';
      const yearsActive = artist.yearsActive || 0;
      const joinDate = new Date(artist.createdAt).toLocaleDateString();
      const city = `"${(artist.city || '').replace(/"/g, '""')}"`;
      const state = `"${(artist.state || '').replace(/"/g, '""')}"`;

      return `${stageName},${userName},${email},${genre},${level},${verified},${featured},${yearsActive},${joinDate},${city},${state}`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // Set response headers for file download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `artists_export_${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Export artists error:', error);
    req.flash('error', 'Failed to export artists');
    res.redirect('/admin/artists');
  }
});

// View artist details
router.get('/artists/:id/view', isLoggedIn, hasAdminPermission('manage_artists'), async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id)
      .populate('user', 'name email profileImage phone')
      .populate('blockedBy', 'name');

    if (!artist) {
      req.flash('error', 'Artist not found');
      return res.redirect('/admin/artists');
    }

    // Get all concerts created by the artist
    const Concert = require('../models/Concert');
    const Ticket = require('../models/Ticket');
    const concerts = await Concert.find({ artist: artist._id }).sort({ date: -1 });

    // Calculate total revenue generated from their concerts
    const concertIds = concerts.map(c => c._id);
    const tickets = await Ticket.find({ concert: { $in: concertIds } });
    const totalRevenue = tickets.reduce((sum, ticket) => sum + (ticket.totalAmount || 0), 0);

    // Retrieve newest non-rejected original application
    const ArtistApplication = require('../models/ArtistApplication');
    const application = await ArtistApplication.findOne({
      user: artist.user._id,
      status: { $ne: 'rejected' }
    }).sort({ createdAt: -1 });

    res.render('admin/artist-details', {
      layout: 'admin',
      currentPath: '/admin/artists',
      title: 'View Artist Details',
      artist,
      concerts,
      totalRevenue,
      application
    });
  } catch (error) {
    console.error('View artist error:', error);
    req.flash('error', 'Failed to load artist details');
    res.redirect('/admin/artists');
  }
});

// Verify artist
router.post('/artists/:id/verify', isLoggedIn, hasAdminPermission('manage_artists'), async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id);

    if (!artist) {
      req.flash('error', 'Artist not found');
      return res.redirect('/admin/artists');
    }

    // Update verification status
    artist.verified = !artist.verified;
    await artist.save();

    req.flash('success', `Artist ${artist.verified ? 'verified' : 'unverified'} successfully`);
    res.redirect('/admin/artists');
  } catch (error) {
    console.error('Verify artist error:', error);
    req.flash('error', 'Failed to update artist verification');
    res.redirect('/admin/artists');
  }
});

// Feature artist
router.post('/artists/:id/feature', isLoggedIn, hasAdminPermission('manage_artists'), async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id);

    if (!artist) {
      req.flash('error', 'Artist not found');
      return res.redirect('/admin/artists');
    }

    // Update featured status
    artist.featuredArtist = !artist.featuredArtist;
    await artist.save();

    req.flash('success', `Artist ${artist.featuredArtist ? 'featured' : 'unfeatured'} successfully`);
    res.redirect('/admin/artists');
  } catch (error) {
    console.error('Feature artist error:', error);
    req.flash('error', 'Failed to update artist featured status');
    res.redirect('/admin/artists');
  }
});

// Delete artist
router.post('/artists/:id/delete', isLoggedIn, hasAdminPermission('manage_artists'), async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id);

    if (!artist) {
      req.flash('error', 'Artist not found');
      return res.redirect('/admin/artists');
    }

    // Delete artist's concerts
    await Concert.deleteMany({ artist: artist._id });
    console.log(`Deleted all concerts for artist ${artist._id}`);

    // Delete artist's content
    await Content.deleteMany({ artist: artist._id });
    console.log(`Deleted all content for artist ${artist._id}`);

    // Delete artist profile
    await Artist.findByIdAndDelete(artist._id);
    console.log(`Deleted artist profile ${artist._id}`);

    req.flash('success', 'Artist deleted successfully');
    res.redirect('/admin/artists');
  } catch (error) {
    console.error('Delete artist error:', error);
    req.flash('error', 'Failed to delete artist');
    res.redirect('/admin/artists');
  }
});

// Block artist (POST) confirmation page
router.get('/artists/:id/block', isLoggedIn, hasAdminPermission('manage_artists'), async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id)
      .populate('user', 'name email profileImage');

    if (!artist) {
      req.flash('error', 'Artist not found');
      return res.redirect('/admin/artists');
    }

    res.render('admin/artist-block-confirm', {
      layout: 'admin',
      currentPath: '/admin/artists',
      title: 'Confirm Block Artist',
      artist
    });
  } catch (error) {
    console.error('Block confirmation page error:', error);
    req.flash('error', 'Failed to load block confirmation');
    res.redirect('/admin/artists');
  }
});

// Unblock artist confirmation page
router.get('/artists/:id/unblock', isLoggedIn, hasAdminPermission('manage_artists'), async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id)
      .populate('user', 'name email profileImage')
      .populate('blockedBy', 'name');

    if (!artist) {
      req.flash('error', 'Artist not found');
      return res.redirect('/admin/artists');
    }

    if (!artist.isBlocked) {
      req.flash('error', 'This artist is not blocked');
      return res.redirect('/admin/artists');
    }

    res.render('admin/artist-unblock-confirm', {
      layout: 'admin',
      currentPath: '/admin/artists',
      title: 'Confirm Unblock Artist',
      artist
    });
  } catch (error) {
    console.error('Unblock confirmation page error:', error);
    req.flash('error', 'Failed to load unblock confirmation');
    res.redirect('/admin/artists');
  }
});

// Block artist
router.post('/artists/:id/block', isLoggedIn, hasAdminPermission('manage_artists'), async (req, res) => {
  try {
    const { blockReason } = req.body;
    const artist = await Artist.findById(req.params.id);

    if (!artist) {
      req.flash('error', 'Artist not found');
      return res.redirect('/admin/artists');
    }

    const blockDate = new Date();

    artist.isBlocked = true;
    artist.blockReason = blockReason || 'Violated platform policies';
    artist.blockedAt = blockDate;
    artist.blockedBy = req.session.user.id;

    // Add to block history
    artist.blockHistory.push({
      blockedAt: blockDate,
      blockedBy: req.session.user.id,
      blockReason: blockReason || 'Violated platform policies'
    });

    await artist.save();

    req.flash('success', 'Artist blocked successfully');
    res.redirect('/admin/artists');
  } catch (error) {
    console.error('Block artist error:', error);
    req.flash('error', 'Failed to block artist');
    res.redirect('/admin/artists');
  }
});

// Unblock artist
router.post('/artists/:id/unblock', isLoggedIn, hasAdminPermission('manage_artists'), async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id);

    if (!artist) {
      req.flash('error', 'Artist not found');
      return res.redirect('/admin/artists');
    }

    const unblockDate = new Date();

    artist.isBlocked = false;
    artist.blockReason = '';
    artist.blockedAt = undefined;
    artist.blockedBy = undefined;

    // Update the latest block history entry with unblock info
    if (artist.blockHistory && artist.blockHistory.length > 0) {
      const latestBlock = artist.blockHistory[artist.blockHistory.length - 1];
      if (!latestBlock.unblockedAt) {
        latestBlock.unblockedAt = unblockDate;
        latestBlock.unblockedBy = req.session.user.id;
      }
    }

    await artist.save();

    // Mark any pending unblock requests as approved
    await ArtistUnblockRequest.updateMany(
      { artist: artist._id, status: 'pending' },
      {
        status: 'approved',
        reviewedBy: req.session.user.id,
        reviewedAt: new Date()
      }
    );

    req.flash('success', 'Artist unblocked successfully');
    res.redirect('/admin/artists');
  } catch (error) {
    console.error('Unblock artist error:', error);
    req.flash('error', 'Failed to unblock artist');
    res.redirect('/admin/artists');
  }
});

// Manage unblock requests
router.get('/unblock-requests', isLoggedIn, hasAdminPermission('manage_unblock_requests'), async (req, res) => {
  try {
    const { status, email, name, location, sort } = req.query;

    // Build base query from status
    const baseQuery = {};
    if (status && status !== 'all') {
      baseQuery.status = status;
    }

    // Determine sort order
    const sortOrder = sort === 'oldest' ? 1 : -1; // default newest

    // Fetch requests with artist + user populated
    let requests = await ArtistUnblockRequest.find(baseQuery)
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name email profileImage' }
      })
      .populate('reviewedBy', 'name')
      .sort({ createdAt: sortOrder });

    // In-memory filters for email, name, location
    if (email && email.trim()) {
      const emailRegex = new RegExp(email.trim(), 'i');
      requests = requests.filter(r => r.artist && r.artist.user && emailRegex.test(r.artist.user.email || ''));
    }

    if (name && name.trim()) {
      const nameRegex = new RegExp(name.trim(), 'i');
      requests = requests.filter(r =>
        (r.artist && nameRegex.test(r.artist.stageName || '')) ||
        (r.artist && r.artist.user && nameRegex.test(r.artist.user.name || ''))
      );
    }

    if (location && location.trim()) {
      const locRegex = new RegExp(location.trim(), 'i');
      requests = requests.filter(r => r.artist && (locRegex.test(r.artist.city || '') || locRegex.test(r.artist.state || '')));
    }

    const stats = {
      total: await ArtistUnblockRequest.countDocuments(),
      pending: await ArtistUnblockRequest.countDocuments({ status: 'pending' }),
      approved: await ArtistUnblockRequest.countDocuments({ status: 'approved' }),
      rejected: await ArtistUnblockRequest.countDocuments({ status: 'rejected' })
    };

    res.render('admin/unblock-requests', {
      layout: 'admin',
      currentPath: '/admin/unblock-requests',
      title: 'Artist Unblock Requests',
      requests,
      stats,
      filterStatus: status || 'all',
      filterEmail: email || '',
      filterName: name || '',
      filterLocation: location || '',
      sortOrder: sort || 'newest'
    });
  } catch (error) {
    console.error('Unblock requests error:', error);
    req.flash('error', 'Failed to load unblock requests');
    res.redirect('/admin');
  }
});

// View single unblock request details
router.get('/unblock-requests/:id', isLoggedIn, hasAdminPermission('manage_unblock_requests'), async (req, res) => {
  try {
    const request = await ArtistUnblockRequest.findById(req.params.id)
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name email profileImage' }
      })
      .populate('reviewedBy', 'name email');

    if (!request) {
      req.flash('error', 'Unblock request not found');
      return res.redirect('/admin/unblock-requests');
    }

    res.render('admin/unblock-request-view', {
      layout: 'admin',
      currentPath: '/admin/unblock-requests',
      title: 'Unblock Request Details',
      request
    });
  } catch (error) {
    console.error('Unblock request view error:', error);
    req.flash('error', 'Failed to load unblock request details');
    res.redirect('/admin/unblock-requests');
  }
});

// Approve unblock request
router.post('/unblock-requests/:id/approve', isLoggedIn, hasAdminPermission('manage_unblock_requests'), async (req, res) => {
  try {
    const request = await ArtistUnblockRequest.findById(req.params.id).populate('artist');

    if (!request) {
      req.flash('error', 'Request not found');
      return res.redirect('/admin/unblock-requests');
    }

    // Unblock the artist
    const artist = await Artist.findById(request.artist._id);
    if (artist) {
      artist.isBlocked = false;
      artist.blockReason = '';
      artist.blockedAt = undefined;
      artist.blockedBy = undefined;
      await artist.save();
    }

    // Update request status
    request.status = 'approved';
    request.reviewedBy = req.session.user.userId;
    request.reviewedAt = new Date();
    request.adminResponse = req.body.adminResponse || 'Request approved';
    await request.save();

    req.flash('success', 'Unblock request approved and artist unblocked');
    res.redirect('/admin/unblock-requests');
  } catch (error) {
    console.error('Approve unblock request error:', error);
    req.flash('error', 'Failed to approve request');
    res.redirect('/admin/unblock-requests');
  }
});

// Reject unblock request
router.post('/unblock-requests/:id/reject', isLoggedIn, hasAdminPermission('manage_unblock_requests'), async (req, res) => {
  try {
    const request = await ArtistUnblockRequest.findById(req.params.id);

    if (!request) {
      req.flash('error', 'Request not found');
      return res.redirect('/admin/unblock-requests');
    }

    request.status = 'rejected';
    request.reviewedBy = req.session.user.userId;
    request.reviewedAt = new Date();
    request.adminResponse = req.body.adminResponse || 'Request rejected';
    await request.save();

    req.flash('success', 'Unblock request rejected');
    res.redirect('/admin/unblock-requests');
  } catch (error) {
    console.error('Reject unblock request error:', error);
    req.flash('error', 'Failed to reject request');
    res.redirect('/admin/unblock-requests');
  }
});

// Delete single unblock request (history entry)
router.post('/unblock-requests/:id/delete', isLoggedIn, hasAdminPermission('manage_unblock_requests'), async (req, res) => {
  try {
    const request = await ArtistUnblockRequest.findById(req.params.id);

    if (!request) {
      req.flash('error', 'Request not found');
      return res.redirect('/admin/unblock-requests');
    }

    await ArtistUnblockRequest.deleteOne({ _id: req.params.id });
    req.flash('success', 'Unblock request deleted');
    res.redirect('/admin/unblock-requests');
  } catch (error) {
    console.error('Delete unblock request error:', error);
    req.flash('error', 'Failed to delete request');
    res.redirect('/admin/unblock-requests');
  }
});

// Delete approved/rejected unblock request history
router.post('/unblock-requests/delete-history', isLoggedIn, hasAdminPermission('manage_unblock_requests'), async (req, res) => {
  try {
    const result = await ArtistUnblockRequest.deleteMany({
      status: { $in: ['approved', 'rejected'] }
    });

    const deletedCount = result?.deletedCount || 0;
    req.flash('success', `Deleted ${deletedCount} history record${deletedCount === 1 ? '' : 's'}`);
    res.redirect('/admin/unblock-requests');
  } catch (error) {
    console.error('Delete unblock request history error:', error);
    req.flash('error', 'Failed to delete history');
    res.redirect('/admin/unblock-requests');
  }
});

// Manage tickets
router.get('/tickets', isLoggedIn, hasAdminPermission('manage_tickets'), async (req, res) => {
  try {
    // Get search parameters
    const { search, status, dateRange, priceRange, sortBy, sortOrder } = req.query;

    // Build filter object
    const filter = {};

    // Status filter
    if (status && status !== 'all') {
      filter.paymentStatus = status;
    }

    // Date range filter
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      if (dateRange === 'today') {
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        const endOfDay = new Date(now.setHours(23, 59, 59, 999));
        filter.purchaseDate = { $gte: startOfDay, $lte: endOfDay };
      } else if (dateRange === 'this-week') {
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));
        filter.purchaseDate = { $gte: startOfWeek, $lte: endOfWeek };
      } else if (dateRange === 'this-month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        filter.purchaseDate = { $gte: startOfMonth, $lte: endOfMonth };
      }
    }

    // Price range filter
    if (priceRange && priceRange !== 'all') {
      if (priceRange === 'free') {
        filter.totalAmount = 0;
      } else if (priceRange === 'under-500') {
        filter.totalAmount = { $gt: 0, $lt: 500 };
      } else if (priceRange === '500-1000') {
        filter.totalAmount = { $gte: 500, $lte: 1000 };
      } else if (priceRange === 'over-1000') {
        filter.totalAmount = { $gt: 1000 };
      }
    }

    // Build sort options
    let sortOptions = { purchaseDate: -1 }; // Default sort
    if (sortBy) {
      const order = sortOrder === 'asc' ? 1 : -1;
      sortOptions = { [sortBy]: order };
    }

    // Get tickets with filters
    let tickets = await Ticket.find(filter)
      .sort(sortOptions)
      .populate('user', 'name email')
      .populate('concert', 'title date');

    // Apply text search on populated data
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      tickets = tickets.filter(ticket => {
        const userName = (ticket.user ? ticket.user.name : '').toLowerCase();
        const userEmail = (ticket.user ? ticket.user.email : '').toLowerCase();
        const concertTitle = (ticket.concert ? ticket.concert.title : '').toLowerCase();
        const ticketNumber = (ticket.ticketNumber || '').toLowerCase();

        return userName.includes(searchTerm) ||
          userEmail.includes(searchTerm) ||
          concertTitle.includes(searchTerm) ||
          ticketNumber.includes(searchTerm);
      });
    }

    // Get statistics
    const totalTickets = await Ticket.countDocuments();
    const completedTickets = await Ticket.countDocuments({ paymentStatus: 'completed' });
    const pendingTickets = await Ticket.countDocuments({ paymentStatus: 'pending' });
    const failedTickets = await Ticket.countDocuments({ paymentStatus: 'failed' });
    const freeTickets = await Ticket.countDocuments({ totalAmount: 0 });
    const totalRevenue = await Ticket.aggregate([
      { $match: { paymentStatus: 'completed' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    res.render('admin/tickets-new', {
      layout: 'admin',
      currentPath: '/admin/tickets',
      title: 'Tickets Management',
      tickets,
      searchParams: {
        search: search || '',
        status: status || 'all',
        dateRange: dateRange || 'all',
        priceRange: priceRange || 'all',
        sortBy: sortBy || 'purchaseDate',
        sortOrder: sortOrder || 'desc'
      },
      stats: {
        total: totalTickets,
        completed: completedTickets,
        pending: pendingTickets,
        failed: failedTickets,
        free: freeTickets,
        revenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
        filtered: tickets.length
      }
    });
  } catch (error) {
    console.error('Manage tickets error:', error);
    req.flash('error', 'Failed to load tickets');
    res.redirect('/admin');
  }
});

// Export tickets to CSV
router.get('/tickets/export', isLoggedIn, hasAdminPermission('manage_tickets'), async (req, res) => {
  try {
    // Get search parameters (same as main tickets route)
    const { search, status, dateRange, priceRange, sortBy, sortOrder } = req.query;

    // Build filter object
    const filter = {};

    if (status && status !== 'all') {
      filter.paymentStatus = status;
    }

    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      if (dateRange === 'today') {
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        const endOfDay = new Date(now.setHours(23, 59, 59, 999));
        filter.purchaseDate = { $gte: startOfDay, $lte: endOfDay };
      } else if (dateRange === 'this-week') {
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));
        filter.purchaseDate = { $gte: startOfWeek, $lte: endOfWeek };
      } else if (dateRange === 'this-month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        filter.purchaseDate = { $gte: startOfMonth, $lte: endOfMonth };
      }
    }

    if (priceRange && priceRange !== 'all') {
      if (priceRange === 'free') {
        filter.totalAmount = 0;
      } else if (priceRange === 'under-500') {
        filter.totalAmount = { $gt: 0, $lt: 500 };
      } else if (priceRange === '500-1000') {
        filter.totalAmount = { $gte: 500, $lte: 1000 };
      } else if (priceRange === 'over-1000') {
        filter.totalAmount = { $gt: 1000 };
      }
    }

    // Build sort options
    let sortOptions = { purchaseDate: -1 };
    if (sortBy) {
      const order = sortOrder === 'asc' ? 1 : -1;
      sortOptions = { [sortBy]: order };
    }

    // Get tickets with filters
    let tickets = await Ticket.find(filter)
      .sort(sortOptions)
      .populate('user', 'name email')
      .populate('concert', 'title date');

    // Apply text search
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      tickets = tickets.filter(ticket => {
        const userName = (ticket.user ? ticket.user.name : '').toLowerCase();
        const userEmail = (ticket.user ? ticket.user.email : '').toLowerCase();
        const concertTitle = (ticket.concert ? ticket.concert.title : '').toLowerCase();
        const ticketNumber = (ticket.ticketNumber || '').toLowerCase();

        return userName.includes(searchTerm) ||
          userEmail.includes(searchTerm) ||
          concertTitle.includes(searchTerm) ||
          ticketNumber.includes(searchTerm);
      });
    }

    // Generate CSV content
    const csvHeader = 'Ticket Number,User Name,Email,Concert,Concert Date,Quantity,Amount,Status,Purchase Date,Payment ID\n';
    const csvRows = tickets.map(ticket => {
      const ticketNumber = `"${(ticket.ticketNumber || '').replace(/"/g, '""')}"`;
      const userName = `"${(ticket.user ? ticket.user.name : '').replace(/"/g, '""')}"`;
      const userEmail = `"${(ticket.user ? ticket.user.email : '').replace(/"/g, '""')}"`;
      const concertTitle = `"${(ticket.concert ? ticket.concert.title : '').replace(/"/g, '""')}"`;
      const concertDate = ticket.concert && ticket.concert.date ? new Date(ticket.concert.date).toLocaleDateString() : '';
      const quantity = ticket.quantity || 1;
      const amount = ticket.totalAmount || 0;
      const status = ticket.paymentStatus || '';
      const purchaseDate = new Date(ticket.purchaseDate).toLocaleDateString();
      const paymentId = `"${(ticket.paymentId || '').replace(/"/g, '""')}"`;

      return `${ticketNumber},${userName},${userEmail},${concertTitle},${concertDate},${quantity},${amount},${status},${purchaseDate},${paymentId}`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // Set response headers for file download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `tickets_export_${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Export tickets error:', error);
    req.flash('error', 'Failed to export tickets');
    res.redirect('/admin/tickets');
  }
});

// View ticket details
router.get('/tickets/:id', isLoggedIn, hasAdminPermission('manage_tickets'), async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('user', 'name email profileImage createdAt role')
      .populate({
        path: 'concert',
        populate: {
          path: 'artist',
          populate: { path: 'user', select: 'name' }
        }
      });

    if (!ticket) {
      req.flash('error', 'Ticket not found');
      return res.redirect('/admin/tickets');
    }

    // Check if concert exists
    const concert = ticket.concert ? await Concert.findById(ticket.concert._id).populate({
      path: 'artist',
      populate: { path: 'user', select: 'name' }
    }) : null;

    res.render('admin/ticket-details', {
      layout: 'admin',
      currentPath: '/admin/tickets',
      title: 'Ticket Details',
      ticket,
      concert
    });
  } catch (error) {
    console.error('Ticket details error:', error);
    req.flash('error', 'Failed to load ticket details');
    res.redirect('/admin/tickets');
  }
});

// Delete ticket
router.post('/tickets/:id/delete', isLoggedIn, hasAdminPermission('manage_tickets'), async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      req.flash('error', 'Ticket not found');
      return res.redirect('/admin/tickets');
    }

    // If the ticket is for a concert that exists, decrement the ticketsSold count
    if (ticket.concert) {
      const concert = await Concert.findById(ticket.concert);
      if (concert) {
        concert.ticketsSold = Math.max(0, concert.ticketsSold - ticket.quantity);
        await concert.save();
      }
    }

    await Ticket.findByIdAndDelete(req.params.id);
    req.flash('success', 'Ticket deleted successfully');
    res.redirect('/admin/tickets');
  } catch (error) {
    console.error('Delete ticket error:', error);
    req.flash('error', 'Failed to delete ticket');
    res.redirect('/admin/tickets');
  }
});

// Bulk delete tickets
router.post('/tickets/bulk-delete', isLoggedIn, hasAdminPermission('manage_tickets'), async (req, res) => {
  try {
    const { ticketIds } = req.body;

    if (!ticketIds || !Array.isArray(ticketIds) || ticketIds.length === 0) {
      req.flash('error', 'No tickets selected for deletion');
      return res.redirect('/admin/tickets');
    }

    // Process each ticket to update concert ticket counts
    for (const ticketId of ticketIds) {
      const ticket = await Ticket.findById(ticketId);
      if (ticket && ticket.concert) {
        const concert = await Concert.findById(ticket.concert);
        if (concert) {
          concert.ticketsSold = Math.max(0, concert.ticketsSold - ticket.quantity);
          await concert.save();
        }
      }
    }

    // Delete all selected tickets
    const result = await Ticket.deleteMany({ _id: { $in: ticketIds } });

    req.flash('success', `${result.deletedCount} tickets deleted successfully`);
    res.redirect('/admin/tickets');
  } catch (error) {
    console.error('Bulk delete tickets error:', error);
    req.flash('error', 'Failed to delete tickets');
    res.redirect('/admin/tickets');
  }
});

// Content management routes moved to admin-content.js

// Manage pages
router.get('/pages', isLoggedIn, hasAdminPermission('manage_pages'), async (req, res) => {
  try {
    const dummyDataHelper = require('../utils/dummyDataHelper');

    // Get search parameters
    const { search, published, showInNavigation, dateRange, sortBy, sortOrder } = req.query;

    // Build filter object
    const filter = {};

    // Published filter
    if (published && published !== 'all') {
      filter.published = published === 'true';
    }

    // Show in navigation filter
    if (showInNavigation && showInNavigation !== 'all') {
      filter.showInNavigation = showInNavigation === 'true';
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

    // Get real pages with filters
    let realPages = await Page.find(filter).sort(sortOptions);

    // Apply text search
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      realPages = realPages.filter(page => {
        const title = (page.title || '').toLowerCase();
        const slug = (page.slug || '').toLowerCase();
        const content = (page.content || '').toLowerCase();
        const metaDescription = (page.metaDescription || '').toLowerCase();

        return title.includes(searchTerm) ||
          slug.includes(searchTerm) ||
          content.includes(searchTerm) ||
          metaDescription.includes(searchTerm);
      });
    }

    // Merge with dummy data if enabled
    const pageResult = await dummyDataHelper.mergeWithDummyData(realPages, 'pages', { shuffle: true });

    // Get statistics (only real data)
    const totalPages = await Page.countDocuments();
    const publishedPages = await Page.countDocuments({ published: true });
    const draftPages = await Page.countDocuments({ published: false });
    const navigationPages = await Page.countDocuments({ showInNavigation: true });

    res.render('admin/pages-new', {
      layout: 'admin',
      currentPath: '/admin/pages',
      title: 'Manage Pages',
      pages: pageResult.data,
      searchParams: {
        search: search || '',
        published: published || 'all',
        showInNavigation: showInNavigation || 'all',
        dateRange: dateRange || 'all',
        sortBy: sortBy || 'createdAt',
        sortOrder: sortOrder || 'desc'
      },
      stats: {
        total: totalPages,
        published: publishedPages,
        draft: draftPages,
        navigation: navigationPages,
        filtered: pageResult.totalCount,
        realCount: pageResult.realCount,
        dummyCount: pageResult.dummyCount
      },
      hasDummyData: pageResult.hasDummyData
    });
  } catch (error) {
    console.error('Manage pages error:', error);
    req.flash('error', 'Failed to load pages');
    res.redirect('/admin');
  }
});

// Export pages to CSV
router.get('/pages/export', isLoggedIn, hasAdminPermission('manage_pages'), async (req, res) => {
  try {
    // Get search parameters (same as main route)
    const { search, published, showInNavigation, dateRange, sortBy, sortOrder } = req.query;

    // Build filter object
    const filter = {};

    if (published && published !== 'all') {
      filter.published = published === 'true';
    }

    if (showInNavigation && showInNavigation !== 'all') {
      filter.showInNavigation = showInNavigation === 'true';
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

    // Get pages with filters
    let pages = await Page.find(filter).sort(sortOptions);

    // Apply text search
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      pages = pages.filter(page => {
        const title = (page.title || '').toLowerCase();
        const slug = (page.slug || '').toLowerCase();
        const content = (page.content || '').toLowerCase();
        const metaDescription = (page.metaDescription || '').toLowerCase();

        return title.includes(searchTerm) ||
          slug.includes(searchTerm) ||
          content.includes(searchTerm) ||
          metaDescription.includes(searchTerm);
      });
    }

    // Generate CSV content
    const csvHeader = 'Title,Slug,Published,Show in Navigation,Meta Description,Created Date,Updated Date\n';
    const csvRows = pages.map(page => {
      const title = `"${(page.title || '').replace(/"/g, '""')}"`;
      const slug = `"${(page.slug || '').replace(/"/g, '""')}"`;
      const published = page.published ? 'Yes' : 'No';
      const showInNavigation = page.showInNavigation ? 'Yes' : 'No';
      const metaDescription = `"${(page.metaDescription || '').replace(/"/g, '""')}"`;
      const createdDate = new Date(page.createdAt).toLocaleDateString();
      const updatedDate = new Date(page.updatedAt).toLocaleDateString();

      return `${title},${slug},${published},${showInNavigation},${metaDescription},${createdDate},${updatedDate}`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // Set response headers for file download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `pages_export_${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Export pages error:', error);
    req.flash('error', 'Failed to export pages');
    res.redirect('/admin/pages');
  }
});

// Add page form
router.get('/pages/add', isLoggedIn, hasAdminPermission('manage_pages'), (req, res) => {
  res.render('admin/add-page', {
    layout: 'admin',
    currentPath: '/admin/pages',
    title: 'Add New Page'
  });
});

// Add page process
router.post('/pages/add', isLoggedIn, hasAdminPermission('manage_pages'), async (req, res) => {
  try {
    const { title, slug, content, metaDescription, published, showInNavigation } = req.body;

    // Validate input
    if (!title || !slug || !content) {
      req.flash('error', 'Please fill in all required fields');
      return res.redirect('/admin/pages/add');
    }

    // Check if slug already exists
    const existingPage = await Page.findOne({ slug });
    if (existingPage) {
      req.flash('error', 'A page with this URL slug already exists');
      return res.redirect('/admin/pages/add');
    }

    // Create page
    const newPage = new Page({
      title,
      slug,
      content,
      metaDescription: metaDescription || '',
      published: published === 'on',
      showInNavigation: showInNavigation === 'on',
      createdBy: req.session.user.id,
      updatedBy: req.session.user.id
    });

    await newPage.save();

    req.flash('success', 'Page created successfully');
    res.redirect('/admin/pages');
  } catch (error) {
    console.error('Add page error:', error);
    req.flash('error', 'Failed to create page');
    res.redirect('/admin/pages/add');
  }
});

// Edit page form
router.get('/pages/:id/edit', isLoggedIn, hasAdminPermission('manage_pages'), async (req, res) => {
  try {
    const page = await Page.findById(req.params.id);

    if (!page) {
      req.flash('error', 'Page not found');
      return res.redirect('/admin/pages');
    }

    res.render('admin/edit-page', {
      layout: 'admin',
      currentPath: '/admin/pages',
      title: 'Edit Page',
      page
    });
  } catch (error) {
    console.error('Edit page error:', error);
    req.flash('error', 'Failed to load page');
    res.redirect('/admin/pages');
  }
});

// Update page
router.post('/pages/:id/update', isLoggedIn, hasAdminPermission('manage_pages'), async (req, res) => {
  try {
    const { title, slug, content, metaDescription, published, showInNavigation } = req.body;

    // Find page
    const page = await Page.findById(req.params.id);

    if (!page) {
      req.flash('error', 'Page not found');
      return res.redirect('/admin/pages');
    }

    // Check if slug is changed and already exists
    if (slug !== page.slug) {
      const existingPage = await Page.findOne({ slug });
      if (existingPage && existingPage._id.toString() !== req.params.id) {
        req.flash('error', 'A page with this URL slug already exists');
        return res.redirect(`/admin/pages/${req.params.id}/edit`);
      }
    }

    // Update page fields
    page.title = title;
    page.slug = slug;
    page.content = content;
    page.metaDescription = metaDescription || '';
    page.published = published === 'on';
    page.showInNavigation = showInNavigation === 'on';
    page.updatedBy = req.session.user.id;

    await page.save();

    req.flash('success', 'Page updated successfully');
    res.redirect('/admin/pages');
  } catch (error) {
    console.error('Update page error:', error);
    req.flash('error', 'Failed to update page');
    res.redirect(`/admin/pages/${req.params.id}/edit`);
  }
});

// Delete page
router.post('/pages/:id/delete', isLoggedIn, hasAdminPermission('manage_pages'), async (req, res) => {
  try {
    const page = await Page.findById(req.params.id);

    if (!page) {
      req.flash('error', 'Page not found');
      return res.redirect('/admin/pages');
    }

    // Delete page
    await Page.findByIdAndDelete(req.params.id);

    req.flash('success', 'Page deleted successfully');
    res.redirect('/admin/pages');
  } catch (error) {
    console.error('Delete page error:', error);
    req.flash('error', 'Failed to delete page');
    res.redirect('/admin/pages');
  }
});

// Project Documentation Page
router.get('/documentation', isLoggedIn, hasAdminPermission('manage_website_settings'), async (req, res) => {
  try {
    res.render('admin/documentation', {
      layout: 'admin',
      currentPath: '/admin/documentation',
      title: 'Project Documentation'
    });
  } catch (error) {
    console.error('Documentation page error:', error);
    req.flash('error', 'Failed to load documentation page');
    res.redirect('/admin');
  }
});

// Create admin user if it doesn't exist
router.get('/setup', async (req, res) => {
  try {
    // Check if admin user exists
    const adminExists = await User.findOne({ email: process.env.ADMIN_EMAIL });

    if (adminExists) {
      return res.status(400).json({ message: 'Admin user already exists' });
    }

    // Create admin user
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, salt);

    const adminUser = new User({
      name: 'Admin',
      email: process.env.ADMIN_EMAIL,
      password: hashedPassword,
      role: 'admin'
    });

    await adminUser.save();

    res.json({ message: 'Admin user created successfully' });
  } catch (error) {
    console.error('Setup admin error:', error);
    res.status(500).json({ message: 'Failed to create admin user' });
  }
});

// Test email route
router.get('/test-email', isLoggedIn, hasAdminPermission('manage_admins'), async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      req.flash('error', 'Email address is required');
      return res.redirect('/admin');
    }

    console.log('Sending test email to:', email);
    const result = await sendTestEmail(email);

    if (result.success) {
      req.flash('success', `Test email sent successfully to ${email}. Please check your inbox (and spam folder).`);
    } else {
      req.flash('error', `Failed to send test email: ${result.error}`);
      console.error('Test email error details:', result.details);
    }

    res.redirect('/admin');
  } catch (error) {
    console.error('Test email error:', error);
    req.flash('error', 'Failed to send test email');
    res.redirect('/admin');
  }
});

// Direct email test route
router.post('/send-direct-email', isLoggedIn, hasAdminPermission('manage_admins'), async (req, res) => {
  try {
    const { to, subject, html } = req.body;

    if (!to || !subject || !html) {
      req.flash('error', 'All fields are required');
      return res.redirect('/admin');
    }

    console.log('Sending direct email to:', to);
    const result = await sendDirectEmail({
      to,
      subject,
      html
    });

    if (result.success) {
      req.flash('success', `Direct email sent successfully to ${to}. Please check your inbox (and spam folder).`);
    } else {
      req.flash('error', `Failed to send direct email: ${result.error}`);
      console.error('Direct email error details:', result.details);
    }

    res.redirect('/admin');
  } catch (error) {
    console.error('Direct email error:', error);
    req.flash('error', 'Failed to send direct email');
    res.redirect('/admin');
  }
});

// Venue Bookings routes
const venueBookingsRouter = require('./adminVenueBookings');
router.use('/venue-bookings', venueBookingsRouter);

// Storage Management
router.get('/storage-management', isLoggedIn, hasAdminPermission('manage_storage_management'), async (req, res) => {
  try {
    // Get all collection stats
    const stats = await getAllCollectionStats();

    res.render('admin/storage-management-fixed', {
      layout: 'admin',
      currentPath: '/admin/storage-management',
      title: 'Storage Management',
      stats
    });
  } catch (error) {
    console.error('Storage management error:', error);
    req.flash('error', 'Failed to load storage statistics');
    res.redirect('/admin');
  }
});

// View collection data
router.get('/storage-management/view/:collection', isLoggedIn, hasAdminPermission('manage_storage_management'), async (req, res) => {
  try {
    const collectionName = req.params.collection;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get the MongoDB collection
    const db = mongoose.connection.db;
    const collection = db.collection(collectionName);

    // Get total count for pagination
    const totalDocs = await collection.countDocuments();
    const totalPages = Math.ceil(totalDocs / limit);

    // Get documents with pagination
    const documents = await collection.find({})
      .skip(skip)
      .limit(limit)
      .toArray();

    // Get collection stats
    const stats = await db.command({ collStats: collectionName });

    res.render('admin/collection-view', {
      layout: 'admin',
      currentPath: '/admin/storage-management',
      title: `View Collection: ${collectionName}`,
      collectionName,
      documents,
      stats: {
        count: stats.count,
        size: stats.size,
        formattedSize: formatBytes(stats.size),
        avgObjSize: stats.avgObjSize ? Math.round(stats.avgObjSize) : 0
      },
      pagination: {
        page,
        limit,
        totalDocs,
        totalPages
      }
    });
  } catch (error) {
    console.error(`Error viewing collection ${req.params.collection}:`, error);
    req.flash('error', `Failed to view collection: ${error.message}`);
    res.redirect('/admin/storage-management');
  }
});

// Confirm delete collection data
router.get('/storage-management/confirm-delete/:collection', isLoggedIn, hasAdminPermission('manage_storage_management'), async (req, res) => {
  try {
    const collectionName = req.params.collection;
    const previousPage = req.headers.referer || null;

    // Get the MongoDB collection stats
    const db = mongoose.connection.db;
    const stats = await db.command({ collStats: collectionName });

    // Check if this is a critical collection
    const criticalCollections = ['users', 'sessions', 'artists', 'admins'];
    const isCritical = criticalCollections.includes(collectionName);

    res.render('admin/confirm-delete-collection', {
      layout: 'admin',
      currentPath: '/admin/storage-management',
      title: 'Confirm Delete Collection',
      collectionName,
      previousPage,
      criticalCollection: isCritical,
      stats: {
        count: stats.count,
        size: stats.size,
        storageSize: stats.storageSize,
        indexSize: stats.totalIndexSize,
        formattedSize: formatBytes(stats.size),
        formattedStorageSize: formatBytes(stats.storageSize),
        formattedIndexSize: formatBytes(stats.totalIndexSize)
      }
    });
  } catch (error) {
    console.error(`Error preparing delete confirmation for ${req.params.collection}:`, error);
    req.flash('error', `Failed to prepare delete confirmation: ${error.message}`);
    res.redirect('/admin/storage-management');
  }
});

// Delete collection data
router.post('/storage-management/delete/:collection', isLoggedIn, hasAdminPermission('manage_storage_management'), async (req, res) => {
  try {
    const collectionName = req.params.collection;
    const confirmed = req.body.confirmed === 'true';

    // Ensure the deletion was confirmed
    if (!confirmed) {
      return res.redirect(`/admin/storage-management/confirm-delete/${collectionName}`);
    }

    // Prevent deletion of critical collections
    const criticalCollections = ['users', 'sessions', 'artists', 'admins'];
    if (criticalCollections.includes(collectionName)) {
      req.flash('error', `Cannot delete the ${collectionName} collection as it is critical for system operation`);
      return res.redirect('/admin/storage-management');
    }

    // Get the MongoDB collection and delete all documents
    const db = mongoose.connection.db;
    const collection = db.collection(collectionName);

    // Delete all documents but keep the collection
    const result = await collection.deleteMany({});

    req.flash('success', `Successfully deleted ${result.deletedCount} documents from ${collectionName}`);
    res.redirect('/admin/storage-management');
  } catch (error) {
    console.error(`Error deleting collection ${req.params.collection}:`, error);
    req.flash('error', `Failed to delete collection data: ${error.message}`);
    res.redirect('/admin/storage-management');
  }
});

// Follower Analytics Routes
router.get('/follower-analytics', isLoggedIn, hasAdminPermission('manage_follower_analytics'), async (req, res) => {
  try {
    const Follow = require('../models/Follow');
    const Artist = require('../models/Artist');

    // Get all artists with their follower counts
    const artistsWithFollowers = await Artist.aggregate([
      {
        $lookup: {
          from: 'follows',
          localField: 'user',
          foreignField: 'followingId',
          as: 'followers'
        }
      },
      {
        $project: {
          _id: 1,
          stageName: 1,
          genre: 1,
          city: 1,
          state: 1,
          totalFollowers: { $size: '$followers' },
          userFollowers: {
            $size: {
              $filter: {
                input: '$followers',
                cond: { $eq: ['$$this.roleOfFollower', 'user'] }
              }
            }
          },
          artistFollowers: {
            $size: {
              $filter: {
                input: '$followers',
                cond: { $eq: ['$$this.roleOfFollower', 'artist'] }
              }
            }
          },
          latestFollower: { $max: '$followers.createdAt' }
        }
      },
      { $sort: { totalFollowers: -1 } }
    ]);

    // Get recent follows (filter out nulls after populating)
    const recentFollowsRaw = await Follow.find()
      .populate('followerId', 'name email profileImage role')
      .populate('followingId', 'name email')
      .sort({ createdAt: -1 })
      .limit(20);

    // Filter out follows with missing follower or following data
    const recentFollows = recentFollowsRaw
      .filter(follow => follow.followerId && follow.followingId)
      .slice(0, 10);

    // Get overall follower statistics (only count valid follows)
    const allFollowsForCount = await Follow.find()
      .populate('followerId', '_id')
      .populate('followingId', '_id');

    const validFollows = allFollowsForCount.filter(f => f.followerId && f.followingId);
    const totalFollows = validFollows.length;
    const userFollowers = validFollows.filter(f => f.roleOfFollower === 'user').length;
    const artistFollowers = validFollows.filter(f => f.roleOfFollower === 'artist').length;

    // Get top artists by followers
    const topArtists = artistsWithFollowers.slice(0, 10);

    // Get follower growth by month
    const followerGrowth = await Follow.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    res.render('admin/follower-analytics', {
      layout: 'admin',
      title: 'Follower Analytics',
      currentPath: '/admin/follower-analytics',
      artistsWithFollowers,
      totalFollows,
      userFollowers,
      artistFollowers,
      recentFollows,
      topArtists,
      followerGrowth
    });
  } catch (error) {
    console.error('Follower analytics error:', error);
    req.flash('error', 'Failed to load follower analytics');
    res.redirect('/admin');
  }
});

// Artist follower detail view
router.get('/follower-analytics/artist/:id', isLoggedIn, hasAdminPermission('manage_follower_analytics'), async (req, res) => {
  try {
    const Follow = require('../models/Follow');
    const Artist = require('../models/Artist');

    const artist = await Artist.findById(req.params.id).populate('user');
    if (!artist) {
      req.flash('error', 'Artist not found');
      return res.redirect('/admin/follower-analytics');
    }

    // Get detailed follower information
    const followers = await Follow.find({ followingId: artist.user._id })
      .populate('followerId', 'name email profileImage role city state')
      .sort({ createdAt: -1 });

    // Get follower statistics
    const totalFollowers = await Follow.countDocuments({ followingId: artist.user._id });
    const userFollowers = await Follow.countDocuments({
      followingId: artist.user._id,
      roleOfFollower: 'user'
    });
    const artistFollowers = await Follow.countDocuments({
      followingId: artist.user._id,
      roleOfFollower: 'artist'
    });

    // Get follower locations
    const followerLocations = await Follow.aggregate([
      { $match: { followingId: artist.user._id } },
      {
        $lookup: {
          from: 'users',
          localField: 'followerId',
          foreignField: '_id',
          as: 'follower'
        }
      },
      { $unwind: '$follower' },
      {
        $group: {
          _id: '$follower.city',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.render('admin/artist-follower-detail', {
      layout: 'admin',
      title: `${artist.stageName} - Follower Details`,
      currentPath: '/admin/follower-analytics',
      artist,
      followers,
      totalFollowers,
      userFollowers,
      artistFollowers,
      followerLocations
    });
  } catch (error) {
    console.error('Artist follower detail error:', error);
    req.flash('error', 'Failed to load artist follower details');
    res.redirect('/admin/follower-analytics');
  }
});

// Deleted accounts page
router.get('/deleted-accounts', isLoggedIn, hasAdminPermission('manage_deleted_accounts'), async (req, res) => {
  try {
    // Get pagination
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    // Get total count
    const totalDeleted = await DeletedAccount.countDocuments();

    // Get deleted accounts
    const deletedAccounts = await DeletedAccount.find()
      .sort({ deletedAt: -1 })
      .skip(skip)
      .limit(limit);

    // Calculate pagination
    const totalPages = Math.ceil(totalDeleted / limit);

    res.render('admin/deleted-accounts', {
      layout: 'admin',
      title: 'Deleted Accounts',
      currentPath: '/admin/deleted-accounts',
      deletedAccounts,
      pagination: {
        page,
        totalPages,
        totalDeleted,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Deleted accounts error:', error);
    req.flash('error', 'Failed to load deleted accounts');
    res.redirect('/admin');
  }
});

// Deleted account details
router.get('/deleted-accounts/:id', isLoggedIn, hasAdminPermission('manage_deleted_accounts'), async (req, res) => {
  try {
    const deletedAccount = await DeletedAccount.findById(req.params.id);

    if (!deletedAccount) {
      req.flash('error', 'Deleted account not found');
      return res.redirect('/admin/deleted-accounts');
    }

    res.render('admin/deleted-account-details', {
      layout: 'admin',
      title: 'Deleted Account Details',
      currentPath: '/admin/deleted-accounts',
      deletedAccount
    });
  } catch (error) {
    console.error('Deleted account details error:', error);
    req.flash('error', 'Failed to load deleted account details');
    res.redirect('/admin/deleted-accounts');
  }
});

// Restore deleted account (admin can restore)
router.post('/deleted-accounts/:id/restore', isLoggedIn, hasAdminPermission('manage_deleted_accounts'), async (req, res) => {
  try {
    const deletedAccount = await DeletedAccount.findById(req.params.id);

    if (!deletedAccount) {
      req.flash('error', 'Deleted account not found');
      return res.redirect('/admin/deleted-accounts');
    }

    // Check if email already exists in current users
    const existingUser = await User.findOne({ email: deletedAccount.email });
    if (existingUser) {
      req.flash('error', 'This email is already registered to another account');
      return res.redirect(`/admin/deleted-accounts/${req.params.id}`);
    }

    // Create user from deleted account data
    const restoredUser = new User({
      name: deletedAccount.name,
      email: deletedAccount.email,
      password: 'please-reset-password', // Force password reset
      role: deletedAccount.role,
      profileImage: deletedAccount.profileImage,
      bio: deletedAccount.bio,
      city: deletedAccount.city,
      socialLinks: deletedAccount.socialLinks,
      walletBalance: deletedAccount.walletBalance
    });

    await restoredUser.save();

    // If artist, recreate artist profile
    if (deletedAccount.role === 'artist' && deletedAccount.artistData) {
      const restoredArtist = new Artist({
        user: restoredUser._id,
        stageName: deletedAccount.artistData.stageName || deletedAccount.name,
        genre: deletedAccount.artistData.genre || 'Hip Hop',
        yearsActive: deletedAccount.artistData.yearsActive || 0,
        about: deletedAccount.artistData.about || ''
      });
      await restoredArtist.save();
    }

    // Delete the deleted account record
    await DeletedAccount.findByIdAndDelete(req.params.id);

    req.flash('success', `Account ${deletedAccount.email} has been restored. User must reset their password.`);
    res.redirect('/admin/deleted-accounts');
  } catch (error) {
    console.error('Restore deleted account error:', error);
    req.flash('error', 'Failed to restore account');
    res.redirect(`/admin/deleted-accounts/${req.params.id}`);
  }
});

// Permanently delete (hard delete)
router.post('/deleted-accounts/:id/permanent-delete', isLoggedIn, hasAdminPermission('manage_deleted_accounts'), async (req, res) => {
  try {
    const deletedAccount = await DeletedAccount.findByIdAndDelete(req.params.id);

    if (!deletedAccount) {
      req.flash('error', 'Deleted account not found');
      return res.redirect('/admin/deleted-accounts');
    }

    req.flash('success', `Permanently deleted account: ${deletedAccount.email}`);
    res.redirect('/admin/deleted-accounts');
  } catch (error) {
    console.error('Permanent delete error:', error);
    req.flash('error', 'Failed to permanently delete account');
    res.redirect('/admin/deleted-accounts');
  }
});

// Manage Artist Posts page (server-rendered table + detail page)
// New compact list page (also keep alternate path)
router.get(['/posts', '/artist-posts'], isLoggedIn, hasAdminPermission('manage_artist_posts'), async (req, res) => {
  try {
    const { search, state, city, genre, status } = req.query;

    let postQuery = {};

    // Post Status Filter
    if (status === 'active') postQuery.isActive = true;
    else if (status === 'hidden') postQuery.isActive = false;

    // Filter by Artist Fields (State, City, Genre, Name)
    if (search || state || city || (genre && genre !== 'all')) {
      let artistQuery = {};

      if (state && state.trim()) {
        artistQuery.state = { $regex: state.trim(), $options: 'i' };
      }
      if (city && city.trim()) {
        artistQuery.city = { $regex: city.trim(), $options: 'i' };
      }
      if (genre && genre !== 'all') {
        artistQuery.genre = { $regex: genre, $options: 'i' };
      }
      if (search && search.trim()) {
        artistQuery.stageName = { $regex: search.trim(), $options: 'i' };
      }

      const matchingArtists = await Artist.find(artistQuery).select('_id');
      const artistIds = matchingArtists.map(a => a._id);
      postQuery.artist = { $in: artistIds };
    }

    const posts = await ArtistPost.find(postQuery)
      .populate('artist', 'stageName user')
      .populate('likes', 'name')
      .sort({ createdAt: -1 })
      .limit(200);

    const normalizedPosts = posts.map(doc => {
      const post = doc.toObject();
      const media = post.media || {};
      if (typeof media === 'string') {
        post.media = { url: media, mediaType: 'image' };
      } else {
        post.media = {
          url: media.url,
          mediaType: media.mediaType || media.type || 'image',
          publicId: media.publicId
        };
      }
      return post;
    });

    // Get unique data for filter dropdowns
    const allGenres = await Artist.find().distinct('genre');
    const genresList = allGenres.filter(g => g && g !== 'Not specified').sort();

    const allStates = await Artist.find().distinct('state');
    const statesList = allStates.filter(s => s && s.trim() !== '').sort();

    const allCities = await Artist.find().distinct('city');
    const citiesList = allCities.filter(c => c && c.trim() !== '').sort();

    res.render('admin/artist-posts-list', {
      layout: 'admin',
      currentPath: '/admin/posts',
      title: 'Manage Posts',
      posts: normalizedPosts,
      genres: genresList,
      states: statesList,
      cities: citiesList,
      searchParams: {
        search: search || '',
        state: state || '',
        city: city || '',
        genre: genre || 'all',
        status: status || 'all'
      }
    });
  } catch (error) {
    console.error('Admin posts page error:', error);
    req.flash('error', 'Failed to load posts');
    res.render('admin/artist-posts-list', {
      layout: 'admin',
      currentPath: '/admin/posts',
      title: 'Manage Posts',
      posts: [],
      genres: [],
      states: [],
      cities: [],
      searchParams: { search: '', state: '', city: '', genre: 'all', status: 'all' }
    });
  }
});

// Detail page (support both routes)
router.get(['/posts/:id', '/artist-posts/:id'], isLoggedIn, hasAdminPermission('manage_artist_posts'), async (req, res) => {
  try {
    const post = await ArtistPost.findById(req.params.id)
      .populate('artist', 'stageName user')
      .populate('likes', 'name');

    if (!post) {
      req.flash('error', 'Post not found');
      return res.redirect('/admin/posts');
    }

    const media = post.media || {};
    const normalizedMedia = typeof media === 'string'
      ? { url: media, mediaType: 'image' }
      : {
        url: media.url,
        mediaType: media.mediaType || media.type || 'image',
        publicId: media.publicId
      };

    res.render('admin/artist-posts-detail', {
      layout: 'admin',
      currentPath: '/admin/posts',
      title: 'Post Details',
      post: post.toObject(),
      media: normalizedMedia
    });
  } catch (error) {
    console.error('Admin post detail error:', error);
    req.flash('error', 'Failed to load post');
    res.redirect('/admin/posts');
  }
});

function normalizeMedia(post) {
  const media = post.media || {};
  return typeof media === 'string'
    ? { url: media, mediaType: 'image' }
    : { url: media.url, mediaType: media.mediaType || media.type || 'image', publicId: media.publicId };
}

function getArtistName(post) {
  const a = post.artist || {};
  return (a.user && a.user.name) || a.stageName || 'Unknown';
}

// Action pages
router.get(['/artist-posts/:id/approve', '/posts/:id/approve-page'], isLoggedIn, hasAdminPermission('manage_artist_posts'), async (req, res) => {
  const post = await ArtistPost.findById(req.params.id).populate('artist', 'stageName user');
  if (!post) return res.redirect('/admin/posts');
  res.render('admin/artist-posts-approve', { layout: 'admin', currentPath: '/admin/posts', title: 'Approve Post', post: post.toObject(), media: normalizeMedia(post), artistName: getArtistName(post) });
});

router.get(['/artist-posts/:id/reject'], isLoggedIn, hasAdminPermission('manage_artist_posts'), async (req, res) => {
  const post = await ArtistPost.findById(req.params.id).populate('artist', 'stageName user');
  if (!post) return res.redirect('/admin/posts');
  res.render('admin/artist-posts-reject', { layout: 'admin', currentPath: '/admin/posts', title: 'Reject Post', post: post.toObject(), media: normalizeMedia(post), artistName: getArtistName(post) });
});

router.get(['/artist-posts/:id/restrict'], isLoggedIn, hasAdminPermission('manage_artist_posts'), async (req, res) => {
  const post = await ArtistPost.findById(req.params.id).populate('artist', 'stageName user');
  if (!post) return res.redirect('/admin/posts');
  res.render('admin/artist-posts-restrict', { layout: 'admin', currentPath: '/admin/posts', title: 'Hide Post', post: post.toObject(), media: normalizeMedia(post), artistName: getArtistName(post) });
});

router.get(['/artist-posts/:id/unrestrict'], isLoggedIn, hasAdminPermission('manage_artist_posts'), async (req, res) => {
  const post = await ArtistPost.findById(req.params.id).populate('artist', 'stageName user');
  if (!post) return res.redirect('/admin/posts');
  res.render('admin/artist-posts-unrestrict', { layout: 'admin', currentPath: '/admin/posts', title: 'Unhide Post', post: post.toObject(), media: normalizeMedia(post), artistName: getArtistName(post) });
});

router.get(['/artist-posts/:id/delete'], isLoggedIn, hasAdminPermission('manage_artist_posts'), async (req, res) => {
  const post = await ArtistPost.findById(req.params.id).populate('artist', 'stageName user');
  if (!post) return res.redirect('/admin/posts');
  res.render('admin/artist-posts-delete', { layout: 'admin', currentPath: '/admin/posts', title: 'Delete Post', post: post.toObject(), media: normalizeMedia(post), artistName: getArtistName(post) });
});

// Action POST handlers (no JS needed)
router.post('/artist-posts/:id/approve-do', isLoggedIn, hasAdminPermission('manage_artist_posts'), async (req, res) => {
  try {
    await ArtistPost.findByIdAndUpdate(req.params.id, {
      isApproved: true,
      rejectionReason: undefined,
      approvedBy: req.session.user.id
    });
    req.flash('success', 'Post approved');
  } catch (e) {
    console.error('Approve-do error:', e);
    req.flash('error', 'Failed to approve post');
  }
  res.redirect('/admin/posts');
});

router.post('/artist-posts/:id/reject-do', isLoggedIn, hasAdminPermission('manage_artist_posts'), async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    await ArtistPost.findByIdAndUpdate(req.params.id, {
      isApproved: false,
      rejectionReason,
      approvedBy: req.session.user.id
    });
    req.flash('success', 'Post rejected');
  } catch (e) {
    console.error('Reject-do error:', e);
    req.flash('error', 'Failed to reject post');
  }
  res.redirect('/admin/posts');
});

router.post('/artist-posts/:id/restrict-do', isLoggedIn, hasAdminPermission('manage_artist_posts'), async (req, res) => {
  try {
    const { reason } = req.body;
    await ArtistPost.findByIdAndUpdate(req.params.id, {
      isActive: false,
      rejectionReason: reason // Still save the given reason if we need it
    });
    req.flash('success', 'Post hidden successfully');
  } catch (e) {
    console.error('Restrict-do error:', e);
    req.flash('error', 'Failed to hide post');
  }
  res.redirect('/admin/posts');
});

router.post('/artist-posts/:id/unrestrict-do', isLoggedIn, hasAdminPermission('manage_artist_posts'), async (req, res) => {
  try {
    await ArtistPost.findByIdAndUpdate(req.params.id, {
      $set: { isActive: true },
      $unset: { rejectionReason: 1 }
    });
    req.flash('success', 'Post unhidden successfully');
  } catch (e) {
    console.error('Unrestrict-do error:', e);
    req.flash('error', 'Failed to unhide post');
  }
  res.redirect('/admin/posts');
});

router.post('/artist-posts/:id/delete-do', isLoggedIn, hasAdminPermission('manage_artist_posts'), async (req, res) => {
  try {
    const post = await ArtistPost.findById(req.params.id);
    if (post && post.media && post.media.publicId) {
      await deleteMedia([post.media.publicId]);
    }
    await ArtistPost.findByIdAndDelete(req.params.id);
    req.flash('success', 'Post deleted');
  } catch (e) {
    console.error('Delete-do error:', e);
    req.flash('error', 'Failed to delete post');
  }
  res.redirect('/admin/posts');
});

// Revenue Analysis Routes
router.get('/revenue-analysis', isLoggedIn, hasAdminPermission('manage_revenue_analysis'), async (req, res) => {
  try {
    // Get search parameters
    const { startDate, endDate, revenueSource, userFilter, amountMin, amountMax, paymentStatus, concertFilter: concertNameFilter, concertStatus, cityFilter, stateFilter } = req.query;

    // Build filter object
    let filter = {};
    if (startDate) filter.createdAt = { $gte: new Date(startDate) };
    if (endDate) {
      if (filter.createdAt) {
        filter.createdAt.$lte = new Date(endDate);
      } else {
        filter.createdAt = { $lte: new Date(endDate) };
      }
    }

    // Get all revenue data from different sources
    // 1. Ticket revenue
    let ticketFilter = { ...filter };
    if (paymentStatus && paymentStatus !== 'all') {
      ticketFilter.paymentStatus = paymentStatus;
    }
    if (amountMin) ticketFilter.totalAmount = { $gte: parseFloat(amountMin) };
    if (amountMax) {
      ticketFilter.totalAmount = ticketFilter.totalAmount ? { ...ticketFilter.totalAmount, $lte: parseFloat(amountMax) } : { $lte: parseFloat(amountMax) };
    }

    const tickets = await Ticket.find(ticketFilter)
      .populate('user', 'name email')
      .populate({
        path: 'concert',
        populate: { path: 'artist', populate: { path: 'user', select: 'name' } }
      });

    // 2. Subscription revenue
    const subscriptionFilter = { ...filter };
    const subscriptions = await require('../models/UserSubscription').find(subscriptionFilter)
      .populate('user', 'name email')
      .populate('plan', 'name price');

    // 3. Venue booking revenue (commission)
    const venueBookingFilter = { ...filter };
    if (venueBookingFilter.createdAt) {
      venueBookingFilter.createdAt = { $gte: venueBookingFilter.createdAt.$gte || new Date(0), $lte: venueBookingFilter.createdAt.$lte || new Date() };
    }
    const concerts = await Concert.find(venueBookingFilter)
      .populate('venue', 'name')
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name' }
      });

    // Calculate revenue breakdowns
    const revenueSources = {
      ticket: {
        name: 'Ticket Commission Revenue',
        total: tickets.filter(t => t.commissionApplied === true).reduce((sum, ticket) => sum + (ticket.commissionAmount || 0), 0),
        count: tickets.filter(t => t.commissionApplied === true).length,
        items: tickets.filter(t => t.commissionApplied === true)
      },
      venue: {
        name: 'Venue Booking Commission',
        total: concerts.reduce((sum, concert) => {
          const commission = concert.venueBooking?.adminCommission?.advanceAmount ||
            (concert.venueBooking?.totalVenueCost * (concert.venueBooking?.adminCommission?.percentage || 0)) / 100 || 0;
          return sum + commission;
        }, 0),
        count: concerts.length,
        items: concerts
      },
      subscription: {
        name: 'Subscription Revenue',
        total: subscriptions.reduce((sum, sub) => sum + (sub.amount || 0), 0),
        count: subscriptions.length,
        items: subscriptions
      },
      distribution: {
        name: 'Distribution Fee Revenue',
        total: await Transaction.aggregate([
          { $match: { type: 'distribution', status: 'success', ...filter } },
          { $group: { _id: null, total: { $sum: '$platformFee' } } }
        ]).then(res => res[0]?.total || 0),
        count: await Transaction.countDocuments({ type: 'distribution', status: 'success', ...filter }),
        items: await Transaction.find({ type: 'distribution', status: 'success', ...filter }).populate('user', 'name email').populate('payee', 'name email')
      }
    };

    // Calculate totals
    const totalRevenue = Object.values(revenueSources).reduce((sum, source) => sum + source.total, 0);

    // Get user-specific revenue if user filter is applied
    let userRevenue = null;
    if (userFilter) {
      const user = await User.findOne({ $or: [{ name: new RegExp(userFilter, 'i') }, { email: new RegExp(userFilter, 'i') }] });
      if (user) {
        userRevenue = {
          user: user,
          ticketRevenue: tickets.filter(t => t.user && t.user._id.toString() === user._id.toString()).reduce((sum, t) => sum + (t.totalAmount || 0), 0),
          subscriptionRevenue: subscriptions.filter(s => s.user && s.user._id.toString() === user._id.toString()).reduce((sum, s) => sum + (s.amount || 0), 0)
        };
      }
    }

    // Get filtered statistics
    // For concerts, we use venueBookingFilter but may need to apply additional concert-specific filters
    let concertFilter = { ...venueBookingFilter };
    if (concertNameFilter) {
      concertFilter.title = { $regex: concertNameFilter, $options: 'i' };
    }

    // Add concert status filter (past/upcoming)
    if (concertStatus === 'past') {
      concertFilter.date = { $lt: new Date() };
    } else if (concertStatus === 'upcoming') {
      concertFilter.date = { $gte: new Date() };
    }

    // Add city filter
    if (cityFilter) {
      concertFilter.city = { $regex: cityFilter, $options: 'i' };
    }

    // Add state filter
    if (stateFilter) {
      concertFilter.state = { $regex: stateFilter, $options: 'i' };
    }

    const filteredConcerts = await Concert.countDocuments(concertFilter);

    // For tickets, we use ticketFilter which already includes all ticket-specific filters
    const filteredTickets = await Ticket.countDocuments(ticketFilter);

    // For users, we need to apply user-specific filters
    let userStatsFilter = { ...filter };
    if (userFilter) {  // userFilter comes from the destructuring at the top
      userStatsFilter.$or = [
        { name: { $regex: userFilter, $options: 'i' } },
        { email: { $regex: userFilter, $options: 'i' } }
      ];
    }
    const filteredUsers = await User.countDocuments(userStatsFilter);

    // Get filtered user details if user filter is applied
    let filteredUserDetails = [];
    if (userFilter) {
      filteredUserDetails = await User.find(userStatsFilter).limit(10); // Limit to first 10 for display
    }

    // Get filtered concert details if any concert filter is applied
    let filteredConcertDetails = [];
    if (concertNameFilter || concertStatus || cityFilter || stateFilter) {
      filteredConcertDetails = await Concert.find(concertFilter)
        .populate({
          path: 'artist',
          populate: { path: 'user', select: 'name' }
        })
        .populate('venue', 'name state city')
        .limit(10); // Limit to first 10 for display
    }

    res.render('admin/revenue-analysis', {
      layout: 'admin',
      currentPath: '/admin/revenue-analysis',
      title: 'Revenue Analysis',
      revenueSources,
      totalRevenue,
      tickets,
      subscriptions,
      concerts,
      userRevenue,
      stats: {
        concerts: filteredConcerts,
        tickets: filteredTickets,
        users: filteredUsers
      },
      filteredUserDetails,
      filteredConcertDetails,
      filters: {
        startDate: startDate || '',
        endDate: endDate || '',
        revenueSource: revenueSource || 'all',
        userFilter: userFilter || '',
        amountMin: amountMin || '',
        amountMax: amountMax || '',
        paymentStatus: paymentStatus || 'all',
        concertFilter: concertNameFilter || '',
        concertStatus: concertStatus || 'all',
        cityFilter: cityFilter || '',
        stateFilter: stateFilter || ''
      }
    });
  } catch (error) {
    console.error('Revenue analysis error:', error);
    req.flash('error', 'Failed to load revenue analysis');
    res.redirect('/admin');
  }
});

// Export revenue data to CSV
router.get('/revenue-analysis/export', isLoggedIn, hasAdminPermission('manage_revenue_analysis'), async (req, res) => {
  try {
    const { startDate, endDate, revenueSource } = req.query;

    let filter = {};
    if (startDate) filter.createdAt = { $gte: new Date(startDate) };
    if (endDate) {
      if (filter.createdAt) {
        filter.createdAt.$lte = new Date(endDate);
      } else {
        filter.createdAt = { $lte: new Date(endDate) };
      }
    }

    const tickets = await Ticket.find(filter)
      .populate('user', 'name email')
      .populate({
        path: 'concert',
        populate: { path: 'artist', populate: { path: 'user', select: 'name' } }
      });

    const subscriptions = await require('../models/UserSubscription').find(filter)
      .populate('user', 'name email')
      .populate('plan', 'name price');

    // Generate CSV content
    const csvHeader = 'Date,Revenue Type,User,Amount,Description\n';
    const csvRows = [];

    // Add ticket revenue
    tickets.forEach(ticket => {
      if (ticket.commissionApplied && (ticket.commissionAmount || 0) > 0) {
        csvRows.push(`${new Date(ticket.createdAt).toLocaleDateString()},Ticket Commission,${ticket.user?.name || 'Unknown User'},${ticket.commissionAmount || 0},Ticket #${ticket._id} for ${ticket.concert?.title || 'Unknown Concert'}`);
      }
    });

    // Add subscription revenue
    subscriptions.forEach(sub => {
      csvRows.push(`${new Date(sub.createdAt).toLocaleDateString()},Subscription,${sub.user?.name || 'Unknown User'},${sub.amount || 0},Subscription to ${sub.plan?.name || 'Unknown Plan'}`);
    });

    const csvContent = csvHeader + csvRows.join('\n');

    // Set response headers for file download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `revenue_export_${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Export revenue error:', error);
    req.flash('error', 'Failed to export revenue data');
    res.redirect('/admin/revenue-analysis');
  }
});

// Export revenue data to HTML
router.get('/revenue-analysis/export-html', isLoggedIn, hasAdminPermission('manage_revenue_analysis'), async (req, res) => {
  try {
    // Get search parameters (same as main revenue analysis route)
    const { startDate, endDate, revenueSource, userFilter, amountMin, amountMax, paymentStatus, concertFilter: concertNameFilter, concertStatus, cityFilter, stateFilter } = req.query;

    // Build filter object
    let filter = {};
    if (startDate) filter.createdAt = { $gte: new Date(startDate) };
    if (endDate) {
      if (filter.createdAt) {
        filter.createdAt.$lte = new Date(endDate);
      } else {
        filter.createdAt = { $lte: new Date(endDate) };
      }
    }

    // Build concert filter
    let concertFilterObj = {};
    if (startDate) concertFilterObj.createdAt = { $gte: new Date(startDate) };
    if (endDate) {
      if (concertFilterObj.createdAt) {
        concertFilterObj.createdAt.$lte = new Date(endDate);
      } else {
        concertFilterObj.createdAt = { $lte: new Date(endDate) };
      }
    }
    if (concertNameFilter) {
      concertFilterObj.title = { $regex: concertNameFilter, $options: 'i' };
    }

    // Add concert status filter (past/upcoming)
    if (concertStatus === 'past') {
      concertFilterObj.date = { $lt: new Date() };
    } else if (concertStatus === 'upcoming') {
      concertFilterObj.date = { $gte: new Date() };
    }

    // Add city filter
    if (cityFilter) {
      concertFilterObj.city = { $regex: cityFilter, $options: 'i' };
    }

    // Add state filter
    if (stateFilter) {
      concertFilterObj.state = { $regex: stateFilter, $options: 'i' };
    }

    // Get all revenue data from different sources
    // 1. Ticket revenue
    let ticketFilter = { ...filter };
    if (paymentStatus && paymentStatus !== 'all') {
      ticketFilter.paymentStatus = paymentStatus;
    }
    if (amountMin) ticketFilter.totalAmount = { $gte: parseFloat(amountMin) };
    if (amountMax) {
      ticketFilter.totalAmount = ticketFilter.totalAmount ? { ...ticketFilter.totalAmount, $lte: parseFloat(amountMax) } : { $lte: parseFloat(amountMax) };
    }

    const tickets = await Ticket.find(ticketFilter)
      .populate('user', 'name email')
      .populate({
        path: 'concert',
        populate: { path: 'artist', populate: { path: 'user', select: 'name' } }
      });

    // 2. Subscription revenue
    const subscriptionFilter = { ...filter };
    const subscriptions = await require('../models/UserSubscription').find(subscriptionFilter)
      .populate('user', 'name email')
      .populate('plan', 'name price');

    // 3. Venue booking revenue (commission)
    const concerts = await Concert.find(concertFilterObj)
      .populate('venue', 'name')
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name' }
      });

    // Calculate revenue breakdowns
    const revenueSources = {
      ticket: {
        name: 'Ticket Commission Revenue',
        total: tickets.filter(t => t.commissionApplied === true).reduce((sum, ticket) => sum + (ticket.commissionAmount || 0), 0),
        count: tickets.filter(t => t.commissionApplied === true).length,
        items: tickets.filter(t => t.commissionApplied === true)
      },
      venue: {
        name: 'Venue Booking Commission',
        total: concerts.reduce((sum, concert) => {
          const commission = concert.venueBooking?.adminCommission?.advanceAmount ||
            (concert.venueBooking?.totalVenueCost * (concert.venueBooking?.adminCommission?.percentage || 0)) / 100 || 0;
          return sum + commission;
        }, 0),
        count: concerts.length,
        items: concerts
      },
      subscription: {
        name: 'Subscription Revenue',
        total: subscriptions.reduce((sum, sub) => sum + (sub.amount || 0), 0),
        count: subscriptions.length,
        items: subscriptions
      }
    };

    // Calculate totals
    const totalRevenue = Object.values(revenueSources).reduce((sum, source) => sum + source.total, 0);

    // Get user-specific revenue if user filter is applied
    let userRevenue = null;
    if (userFilter) {
      const user = await User.findOne({ $or: [{ name: new RegExp(userFilter, 'i') }, { email: new RegExp(userFilter, 'i') }] });
      if (user) {
        userRevenue = {
          user: user,
          ticketRevenue: tickets.filter(t => t.user && t.user._id.toString() === user._id.toString()).reduce((sum, t) => sum + (t.totalAmount || 0), 0),
          subscriptionRevenue: subscriptions.filter(s => s.user && s.user._id.toString() === user._id.toString()).reduce((sum, s) => sum + (s.amount || 0), 0)
        };
      }
    }

    // Get filtered statistics
    const filteredConcerts = await Concert.countDocuments(concertFilterObj);

    // For tickets, we use ticketFilter which already includes all ticket-specific filters
    const filteredTickets = await Ticket.countDocuments(ticketFilter);

    // For users, we need to apply user-specific filters
    let userStatsFilter = { ...filter };
    if (userFilter) {  // userFilter comes from the destructuring at the top
      userStatsFilter.$or = [
        { name: { $regex: userFilter, $options: 'i' } },
        { email: { $regex: userFilter, $options: 'i' } }
      ];
    }
    const filteredUsers = await User.countDocuments(userStatsFilter);

    // Get filtered user details if user filter is applied
    let filteredUserDetails = [];
    if (userFilter) {
      filteredUserDetails = await User.find(userStatsFilter).limit(10); // Limit to first 10 for display
    }

    // Get filtered concert details if any concert filter is applied
    let filteredConcertDetails = [];
    if (concertNameFilter || concertStatus !== 'all' || cityFilter || stateFilter) {
      filteredConcertDetails = await Concert.find(concertFilterObj)
        .populate({
          path: 'artist',
          populate: { path: 'user', select: 'name' }
        })
        .populate('venue', 'name state city')
        .limit(10); // Limit to first 10 for display
    }

    // Get the password from query parameters
    const { password } = req.query;

    // Generate HTML content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>RAPIRA - Revenue Analysis Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; background-color: #f8f9fa; }
          .password-protected { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background-color: #f8f9fa; }
          .password-form { background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 300px; text-align: center; }
          .password-form input { width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; }
          .password-form button { background-color: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; width: 100%; }
          .password-form button:hover { background-color: #0056b3; }
          .content { display: none; }
          .header { text-align: center; margin-bottom: 30px; padding: 20px; background-color: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .section { margin-bottom: 25px; background-color: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
          .stat-card { border: 1px solid #e9ecef; padding: 15px; border-radius: 8px; text-align: center; background-color: #f8f9fa; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th, td { border: 1px solid #dee2e6; padding: 12px; text-align: left; }
          th { background-color: #e9ecef; font-weight: bold; }
          .filter-info { background-color: #f1f8e9; padding: 15px; border-radius: 8px; margin: 10px 0; border-left: 4px solid #4caf50; }
          .page-title { color: #495057; margin-bottom: 10px; }
          .app-name { color: #495057; font-size: 24px; font-weight: bold; margin-bottom: 5px; }
          .generated-date { color: #6c757d; font-style: italic; }
        </style>
      </head>
      <body>
        <div id="passwordScreen" class="password-protected">
          <div class="password-form">
            <h2>RAPIRA</h2>
            <h3>Revenue Analysis Report</h3>
            <p>Please enter password to view this report</p>
            <input type="password" id="password" placeholder="Enter password">
            <button onclick="checkPassword()">Access Report</button>
            <p style="margin-top: 15px; font-size: 12px; color: #6c757d;">Report generated on: ${new Date().toLocaleString()}</p>
          </div>
        </div>
        
        <div id="content" class="content">
          <div class="header">
            <h2 class="app-name">RAPIRA</h2>
            <h1 class="page-title">Revenue Analysis Report</h1>
            <p class="generated-date">Generated on: ${new Date().toLocaleString()}</p>
          </div>
          
          <div class="section">
            <h2>Applied Filters</h2>
            <div class="filter-info">
              ${startDate ? `<p><strong>Start Date:</strong> ${new Date(startDate).toLocaleDateString()}</p>` : '<p><strong>Start Date:</strong> All</p>'}
              ${endDate ? `<p><strong>End Date:</strong> ${new Date(endDate).toLocaleDateString()}</p>` : '<p><strong>End Date:</strong> All</p>'}
              ${userFilter ? `<p><strong>User Filter:</strong> ${userFilter}</p>` : '<p><strong>User Filter:</strong> All</p>'}
              ${concertNameFilter ? `<p><strong>Concert Filter:</strong> ${concertNameFilter}</p>` : '<p><strong>Concert Filter:</strong> All</p>'}
              ${concertStatus && concertStatus !== 'all' ? `<p><strong>Concert Status:</strong> ${concertStatus}</p>` : '<p><strong>Concert Status:</strong> All</p>'}
              ${cityFilter ? `<p><strong>City:</strong> ${cityFilter}</p>` : '<p><strong>City:</strong> All</p>'}
              ${stateFilter ? `<p><strong>State:</strong> ${stateFilter}</p>` : '<p><strong>State:</strong> All</p>'}
              ${amountMin ? `<p><strong>Min Amount:</strong> ${amountMin}</p>` : ''}
              ${amountMax ? `<p><strong>Max Amount:</strong> ${amountMax}</p>` : ''}
              ${paymentStatus && paymentStatus !== 'all' ? `<p><strong>Payment Status:</strong> ${paymentStatus}</p>` : ''}
            </div>
          </div>
          
          <div class="section">
            <h2>Revenue Summary</h2>
            <div class="stats-grid">
              <div class="stat-card">
                <h3>₹${totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                <p>Total Revenue</p>
              </div>
              <div class="stat-card">
                <h3>₹${revenueSources.ticket.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                <p>Ticket Commission</p>
              </div>
              <div class="stat-card">
                <h3>₹${revenueSources.venue.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                <p>Venue Booking Commission</p>
              </div>
              <div class="stat-card">
                <h3>₹${revenueSources.subscription.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                <p>Subscription Revenue</p>
              </div>
            </div>
          </div>
          
          <div class="section">
            <h2>Filtered Statistics</h2>
            <div class="stats-grid">
              <div class="stat-card">
                <h3>${filteredConcerts}</h3>
                <p>Filtered Concerts</p>
              </div>
              <div class="stat-card">
                <h3>${filteredTickets}</h3>
                <p>Filtered Tickets</p>
              </div>
              <div class="stat-card">
                <h3>${filteredUsers}</h3>
                <p>Filtered Users</p>
              </div>
            </div>
          </div>
          
          ${filteredUserDetails.length > 0 ? `
          <div class="section">
            <h2>Filtered Users (${filteredUserDetails.length})</h2>
            <table>
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Registration Date</th>
                </tr>
              </thead>
              <tbody>
                ${filteredUserDetails.map(user => `
                  <tr>
                    <td>${user._id.toString().slice(-6).toUpperCase()}</td>
                    <td>${user.name || 'N/A'}</td>
                    <td>${user.email || 'N/A'}</td>
                    <td>${user.role || 'N/A'}</td>
                    <td>${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}
          
          ${filteredConcertDetails.length > 0 ? `
          <div class="section">
            <h2>Filtered Concerts (${filteredConcertDetails.length})</h2>
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Artist</th>
                  <th>Venue</th>
                  <th>Date</th>
                  <th>City</th>
                  <th>State</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${filteredConcertDetails.map(concert => `
                  <tr>
                    <td>${concert.title || 'N/A'}</td>
                    <td>${concert.artist && concert.artist.user ? concert.artist.user.name : (concert.artist ? concert.artist.name : 'N/A')}</td>
                    <td>${concert.venue ? concert.venue.name : 'N/A'}</td>
                    <td>${concert.date ? new Date(concert.date).toLocaleDateString() : 'N/A'}</td>
                    <td>${concert.city || (concert.venue ? concert.venue.city : 'N/A')}</td>
                    <td>${concert.venue ? concert.venue.state : 'N/A'}</td>
                    <td>${concert.status || 'N/A'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}
          
          <div class="section">
            <h2>Ticket Revenue Details</h2>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Revenue Type</th>
                  <th>User</th>
                  <th>Amount</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                ${revenueSources.ticket.items.map(ticket => `
                  <tr>
                    <td>${new Date(ticket.createdAt).toLocaleDateString()}</td>
                    <td>Ticket Commission</td>
                    <td>${ticket.user?.name || 'Unknown User'}</td>
                    <td>₹${(ticket.commissionAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td>Ticket #${ticket._id} for ${ticket.concert?.title || 'Unknown Concert'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          <div class="section">
            <h2>Venue Booking Commission Details</h2>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Revenue Type</th>
                  <th>Concert</th>
                  <th>Artist</th>
                  <th>Venue</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                ${revenueSources.venue.items.map(concert => `
                  <tr>
                    <td>${concert.date ? new Date(concert.date).toLocaleDateString() : 'N/A'}</td>
                    <td>Venue Commission</td>
                    <td>${concert.title || 'N/A'}</td>
                    <td>${concert.artist && concert.artist.user ? concert.artist.user.name : (concert.artist ? concert.artist.name : 'N/A')}</td>
                    <td>${concert.venue ? concert.venue.name : 'N/A'}</td>
                    <td>₹${(concert.venueBooking?.adminCommission?.advanceAmount ||
        (concert.venueBooking?.totalVenueCost * (concert.venueBooking?.adminCommission?.percentage || 0)) / 100 || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          <div class="section">
            <h2>Subscription Revenue Details</h2>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Revenue Type</th>
                  <th>User</th>
                  <th>Amount</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                ${revenueSources.subscription.items.map(sub => `
                  <tr>
                    <td>${new Date(sub.createdAt).toLocaleDateString()}</td>
                    <td>Subscription</td>
                    <td>${sub.user?.name || 'Unknown User'}</td>
                    <td>₹${(sub.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td>Subscription to ${sub.plan?.name || 'Unknown Plan'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
        
        <script>
          // Password for this report - set during export
          const correctPassword = "${password || 'admin'}";
          
          function checkPassword() {
            const passwordInput = document.getElementById('password').value;
            
            if (passwordInput === correctPassword) {
              document.getElementById('passwordScreen').style.display = 'none';
              document.getElementById('content').style.display = 'block';
            } else {
              alert('Incorrect password. Please try again.');
            }
          }
          
          // Allow Enter key to submit password
          document.getElementById('password').addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
              checkPassword();
            }
          });
        </script>
      </body>
      </html>
    `;

    // Send HTML as download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `revenue_analysis_report_${timestamp}.html`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(htmlContent);
  } catch (error) {
    console.error('Export revenue HTML error:', error);
    req.flash('error', 'Failed to export revenue data to HTML');
    res.redirect('/admin/revenue-analysis');
  }
});

// Password entry page for HTML export
router.get('/revenue-analysis/password-entry', isLoggedIn, hasAdminPermission('manage_revenue_analysis'), async (req, res) => {
  try {
    // Get all filter parameters to pass to the password entry page
    const {
      startDate, endDate, revenueSource, userFilter, amountMin, amountMax,
      paymentStatus, concertFilter, concertStatus, cityFilter, stateFilter
    } = req.query;

    res.render('admin/revenue-analysis-password', {
      layout: 'admin',
      currentPath: '/admin/revenue-analysis',
      title: 'Set Export Password',
      filters: {
        startDate: startDate || '',
        endDate: endDate || '',
        revenueSource: revenueSource || 'all',
        userFilter: userFilter || '',
        amountMin: amountMin || '',
        amountMax: amountMax || '',
        paymentStatus: paymentStatus || 'all',
        concertFilter: concertFilter || '',
        concertStatus: concertStatus || 'all',
        cityFilter: cityFilter || '',
        stateFilter: stateFilter || ''
      }
    });
  } catch (error) {
    console.error('Password entry page error:', error);
    req.flash('error', 'Failed to load password entry page');
    res.redirect('/admin/revenue-analysis');
  }
});

// Handle password submission for HTML export
router.post('/revenue-analysis/export-with-password', isLoggedIn, hasAdminPermission('manage_revenue_analysis'), async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || password.trim() === '') {
      req.flash('error', 'Password cannot be empty');
      // Get the filter parameters from the form
      const {
        startDate, endDate, revenueSource, userFilter, amountMin, amountMax,
        paymentStatus, concertFilter, concertStatus, cityFilter, stateFilter
      } = req.body;

      return res.render('admin/revenue-analysis-password', {
        layout: 'admin',
        currentPath: '/admin/revenue-analysis',
        title: 'Set Export Password',
        filters: {
          startDate: startDate || '',
          endDate: endDate || '',
          revenueSource: revenueSource || 'all',
          userFilter: userFilter || '',
          amountMin: amountMin || '',
          amountMax: amountMax || '',
          paymentStatus: paymentStatus || 'all',
          concertFilter: concertFilter || '',
          concertStatus: concertStatus || 'all',
          cityFilter: cityFilter || '',
          stateFilter: stateFilter || ''
        }
      });
    }

    // Build query string with all filters and password
    const exportParams = [];
    if (req.body.startDate) exportParams.push(`startDate=${encodeURIComponent(req.body.startDate)}`);
    if (req.body.endDate) exportParams.push(`endDate=${encodeURIComponent(req.body.endDate)}`);
    if (req.body.revenueSource && req.body.revenueSource !== 'all') exportParams.push(`revenueSource=${encodeURIComponent(req.body.revenueSource)}`);
    if (req.body.userFilter) exportParams.push(`userFilter=${encodeURIComponent(req.body.userFilter)}`);
    if (req.body.amountMin) exportParams.push(`amountMin=${encodeURIComponent(req.body.amountMin)}`);
    if (req.body.amountMax) exportParams.push(`amountMax=${encodeURIComponent(req.body.amountMax)}`);
    if (req.body.paymentStatus && req.body.paymentStatus !== 'all') exportParams.push(`paymentStatus=${encodeURIComponent(req.body.paymentStatus)}`);
    if (req.body.concertFilter) exportParams.push(`concertFilter=${encodeURIComponent(req.body.concertFilter)}`);
    if (req.body.concertStatus && req.body.concertStatus !== 'all') exportParams.push(`concertStatus=${encodeURIComponent(req.body.concertStatus)}`);
    if (req.body.cityFilter) exportParams.push(`cityFilter=${encodeURIComponent(req.body.cityFilter)}`);
    if (req.body.stateFilter) exportParams.push(`stateFilter=${encodeURIComponent(req.body.stateFilter)}`);
    exportParams.push(`password=${encodeURIComponent(password)}`);

    const exportQueryString = exportParams.join('&');

    // Redirect to the HTML export route with all parameters
    res.redirect(`/admin/revenue-analysis/export-html?${exportQueryString}`);
  } catch (error) {
    console.error('Export with password error:', error);
    req.flash('error', 'Failed to export with password');
    res.redirect('/admin/revenue-analysis');
  }
});

// Admin view distribution records
router.get('/distribution-requests', isLoggedIn, hasAdminPermission('manage_distribution_receipts'), async (req, res) => {
  try {
    const { status, paymentStatus, artistSearch, distributorSearch } = req.query;
    let query = { deletedByAdmin: { $ne: true } };

    if (status && status !== 'all') {
      query.status = status;
    }

    if (paymentStatus && paymentStatus !== 'all') {
      query.paymentStatus = paymentStatus;
    }

    if (req.query.billSearch) {
      query.receiptNumber = { $regex: new RegExp(req.query.billSearch.trim(), 'i') };
    }

    const DistributionRequest = require('../models/DistributionRequest');
    let requests = await DistributionRequest.find(query)
      .populate('artist', 'name email profileImage')
      .populate('package', 'name price')
      .populate('distributor', 'name email')
      .sort({ createdAt: -1 });

    if (artistSearch) {
      const searchLower = artistSearch.toLowerCase();
      requests = requests.filter(req => {
        const nameMatch = req.artist && req.artist.name && req.artist.name.toLowerCase().includes(searchLower);
        const emailMatch = req.artist && req.artist.email && req.artist.email.toLowerCase().includes(searchLower);
        return nameMatch || emailMatch;
      });
    }

    if (distributorSearch) {
      const searchLower = distributorSearch.toLowerCase();
      requests = requests.filter(req => {
        const nameMatch = req.distributor && req.distributor.name && req.distributor.name.toLowerCase().includes(searchLower);
        const emailMatch = req.distributor && req.distributor.email && req.distributor.email.toLowerCase().includes(searchLower);
        return nameMatch || emailMatch;
      });
    }

    res.render('admin/distribution-requests', {
      layout: 'admin',
      title: 'Distribution Requests',
      currentPath: '/admin/distribution-requests',
      requests,
      filters: {
        status: status || 'all',
        paymentStatus: paymentStatus || 'all',
        artistSearch: artistSearch || '',
        distributorSearch: distributorSearch || '',
        billSearch: req.query.billSearch || ''
      }
    });
  } catch (error) {
    console.error('Error loading distribution requests:', error);
    req.flash('error', 'Failed to load distribution requests');
    res.redirect('/admin');
  }
});

router.get('/distribution-requests/receipt/:id', isLoggedIn, hasAdminPermission('manage_distribution_receipts'), async (req, res) => {
  try {
    const DistributionRequest = require('../models/DistributionRequest');
    const request = await DistributionRequest.findOne({ _id: req.params.id })
      .populate('distributor', 'name email profileImage')
      .populate('package')
      .populate('artist', 'name email');

    if (!request) {
      req.flash('error', 'Receipt not found');
      return res.redirect('/admin/distribution-requests');
    }

    res.render('users/distribution-receipt', {
      layout: false,
      request,
      currentUser: req.session.user,
      backLink: '/admin/distribution-requests'
    });
  } catch (error) {
    console.error('Receipt error:', error);
    req.flash('error', 'Failed to load receipt');
    res.redirect('/admin/distribution-requests');
  }
});

router.post('/distribution-requests/:id/delete', isLoggedIn, hasAdminPermission('manage_distribution_receipts'), async (req, res) => {
  try {
    const DistributionRequest = require('../models/DistributionRequest');
    const request = await DistributionRequest.findById(req.params.id);

    if (!request) {
      req.flash('error', 'Request not found');
      return res.redirect('/admin/distribution-requests');
    }

    request.deletedByAdmin = true;
    await request.save();

    req.flash('success', 'Distribution record removed from admin dashboard');
    res.redirect('/admin/distribution-requests');
  } catch (error) {
    console.error('Error deleting distribution request:', error);
    req.flash('error', 'Failed to delete record');
    res.redirect('/admin/distribution-requests');
  }
});

module.exports = router;
