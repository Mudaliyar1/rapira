const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Artist = require('../models/Artist');
const Concert = require('../models/Concert');
const Ticket = require('../models/Ticket');
const Content = require('../models/Content');
const Page = require('../models/Page');
const { isLoggedIn, isAdmin } = require('../middleware/auth');
const { sendConcertApprovalEmail, sendConcertRejectionEmail, sendTestEmail, sendDirectEmail } = require('../utils/emailService');
const { getAllCollectionStats, formatBytes } = require('../utils/storageStats');
const bcrypt = require('bcryptjs');

// Permission denied page
router.get('/permission-denied', isLoggedIn, isAdmin, (req, res) => {
  res.render('admin/permission-denied', {
    layout: 'admin',
    currentPath: '/admin',
    title: 'Permission Denied'
  });
});

// Test email route
router.get('/test-email', isLoggedIn, isAdmin, async (req, res) => {
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
      user: req.session.user // Pass the user object to the template
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    req.flash('error', 'Failed to load admin dashboard');
    res.redirect('/');
  }
});

// Manage users
router.get('/users', isLoggedIn, isAdmin, async (req, res) => {
  try {
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

    // Get total counts for stats
    const totalUsers = await User.countDocuments();
    const verifiedUsers = await User.countDocuments({ isVerified: true });
    const adminUsers = await User.countDocuments({ role: 'admin' });
    const artistUsers = await User.countDocuments({ role: 'artist' });

    res.render('admin/users-new', {
      layout: 'admin',
      currentPath: '/admin/users',
      users,
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
        filtered: users.length
      }
    });
  } catch (error) {
    console.error('Manage users error:', error);
    req.flash('error', 'Failed to load users');
    res.redirect('/admin');
  }
});

