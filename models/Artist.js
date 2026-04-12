const mongoose = require('mongoose');

const ArtistSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  stageName: {
    type: String,
    required: true
  },
  genre: {
    type: String,
    required: true
  },
  artistLevel: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Established'],
    default: 'Beginner'
  },
  yearsActive: {
    type: Number,
    default: 0
  },
  verified: {
    type: Boolean,
    default: false
  },
  featuredArtist: {
    type: Boolean,
    default: false
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  blockReason: {
    type: String,
    default: ''
  },
  blockedAt: {
    type: Date
  },
  blockedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  blockHistory: [{
    blockedAt: {
      type: Date,
      required: true
    },
    blockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    blockReason: {
      type: String,
      default: ''
    },
    unblockedAt: {
      type: Date
    },
    unblockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  about: {
    type: String,
    default: ''
  },
  achievements: [String],
  bannerImage: {
    type: String,
    default: '/images/default-banner.jpg'
  },
  bannerMedia: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Media'
  },
  aadharCard: {
    type: String,
    default: ''
  },
  panCard: {
    type: String,
    default: ''
  },
  state: {
    type: String,
    default: ''
  },
  city: {
    type: String,
    default: ''
  },
  age: {
    type: Number,
    default: 0
  },
  phoneNumber: {
    type: String,
    default: ''
  },
  proofPhoto: {
    type: String,
    default: ''
  },
  proofPhotoMedia: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Media'
  },
  completedLearning: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Virtual for total followers count
ArtistSchema.virtual('totalFollowers').get(function() {
  return this._totalFollowers || 0;
});

// Virtual for user followers count
ArtistSchema.virtual('userFollowers').get(function() {
  return this._userFollowers || 0;
});

// Virtual for artist followers count
ArtistSchema.virtual('artistFollowers').get(function() {
  return this._artistFollowers || 0;
});

// Method to populate follower counts
ArtistSchema.methods.populateFollowerCounts = async function() {
  const Follow = require('./Follow');
  const ArtistModel = this.model('Artist');
  
  const followsRaw = await Follow.find({ followingId: this.user })
    .populate('followerId', 'role isBlocked');

  const validFollows = followsRaw.filter(follow => follow.followerId && !follow.followerId.isBlocked);
  const artistFollowerIds = validFollows
    .filter(follow => follow.followerId.role === 'artist')
    .map(follow => follow.followerId._id);
  const blockedArtistUsers = artistFollowerIds.length
    ? await ArtistModel.find({ user: { $in: artistFollowerIds }, isBlocked: true }).select('user')
    : [];
  const blockedArtistUserIds = new Set(blockedArtistUsers.map(item => item.user.toString()));
  const activeFollows = validFollows.filter(follow => {
    if (follow.followerId.role !== 'artist') return true;
    return !blockedArtistUserIds.has(follow.followerId._id.toString());
  });

  const uniqueFollowers = new Map();
  activeFollows.forEach(follow => {
    const followerId = follow.followerId._id.toString();
    if (!uniqueFollowers.has(followerId)) {
      uniqueFollowers.set(followerId, follow);
    }
  });

  const uniqueFollows = Array.from(uniqueFollowers.values());
  const totalFollowers = uniqueFollows.length;
  const userFollowers = uniqueFollows.filter(follow => follow.roleOfFollower === 'user').length;
  const artistFollowers = uniqueFollows.filter(follow => follow.roleOfFollower === 'artist').length;
  
  this._totalFollowers = totalFollowers;
  this._userFollowers = userFollowers;
  this._artistFollowers = artistFollowers;
  
  return {
    totalFollowers,
    userFollowers,
    artistFollowers
  };
};

// Static method to get multiple artists with follower counts
ArtistSchema.statics.withFollowerCounts = async function(filter = {}) {
  const artists = await this.find(filter).populate('user', 'name email profileImage');
  
  const Follow = require('./Follow');
  
  // Get all artist user IDs
  const artistUserIds = artists.map(artist => artist.user._id);
  
  // Get follower counts for all artists in one query
  const followerCounts = await Follow.aggregate([
    { $match: { followingId: { $in: artistUserIds } } },
    {
      $group: {
        _id: '$followingId',
        totalFollowers: { $sum: 1 },
        userFollowers: {
          $sum: { $cond: [{ $eq: ['$roleOfFollower', 'user'] }, 1, 0] }
        },
        artistFollowers: {
          $sum: { $cond: [{ $eq: ['$roleOfFollower', 'artist'] }, 1, 0] }
        }
      }
    }
  ]);
  
  // Create a map of follower counts by user ID
  const followerCountMap = {};
  followerCounts.forEach(count => {
    followerCountMap[count._id.toString()] = {
      totalFollowers: count.totalFollowers,
      userFollowers: count.userFollowers,
      artistFollowers: count.artistFollowers
    };
  });
  
  // Add follower counts to each artist
  artists.forEach(artist => {
    const userIdStr = artist.user._id.toString();
    const counts = followerCountMap[userIdStr] || { totalFollowers: 0, userFollowers: 0, artistFollowers: 0 };
    
    artist._totalFollowers = counts.totalFollowers;
    artist._userFollowers = counts.userFollowers;
    artist._artistFollowers = counts.artistFollowers;
  });
  
  return artists;
};

module.exports = mongoose.model('Artist', ArtistSchema);