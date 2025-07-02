const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { isAdmin } = require('../middleware/auth');

// Get the sessions collection directly from MongoDB
const getSessionsCollection = async () => {
  try {
    // Get the sessions collection from the MongoDB connection
    const sessionsCollection = mongoose.connection.db.collection('sessions');
    return sessionsCollection;
  } catch (error) {
    console.error('Error getting sessions collection:', error);
    throw error;
  }
};

// Session management dashboard
router.get('/', isAdmin, async (req, res) => {
  try {
    const sessionsCollection = await getSessionsCollection();

    // Count total sessions
    const totalSessions = await sessionsCollection.countDocuments();

    // Get some sample sessions for display
    const recentSessions = await sessionsCollection.find({})
      .sort({ _id: -1 })
      .limit(10)
      .toArray();

    // Format sessions for display
    const formattedSessions = recentSessions.map(session => {
      try {
        // Sessions are stored as JSON strings
        const sessionData = JSON.parse(session.session);

        // Get created timestamp safely
        let created = 'Unknown';
        try {
          // Check if _id is a valid MongoDB ObjectId
          if (session._id && typeof session._id === 'object' && session._id.toString().match(/^[0-9a-fA-F]{24}$/)) {
            created = session._id.getTimestamp().toLocaleString();
          } else if (session.createdAt) {
            // Use createdAt if available
            created = new Date(session.createdAt).toLocaleString();
          } else {
            // Extract timestamp from session ID if it's a string with timestamp format
            const timestampMatch = session._id.toString().match(/^[0-9A-Za-z]{8}(\d{10})/);
            if (timestampMatch && timestampMatch[1]) {
              created = new Date(parseInt(timestampMatch[1]) * 1000).toLocaleString();
            }
          }
        } catch (timeError) {
          console.error('Error getting timestamp:', timeError);
          created = 'Unknown';
        }

        return {
          id: session._id.toString(),
          user: sessionData.user ? {
            id: sessionData.user.id,
            name: sessionData.user.name,
            email: sessionData.user.email,
            role: sessionData.user.role
          } : 'No user data',
          expires: new Date(session.expires).toLocaleString(),
          created: created
        };
      } catch (e) {
        console.error('Error parsing session:', e);

        // Get created timestamp safely for error case
        let created = 'Unknown';
        try {
          if (session._id && typeof session._id === 'object' && session._id.toString().match(/^[0-9a-fA-F]{24}$/)) {
            created = session._id.getTimestamp().toLocaleString();
          }
        } catch (timeError) {
          // Ignore this error
        }

        return {
          id: session._id.toString(),
          error: 'Could not parse session data: ' + e.message,
          expires: session.expires ? new Date(session.expires).toLocaleString() : 'Unknown',
          created: created
        };
      }
    });

    res.render('admin/sessions/index', {
      title: 'Session Management',
      totalSessions,
      sessions: formattedSessions,
      layout: 'layouts/admin',
      currentPath: req.path // Add the current path for sidebar highlighting
    });
  } catch (error) {
    console.error('Error in session management dashboard:', error);
    req.flash('error', 'Failed to load session data');
    res.redirect('/admin');
  }
});

// Clear all sessions
router.post('/clear-all', isAdmin, async (req, res) => {
  try {
    const sessionsCollection = await getSessionsCollection();

    // Get current admin's session ID to preserve it
    const currentSessionId = req.sessionID;

    console.log(`Preserving current admin session: ${currentSessionId}`);

    // Delete all sessions except the current admin's session
    // Note: We need to handle both string and ObjectId session IDs
    let result;

    try {
      // First try with string comparison
      result = await sessionsCollection.deleteMany({
        _id: { $ne: currentSessionId }
      });

      console.log(`Cleared ${result.deletedCount} sessions using string comparison`);
    } catch (deleteError) {
      console.error('Error with string comparison delete:', deleteError);

      // If that fails, try with ObjectId (if the session ID is a valid ObjectId)
      if (mongoose.Types.ObjectId.isValid(currentSessionId)) {
        const objectIdSessionId = new mongoose.Types.ObjectId(currentSessionId);
        result = await sessionsCollection.deleteMany({
          _id: { $ne: objectIdSessionId }
        });
        console.log(`Cleared ${result.deletedCount} sessions using ObjectId comparison`);
      } else {
        // If neither works, we'll have to manually filter
        const allSessions = await sessionsCollection.find({}).toArray();
        let deletedCount = 0;

        for (const session of allSessions) {
          if (session._id.toString() !== currentSessionId) {
            await sessionsCollection.deleteOne({ _id: session._id });
            deletedCount++;
          }
        }

        result = { deletedCount };
        console.log(`Cleared ${deletedCount} sessions using manual filtering`);
      }
    }

    req.flash('success', `Successfully cleared ${result.deletedCount} user sessions`);
    res.redirect('/admin/sessions');
  } catch (error) {
    console.error('Error clearing sessions:', error);
    req.flash('error', 'Failed to clear sessions: ' + error.message);
    res.redirect('/admin/sessions');
  }
});

