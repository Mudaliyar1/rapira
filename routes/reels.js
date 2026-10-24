const express = require('express');
const router = express.Router();
const ArtistPost = require('../models/ArtistPost');

// Get Reels Page
router.get('/', async (req, res) => {
    try {
        const targetPostId = req.query.id; // Optional ?id=ID link

        let posts = await ArtistPost.aggregate([
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

        // If specific ID is requested, fetch it and put at the top if not already there
        if (targetPostId) {
            const hasTarget = posts.some(p => p._id.toString() === targetPostId);
            if (!hasTarget) {
                const targetPost = await ArtistPost.findById(targetPostId).populate({
                    path: 'artist',
                    populate: { path: 'user' }
                });
                if (targetPost && targetPost.isActive) {
                    // Manual format for the unshift
                    const tp = targetPost.toObject();
                    const manualFormatted = {
                        ...tp,
                        artistData: tp.artist,
                        artistUser: tp.artist.user
                    };
                    posts.unshift(manualFormatted);
                }
            } else {
                // Move existing target to index 0
                const idx = posts.findIndex(p => p._id.toString() === targetPostId);
                const [tp] = posts.splice(idx, 1);
                posts.unshift(tp);
            }
        }

        // Add liked state if user is logged in
        const userId = req.session && req.session.user ? req.session.user.id.toString() : null;
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
            targetPostId: targetPostId || null,
            layout: false
        });
    } catch (err) {
        console.error('[REELS] Error fetching reels:', err);
        res.status(500).render('error', { message: 'Failed to load reels' });
    }
});

module.exports = router;
