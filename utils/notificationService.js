const { createNotification } = require('../routes/notifications');
const Notification = require('../models/Notification');

/**
 * Create a notification for a new artist application
 * @param {Object} application - The artist application object
 * @returns {Promise<Object>} - The created notification
 */
const createArtistApplicationNotification = async (application) => {
  try {
    const module = 'Artist Application';
    const requestId = application._id;
    const modelRef = 'ArtistApplication';
    const description = `New artist application from ${application.user.name || 'a user'}`;
    const link = '/artist-applications/admin';

    return await createNotification(module, requestId, modelRef, description, link);
  } catch (error) {
    console.error('Error creating artist application notification:', error);
    return null;
  }
};

/**
 * Create a notification for an artist upgrade request
 * @param {Object} upgradeRequest - The artist upgrade request object
 * @returns {Promise<Object>} - The created notification
 */
const createArtistUpgradeNotification = async (upgradeRequest) => {
  try {
    const module = 'Artist Upgrade';
    const requestId = upgradeRequest._id;
    const modelRef = 'ArtistUpgradeRequest';
    const description = `Artist upgrade request from ${upgradeRequest.artist.stageName || 'an artist'} (${upgradeRequest.currentLevel} to ${upgradeRequest.requestedLevel})`;
    const link = '/admin/artist-upgrade-requests';

    return await createNotification(module, requestId, modelRef, description, link);
  } catch (error) {
    console.error('Error creating artist upgrade notification:', error);
    return null;
  }
};

/**
 * Create a notification for a team booking request
 * @param {Object} bookingRequest - The team booking request object
 * @returns {Promise<Object>} - The created notification
 */
const createTeamBookingNotification = async (bookingRequest) => {
  try {
    const module = 'Team Booking';
    const requestId = bookingRequest._id;
    const modelRef = 'TeamBookingRequest';
    const description = `New team booking request from ${bookingRequest.name} for role: ${bookingRequest.role.name || 'Unknown Role'}`;
    const link = '/admin/team-requirement/requests';

    return await createNotification(module, requestId, modelRef, description, link);
  } catch (error) {
    console.error('Error creating team booking notification:', error);
    return null;
  }
};

/**
 * Create a notification for a new role slot
 * @param {Object} roleSlot - The role slot object
 * @returns {Promise<Object>} - The created notification
 */
const createRoleSlotNotification = async (roleSlot) => {
  try {
    const module = 'Role Slot';
    const requestId = roleSlot._id;
    const modelRef = 'ArtistRoleSlot';
    const description = `New role slot created: ${roleSlot.name} in ${roleSlot.city}, ${roleSlot.state}`;
    const link = '/admin/find-my-artist/role-slots';

    return await createNotification(module, requestId, modelRef, description, link);
  } catch (error) {
    console.error('Error creating role slot notification:', error);
    return null;
  }
};

/**
 * Create a notification for an artist booking request
 * @param {Object} bookingRequest - The artist booking request object
 * @returns {Promise<Object>} - The created notification
 */
const createArtistBookingNotification = async (bookingRequest) => {
  try {
    const module = 'Artist Booking';
    const requestId = bookingRequest._id;
    const modelRef = 'ArtistBookingRequest';

    let description = '';
    if (bookingRequest.bookingType === 'artist' && bookingRequest.artist) {
      description = `New booking request from ${bookingRequest.name} for artist`;
    } else if (bookingRequest.bookingType === 'role' && bookingRequest.roleSlot) {
      description = `New booking request from ${bookingRequest.name} for role slot`;
    } else if (bookingRequest.bookingType === 'bulk') {
      description = `New bulk booking request from ${bookingRequest.name}`;
    } else {
      description = `New booking request from ${bookingRequest.name}`;
    }

    const link = '/admin/find-my-artist/booking-requests';

    return await createNotification(module, requestId, modelRef, description, link);
  } catch (error) {
    console.error('Error creating artist booking notification:', error);
    return null;
  }
};

/**
 * Create a notification for a new concert
 * @param {Object} concert - The concert object
 * @returns {Promise<Object>} - The created notification
 */
const createConcertNotification = async (concert) => {
  try {
    const module = 'Concert';
    const requestId = concert._id;
    const modelRef = 'Concert';
    const description = `New concert request: ${concert.title} by ${concert.artist.stageName || 'an artist'} in ${concert.city}`;
    const link = '/admin/concerts/pending';

    return await createNotification(module, requestId, modelRef, description, link);
  } catch (error) {
    console.error('Error creating concert notification:', error);
    return null;
  }
};

/**
 * Create a notification for a daily concert
 * @param {Object} dailyConcert - The daily concert object
 * @returns {Promise<Object>} - The created notification
 */
const createDailyConcertNotification = async (dailyConcert) => {
  try {
    const module = 'Daily Concert';
    const requestId = dailyConcert._id;
    const modelRef = 'DailyConcert';
    const description = `New daily concert: ${dailyConcert.title} in ${dailyConcert.eventCity}, ${dailyConcert.eventState}`;
    const link = '/admin/daily-concerts';

    return await createNotification(module, requestId, modelRef, description, link);
  } catch (error) {
    console.error('Error creating daily concert notification:', error);
    return null;
  }
};

/**
 * Create a notification for a learning module application
 * @param {Object} learningRequest - The learning module request object
 * @returns {Promise<Object>} - The created notification
 */
const createLearningModuleNotification = async (learningRequest) => {
  try {
    const module = 'Learning Module';
    const requestId = learningRequest._id;
    const modelRef = 'LearningModule';
    const description = `New learning module application from ${learningRequest.user.name || 'a user'}`;
    const link = '/learning/admin';

    return await createNotification(module, requestId, modelRef, description, link);
  } catch (error) {
    console.error('Error creating learning module notification:', error);
    return null;
  }
};

/**
 * Update notification status based on the status of the related request
 * @param {string} modelRef - The model reference (e.g., 'Concert', 'TeamBookingRequest')
 * @param {string} requestId - The ID of the request
 * @param {string} status - The new status of the request
 */
const updateNotificationStatus = async (modelRef, requestId, status) => {
  try {
    // Map request status to notification status
    let notificationStatus = 'Pending';

    // Normalize status to lowercase for comparison
    const normalizedStatus = status.toLowerCase();

    // Map various status values to notification status
    if (['approved', 'accepted', 'completed', 'active', 'verified'].includes(normalizedStatus)) {
      notificationStatus = 'Reviewed';
    } else if (['rejected', 'declined', 'cancelled', 'inactive', 'failed'].includes(normalizedStatus)) {
      notificationStatus = 'Reviewed';
    } else if (['pending', 'in review', 'processing', 'waiting'].includes(normalizedStatus)) {
      notificationStatus = 'Pending';
    }

    // Update the notification
    await Notification.updateMany(
      {
        modelRef: modelRef,
        requestId: requestId
      },
      {
        $set: {
          status: notificationStatus,
          isRead: notificationStatus === 'Reviewed' // Mark as read if reviewed
        }
      }
    );

    console.log(`Updated notification status for ${modelRef} ${requestId} to ${notificationStatus}`);
    return true;
  } catch (error) {
    console.error(`Error updating notification status for ${modelRef} ${requestId}:`, error);
    return false;
  }
};

module.exports = {
  createArtistApplicationNotification,
  createArtistUpgradeNotification,
  createTeamBookingNotification,
  createRoleSlotNotification,
  createArtistBookingNotification,
  createConcertNotification,
  createDailyConcertNotification,
  createLearningModuleNotification,
  updateNotificationStatus
};
