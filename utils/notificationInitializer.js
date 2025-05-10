const Notification = require('../models/Notification');

// Import all models
const ArtistApplication = require('../models/ArtistApplication');
const ArtistUpgradeRequest = require('../models/ArtistUpgradeRequest');
const TeamBookingRequest = require('../models/TeamBookingRequest');
const ArtistRoleSlot = require('../models/ArtistRoleSlot');
const ArtistBookingRequest = require('../models/ArtistBookingRequest');
const Concert = require('../models/Concert');

// Import notification service
const {
  createArtistApplicationNotification,
  createArtistUpgradeNotification,
  createTeamBookingNotification,
  createRoleSlotNotification,
  createArtistBookingNotification,
  createConcertNotification
} = require('./notificationService');

/**
 * Initialize notifications for all pending requests
 * This function should be called on application startup
 */
async function initializeNotifications() {
  try {
    console.log('Initializing notifications for pending requests...');
    
    // Track total notifications created
    let totalCreated = 0;
    
    // 1. Artist Applications
    const pendingArtistApplications = await ArtistApplication.find({ status: 'pending' }).populate('user');
    const artistAppCount = await processNotifications(
      pendingArtistApplications,
      'ArtistApplication',
      createArtistApplicationNotification
    );
    totalCreated += artistAppCount;
    
    // 2. Artist Upgrade Requests
    const pendingUpgradeRequests = await ArtistUpgradeRequest.find({ status: 'pending' })
      .populate('artist')
      .populate('user');
    const upgradeCount = await processNotifications(
      pendingUpgradeRequests,
      'ArtistUpgradeRequest',
      createArtistUpgradeNotification
    );
    totalCreated += upgradeCount;
    
    // 3. Team Booking Requests
    const pendingTeamBookings = await TeamBookingRequest.find({ 
      status: 'pending',
      $or: [
        { bulkRequestId: null },
        { isBulkRequest: true }
      ]
    }).populate('role');
    const teamBookingCount = await processNotifications(
      pendingTeamBookings,
      'TeamBookingRequest',
      createTeamBookingNotification
    );
    totalCreated += teamBookingCount;
    
    // 4. Role Slots (active ones that need allocation)
    const activeRoleSlots = await ArtistRoleSlot.find({ isActive: true });
    const roleSlotsCount = await processNotifications(
      activeRoleSlots,
      'ArtistRoleSlot',
      createRoleSlotNotification
    );
    totalCreated += roleSlotsCount;
    
    // 5. Artist Booking Requests
    const pendingArtistBookings = await ArtistBookingRequest.find({ 
      status: 'pending',
      $or: [
        { bulkRequestId: null },
        { isBulkRequest: true }
      ]
    }).populate(['artist', 'roleSlot']);
    const artistBookingCount = await processNotifications(
      pendingArtistBookings,
      'ArtistBookingRequest',
      createArtistBookingNotification
    );
    totalCreated += artistBookingCount;
    
    // 6. Pending Concerts
    const pendingConcerts = await Concert.find({ status: 'pending' }).populate({
      path: 'artist',
      populate: { path: 'user' }
    });
    const concertCount = await processNotifications(
      pendingConcerts,
      'Concert',
      createConcertNotification
    );
    totalCreated += concertCount;
    
    if (totalCreated > 0) {
      console.log(`Created ${totalCreated} new notifications during initialization`);
    } else {
      console.log('No new notifications needed to be created during initialization');
    }
    
    // Get total pending notifications count
    const pendingCount = await Notification.countDocuments({ status: 'Pending' });
    const unreadCount = await Notification.countDocuments({ isRead: false });
    
    console.log(`Current notification stats: ${pendingCount} pending, ${unreadCount} unread`);
    
    return {
      created: totalCreated,
      pending: pendingCount,
      unread: unreadCount
    };
  } catch (error) {
    console.error('Error initializing notifications:', error);
    return {
      created: 0,
      pending: 0,
      unread: 0,
      error: error.message
    };
  }
}

async function processNotifications(items, modelRef, createNotificationFn) {
  if (!items || items.length === 0) return 0;
  
  // Check if notifications already exist for these items
  const itemIds = items.map(item => item._id);
  const existingNotifications = await Notification.find({
    requestId: { $in: itemIds },
    modelRef: modelRef
  });
  
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
  
  return createdCount;
}

module.exports = {
  initializeNotifications
};
