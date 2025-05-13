/**
 * YouTube Embed Handler for Rapira
 * Handles YouTube video embedding and initialization
 */

document.addEventListener('DOMContentLoaded', function() {
  // Initialize YouTube iframes
  initializeYouTubeEmbeds();
});

/**
 * Initialize all YouTube embeds on the page
 */
function initializeYouTubeEmbeds() {
  // Get all YouTube iframes
  const youtubeFrames = document.querySelectorAll('iframe[src*="youtube.com/embed"]');

  // If no YouTube iframes found, return
  if (youtubeFrames.length === 0) {
    console.log('No YouTube embeds found on this page');
    return;
  }

  console.log(`Found ${youtubeFrames.length} YouTube embeds`);

  // Add event listeners to each iframe
  youtubeFrames.forEach(frame => {
    // Add loading class
    frame.classList.add('youtube-loading');

    // Add load event listener
    frame.addEventListener('load', function() {
      console.log('YouTube iframe loaded:', frame.src);
      frame.classList.remove('youtube-loading');
      frame.classList.add('youtube-loaded');
    });

    // Add error event listener
    frame.addEventListener('error', function() {
      console.error('Error loading YouTube iframe:', frame.src);
      frame.classList.remove('youtube-loading');
      frame.classList.add('youtube-error');

      // Show error message
      const container = frame.parentElement;
      if (container) {
        const errorMessage = document.createElement('div');
        errorMessage.className = 'youtube-error-message';
        errorMessage.innerHTML = `
          <div class="alert alert-danger">
            <p><strong>Error loading YouTube video</strong></p>
            <p>Please try refreshing the page or view directly on YouTube.</p>
          </div>
        `;
        container.appendChild(errorMessage);
      }
    });
  });
}

/**
 * Create a YouTube embed from a YouTube ID
 * @param {string} youtubeId - The YouTube video ID
 * @param {string} title - The title of the video
 * @param {boolean} autoplay - Whether to autoplay the video
 * @returns {HTMLIFrameElement} - The created iframe element
 */
function createYouTubeEmbed(youtubeId, title, autoplay = false) {
  // Create iframe element
  const iframe = document.createElement('iframe');

  // Set attributes
  iframe.src = `https://www.youtube.com/embed/${youtubeId}?rel=0&showinfo=0&modestbranding=1${autoplay ? '&autoplay=1' : ''}`;
  iframe.title = title || 'YouTube video';
  iframe.frameBorder = '0';
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
  iframe.allowFullscreen = true;

  return iframe;
}

/**
 * Extract YouTube ID from a YouTube URL
 * @param {string} url - The YouTube URL
 * @returns {string|null} - The YouTube ID or null if not found
 */
function extractYouTubeId(url) {
  if (!url) return null;

  // YouTube URL patterns
  const patterns = [
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i,
    /^([^"&?\/\s]{11})$/i
  ];

  // Try each pattern
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}
