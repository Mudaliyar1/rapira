const mongoose = require('mongoose');
const dns = require('dns');
const User = require('../models/User');
const Venue = require('../models/Venue');
const Concert = require('../models/Concert');
const Ticket = require('../models/Ticket');
const VenueRequest = require('../models/VenueRequest');
const VenueEditRequest = require('../models/VenueEditRequest');
const VenueExternalBooking = require('../models/VenueExternalBooking');

function parseArgValue(flagName) {
  const flag = `--${flagName}`;
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function parseCsv(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
}

function configureDnsServers() {
  const cliDns = parseArgValue('dns');
  const envDns = process.env.DNS_SERVERS;
  const servers = parseCsv(cliDns || envDns);

  if (!servers.length) {
    return;
  }

  dns.setServers(servers);
  console.log(`Using custom DNS servers: ${servers.join(', ')}`);
}

function isSrvDnsError(error) {
  if (!error) return false;
  const message = String(error.message || '').toLowerCase();
  return error.code === 'ECONNREFUSED' && message.includes('querysrv');
}

async function connectToMongo() {
  const cliUri = parseArgValue('uri');
  const primaryUri = cliUri || process.env.MONGODB_URI || 'mongodb://localhost:27017/rapira';
  const directUri = process.env.MONGODB_URI_DIRECT;

  try {
    await mongoose.connect(primaryUri);
    console.log('Connected to MongoDB');
    return;
  } catch (error) {
    if (isSrvDnsError(error) && directUri) {
      console.warn('SRV DNS lookup failed for MONGODB_URI. Retrying with MONGODB_URI_DIRECT...');
      await mongoose.connect(directUri);
      console.log('Connected to MongoDB using MONGODB_URI_DIRECT');
      return;
    }

    if (isSrvDnsError(error)) {
      console.error('Mongo SRV DNS lookup failed.');
      console.error('Set a direct URI in MONGODB_URI_DIRECT or pass --uri <mongodb://...>');
      console.error('Example (PowerShell): $env:MONGODB_URI_DIRECT="mongodb://localhost:27017/rapira"; npm run cleanup:orphaned-venues:dry');
    }

    throw error;
  }
}

async function cleanupOrphanedVenues({ dryRun = false } = {}) {
  try {
    require('dotenv').config();
    configureDnsServers();

    await connectToMongo();

    const allVenues = await Venue.find({}, { _id: 1, name: 1, createdBy: 1 }).lean();
    console.log(`Total venues in database: ${allVenues.length}`);

    const ownerIds = [...new Set(
      allVenues
        .map(v => v.createdBy)
        .filter(Boolean)
        .map(id => String(id))
    )];

    const existingOwners = await User.find({ _id: { $in: ownerIds } }, { _id: 1 }).lean();
    const existingOwnerSet = new Set(existingOwners.map(u => String(u._id)));

    const orphanedVenues = allVenues.filter(v => !v.createdBy || !existingOwnerSet.has(String(v.createdBy)));

    if (!orphanedVenues.length) {
      console.log('No orphaned venues found.');
      process.exit(0);
    }

    console.log(`Found ${orphanedVenues.length} orphaned venues.`);

    let deletedVenues = 0;
    let deletedConcerts = 0;
    let deletedTickets = 0;
    let deletedVenueRequests = 0;
    let deletedVenueEditRequests = 0;
    let deletedVenueExternalBookings = 0;

    for (const venue of orphanedVenues) {
      console.log(`\nProcessing orphaned venue: ${venue.name} (${venue._id})`);

      const concertIds = await Concert.find({ venue: venue._id }).distinct('_id');
      const venueConcertCount = concertIds.length;

      const ticketCount = await Ticket.countDocuments({ concert: { $in: concertIds } });
      const bookingCount = await VenueExternalBooking.countDocuments({ venue: venue._id });
      const editRequestCount = await VenueEditRequest.countDocuments({ venue: venue._id });
      const requestCount = await VenueRequest.countDocuments({ createdVenue: venue._id });

      console.log(`  Concerts: ${venueConcertCount}`);
      console.log(`  Tickets: ${ticketCount}`);
      console.log(`  External bookings: ${bookingCount}`);
      console.log(`  Venue edit requests: ${editRequestCount}`);
      console.log(`  Venue requests: ${requestCount}`);

      if (dryRun) {
        continue;
      }

      if (concertIds.length) {
        const ticketDeleteResult = await Ticket.deleteMany({ concert: { $in: concertIds } });
        deletedTickets += ticketDeleteResult.deletedCount || 0;

        const concertDeleteResult = await Concert.deleteMany({ _id: { $in: concertIds } });
        deletedConcerts += concertDeleteResult.deletedCount || 0;
      }

      const bookingDeleteResult = await VenueExternalBooking.deleteMany({ venue: venue._id });
      deletedVenueExternalBookings += bookingDeleteResult.deletedCount || 0;

      const editDeleteResult = await VenueEditRequest.deleteMany({ venue: venue._id });
      deletedVenueEditRequests += editDeleteResult.deletedCount || 0;

      const requestDeleteResult = await VenueRequest.deleteMany({ createdVenue: venue._id });
      deletedVenueRequests += requestDeleteResult.deletedCount || 0;

      const venueDeleteResult = await Venue.deleteOne({ _id: venue._id });
      deletedVenues += venueDeleteResult.deletedCount || 0;
    }

    console.log('\nCleanup summary:');
    if (dryRun) {
      console.log('Dry run mode enabled. No records were deleted.');
      console.log(`Orphaned venues detected: ${orphanedVenues.length}`);
    } else {
      console.log(`Deleted venues: ${deletedVenues}`);
      console.log(`Deleted concerts: ${deletedConcerts}`);
      console.log(`Deleted tickets: ${deletedTickets}`);
      console.log(`Deleted venue external bookings: ${deletedVenueExternalBookings}`);
      console.log(`Deleted venue edit requests: ${deletedVenueEditRequests}`);
      console.log(`Deleted venue requests: ${deletedVenueRequests}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error during orphaned venue cleanup:', error);
    process.exit(1);
  }
}

const dryRun = process.argv.includes('--dry-run');
cleanupOrphanedVenues({ dryRun });
