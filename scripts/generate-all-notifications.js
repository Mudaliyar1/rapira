require('dotenv').config();
const mongoose = require('mongoose');
const Notification = require('../models/Notification');

// Import all models
const ArtistApplication = require('../models/ArtistApplication');
const ArtistUpgradeRequest = require('../models/ArtistUpgradeRequest');
const TeamBookingRequest = require('../models/TeamBookingRequest');
const TeamRequirementRole = require('../models/TeamRequirementRole');
const ArtistRoleSlot = require('../models/ArtistRoleSlot');
const ArtistBookingRequest = require('../models/ArtistBookingRequest');
const Concert = require('../models/Concert');
const DailyConcert = require('../models/DailyConcert');
const Artist = require('../models/Artist');
const User = require('../models/User');

// Import notification service
const {
  createArtistApplicationNotification,
  createArtistUpgradeNotification,
  createTeamBookingNotification,
  createRoleSlotNotification,
  createArtistBookingNotification,
  createConcertNotification,
  createDailyConcertNotification
} = require('../utils/notificationService');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('MongoDB Connected Successfully');
  generateAllNotifications();
})
.catch(err => {
  console.error('MongoDB Connection Error:', err);
  process.exit(1);
});

async function generateAllNotifications() {
  try {
    console.log('Starting to generate notifications for all pending requests...');
    
    // Track total notifications created
    let totalCreated = 0;
    
    // 1. Artist Applications
    console.log('\nProcessing Artist Applications...');
    const pendingArtistApplications = await ArtistApplication.find({ status: 'pending' }).populate('user');
    console.log(`Found ${pendingArtistApplications.length} pending artist applications`);
    
    const artistAppCount = await processNotifications(
      pendingArtistApplications,
      'ArtistApplication',
      createArtistApplicationNotification
    );
    totalCreated += artistAppCount;
    
    // 2. Artist Upgrade Requests
    console.log('\nProcessing Artist Upgrade Requests...');
    const pendingUpgradeRequests = await ArtistUpgradeRequest.find({ status: 'pending' })
      .populate('artist')
      .populate('user');
    console.log(`Found ${pendingUpgradeRequests.length} pending artist upgrade requests`);
    
    const upgradeCount = await processNotifications(
      pendingUpgradeRequests,
      'ArtistUpgradeRequest',
      createArtistUpgradeNotification
    );
    totalCreated += upgradeCount;
    
    // 3. Team Booking Requests
    console.log('\nProcessing Team Booking Requests...');
    const pendingTeamBookings = await TeamBookingRequest.find({ 
      status: 'pending',
      $or: [
        { bulkRequestId: null },
        { isBulkRequest: true }
      ]
    }).populate('role');
    console.log(`Found ${pendingTeamBookings.length} pending team booking requests`);
    
    const teamBookingCount = await processNotifications(
      pendingTeamBookings,
      'TeamBookingRequest',
      createTeamBookingNotification
    );
    totalCreated += teamBookingCount;
    
    // 4. Role Slots (active ones that need allocation)
    console.log('\nProcessing Role Slots...');
    const activeRoleSlots = await ArtistRoleSlot.find({ isActive: true });
    console.log(`Found ${activeRoleSlots.length} active role slots`);
    
    const roleSlotsCount = await processNotifications(
      activeRoleSlots,
      'ArtistRoleSlot',
      createRoleSlotNotification
    );
    totalCreated += roleSlotsCount;
    
    // 5. Artist Booking Requests
    console.log('\nProcessing Artist Booking Requests...');
    const pendingArtistBookings = await ArtistBookingRequest.find({ 
      status: 'pending',
      $or: [
        { bulkRequestId: null },
        { isBulkRequest: true }
      ]
    }).populate(['artist', 'roleSlot']);
    console.log(`Found ${pendingArtistBookings.length} pending artist booking requests`);
    
    const artistBookingCount = await processNotifications(
      pendingArtistBookings,
      'ArtistBookingRequest',
      createArtistBookingNotification
    );
    totalCreated += artistBookingCount;
    
    // 6. Pending Concerts
    console.log('\nProcessing Pending Concerts...');
    const pendingConcerts = await Concert.find({ status: 'pending' }).populate({
      path: 'artist',
      populate: { path: 'user' }
    });
    console.log(`Found ${pendingConcerts.length} pending concerts`);
    
    const concertCount = await processNotifications(
      pendingConcerts,
      'Concert',
      createConcertNotification
    );
    totalCreated += concertCount;
    
    // 7. Daily Concerts
    console.log('\nProcessing Daily Concerts...');
    const dailyConcerts = await DailyConcert.find().limit(10); // Get recent ones
    console.log(`Found ${dailyConcerts.length} daily concerts`);
    
    const dailyConcertCount = await processNotifications(
      dailyConcerts,
      'DailyConcert',
      createDailyConcertNotification
    );
    totalCreated += dailyConcertCount;
    
    console.log(`\nTotal notifications created: ${totalCreated}`);
    console.log('Notification generation completed successfully');
    
    // Get total pending notifications count
    const pendingCount = await Notification.countDocuments({ status: 'Pending' });
    const unreadCount = await Notification.countDocuments({ isRead: false });
    
    console.log(`\nCurrent notification stats:`);
    console.log(`- Pending notifications: ${pendingCount}`);
    console.log(`- Unread notifications: ${unreadCount}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error generating notifications:', error);
    process.exit(1);
  }
}

async function processNotifications(items, modelRef, createNotificationFn) {
  // Check if notifications already exist for these items
  const itemIds = items.map(item => item._id);
  const existingNotifications = await Notification.find({
    requestId: { $in: itemIds },
    modelRef: modelRef
  });
  
  console.log(`Found ${existingNotifications.length} existing notifications`);
  
  // Create a map of existing notifications by requestId for quick lookup
  const existingNotificationMap = {};
  existingNotifications.forEach(notification => {
    existingNotificationMap[notification.requestId.toString()] = notification;
  });
  
  // Generate notifications for items that don't have one
  let createdCount = 0;
  for (const item of items) {
    const itemId = item._id.toString();
    
    if (!existingNotificationMap[itemId]) {
      try {
        await createNotificationFn(item);
        createdCount++;
      } catch (error) {
        console.error(`Error creating notification for ${modelRef} ${itemId}:`, error);
      }
    }
  }
  
  console.log(`Created ${createdCount} new notifications for ${modelRef}`);
  return createdCount;
}

// Handle process termination
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('Mongoose connection closed due to application termination');
  process.exit(0);
});
