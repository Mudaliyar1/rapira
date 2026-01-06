const User = require('../models/User');

// Middleware to track which page user is currently viewing
const trackUserPage = async (req, res, next) => {
  // Only track if user is logged in
  if (!req.session || !req.session.user || !req.session.user.id) {
    return next();
  }

  // SKIP API calls and AJAX requests - only track page views
  if (req.path.startsWith('/api/') || 
      req.path.includes('/feed') ||
      req.path.includes('/check-') ||
      req.path.includes('/verify') ||
      req.path.endsWith('/like') ||
      req.path.endsWith('/view') ||
      req.path.endsWith('/submit') ||
      req.headers['x-requested-with'] === 'XMLHttpRequest') {
    return next();
  }

  try {
    // Get the page path from the request (without query parameters)
    let currentPath = req.path; // Use req.path instead of req.originalUrl to ignore query params
    
    // Normalize the path to remove trailing slashes for consistent matching
    currentPath = currentPath.toLowerCase().replace(/\/$/, '') || '/';
    
    // DEBUG: Log the detected path
    const debugLog = `[PAGE_TRACKING] User: ${req.session.user.id}, Path: ${req.path}, Normalized: ${currentPath}`;
    
    // Create a human-readable page name based on the path
    const pageMapping = {
      // User-facing pages
      '/': 'Home',
      '/about': 'About Us',
      '/contact': 'Contact Us',
      '/privacy-policy': 'Privacy Policy',
      '/terms-of-service': 'Terms of Service',
      '/refund-policy': 'Refund Policy',
      '/subscription-policy': 'Subscription Policy',
      '/shopping-policy': 'Shopping Policy',
      '/event-attending-policy': 'Event Policy',
      '/account-reactivation': 'Account Reactivation',
      '/faq': 'FAQ',
      '/content': 'Content Library',
      '/website-updates': 'Website Updates',
      
      // User Dashboard & Profile
      '/dashboard': 'Dashboard',
      '/users/profile': 'My Profile',
      '/users/edit-profile': 'Edit Profile',
      '/users/change-password': 'Change Password',
      '/users/wallet': 'My Wallet',
      '/users/settings': 'Account Settings',
      
      // Shopping & Orders
      '/shop': 'Shop',
      '/orders': 'My Orders',
      '/orders/my-orders': 'My Orders',
      '/payments/success': 'Payment Success',
      '/payments/failure': 'Payment Failed',
      
      // Concerts & Tickets
      '/concerts': 'Concerts',
      '/concerts/create': 'Create Concert',
      '/concerts/edit-requests': 'Concert Edit Requests',
      '/tickets': 'My Tickets',
      '/daily-concerts': 'Daily Concerts',
      
      // Artist & Content
      '/artists': 'Artists',
      '/artist-applications': 'Artist Applications',
      '/artist-applications/select-level': 'Select Artist Level',
      '/artist-applications/status': 'Application Status',
      '/stories': 'Stories Feed',
      '/reviews': 'Reviews',
      '/content': 'Content',
      
      // Communication
      '/messages': 'Messages',
      '/notifications': 'Notifications',
      
      // Venues & Bookings
      '/users/venue-requests': 'Venue Requests',
      '/users/venues': 'My Venues',
      '/venue-dashboard': 'Venue Dashboard',
      '/venue-availability': 'Venue Availability',
      
      // Other User Features
      '/search': 'Search',
      '/follows': 'Following',
      '/subscriptions': 'Subscriptions',
      '/refund-requests': 'Refund Requests',
      
      // Admin Dashboard & Core
      '/admin': 'Admin Dashboard',
      '/admin/dashboard': 'Admin Dashboard',
      
      // Admin Management Pages
      '/admin/users': 'Manage Users',
      '/admin/concerts': 'Manage Concerts',
      '/admin/tickets': 'Manage Tickets',
      '/admin/artists': 'Manage Artists',
      '/admin/content': 'Content Management',
      '/admin/posts': 'Manage Posts',
      '/admin/subscriptions': 'Manage Subscriptions',
      '/admin/roles': 'Manage Roles',
      '/admin/pages': 'Manage Pages',
      '/admin/sessions': 'Manage Sessions',
      
      // Admin Settings & Configuration
      '/admin/website-settings': 'Website Settings',
      '/admin/website-updates': 'Website Updates',
      '/admin/about': 'About Us Settings',
      '/admin/team-updates': 'Team Updates',
      '/admin/access-control': 'Access Control',
      '/admin/contact-messages': 'Contact Messages',
      
      // Admin Content Management
      '/admin/compose-email': 'Compose Email',
      '/admin/basic-email': 'Email Templates',
      '/admin/media': 'Media Library',
      
      // Admin Merchandise & Shop
      '/admin/merchandise': 'Manage Merchandise',
      
      // Admin Venues & Requests
      '/admin/venues': 'Manage Venues',
      '/admin/venue-requests': 'Venue Requests',
      '/admin/venue-edit-requests': 'Venue Edit Requests',
      
      // Admin Concert Management
      '/admin/daily-concerts': 'Daily Concerts',
      '/admin/concert-edit-requests': 'Concert Edit Requests',
      
      // Admin Artist Features
      '/admin/find-my-artist': 'Find My Artist',
      '/admin/find-my-artist/featured-artists': 'Featured Artists',
      '/admin/find-my-artist/role-slots': 'Role Slots',
      '/admin/find-my-artist/booking-requests': 'Booking Requests',
      
      // Admin Notifications
      '/admin/notifications': 'Notifications',
      
      // Demo & Testing
      '/demo': 'Demo'
    };

    // Get page name from mapping or use custom logic
    let pageName = pageMapping[currentPath];
    
    if (!pageName) {
      // Try to extract page name from URL patterns for dynamic/detail routes
      if (currentPath.includes('/admin/users/')) {
        if (currentPath.includes('/edit')) {
          pageName = 'Edit User';
        } else if (currentPath.includes('/details')) {
          pageName = 'User Details';
        } else {
          pageName = 'Manage Users';
        }
      } else if (currentPath.includes('/admin/concerts/')) {
        if (currentPath.includes('/edit')) {
          pageName = 'Edit Concert';
        } else if (currentPath.includes('/detail')) {
          pageName = 'Concert Details';
        } else {
          pageName = 'Manage Concerts';
        }
      } else if (currentPath.includes('/admin/tickets/')) {
        if (currentPath.includes('/export')) {
          pageName = 'Export Tickets';
        } else if (currentPath.includes('/check')) {
          pageName = 'Check Ticket';
        } else {
          pageName = 'Manage Tickets';
        }
      } else if (currentPath.includes('/admin/daily-concerts/')) {
        pageName = 'Daily Concert Details';
      } else if (currentPath.includes('/artists/')) {
        pageName = 'Artist Profile';
      } else if (currentPath.includes('/concerts/')) {
        if (currentPath.includes('/edit')) {
          pageName = 'Edit Concert';
        } else if (currentPath.includes('/book')) {
          pageName = 'Book Concert';
        } else if (currentPath.includes('/request-edit')) {
          pageName = 'Request Concert Edit';
        } else {
          pageName = 'Concert Details';
        }
      } else if (currentPath.includes('/shop/product/')) {
        pageName = 'Product Details';
      } else if (currentPath.includes('/orders/')) {
        if (currentPath.includes('/confirmation')) {
          pageName = 'Order Confirmation';
        } else if (currentPath.includes('/invoice')) {
          pageName = 'Order Invoice';
        } else {
          pageName = 'Order Details';
        }
      } else if (currentPath.includes('/messages/')) {
        pageName = 'Conversation';
      } else if (currentPath.includes('/payments/')) {
        pageName = 'Payment Details';
      } else if (currentPath.includes('/reviews/')) {
        if (currentPath.includes('/admin')) {
          pageName = 'Manage Reviews';
        } else if (currentPath.includes('/my-reviews')) {
          pageName = 'My Reviews';
        } else {
          pageName = 'Product Reviews';
        }
      } else if (currentPath.includes('/user-venues/')) {
        if (currentPath.includes('/bookings')) {
          pageName = 'Venue Bookings';
        } else {
          pageName = 'Venue Details';
        }
      } else if (currentPath.includes('/venue-dashboard/')) {
        if (currentPath.includes('/dashboard')) {
          pageName = 'Venue Dashboard';
        } else if (currentPath.includes('/add-external-booking')) {
          pageName = 'Add Booking';
        } else if (currentPath.includes('/external-bookings')) {
          pageName = 'External Bookings';
        } else {
          pageName = 'Venue Dashboard';
        }
      } else if (currentPath.includes('/artist-applications/')) {
        if (currentPath.includes('/apply')) {
          pageName = 'Apply as Artist';
        } else if (currentPath.includes('/admin')) {
          pageName = 'Manage Applications';
        } else if (currentPath.includes('/proof')) {
          pageName = 'Application Proof';
        } else {
          pageName = 'Artist Applications';
        }
      } else if (currentPath.includes('/admin/venue-requests/')) {
        pageName = 'Venue Request Details';
      } else if (currentPath.includes('/users/venue-requests/')) {
        if (currentPath.includes('/create')) {
          pageName = 'Create Venue Request';
        } else {
          pageName = 'Venue Request Details';
        }
      } else if (currentPath.includes('/website-updates/')) {
        pageName = 'Update Details';
      } else if (currentPath.includes('/team-requirement/')) {
        pageName = 'Team Requirement';
      } else if (currentPath.includes('/api/')) {
        pageName = 'API'; // API calls
      } else if (currentPath.includes('/auth/')) {
        if (currentPath.includes('/login')) {
          pageName = 'Login';
        } else if (currentPath.includes('/register')) {
          pageName = 'Register';
        } else if (currentPath.includes('/forgot-password')) {
          pageName = 'Forgot Password';
        } else if (currentPath.includes('/reset-password')) {
          pageName = 'Reset Password';
        } else {
          pageName = 'Authentication';
        }
      } else {
        // Smart fallback: extract meaningful path segments
        const segments = currentPath.split('/').filter(p => p);
        if (segments.length > 0) {
          // Join first 2 segments and format them
          const pathName = segments.slice(0, 2)
            .map(p => p.replace(/-/g, ' ').charAt(0).toUpperCase() + p.replace(/-/g, ' ').slice(1))
            .join(' ');
          pageName = pathName || 'Website';
        } else {
          pageName = 'Website';
        }
      }
    }

    // Update user's current page in database (non-blocking)
    User.findByIdAndUpdate(
      req.session.user.id,
      {
        currentPage: pageName,
        lastPageUpdate: new Date()
      },
      { new: false }
    ).then(result => {
      console.log(`${debugLog} → Tracked as: "${pageName}"`);
    }).catch(err => {
      console.error(`${debugLog} → Error: ${err.message}`);
    });

  } catch (err) {
    console.error('Page tracking error:', err);
    // Don't block the request if tracking fails
  }

  next();
};

module.exports = { trackUserPage };
