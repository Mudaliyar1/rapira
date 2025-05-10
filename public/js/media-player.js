/**
 * Media Player for Rapira
 * Handles audio, video, PDF, and lyrics content
 */

// Global variables
let currentMediaType = null;
let currentMediaData = null;
let pdfDoc = null;
let pageNum = 1;
let audioContext = null;
let audioAnalyser = null;
let audioSource = null;
let miniPlayerActive = false;

// DOM Elements
const mediaPlayerModal = document.getElementById('mediaPlayerModal');
const mediaTitle = document.getElementById('mediaTitle');
const mediaContainer = document.getElementById('mediaContainer');
const audioPlayerContainer = document.getElementById('audioPlayerContainer');
const videoPlayerContainer = document.getElementById('videoPlayerContainer');
const pdfViewerContainer = document.getElementById('pdfViewerContainer');
const lyricsViewerContainer = document.getElementById('lyricsViewerContainer');
const audioPlayer = document.getElementById('audioPlayer');
const videoPlayer = document.getElementById('videoPlayer');
const audioTitle = document.getElementById('audioTitle');
const audioArtist = document.getElementById('audioArtist');
const audioThumbnail = document.getElementById('audioThumbnail');
const waveform = document.getElementById('waveform');
const currentTime = document.getElementById('currentTime');
const duration = document.getElementById('duration');
const pdfCanvas = document.getElementById('pdfCanvas');
const currentPage = document.getElementById('currentPage');
const totalPages = document.getElementById('totalPages');
const prevPage = document.getElementById('prevPage');
const nextPage = document.getElementById('nextPage');
const lyricsContent = document.getElementById('lyricsContent');
const downloadContent = document.getElementById('downloadContent');
const miniPlayer = document.getElementById('miniPlayer');
const miniPlayerTitle = document.getElementById('miniPlayerTitle');
const miniPlayerArtist = document.getElementById('miniPlayerArtist');
const miniPlayerThumbnail = document.getElementById('miniPlayerThumbnail');
const miniPlayerPlayPause = document.getElementById('miniPlayerPlayPause');
const miniPlayerExpand = document.getElementById('miniPlayerExpand');
const miniPlayerClose = document.getElementById('miniPlayerClose');
const miniPlayerProgressBar = document.getElementById('miniPlayerProgressBar');

// Initialize the media player
document.addEventListener('DOMContentLoaded', function() {
  // Initialize the modal
  const mediaModalElement = document.getElementById('mediaPlayerModal');
  if (mediaModalElement) {
    const mediaModal = new bootstrap.Modal(mediaModalElement);

    // Handle modal close event
    mediaModalElement.addEventListener('hidden.bs.modal', function() {
      if (currentMediaType === 'audio' && !audioPlayer.paused) {
        // If audio is playing, show mini player
        showMiniPlayer();
      } else {
        // Otherwise, stop all media
        stopAllMedia();
      }
    });
  }

  // Add event listeners for PDF navigation
  if (prevPage) {
    prevPage.addEventListener('click', onPrevPage);
  }

  if (nextPage) {
    nextPage.addEventListener('click', onNextPage);
  }

  // Add event listeners for mini player
  if (miniPlayerPlayPause) {
    miniPlayerPlayPause.addEventListener('click', toggleMiniPlayerPlayPause);
  }

  if (miniPlayerExpand) {
    miniPlayerExpand.addEventListener('click', expandMiniPlayer);
  }

  if (miniPlayerClose) {
    miniPlayerClose.addEventListener('click', closeMiniPlayer);
  }

  // Add event listener for download button
  if (downloadContent) {
    downloadContent.addEventListener('click', downloadCurrentMedia);
  }

  // Add event listeners for audio player
  if (audioPlayer) {
    audioPlayer.addEventListener('timeupdate', updateAudioProgress);
    audioPlayer.addEventListener('loadedmetadata', initializeAudioPlayer);
    audioPlayer.addEventListener('ended', onAudioEnded);
  }

  // Add event listeners for video player
  if (videoPlayer) {
    videoPlayer.addEventListener('loadedmetadata', function() {
      console.log('Video loaded');
    });
  }

  // Initialize click handlers for all media links
  initializeMediaLinks();
});

