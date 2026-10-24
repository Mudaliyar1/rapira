/**
 * Loading Spinner Manager
 * Handles loading spinners for all redirect buttons and navigation
 */

class LoadingSpinnerManager {
  constructor() {
    this.isLoading = false;
    this.isDownloading = false; // Track download state
    this.currentLoadingText = 'Loading';
    this.debounceTime = 300; // Prevent accidental double clicks
    this.lastClickTime = 0;
    this.init();
  }

  /**
   * Initialize the loading spinner system
   */
  init() {
    // Create the main loading overlay if it doesn't exist
    if (!document.getElementById('loading-overlay')) {
      this.createLoadingOverlay();
    }

    // Create progress bar if it doesn't exist
    if (!document.getElementById('page-loader-bar')) {
      this.createProgressBar();
    }

    // Show spinner on page load/refresh
    this.detectPageLoadOrRefresh();

    // Add event listeners to all redirect buttons
    this.attachRedirectListeners();

    console.log('✓ Loading Spinner Manager initialized');
  }

  /**
   * Detect page load and refresh
   */
  detectPageLoadOrRefresh() {
    // Show spinner on page load
    if (document.readyState === 'loading' || document.readyState === 'interactive') {
      this.show('Loading...');
    }

    // Hide spinner when page fully loads - wait for all resources
    window.addEventListener('load', () => {
      // Wait for all images and resources to fully load
      if (document.readyState === 'complete') {
        setTimeout(() => {
          this.hide();
        }, 300);
      }
    });

    // Additional check - hide spinner when document is interactive and all scripts loaded
    document.addEventListener('DOMContentLoaded', () => {
      // Check again after a delay to ensure everything is ready
      setTimeout(() => {
        if (document.readyState === 'complete' && !this.isLoading) {
          this.hide();
        }
      }, 1000);
    });

    // Listen for page unload/navigation (single listener for all cases)
    window.addEventListener('beforeunload', () => {
      if (this.isDownloading) {
        return;
      }
      const timeSinceLastClick = Date.now() - this.lastClickTime;
      if (timeSinceLastClick < 1000) {
        this.show('Loading...');
      }
    });
  }

  /**
   * Create progress bar element
   */
  createProgressBar() {
    const bar = document.createElement('div');
    bar.id = 'page-loader-bar';
    bar.className = 'page-loader-bar';
    bar.innerHTML = `
      <div class="page-loader-bar-content">
        <div class="page-loader-bar-title">Downloading...</div>
        <div class="page-loader-bar-track">
          <div class="page-loader-bar-fill"></div>
        </div>
        <div class="page-loader-bar-percentage">0%</div>
      </div>
    `;
    document.body.insertBefore(bar, document.body.firstChild);
  }

  /**
   * Create the main loading overlay HTML structure
   */
  createLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
      <div class="spinner-container">
        <div class="spinner"></div>
        <div class="loading-text" id="loading-text">Loading</div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  /**
   * Show the loading spinner with custom text
   */
  show(text = 'Loading...') {
    const overlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');

    if (overlay) {
      this.currentLoadingText = text;
      if (loadingText) {
        loadingText.textContent = text;
      }
      overlay.classList.add('active');
      this.isLoading = true;
    }
  }

