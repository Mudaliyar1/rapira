const express = require('express');
const router = express.Router();
const Follow = require('../models/Follow');
const User = require('../models/User');
const Artist = require('../models/Artist');
const { isLoggedIn, isArtist } = require('../middleware/auth');
const { sendNotification, createFollowNotification } = require('../utils/notificationService');
const { sendFollowNotificationEmail } = require('../utils/brevoEmailService');

// Helper function to get user's role
const getUserRole = async (userId) => {
  const user = await User.findById(userId);
  return user ? user.role : null;
};

// Helper function to check if user is an artist
const checkIsArtist = async (userId) => {
  const artist = await Artist.findOne({ user: userId });
  return !!artist;
};

// Confirmation page for follow/unfollow
router.get('/confirm/:action/:artistId', isLoggedIn, async (req, res) => {
  try {
    const { action, artistId } = req.params;
    const currentUserId = req.session.user.id;
    
    // Validate action
    if (!['follow', 'unfollow'].includes(action)) {
      return res.status(400).render('error', { 
        message: 'Invalid action',
        user: req.session.user 
      });
    }
    
    // Prevent self-follow
    if (currentUserId.toString() === artistId) {
      return res.status(400).render('error', { 
        message: 'You cannot follow yourself',
        user: req.session.user 
      });
    }
    
    // Get artist details
    const artist = await Artist.findOne({ user: artistId })
      .populate('user', 'name email')
      .lean();

    if (!artist) {
      return res.status(404).render('error', {
        message: 'Artist not found',
        user: req.session.user
      });
    }

    const existingFollow = await Follow.findOne({
      followerId: currentUserId,
      followingId: artistId
    });

    const isCurrentlyFollowing = !!existingFollow;
    
    if (action === 'unfollow' && !isCurrentlyFollowing) {
      return res.redirect(`/artists/${artist._id}`);
    }
    
    res.render('follows/confirm', {
      artist,
      action,
      user: req.session.user,
      layout: false
    });
    
  } catch (error) {
    console.error('Confirmation page error:', error);
    res.status(500).render('error', { 
      message: 'Error loading confirmation page',
      user: req.session.user 
    });
  }
});

// Handle follow action from confirmation page
router.post('/confirm/follow/:artistId', isLoggedIn, async (req, res) => {
  try {
    const { artistId } = req.params;
    const followerId = req.session.user.id;
    
    // Get artist details first
    const artist = await Artist.findOne({ user: artistId });
    if (!artist) {
      return res.status(404).render('error', { 
        message: 'Artist not found',
        user: req.session.user 
      });
    }
    
    // Check if already following
    const existingFollow = await Follow.findOne({
      followerId,
      followingId: artistId
    });
    
    if (existingFollow) {
      return res.redirect(`/artists/${artist._id}?message=Already following this artist`);
    }
    
    // Create the follow relationship
    const follow = new Follow({
      followerId,
      followingId: artistId,
      roleOfFollower: await getUserRole(followerId),
      roleOfFollowing: 'artist' // Since we're following an artist
    });
    
    await follow.save();
    
    // Redirect back to artist profile with success message
    res.redirect(`/artists/${artist._id}?message=Successfully followed artist`);
    
  } catch (error) {
    console.error('Confirmation follow error:', error);
    res.redirect(`/artists/${artist._id}?message=Error following artist`);
  }
});

// Handle unfollow action from confirmation page
router.post('/confirm/unfollow/:artistId', isLoggedIn, async (req, res) => {
  try {
    const { artistId } = req.params;
    const followerId = req.session.user.id;
    
    // Get artist details first
    const artist = await Artist.findOne({ user: artistId });
    if (!artist) {
      return res.status(404).render('error', { 
        message: 'Artist not found',
        user: req.session.user 
      });
    }
    
    // Find and delete the follow relationship
    const follow = await Follow.findOneAndDelete({
      followerId,
      followingId: artistId
    });
    
    if (!follow) {
      return res.redirect(`/artists/${artist._id}?message=Not following this artist`);
    }
    
    // Redirect back to artist profile with success message
    res.redirect(`/artists/${artist._id}?message=Successfully unfollowed artist`);
    
  } catch (error) {
    console.error('Confirmation unfollow error:', error);
    res.redirect(`/artists/${artist._id}?message=Error unfollowing artist`);
  }
});

