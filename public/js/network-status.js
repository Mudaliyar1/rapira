// Network Status Monitor
(function() {
  'use strict';

  // Create notification element
  function createNotification() {
    const notification = document.createElement('div');
    notification.id = 'network-status-notification';
    notification.className = 'network-status-notification';
    notification.innerHTML = `
      <div class="network-status-content">
        <i class="bi bi-wifi-off"></i>
        <span class="network-status-text">You're offline. Check your internet connection.</span>
      </div>
    `;
    document.body.appendChild(notification);
    return notification;
  }

  // Create offline screen overlay
  function createOfflineScreen() {
    const screen = document.createElement('div');
    screen.id = 'offline-screen';
    screen.className = 'offline-screen';
    screen.innerHTML = `
      <div class="offline-card">
        <div class="offline-brand">RAPIRA</div>
        <div class="offline-radar">
          <div class="ring ring-1"></div>
          <div class="ring ring-2"></div>
          <i class="bi bi-wifi-off"></i>
        </div>
        <h2>No internet connection</h2>
        <p class="offline-text">Reconnect to continue. We will keep checking for you.</p>
      </div>
    `;
    document.body.appendChild(screen);
    return screen;
  }

  // Get or create offline screen
  function getOfflineScreen() {
    let screen = document.getElementById('offline-screen');
    if (!screen) {
      screen = createOfflineScreen();
    }
    return screen;
  }

  // Get or create notification
  function getNotification() {
    let notification = document.getElementById('network-status-notification');
    if (!notification) {
      notification = createNotification();
    }
    return notification;
  }

  // Show offline notification
  function showOffline() {
    const notification = getNotification();
    const icon = notification.querySelector('i');
    const text = notification.querySelector('.network-status-text');
    
    icon.className = 'bi bi-wifi-off';
    text.textContent = "You're offline. Check your internet connection.";
    notification.classList.remove('online');
    notification.classList.add('offline', 'show');

    const screen = getOfflineScreen();
    screen.classList.add('show');
    document.body.classList.add('offline-lock');
  }

  // Show online notification
  function showOnline() {
    const notification = getNotification();
    const icon = notification.querySelector('i');
    const text = notification.querySelector('.network-status-text');
    
    icon.className = 'bi bi-wifi';
    text.textContent = "You're back online!";
    notification.classList.remove('offline');
    notification.classList.add('online', 'show');

    const screen = document.getElementById('offline-screen');
    if (screen) {
      screen.classList.remove('show');
    }
    document.body.classList.remove('offline-lock');

    // Auto-hide online notification after 3 seconds
    setTimeout(() => {
      notification.classList.remove('show');
    }, 3000);
  }

  // Connectivity check with timeout to detect captive/blocked Wi-Fi
  async function checkConnection(isInitialCheck = false) {
    // Use longer timeouts for initial checks to handle slow connections
    const localTimeout = isInitialCheck ? 8000 : 5000;
    const externalTimeout = isInitialCheck ? 10000 : 7000;
    
    // Try local server first (fastest)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), localTimeout);
      
      const res = await fetch('/ping', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      if (res.ok) return true;
    } catch (e) {
      // Local check failed, continue to external check
    }
    
    // Try multiple external URLs as fallback
    const urls = [
      'https://www.google.com/favicon.ico',
      'https://www.cloudflare.com/favicon.ico',
      'https://www.github.com/favicon.ico'
    ];
    
    for (const url of urls) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), externalTimeout);
        
        await fetch(url, {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-cache',
          signal: controller.signal
        });
        
        clearTimeout(timeout);
        return true; // Successfully reached external URL
      } catch (e) {
        // Try next URL
        continue;
      }
    }
    
    return false; // All checks failed
  }

  let currentStatus = 'unknown';
  let checkInProgress = false;
  let retryCount = 0;
  let consecutiveFailures = 0;
  let initialCheckDone = false;

  async function evaluateStatus(reason = 'poll', skipIfChecking = false, silent = false) {
    // Prevent multiple simultaneous checks
    if (checkInProgress && skipIfChecking) return;
    if (checkInProgress) {
      console.log('Check already in progress, skipping');
      return;
    }
    checkInProgress = true;

    const isInitialCheck = reason === 'initial' || reason === 'initial-retry';

    // If browser says offline, show immediately without ping
    if (!navigator.onLine) {
      if (currentStatus !== 'offline') {
        currentStatus = 'offline';
        consecutiveFailures++;
        console.log('Network: confirmed offline via navigator');
        showOffline();
      }
      checkInProgress = false;
      return;
    }

    // Browser says online, verify with ping
    const reachable = await checkConnection(isInitialCheck);
    const nextStatus = reachable ? 'online' : 'offline';

    // Track consecutive failures
    if (reachable) {
      consecutiveFailures = 0;
    } else {
      consecutiveFailures++;
    }

    if (nextStatus !== currentStatus) {
      currentStatus = nextStatus;
      if (nextStatus === 'online') {
        console.log('Network: confirmed online via', reason);
        retryCount = 0;
        consecutiveFailures = 0;
        initialCheckDone = true;
        
        // Only show notification if we're recovering from offline, not on initial load
        if (reason !== 'initial' && reason !== 'initial-retry' && !silent) {
          showOnline();
        } else {
          // Just update status silently on initial load
          const screen = document.getElementById('offline-screen');
          if (screen) {
            screen.classList.remove('show');
          }
          document.body.classList.remove('offline-lock');
        }
      } else {
        console.log('Network: detected offline via', reason, '- failures:', consecutiveFailures);
        
        // On initial check, require multiple failures before showing offline screen
        if (isInitialCheck && consecutiveFailures < 2) {
          console.log('Initial check failed, retrying before showing offline (attempt', consecutiveFailures, ')');
          retryCount++;
          setTimeout(() => {
            checkInProgress = false;
            evaluateStatus('initial-retry', false, true);
          }, 3000);
        } else if (reason === 'initial-retry' && retryCount < 2) {
          // Additional retry on initial check
          retryCount++;
          console.log('Initial retry', retryCount, 'of 2...');
          setTimeout(() => {
            checkInProgress = false;
            evaluateStatus('initial-retry', false, true);
          }, 3000);
        } else {
          // Show offline only after confirming multiple times
          showOffline();
          initialCheckDone = true;
        }
      }
    } else if (currentStatus === 'offline' && navigator.onLine && consecutiveFailures < 3) {
      // We think we're offline but navigator says online - try to recover
      retryCount++;
      console.log('Attempting recovery check...', retryCount);
      setTimeout(() => {
        checkInProgress = false;
        evaluateStatus('recovery', false, true);
      }, 3000);
    } else if (isInitialCheck && currentStatus === 'unknown') {
      // Initial check didn't change status (no connection check was attempted), assume online
      currentStatus = 'online';
      initialCheckDone = true;
      console.log('Initial check: assuming online');
    }
    
    checkInProgress = false;
  }

  // Handle online event
  function handleOnline() {
    evaluateStatus('online-event');
  }

  // Handle offline event
  function handleOffline() {
    evaluateStatus('offline-event');
  }

  // Initialize
  function init() {
    // Delay initial check to allow page to fully load before checking connectivity
    // This prevents false negatives from checking too early
    setTimeout(() => {
      console.log('Starting delayed initial connectivity check...');
      evaluateStatus('initial');
    }, 2000);

    // Listen for online/offline events (these are automatic browser events)
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Only check periodically if we're showing offline screen (to detect when internet returns)
    // This helps users see when they're back online
    setInterval(() => {
      if (currentStatus === 'offline' && navigator.onLine) {
        console.log('Attempting recovery check (offline → online transition)...');
        evaluateStatus('periodic-recovery', true);
      }
    }, 30000);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
