require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');

// Initialize Express app
const app = express();

// Trust proxy for secure cookies in production environments
// This is important for hosting platforms like Render, Heroku, etc.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
  console.log('Proxy trust enabled for production environment');
}

// Connect to MongoDB with improved error handling and connection options
const connectWithRetry = () => {
  console.log('Attempting to connect to MongoDB...');

  // Parse the MongoDB URI to check for issues
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    // Log a sanitized version of the URI (without credentials)
    const sanitizedUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
    console.log('Using MongoDB URI:', sanitizedUri);

    // Check if the URI contains the expected domain
    if (!uri.includes('mongodb.net') && !uri.includes('localhost')) {
      console.warn('Warning: MongoDB URI does not contain expected domain (mongodb.net or localhost)');
    }
  } catch (error) {
    console.error('Error parsing MongoDB URI:', error.message);
  }

  mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000, // Increased timeout to 30 seconds
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    family: 4, // Use IPv4, skip trying IPv6
    maxPoolSize: 10, // Maintain up to 10 socket connections
    retryWrites: true, // Retry write operations on network errors
    retryReads: true, // Retry read operations on network errors
    heartbeatFrequencyMS: 10000, // Check server status every 10 seconds
    autoIndex: true, // Build indexes
    directConnection: false // Use replica set discovery
  })
  .then(() => {
    console.log('MongoDB Connected Successfully');
  })
  .catch(err => {
    console.error('MongoDB Connection Error:', err);

    // Check for specific error types and provide more helpful messages
    if (err.name === 'MongoServerSelectionError') {
      if (err.message.includes('getaddrinfo ENOTFOUND')) {
        console.error('DNS resolution failed. Check your internet connection or MongoDB Atlas hostname.');
      } else if (err.message.includes('connection timed out')) {
        console.error('Connection timed out. Check your firewall settings or MongoDB Atlas network access list.');
      }
    }

    console.log('Retrying connection in 5 seconds...');
    setTimeout(connectWithRetry, 5000); // Retry after 5 seconds
  });
};

// Initial connection
connectWithRetry();

// Handle MongoDB connection events
mongoose.connection.on('connected', () => {
  console.log('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected from MongoDB');
});

// Handle application termination
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('Mongoose connection closed due to application termination');
  process.exit(0);
});

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Set up EJS layouts
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// Register additional layouts
app.locals.layouts = {
  main: 'layouts/main',
  admin: 'layouts/admin',
  artist: 'layouts/artist',
  demo: 'layouts/demo'
};

// Middleware
// Serve static files with proper CORS headers and content types
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    // Add headers for media files
    if (filePath.endsWith('.mp3') || filePath.endsWith('.mp4') ||
        filePath.endsWith('.pdf') || filePath.endsWith('.wav') ||
        filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') ||
        filePath.endsWith('.png') || filePath.endsWith('.gif')) {

      // Add content type header if missing
      if (!res.getHeader('Content-Type')) {
        if (filePath.endsWith('.mp3')) {
          res.setHeader('Content-Type', 'audio/mpeg');
        } else if (filePath.endsWith('.mp4')) {
          res.setHeader('Content-Type', 'video/mp4');
        } else if (filePath.endsWith('.pdf')) {
          res.setHeader('Content-Type', 'application/pdf');
        } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
          res.setHeader('Content-Type', 'image/jpeg');
        } else if (filePath.endsWith('.png')) {
          res.setHeader('Content-Type', 'image/png');
        } else if (filePath.endsWith('.gif')) {
          res.setHeader('Content-Type', 'image/gif');
        } else if (filePath.endsWith('.wav')) {
          res.setHeader('Content-Type', 'audio/wav');
        }
      }

      // Add CORS headers specifically for media files
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

      // Add Accept-Ranges header for video and audio streaming
      if (filePath.endsWith('.mp4') || filePath.endsWith('.mp3') || filePath.endsWith('.wav')) {
        res.setHeader('Accept-Ranges', 'bytes');
      }
    }
  }
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));