// Export users to CSV
router.get('/users/export', isLoggedIn, isAdmin, async (req, res) => {
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
router.get('/users/add', isLoggedIn, isAdmin, (req, res) => {
  res.render('admin/add-user-new', {
    layout: 'admin',
    currentPath: '/admin/users'
  });
});

// Add user process
router.post('/users/add', isLoggedIn, isAdmin, async (req, res) => {
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
router.get('/users/:id/edit', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/admin/users');
    }

    res.render('admin/edit-user', { user });
  } catch (error) {
    console.error('Edit user error:', error);
    req.flash('error', 'Failed to load user');
    res.redirect('/admin/users');
  }
});

// Update user
router.post('/users/:id/update', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { name, email, role, password } = req.body;

    // Find user
    const user = await User.findById(req.params.id);

    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/admin/users');
    }

    // Update user fields
    user.name = name;
    user.email = email;

    // Only update role if it's different
    if (user.role !== role) {
      // If changing to artist, create artist profile if it doesn't exist
      if (role === 'artist' && user.role !== 'artist') {
        const existingArtist = await Artist.findOne({ user: user._id });

        if (!existingArtist) {
          const newArtist = new Artist({
            user: user._id,
            stageName: name,
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

    // Update password if provided
    if (password && password.trim() !== '') {
      user.password = password;
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
router.post('/users/:id/delete', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/admin/users');
    }

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
router.get('/concerts', isLoggedIn, isAdmin, async (req, res) => {
  try {
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

    // Get concerts with filters
    let concerts = await Concert.find(filter)
      .sort(sortOptions)
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name' }
      });

    // Apply text search on populated data
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      concerts = concerts.filter(concert => {
        const title = (concert.title || '').toLowerCase();
        const venue = (concert.venue || '').toLowerCase();
        const city = (concert.city || '').toLowerCase();
        const artistName = (concert.artist && concert.artist.user ? concert.artist.user.name : '').toLowerCase();

        return title.includes(searchTerm) ||
               venue.includes(searchTerm) ||
               city.includes(searchTerm) ||
               artistName.includes(searchTerm);
      });
    }

    // Venue filter (after population)
    if (venue && venue !== 'all') {
      concerts = concerts.filter(concert =>
        (concert.venue || '').toLowerCase().includes(venue.toLowerCase())
      );
    }

    // Get statistics
    const totalConcerts = await Concert.countDocuments();
    const approvedConcerts = await Concert.countDocuments({ status: 'approved' });
    const pendingConcerts = await Concert.countDocuments({ status: 'pending' });
    const rejectedConcerts = await Concert.countDocuments({ status: 'rejected' });
    const upcomingConcerts = await Concert.countDocuments({
      status: 'approved',
      date: { $gte: new Date() }
    });

    // Get unique venues for filter dropdown
    const allVenues = await Concert.find().distinct('venue');
    const venues = allVenues.filter(v => v && v.trim()).sort();

    res.render('admin/concerts-new', {
      layout: 'admin',
      currentPath: '/admin/concerts',
      title: 'Manage Concerts',
      concerts,
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
        filtered: concerts.length
      },
      venues
    });
  } catch (error) {
    console.error('Manage concerts error:', error);
    req.flash('error', 'Failed to load concerts');
    res.redirect('/admin');
  }
});

// Export concerts to CSV
router.get('/concerts/export', isLoggedIn, isAdmin, async (req, res) => {
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
        const venue = (concert.venue || '').toLowerCase();
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
        (concert.venue || '').toLowerCase().includes(venue.toLowerCase())
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
router.get('/concerts/:id/details', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const concert = await Concert.findById(req.params.id)
      .populate({
        path: 'artist',
        populate: { path: 'user' }
      });

    if (!concert) {
      req.flash('error', 'Concert not found');
      return res.redirect('/admin/concerts');
    }

    // Get ticket count for this concert
    const ticketCount = await Ticket.countDocuments({ concert: concert._id, paymentStatus: 'completed' });

    res.render('admin/concert-details-new', {
      layout: 'admin',
      currentPath: '/admin/concerts',
      title: 'Concert Details',
      concert,
      ticketCount
    });
  } catch (error) {
    console.error('Concert details error:', error);
    req.flash('error', 'Failed to load concert details');
    res.redirect('/admin/concerts');
  }
});

// Pending concerts
router.get('/concerts/pending', isLoggedIn, isAdmin, async (req, res) => {
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
      });

    // Apply text search on populated data
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      pendingConcerts = pendingConcerts.filter(concert => {
        const title = (concert.title || '').toLowerCase();
        const venue = (concert.venue || '').toLowerCase();
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
router.post('/concerts/:id/approve', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const concert = await Concert.findById(req.params.id)
      .populate({
        path: 'artist',
        populate: { path: 'user' }
      });

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

    // Send email notification
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

    req.flash('success', 'Concert approved successfully');
    res.redirect('/admin/concerts/pending');
  } catch (error) {
    console.error('Approve concert error:', error);
    req.flash('error', 'Failed to approve concert');
    res.redirect('/admin/concerts/pending');
  }
});

// Reject concert
router.post('/concerts/:id/reject', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { reason } = req.body;

    const concert = await Concert.findById(req.params.id)
      .populate({
        path: 'artist',
        populate: { path: 'user' }
      });

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

    // Send email notification
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

    req.flash('success', 'Concert rejected successfully');
    res.redirect('/admin/concerts/pending');
  } catch (error) {
    console.error('Reject concert error:', error);
    req.flash('error', 'Failed to reject concert');
    res.redirect('/admin/concerts/pending');
  }
});

// Cancel concert
router.post('/concerts/:id/cancel', isLoggedIn, isAdmin, async (req, res) => {
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
router.post('/concerts/:id/delete', isLoggedIn, isAdmin, async (req, res) => {
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
router.get('/artists', isLoggedIn, isAdmin, async (req, res) => {
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
    const { search, genre, status, featured, level, sortBy, sortOrder } = req.query;

    // Build search query
    let query = {};

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

    // Get unique genres for filter dropdown
    const allArtists = await Artist.find().distinct('genre');
    const genres = allArtists.filter(g => g && g !== 'Not specified').sort();

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
      genres
    });
  } catch (error) {
    console.error('Manage artists error:', error);
    req.flash('error', 'Failed to load artists');
    res.redirect('/admin');
  }
});

// Export artists to CSV
router.get('/artists/export', isLoggedIn, isAdmin, async (req, res) => {
  try {
    // Get search parameters (same as main artists route)
    const { search, genre, status, featured, level, sortBy, sortOrder } = req.query;

    // Build search query
    let query = {};

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

// Verify artist
router.post('/artists/:id/verify', isLoggedIn, isAdmin, async (req, res) => {
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
router.post('/artists/:id/feature', isLoggedIn, isAdmin, async (req, res) => {
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
router.post('/artists/:id/delete', isLoggedIn, isAdmin, async (req, res) => {
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

// Manage tickets
router.get('/tickets', isLoggedIn, isAdmin, async (req, res) => {
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
router.get('/tickets/export', isLoggedIn, isAdmin, async (req, res) => {
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
router.get('/tickets/:id', isLoggedIn, isAdmin, async (req, res) => {
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
router.post('/tickets/:id/delete', isLoggedIn, isAdmin, async (req, res) => {
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
router.post('/tickets/bulk-delete', isLoggedIn, isAdmin, async (req, res) => {
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
router.get('/pages', isLoggedIn, isAdmin, async (req, res) => {
  try {
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

    // Get statistics
    const totalPages = await Page.countDocuments();
    const publishedPages = await Page.countDocuments({ published: true });
    const draftPages = await Page.countDocuments({ published: false });
    const navigationPages = await Page.countDocuments({ showInNavigation: true });

    res.render('admin/pages-new', {
      layout: 'admin',
      currentPath: '/admin/pages',
      title: 'Manage Pages',
      pages,
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
        filtered: pages.length
      }
    });
  } catch (error) {
    console.error('Manage pages error:', error);
    req.flash('error', 'Failed to load pages');
    res.redirect('/admin');
  }
});

// Export pages to CSV
router.get('/pages/export', isLoggedIn, isAdmin, async (req, res) => {
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
router.get('/pages/add', isLoggedIn, isAdmin, (req, res) => {
  res.render('admin/add-page', {
    layout: 'admin',
    currentPath: '/admin/pages',
    title: 'Add New Page'
  });
});

// Add page process
router.post('/pages/add', isLoggedIn, isAdmin, async (req, res) => {
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
router.get('/pages/:id/edit', isLoggedIn, isAdmin, async (req, res) => {
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
router.post('/pages/:id/update', isLoggedIn, isAdmin, async (req, res) => {
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
router.post('/pages/:id/delete', isLoggedIn, isAdmin, async (req, res) => {
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
router.get('/test-email', isLoggedIn, isAdmin, async (req, res) => {
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
router.post('/send-direct-email', isLoggedIn, isAdmin, async (req, res) => {
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

// Storage Management
router.get('/storage-management', isLoggedIn, isAdmin, async (req, res) => {
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
router.get('/storage-management/view/:collection', isLoggedIn, isAdmin, async (req, res) => {
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
router.get('/storage-management/confirm-delete/:collection', isLoggedIn, isAdmin, async (req, res) => {
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
router.post('/storage-management/delete/:collection', isLoggedIn, isAdmin, async (req, res) => {
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

module.exports = router;