  /**
   * Hide the loading spinner
   */
  hide() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      // Only hide if document is complete or we're forcing it
      if (document.readyState === 'complete' || this.isDownloading) {
        overlay.classList.remove('active');
        this.isLoading = false;
      } else {
        // If document not ready, wait a bit and try again
        setTimeout(() => {
          overlay.classList.remove('active');
          this.isLoading = false;
        }, 500);
      }
    }
  }

  /**
   * Toggle loading state
   */
  toggle(text = 'Loading...') {
    if (this.isLoading) {
      this.hide();
    } else {
      this.show(text);
    }
  }

  /**
   * Attach event listeners to redirect buttons
   */
  attachRedirectListeners() {
    // Find all elements that can redirect
    const redirectElements = document.querySelectorAll(
      'a[href]:not([href^="#"]):not([target="_blank"]):not([href^="mailto"]):not([href^="tel"]), ' +
      'button[onclick], ' +
      'form[action]'
    );

    redirectElements.forEach((element) => {
      // Skip if already has a listener or shouldn't show loader
      if (element.dataset.loaderAttached === 'true' || element.dataset.noLoader === 'true') {
        return;
      }

      if (element.tagName === 'A') {
        element.addEventListener('click', (e) => this.handleLinkClick(e, element));
      } else if (element.tagName === 'BUTTON' && !element.type.includes('submit')) {
        element.addEventListener('click', (e) => this.handleButtonClick(e, element));
      } else if (element.tagName === 'FORM') {
        element.addEventListener('submit', (e) => this.handleFormSubmit(e, element));
      }

      element.dataset.loaderAttached = 'true';
    });
  }

  /**
   * Check if a link is for file download
   */
  isDownloadLink(href) {
    if (!href) return false;

    const lowerHref = href.toLowerCase();

    // Check for specific download-related paths (more specific)
    if (lowerHref.includes('/download')) return true;
    if (lowerHref.includes('/export')) return true;
    if (lowerHref.includes('action=download')) return true;
    if (lowerHref.includes('download=')) return true;

    // Common file extensions
    const fileExtensions = [
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.zip', '.rar', '.7z', '.tar', '.gz',
      '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg',
      '.mp3', '.mp4', '.wav', '.flv', '.avi', '.mov',
      '.txt', '.csv', '.json', '.xml'
    ];

    return fileExtensions.some(ext => lowerHref.includes(ext));
  }

  /**
   * Handle link click events
   */
  handleLinkClick(e, element) {
    // Skip if middle-click or control+click (open in new tab)
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) {
      return;
    }

    // Skip if element has data-no-loader attribute
    if (element.dataset.noLoader === 'true') {
      return;
    }

    const href = element.getAttribute('href');
    const hasDownloadAttr = element.hasAttribute('download');
    const isDownload = hasDownloadAttr || this.isDownloadLink(href);

    // Prevent double clicks (but allow downloads through)
    if (!isDownload && (this.isLoading || !this.isDebounceValid())) {
      e.preventDefault();
      return;
    }

    const text = element.dataset.loaderText || element.textContent.trim() || 'Loading...';

    // Add loading class to button for visual feedback
    this.addLoadingStateToElement(element);

    // Show progress bar for downloads, overlay spinner for navigation
    if (isDownload) {
      console.log('🔄 Download detected, showing progress bar for:', href);
      this.isDownloading = true; // Set download flag
      this.showProgressBar();
      // DON'T set isLoading flag for downloads
      // Hide progress bar quickly after download starts
      setTimeout(() => {
        this.hideProgressBar();
        this.removeLoadingStateFromElement(element);
        this.isDownloading = false; // Clear download flag
      }, 1500); // 1.5 seconds for progress bar
    } else {
      console.log('📄 Navigation detected, showing overlay for:', href);
      // Show loading overlay with custom text for navigation
      this.show(`${text}...`);
    }

    // Update last click time
    this.lastClickTime = Date.now();
  }

  /**
   * Handle button click events for navigation
   */
  handleButtonClick(e, element) {
    // Skip if element has data-no-loader attribute
    if (element.dataset.noLoader === 'true') {
      return;
    }

    const onclick = element.getAttribute('onclick');

    // Only show loader if it's a navigation action
    if (onclick && (onclick.includes('location') || onclick.includes('window'))) {
      if (!this.isDebounceValid()) {
        e.preventDefault();
        return;
      }

      const text = element.dataset.loaderText || element.textContent.trim() || 'Loading...';
      this.addLoadingStateToElement(element);
      this.show(`${text}...`);
      this.lastClickTime = Date.now();
    }
  }

  /**
   * Handle form submission
   */
  handleFormSubmit(e, element) {
    // Skip if element has data-no-loader attribute
    if (element.dataset.noLoader === 'true') {
      return;
    }

    // Show loader for all form submissions (including POST like login)
    const text = 'Processing...';
    this.show(text);
    this.lastClickTime = Date.now();
  }

  /**
   * Check if enough time has passed since last click (debounce)
   */
  isDebounceValid() {
    const timeSinceLastClick = Date.now() - this.lastClickTime;
    return timeSinceLastClick > this.debounceTime;
  }

  /**
   * Add loading state visual feedback to element
   */
  addLoadingStateToElement(element) {
    if (element.tagName === 'A') {
      element.style.opacity = '0.6';
      element.style.pointerEvents = 'none';
    } else if (element.tagName === 'BUTTON') {
      element.classList.add('loading');
      element.disabled = true;
    }
  }

  /**
   * Remove loading state from element
   */
  removeLoadingStateFromElement(element) {
    if (element.tagName === 'A') {
      element.style.opacity = '1';
      element.style.pointerEvents = 'auto';
    } else if (element.tagName === 'BUTTON') {
      element.classList.remove('loading');
      element.disabled = false;
    }
  }

  /**
   * Show loading bar at top of page (progress bar style)
   */
  showProgressBar() {
    let bar = document.getElementById('page-loader-bar');

    if (!bar) {
      this.createProgressBar();
      bar = document.getElementById('page-loader-bar');
    }

    // Remove active class first to reset animation
    bar.classList.remove('active');
    // Trigger reflow to restart animation
    bar.offsetHeight;
    // Add active class to trigger animation
    bar.classList.add('active');

    // Animate percentage from 0 to 100
    const percentageEl = bar.querySelector('.page-loader-bar-percentage');
    const fillEl = bar.querySelector('.page-loader-bar-fill');

    let progress = 0;
    const duration = 1500; // 1.5 seconds
    const steps = 60; // 60 frames
    const increment = 100 / steps;
    const interval = duration / steps;

    const timer = setInterval(() => {
      progress += increment;
      if (progress >= 100) {
        progress = 100;
        clearInterval(timer);
      }
      if (percentageEl) percentageEl.textContent = Math.floor(progress) + '%';
      if (fillEl) fillEl.style.width = progress + '%';
    }, interval);

    // Store timer for cleanup
    this.progressTimer = timer;
  }

  /**
   * Hide progress bar
   */
  hideProgressBar() {
    const bar = document.getElementById('page-loader-bar');
    if (bar) {
      bar.classList.remove('active');
    }
    // Clear progress timer
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }

  /**
   * Set custom text for loading
   */
  setText(text) {
    this.currentLoadingText = text;
    const loadingText = document.getElementById('loading-text');
    if (loadingText) {
      loadingText.textContent = text;
    }
  }

  /**
   * Check if currently loading
   */
  isLoadingNow() {
    return this.isLoading;
  }

  /**
   * Update debounce time (in milliseconds)
   */
  setDebounceTime(time) {
    this.debounceTime = time;
  }
}

