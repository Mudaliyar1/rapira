const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const Artist = require('../models/Artist');
const Role = require('../models/Role');
const UserRole = require('../models/UserRole');
const { isLoggedIn } = require('../middleware/auth');
const mongoose = require('mongoose');

// Middleware to check if user can message a specific role
const canMessageRole = async (req, res, next) => {
  try {
    // Get the current user's artist profile if they are an artist
    let artist = null;

    if (req.session.user.role === 'artist') {
      artist = await Artist.findOne({ user: req.session.user.id });
    }

    // Get the recipient user
    const recipient = await User.findById(req.params.userId || req.body.recipientId);

    if (!recipient) {
      req.flash('error', 'Recipient not found');
      return res.redirect('/messages');
    }

    // Get the recipient's roles
    const recipientRoles = await UserRole.find({ user: recipient._id })
      .populate('role');

    // Check for orphaned UserRole records and log them
    const orphanedRoles = recipientRoles.filter(ur => !ur.role || !ur.role.name);
    if (orphanedRoles.length > 0) {
      console.warn(`Found ${orphanedRoles.length} orphaned UserRole records for user ${recipient._id}:`,
        orphanedRoles.map(ur => ur._id));
    }

    const roleNames = recipientRoles
      .filter(ur => ur.role && ur.role.name) // Filter out null roles
      .map(ur => ur.role.name);

    // Check if the current user can message this role
    let canMessage = false;

    // Debug information
    console.log('Checking messaging permissions:');
    console.log('Current user role:', req.session.user.role);
    console.log('Current user is artist:', artist ? 'Yes' : 'No');
    if (artist) console.log('Artist level:', artist.artistLevel);
    console.log('Recipient user role:', recipient.role);
    console.log('Recipient roles:', roleNames);

    // Admin can message anyone
    if (req.session.user.role === 'admin') {
      canMessage = true;
      console.log('Admin can message anyone: Permission granted');
    }
    // Intermediate and Established artists can message anyone with a role or any user/admin
    else if (artist && (artist.artistLevel === 'Intermediate' || artist.artistLevel === 'Established')) {
      canMessage = true; // Allow messaging anyone
      console.log('Intermediate/Established artist can message anyone: Permission granted');
    }
    // Beginner artists can only message Producers or users with Producer role
    else if (artist && artist.artistLevel === 'Beginner') {
      // Check if any of the recipient's roles is 'Producer' (case-insensitive)
      const hasProducerRole = roleNames.some(role => role.toLowerCase() === 'producer');
      canMessage = hasProducerRole;

      console.log('Beginner artist messaging user with roles:', roleNames);
      console.log('Has Producer role:', hasProducerRole ? 'Yes' : 'No');
      console.log('Permission:', canMessage ? 'Granted' : 'Denied');
    }
    // Users with roles can message artists, and regular users can message admins and other users
    else {
      // Check if the current user has any roles
      const currentUserRoles = await UserRole.find({ user: req.session.user.id }).populate('role');
      const hasRoles = currentUserRoles.length > 0;
      const currentUserRoleNames = currentUserRoles
        .filter(ur => ur.role && ur.role.name) // Filter out null roles
        .map(ur => ur.role.name);

      console.log('Current user has roles:', hasRoles ? 'Yes' : 'No');
      if (hasRoles) console.log('Current user roles:', currentUserRoleNames);

      if (hasRoles) {
        // Users with roles can message artists
        canMessage = true;
        console.log('User with roles can message anyone: Permission granted');
      } else {
        // Regular users without roles can only message admins and other users, not artists
        canMessage = recipient.role === 'admin' || recipient.role === 'user';
        console.log('Regular user messaging recipient with role:', recipient.role);
        console.log('Permission:', canMessage ? 'Granted' : 'Denied');
      }
    }

    if (!canMessage) {
      req.flash('error', 'You do not have permission to message this user');
      return res.redirect('/messages');
    }

    next();
  } catch (error) {
    console.error('Error in canMessageRole middleware:', error);
    req.flash('error', 'An error occurred while checking permissions');
    res.redirect('/messages');
  }
};