// Clear inactive sessions (expired)
router.post('/clear-expired', isAdmin, async (req, res) => {
  try {
    const sessionsCollection = await getSessionsCollection();

    // Delete all expired sessions
    const result = await sessionsCollection.deleteMany({
      expires: { $lt: new Date() }
    });

    console.log(`Cleared ${result.deletedCount} expired sessions`);

    req.flash('success', `Successfully cleared ${result.deletedCount} expired sessions`);
    res.redirect('/admin/sessions');
  } catch (error) {
    console.error('Error clearing expired sessions:', error);
    req.flash('error', 'Failed to clear expired sessions');
    res.redirect('/admin/sessions');
  }
});

// Clear sessions by user role
router.post('/clear-by-role', isAdmin, async (req, res) => {
  try {
    const { role } = req.body;

    if (!role) {
      req.flash('error', 'Role is required');
      return res.redirect('/admin/sessions');
    }

    const sessionsCollection = await getSessionsCollection();
    const currentSessionId = req.sessionID;

    console.log(`Clearing sessions with role ${role}, preserving admin session: ${currentSessionId}`);

    // Find sessions with the specified role and delete them
    const sessions = await sessionsCollection.find({}).toArray();
    let deletedCount = 0;
    let errorCount = 0;

    for (const session of sessions) {
      try {
        // Skip the current admin's session - compare as strings to be safe
        if (session._id.toString() === currentSessionId) {
          console.log('Skipping current admin session');
          continue;
        }

        // Try to parse the session data
        let sessionData;
        try {
          sessionData = JSON.parse(session.session);
        } catch (parseError) {
          console.error(`Error parsing session ${session._id}:`, parseError.message);
          errorCount++;
          continue;
        }

        // Check if this session matches the role we're looking for
        if (sessionData.user && sessionData.user.role === role) {
          try {
            await sessionsCollection.deleteOne({ _id: session._id });
            deletedCount++;
          } catch (deleteError) {
            console.error(`Error deleting session ${session._id}:`, deleteError.message);
            errorCount++;
          }
        }
      } catch (e) {
        console.error('Error processing session:', e.message);
        errorCount++;
      }
    }

    console.log(`Cleared ${deletedCount} sessions with role ${role}. Errors: ${errorCount}`);

    let message = `Successfully cleared ${deletedCount} sessions with role ${role}`;
    if (errorCount > 0) {
      message += ` (${errorCount} errors occurred)`;
    }

    req.flash('success', message);
    res.redirect('/admin/sessions');
  } catch (error) {
    console.error('Error clearing sessions by role:', error);
    req.flash('error', 'Failed to clear sessions by role: ' + error.message);
    res.redirect('/admin/sessions');
  }
});

// Force cookie refresh - clear all sessions and invalidate cookies
router.post('/force-cookie-refresh', isAdmin, async (req, res) => {
  try {
    const sessionsCollection = await getSessionsCollection();
    const currentSessionId = req.sessionID;

    console.log('Force cookie refresh initiated by admin:', req.session.user.email);
    console.log('Preserving current admin session:', currentSessionId);

    // Clear all sessions except current admin session
    const result = await sessionsCollection.deleteMany({
      _id: { $ne: currentSessionId }
    });

    console.log(`Force cookie refresh: Cleared ${result.deletedCount} user sessions`);

    // Generate a new session secret for future sessions
    const newSecret = Math.random().toString(36).substring(2, 15) +
                     Math.random().toString(36).substring(2, 15) +
                     Date.now().toString(36);

    // Store the new secret in memory (this will force all future sessions to be invalid)
    process.env.SESSION_SECRET = newSecret;

    // Log the action
    console.log('Cookie refresh completed. All user sessions cleared and new session secret generated.');

    res.json({
      success: true,
      message: `Successfully cleared ${result.deletedCount} user sessions and refreshed cookie settings`,
      clearedSessions: result.deletedCount,
      newSecret: newSecret.substring(0, 10) + '...' // Show partial secret for confirmation
    });

  } catch (error) {
    console.error('Error in force cookie refresh:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh cookies: ' + error.message
    });
  }
});

module.exports = router;
