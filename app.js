require('dotenv').config();

// Force Node.js DNS to use Google DNS (8.8.8.8) to bypass local DNS issues
const dns = require('dns');
const { Resolver } = require('dns').promises;
dns.setServers(['8.8.8.8', '8.8.4.4']);
console.log('DNS servers configured to use Google DNS (8.8.8.8, 8.8.4.4)');

const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const mongooseSession = require('./middleware/mongoSession');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');

// Security middleware
const helmet = require('helmet');

// Initialize Express app
const app = express();

// =============================================================================
// SECURITY CONFIGURATION
// =============================================================================

// Trust proxy for secure cookies in production environments
// This is important for hosting platforms like Render, Heroku, etc.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
  console.log('Proxy trust enabled for production environment');
}

// Apply Helmet security middleware with custom configuration
// This sets various HTTP headers to help protect the app from well-known web vulnerabilities
app.use(helmet({
  // Content Security Policy - Define where content can be loaded from
  contentSecurityPolicy: {
    directives: {
      // By default, allow resources from the same origin
      // This is a fallback for any directive not explicitly set
      defaultSrc: ["'self'"],

      // Style sources - Allow stylesheets from self and CDNs needed for Bootstrap, AOS, and Bootstrap Icons
      styleSrc: [
        "'self'",
        "'unsafe-inline'",  // Allow inline styles (needed for Bootstrap and dynamic styling)
        "https://fonts.googleapis.com",  // Google Fonts
        "https://cdn.jsdelivr.net",  // Bootstrap, AOS
        "https://unpkg.com",  // Bootstrap Icons
        "https://cdnjs.cloudflare.com",  // Alternative CDN
        "https://checkout.razorpay.com"  // For Razorpay checkout styling
      ],

      // Style element sources - Specifically for <style> elements and @import
      styleSrcElem: [
        "'self'",
        "'unsafe-inline'",  // Allow inline styles (needed for Bootstrap)
        "https://fonts.googleapis.com",  // Google Fonts
        "https://cdn.jsdelivr.net",  // Bootstrap, AOS
        "https://unpkg.com",  // Bootstrap Icons
        "https://cdnjs.cloudflare.com",  // Alternative CDN
        "https://checkout.razorpay.com"  // For Razorpay checkout styling
      ],

      // Script sources - Allow scripts from self and trusted CDNs
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",  // Allow inline scripts (needed for EJS templates and event handlers)
        "'unsafe-eval'",    // Allow eval() for certain client-side templating (needed by some libraries)
        "https://cdn.jsdelivr.net",  // Bootstrap, AOS
        "https://unpkg.com",  // AOS
        "https://code.jquery.com",  // jQuery
        "https://cdnjs.cloudflare.com",  // Alternative CDN
        "https://checkout.razorpay.com",  // For payment processing
        "https://api.razorpay.com",  // For Razorpay API
        "https://lumberjack.razorpay.com",  // For analytics
        "https://rzp.io",  // For shortened URLs
        "https://maps.googleapis.com"  // For Google Maps API
      ],

      // Script attribute sources - Specifically for inline event handlers (onclick, onsubmit, etc.)
      scriptSrcAttr: [
        "'self'",
        "'unsafe-inline'"  // Allow inline event handlers (onclick, onsubmit, etc.)
      ],

      // Allow connections to self and specific APIs
      connectSrc: [
        "'self'",
        "https://api.cloudinary.com",  // For Cloudinary API
        "https://checkout.razorpay.com",  // For payment processing
        "https://api.razorpay.com",  // For Razorpay API
        "https://lumberjack.razorpay.com",  // For analytics
        "https://rzp.io",  // For shortened URLs
        "https://cdn.jsdelivr.net",  // For dynamic resource loading
        "https://unpkg.com",  // For dynamic resource loading
        "https://code.jquery.com",  // For jQuery if needed
        "https://maps.googleapis.com",  // For Google Maps API
        "https://maps.gstatic.com"   // For Google Maps static assets
      ],

      imgSrc: [
        "'self'",
        "data:",
        "https://res.cloudinary.com",  // For Cloudinary images
        "https://images.unsplash.com",  // For Unsplash images
        "https://cdn.jsdelivr.net",  // For images loaded from CDN
        "https://unpkg.com",  // For images loaded from unpkg
        "https://cdnjs.cloudflare.com",  // For images loaded from cdnjs
        "https://*.cloudinary.com",  // Wildcard for Cloudinary subdomains
        "https://ui-avatars.com",  // For UI avatar generation service
        "https://checkout.razorpay.com",  // For Razorpay checkout images
        "https://api.razorpay.com",  // For Razorpay API images
        "https://api.qrserver.com",  // For QR code generation
        "https://maps.googleapis.com",  // For Google Maps images
        "https://maps.gstatic.com",  // For Google Maps static images
        "https://img.youtube.com",  // For YouTube video thumbnails
        "https://i.ytimg.com"  // For YouTube image CDN
      ],

      // Allow fonts from self and CDNs
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",  // Google Fonts
        "https://cdn.jsdelivr.net",  // Bootstrap Icons fonts
        "https://unpkg.com",  // Bootstrap Icons fonts
        "https://cdnjs.cloudflare.com"  // Alternative CDN
      ],

      // Allow frames from self and specific sources
      frameSrc: [
        "'self'",
        "https://www.google.com",  // For reCAPTCHA
        "https://maps.google.com",  // For Google Maps
        "https://www.google.com/maps",  // For Google Maps
        "https://google.com",  // For Google Maps
        "https://maps.googleapis.com",  // For Google Maps API
        "https://maps.gstatic.com",  // For Google Maps static assets
        "https://checkout.razorpay.com",  // For payment processing
        "https://api.razorpay.com",  // For Razorpay API frames
        "https://rzp.io",  // For shortened URLs
        "https://www.youtube.com",  // For YouTube embedded videos
        "https://youtube.com",  // For YouTube embedded videos
        "https://www.youtube-nocookie.com"  // For YouTube privacy-enhanced mode
      ],

      // Allow media from self and Cloudinary
      mediaSrc: [
        "'self'",
        "https://res.cloudinary.com",  // For Cloudinary videos/audio
        "https://*.cloudinary.com"  // Wildcard for Cloudinary subdomains
      ],

      // Object sources from self
      objectSrc: ["'none'"],

      // Child sources (for iframes)
      childSrc: [
        "'self'",
        "https://checkout.razorpay.com",
        "https://api.razorpay.com",
        "https://rzp.io",
        "https://www.youtube.com",  // For YouTube embedded videos
        "https://youtube.com",
        "https://www.youtube-nocookie.com"
      ],

      // Upgrade insecure requests
      upgradeInsecureRequests: [],
    }
  },
  // DNS Prefetch Control - Disable DNS prefetching to improve privacy
  dnsPrefetchControl: {
    allow: false,
  },
  // Frameguard - Prevent clickjacking
  frameguard: {
    action: 'deny',
  },
  // Hide Powered-By - Remove the X-Powered-By header
  hidePoweredBy: true,
  // HTTP Strict Transport Security (HSTS) - Enforce HTTPS
  // Only enable in production to prevent HTTPS enforcement in development
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000,  // One year in seconds
    includeSubDomains: true,
    preload: true,
  } : false,
  // Internet Explorer compatibility - Force IE to use latest rendering engine
  ieNoOpen: true,
  // No Sniff - Prevent MIME-type sniffing
  noSniff: true,
  // Referrer Policy - Control how much referrer information is sent
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },
  // Cross-Origin Embedder Policy
  crossOriginEmbedderPolicy: false,  // Disabled to allow external resources
  // Cross-Origin Opener Policy
  crossOriginOpenerPolicy: {
    policy: 'same-origin',
  },
  // Cross-Origin Resource Policy
  crossOriginResourcePolicy: {
    policy: 'cross-origin',
  },
  // Origin Agent Cluster
  originAgentCluster: false,
  // Permissions Policy - Control browser features
  permissionsPolicy: {
    features: {
      fullscreen: ["'self'"],
      geolocation: ["'none'"],
      microphone: ["'none'"],
      camera: ["'self'"],  // Allow camera access for QR code scanning
      payment: ["'self'"],  // Allow payment API for Razorpay
    },
  },
}));

