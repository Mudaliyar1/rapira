const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const Artist = require('../models/Artist');
const Role = require('../models/Role');
const UserRole = require('../models/UserRole');
const ProducerApplication = require('../models/ProducerApplication');
const { isLoggedIn } = require('../middleware/auth');
const mongoose = require('mongoose');

const getDashboardMessagingContext = async (sessionUser) => {
  if (!sessionUser || !sessionUser.id) return null;

  if (sessionUser.role === 'artist') {
    const artist = await Artist.findOne({ user: sessionUser.id }).populate('user');
    if (artist) {
      return {
        dashboardType: 'artist',
        artist,
        producerUser: null
      };
    }
  }

  const userRoles = await UserRole.find({ user: sessionUser.id }).populate('role');
  const hasProducerRole = userRoles.some(entry => entry.role && entry.role.name && entry.role.name.toLowerCase() === 'producer');

  if (hasProducerRole) {
    return {
      dashboardType: 'producer',
      artist: null,
      producerUser: sessionUser
    };
  }

  return null;
};

// Middleware to check if user can message a specific role
const canMessageRole = async (req, res, next) => {
  try {
    const User = require('../models/User');

    // Check if current user is blocked
    const currentUser = await User.findById(req.session.user.id);
    if (currentUser && currentUser.isBlocked) {
      req.flash('error', 'Your account has been blocked. You cannot send messages.');
      return res.redirect('/messages');
    }

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

// Middleware to check if user is blocked
const checkBlocked = async (req, res, next) => {
  try {
    const currentUser = await User.findById(req.session.user.id);
    if (currentUser && currentUser.isBlocked) {
      req.flash('error', 'Your account has been blocked. You cannot access this feature.');
      return res.redirect('/producer-dashboard/unblock-request');
    }
    next();
  } catch (error) {
    console.error('Error in checkBlocked middleware:', error);
    next();
  }
};

// Messages inbox
router.get('/', isLoggedIn, async (req, res) => {
  try {
    const User = require('../models/User');

    // Check if current user is blocked
    const currentUser = await User.findById(req.session.user.id);
    if (currentUser && currentUser.isBlocked) {
      req.flash('error', 'Your account has been blocked. You cannot access messages.');
      return res.redirect('/producer-dashboard/unblock-request');
    }

    await Message.updateMany(
      {
        receiver: req.session.user.id,
        deliveredAt: null
      },
      { deliveredAt: new Date() }
    );

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

    const dashboardContext = await getDashboardMessagingContext(req.session.user);
    const viewName = dashboardContext ? 'messages/inbox-dashboard' : 'messages/inbox';

    res.render(viewName, {
      layout: dashboardContext ? false : undefined,
      title: 'Messages',
      conversations,
      userMap,
      artistMap,
      userRoleMap,
      currentUserArtist,
      hasRoles,
      userRoles: currentUserRoleNames,
      user: req.session.user,
      dashboardType: dashboardContext ? dashboardContext.dashboardType : null,
      artist: dashboardContext ? dashboardContext.artist : null,
      producerUser: dashboardContext ? dashboardContext.producerUser : null,
      currentPath: '/messages'
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

    await Message.updateMany(
      {
        sender: otherUserId,
        receiver: req.session.user.id,
        deliveredAt: null
      },
      { deliveredAt: new Date() }
    );

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
      { isRead: true, readAt: new Date(), deliveredAt: new Date() }
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

    const dashboardContext = await getDashboardMessagingContext(req.session.user);
    const viewName = dashboardContext ? 'messages/conversation-dashboard' : 'messages/conversation';

    res.render(viewName, {
      layout: dashboardContext ? false : undefined,
      title: `Conversation with ${otherUser.name}`,
      otherUser,
      otherUserArtist,
      otherUserRoles,
      messages,
      currentUserArtist,
      hasRoles,
      userRoles: currentUserRoleNames,
      user: req.session.user,
      dashboardType: dashboardContext ? dashboardContext.dashboardType : null,
      artist: dashboardContext ? dashboardContext.artist : null,
      producerUser: dashboardContext ? dashboardContext.producerUser : null,
      currentPath: '/messages'
    });
  } catch (error) {
    console.error('Error in view conversation:', error);
    req.flash('error', 'An error occurred while loading the conversation');
    res.redirect('/messages');
  }
});

// Send message
router.post('/send', isLoggedIn, checkBlocked, async (req, res) => {
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
      content,
      deliveredAt: null,
      readAt: null
    });

    await newMessage.save();

    res.redirect(`/messages/conversation/${recipientId}`);
  } catch (error) {
    console.error('Error in send message:', error);
    req.flash('error', 'An error occurred while sending the message');
    res.redirect('/messages');
  }
});

router.get('/api/conversation/:userId', isLoggedIn, canMessageRole, async (req, res) => {
  try {
    const otherUserId = req.params.userId;

    await Message.updateMany(
      {
        sender: otherUserId,
        receiver: req.session.user.id,
        deliveredAt: null
      },
      { deliveredAt: new Date() }
    );

    await Message.updateMany(
      {
        sender: otherUserId,
        receiver: req.session.user.id,
        isRead: false
      },
      { isRead: true, readAt: new Date(), deliveredAt: new Date() }
    );

    let messages = await Message.find({
      $or: [
        { sender: req.session.user.id, receiver: otherUserId },
        { sender: otherUserId, receiver: req.session.user.id }
      ]
    }).sort({ createdAt: 1 }).lean();

    // Filter out deleted messages based on user
    messages = messages.map(msg => {
      const deletedFor = msg.deletedFor || [];
      if (msg.isDeleted || deletedFor.some(id => id.toString() === req.session.user.id)) {
        return {
          ...msg,
          content: null,
          isDeleted: true,
          isEdited: false
        };
      }
      return msg;
    });

    res.json({ success: true, messages });
  } catch (error) {
    console.error('Conversation API error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch conversation' });
  }
});