// Initialize click handlers for all media links
function initializeMediaLinks() {
  // Find all content links
  document.querySelectorAll('.content-link').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();

      const mediaUrl = this.getAttribute('href');
      const mediaType = this.getAttribute('data-type');
      const mediaTitle = this.getAttribute('data-title');
      const mediaArtist = this.getAttribute('data-artist');
      const mediaThumbnail = this.getAttribute('data-thumbnail');

      openMedia(mediaUrl, mediaType, mediaTitle, mediaArtist, mediaThumbnail);
    });
  });
}

// Open media in the player
function openMedia(url, type, title, artist, thumbnail) {
  // Reset the player
  resetMediaPlayer();

  // Set current media data
  currentMediaType = type;
  currentMediaData = {
    url: url,
    title: title,
    artist: artist,
    thumbnail: thumbnail
  };

  // Set the modal title
  if (mediaTitle) {
    mediaTitle.textContent = title;
  }

  // Show the appropriate player based on media type
  switch (type) {
    case 'audio':
    case 'song':
      showAudioPlayer(url, title, artist, thumbnail);
      break;
    case 'video':
      showVideoPlayer(url);
      break;
    case 'pdf':
      showPdfViewer(url);
      break;
    case 'lyrics':
      showLyricsViewer(url);
      break;
    default:
      console.error('Unsupported media type:', type);
      return;
  }

  // Show the modal
  const mediaModal = new bootstrap.Modal(document.getElementById('mediaPlayerModal'));
  mediaModal.show();
}

// Reset the media player
function resetMediaPlayer() {
  // Hide all containers
  audioPlayerContainer.classList.add('d-none');
  videoPlayerContainer.classList.add('d-none');
  pdfViewerContainer.classList.add('d-none');
  lyricsViewerContainer.classList.add('d-none');

  // Reset audio player
  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    audioPlayer.src = '';
  }

  // Reset video player
  if (videoPlayer) {
    videoPlayer.pause();
    videoPlayer.currentTime = 0;
    videoPlayer.src = '';
  }

  // Reset PDF viewer
  pdfDoc = null;
  pageNum = 1;

  // Reset lyrics viewer
  if (lyricsContent) {
    lyricsContent.innerHTML = '';
  }
}

// Show audio player
function showAudioPlayer(url, title, artist, thumbnail) {
  audioPlayerContainer.classList.remove('d-none');

  // Set audio source
  audioPlayer.src = url;

  // Set audio metadata
  if (audioTitle) audioTitle.textContent = title;
  if (audioArtist) audioArtist.textContent = artist;
  if (audioThumbnail && thumbnail) audioThumbnail.src = thumbnail;

  // Load and play audio
  audioPlayer.load();
  audioPlayer.play().catch(e => console.error('Error playing audio:', e));

  // Initialize waveform
  initializeWaveform();
}

// Show video player
function showVideoPlayer(url) {
  videoPlayerContainer.classList.remove('d-none');

  // Set video source
  videoPlayer.src = url;

  // Load and play video
  videoPlayer.load();
  videoPlayer.play().catch(e => console.error('Error playing video:', e));
}

