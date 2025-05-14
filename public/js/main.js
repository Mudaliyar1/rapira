document.addEventListener('DOMContentLoaded', function() {
  // Theme toggle functionality
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const body = document.body;

  // Check for saved theme preference or use default dark theme
  const savedTheme = localStorage.getItem('theme') || 'dark';

  // Apply the saved theme or default to dark
  if (savedTheme === 'light') {
    body.classList.add('light-theme');
  }

  // Check if artist sidebar is open on mobile and hide the toggle button
  const artistToggle = document.getElementById('artistToggle');
  const artistSidebarElement = document.getElementById('artistSidebar');

  if (window.innerWidth < 992 && artistSidebarElement && artistSidebarElement.classList.contains('show') && artistToggle) {
    artistToggle.style.display = 'none';
  }

  // Handle theme toggle click
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', function() {
      if (body.classList.contains('light-theme')) {
        body.classList.remove('light-theme');
        localStorage.setItem('theme', 'dark');
      } else {
        body.classList.add('light-theme');
        localStorage.setItem('theme', 'light');
      }
    });
  }

  // Add smooth scroll behavior
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
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
  const animateOnScroll = function() {
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
  const adminContent = document.querySelector('.admin-content');
  const closeSidebar = document.getElementById('closeSidebar');

  // Check for saved sidebar state or default to open
  const savedSidebarState = localStorage.getItem('sidebarState') || 'open';
  const savedArtistSidebarState = localStorage.getItem('artistSidebarState') || 'open';

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
          overlay.addEventListener('click', function() {
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
          overlay.addEventListener('click', function() {
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

  // Close sidebar button
  if (closeSidebar) {
    closeSidebar.addEventListener('click', function() {
      // Check which sidebar is present
      const isAdminSidebar = !!adminSidebar;
      const isArtistSidebar = !!artistSidebar;

      if (window.innerWidth < 992) {
        // Mobile behavior
        if (isAdminSidebar) {
          adminSidebar.classList.remove('show');
        }
        if (isArtistSidebar) {
          artistSidebar.classList.remove('show');
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
      }
    });
  }

  // Close sidebar when clicking outside on mobile
  document.addEventListener('click', function(e) {
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
  });

  // Ticket booking - dynamic attendee forms
  const ticketQuantityInput = document.getElementById('ticketQuantity');
  const attendeesContainer = document.getElementById('attendeesContainer');
  const ticketPrice = document.getElementById('ticketPrice');
  const totalAmount = document.getElementById('totalAmount');

  if (ticketQuantityInput && attendeesContainer) {
    ticketQuantityInput.addEventListener('change', function() {
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

      nameInput.addEventListener('input', function() {
        updateAttendeeValue(i, nameInput.value, ageInput.value);
      });

      ageInput.addEventListener('input', function() {
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
    razorpayForm.addEventListener('submit', async function(e) {
      e.preventDefault();

      // Validate attendee forms
      const attendeeInputs = document.getElementsByName('attendees');
      let isValid = true;
      let emptyFields = [];

      // Check if all attendee inputs have values
      for (let i = 0; i < attendeeInputs.length; i++) {
        const input = attendeeInputs[i];
        if (!input.value) {
          isValid = false;
          emptyFields.push(`Attendee #${i+1}`);
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
          handler: function(response) {
            // Create hidden form for payment verification
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = '/tickets/verify-payment';

            const fields = {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              ticket_id: data.ticket
            };

            for (const key in fields) {
              const input = document.createElement('input');
              input.type = 'hidden';
              input.name = key;
              input.value = fields[key];
              form.appendChild(input);
            }

            document.body.appendChild(form);
            form.submit();
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
            ondismiss: function() {
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
            script.onload = function() {
              console.log('Razorpay script loaded dynamically');
              try {
                const rzp = new Razorpay(options);
                rzp.open();
              } catch (err) {
                console.error('Razorpay initialization error after dynamic loading:', err);
                alert(`Payment initialization failed: ${err.message || 'Could not initialize payment gateway'}`);
              }
            };
            script.onerror = function() {
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