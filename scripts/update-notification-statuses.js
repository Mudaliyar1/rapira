/**
 * Script to update notification statuses based on the status of their related requests
 * This script can be run to fix existing notifications
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const Concert = require('../models/Concert');
const ArtistApplication = require('../models/ArtistApplication');
const ArtistUpgradeRequest = require('../models/ArtistUpgradeRequest');
const TeamBookingRequest = require('../models/TeamBookingRequest');
const ArtistRoleSlot = require('../models/ArtistRoleSlot');
const ArtistBookingRequest = require('../models/ArtistBookingRequest');
const DailyConcert = require('../models/DailyConcert');
const LearningModule = require('../models/LearningModule');
const { updateNotificationStatus } = require('../utils/notificationService');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

async function updateAllNotificationStatuses() {
  try {
    console.log('Starting notification status update...');

    // Get all notifications
    const notifications = await Notification.find();
    console.log(`Found ${notifications.length} notifications to process`);

    let updatedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Process each notification
    for (const notification of notifications) {
      try {
        // Handle different model types
        switch (notification.modelRef) {
          case 'Concert':
            const concert = await Concert.findById(notification.requestId);
            if (concert) {
              await updateNotificationStatus('Concert', concert._id, concert.status);
              console.log(`Updated notification for Concert ${concert._id} to status ${concert.status}`);
              updatedCount++;
            } else {
              console.log(`Concert ${notification.requestId} not found for notification ${notification._id}`);
              errorCount++;
            }
            break;

          case 'ArtistApplication':
            const application = await ArtistApplication.findById(notification.requestId);
            if (application) {
              await updateNotificationStatus('ArtistApplication', application._id, application.status);
              console.log(`Updated notification for ArtistApplication ${application._id} to status ${application.status}`);
              updatedCount++;
            } else {
              console.log(`ArtistApplication ${notification.requestId} not found for notification ${notification._id}`);
              errorCount++;
            }
            break;

          case 'ArtistUpgradeRequest':
            const upgradeRequest = await ArtistUpgradeRequest.findById(notification.requestId);
            if (upgradeRequest) {
              await updateNotificationStatus('ArtistUpgradeRequest', upgradeRequest._id, upgradeRequest.status);
              console.log(`Updated notification for ArtistUpgradeRequest ${upgradeRequest._id} to status ${upgradeRequest.status}`);
              updatedCount++;
            } else {
              console.log(`ArtistUpgradeRequest ${notification.requestId} not found for notification ${notification._id}`);
              errorCount++;
            }
            break;

          case 'TeamBookingRequest':
            const teamBooking = await TeamBookingRequest.findById(notification.requestId);
            if (teamBooking) {
              await updateNotificationStatus('TeamBookingRequest', teamBooking._id, teamBooking.status);
              console.log(`Updated notification for TeamBookingRequest ${teamBooking._id} to status ${teamBooking.status}`);
              updatedCount++;
            } else {
              console.log(`TeamBookingRequest ${notification.requestId} not found for notification ${notification._id}`);
              errorCount++;
            }
            break;

          case 'ArtistRoleSlot':
            const roleSlot = await ArtistRoleSlot.findById(notification.requestId);
            if (roleSlot) {
              await updateNotificationStatus('ArtistRoleSlot', roleSlot._id, roleSlot.status || 'active');
              console.log(`Updated notification for ArtistRoleSlot ${roleSlot._id} to status ${roleSlot.status || 'active'}`);
              updatedCount++;
            } else {
              console.log(`ArtistRoleSlot ${notification.requestId} not found for notification ${notification._id}`);
              errorCount++;
            }
            break;

          case 'ArtistBookingRequest':
            const artistBooking = await ArtistBookingRequest.findById(notification.requestId);
            if (artistBooking) {
              await updateNotificationStatus('ArtistBookingRequest', artistBooking._id, artistBooking.status);
              console.log(`Updated notification for ArtistBookingRequest ${artistBooking._id} to status ${artistBooking.status}`);
              updatedCount++;
            } else {
              console.log(`ArtistBookingRequest ${notification.requestId} not found for notification ${notification._id}`);
              errorCount++;
            }
            break;

          case 'DailyConcert':
            const dailyConcert = await DailyConcert.findById(notification.requestId);
            if (dailyConcert) {
              await updateNotificationStatus('DailyConcert', dailyConcert._id, dailyConcert.status);
              console.log(`Updated notification for DailyConcert ${dailyConcert._id} to status ${dailyConcert.status}`);
              updatedCount++;
            } else {
              console.log(`DailyConcert ${notification.requestId} not found for notification ${notification._id}`);
              errorCount++;
            }
            break;

          case 'LearningModule':
            const learningModule = await LearningModule.findById(notification.requestId);
            if (learningModule) {
              await updateNotificationStatus('LearningModule', learningModule._id, learningModule.status);
              console.log(`Updated notification for LearningModule ${learningModule._id} to status ${learningModule.status}`);
              updatedCount++;
            } else {
              console.log(`LearningModule ${notification.requestId} not found for notification ${notification._id}`);
              errorCount++;
            }
            break;

          default:
            console.log(`Skipping notification ${notification._id} with model ${notification.modelRef}`);
            skippedCount++;
        }
      } catch (error) {
        console.error(`Error processing notification ${notification._id}:`, error);
        errorCount++;
      }
    }

    console.log(`Notification update complete. Updated: ${updatedCount}, Errors: ${errorCount}, Skipped: ${skippedCount}`);

  } catch (error) {
    console.error('Error updating notification statuses:', error);
  } finally {
    mongoose.disconnect();
    console.log('MongoDB disconnected');
  }
}

// Run the update function
updateAllNotificationStatuses();
