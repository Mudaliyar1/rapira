require('dotenv').config();
const mongoose = require('mongoose');
const TeamUpdate = require('../models/TeamUpdate');
const User = require('../models/User');

async function initializeTeamUpdates() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Find an admin user to create sample updates
    const adminUser = await User.findOne({ role: { $in: ['admin', 'superAdmin'] } });
    
    if (!adminUser) {
      console.log('No admin user found. Please create an admin user first.');
      return;
    }

    // Check if team updates already exist
    const existingUpdates = await TeamUpdate.countDocuments();
    if (existingUpdates > 0) {
      console.log(`Found ${existingUpdates} existing team updates. Skipping initialization.`);
      return;
    }

    // Create sample team updates
    const sampleUpdates = [
      {
        title: 'Welcome to RAPIRA Team Updates!',
        content: `Welcome to our new internal communication system! 🎉

This platform will help us stay synchronized and informed about:
- Company announcements and updates
- Meeting minutes and action items
- Policy changes and new procedures
- Project updates and milestones
- Team celebrations and achievements

Features available:
✅ Real-time notifications
✅ File attachments
✅ Comments and discussions
✅ Action item tracking
✅ Read receipts
✅ Priority levels and categories

Let's use this system to improve our communication and collaboration!`,
        type: 'announcement',
        priority: 'high',
        category: 'company_wide',
        tags: ['welcome', 'introduction', 'communication'],
        targetAudience: 'all_admins',
        isPinned: true,
        allowComments: true,
        createdBy: adminUser._id
      },
      {
        title: 'Weekly Team Meeting - Project Status Update',
        content: `Meeting Summary - Week of ${new Date().toLocaleDateString()}

Agenda Items Discussed:
1. RAPIRA Platform Development Progress
2. User Feedback and Feature Requests
3. Marketing Campaign Performance
4. Technical Infrastructure Updates

Key Decisions:
- Prioritize mobile responsiveness improvements
- Implement new team communication features
- Schedule user testing sessions for next month

Next Steps:
- Review action items below
- Prepare for next week's sprint planning
- Update project documentation`,
        type: 'meeting_minutes',
        priority: 'normal',
        category: 'development',
        tags: ['weekly-meeting', 'project-status', 'development'],
        targetAudience: 'all_admins',
        meetingDate: new Date(),
        actionItems: [
          {
            task: 'Update mobile CSS for better responsiveness',
            status: 'pending'
          },
          {
            task: 'Gather user feedback from recent surveys',
            status: 'pending'
          },
          {
            task: 'Prepare sprint planning materials',
            status: 'pending'
          }
        ],
        allowComments: true,
        createdBy: adminUser._id
      },
      {
        title: 'New Security Policy - Two-Factor Authentication',
        content: `Important Security Update 🔐

Effective immediately, all admin accounts must enable two-factor authentication (2FA) for enhanced security.

What you need to do:
1. Download an authenticator app (Google Authenticator, Authy, etc.)
2. Go to your profile settings
3. Enable 2FA and scan the QR code
4. Save your backup codes in a secure location

Deadline: End of this week

This policy applies to:
- All admin users
- Super admin users
- Any user with elevated privileges

For assistance with setup, please contact the IT team.

Thank you for helping us maintain the security of our platform!`,
        type: 'policy_update',
        priority: 'urgent',
        category: 'company_wide',
        tags: ['security', 'policy', '2fa', 'authentication'],
        targetAudience: 'all_admins',
        isPinned: true,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        allowComments: true,
        createdBy: adminUser._id
      },
      {
        title: 'Q4 Performance Review - Excellent Results! 🎉',
        content: `Team Celebration! 🎊

I'm thrilled to share our Q4 performance results:

📈 Platform Metrics:
- 40% increase in user registrations
- 60% growth in concert bookings
- 35% improvement in user engagement
- 99.8% platform uptime

🏆 Team Achievements:
- Successfully launched merchandise system
- Implemented advanced search features
- Improved page load times by 45%
- Zero critical security incidents

🙏 Thank You:
This success is a result of everyone's hard work, dedication, and collaboration. Each team member has contributed significantly to these outstanding results.

🎁 Rewards:
- Team bonus will be processed this month
- Extra day off for everyone next Friday
- Team dinner celebration next week

Keep up the excellent work, team! Here's to an even better next quarter! 🚀`,
        type: 'celebration',
        priority: 'normal',
        category: 'company_wide',
        tags: ['celebration', 'performance', 'q4-results', 'team-success'],
        targetAudience: 'all_team',
        isPinned: true,
        allowComments: true,
        createdBy: adminUser._id
      },
      {
        title: 'System Maintenance - Database Optimization',
        content: `Scheduled Maintenance Notice ⚙️

We will be performing database optimization and server maintenance:

📅 Date: This Sunday
⏰ Time: 2:00 AM - 6:00 AM IST
⏱️ Duration: Approximately 4 hours

What to expect:
- Platform will be in maintenance mode
- No user access during this period
- All data will be preserved
- Performance improvements after completion

Maintenance tasks:
✅ Database indexing optimization
✅ Server security updates
✅ Cache clearing and optimization
✅ Backup verification
✅ Performance monitoring setup

The platform will be faster and more reliable after this maintenance.

For any urgent issues during maintenance, contact the on-call engineer.`,
        type: 'system_update',
        priority: 'high',
        category: 'operations',
        tags: ['maintenance', 'database', 'optimization', 'downtime'],
        targetAudience: 'all_admins',
        allowComments: true,
        createdBy: adminUser._id
      }
    ];

    // Insert sample updates
    const createdUpdates = await TeamUpdate.insertMany(sampleUpdates);
    console.log(`✅ Created ${createdUpdates.length} sample team updates`);

    // Add some sample views and reactions
    for (const update of createdUpdates) {
      // Mark as viewed by the admin user
      await update.markAsRead(adminUser._id, Math.floor(Math.random() * 300) + 30);
      
      // Add some sample reactions
      if (Math.random() > 0.5) {
        const reactions = ['like', 'helpful', 'important'];
        const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
        await update.addReaction(adminUser._id, randomReaction);
      }
    }

    console.log('✅ Added sample interactions to updates');
    console.log('\n🎉 Team Updates system initialized successfully!');
    console.log('\nYou can now access the team updates at: /admin/team-updates');
    console.log('\nFeatures available:');
    console.log('- Create announcements and meeting minutes');
    console.log('- Track action items and their progress');
    console.log('- Add file attachments');
    console.log('- Comment and discuss updates');
    console.log('- View read receipts and engagement');
    console.log('- Filter and search updates');

  } catch (error) {
    console.error('Error initializing team updates:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the initialization
if (require.main === module) {
  initializeTeamUpdates();
}

module.exports = { initializeTeamUpdates };