// Show PDF viewer
function showPdfViewer(url) {
  pdfViewerContainer.classList.remove('d-none');

  // Show loading indicator
  const pdfLoading = document.getElementById('pdfLoading');
  if (pdfLoading) {
    pdfLoading.style.display = 'block';
  }

  // Initialize PDF.js
  if (!pdfjsLib) {
    console.error('PDF.js library not loaded');
    if (pdfLoading) {
      pdfLoading.innerHTML = '<div class="alert alert-danger">PDF.js library not loaded</div>';
    }
    return;
  }

  // Set workerSrc property to the PDF.js worker file
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

  // Load the PDF
  pdfjsLib.getDocument(url).promise.then(function(pdf) {
    pdfDoc = pdf;
    if (totalPages) {
      totalPages.textContent = pdf.numPages;
    }

    // Render the first page
    renderPage(pageNum);

    // Hide loading indicator
    if (pdfLoading) {
      pdfLoading.style.display = 'none';
    }
  }).catch(function(error) {
    console.error('Error loading PDF:', error);
    if (pdfLoading) {
      pdfLoading.innerHTML = '<div class="alert alert-danger">Error loading PDF: ' + error.message + '</div>';
    }
  });
}

// Show lyrics viewer
function showLyricsViewer(url) {
  lyricsViewerContainer.classList.remove('d-none');

  // Check if it's a PDF file
  if (url.toLowerCase().endsWith('.pdf')) {
    // If it's a PDF, use the PDF viewer instead
    showPdfViewer(url);
    return;
  }

  // Fetch lyrics content
  fetch(url)
    .then(response => response.text())
    .then(text => {
      lyricsContent.textContent = text;
    })
    .catch(error => {
      console.error('Error loading lyrics:', error);
      lyricsContent.innerHTML = '<div class="alert alert-danger">Error loading lyrics</div>';
    });
}

// Initialize audio waveform
function initializeWaveform() {
  if (!waveform) return;

  // Clear existing waveform
  waveform.innerHTML = '';

  // Create waveform progress
  const waveformProgress = document.createElement('div');
  waveformProgress.className = 'waveform-progress';
  waveform.appendChild(waveformProgress);

  // Create waveform bars container
  const waveformBars = document.createElement('div');
  waveformBars.className = 'waveform-bars';
  waveform.appendChild(waveformBars);

  // Create random bars for waveform visualization
  const barCount = 100;
  for (let i = 0; i < barCount; i++) {
    const bar = document.createElement('div');
    bar.className = 'waveform-bar';
    bar.style.height = `${Math.random() * 100}%`;
    waveformBars.appendChild(bar);
  }

  // Add click event to seek audio
  waveform.addEventListener('click', function(e) {
    const rect = waveform.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    audioPlayer.currentTime = pos * audioPlayer.duration;
  });
}

// Update audio progress
function updateAudioProgress() {
  if (!audioPlayer) return;

  const currentTimeValue = audioPlayer.currentTime;
  const durationValue = audioPlayer.duration;

  // Update time display
  if (currentTime) {
    currentTime.textContent = formatTime(currentTimeValue);
  }

  if (duration) {
    duration.textContent = formatTime(durationValue);
  }

  // Update waveform progress
  const progressPercent = (currentTimeValue / durationValue) * 100;
  const waveformProgress = waveform.querySelector('.waveform-progress');
  if (waveformProgress) {
    waveformProgress.style.width = `${progressPercent}%`;
  }

  // Update mini player progress
  if (miniPlayerActive) {
    miniPlayerProgressBar.style.width = `${progressPercent}%`;
  }
}

// Format time in MM:SS format
function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Initialize audio player
function initializeAudioPlayer() {
  console.log('Audio loaded');
  updateAudioProgress();
}

// Handle audio ended event
function onAudioEnded() {
  console.log('Audio ended');

  // If mini player is active, close it
  if (miniPlayerActive) {
    closeMiniPlayer();
  }
}

