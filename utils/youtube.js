const https = require('https');

const YOUTUBE_REGEX = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;

function extractYoutubeId(url) {
  if (!url) return '';
  const match = String(url).match(YOUTUBE_REGEX);
  return match && match[1] ? match[1] : '';
}

function buildYoutubeWatchUrl(urlOrId) {
  const value = String(urlOrId || '').trim();
  if (!value) return '';

  const youtubeId = value.length === 11 ? value : extractYoutubeId(value);
  if (!youtubeId) return '';

  return `https://www.youtube.com/watch?v=${youtubeId}`;
}

function isYoutubeUrl(url) {
  return /(?:youtube\.com|youtu\.be)/i.test(String(url || ''));
}

function isYoutubeVideoAvailable(urlOrId, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const watchUrl = buildYoutubeWatchUrl(urlOrId);
    if (!watchUrl) {
      return resolve(false);
    }

    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;
    const request = https.get(oembedUrl, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error('YouTube availability check timed out'));
      resolve(false);
    });

    request.on('error', () => resolve(false));
  });
}

module.exports = {
  buildYoutubeWatchUrl,
  extractYoutubeId,
  isYoutubeUrl,
  isYoutubeVideoAvailable
};