// Rate limiting middleware for API routes
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 500, // Limit each IP to 500 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(429).render("tooManyRequests", {
      title: "Too Many Requests",
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000) || 60
    });
  }
});

// Apply rate limiting only to API routes
app.use('/api', apiLimiter);

// Custom security headers not covered by Helmet
app.use((req, res, next) => {
  // Permissions Policy (newer spec replacing Feature Policy)
  res.setHeader('Permissions-Policy', "fullscreen=(self), geolocation=(), microphone=(), camera=(self), payment=(self)");

  // Expect-CT - Require Certificate Transparency
  res.setHeader('Expect-CT', 'enforce, max-age=86400');

  // X-DNS-Prefetch-Control - Disable DNS prefetching
  res.setHeader('X-DNS-Prefetch-Control', 'off');

  next();
});

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

// Make date formatter available in all EJS templates
const { toISTLocaleString, toISTDateString, toISTTimeString } = require('./utils/dateFormatter');
app.locals.toISTLocaleString = toISTLocaleString;
app.locals.toISTDateString = toISTDateString;
app.locals.toISTTimeString = toISTTimeString;

// Middleware
// Set security limits for JSON and URL-encoded bodies
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

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
app.use(methodOverride('_method'));

// Session configuration
const isProduction = process.env.NODE_ENV === 'production';
console.log(`Running in ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);
console.log(`BASE_URL: ${process.env.BASE_URL}`);

// Parse cookies (required for reading the session cookie)
app.use(cookieParser(process.env.SESSION_SECRET || 'rapira-secret-key'));

// Pure Mongoose session — NO express-session, NO connect-mongo
// Sessions stored directly in MongoDB 'sessions' collection via Mongoose model
app.use(mongooseSession());
console.log('Session: using pure Mongoose MongoDB session middleware');

// Flash messages
app.use(flash());


// Import middleware
const { isLoggedIn, isAdmin } = require('./middleware/auth');
const { createMediaMiddleware } = require('./middleware/mediaMiddleware');
const { checkSubscription } = require('./middleware/subscription');
const { loadWebsiteSettings } = require('./middleware/websiteSettings');
const { trackUserPage } = require('./middleware/pageTracking');


// Check subscription status for all requests
app.use(checkSubscription);

// Track which page user is currently viewing
app.use(trackUserPage);

// Load website settings for all requests
app.use(loadWebsiteSettings);



// Removed multiple response prevention middleware as it was causing issues with express-ejs-layouts

// Import the getImageUrl function from uploadHelper
const { getImageUrl } = require('./utils/uploadHelper');

// Import models for user roles check
const UserRole = require('./models/UserRole');
const Role = require('./models/Role');

// Cart middleware
const cartMiddleware = require('./middleware/cart');
app.use(cartMiddleware);

// Check if logged-in user still exists (account deleted check)
app.use(async (req, res, next) => {
  try {
    const sessionUser = req.session && req.session.user ? req.session.user : null;

    // If user is logged in, verify the account still exists
    if (sessionUser && sessionUser.id) {
      const User = require('./models/User');
      const userExists = await User.findById(sessionUser.id);

      // If user account was deleted
      if (!userExists) {
        console.log(`[ACCOUNT CHECK] User ${sessionUser.id} session found but account deleted`);

        // Store message before destroying session
        const accountDeletedMessage = 'Your account has been deleted by the website administrator. If you believe this is an error, please contact support.';

        // Destroy session before responding. Middleware handles cookie cleanup.
        await new Promise((resolve) => {
          req.session.destroy((err) => {
            if (err) {
              console.error('Session destruction error:', err);
            }
            resolve();
          });
        });

        // Redirect to a special page showing the message
        return res.render('error/account-deleted', {
          currentUser: null,
          isAdmin: false,
          isArtist: false,
          isSuperAdmin: false,
          message: accountDeletedMessage,
          path: req.path,
          title: 'Account Deleted - Rapira',
          success: [],
          error: []
        });
      }

      // Sync user session data to keep privileges fast and fresh
      req.session.user.role = userExists.role;
      req.session.user.isSuperAdmin = userExists.isSuperAdmin;
      req.session.user.adminPermissions = userExists.adminPermissions;
      req.session.user.adminTitle = userExists.adminTitle;
    }

    next();
  } catch (error) {
    console.error('[ACCOUNT CHECK] Error checking user account:', error);
    next(); // Continue even if check fails
  }
});

// Global variables
app.use(async (req, res, next) => {
  try {
    // Safely access session data
    const user = req.session && req.session.user ? req.session.user : null;

    // Set default values for all template variables
    res.locals.currentUser = user;
    res.locals.isAdmin = user && user.role === 'admin';
    res.locals.isArtist = user && user.role === 'artist';
    res.locals.isSuperAdmin = user && user.isSuperAdmin === true;
    res.locals.hasRoles = false;
    res.locals.userRoles = [];
    res.locals.success = req.flash ? req.flash('success') : [];
    res.locals.error = req.flash ? req.flash('error') : [];
    res.locals.warning = req.flash ? req.flash('warning') : [];
    res.locals.info = req.flash ? req.flash('info') : [];

    // Clear "must be logged in" message for public pages
    // This prevents the message from showing on public pages after being redirected from protected pages
    const publicPaths = ['/', '/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password',
      '/about', '/contact', '/faq', '/artists', '/concerts', '/shop', '/pages', '/content', '/demo',
      '/privacy-policy', '/terms-of-service', '/refund-policy', '/subscription-policy',
      '/shopping-policy', '/event-attending-policy', '/temp-email-policy', '/account-reactivation',
      '/tickets/validate', '/find-my-artist', '/team-requirement'];
    const isPublicPage = publicPaths.some(path => req.path === path || req.path.startsWith(path + '/'));

    if (isPublicPage && res.locals.error) {
      if (Array.isArray(res.locals.error)) {
        res.locals.error = res.locals.error.filter(msg => msg !== 'You must be logged in to access this page');
      } else if (res.locals.error === 'You must be logged in to access this page') {
        res.locals.error = [];
      }
    }

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
    res.locals.warning = [];
    res.locals.info = [];
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
const adminMerchandiseRoutes = require('./routes/admin-merchandise');
// Add the ticket validation routes
const ticketValidationRoutes = require('./routes/ticketValidation');
const adminAccessControlRoutes = require('./routes/adminAccessControl');
const adminContactRoutes = require('./routes/adminContact');
const adminContentRoutes = require('./routes/admin-content');
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
const adminTicketsRoutes = require('./routes/adminTickets');
const { router: notificationRoutes } = require('./routes/notifications');
const subscriptionRoutes = require('./routes/subscriptions');
const adminComposeEmailRoutes = require('./routes/adminComposeEmail');
// const adminSimpleEmailRoutes = require('./routes/adminSimpleEmail'); // REMOVED: Not needed as we have compose and basic email pages
const adminBasicEmailRoutes = require('./routes/adminBasicEmail');
const adminSubscriptionRoutes = require('./routes/adminSubscriptions');
const adminSessionRoutes = require('./routes/adminSessions');
const adminWebsiteSettingsRoutes = require('./routes/adminWebsiteSettings');
const adminAboutRoutes = require('./routes/adminAbout');
const adminTeamUpdatesRoutes = require('./routes/adminTeamUpdates');
const adminWebsiteUpdateRoutes = require('./routes/adminWebsiteUpdates');
const venueRequestRoutes = require('./routes/venueRequests');
const websiteUpdateRoutes = require('./routes/websiteUpdates');
const adminVenueRequestRoutes = require('./routes/adminVenueRequests');
const adminVenuesRoutes = require('./routes/adminVenues');
const adminVenueEditRequestRoutes = require('./routes/adminVenueEditRequests');
const adminConcertEditRequestRoutes = require('./routes/adminConcertEditRequests');
const followRoutes = require('./routes/follows');
const venueAvailabilityRoutes = require('./routes/venueAvailability');
const userVenuesRoutes = require('./routes/userVenues');
const venueDashboardRoutes = require('./routes/venueDashboard');
const postsRoutes = require('./routes/posts');
const adminMediaRoutes = require('./routes/adminMedia');
const adminProducersRoutes = require('./routes/adminProducers');
const producerApplicationRoutes = require('./routes/producerApplications');
const producerDashboardRoutes = require('./routes/producerDashboard');
const distributorDashboardRoutes = require('./routes/distributorDashboard');
const distributorApplicationRoutes = require('./routes/distributorApplications');
const artistDistributionRoutes = require('./routes/artistDistribution');
const adminBeatPurchasesRoutes = require('./routes/admin-beat-purchases');
const razorpayTestRoutes = require('./routes/razorpayTest');
const reelsRoutes = require('./routes/reels');

const { cleanupPendingTickets, cleanupOrphanedArtists } = require('./utils/cleanupService');
const { checkExpiredSubscriptions } = require('./utils/subscriptionService');
const { initializeCronJobs } = require('./utils/cronJobs');
const { ensureUploadDirectories } = require('./utils/uploadHelper');
const apiRoutes = require('./routes/api');

// NEW: Import media backup service for global media persistence
const { restoreAllMediaOnStartup } = require('./utils/mediaBackupService');

// Ensure upload directories exist
ensureUploadDirectories();

// Serve files from uploads directory with enhanced media middleware
app.use('/uploads', createMediaMiddleware(path.join(__dirname, 'public/uploads')));

// Lightweight connectivity check for clients (used by offline detector)
app.head('/ping', (req, res) => res.sendStatus(204));
app.get('/ping', (req, res) => res.sendStatus(204));

// Account status check - for real-time account deletion detection
app.get('/api/account-status', async (req, res) => {
  try {
    // If no user session, return not logged in
    if (!req.session || !req.session.user || !req.session.user.id) {
      return res.json({ loggedIn: false });
    }

    const User = require('./models/User');
    const userExists = await User.findById(req.session.user.id);

    // If user no longer exists, account was deleted
    if (!userExists) {
      return res.json({
        loggedIn: false,
        accountDeleted: true,
        message: 'Your account has been deleted by the website administrator.'
      });
    }

    // User exists and is logged in
    return res.json({ loggedIn: true, accountDeleted: false });
  } catch (error) {
    console.error('[ACCOUNT STATUS CHECK] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

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
// Mount ticket validation routes BEFORE tickets routes to avoid conflicts
app.use('/', ticketValidationRoutes);
app.use('/tickets', ticketRoutes);
// Mount admin ticket routes BEFORE admin routes to avoid conflicts
app.use('/admin/tickets', adminTicketsRoutes);
// Mount admin payments routes
app.use('/admin/payments', require('./routes/adminPayments'));
// Mount super admin routes BEFORE admin routes
app.use('/admin/super', require('./routes/adminSuper'));
app.use('/admin', adminRoutes);
app.use('/admin/merchandise', adminMerchandiseRoutes);
app.use('/payments', paymentRoutes);
app.use('/pages', pageRoutes);
app.use('/email-status', emailStatusRoutes);
app.use('/shop', shopRoutes);
app.use('/orders', orderRoutes);
app.use('/reviews', reviewRoutes);
app.use('/artist-applications', artistApplicationRoutes);
app.use('/producer-applications', producerApplicationRoutes);
app.use('/producer-dashboard', producerDashboardRoutes);
app.use('/distributor-applications', distributorApplicationRoutes);
app.use('/distributor-dashboard', distributorDashboardRoutes);
app.use('/artist-distribution', artistDistributionRoutes);
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

// Mount admin compose email routes
app.use('/admin/compose-email', adminComposeEmailRoutes);

// Razorpay test page
app.use('/razorpay-test', razorpayTestRoutes);

// Mount admin simple email routes
// app.use('/admin/simple-email', adminSimpleEmailRoutes); // REMOVED: Not needed as we have compose and basic email pages

// Mount admin basic email routes
app.use('/admin/basic-email', adminBasicEmailRoutes);

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

// Mount posts routes
app.use('/', postsRoutes);

// Mount admin about routes
app.use('/admin/about', adminAboutRoutes);

// Mount team updates routes
app.use('/admin/team-updates', adminTeamUpdatesRoutes);

// Mount admin website updates routes
app.use('/admin/website-updates', adminWebsiteUpdateRoutes);

// Mount website updates routes
app.use('/website-updates', websiteUpdateRoutes);

// Mount admin venues routes
app.use('/admin/venues', adminVenuesRoutes);

// Mount admin media management routes
app.use('/admin/media', adminMediaRoutes);

// Mount admin producers routes
app.use('/admin/producers', adminProducersRoutes);

// Mount admin venue requests routes
app.use('/admin/venue-requests', adminVenueRequestRoutes);

// Mount admin venue edit requests routes
app.use('/admin/venue-edit-requests', adminVenueEditRequestRoutes);

// Mount admin concert edit requests routes
app.use('/admin/concert-edit-requests', adminConcertEditRequestRoutes);

// Mount admin beat purchases routes
app.use('/admin/artist-beat-purchases', adminBeatPurchasesRoutes);

// Mount follow routes
app.use('/follows', followRoutes);

// Mount reels route
app.use('/reels', reelsRoutes);

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
        get: function (target, prop) {
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

// Stories routes
const storiesRoutes = require('./routes/stories');
app.use('/', storiesRoutes);

// Mount admin content routes
app.use('/admin/content', adminContentRoutes);

// Mount API routes
app.use('/api', apiRoutes);

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
const maintenanceService = require('./utils/maintenanceService');

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

    // Start maintenance service
    try {
      maintenanceService.startPeriodicCheck();
    } catch (error) {
      console.error('Error starting maintenance service:', error);
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