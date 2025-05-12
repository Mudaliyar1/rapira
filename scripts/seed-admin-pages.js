require('dotenv').config();
const mongoose = require('mongoose');
const AdminPage = require('../models/AdminPage');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB Connected'))
.catch(err => {
  console.error('MongoDB Connection Error:', err);
  process.exit(1);
});

// Define admin pages with their properties
const adminPages = [
  // Dashboard
  {
    name: 'Dashboard',
    slug: 'dashboard',
    description: 'Admin dashboard with overview statistics',
    path: '/admin',
    icon: 'bi-speedometer2',
    category: 'dashboard',
    displayOrder: 1,
    alwaysAccessible: true // Dashboard is always accessible to all admins
  },
  
  // Notifications
  {
    name: 'Notifications',
    slug: 'notifications',
    description: 'Manage system notifications',
    path: '/admin/notifications',
    icon: 'bi-bell',
    category: 'dashboard',
    displayOrder: 2,
    alwaysAccessible: true // Notifications are always accessible
  },
  
  // User Management
  {
    name: 'Users',
    slug: 'users',
    description: 'Manage user accounts',
    path: '/admin/users',
    icon: 'bi-people',
    category: 'user_management',
    displayOrder: 10
  },
  {
    name: 'Artists',
    slug: 'artists',
    description: 'Manage artist accounts',
    path: '/admin/artists',
    icon: 'bi-music-note-beamed',
    category: 'user_management',
    displayOrder: 11
  },
  {
    name: 'Artist Applications',
    slug: 'artist-applications',
    description: 'Review artist applications',
    path: '/artist-applications/admin',
    icon: 'bi-person-badge',
    category: 'user_management',
    displayOrder: 12
  },
  {
    name: 'Artist Upgrades',
    slug: 'artist-upgrades',
    description: 'Manage artist level upgrade requests',
    path: '/admin/artist-upgrade-requests',
    icon: 'bi-arrow-up-circle',
    category: 'user_management',
    displayOrder: 13
  },
  {
    name: 'Roles',
    slug: 'roles',
    description: 'Manage user roles',
    path: '/roles',
    icon: 'bi-tags',
    category: 'user_management',
    displayOrder: 14
  },
  {
    name: 'User Roles',
    slug: 'user-roles',
    description: 'Assign roles to users',
    path: '/roles/user-roles',
    icon: 'bi-person-check',
    category: 'user_management',
    displayOrder: 15
  },
  
  // Content Management
  {
    name: 'Content',
    slug: 'content',
    description: 'Manage artist content',
    path: '/admin/content',
    icon: 'bi-file-earmark-music',
    category: 'content_management',
    displayOrder: 20
  },
  {
    name: 'Pages',
    slug: 'pages',
    description: 'Manage website pages',
    path: '/admin/pages',
    icon: 'bi-file-earmark-text',
    category: 'content_management',
    displayOrder: 21
  },
  {
    name: 'Concerts',
    slug: 'concerts',
    description: 'Manage concerts',
    path: '/admin/concerts',
    icon: 'bi-calendar-event',
    category: 'content_management',
    displayOrder: 22
  },
  {
    name: 'Learning Modules',
    slug: 'learning-modules',
    description: 'Manage learning content',
    path: '/learning/admin',
    icon: 'bi-book',
    category: 'content_management',
    displayOrder: 23
  },
  
  // Booking Management
  {
    name: 'Team Roles',
    slug: 'team-roles',
    description: 'Manage team requirement roles',
    path: '/admin/team-requirement/roles',
    icon: 'bi-briefcase',
    category: 'booking_management',
    displayOrder: 30
  },
  {
    name: 'Team Bookings',
    slug: 'team-bookings',
    description: 'Manage team booking requests',
    path: '/admin/team-requirement/requests',
    icon: 'bi-calendar-check',
    category: 'booking_management',
    displayOrder: 31
  },
  {
    name: 'Featured Artists',
    slug: 'featured-artists',
    description: 'Manage featured artists',
    path: '/admin/find-my-artist/featured-artists',
    icon: 'bi-star',
    category: 'booking_management',
    displayOrder: 32
  },
  {
    name: 'Role Slots',
    slug: 'role-slots',
    description: 'Manage artist role slots',
    path: '/admin/find-my-artist/role-slots',
    icon: 'bi-briefcase',
    category: 'booking_management',
    displayOrder: 33
  },
  {
    name: 'Artist Bookings',
    slug: 'artist-bookings',
    description: 'Manage artist booking requests',
    path: '/admin/find-my-artist/booking-requests',
    icon: 'bi-calendar-check',
    category: 'booking_management',
    displayOrder: 34
  },
  {
    name: 'Daily Concerts',
    slug: 'daily-concerts',
    description: 'Manage daily concerts',
    path: '/admin/daily-concerts',
    icon: 'bi-calendar-day',
    category: 'booking_management',
    displayOrder: 35
  },
  
  // System
  {
    name: 'Storage Management',
    slug: 'storage-management',
    description: 'Manage database storage',
    path: '/admin/storage-management',
    icon: 'bi-hdd',
    category: 'system',
    displayOrder: 40
  },
  
  // Super Admin Only
  {
    name: 'Admin Access Control',
    slug: 'admin-access-control',
    description: 'Manage admin page permissions',
    path: '/admin/access-control',
    icon: 'bi-shield-lock',
    category: 'system',
    displayOrder: 50,
    superAdminOnly: true // Only super admins can access this page
  }
];

// Function to seed admin pages
const seedAdminPages = async () => {
  try {
    // First, delete all existing admin pages
    await AdminPage.deleteMany({});
    console.log('Deleted existing admin pages');
    
    // Insert new admin pages
    const result = await AdminPage.insertMany(adminPages);
    console.log(`Inserted ${result.length} admin pages`);
    
    // Log all inserted pages
    console.log('Admin pages:');
    result.forEach(page => {
      console.log(`- ${page.name} (${page.slug}): ${page.path}`);
    });
    
    console.log('Admin pages seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin pages:', error);
    process.exit(1);
  }
};

// Run the seed function
seedAdminPages();