router.post('/api/send', isLoggedIn, canMessageRole, async (req, res) => {
  try {
    const { recipientId, content } = req.body;

    if (!recipientId || !content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Recipient and content are required' });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ success: false, message: 'Recipient not found' });
    }

    const newMessage = new Message({
      sender: req.session.user.id,
      receiver: recipientId,
      content: content.trim(),
      deliveredAt: null,
      readAt: null
    });

    await newMessage.save();

    res.json({ success: true, message: newMessage });
  } catch (error) {
    console.error('Send API error:', error);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
});

router.post('/api/mark-read/:userId', isLoggedIn, checkBlocked, async (req, res) => {
  try {
    await Message.updateMany(
      {
        sender: req.params.userId,
        receiver: req.session.user.id,
        isRead: false
      },
      { isRead: true, readAt: new Date(), deliveredAt: new Date() }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Mark read API error:', error);
    res.status(500).json({ success: false });
  }
});

// Edit message
router.put('/api/edit/:messageId', isLoggedIn, checkBlocked, async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Content cannot be empty' });
    }

    const message = await Message.findById(req.params.messageId);

    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // Only sender can edit their message
    if (message.sender.toString() !== req.session.user.id) {
      return res.status(403).json({ success: false, message: 'You can only edit your own messages' });
    }

    // Cannot edit deleted messages
    if (message.isDeleted) {
      return res.status(400).json({ success: false, message: 'Cannot edit deleted messages' });
    }

    // Store original content if not already stored
    if (!message.originalContent) {
      message.originalContent = message.content;
    }

    message.content = content.trim();
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    res.json({ success: true, message });
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({ success: false, message: 'Failed to edit message' });
  }
});

// Delete message
router.delete('/api/delete/:messageId', isLoggedIn, checkBlocked, async (req, res) => {
  try {
    const { deleteFor } = req.body; // 'me' or 'everyone'

    const message = await Message.findById(req.params.messageId);

    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // Check permissions
    const isSender = message.sender.toString() === req.session.user.id;
    const isReceiver = message.receiver.toString() === req.session.user.id;

    if (!isSender && !isReceiver) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (deleteFor === 'everyone' && !isSender) {
      return res.status(403).json({ success: false, message: 'Only sender can delete for everyone' });
    }

    if (deleteFor === 'everyone') {
      // Delete for everyone
      message.isDeleted = true;
      message.deletedAt = new Date();
      message.deletedFor = [message.sender, message.receiver];
    } else {
      // Delete for me only
      if (!message.deletedFor.includes(req.session.user.id)) {
        message.deletedFor.push(req.session.user.id);
      }
    }

    await message.save();

    res.json({ success: true, message });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete message' });
  }
});

// Bulk delete messages
router.post('/api/bulk-delete', isLoggedIn, checkBlocked, async (req, res) => {
  try {
    const { messageIds, deleteFor } = req.body; // deleteFor: 'me' or 'everyone'

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No messages selected' });
    }

    const messages = await Message.find({ _id: { $in: messageIds } });

    // Check permissions
    for (const msg of messages) {
      const isSender = msg.sender.toString() === req.session.user.id;
      const isReceiver = msg.receiver.toString() === req.session.user.id;

      if (!isSender && !isReceiver) {
        return res.status(403).json({ success: false, message: 'Unauthorized to delete some messages' });
      }

      if (deleteFor === 'everyone' && !isSender) {
        return res.status(403).json({ success: false, message: 'Only sender can delete messages for everyone' });
      }
    }

    // Update all messages
    if (deleteFor === 'everyone') {
      await Message.updateMany(
        { _id: { $in: messageIds } },
        {
          isDeleted: true,
          deletedAt: new Date(),
          deletedFor: [messages[0].sender, messages[0].receiver]
        }
      );
    } else {
      for (const msg of messages) {
        if (!msg.deletedFor.includes(req.session.user.id)) {
          msg.deletedFor.push(req.session.user.id);
        }
        await msg.save();
      }
    }

    res.json({ success: true, deletedCount: messages.length });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete messages' });
  }
});