// Messages inbox
router.get('/', isLoggedIn, async (req, res) => {
  try {
    // Get conversations (grouped by the other user)
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: new mongoose.Types.ObjectId(req.session.user.id) },
            { receiver: new mongoose.Types.ObjectId(req.session.user.id) }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', new mongoose.Types.ObjectId(req.session.user.id)] },
              '$receiver',
              '$sender'
            ]
          },
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$receiver', new mongoose.Types.ObjectId(req.session.user.id)] },
                    { $eq: ['$isRead', false] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $sort: { 'lastMessage.createdAt': -1 }
      }
    ]);

    // Get user details for each conversation
    const userIds = conversations.map(c => c._id);
    const users = await User.find({ _id: { $in: userIds } });

    // Create a map of user details for easier access
    const userMap = {};
    users.forEach(user => {
      userMap[user._id.toString()] = user;
    });

    // Get artist details for users who are artists
    const artistUsers = users.filter(u => u.role === 'artist').map(u => u._id);
    const artists = await Artist.find({ user: { $in: artistUsers } });

    // Create a map of artist details for easier access
    const artistMap = {};
    artists.forEach(artist => {
      artistMap[artist.user.toString()] = artist;
    });

    // Get user roles
    const userRoles = await UserRole.find({ user: { $in: userIds } })
      .populate('role');

    // Create a map of user roles for easier access
    const userRoleMap = {};
    userRoles.forEach(ur => {
      // Skip if role is null
      if (!ur.role) return;

      if (!userRoleMap[ur.user.toString()]) {
        userRoleMap[ur.user.toString()] = [];
      }

      userRoleMap[ur.user.toString()].push(ur.role);
    });

    // Get current user's artist profile if they are an artist
    let currentUserArtist = null;

    if (req.session.user.role === 'artist') {
      currentUserArtist = await Artist.findOne({ user: req.session.user.id });
    }

    // Check if current user has any roles
    const currentUserRoles = await UserRole.find({ user: req.session.user.id }).populate('role');
    const hasRoles = currentUserRoles.length > 0;
    const currentUserRoleNames = currentUserRoles
      .filter(ur => ur.role) // Filter out null role references
      .map(ur => ur.role.name);

    res.render('messages/inbox', {
      title: 'Messages',
      conversations,
      userMap,
      artistMap,
      userRoleMap,
      currentUserArtist,
      hasRoles,
      userRoles: currentUserRoleNames,
      user: req.session.user // Add the current user from the session
    });
  } catch (error) {
    console.error('Error in messages inbox:', error);
    req.flash('error', 'An error occurred while loading messages');
    res.redirect('/');
  }
});

// View conversation
router.get('/conversation/:userId', isLoggedIn, canMessageRole, async (req, res) => {
  try {
    const otherUserId = req.params.userId;

    // Get the other user
    const otherUser = await User.findById(otherUserId);

    if (!otherUser) {
      req.flash('error', 'User not found');
      return res.redirect('/messages');
    }

    // Get messages between the two users
    const messages = await Message.find({
      $or: [
        { sender: req.session.user.id, receiver: otherUserId },
        { sender: otherUserId, receiver: req.session.user.id }
      ]
    }).sort({ createdAt: 1 });

    // Mark unread messages as read
    await Message.updateMany(
      {
        sender: otherUserId,
        receiver: req.session.user.id,
        isRead: false
      },
      { isRead: true }
    );

    // Get other user's artist profile if they are an artist
    let otherUserArtist = null;

    if (otherUser.role === 'artist') {
      otherUserArtist = await Artist.findOne({ user: otherUserId });
    }

    // Get other user's roles
    const otherUserRoles = await UserRole.find({ user: otherUserId })
      .populate('role');

    // Get current user's artist profile if they are an artist
    let currentUserArtist = null;

    if (req.session.user.role === 'artist') {
      currentUserArtist = await Artist.findOne({ user: req.session.user.id });
    }

    // Check if current user has any roles
    const currentUserRoles = await UserRole.find({ user: req.session.user.id }).populate('role');
    const hasRoles = currentUserRoles.length > 0;
    const currentUserRoleNames = currentUserRoles
      .filter(ur => ur.role) // Filter out null role references
      .map(ur => ur.role.name);

    res.render('messages/conversation', {
      title: `Conversation with ${otherUser.name}`,
      otherUser,
      otherUserArtist,
      otherUserRoles,
      messages,
      currentUserArtist,
      hasRoles,
      userRoles: currentUserRoleNames,
      user: req.session.user // Add the current user from the session
    });
  } catch (error) {
    console.error('Error in view conversation:', error);
    req.flash('error', 'An error occurred while loading the conversation');
    res.redirect('/messages');
  }
});

