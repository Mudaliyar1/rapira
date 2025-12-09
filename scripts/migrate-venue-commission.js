/**
 * Migration script to apply admin default commission to all existing venues
 * Run with: node scripts/migrate-venue-commission.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Venue = require('../models/Venue');
const WebsiteSettings = require('../models/WebsiteSettings');

async function migrateVenueCommission() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rapira');
    console.log('✅ Connected to MongoDB');

    // Get admin default commission from website settings
    const settings = await WebsiteSettings.getSettings();
    const defaultCommission = settings.venueSettings?.defaultCommissionPercentage || 10;
    const allowUserCommissionEdit = settings.venueSettings?.allowUserCommissionEdit || false;

    console.log(`\n📊 Migration Settings:`);
    console.log(`   Default Commission: ${defaultCommission}%`);
    console.log(`   Allow User Edit: ${allowUserCommissionEdit}`);

    // Find all venues
    const venues = await Venue.find({});
    console.log(`\n🏢 Found ${venues.length} venues to update`);

    let updatedCount = 0;
    let errorCount = 0;

    for (let venue of venues) {
      try {
        let needsUpdate = false;

        // Update pricing structure if it doesn't exist
        if (!venue.pricing) {
          venue.pricing = {};
          needsUpdate = true;
        }

        // Update hourly rates with commission percentages
        if (venue.pricing.hourlyRates && Array.isArray(venue.pricing.hourlyRates)) {
          for (let rate of venue.pricing.hourlyRates) {
            // If commission is missing or should be updated
            if (!rate.commissionPercentage || rate.commissionPercentage === undefined) {
              rate.commissionPercentage = defaultCommission;
              rate.commissionAmount = (rate.rate * defaultCommission) / 100;
              needsUpdate = true;
              console.log(`   ✏️  Updated hour ${rate.hours}: ${rate.rate}₹ with ${defaultCommission}% commission`);
            }
          }
        }

        if (needsUpdate) {
          await venue.save();
          updatedCount++;
          console.log(`✅ Updated venue: ${venue.name}`);
        } else {
          console.log(`⏭️  Venue already has commissions: ${venue.name}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Error updating venue ${venue.name}:`, error.message);
      }
    }

    console.log(`\n📈 Migration Summary:`);
    console.log(`   Total venues: ${venues.length}`);
    console.log(`   Successfully updated: ${updatedCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Commission applied: ${defaultCommission}%`);

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run migration
migrateVenueCommission();