// Follow an artist
router.post('/follow/:artistId', isLoggedIn, async (req, res) => {
  try {
    const { artistId } = req.params;
    const followerId = req.session.user.id;
    
    // Prevent self-follow
    if (followerId.toString() === artistId) {
      return res.status(400).json({ 
        success: false, 
        message: 'You cannot follow yourself' 
      });
    }

    // Get follower role
    const followerRole = await getUserRole(followerId);
    
    // Check if the user being followed is actually an artist
    const targetArtist = await Artist.findOne({ user: artistId });
    if (!targetArtist) {
      return res.status(404).json({ 
        success: false, 
        message: 'Artist not found' 
      });
    }

    // Role-based validation
    if (followerRole === 'user') {
      // Users can only follow artists
      const isFollowingArtist = await checkIsArtist(artistId);
      if (!isFollowingArtist) {
        return res.status(403).json({ 
          success: false, 
          message: 'Users can only follow artists' 
        });
      }
    } else if (followerRole === 'artist') {
      // Artists can only follow other artists
      const isFollowingArtist = await checkIsArtist(artistId);
      if (!isFollowingArtist) {
        return res.status(403).json({ 
          success: false, 
          message: 'Artists can only follow other artists' 
        });
      }
    } else {
      return res.status(403).json({ 
        success: false, 
        message: 'Invalid user role for following' 
      });
    }

    // Check if already following
    const existingFollow = await Follow.findOne({
      followerId,
      followingId: artistId
    });

    if (existingFollow) {
      return res.status(400).json({ 
        success: false, 
        message: 'You are already following this artist' 
      });
    }

    // Create follow relationship
    const follow = new Follow({
      followerId,
      followingId: artistId,
      roleOfFollower: followerRole,
      roleOfFollowing: 'artist'
    });

    await follow.save();

    // Get follower info for notification
    const follower = await User.findById(followerId);
    const artistUser = await User.findById(artistId);

    // Send notification to the artist
    await sendNotification(
      artistId,
      'new_follower',
      `${follower.name} started following you`,
      `/artists/${followerId}`
    );

    // Create notification in notification system
    await createFollowNotification({
      followerId: followerId,
      followingId: artistId,
      followerName: follower.name,
      followerRole: followerRole
    });

    // Send email notification (optional)
    try {
      await sendFollowNotificationEmail(artistUser.email, follower.name, followerRole);
    } catch (emailError) {
      console.error('Email notification failed:', emailError);
      // Continue even if email fails
    }

    res.json({ 
      success: true, 
      message: 'Successfully followed artist',
      followId: follow._id
    });

  } catch (error) {
    console.error('Follow error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error following artist' 
    });
  }
});

// Unfollow an artist
router.delete('/unfollow/:artistId', isLoggedIn, async (req, res) => {
  try {
    const { artistId } = req.params;
    const followerId = req.session.user.id;

    const follow = await Follow.findOne({
      followerId,
      followingId: artistId
    });

    if (!follow) {
      return res.status(404).json({ 
        success: false, 
        message: 'Follow relationship not found' 
      });
    }

    await Follow.findByIdAndDelete(follow._id);

    res.json({ 
      success: true, 
      message: 'Successfully unfollowed artist' 
    });

  } catch (error) {
    console.error('Unfollow error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error unfollowing artist' 
    });
  }
});

