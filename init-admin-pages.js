require('dotenv').config();
const mongoose = require('mongoose');
const AdminPage = require('./models/AdminPage');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    initializeAdminPages();
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

async function initializeAdminPages() {
  try {
    // Define admin pages
    const adminPages = [
      // Dashboard
      {
        name: 'Dashboard',
        slug: 'dashboard',
        description: 'Admin dashboard with statistics and overview',
        path: '/admin',
        icon: 'bi-speedometer2',
        category: 'dashboard',
        displayOrder: 1,
        alwaysAccessible: false, // Dashboard access can now be restricted
        superAdminOnly: false
      },

      // User Management
      {
        name: 'Users',
        slug: 'users',
        description: 'Manage all users',
        path: '/admin/users',
        icon: 'bi-people',
        category: 'user_management',
        displayOrder: 1,
        alwaysAccessible: false,
        superAdminOnly: false
      },
      {
        name: 'Artists',
        slug: 'artists',
        description: 'Manage artist accounts',
        path: '/admin/artists',
        icon: 'bi-music-note-beamed',
        category: 'user_management',
        displayOrder: 2,
        alwaysAccessible: false,
        superAdminOnly: false
      },
      {
        name: 'Artist Applications',
        slug: 'artist_applications',
        description: 'Review and manage artist applications',
        path: '/artist-applications/admin',
        icon: 'bi-person-badge',
        category: 'user_management',
        displayOrder: 3,
        alwaysAccessible: false,
        superAdminOnly: false
      },
      {
        name: 'Artist Upgrades',
        slug: 'artist_upgrades',
        description: 'Manage artist upgrade requests',
        path: '/admin/artist-upgrade-requests',
        icon: 'bi-arrow-up-circle',
        category: 'user_management',
        displayOrder: 4,
        alwaysAccessible: false,
        superAdminOnly: false
      },
      {
        name: 'Roles',
        slug: 'roles',
        description: 'Manage user roles',
        path: '/roles',
        icon: 'bi-tags',
        category: 'user_management',
        displayOrder: 5,
        alwaysAccessible: false,
        superAdminOnly: false
      },
      {
        name: 'User Roles',
        slug: 'user_roles',
        description: 'Assign roles to users',
        path: '/roles/user-roles',
        icon: 'bi-people-fill',
        category: 'user_management',
        displayOrder: 6,
        alwaysAccessible: false,
        superAdminOnly: false
      },

      // Concert Management
      {
        name: 'Concerts',
        slug: 'concerts',
        description: 'Manage all concerts',
        path: '/admin/concerts',
        icon: 'bi-calendar-event',
        category: 'content_management',
        displayOrder: 1,
        alwaysAccessible: false,
        superAdminOnly: false
      },
      {
        name: 'Pending Concerts',
        slug: 'pending_concerts',
        description: 'Review pending concert submissions',
        path: '/admin/concerts/pending',
        icon: 'bi-hourglass-split',
        category: 'content_management',
        displayOrder: 2,
        alwaysAccessible: false,
        superAdminOnly: false
      },
      {
        name: 'Tickets',
        slug: 'tickets',
        description: 'Manage ticket sales',
        path: '/admin/tickets',
        icon: 'bi-ticket-perforated',
        category: 'content_management',
        displayOrder: 3,
        alwaysAccessible: false,
        superAdminOnly: false
      },
      {
        name: 'Daily Concerts',
        slug: 'daily_concerts',
        description: 'Manage daily concerts',
        path: '/admin/daily-concerts',
        icon: 'bi-calendar-week',
        category: 'content_management',
        displayOrder: 4,
        alwaysAccessible: false,
        superAdminOnly: false
      },

      // Content Management
      {
        name: 'Content',
        slug: 'content',
        description: 'Manage site content',
        path: '/admin/content',
        icon: 'bi-file-earmark-music',
        category: 'content_management',
        displayOrder: 5,
        alwaysAccessible: false,
        superAdminOnly: false
      },
      {
        name: 'Pages',
        slug: 'pages',
        description: 'Manage site pages',
        path: '/admin/pages',
        icon: 'bi-file-earmark-text',
        category: 'content_management',
        displayOrder: 6,
        alwaysAccessible: false,
        superAdminOnly: false
      },
      {
        name: 'Learning Modules',
        slug: 'learning_modules',
        description: 'Manage learning content',
        path: '/learning/admin',
        icon: 'bi-journal-text',
        category: 'content_management',
        displayOrder: 7,
        alwaysAccessible: false,
        superAdminOnly: false
      },

      // System
      {
        name: 'Revenue Analysis',
        slug: 'revenue_analysis',
        description: 'Analyze all revenue streams from the website',
        path: '/admin/revenue-analysis',
        icon: 'bi-currency-rupee',
        category: 'system',
        displayOrder: 1,
        alwaysAccessible: false,
        superAdminOnly: false
      },
      {
        name: 'Storage Management',
        slug: 'storage_management',
        description: 'Manage file storage',
        path: '/admin/storage-management',
        icon: 'bi-hdd-stack',
        category: 'system',
        displayOrder: 2,
        alwaysAccessible: false,
        superAdminOnly: false
      },
      {
        name: 'Admin Access Control',
        slug: 'access_control',
        description: 'Manage admin permissions',
        path: '/admin/access-control',
        icon: 'bi-shield-lock',
        category: 'system',
        displayOrder: 2,
        alwaysAccessible: false,
        superAdminOnly: true // Only super admins can access this
      },
      {
        name: 'Notifications',
        slug: 'notifications',
        description: 'Manage system notifications',
        path: '/admin/notifications',
        icon: 'bi-bell',
        category: 'system',
        displayOrder: 3,
        alwaysAccessible: false,
        superAdminOnly: false
      },
      {
        name: 'Project Documentation',
        slug: 'documentation',
        description: 'View complete project documentation',
        path: '/admin/documentation',
        icon: 'bi-file-earmark-text',
        category: 'system',
        displayOrder: 4,
        alwaysAccessible: true, // All admins can access documentation
        superAdminOnly: false
      }
    ];

    // Count existing pages
    const existingCount = await AdminPage.countDocuments();
    console.log(`Found ${existingCount} existing admin pages`);

    // If pages already exist, ask for confirmation before proceeding
    if (existingCount > 0) {
      const args = process.argv.slice(2);
      const forceUpdate = args.includes('--force');

      if (!forceUpdate) {
        console.log('Admin pages already exist. Run with --force to overwrite.');
        await mongoose.disconnect();
        process.exit(0);
      } else {
        // Delete existing pages if --force is specified
        await AdminPage.deleteMany({});
        console.log('Deleted existing admin pages');
      }
    }

    // Insert new pages
    await AdminPage.insertMany(adminPages);
    console.log(`Successfully initialized ${adminPages.length} admin pages`);

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing admin pages:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}
