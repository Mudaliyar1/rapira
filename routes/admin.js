const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Artist = require('../models/Artist');
const Concert = require('../models/Concert');
const Ticket = require('../models/Ticket');
const Content = require('../models/Content');
const Page = require('../models/Page');
const { isLoggedIn, isAdmin, hasPagePermission } = require('../middleware/auth');
const { sendConcertApprovalEmail, sendConcertRejectionEmail, sendTestEmail, sendDirectEmail } = require('../utils/emailService');
const { getAllCollectionStats, formatBytes } = require('../utils/storageStats');
const bcrypt = require('bcryptjs');

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
router.get('/users', isLoggedIn, isAdmin, hasPagePermission('/admin/users'), async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.render('admin/users-new', {
      layout: 'admin',
      currentPath: '/admin/users',
      users
    });
  } catch (error) {
    console.error('Manage users error:', error);
    req.flash('error', 'Failed to load users');
    res.redirect('/admin');
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
router.get('/concerts', isLoggedIn, isAdmin, hasPagePermission('/admin/concerts'), async (req, res) => {
  try {
    const concerts = await Concert.find()
      .sort({ createdAt: -1 })
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name' }
      });

    res.render('admin/concerts-new', {
      layout: 'admin',
      currentPath: '/admin/concerts',
      title: 'Manage Concerts',
      concerts
    });
  } catch (error) {
    console.error('Manage concerts error:', error);
    req.flash('error', 'Failed to load concerts');
    res.redirect('/admin');
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
    const pendingConcerts = await Concert.find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name email' }
      });

    res.render('admin/pending-concerts-new', {
      layout: 'admin',
      currentPath: '/admin/concerts/pending',
      title: 'Pending Concerts',
      pendingConcerts
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

    // Now get only artists with valid user references
    const artists = await Artist.find()
      .populate('user', 'name email')
      .then(artists => artists.filter(artist => artist.user));

    res.render('admin/artists-new', {
      layout: 'admin',
      currentPath: '/admin/artists',
      title: 'Manage Artists',
      artists
    });
  } catch (error) {
    console.error('Manage artists error:', error);
    req.flash('error', 'Failed to load artists');
    res.redirect('/admin');
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
    const tickets = await Ticket.find()
      .sort({ purchaseDate: -1 })
      .populate('user', 'name email')
      .populate('concert', 'title date');

    res.render('admin/tickets-new', {
      layout: 'admin',
      currentPath: '/admin/tickets',
      title: 'Tickets Management',
      tickets
    });
  } catch (error) {
    console.error('Manage tickets error:', error);
    req.flash('error', 'Failed to load tickets');
    res.redirect('/admin');
  }
});

// View ticket details
router.get('/tickets/:id', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('user', 'name email')
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

    res.render('admin/ticket-details', { ticket, concert });
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
    const pages = await Page.find().sort({ createdAt: -1 });
    res.render('admin/pages-new', {
      layout: 'admin',
      currentPath: '/admin/pages',
      title: 'Manage Pages',
      pages
    });
  } catch (error) {
    console.error('Manage pages error:', error);
    req.flash('error', 'Failed to load pages');
    res.redirect('/admin');
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

// Permission denied page
router.get('/permission-denied', isLoggedIn, isAdmin, (req, res) => {
  res.render('admin/permission-denied', {
    layout: 'admin',
    title: 'Permission Denied',
    currentPath: '/admin'
  });
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
router.get('/storage-management', isLoggedIn, isAdmin, hasPagePermission('/admin/storage-management'), async (req, res) => {
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