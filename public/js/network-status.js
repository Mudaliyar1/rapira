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

    // Auto-hide online notification after 3 seconds
    setTimeout(() => {
      notification.classList.remove('show');
    }, 3000);
  }

  // Handle online event
  function handleOnline() {
    console.log('Network: Online event detected');
    showOnline();
  }

  // Handle offline event
  function handleOffline() {
    console.log('Network: Offline event detected');
    showOffline();
  }

  // Initialize
  function init() {
    // Check initial status
    if (!navigator.onLine) {
      showOffline();
    }

    // Listen for online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