// Artist removes a follower from their account
router.delete('/artist/remove-follower/:followerId', isLoggedIn, isArtist, async (req, res) => {
  try {
    const { followerId } = req.params;
    const artistUserId = req.session.user.id;

    // Validate followerId is a valid ObjectId
    if (!followerId || !followerId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid follower ID format' 
      });
    }

    // Verify the current user is an artist
    const artist = await Artist.findOne({ user: artistUserId });
    if (!artist) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only artists can remove followers' 
      });
    }

    // Find and delete the follow relationship where this user is being followed
    const follow = await Follow.findOne({
      followerId: followerId,
      followingId: artistUserId
    });

    if (!follow) {
      return res.status(404).json({ 
        success: false, 
        message: 'Follower not found' 
      });
    }

    await Follow.findByIdAndDelete(follow._id);

    res.json({ 
      success: true, 
      message: 'Follower removed successfully' 
    });
  } catch (error) {
    console.error('Remove follower error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error removing follower' 
    });
  }
});

// Get followers of an artist
router.get('/artist/:id/followers', async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const type = req.query.type; // 'all', 'user', 'artist'

    // Verify the user is an artist
    const artist = await Artist.findOne({ user: id });
    if (!artist) {
      return res.status(404).json({ 
        success: false, 
        message: 'Artist not found' 
      });
    }

    let query = { followingId: id };
    
    // Filter by follower type if specified
    if (type === 'user') {
      query.roleOfFollower = 'user';
    } else if (type === 'artist') {
      query.roleOfFollower = 'artist';
    }

    const followersRaw = await Follow.find(query)
      .populate('followerId', 'name email profileImage role isBlocked')
      .sort({ createdAt: -1 });

    const validFollowers = followersRaw.filter(follow => follow.followerId && !follow.followerId.isBlocked);
    const artistFollowerIds = validFollowers
      .filter(follow => follow.followerId.role === 'artist')
      .map(follow => follow.followerId._id);
    const blockedArtistUsers = artistFollowerIds.length
      ? await Artist.find({ user: { $in: artistFollowerIds }, isBlocked: true }).select('user')
      : [];
    const blockedArtistUserIds = new Set(blockedArtistUsers.map(item => item.user.toString()));
    const activeFollowers = validFollowers.filter(follow => {
      if (follow.followerId.role !== 'artist') return true;
      return !blockedArtistUserIds.has(follow.followerId._id.toString());
    });

    const totalFollowers = activeFollowers.length;
    const followers = activeFollowers.slice((page - 1) * limit, page * limit);

    res.json({
      success: true,
      followers: followers.map(f => ({
        _id: f._id,
        follower: {
          _id: f.followerId._id,
          name: f.followerId.name,
          email: f.followerId.email,
          profileImage: f.followerId.profileImage,
          role: f.followerId.role
        },
        roleOfFollower: f.roleOfFollower,
        createdAt: f.createdAt
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalFollowers / limit),
        totalItems: totalFollowers,
        hasNext: page < Math.ceil(totalFollowers / limit),
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching followers' 
    });
  }
});

// Get follow count for an artist
router.get('/artist/:id/followCount', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify the user is an artist
    const artist = await Artist.findOne({ user: id });
    if (!artist) {
      return res.status(404).json({ 
        success: false, 
        message: 'Artist not found' 
      });
    }

    const totalFollowers = await Follow.countDocuments({ followingId: id });
    const userFollowers = await Follow.countDocuments({ 
      followingId: id, 
      roleOfFollower: 'user' 
    });
    const artistFollowers = await Follow.countDocuments({ 
      followingId: id, 
      roleOfFollower: 'artist' 
    });

    res.json({
      success: true,
      followCount: {
        total: totalFollowers,
        userFollowers,
        artistFollowers
      }
    });

  } catch (error) {
    console.error('Get follow count error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching follow count' 
    });
  }
});

// Check if current user is following an artist
router.get('/is-following/:artistId', isLoggedIn, async (req, res) => {
  try {
    const { artistId } = req.params;
    const followerId = req.session.user.id;

    const follow = await Follow.findOne({
      followerId,
      followingId: artistId
    });

    res.json({
      success: true,
      isFollowing: !!follow
    });

  } catch (error) {
    console.error('Check following error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error checking follow status' 
    });
  }
});

module.exports = router;