// Render PDF page
function renderPage(num) {
  if (!pdfDoc) return;

  // Show loading indicator
  const pdfLoading = document.getElementById('pdfLoading');
  if (pdfLoading) {
    pdfLoading.style.display = 'block';
  }

  // Get the canvas element
  const canvas = document.getElementById('pdfCanvas');
  if (!canvas) {
    console.error('PDF canvas element not found');
    return;
  }

  // Get the canvas context
  const context = canvas.getContext('2d');
  if (!context) {
    console.error('Could not get canvas context');
    return;
  }

  // Clear the canvas
  context.clearRect(0, 0, canvas.width, canvas.height);

  // Get the page
  pdfDoc.getPage(num).then(function(page) {
    // Calculate the scale to fit the canvas
    const containerWidth = canvas.parentElement.clientWidth;
    const desiredWidth = containerWidth - 20; // Add some padding
    const viewport = page.getViewport({ scale: 1.0 });
    const scale = desiredWidth / viewport.width;
    const scaledViewport = page.getViewport({ scale: scale });

    // Set canvas dimensions to match the viewport
    canvas.height = scaledViewport.height;
    canvas.width = scaledViewport.width;

    // Render the page
    const renderContext = {
      canvasContext: context,
      viewport: scaledViewport
    };

    const renderTask = page.render(renderContext);

    // Wait for rendering to finish
    renderTask.promise.then(function() {
      // Update page number display
      if (currentPage) {
        currentPage.textContent = num;
      }

      // Hide loading indicator
      if (pdfLoading) {
        pdfLoading.style.display = 'none';
      }
    }).catch(function(error) {
      console.error('Error rendering PDF page:', error);
      if (pdfLoading) {
        pdfLoading.innerHTML = '<div class="alert alert-danger">Error rendering PDF page: ' + error.message + '</div>';
      }
    });
  }).catch(function(error) {
    console.error('Error getting PDF page:', error);
    if (pdfLoading) {
      pdfLoading.innerHTML = '<div class="alert alert-danger">Error getting PDF page: ' + error.message + '</div>';
    }
  });
}

// Go to previous PDF page
function onPrevPage() {
  if (pageNum <= 1) return;
  pageNum--;
  renderPage(pageNum);
}

// Go to next PDF page
function onNextPage() {
  if (pageNum >= pdfDoc.numPages) return;
  pageNum++;
  renderPage(pageNum);
}

// Show mini player
function showMiniPlayer() {
  if (!currentMediaData || currentMediaType !== 'audio') return;

  miniPlayerActive = true;
  miniPlayer.classList.remove('d-none');

  // Set mini player data
  miniPlayerTitle.textContent = currentMediaData.title;
  miniPlayerArtist.textContent = currentMediaData.artist;
  if (currentMediaData.thumbnail) {
    miniPlayerThumbnail.src = currentMediaData.thumbnail;
  }

  // Update play/pause button
  updateMiniPlayerPlayPauseButton();

  // Update progress
  updateAudioProgress();
}

// Hide mini player
function closeMiniPlayer() {
  miniPlayerActive = false;
  miniPlayer.classList.add('d-none');

  // Stop audio
  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
  }
}

// Toggle mini player play/pause
function toggleMiniPlayerPlayPause() {
  if (!audioPlayer) return;

  if (audioPlayer.paused) {
    audioPlayer.play();
  } else {
    audioPlayer.pause();
  }

  updateMiniPlayerPlayPauseButton();
}

// Update mini player play/pause button
function updateMiniPlayerPlayPauseButton() {
  if (!miniPlayerPlayPause || !audioPlayer) return;

  const icon = miniPlayerPlayPause.querySelector('i');
  if (audioPlayer.paused) {
    icon.className = 'bi bi-play-fill';
  } else {
    icon.className = 'bi bi-pause-fill';
  }
}

// Expand mini player to full modal
function expandMiniPlayer() {
  if (!miniPlayerActive) return;

  // Show the modal
  const mediaModal = new bootstrap.Modal(document.getElementById('mediaPlayerModal'));
  mediaModal.show();
}

// Stop all media
function stopAllMedia() {
  // Stop audio
  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
  }

  // Stop video
  if (videoPlayer) {
    videoPlayer.pause();
    videoPlayer.currentTime = 0;
  }

  // Close mini player
  closeMiniPlayer();
}

// Download current media
function downloadCurrentMedia() {
  if (!currentMediaData) return;

  const a = document.createElement('a');
  a.href = currentMediaData.url;
  a.download = currentMediaData.title || 'download';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
