const mongoose = require('mongoose');
const Concert = require('./models/Concert');
const Venue = require('./models/Venue');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rapira', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function migrateVenueData() {
  try {
    console.log('Starting venue data migration...');

    // Get all concerts
    const concerts = await Concert.find({});
    console.log(`Found ${concerts.length} concerts to check`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const concert of concerts) {
      try {
        // Check if venue is already an ObjectId (meaning it's already properly referenced)
        if (mongoose.Types.ObjectId.isValid(concert.venue) && concert.venue.toString().length === 24) {
          // Check if the venue actually exists
          const venueExists = await Venue.findById(concert.venue);
          if (venueExists) {
            console.log(`Concert "${concert.title}" already has valid venue reference`);
            skippedCount++;
            continue;
          }
        }

        // If venue is a string, try to find or create a venue
        let venueName = concert.venue;
        if (typeof concert.venue === 'object' && concert.venue.toString) {
          venueName = concert.venue.toString();
        }

        console.log(`Migrating concert "${concert.title}" with venue "${venueName}"`);

        // Try to find existing venue by name and city
        let venue = await Venue.findOne({
          name: new RegExp(`^${venueName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
          city: new RegExp(`^${concert.city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
        });

        if (!venue) {
          // Create new venue
          venue = new Venue({
            name: venueName,
            address: `${venueName}, ${concert.city}`,
            city: concert.city,
            state: 'Unknown', // Default state
            pincode: '000000', // Default pincode
            venueType: 'Other',
            isActive: true,
            isVerified: false,
            createdBy: new mongoose.Types.ObjectId('000000000000000000000000') // Default admin ID
          });
          
          await venue.save();
          console.log(`Created new venue: ${venue.name} in ${venue.city}`);
        }

        // Update concert to reference the venue
        await Concert.findByIdAndUpdate(concert._id, {
          venue: venue._id,
          city: venue.city // Ensure city matches venue
        });

        console.log(`Updated concert "${concert.title}" to reference venue "${venue.name}"`);
        migratedCount++;

      } catch (error) {
        console.error(`Error migrating concert "${concert.title}":`, error.message);
      }
    }

    console.log(`\nMigration completed:`);
    console.log(`- Migrated: ${migratedCount} concerts`);
    console.log(`- Skipped: ${skippedCount} concerts`);
    console.log(`- Total processed: ${migratedCount + skippedCount} concerts`);

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run migration
migrateVenueData();