// Session configuration
const isProduction = process.env.NODE_ENV === 'production';
console.log(`Running in ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);
console.log(`BASE_URL: ${process.env.BASE_URL}`);

// Configure session options based on environment
const sessionOptions = {
  secret: process.env.SESSION_SECRET || 'rapira-secret-key',
  resave: false,
  saveUninitialized: true, // Ensure session is always created
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 14 * 24 * 60 * 60, // 14 days
    touchAfter: 24 * 3600, // Only update the session once per 24 hours unless data changes
    autoRemove: 'native', // Use MongoDB's TTL collection feature
    stringify: true, // Better compatibility
    collectionName: 'sessions', // Use a specific collection name
    autoReconnect: true, // Automatically reconnect to MongoDB if connection is lost
    mongoOptions: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // Timeout for server selection
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    }
  }),
  cookie: {
    maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days in milliseconds
    httpOnly: true
  }
};

// Set environment-specific cookie options
if (isProduction) {
  console.log('Using PRODUCTION session settings for Render hosting');
  // Production cookie settings optimized for Render
  sessionOptions.cookie.secure = true; // Always true for HTTPS
  sessionOptions.cookie.sameSite = 'lax'; // More compatible than 'none'

  // Don't set domain for Render - let browser handle it automatically
  // This prevents cross-domain cookie issues
  console.log('Production: Not setting cookie domain (auto-detect)');

  // Additional production settings for Render
  sessionOptions.proxy = true; // Trust proxy headers
  sessionOptions.cookie.httpOnly = true; // Security
  sessionOptions.cookie.maxAge = 24 * 60 * 60 * 1000; // 24 hours instead of 14 days

} else {
  console.log('Using DEVELOPMENT session settings');
  // Development cookie settings
  sessionOptions.cookie.secure = false; // HTTP for localhost
  sessionOptions.cookie.sameSite = 'lax';

  // Don't set domain for localhost
  console.log('Development: Not setting cookie domain for localhost');
}

// If no domain is set yet, try to extract it from BASE_URL
if (!sessionOptions.cookie.domain) {
  const baseUrl = process.env.BASE_URL || '';
  try {
    // Extract domain from BASE_URL if it exists
    if (baseUrl) {
      const url = new URL(baseUrl);
      // Only set domain for non-localhost domains
      if (!url.hostname.includes('localhost') && !url.hostname.includes('127.0.0.1')) {
        console.log(`Setting cookie domain from BASE_URL to: ${url.hostname}`);
        sessionOptions.cookie.domain = url.hostname;
      }
    }
  } catch (e) {
    console.error('Error parsing BASE_URL for cookie domain:', e);
  }
}

// Log session configuration for debugging
console.log('Session configuration:', {
  mode: isProduction ? 'PRODUCTION' : 'DEVELOPMENT',
  cookie: {
    secure: sessionOptions.cookie.secure,
    sameSite: sessionOptions.cookie.sameSite,
    domain: sessionOptions.cookie.domain || 'not set',
    maxAge: sessionOptions.cookie.maxAge / (1000 * 60 * 60 * 24) + ' days',
    httpOnly: sessionOptions.cookie.httpOnly
  },
  session: {
    secret: sessionOptions.secret ? 'configured' : 'missing',
    resave: sessionOptions.resave,
    saveUninitialized: sessionOptions.saveUninitialized
  },
  mongoStore: {
    url: process.env.MONGODB_URI ? 'configured' : 'missing',
    ttl: sessionOptions.store.options.ttl / (60 * 60 * 24) + ' days',
    collection: sessionOptions.store.options.collectionName
  },
  environment: {
    baseUrl: process.env.BASE_URL || 'not set',
    nodeEnv: process.env.NODE_ENV || 'not set',
    prodCookieSecure: process.env.PROD_SESSION_COOKIE_SECURE || 'not set',
    prodCookieSameSite: process.env.PROD_SESSION_COOKIE_SAMESITE || 'not set',
    prodCookieDomain: process.env.PROD_SESSION_COOKIE_DOMAIN || 'not set',
    devCookieSecure: process.env.DEV_SESSION_COOKIE_SECURE || 'not set',
    devCookieSameSite: process.env.DEV_SESSION_COOKIE_SAMESITE || 'not set',
    devCookieDomain: process.env.DEV_SESSION_COOKIE_DOMAIN || 'not set'
  }
});

app.use(session(sessionOptions));

// We've already cleared sessions using the clear-sessions.js script
console.log('Using new session configuration. Previous sessions have been cleared.');


// Flash messages
app.use(flash());

// Import models for user roles check
const UserRole = require('./models/UserRole');
const Role = require('./models/Role');

// Import middleware
const { isLoggedIn, isAdmin } = require('./middleware/auth');
const { createMediaMiddleware } = require('./middleware/mediaMiddleware');
const { checkSubscription } = require('./middleware/subscription');
const { loadWebsiteSettings } = require('./middleware/websiteSettings');


// Check subscription status for all requests
app.use(checkSubscription);

// Load website settings for all requests
app.use(loadWebsiteSettings);



// Removed multiple response prevention middleware as it was causing issues with express-ejs-layouts

// Import the getImageUrl function from uploadHelper
const { getImageUrl } = require('./utils/uploadHelper');

// Cart middleware
const cartMiddleware = require('./middleware/cart');
app.use(cartMiddleware);

// Global variables
app.use(async (req, res, next) => {
  try {
    // Safely access session data
    const user = req.session && req.session.user ? req.session.user : null;

    // Set default values for all template variables
    res.locals.currentUser = user;
    res.locals.isAdmin = user && user.role === 'admin';
    res.locals.isArtist = user && user.role === 'artist';
    res.locals.isSuperAdmin = user && user.role === 'superAdmin';
    res.locals.hasRoles = false;
    res.locals.userRoles = [];
    res.locals.success = req.flash ? req.flash('success') : [];
    res.locals.error = req.flash ? req.flash('error') : [];
    res.locals.path = req.path; // Add current path to all views

    // Make the getImageUrl function available to all views
    res.locals.getImageUrl = getImageUrl;

    // Check if user has any roles (for messaging functionality)
    if (user && user.id) {
      try {
        const userRoles = await UserRole.find({ user: user.id }).populate('role');

        // Check for missing role references
        const missingRoles = userRoles.filter(ur => !ur.role);
        if (missingRoles.length > 0) {
          console.warn(`User ${user.id} has ${missingRoles.length} role assignments with missing role references`);
        }

        res.locals.hasRoles = userRoles.length > 0;
        res.locals.userRoles = userRoles
          .filter(ur => ur.role) // Filter out null roles
          .map(ur => ur.role.name);
      } catch (err) {
        console.error('Error checking user roles:', err);
        // Default values already set above
      }

      // If user is an admin (not super admin), fetch their page permissions
      if (user.role === 'admin') {
        try {
          // Get all admin pages
          const adminPages = await AdminPage.find({ isActive: true });

          // Get admin's permissions
          const adminPermission = await AdminPagePermission.findOne({ admin: user.id });

          // Create a map of page paths to permission status
          const pagePermissions = {};

          adminPages.forEach(page => {
            // Page is accessible if:
            // 1. It's marked as always accessible
            // 2. Admin has explicit permission for this page
            const hasPermission = page.alwaysAccessible ||
              (adminPermission && adminPermission.pagePermissions.get(page.slug));

            // Store by path for easy lookup in templates
            pagePermissions[page.path] = {
              hasPermission,
              name: page.name,
              slug: page.slug,
              icon: page.icon,
              category: page.category,
              alwaysAccessible: page.alwaysAccessible,
              superAdminOnly: page.superAdminOnly
            };
          });

          // Make permissions available to all templates
          res.locals.adminPagePermissions = pagePermissions;
        } catch (err) {
          console.error('Error fetching admin page permissions:', err);
        }
      }
    }
  } catch (err) {
    console.error('Error in global variables middleware:', err);
    // Ensure defaults are set even if there's an error
    res.locals.currentUser = null;
    res.locals.isAdmin = false;
    res.locals.isSuperAdmin = false;
    res.locals.isArtist = false;
    res.locals.hasRoles = false;
    res.locals.userRoles = [];
    res.locals.success = [];
    res.locals.error = [];
    res.locals.path = req.path;
    res.locals.adminPagePermissions = {};
  }

  next();
});

// Import routes
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const artistRoutes = require('./routes/artists');
const concertRoutes = require('./routes/concerts');
const ticketRoutes = require('./routes/tickets');
const adminRoutes = require('./routes/admin');
const adminContentRoutes = require('./routes/admin-content');
const adminAccessControlRoutes = require('./routes/adminAccessControl');
const adminContactRoutes = require('./routes/adminContact');
const adminMerchandiseRoutes = require('./routes/admin-merchandise');
const paymentRoutes = require('./routes/payments');
const pageRoutes = require('./routes/pages');
const emailStatusRoutes = require('./routes/email-status');
const shopRoutes = require('./routes/shop');
const orderRoutes = require('./routes/orders');
const reviewRoutes = require('./routes/reviews');
const artistApplicationRoutes = require('./routes/artistApplications');
const roleRoutes = require('./routes/roles');
const learningRoutes = require('./routes/learning');
const messageRoutes = require('./routes/messages');
const artistUpgradeRoutes = require('./routes/artistUpgrade');
const teamRequirementRoutes = require('./routes/teamRequirement');
const findMyArtistRoutes = require('./routes/findMyArtist');
const featuredArtistsRoutes = require('./routes/featuredArtists');
const roleSlotRoutes = require('./routes/roleSlots');
const bookingRequestRoutes = require('./routes/bookingRequests');
const dailyConcertsRoutes = require('./routes/dailyConcerts');
const adminDailyConcertsRoutes = require('./routes/adminDailyConcerts');
const demoRoutes = require('./routes/demo');
const contentRoutes = require('./routes/content');
const refundRequestRoutes = require('./routes/refundRequests');
const { router: notificationRoutes } = require('./routes/notifications');
const subscriptionRoutes = require('./routes/subscriptions');
const adminSubscriptionRoutes = require('./routes/adminSubscriptions');
const adminSessionRoutes = require('./routes/adminSessions');
const adminWebsiteSettingsRoutes = require('./routes/adminWebsiteSettings');
const adminAboutRoutes = require('./routes/adminAbout');
const adminTeamUpdatesRoutes = require('./routes/adminTeamUpdates');
const venueRequestRoutes = require('./routes/venueRequests');
const adminVenueRequestRoutes = require('./routes/adminVenueRequests');
const adminVenuesRoutes = require('./routes/adminVenues');
const adminVenueEditRequestRoutes = require('./routes/adminVenueEditRequests');
const adminConcertEditRequestRoutes = require('./routes/adminConcertEditRequests');
const followRoutes = require('./routes/follows');
const venueAvailabilityRoutes = require('./routes/venueAvailability');
const userVenuesRoutes = require('./routes/userVenues');
const venueDashboardRoutes = require('./routes/venueDashboard');

const { cleanupPendingTickets, cleanupOrphanedArtists } = require('./utils/cleanupService');
const { checkExpiredSubscriptions } = require('./utils/subscriptionService');
const { initializeCronJobs } = require('./utils/cronJobs');
const { ensureUploadDirectories } = require('./utils/uploadHelper');

// NEW: Import media backup service for global media persistence
const { restoreAllMediaOnStartup } = require('./utils/mediaBackupService');

// Ensure upload directories exist
ensureUploadDirectories();

// Serve files from uploads directory with enhanced media middleware
app.use('/uploads', createMediaMiddleware(path.join(__dirname, 'public/uploads')));
// Use routes
app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/users/venue-requests', venueRequestRoutes);
app.use('/users/venues', userVenuesRoutes);
app.use('/venue-dashboard', venueDashboardRoutes);
app.use('/users', userRoutes);
app.use('/artists', artistRoutes);
app.use('/concerts', concertRoutes);
app.use('/venue-availability', venueAvailabilityRoutes);
app.use('/tickets', ticketRoutes);
app.use('/admin', adminRoutes);
app.use('/admin/merchandise', adminMerchandiseRoutes);
app.use('/payments', paymentRoutes);
app.use('/pages', pageRoutes);
app.use('/email-status', emailStatusRoutes);
app.use('/shop', shopRoutes);
app.use('/orders', orderRoutes);
app.use('/reviews', reviewRoutes);
app.use('/artist-applications', artistApplicationRoutes);
app.use('/roles', roleRoutes);
app.use('/learning', learningRoutes);
app.use('/messages', messageRoutes);
app.use('/content', contentRoutes); // Mount content routes
app.use('/demo', demoRoutes); // Mount demo routes
app.use('/', artistUpgradeRoutes); // Mount artist upgrade routes
// Mount team requirement routes
app.use('/team-requirement', teamRequirementRoutes);
app.use('/admin/team-requirement', teamRequirementRoutes); // Also mount for admin routes

// Mount find my artist routes
app.use('/find-my-artist', findMyArtistRoutes);
app.use('/admin/find-my-artist', findMyArtistRoutes); // Also mount for admin routes

// Mount specific admin routes for find my artist
app.use('/admin/find-my-artist/featured-artists', featuredArtistsRoutes);
app.use('/admin/find-my-artist/role-slots', roleSlotRoutes);
app.use('/admin/find-my-artist/booking-requests', bookingRequestRoutes);

// Mount daily concerts routes
app.use('/daily-concerts', dailyConcertsRoutes);
app.use('/admin/daily-concerts', adminDailyConcertsRoutes);

// Mount notification routes
app.use('/admin/notifications', notificationRoutes);

// Mount admin access control routes
app.use('/admin/access-control', adminAccessControlRoutes);

// Mount admin contact messages routes
app.use('/admin/contact-messages', adminContactRoutes);

// Mount refund request routes
app.use('/refund-requests', refundRequestRoutes);
app.use('/admin/refund-requests', refundRequestRoutes);

// Mount subscription routes
app.use('/subscriptions', subscriptionRoutes);
app.use('/users/subscriptions', (req, res) => res.redirect('/subscriptions/my-subscriptions'));
app.use('/admin/subscriptions', adminSubscriptionRoutes);

// Mount session management routes
app.use('/admin/sessions', adminSessionRoutes);

// Mount website settings routes
app.use('/admin/website-settings', adminWebsiteSettingsRoutes);

// Mount admin about routes
app.use('/admin/about', adminAboutRoutes);

// Mount team updates routes
app.use('/admin/team-updates', adminTeamUpdatesRoutes);

// Mount admin venues routes
app.use('/admin/venues', adminVenuesRoutes);

// Mount admin venue requests routes
app.use('/admin/venue-requests', adminVenueRequestRoutes);

// Mount admin venue edit requests routes
app.use('/admin/venue-edit-requests', adminVenueEditRequestRoutes);

// Mount admin concert edit requests routes
app.use('/admin/concert-edit-requests', adminConcertEditRequestRoutes);

// Mount follow routes
app.use('/follows', followRoutes);

// Load admin page permissions middleware
const AdminPage = require('./models/AdminPage');
const AdminPagePermission = require('./models/AdminPagePermission');

// Middleware to load admin page permissions for all admin routes
app.use('/admin*', async (req, res, next) => {
  try {
    // Skip for non-admin users
    if (!req.session.user || (req.session.user.role !== 'admin' && req.session.user.role !== 'superAdmin')) {
      return next();
    }

    // For super admins, create a proxy that returns true for any page
    if (req.session.user.role === 'superAdmin') {
      res.locals.adminPagePermissions = new Proxy({}, {
        get: function(target, prop) {
          return { hasPermission: true };
        }
      });
      return next();
    }

    // For regular admins, load their permissions
    const permissions = await AdminPagePermission.findOne({ admin: req.session.user.id });

    // Get all admin pages
    const adminPages = await AdminPage.find({ isActive: true });

    // Create a map of page paths to permission objects
    const adminPagePermissions = {};

    // Process each page
    for (const page of adminPages) {
      // If page is always accessible, set to true
      if (page.alwaysAccessible) {
        adminPagePermissions[page.path] = { hasPermission: true };
      }
      // If permissions exist for this admin, use them
      else if (permissions && permissions.pagePermissions.get(page.slug)) {
        adminPagePermissions[page.path] = { hasPermission: true };
      }
      // Otherwise, no permission
      else {
        adminPagePermissions[page.path] = { hasPermission: false };
      }
    }

    // Set the permissions in locals for use in templates
    res.locals.adminPagePermissions = adminPagePermissions;

    next();
  } catch (error) {
    console.error('Error loading admin page permissions:', error);
    // Continue without permissions if there's an error
    res.locals.adminPagePermissions = {};
    next();
  }
});

// Mount admin content routes
app.use('/admin/content', adminContentRoutes);

// 404 route
app.use((req, res) => {
  res.status(404).render('error/404');
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error/500');
});

// Import notification initializer
const { initializeNotifications } = require('./utils/notificationInitializer');

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  // NEW: Restore all media from MongoDB backup on server startup
  // This ensures that on Render restarts or local cleanups, media files are repopulated
  try {
    const mediaRestore = await restoreAllMediaOnStartup();
    console.log(`Media restore summary: ${mediaRestore.restored} restored, ${mediaRestore.skipped} skipped, ${mediaRestore.errors} errors`);
  } catch (error) {
    console.error('Error during media restore on startup:', error.message);
    // Don't block server startup if restore fails
  }

  // Initialize notifications after server starts
  setTimeout(async () => {
    try {
      const result = await initializeNotifications();
      console.log(`Notification initialization complete: ${result.created} created, ${result.pending} pending, ${result.unread} unread`);
    } catch (error) {
      console.error('Error during notification initialization:', error);
    }

    // Check for expired subscriptions
    try {
      const subscriptionResult = await checkExpiredSubscriptions();
      console.log(`Subscription check complete: ${subscriptionResult.expired} subscriptions marked as expired`);
    } catch (error) {
      console.error('Error checking expired subscriptions:', error);
    }

    // Initialize cron jobs
    try {
      initializeCronJobs();
    } catch (error) {
      console.error('Error initializing cron jobs:', error);
    }
  }, 5000); // Wait 5 seconds after server start to initialize notifications
});

// Schedule cleanup jobs
const TICKET_CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 minutes in milliseconds
const ARTIST_CLEANUP_INTERVAL = 60 * 60 * 1000; // 60 minutes in milliseconds
let ticketCleanupTimer = null;
let artistCleanupTimer = null;

// Function to check if MongoDB is connected and ready
const isMongoDBConnected = () => {
  const state = mongoose.connection.readyState;
  if (state !== 1) {
    console.log(`MongoDB not connected. Current state: ${state} (0=disconnected, 1=connected, 2=connecting, 3=disconnecting)`);
    return false;
  }
  return true;
};

// Function to schedule the next ticket cleanup
const scheduleNextTicketCleanup = () => {
  if (ticketCleanupTimer) {
    clearTimeout(ticketCleanupTimer);
  }

  ticketCleanupTimer = setTimeout(async () => {
    try {
      console.log('Running pending ticket cleanup job...');
      // Check MongoDB connection state before running cleanup
      if (!isMongoDBConnected()) {
        console.log('Skipping ticket cleanup job due to MongoDB connection issue.');
      } else {
        const removedCount = await cleanupPendingTickets(30, 3); // Remove tickets older than 30 minutes, max 3 retries
        console.log(`Ticket cleanup job completed. Removed ${removedCount} pending tickets.`);
      }
    } catch (error) {
      console.error('Error in ticket cleanup job:', error);
      // Log more detailed error information
      if (error.name === 'MongoServerSelectionError') {
        console.error('MongoDB server selection error. This may be due to network issues or server unavailability.');
      }
    } finally {
      // Always schedule the next run, even if this one failed
      scheduleNextTicketCleanup();
    }
  }, TICKET_CLEANUP_INTERVAL);

  console.log(`Next ticket cleanup scheduled in ${TICKET_CLEANUP_INTERVAL / 60000} minutes`);
};

// Function to schedule the next artist cleanup
const scheduleNextArtistCleanup = () => {
  if (artistCleanupTimer) {
    clearTimeout(artistCleanupTimer);
  }

  artistCleanupTimer = setTimeout(async () => {
    try {
      console.log('Running orphaned artist cleanup job...');
      // Check MongoDB connection state before running cleanup
      if (!isMongoDBConnected()) {
        console.log('Skipping artist cleanup job due to MongoDB connection issue.');
      } else {
        const removedCount = await cleanupOrphanedArtists(3); // Max 3 retries
        console.log(`Artist cleanup job completed. Removed ${removedCount} orphaned artist records.`);
      }
    } catch (error) {
      console.error('Error in artist cleanup job:', error);
      // Log more detailed error information
      if (error.name === 'MongoServerSelectionError') {
        console.error('MongoDB server selection error. This may be due to network issues or server unavailability.');
        if (error.message.includes('getaddrinfo ENOTFOUND')) {
          console.error('DNS resolution failed. Check your internet connection or MongoDB Atlas hostname.');
        }
      }
    } finally {
      // Always schedule the next run, even if this one failed
      scheduleNextArtistCleanup();
    }
  }, ARTIST_CLEANUP_INTERVAL);

  console.log(`Next artist cleanup scheduled in ${ARTIST_CLEANUP_INTERVAL / 60000} minutes`);
};

// Start the cleanup schedules
scheduleNextTicketCleanup();
scheduleNextArtistCleanup();

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});