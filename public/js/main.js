document.addEventListener('DOMContentLoaded', function () {
  // Login Timer Functionality
  const loginTimerValue = document.getElementById('loginTimerValue');
  const loginTimerDisplay = document.getElementById('loginTimerDisplay');

  // Function to start the login timer
  function startLoginTimer() {
    // Check if the timer element exists (user is logged in)
    if (!loginTimerValue) return;

    // Get the login time from localStorage or set current time as login time
    let loginTime = localStorage.getItem('loginTime');

    // If no login time is stored, set it to the current time
    if (!loginTime) {
      loginTime = new Date().getTime();
      localStorage.setItem('loginTime', loginTime);
    } else {
      // Convert stored string to number
      loginTime = parseInt(loginTime);
    }

    // Update the timer display every second
    function updateTimer() {
      const currentTime = new Date().getTime();
      const elapsedTime = currentTime - loginTime;

      // Convert elapsed time to hours, minutes, seconds
      const hours = Math.floor(elapsedTime / (1000 * 60 * 60));
      const minutes = Math.floor((elapsedTime % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((elapsedTime % (1000 * 60)) / 1000);

      // Format the time as HH:MM:SS
      const formattedTime =
        (hours < 10 ? '0' + hours : hours) + ':' +
        (minutes < 10 ? '0' + minutes : minutes) + ':' +
        (seconds < 10 ? '0' + seconds : seconds);

      // Update the display
      loginTimerValue.textContent = formattedTime;

      // Add tooltip with login date and time if Bootstrap is available
      if (typeof bootstrap !== 'undefined' && loginTimerDisplay) {
        const loginDate = new Date(parseInt(loginTime));
        const loginDateString = loginDate.toLocaleString();

        if (!loginTimerDisplay._tooltip) {
          loginTimerDisplay.setAttribute('data-bs-toggle', 'tooltip');
          loginTimerDisplay.setAttribute('data-bs-placement', 'bottom');
          loginTimerDisplay.setAttribute('title', 'Logged in since: ' + loginDateString);
          loginTimerDisplay._tooltip = new bootstrap.Tooltip(loginTimerDisplay);
        }
      }
    }

    // Update immediately and then every second
    updateTimer();
    setInterval(updateTimer, 1000);

    // Add click handler to reset the timer
    if (loginTimerDisplay) {
      loginTimerDisplay.addEventListener('click', function () {
        // Reset the login time to current time
        const newLoginTime = new Date().getTime();
        localStorage.setItem('loginTime', newLoginTime);

        // Show a brief message
        const originalText = loginTimerValue.textContent;
        loginTimerValue.textContent = 'Reset!';

        // Restore the timer after a brief delay
        setTimeout(() => {
          updateTimer();
        }, 1000);
      });
    }
  }

  // Initialize the login timer
  startLoginTimer();

  // Cart functionality
  function updateCartCount() {
    // Only update cart count if user is logged in
    const cartCountElement = document.getElementById('cartCount');
    if (!cartCountElement) return;

    fetch('/shop/cart/count')
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          const count = data.count || 0;
          cartCountElement.textContent = count;

          if (count > 0) {
            cartCountElement.style.display = 'inline-block';
          } else {
            cartCountElement.style.display = 'none';
          }
        }
      })
      .catch(error => {
        console.error('Error fetching cart count:', error);
      });
  }

  // Update cart count on page load
  updateCartCount();

  // Update cart count every 30 seconds to sync across tabs
  setInterval(updateCartCount, 30000);

  // Listen for cart updates from other parts of the application
  window.addEventListener('cartUpdated', function (event) {
    if (event.detail && typeof event.detail.count !== 'undefined') {
      const cartCountElement = document.getElementById('cartCount');
      if (cartCountElement) {
        const count = event.detail.count;
        cartCountElement.textContent = count;

        if (count > 0) {
          cartCountElement.style.display = 'inline-block';
        } else {
          cartCountElement.style.display = 'none';
        }
      }
    } else {
      // Fallback to fetching from server
      updateCartCount();
    }
  });

  // Helper function to trigger cart update event
  window.updateCartCount = function (count) {
    const event = new CustomEvent('cartUpdated', {
      detail: { count: count }
    });
    window.dispatchEvent(event);
  };

  // Handle logout - clear login time when user logs out
  const logoutLinks = document.querySelectorAll('a[href="/auth/logout"]');
  if (logoutLinks.length > 0) {
    logoutLinks.forEach(link => {
      link.addEventListener('click', function () {
        // Clear the login time from localStorage
        localStorage.removeItem('loginTime');
      });
    });
  }

  // Internet Speed Measurement
  const internetSpeedValue = document.getElementById('internetSpeedValue');

  // Function to measure internet speed
  function measureInternetSpeed() {
    // Check if Network Information API is available
    if (navigator.connection && navigator.connection.downlink) {
      // Use Network Information API
      const speedMbps = navigator.connection.downlink;
      updateSpeedDisplay(speedMbps);

      // Listen for connection changes
      navigator.connection.addEventListener('change', function () {
        updateSpeedDisplay(navigator.connection.downlink);
      });

      // Even with Network Information API, periodically measure actual speed
      // as the API sometimes provides theoretical values rather than actual speed
      setInterval(measureSpeedByDownload, 10000); // Check every 10 seconds
    } else {
      // Fallback method - download a test file and measure time
      measureSpeedByDownload();

      // Update speed more frequently (every 10 seconds) for real-time display
      setInterval(measureSpeedByDownload, 10000);
    }
  }

  // Function to measure speed by downloading a test file
  function measureSpeedByDownload() {
    // Use a timestamp to prevent caching
    const timestamp = new Date().getTime();
    const startTime = performance.now(); // More precise timing

    // Use multiple test files of different sizes for more accurate measurement
    const testFiles = [
      { url: '/images/pattern.png', size: 2.217 }, // 2.217 KB
      { url: '/images/pattern.svg', size: 0.628 }  // 0.628 KB
    ];

    // Randomly select a test file to prevent caching patterns
    const testFile = testFiles[Math.floor(Math.random() * testFiles.length)];
    const url = testFile.url;
    const downloadSize = testFile.size; // Size in KB

    // Show measuring indicator
    if (internetSpeedValue) {
      internetSpeedValue.textContent = 'Measuring...';
    }

    fetch(url + '?t=' + timestamp, {
      cache: 'no-store',
      mode: 'no-cors',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
      .then(response => response.blob())
      .then(data => {
        const endTime = performance.now(); // More precise timing
        const duration = (endTime - startTime) / 1000; // seconds
        const bitsLoaded = downloadSize * 8 * 1024; // convert KB to bits
        const speedBps = bitsLoaded / duration;
        const speedKbps = speedBps / 1024;
        const speedMbps = speedKbps / 1024;

        // Store the last few measurements for smoothing
        if (!window.speedMeasurements) {
          window.speedMeasurements = [];
        }

        // Keep only the last 3 measurements
        window.speedMeasurements.push(speedMbps);
        if (window.speedMeasurements.length > 3) {
          window.speedMeasurements.shift();
        }

        // Calculate average speed from the last few measurements
        const avgSpeed = window.speedMeasurements.reduce((sum, speed) => sum + speed, 0) /
          window.speedMeasurements.length;

        updateSpeedDisplay(avgSpeed);
      })
      .catch(error => {
        console.error('Error measuring download speed:', error);
        if (internetSpeedValue) {
          internetSpeedValue.textContent = 'Offline';
          internetSpeedValue.parentElement.classList.remove('speed-slow', 'speed-medium', 'speed-fast');
        }
      });
  }

  // Function to update the speed display
  function updateSpeedDisplay(speedMbps) {
    if (!internetSpeedValue) return;

    // Remove existing speed classes
    internetSpeedValue.parentElement.classList.remove('speed-slow', 'speed-medium', 'speed-fast');

    // Format the speed and add appropriate class
    if (speedMbps < 0.1) {
      // Very slow connection
      internetSpeedValue.textContent = (speedMbps * 1000).toFixed(0) + ' Kbps';
      internetSpeedValue.parentElement.classList.add('speed-slow');
      internetSpeedValue.parentElement.querySelector('i').className = 'bi bi-speedometer2 me-1';
    } else if (speedMbps < 1) {
      // Slow connection
      internetSpeedValue.textContent = (speedMbps * 1000).toFixed(0) + ' Kbps';
      internetSpeedValue.parentElement.classList.add('speed-slow');
      internetSpeedValue.parentElement.querySelector('i').className = 'bi bi-speedometer me-1';
    } else if (speedMbps < 5) {
      // Medium connection
      internetSpeedValue.textContent = speedMbps.toFixed(1) + ' Mbps';
      internetSpeedValue.parentElement.classList.add('speed-medium');
      internetSpeedValue.parentElement.querySelector('i').className = 'bi bi-speedometer2 me-1';
    } else if (speedMbps < 20) {
      // Fast connection
      internetSpeedValue.textContent = speedMbps.toFixed(1) + ' Mbps';
      internetSpeedValue.parentElement.classList.add('speed-fast');
      internetSpeedValue.parentElement.querySelector('i').className = 'bi bi-speedometer2 me-1';
    } else {
      // Very fast connection
      internetSpeedValue.textContent = speedMbps.toFixed(1) + ' Mbps';
      internetSpeedValue.parentElement.classList.add('speed-fast');
      internetSpeedValue.parentElement.querySelector('i').className = 'bi bi-speedometer me-1';
    }

    // Add a tooltip with connection quality description
    let connectionQuality = '';
    if (speedMbps < 1) {
      connectionQuality = 'Slow connection - Basic browsing only';
    } else if (speedMbps < 5) {
      connectionQuality = 'Medium connection - Good for standard streaming';
    } else if (speedMbps < 20) {
      connectionQuality = 'Fast connection - Good for HD streaming';
    } else {
      connectionQuality = 'Very fast connection - Excellent for all activities';
    }

    // Update tooltip if Bootstrap is available
    if (typeof bootstrap !== 'undefined') {
      if (!internetSpeedValue.parentElement._tooltip) {
        internetSpeedValue.parentElement.setAttribute('data-bs-toggle', 'tooltip');
        internetSpeedValue.parentElement.setAttribute('data-bs-placement', 'bottom');
        internetSpeedValue.parentElement.setAttribute('title', connectionQuality);
        internetSpeedValue.parentElement._tooltip = new bootstrap.Tooltip(internetSpeedValue.parentElement);
      } else {
        internetSpeedValue.parentElement.setAttribute('data-bs-original-title', connectionQuality);
        internetSpeedValue.parentElement._tooltip.update();
      }
    }
  }

  // Initialize speed measurement if the display element exists
  if (internetSpeedValue) {
    // Add click handler to run a new speed test on demand
    internetSpeedValue.parentElement.addEventListener('click', function () {
      // Show measuring indicator
      internetSpeedValue.textContent = 'Testing...';

      // Clear previous measurements to get a fresh reading
      window.speedMeasurements = [];

      // Run a new speed test
      measureSpeedByDownload();
    });

    // Start the automatic speed measurement
    measureInternetSpeed();
  }

  // Check if artist sidebar is open on mobile and hide the toggle button
  const artistToggle = document.getElementById('artistToggle');
  const artistSidebarElement = document.getElementById('artistSidebar');

  if (window.innerWidth < 992 && artistSidebarElement && artistSidebarElement.classList.contains('show') && artistToggle) {
    artistToggle.style.display = 'none';
  }

  // Add smooth scroll behavior
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;

      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // Add animation classes to elements when they come into view
  const animateOnScroll = function () {
    const elements = document.querySelectorAll('.animate-on-scroll');

    elements.forEach(element => {
      const elementPosition = element.getBoundingClientRect().top;
      const windowHeight = window.innerHeight;

      if (elementPosition < windowHeight - 50) {
        const animationClass = element.dataset.animation || 'animate-fadeIn';
        element.classList.add(animationClass);
      }
    });
  };

  // Run once on page load
  animateOnScroll();

  // Run on scroll
  window.addEventListener('scroll', animateOnScroll);

  // Initialize tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });

  // Initialize popovers
  const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
  popoverTriggerList.map(function (popoverTriggerEl) {
    return new bootstrap.Popover(popoverTriggerEl);
  });

  // Password visibility toggle functionality
  window.togglePasswordVisibility = function (inputId, buttonElement) {
    try {
      const passwordInput = document.getElementById(inputId);
      const icon = buttonElement.querySelector('i');

      if (!passwordInput || !icon) {
        console.error('Password input or icon not found');
        return;
      }

      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.classList.remove('bi-eye');
        icon.classList.add('bi-eye-slash');
        buttonElement.setAttribute('aria-label', 'Hide password');
        buttonElement.setAttribute('title', 'Hide password');
      } else {
        passwordInput.type = 'password';
        icon.classList.remove('bi-eye-slash');
        icon.classList.add('bi-eye');
        buttonElement.setAttribute('aria-label', 'Show password');
        buttonElement.setAttribute('title', 'Show password');
      }
    } catch (error) {
      console.error('Error toggling password visibility:', error);
    }
  };

  // Initialize password toggle buttons
  function initializePasswordToggles() {
    const passwordToggleButtons = document.querySelectorAll('.password-toggle-btn');

    passwordToggleButtons.forEach(button => {
      const targetInputId = button.getAttribute('data-target');
      if (targetInputId) {
        button.addEventListener('click', function (e) {
          e.preventDefault();
          window.togglePasswordVisibility(targetInputId, this);
        });

        // Set initial accessibility attributes
        button.setAttribute('aria-label', 'Show password');
        button.setAttribute('title', 'Show password');
        button.setAttribute('type', 'button');
      }
    });
  }

  // Initialize password toggles
  initializePasswordToggles();

  // Global filter collapse functionality
  function initializeFilterToggles() {
    // Filters are closed by default on all devices
    // They only open when user clicks the toggle button
    const filterCollapses = document.querySelectorAll('#filterCollapse');

    filterCollapses.forEach(filterCollapse => {
      if (filterCollapse) {
        // Ensure filters start closed
        filterCollapse.classList.remove('show');
        const toggleIcon = document.getElementById('filterToggleIcon');
        if (toggleIcon) {
          toggleIcon.classList.remove('bi-chevron-up');
          toggleIcon.classList.add('bi-chevron-down');
        }
      }
    });
  }

  // Initialize filter toggles
  initializeFilterToggles();

  // Newsletter form functionality
  const newsletterForm = document.getElementById('newsletterForm');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', function (e) {
      e.preventDefault();

      const emailInput = this.querySelector('input[type="email"]');
      const submitBtn = this.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.innerHTML;

      // Basic email validation
      const email = emailInput.value.trim();
      if (!email || !isValidEmail(email)) {
        showNotification('Please enter a valid email address', 'error');
        return;
      }

      // Show loading state
      submitBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Subscribing...';
      submitBtn.disabled = true;

      // Simulate API call (replace with actual newsletter subscription logic)
      setTimeout(() => {
        // Reset form
        emailInput.value = '';
        submitBtn.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i>Subscribed!';
        submitBtn.classList.remove('btn-gradient-orange');
        submitBtn.classList.add('btn-success');

        showNotification('Thank you for subscribing to our newsletter!', 'success');

        // Reset button after 3 seconds
        setTimeout(() => {
          submitBtn.innerHTML = originalBtnText;
          submitBtn.disabled = false;
          submitBtn.classList.remove('btn-success');
          submitBtn.classList.add('btn-gradient-orange');
        }, 3000);
      }, 1500);
    });
  }

  // Email validation helper
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Notification helper
  function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    notification.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    // Add to page
    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
  }

  // Initialize all dropdowns
  const dropdownElementList = [].slice.call(document.querySelectorAll('.dropdown-toggle'));
  dropdownElementList.map(function (dropdownToggleEl) {
    return new bootstrap.Dropdown(dropdownToggleEl);
  });

  // Initialize all modals
  const modalElementList = [].slice.call(document.querySelectorAll('.modal'));
  modalElementList.map(function (modalEl) {
    return new bootstrap.Modal(modalEl);
  });

  // Sidebar toggle for admin and artist dashboards
  const adminToggleButtons = document.querySelectorAll('#adminToggle, .admin-toggle, .mobile-toggle, #sidebarToggle');
  const artistToggleButtons = document.querySelectorAll('#artistToggle, #sidebarToggle');
  const adminSidebar = document.getElementById('adminSidebar');
  const artistSidebar = document.getElementById('artistSidebar');
  const producerSidebar = document.getElementById('producerSidebar');
  const distributorSidebar = document.getElementById('distributorSidebar');
  const adminContent = document.querySelector('.admin-content');
  const closeSidebar = document.getElementById('closeSidebar');

  // Check for saved sidebar state or default to open
  const savedSidebarState = localStorage.getItem('sidebarState') || 'open';
  const savedArtistSidebarState = localStorage.getItem('artistSidebarState') || 'open';
  const savedProducerSidebarState = localStorage.getItem('producerSidebarState') || 'open';
  const savedDistributorSidebarState = localStorage.getItem('distributorSidebarState') || 'open';

  // Apply the saved sidebar state on page load for admin
  if (savedSidebarState === 'closed' && adminSidebar && adminContent) {
    adminSidebar.classList.add('collapsed');
    adminContent.classList.add('expanded');
  }

  // Apply the saved sidebar state on page load for artist
  if (savedArtistSidebarState === 'closed' && artistSidebar && adminContent) {
    artistSidebar.classList.add('collapsed');
    adminContent.classList.add('expanded');
  }

  // Apply the saved sidebar state on page load for producer
  if (savedProducerSidebarState === 'closed' && producerSidebar && adminContent) {
    producerSidebar.classList.add('collapsed');
    adminContent.classList.add('expanded');
  }

  // Apply the saved sidebar state on page load for distributor
  if (savedDistributorSidebarState === 'closed' && distributorSidebar && adminContent) {
    distributorSidebar.classList.add('collapsed');
    adminContent.classList.add('expanded');
  }

  // Function to toggle admin sidebar
  function toggleAdminSidebar() {
    if (!adminSidebar) return;

    if (window.innerWidth < 992) {
      // Mobile behavior - use show/hide with overlay
      adminSidebar.classList.toggle('show');

      // Create and manage overlay for mobile
      if (adminSidebar.classList.contains('show')) {
        // Create overlay if it doesn't exist
        if (!document.querySelector('.sidebar-overlay')) {
          const overlay = document.createElement('div');
          overlay.className = 'sidebar-overlay';
          overlay.style.position = 'fixed';
          overlay.style.top = '0';
          overlay.style.left = '0';
          overlay.style.width = '100%';
          overlay.style.height = '100%';
          overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
          overlay.style.zIndex = '999';
          overlay.style.display = 'none';
          document.body.appendChild(overlay);

          // Add click event to close sidebar when overlay is clicked
          overlay.addEventListener('click', function () {
            adminSidebar.classList.remove('show');
            this.style.display = 'none';
          });
        }
        document.querySelector('.sidebar-overlay').style.display = 'block';
      } else {
        if (document.querySelector('.sidebar-overlay')) {
          document.querySelector('.sidebar-overlay').style.display = 'none';
        }
      }
    } else {
      // Desktop behavior - use collapsed/expanded
      adminSidebar.classList.toggle('collapsed');
      if (adminContent) adminContent.classList.toggle('expanded');

      // Save sidebar state to localStorage
      if (adminSidebar.classList.contains('collapsed')) {
        localStorage.setItem('sidebarState', 'closed');
      } else {
        localStorage.setItem('sidebarState', 'open');
      }
    }

    // Force a small delay to ensure the transition completes properly
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 300);
  }

  // Function to toggle artist sidebar
  function toggleArtistSidebar() {
    if (!artistSidebar) return;

    if (window.innerWidth < 992) {
      // Mobile behavior - use show/hide with overlay
      artistSidebar.classList.toggle('show');

      // Create and manage overlay for mobile
      if (artistSidebar.classList.contains('show')) {
        // Create overlay if it doesn't exist
        if (!document.querySelector('.sidebar-overlay')) {
          const overlay = document.createElement('div');
          overlay.className = 'sidebar-overlay';
          overlay.style.position = 'fixed';
          overlay.style.top = '0';
          overlay.style.left = '0';
          overlay.style.width = '100%';
          overlay.style.height = '100%';
          overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
          overlay.style.zIndex = '999';
          overlay.style.display = 'none';
          document.body.appendChild(overlay);

          // Add click event to close sidebar when overlay is clicked
          overlay.addEventListener('click', function () {
            artistSidebar.classList.remove('show');
            this.style.display = 'none';
          });
        }
        document.querySelector('.sidebar-overlay').style.display = 'block';
      } else {
        if (document.querySelector('.sidebar-overlay')) {
          document.querySelector('.sidebar-overlay').style.display = 'none';
        }
      }
    } else {
      // Desktop behavior - use collapsed/expanded
      artistSidebar.classList.toggle('collapsed');
      if (adminContent) adminContent.classList.toggle('expanded');

      // Save sidebar state to localStorage
      if (artistSidebar.classList.contains('collapsed')) {
        localStorage.setItem('artistSidebarState', 'closed');
      } else {
        localStorage.setItem('artistSidebarState', 'open');
      }
    }

    // Force a small delay to ensure the transition completes properly
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 300);
  }

  // Function to toggle producer sidebar
  function toggleProducerSidebar() {
    if (!producerSidebar) return;

    if (window.innerWidth < 992) {
      // Mobile behavior - use show/hide with overlay
      producerSidebar.classList.toggle('show');

      // Create and manage overlay for mobile
      if (producerSidebar.classList.contains('show')) {
        // Create overlay if it doesn't exist
        if (!document.querySelector('.sidebar-overlay')) {
          const overlay = document.createElement('div');
          overlay.className = 'sidebar-overlay';
          overlay.style.position = 'fixed';
          overlay.style.top = '0';
          overlay.style.left = '0';
          overlay.style.width = '100%';
          overlay.style.height = '100%';
          overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
          overlay.style.zIndex = '999';
          overlay.style.display = 'none';
          document.body.appendChild(overlay);

          // Add click event to close sidebar when overlay is clicked
          overlay.addEventListener('click', function () {
            producerSidebar.classList.remove('show');
            this.style.display = 'none';
          });
        }
        document.querySelector('.sidebar-overlay').style.display = 'block';
      } else {
        if (document.querySelector('.sidebar-overlay')) {
          document.querySelector('.sidebar-overlay').style.display = 'none';
        }
      }
    } else {
      // Desktop behavior - use collapsed/expanded
      producerSidebar.classList.toggle('collapsed');
      if (adminContent) adminContent.classList.toggle('expanded');

      // Save sidebar state to localStorage
      if (producerSidebar.classList.contains('collapsed')) {
        localStorage.setItem('producerSidebarState', 'closed');
      } else {
        localStorage.setItem('producerSidebarState', 'open');
      }
    }

    // Force a small delay to ensure the transition completes properly
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 300);
  }

  // Function to toggle distributor sidebar
  function toggleDistributorSidebar() {
    if (!distributorSidebar) return;

    if (window.innerWidth < 992) {
      // Mobile behavior - use show/hide with overlay
      distributorSidebar.classList.toggle('show');

      // Create and manage overlay for mobile
      if (distributorSidebar.classList.contains('show')) {
        // Create overlay if it doesn't exist
        if (!document.querySelector('.sidebar-overlay')) {
          const overlay = document.createElement('div');
          overlay.className = 'sidebar-overlay';
          overlay.style.position = 'fixed';
          overlay.style.top = '0';
          overlay.style.left = '0';
          overlay.style.width = '100%';
          overlay.style.height = '100%';
          overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
          overlay.style.zIndex = '999';
          overlay.style.display = 'none';
          document.body.appendChild(overlay);

          // Add click event to close sidebar when overlay is clicked
          overlay.addEventListener('click', function () {
            distributorSidebar.classList.remove('show');
            this.style.display = 'none';
          });
        }
        document.querySelector('.sidebar-overlay').style.display = 'block';
      } else {
        if (document.querySelector('.sidebar-overlay')) {
          document.querySelector('.sidebar-overlay').style.display = 'none';
        }
      }
    } else {
      // Desktop behavior - use collapsed/expanded
      distributorSidebar.classList.toggle('collapsed');
      if (adminContent) adminContent.classList.toggle('expanded');

      // Save sidebar state to localStorage
      if (distributorSidebar.classList.contains('collapsed')) {
        localStorage.setItem('distributorSidebarState', 'closed');
      } else {
        localStorage.setItem('distributorSidebarState', 'open');
      }
    }

    // Force a small delay to ensure the transition completes properly
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 300);
  }

  // Add click event to all admin toggle buttons
  if (adminToggleButtons.length > 0) {
    adminToggleButtons.forEach(button => {
      button.addEventListener('click', toggleAdminSidebar);
    });
  }

  // Add click event to all artist toggle buttons
  if (artistToggleButtons.length > 0) {
    artistToggleButtons.forEach(button => {
      button.addEventListener('click', toggleArtistSidebar);
    });
  }

  // Add click event to producer sidebar toggle
  if (producerSidebar && document.getElementById('sidebarToggle')) {
    document.getElementById('sidebarToggle').addEventListener('click', toggleProducerSidebar);
  }

  // Add click event to distributor sidebar toggle
  if (distributorSidebar && document.getElementById('sidebarToggle')) {
    document.getElementById('sidebarToggle').addEventListener('click', toggleDistributorSidebar);
  }

  // Close sidebar button
  if (closeSidebar) {
    closeSidebar.addEventListener('click', function () {
      // Check which sidebar is present
      const isAdminSidebar = !!adminSidebar;
      const isArtistSidebar = !!artistSidebar;
      const isProducerSidebar = !!producerSidebar;
      const isDistributorSidebar = !!distributorSidebar;

      if (window.innerWidth < 992) {
        // Mobile behavior
        if (isAdminSidebar) {
          adminSidebar.classList.remove('show');
        }
        if (isArtistSidebar) {
          artistSidebar.classList.remove('show');
        }
        if (isProducerSidebar) {
          producerSidebar.classList.remove('show');
        }
        if (isDistributorSidebar) {
          distributorSidebar.classList.remove('show');
        }
        if (document.querySelector('.sidebar-overlay')) {
          document.querySelector('.sidebar-overlay').style.display = 'none';
        }
      } else {
        // Desktop behavior
        if (isAdminSidebar) {
          adminSidebar.classList.add('collapsed');
          if (adminContent) adminContent.classList.add('expanded');
          localStorage.setItem('sidebarState', 'closed');
        }
        if (isArtistSidebar) {
          artistSidebar.classList.add('collapsed');
          if (adminContent) adminContent.classList.add('expanded');
          localStorage.setItem('artistSidebarState', 'closed');
        }
        if (isProducerSidebar) {
          producerSidebar.classList.add('collapsed');
          if (adminContent) adminContent.classList.add('expanded');
          localStorage.setItem('producerSidebarState', 'closed');
        }
        if (isDistributorSidebar) {
          distributorSidebar.classList.add('collapsed');
          if (adminContent) adminContent.classList.add('expanded');
          localStorage.setItem('distributorSidebarState', 'closed');
        }
      }
    });
  }

  // Close sidebar when clicking outside on mobile
  document.addEventListener('click', function (e) {
    // For admin sidebar
    if (adminSidebar &&
      window.innerWidth < 992 &&
      adminSidebar.classList.contains('show') &&
      !adminSidebar.contains(e.target) &&
      !e.target.closest('#adminToggle') &&
      !e.target.closest('#sidebarToggle') &&
      !e.target.closest('.admin-toggle') &&
      !e.target.closest('.mobile-toggle')) {
      adminSidebar.classList.remove('show');
      if (document.querySelector('.sidebar-overlay')) {
        document.querySelector('.sidebar-overlay').style.display = 'none';
      }
    }

    // For producer sidebar
    if (producerSidebar &&
      window.innerWidth < 992 &&
      producerSidebar.classList.contains('show') &&
      !producerSidebar.contains(e.target) &&
      !e.target.closest('#sidebarToggle')) {
      producerSidebar.classList.remove('show');
      if (document.querySelector('.sidebar-overlay')) {
        document.querySelector('.sidebar-overlay').style.display = 'none';
      }
    }

    // For artist sidebar
    if (artistSidebar &&
      window.innerWidth < 992 &&
      artistSidebar.classList.contains('show') &&
      !artistSidebar.contains(e.target) &&
      !e.target.closest('#artistToggle') &&
      !e.target.closest('#sidebarToggle') &&
      !e.target.closest('.admin-toggle') &&
      !e.target.closest('.mobile-toggle')) {
      artistSidebar.classList.remove('show');
      if (document.querySelector('.sidebar-overlay')) {
        document.querySelector('.sidebar-overlay').style.display = 'none';
      }
    }

    // For distributor sidebar
    if (distributorSidebar &&
      window.innerWidth < 992 &&
      distributorSidebar.classList.contains('show') &&
      !distributorSidebar.contains(e.target) &&
      !e.target.closest('#sidebarToggle')) {
      distributorSidebar.classList.remove('show');
      if (document.querySelector('.sidebar-overlay')) {
        document.querySelector('.sidebar-overlay').style.display = 'none';
      }
    }
  });

  // Ticket booking - dynamic attendee forms
  const ticketQuantityInput = document.getElementById('ticketQuantity');
  const attendeesContainer = document.getElementById('attendeesContainer');
  const ticketPrice = document.getElementById('ticketPrice');
  const totalAmount = document.getElementById('totalAmount');

  if (ticketQuantityInput && attendeesContainer) {
    ticketQuantityInput.addEventListener('change', function () {
      const quantity = parseInt(this.value);
      updateAttendeesForms(quantity);
      updateTotalAmount(quantity);
    });

    // Initialize with default quantity
    const defaultQuantity = parseInt(ticketQuantityInput.value);
    updateAttendeesForms(defaultQuantity);
    updateTotalAmount(defaultQuantity);

    // Make sure ticket count is initialized correctly
    const ticketCount = document.getElementById('ticketCount');
    if (ticketCount) {
      ticketCount.textContent = defaultQuantity;
    }
  }

  function updateAttendeesForms(quantity) {
    // Clear existing forms
    attendeesContainer.innerHTML = '';

    // Also clear the hidden inputs
    const attendeeDataInputs = document.getElementById('attendeeDataInputs');
    if (attendeeDataInputs) {
      attendeeDataInputs.innerHTML = '';
    }

    // Create new forms based on quantity
    for (let i = 0; i < quantity; i++) {
      const attendeeForm = document.createElement('div');
      attendeeForm.className = 'attendee-form mb-3 glass-card-dark p-3 rounded-3 border-start border-4 border-primary';
      attendeeForm.innerHTML = `
        <h6 class="mb-3 gradient-text-blue">Attendee #${i + 1}</h6>
        <div class="row g-3">
          <div class="col-md-8">
            <label for="attendeeName${i}" class="form-label text-white">Full Name</label>
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-person"></i></span>
              <input type="text" class="form-control" id="attendeeName${i}" required placeholder="Enter full name">
            </div>
          </div>
          <div class="col-md-4">
            <label for="attendeeAge${i}" class="form-label text-white">Age</label>
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-calendar"></i></span>
              <input type="number" class="form-control" id="attendeeAge${i}" min="1" max="120" required placeholder="Age">
            </div>
          </div>
        </div>
      `;
      attendeesContainer.appendChild(attendeeForm);

      // Create hidden input for this attendee
      if (attendeeDataInputs) {
        const hiddenInput = document.createElement('input');
        hiddenInput.type = 'hidden';
        hiddenInput.name = 'attendees';
        hiddenInput.id = `attendeeData${i}`;
        attendeeDataInputs.appendChild(hiddenInput);
      }

      // Add event listeners to combine name and age
      const nameInput = attendeeForm.querySelector(`#attendeeName${i}`);
      const ageInput = attendeeForm.querySelector(`#attendeeAge${i}`);

      nameInput.addEventListener('input', function () {
        updateAttendeeValue(i, nameInput.value, ageInput.value);
      });

      ageInput.addEventListener('input', function () {
        updateAttendeeValue(i, nameInput.value, ageInput.value);
      });
    }
  }

  function updateAttendeeValue(index, name, age) {
    const attendeeInput = document.getElementById(`attendeeData${index}`);
    if (attendeeInput && name && age) {
      attendeeInput.value = `${name}|${age}`;
    }
  }

  function updateTotalAmount(quantity) {
    if (ticketPrice && totalAmount) {
      const price = parseFloat(ticketPrice.dataset.price);
      const total = price * quantity;
      totalAmount.textContent = total.toFixed(2);

      // Update ticket count display
      const ticketCount = document.getElementById('ticketCount');
      if (ticketCount) {
        ticketCount.textContent = quantity;
      }

      // Update hidden input for payment
      const totalAmountInput = document.getElementById('totalAmountInput');
      if (totalAmountInput) {
        totalAmountInput.value = total;
      }
    }
  }

  // Razorpay payment integration
  const razorpayForm = document.getElementById('razorpayForm');

  if (razorpayForm) {
    razorpayForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      // Check if payment agreement checkbox is checked
      const paymentAgreement = document.getElementById('paymentAgreement');
      const checkboxError = document.getElementById('checkboxError');

      if (paymentAgreement && !paymentAgreement.checked) {
        // Show error message with styling
        checkboxError.classList.remove('d-none');
        paymentAgreement.classList.add('is-invalid');

        // Scroll to the checkbox section
        paymentAgreement.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Add visual feedback
        paymentAgreement.style.animation = 'none';
        setTimeout(() => {
          paymentAgreement.style.animation = 'shake 0.5s ease';
        }, 10);

        // Auto-hide error after 5 seconds
        setTimeout(() => {
          checkboxError.classList.add('d-none');
          paymentAgreement.classList.remove('is-invalid');
        }, 5000);

        return; // Stop here, don't proceed without checkbox
      }

      // Clear any previous error states
      checkboxError.classList.add('d-none');
      paymentAgreement.classList.remove('is-invalid');

      // Validate attendee forms
      const attendeeInputs = document.getElementsByName('attendees');
      let isValid = true;
      let emptyFields = [];

      // Check if all attendee inputs have values
      for (let i = 0; i < attendeeInputs.length; i++) {
        const input = attendeeInputs[i];
        if (!input.value) {
          isValid = false;
          emptyFields.push(`Attendee #${i + 1}`);
        }
      }

      // Make sure we have the right number of attendees
      const quantity = parseInt(document.getElementById('ticketQuantity').value);
      if (attendeeInputs.length !== quantity) {
        isValid = false;
        alert(`Number of attendees (${attendeeInputs.length}) doesn't match ticket quantity (${quantity})`);
        return;
      }

      if (!isValid) {
        alert(`Please fill in all attendee details. Missing information for: ${emptyFields.join(', ')}`);
        return;
      }

      // Log the data being sent for debugging
      console.log('Submitting attendee data:', Array.from(attendeeInputs).map(input => input.value));

      // Get form data
      const formData = new FormData(razorpayForm);

      // Convert FormData to JSON object for better handling
      const formDataObj = {};
      formData.forEach((value, key) => {
        // Handle attendees array properly
        if (key === 'attendees') {
          if (!formDataObj[key]) {
            formDataObj[key] = [];
          }
          formDataObj[key].push(value);
        } else {
          formDataObj[key] = value;
        }
      });

      try {
        // Show loading indicator
        const submitBtn = razorpayForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Processing...';

        console.log('Sending payment data:', formDataObj);

        // Create order
        const response = await fetch('/tickets/create-order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formDataObj)
        });

        // Reset button
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;

        // Check if response is OK
        if (!response.ok) {
          let errorData;
          try {
            // Try to parse the error response as JSON
            errorData = await response.json();
            console.error('Payment API error:', response.status, errorData);
          } catch (e) {
            // If not JSON, get as text
            const errorText = await response.text();
            console.error('Payment API error (non-JSON):', response.status, errorText);
            errorData = { message: `Error ${response.status}: ${response.statusText}` };
          }

          // Show a more user-friendly error message
          let errorMessage = errorData.message || `Payment initialization failed (${response.status})`;
          if (errorData.details) {
            errorMessage += `: ${errorData.details}`;
          }

          // For network errors, suggest checking internet connection
          if (response.status === 0 || response.status === 503 || response.status === 504) {
            errorMessage = 'Could not connect to payment service. Please check your internet connection and try again.';
          }

          // For Razorpay minimum amount errors
          if (errorData.details && errorData.details.includes('Order amount less than minimum amount allowed')) {
            errorMessage = 'The payment amount is too small. The minimum amount for payment is ₹1.';
          }

          alert(errorMessage);

          // Re-enable the submit button
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;

          return;
        }

        const data = await response.json();
        console.log('Payment order response:', data);

        if (!data.success) {
          // Handle specific error types
          let errorMessage = data.message || 'Failed to create order';

          if (data.errorType === 'CONFIGURATION_ERROR') {
            errorMessage = 'Payment service is not properly configured. Please contact support.';
          } else if (data.errorType === 'PAYMENT_GATEWAY_ERROR') {
            errorMessage = 'Payment gateway is currently unavailable. Please try again later.';
          } else if (data.errorType === 'NETWORK_ERROR') {
            errorMessage = 'Network error. Please check your internet connection and try again.';
          } else if (data.errorType === 'TIMEOUT') {
            errorMessage = 'Payment gateway timed out. Please try again.';
          }

          // For Razorpay minimum amount errors
          if (data.details && data.details.includes('Order amount less than minimum amount allowed')) {
            errorMessage = 'The payment amount is too small. The minimum amount for payment is ₹1.';
          }

          alert(errorMessage);

          // Re-enable the submit button
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;

          return;
        }

        // Always use real Razorpay payment flow

        // For real orders, initialize Razorpay
        const options = {
          key: data.key,
          amount: data.order.amount,
          currency: data.order.currency,
          name: 'Rapira',
          description: 'Concert Ticket Purchase',
          order_id: data.order.id,
          handler: async function (response) {
            // Use the existing global loader for verification status
            if (window.loaderManager) {
              window.loaderManager.show('Verifying Payment...');
            }

            try {
              // Prepare verification data
              const fields = {
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                ticket_id: data.ticket
              };

              // Call server via AJAX for verification
              // skipLoader: true prevents the global interceptor from hiding the loader automatically
              const verifyResponse = await fetch('/tickets/verify-payment', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(fields),
                skipLoader: true
              });

              if (verifyResponse.ok) {
                if (window.loaderManager) {
                  window.loaderManager.setText('Payment Verified! Redirecting...');
                  // Set isDownloading to prevent loader from flickering on page unload
                  window.loaderManager.isDownloading = true;
                }

                // Direct redirect to ticket page
                window.location.href = `/tickets/${data.ticket}`;
              } else {
                throw new Error('Verification failed. Please contact support.');
              }
            } catch (err) {
              console.error('Verification Error:', err);
              overlay.classList.remove('show');
              alert('Payment verification failed. If your money was deducted, please contact support with Order ID: ' + response.razorpay_order_id);
              window.location.href = '/users/profile';
            }
          },
          prefill: {
            name: document.getElementById('userName').value,
            email: document.getElementById('userEmail').value
          },
          theme: {
            color: '#6366f1'
          },
          // Handle payment modal closing
          modal: {
            ondismiss: function () {
              // Redirect to cancel payment route
              window.location.href = `/tickets/cancel-payment/${data.ticket}`;
            },
            escape: true
          }
        };

        try {
          console.log('Initializing Razorpay with options:', options);

          // Check if Razorpay is defined
          if (typeof Razorpay === 'undefined') {
            console.error('Razorpay SDK is not loaded');

            // Try to reload the script dynamically
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.async = true;
            script.onload = function () {
              console.log('Razorpay script loaded dynamically');
              try {
                const rzp = new Razorpay(options);
                rzp.open();
              } catch (err) {
                console.error('Razorpay initialization error after dynamic loading:', err);
                alert(`Payment initialization failed: ${err.message || 'Could not initialize payment gateway'}`);
              }
            };
            script.onerror = function () {
              console.error('Failed to load Razorpay script dynamically');
              alert('Could not connect to payment gateway. Please check your internet connection and try again.');
            };
            document.head.appendChild(script);
            return;
          }

          // Test connection to Razorpay
          fetch('https://api.razorpay.com/v1/orders', {
            method: 'HEAD',
            mode: 'no-cors'
          }).catch(err => {
            console.warn('Razorpay API connectivity test failed:', err);
          });

          const rzp = new Razorpay(options);
          rzp.open();
        } catch (razorpayError) {
          console.error('Razorpay initialization error:', razorpayError);
          alert(`Payment initialization failed: ${razorpayError.message || 'Unknown error connecting to payment gateway'}`);
        }
      } catch (error) {
        console.error('Payment error:', error);
        alert(`Payment initialization failed: ${error.message || 'Unknown error'}`);
      }
    });
  }

  // Admin dashboard charts
  if (typeof Chart !== 'undefined') {
    // Revenue chart
    const revenueCtx = document.getElementById('revenueChart');
    if (revenueCtx) {
      new Chart(revenueCtx, {
        type: 'line',
        data: {
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
          datasets: [{
            label: 'Revenue',
            data: [1200, 1900, 3000, 5000, 2000, 3000, 7000, 8000, 4000, 6000, 9000, 10000],
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            tension: 0.4,
            fill: true
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                display: true,
                color: 'rgba(0, 0, 0, 0.05)'
              }
            },
            x: {
              grid: {
                display: false
              }
            }
          }
        }
      });
    }

    // Concert types chart
    const concertTypesCtx = document.getElementById('concertTypesChart');
    if (concertTypesCtx) {
      new Chart(concertTypesCtx, {
        type: 'doughnut',
        data: {
          labels: ['Paid', 'Free'],
          datasets: [{
            data: [65, 35],
            backgroundColor: ['#6366f1', '#f59e0b'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'bottom'
            }
          },
          cutout: '70%'
        }
      });
    }

    // Popular cities chart
    const citiesCtx = document.getElementById('citiesChart');
    if (citiesCtx) {
      new Chart(citiesCtx, {
        type: 'bar',
        data: {
          labels: ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai'],
          datasets: [{
            label: 'Concerts',
            data: [25, 20, 15, 10, 8],
            backgroundColor: '#6366f1'
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                display: true,
                color: 'rgba(0, 0, 0, 0.05)'
              }
            },
            x: {
              grid: {
                display: false
              }
            }
          }
        }
      });
    }
  }
});