// Send message
router.post('/send', isLoggedIn, async (req, res) => {
  try {
    const { recipientId, content } = req.body;

    // Validate input
    if (!recipientId || !content) {
      req.flash('error', 'Recipient and message content are required');
      return res.redirect('/messages');
    }

    // Check if recipient exists
    const recipient = await User.findById(recipientId);

    if (!recipient) {
      req.flash('error', 'Recipient not found');
      return res.redirect('/messages');
    }

    // Get the current user's artist profile if they are an artist
    let artist = null;

    if (req.session.user.role === 'artist') {
      artist = await Artist.findOne({ user: req.session.user.id });
    }

    // Get the recipient's roles
    const recipientRoles = await UserRole.find({ user: recipientId })
      .populate('role');

    const roleNames = recipientRoles
      .filter(ur => ur.role) // Filter out null role references
      .map(ur => ur.role.name);

    // Check if the current user can message this role
    let canMessage = false;

    // Debug information
    console.log('Checking messaging permissions (send route):');
    console.log('Current user role:', req.session.user.role);
    console.log('Current user is artist:', artist ? 'Yes' : 'No');
    if (artist) console.log('Artist level:', artist.artistLevel);
    console.log('Recipient user role:', recipient.role);
    console.log('Recipient roles:', roleNames);

    // Admin can message anyone
    if (req.session.user.role === 'admin') {
      canMessage = true;
      console.log('Admin can message anyone: Permission granted');
    }
    // Intermediate and Established artists can message anyone with a role or any user/admin
    else if (artist && (artist.artistLevel === 'Intermediate' || artist.artistLevel === 'Established')) {
      canMessage = true; // Allow messaging anyone
      console.log('Intermediate/Established artist can message anyone: Permission granted');
    }
    // Beginner artists can only message Producers or users with Producer role
    else if (artist && artist.artistLevel === 'Beginner') {
      // Check if any of the recipient's roles is 'Producer' (case-insensitive)
      const hasProducerRole = roleNames.some(role => role.toLowerCase() === 'producer');
      canMessage = hasProducerRole;

      console.log('Beginner artist messaging user with roles:', roleNames);
      console.log('Has Producer role:', hasProducerRole ? 'Yes' : 'No');
      console.log('Permission:', canMessage ? 'Granted' : 'Denied');
    }
    // Users with roles can message artists, and regular users can message admins and other users
    else {
      // Check if the current user has any roles
      const currentUserRoles = await UserRole.find({ user: req.session.user.id }).populate('role');
      const hasRoles = currentUserRoles.length > 0;
      const currentUserRoleNames = currentUserRoles
        .filter(ur => ur.role) // Filter out null role references
        .map(ur => ur.role.name);

      console.log('Current user has roles:', hasRoles ? 'Yes' : 'No');
      if (hasRoles) console.log('Current user roles:', currentUserRoleNames);

      if (hasRoles) {
        // Users with roles can message artists
        canMessage = true;
        console.log('User with roles can message anyone: Permission granted');
      } else {
        // Regular users without roles can only message admins and other users, not artists
        canMessage = recipient.role === 'admin' || recipient.role === 'user';
        console.log('Regular user messaging recipient with role:', recipient.role);
        console.log('Permission:', canMessage ? 'Granted' : 'Denied');
      }
    }

    if (!canMessage) {
      req.flash('error', 'You do not have permission to message this user');
      return res.redirect('/messages');
    }

    // Create new message
    const newMessage = new Message({
      sender: req.session.user.id,
      receiver: recipientId,
      content
    });

    await newMessage.save();

    res.redirect(`/messages/conversation/${recipientId}`);
  } catch (error) {
    console.error('Error in send message:', error);
    req.flash('error', 'An error occurred while sending the message');
    res.redirect('/messages');
  }
});

