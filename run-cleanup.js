// Load environment variables
require('dotenv').config();

// Run the cleanup script
require('./scripts/cleanup-orphaned-userroles');
