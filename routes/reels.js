const express = require('express');
const router = express.Router();
const ArtistPost = require('../models/ArtistPost');

// Get Reels Page
router.get('/', async (req, res) => {
    try {
        // Fetch posts that are video or audio and approved
        // Shuffle happens on client side for infinite scrolling logic, but we can do a large random sample here if we want
        // But usually we just fetch latest or a random sample of 20
        const posts = await ArtistPost.aggregate([
            {
                $match: {
                    isActive: true,
                    isApproved: true,
                    'media.mediaType': { $in: ['video', 'audio'] },
                    'media.url': { $exists: true, $ne: '' }
                }
            },
            { $sample: { size: 50 } }, // Get up to 50 random media posts
            {
                $lookup: {
                    from: 'artists',
                    localField: 'artist',
                    foreignField: '_id',
                    as: 'artistData'
                }
            },
            { $unwind: '$artistData' },
            {
                $lookup: {
                    from: 'users',
                    localField: 'artistData.user',
                    foreignField: '_id',
                    as: 'artistUser'
                }
            },
            { $unwind: { path: '$artistUser', preserveNullAndEmptyArrays: true } }
        ]);

        // Add liked state if user is logged in
        const userId = req.user ? req.user._id.toString() : null;
        const formattedPosts = posts.map(post => {
            // Safely check for liked status
            const isLiked = userId && post.likes && post.likes.some(likeId => likeId.toString() === userId);

            return {
                _id: post._id,
                caption: post.caption,
                media: post.media,
                likesCount: post.likesCount || 0,
                commentsCount: post.comments ? post.comments.length : 0,
                shares: post.shares || 0,
                createdAt: post.createdAt,
                artist: {
                    _id: post.artistData._id,
                    stageName: post.artistData.stageName,
                    profileImage: post.artistUser ? post.artistUser.profileImage : '/images/default-profile.svg'
                },
                liked: isLiked
            };
        });

        res.render('reels/index', {
            title: 'Reels - RAPIRA',
            path: '/reels',
            reels: formattedPosts,
            layout: false
        });
    } catch (err) {
        console.error('[REELS] Error fetching reels:', err);
        res.status(500).render('error', { message: 'Failed to load reels' });
    }
});

module.exports = router;