// Find users to message
router.get('/find', isLoggedIn, async (req, res) => {
  try {
    // Get filter parameters
    const { role, state } = req.query;

    // Get current user's artist profile if they are an artist
    let currentUserArtist = null;

    if (req.session.user.role === 'artist') {
      currentUserArtist = await Artist.findOne({ user: req.session.user.id });
    }

    // Check if current user has any roles
    const currentUserRoles = await UserRole.find({ user: req.session.user.id }).populate('role');
    const hasRoles = currentUserRoles.length > 0;
    const currentUserRoleNames = currentUserRoles
      .filter(ur => ur.role) // Filter out null role references
      .map(ur => ur.role.name);

    // Get all roles
    const roles = await Role.find().sort({ name: 1 });

    // Prepare to find users with roles

    // If role is specified, filter by role
    let roleFilter = null;

    if (role) {
      const selectedRole = await Role.findById(role);

      if (selectedRole) {
        roleFilter = selectedRole;
      }
    }

    // Get users with roles
    let usersWithRoles = [];

    if (roleFilter) {
      // Get users with the selected role
      const userRoles = await UserRole.find({ role: roleFilter._id })
        .populate('user');

      usersWithRoles = userRoles.map(ur => ur.user);
    } else {
      // Get all users with any role
      const userRoles = await UserRole.find()
        .populate('user')
        .populate('role');

      // Group by user
      const userRoleMap = {};

      userRoles.forEach(ur => {
        // Skip entries with null user or role references
        if (!ur.user || !ur.role) {
          console.log('Found user role with null user or role reference:', ur);
          return;
        }

        if (!userRoleMap[ur.user._id]) {
          userRoleMap[ur.user._id] = {
            user: ur.user,
            roles: []
          };
        }

        userRoleMap[ur.user._id].roles.push(ur.role);
      });

      usersWithRoles = Object.values(userRoleMap).map(ur => ur.user);
    }

    // Filter out the current user
    usersWithRoles = usersWithRoles.filter(u => u._id.toString() !== req.session.user.id);

    // Get artist details for users who are artists
    const artistUsers = usersWithRoles.filter(u => u.role === 'artist').map(u => u._id);
    const artists = await Artist.find({ user: { $in: artistUsers } });

    // Create a map of artist details for easier access
    const artistMap = {};
    artists.forEach(artist => {
      artistMap[artist.user.toString()] = artist;
    });

    // Filter by state if specified
    if (state) {
      // Filter artists by state
      const artistsInState = artists.filter(a => a.state === state);
      const artistUserIds = artistsInState.map(a => a.user.toString());

      // Filter users by state or by artist state
      usersWithRoles = usersWithRoles.filter(u => {
        if (u.role === 'artist') {
          return artistUserIds.includes(u._id.toString());
        } else {
          return u.city && u.city.includes(state);
        }
      });
    }

    // Get user roles for display
    const userIds = usersWithRoles.map(u => u._id);
    const userRoles = await UserRole.find({ user: { $in: userIds } })
      .populate('role');

    // Create a map of user roles for easier access
    const userRoleMap = {};
    userRoles.forEach(ur => {
      // Skip entries with null role references
      if (!ur.role) {
        console.log('Found user role with null role reference:', ur);
        return;
      }

      if (!userRoleMap[ur.user.toString()]) {
        userRoleMap[ur.user.toString()] = [];
      }

      userRoleMap[ur.user.toString()].push(ur.role);
    });

    // Get list of states from artists
    const states = [...new Set(artists.map(a => a.state).filter(s => s))];

    res.render('messages/find', {
      title: 'Find Users',
      users: usersWithRoles,
      artistMap,
      userRoleMap,
      roles,
      states,
      selectedRole: roleFilter,
      selectedState: state,
      currentUserArtist,
      hasRoles,
      userRoles: currentUserRoleNames,
      user: req.session.user // Add the current user from the session
    });
  } catch (error) {
    console.error('Error in find users:', error);
    req.flash('error', 'An error occurred while searching for users');
    res.redirect('/messages');
  }
});

module.exports = router;