/**
 * AJAX Handler for Real-time Loader
 * Shows loader when AJAX requests are made
 */
class AjaxLoadingHandler {
  constructor() {
    this.loaderManager = window.loaderManager;
    this.activeRequests = 0;
    this.init();
  }

  init() {
    // Intercept XMLHttpRequest
    this.interceptXHR();

    // Intercept Fetch API
    this.interceptFetch();

    console.log('✓ AJAX Loading Handler initialized');
  }

  /**
   * Intercept XMLHttpRequest
   */
  interceptXHR() {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
      this._ajaxMethod = method;
      this._ajaxUrl = url;
      return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (data) {
      this.addEventListener('loadstart', () => {
        if (this._ajaxMethod !== 'GET') {
          AjaxLoadingHandler.prototype.showLoader.call(this);
        }
      });

      this.addEventListener('loadend', () => {
        AjaxLoadingHandler.prototype.hideLoader.call(this);
      });

      this.addEventListener('error', () => {
        AjaxLoadingHandler.prototype.hideLoader.call(this);
      });

      return originalSend.apply(this, arguments);
    };
  }

  /**
   * Intercept Fetch API
   */
  interceptFetch() {
    const originalFetch = window.fetch;
    const loaderManager = this.loaderManager;

    window.fetch = function (...args) {
      const options = args[1] || {};
      const skipLoader = options.skipLoader || false;
      const method = options.method || 'GET';

      // Show loader for non-GET requests unless skipLoader is true
      if (!skipLoader && method !== 'GET') {
        loaderManager.show('Processing...');
      }

      return originalFetch.apply(window, args)
        .then((response) => {
          if (!skipLoader) {
            loaderManager.hide();
          }
          return response;
        })
        .catch((error) => {
          if (!skipLoader) {
            loaderManager.hide();
          }
          throw error;
        });
    };
  }

  showLoader() {
    if (this.loaderManager) {
      this.loaderManager.show('Loading...');
    }
  }

  hideLoader() {
    if (this.loaderManager) {
      this.loaderManager.hide();
    }
  }
}

/**
 * Initialize on DOM Ready
 */
document.addEventListener('DOMContentLoaded', function () {
  // Create global loader manager instance
  if (!window.loaderManager) {
    window.loaderManager = new LoadingSpinnerManager();

    // Optional: Initialize AJAX handler
    window.ajaxLoadingHandler = new AjaxLoadingHandler();
  }
});

/**
 * Handle browser back/forward buttons - using pageshow event
 */
window.addEventListener('pageshow', function (event) {
  // If page is loaded from cache (back/forward navigation)
  if (event.persisted) {
    window.location.reload();
  }
});

/**
 * Handle browser navigation - alternative approach
 */
window.addEventListener('popstate', function (event) {
  // Show loading spinner
  if (window.loaderManager) {
    window.loaderManager.show('Navigating...');
  }

  // Reload the page
  window.location.reload();
});

/**
 * Detect browser navigation and force reload
 */
(function () {
  // Store the current page in performance navigation
  if (performance.navigation.type === 2) {
    // Page accessed from back/forward button
    window.location.reload();
  }
})();

/**
 * Handle page visibility changes (tab switching)
 */
document.addEventListener('visibilitychange', function () {
  if (document.hidden) {
    window.loaderManager.hide();
  }
});

/**
 * Export for manual use in other scripts
 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    LoadingSpinnerManager,
    AjaxLoadingHandler,
  };
}
