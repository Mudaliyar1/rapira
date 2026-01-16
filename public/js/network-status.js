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
  async function checkConnection() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch('/ping', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal
      });
      clearTimeout(timeout);
      return res.ok;
    } catch (e) {
      clearTimeout(timeout);
      return false;
    }
  }

  let currentStatus = 'unknown';
  let checkInProgress = false;

  async function evaluateStatus(reason = 'poll') {
    // Prevent multiple simultaneous checks
    if (checkInProgress) return;
    checkInProgress = true;

    // If browser says offline, show immediately without ping
    if (!navigator.onLine) {
      if (currentStatus !== 'offline') {
        currentStatus = 'offline';
        console.log('Network: confirmed offline via navigator');
        showOffline();
      }
      checkInProgress = false;
      return;
    }

    // Browser says online, verify with ping
    const reachable = await checkConnection();
    const nextStatus = reachable ? 'online' : 'offline';

    if (nextStatus !== currentStatus) {
      currentStatus = nextStatus;
      if (nextStatus === 'online') {
        console.log('Network: confirmed online via', reason);
        showOnline();
      } else {
        console.log('Network: confirmed offline via', reason);
        showOffline();
      }
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
    // Initial check
    evaluateStatus('initial');

    // Listen for online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic verification to catch Wi-Fi without internet
    setInterval(() => evaluateStatus('periodic'), 20000);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
