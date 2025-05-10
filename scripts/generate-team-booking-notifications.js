require('dotenv').config();
const mongoose = require('mongoose');
const TeamBookingRequest = require('../models/TeamBookingRequest');
const TeamRequirementRole = require('../models/TeamRequirementRole');
const Notification = require('../models/Notification');
const { createTeamBookingNotification } = require('../utils/notificationService');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('MongoDB Connected Successfully');
  generateNotifications();
})
.catch(err => {
  console.error('MongoDB Connection Error:', err);
  process.exit(1);
});

async function generateNotifications() {
  try {
    console.log('Starting to generate notifications for pending team booking requests...');

    // Find all pending team booking requests
    const pendingRequests = await TeamBookingRequest.find({
      status: 'pending',
      // Only include requests that are either not part of a bulk request (bulkRequestId is null)
      // or are the main entry for a bulk request (isBulkRequest is true)
      $or: [
        { bulkRequestId: null },
        { isBulkRequest: true }
      ]
    }).populate('role');

    console.log(`Found ${pendingRequests.length} pending team booking requests`);

    if (pendingRequests.length === 0) {
      console.log('No pending requests found. Exiting...');
      process.exit(0);
    }

    // Check if notifications already exist for these requests
    const requestIds = pendingRequests.map(req => req._id);
    const existingNotifications = await Notification.find({
      requestId: { $in: requestIds },
      modelRef: 'TeamBookingRequest'
    });

    console.log(`Found ${existingNotifications.length} existing notifications`);

    // Create a map of existing notifications by requestId for quick lookup
    const existingNotificationMap = {};
    existingNotifications.forEach(notification => {
      existingNotificationMap[notification.requestId.toString()] = notification;
    });

    // Generate notifications for requests that don't have one
    let createdCount = 0;
    for (const request of pendingRequests) {
      const requestId = request._id.toString();

      if (!existingNotificationMap[requestId]) {
        await createTeamBookingNotification(request);
        createdCount++;
      }
    }

    console.log(`Created ${createdCount} new notifications for pending team booking requests`);
    console.log('Notification generation completed successfully');

    process.exit(0);
  } catch (error) {
    console.error('Error generating notifications:', error);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('Mongoose connection closed due to application termination');
  process.exit(0);
});
