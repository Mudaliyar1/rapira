/**
 * Content Routes
 * Handles viewing and interacting with content items
 */

const express = require('express');
const router = express.Router();
const Content = require('../models/Content');
const Artist = require('../models/Artist');
const { isLoggedIn } = require('../middleware/auth');
const Media = require('../models/Media');
const { deleteMedia } = require('../utils/mediaService');
const { extractYoutubeId, isYoutubeVideoAvailable } = require('../utils/youtube');

const removeContentIfUnavailableYoutube = async (content) => {
  const isYoutubeContent = content?.isYoutubeLink || content?.youtubeId || /(?:youtube\.com|youtu\.be)/i.test(String(content?.fileUrl || ''));
  if (!isYoutubeContent) {
    return false;
  }

  const youtubeId = content.youtubeId || extractYoutubeId(content.fileUrl);
  const available = await isYoutubeVideoAvailable(youtubeId || content.fileUrl);
  if (available) {
    return false;
  }

  try {
    if (content.thumbnailMedia) {
      const thumbnailMedia = await Media.findById(content.thumbnailMedia);
      if (thumbnailMedia) await deleteMedia(thumbnailMedia);
    }
    if (content.fileMedia) {
      const fileMedia = await Media.findById(content.fileMedia);
      if (fileMedia) await deleteMedia(fileMedia);
    }
  } catch (cleanupError) {
    console.error('Failed to cleanup unavailable YouTube content:', cleanupError.message);
  }

  await Content.deleteOne({ _id: content._id });
  return true;
};

// View individual content
router.get('/:id', async (req, res) => {
  try {
    // Find the content by ID
    const content = await Content.findById(req.params.id)
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name profileImage' }
      });

    if (!content) {
      req.flash('error', 'Content not found');
      return res.redirect('/content');
    }

    const removed = await removeContentIfUnavailableYoutube(content);
    if (removed) {
      req.flash('error', 'This YouTube content is no longer available and has been removed.');
      return res.redirect('/content');
    }

    // Extract YouTube ID if it's a YouTube link but doesn't have youtubeId set
    if (content && content.fileUrl) {
      // Check for YouTube links
      if ((content.fileUrl.includes('youtube.com') || content.fileUrl.includes('youtu.be')) && !content.youtubeId) {
        const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        const match = content.fileUrl.match(youtubeRegex);

        if (match && match[1]) {
          content.youtubeId = match[1];
          content.isYoutubeLink = true;
          await content.save();
          console.log(`Extracted YouTube ID ${content.youtubeId} from ${content.fileUrl}`);
        } else {
          console.log(`Failed to extract YouTube ID from ${content.fileUrl}`);
        }
      }
    }

    // Increment view count
    content.views += 1;
    await content.save();

    // Get more content from the same artist
    const moreFromArtist = await Content.find({
      artist: content.artist._id,
      _id: { $ne: content._id } // Exclude current content
    })
      .sort({ createdAt: -1 })
      .limit(4)
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name' }
      });

    // Get similar content (same type)
    const similarContent = await Content.find({
      type: content.type,
      _id: { $ne: content._id }, // Exclude current content
      artist: { $ne: content.artist._id } // Exclude same artist
    })
      .sort({ views: -1 })
      .limit(4)
      .populate({
        path: 'artist',
        populate: { path: 'user', select: 'name' }
      });

    res.render('content-viewer', {
      title: content.title,
      content,
      moreFromArtist,
      similarContent
    });
  } catch (error) {
    console.error('Content view error:', error);
    req.flash('error', 'Failed to load content');
    res.redirect('/content');
  }
});

// Like content (requires login)
router.post('/:id/like', isLoggedIn, async (req, res) => {
  try {
    const content = await Content.findById(req.params.id);

    if (!content) {
      return res.status(404).json({ success: false, message: 'Content not found' });
    }

    // Increment like count
    content.likes += 1;
    await content.save();

    res.json({ success: true, likes: content.likes });
  } catch (error) {
    console.error('Like content error:', error);
    res.status(500).json({ success: false, message: 'Failed to like content' });
  }
});

module.exports = router;