// Find users to message
router.get('/find', isLoggedIn, checkBlocked, async (req, res) => {
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

    // Get all roles for filter dropdown (Only Producers and Artists)
    const roles = await Role.find({ name: { $regex: /^(producer|artist)$/i } }).sort({ name: 1 });

    // Ensure Artist is in the roles list for the filter
    const hasArtistRole = roles.some(r => r.name.toLowerCase() === 'artist');
    if (!hasArtistRole) {
      roles.push({ _id: 'artist', name: 'Artist' });
    }

    // Build users list based on current user type
    let usersToShow = [];
    let artistMap = {};

    // Current user is ARTIST or PRODUCER - show all producers and other artists
    const producerRole = await Role.findOne({ name: { $regex: '^producer$', $options: 'i' } });
    let producerUsers = [];

    if (producerRole) {
      const userRoles = await UserRole.find({ role: producerRole._id }).populate('user');
      producerUsers = userRoles
        .filter(ur => ur.user && ur.user._id.toString() !== req.session.user.id)
        .map(ur => ur.user);
    }

    const allArtists = await Artist.find().populate('user');
    const otherArtistUsers = allArtists
      .filter(a => a.user && a.user._id.toString() !== req.session.user.id)
      .map(a => a.user);

    // Create artist map
    allArtists.forEach(artist => {
      if (artist.user && artist.user._id) {
        artistMap[artist.user._id.toString()] = artist;
      }
    });

    // Filter out duplicates based on _id
    const combinedUsers = [...producerUsers, ...otherArtistUsers];
    const uniqueUsersMap = new Map();
    combinedUsers.forEach(u => {
      if (u && u._id && !uniqueUsersMap.has(u._id.toString())) {
        uniqueUsersMap.set(u._id.toString(), u);
      }
    });

    usersToShow = Array.from(uniqueUsersMap.values());

    // Apply role filter if specified
    if (role === 'artist') {
      usersToShow = usersToShow.filter(u => u.role === 'artist');
    } else if (role) {
      const selectedRole = await Role.findById(role);
      if (selectedRole) {
        const userRolesFiltered = await UserRole.find({ role: selectedRole._id }).populate('user');
        const roleUserIds = userRolesFiltered
          .filter(ur => ur.user && ur.user._id)
          .map(ur => ur.user._id.toString());
        usersToShow = usersToShow.filter(u => roleUserIds.includes(u._id.toString()));
      }
    }

    // Apply state/location filter if specified
    const producerApps = await ProducerApplication.find({ status: 'approved', location: { $exists: true, $ne: '' } });
    const producerLocations = {};
    producerApps.forEach(app => {
      producerLocations[app.user.toString()] = { state: app.location };
    });

    if (state) {
      usersToShow = usersToShow.filter(u => {
        const uId = u._id.toString();
        const artist = artistMap[uId];
        const producerApp = producerLocations[uId];

        if (artist && artist.state === state) return true;
        if (producerApp && producerApp.state === state) return true;

        return false;
      });
    }

    // Get user roles for display
    const userIds = usersToShow.map(u => u._id);
    const userRoles = await UserRole.find({ user: { $in: userIds } })
      .populate('role');

    // Create a map of user roles for easier access
    const userRoleMap = {};
    userRoles.forEach(ur => {
      if (ur.role) {
        if (!userRoleMap[ur.user.toString()]) {
          userRoleMap[ur.user.toString()] = [];
        }
        userRoleMap[ur.user.toString()].push(ur.role);
      }
    });

    // Final filter: Only show Producers and Artists
    const producerRoleQuery = await Role.findOne({ name: { $regex: '^producer$', $options: 'i' } });
    const prodRoleId = producerRoleQuery ? producerRoleQuery._id.toString() : null;

    usersToShow = usersToShow.filter(u => {
      if (u.role === 'artist') return true;
      if (!prodRoleId) return false;

      const uRoles = userRoleMap[u._id.toString()];
      return uRoles && uRoles.some(r => r._id.toString() === prodRoleId);
    });

    // Get list of states
    const allArtistsWithStates = await Artist.find().select('state').distinct('state');
    const allProducersWithLocations = await ProducerApplication.find({ status: 'approved' }).select('location').distinct('location');
    states = [...new Set([...allArtistsWithStates, ...allProducersWithLocations])].filter(Boolean).sort();

    const dashboardContext = await getDashboardMessagingContext(req.session.user);
    const viewName = dashboardContext ? 'messages/find-dashboard' : 'messages/find';

    res.render(viewName, {
      layout: dashboardContext ? false : undefined,
      title: 'Find Users',
      users: usersToShow,
      artistMap,
      producerLocations,
      userRoleMap,
      roles,
      states,
      selectedRole: role || '',
      selectedState: state || '',
      currentUserArtist,
      hasRoles,
      userRoles: currentUserRoleNames,
      user: req.session.user,
      dashboardType: dashboardContext ? dashboardContext.dashboardType : null,
      artist: dashboardContext ? dashboardContext.artist : null,
      producerUser: dashboardContext ? dashboardContext.producerUser : null,
      currentPath: '/messages/find'
    });
  } catch (error) {
    console.error('Error in find users:', error);
    req.flash('error', 'An error occurred while searching for users');
    res.redirect('/messages');
  }
});

module.exports = router;
