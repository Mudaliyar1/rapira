/**
 * RAPIRA - Complete Payment & Checkout Page Controller
 * Reference Single Source of Truth: media_1793944260182_bfe2040d.jpg
 */

(function initRapiraCheckout() {
  'use strict';

  function setup() {
    const pageRoot = document.querySelector('.rapira-checkout-page');
    if (!pageRoot) return;

    console.log('[RAPIRA CHECKOUT] Initializing Payment Controller...');

    // Configuration from Data Attributes
    const concertId = pageRoot.getAttribute('data-concert-id') || '';
    const isPaid = pageRoot.getAttribute('data-is-paid') === 'true';
    const basePrice = parseFloat(pageRoot.getAttribute('data-unit-price')) || 0;
    const commissionEnabled = pageRoot.getAttribute('data-commission-enabled') === 'true';
    const commissionPercentage = parseFloat(pageRoot.getAttribute('data-commission-pct')) || 0;
    const initialQty = parseInt(pageRoot.getAttribute('data-selected-qty'), 10) || 1;
    const maxAllowed = parseInt(pageRoot.getAttribute('data-max-tickets'), 10) || 10;
    const userName = pageRoot.getAttribute('data-user-name') || '';
    const userEmail = pageRoot.getAttribute('data-user-email') || '';

    let currentQty = initialQty;
    let attendeeStore = {}; // in-memory cache to preserve inputs across quantity changes

    // DOM Elements
    const attendeesContainer = document.getElementById('rapiraAttendeesContainer') || document.getElementById('attendeesContainer');
    const attendeeDataInputs = document.getElementById('attendeeDataInputs');
    const paymentAgreement = document.getElementById('paymentAgreement');
    const checkboxError = document.getElementById('checkboxError');
    const summaryQuantity = document.getElementById('summaryQuantity');
    const summaryCharges = document.getElementById('summaryCharges');
    const summaryTotal = document.getElementById('summaryTotal');
    const mobileSummaryQuantity = document.getElementById('mobileSummaryQuantity');
    const mobileSummaryCharges = document.getElementById('mobileSummaryCharges');
    const mobileSummaryTotal = document.getElementById('mobileSummaryTotal');
    const totalAmountInput = document.getElementById('totalAmountInput');
    const ticketQuantityInput = document.getElementById('ticketQuantity');
    const razorpayForm = document.getElementById('razorpayForm');
    const freeConcertForm = document.getElementById('freeConcertForm');
    const proceedPaymentBtn = document.getElementById('proceedPaymentBtn');
    const selectedSeatsDisplay = document.getElementById('selectedSeatsDisplay');

    // Load and display seats from query or sessionStorage
    function initSeatsDisplay() {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        let seatsStr = urlParams.get('seats');
        let catStr = urlParams.get('category');

        if (!seatsStr) {
          const stored = sessionStorage.getItem('rapira_booking_selection');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.concertId === concertId && parsed.seats) {
              seatsStr = parsed.seats.join(', ');
              catStr = parsed.category;
            }
          }
        }

        if (seatsStr && selectedSeatsDisplay) {
          selectedSeatsDisplay.innerHTML = `<i class="bi bi-ticket-detailed-fill me-1"></i> Seats: <strong>${seatsStr}</strong> ${catStr ? '(' + catStr + ')' : ''}`;
          selectedSeatsDisplay.style.display = 'flex';
        }
      } catch (e) {
        console.warn('Error reading seats:', e);
      }
    }

    // Calculate Prices
    function calculateTotal(qty) {
      const subtotal = basePrice * qty;
      let charges = 0;
      if (commissionEnabled && commissionPercentage > 0) {
        charges = (subtotal * commissionPercentage) / 100;
      }
      const total = subtotal + charges;
      return {
        subtotal: subtotal.toFixed(2),
        charges: charges.toFixed(2),
        total: total.toFixed(2)
      };
    }

    // Update Price Summary
    function updatePriceSummary(qty) {
      const calc = calculateTotal(qty);
      if (summaryQuantity) summaryQuantity.textContent = qty;
      if (summaryCharges) summaryCharges.textContent = calc.charges;
      if (summaryTotal) summaryTotal.textContent = `₹${calc.total}`;
      
      if (mobileSummaryQuantity) mobileSummaryQuantity.textContent = qty;
      if (mobileSummaryCharges) mobileSummaryCharges.textContent = calc.charges;
      if (mobileSummaryTotal) mobileSummaryTotal.textContent = `₹${calc.total}`;

      if (totalAmountInput) totalAmountInput.value = calc.total;
      if (ticketQuantityInput) ticketQuantityInput.value = qty;
    }

    // Save Current Form Inputs into in-memory store
    function saveCurrentInputs() {
      for (let i = 0; i < currentQty; i++) {
        const nameEl = document.getElementById(`attendeeName${i}`);
        const ageEl = document.getElementById(`attendeeAge${i}`);
        if (nameEl || ageEl) {
          attendeeStore[i] = {
            name: nameEl ? nameEl.value : '',
            age: ageEl ? ageEl.value : ''
          };
        }
      }
    }

    // Render Attendee Forms for exact quantity count
    function renderAttendeeForms(count) {
      if (!attendeesContainer) return;

      saveCurrentInputs();
      currentQty = count;
      attendeesContainer.innerHTML = '';
      if (attendeeDataInputs) attendeeDataInputs.innerHTML = '';

      for (let i = 0; i < count; i++) {
        const num = i + 1;
        const prevData = attendeeStore[i] || attendeeStore[num] || {};
        let defaultName = prevData.name || '';
        let defaultAge = prevData.age || '';

        // Prefill first attendee with current user name if empty
        if (i === 0 && !defaultName && userName) {
          defaultName = userName;
        }

        const block = document.createElement('div');
        block.className = 'rapira-attendee-block';
        block.innerHTML = `
          <div class="rapira-attendee-strip">
            <span>Attendee #${num}</span>
            ${i === 0 ? '<span class="badge bg-danger rounded-pill" style="font-size: 0.68rem; background: #9F190E !important;">Primary Holder</span>' : ''}
          </div>
          <div class="rapira-attendee-row">
            <div class="rapira-field-group field-name">
              <label class="rapira-field-label" for="attendeeName${i}">
                Full Name <span class="req">*</span>
              </label>
              <div class="rapira-input-wrap">
                <span class="rapira-input-prefix"><i class="bi bi-person"></i></span>
                <input 
                  type="text" 
                  class="rapira-input-field" 
                  id="attendeeName${i}" 
                  name="attendeeName${i}"
                  placeholder="Enter full name" 
                  value="${defaultName}"
                  required
                >
              </div>
            </div>
            <div class="rapira-field-group field-age">
              <label class="rapira-field-label" for="attendeeAge${i}">
                Age <span class="req">*</span>
              </label>
              <div class="rapira-input-wrap">
                <span class="rapira-input-prefix"><i class="bi bi-calendar-event"></i></span>
                <input 
                  type="number" 
                  min="1" 
                  max="120" 
                  class="rapira-input-field" 
                  id="attendeeAge${i}" 
                  name="attendeeAge${i}"
                  placeholder="Enter age" 
                  value="${defaultAge}"
                  required
                >
              </div>
            </div>
          </div>
        `;

        attendeesContainer.appendChild(block);

        // Create hidden inputs for main.js and server
        if (attendeeDataInputs) {
          const hiddenInput = document.createElement('input');
          hiddenInput.type = 'hidden';
          hiddenInput.name = 'attendees';
          hiddenInput.id = `attendeeData${i}`;
          hiddenInput.value = (defaultName && defaultAge) ? `${defaultName}|${defaultAge}` : '';
          attendeeDataInputs.appendChild(hiddenInput);
        }

        // Add input sync listeners
        const nameInp = block.querySelector(`#attendeeName${i}`);
        const ageInp = block.querySelector(`#attendeeAge${i}`);

        const syncFn = () => {
          const n = nameInp.value.trim();
          const a = ageInp.value.trim();
          const hidden = document.getElementById(`attendeeData${i}`);
          if (hidden) {
            hidden.value = (n && a) ? `${n}|${a}` : '';
          }
        };

        nameInp.addEventListener('input', syncFn);
        ageInp.addEventListener('input', syncFn);
      }

      updatePriceSummary(count);
    }

    // Validation
    function validateAttendees() {
      let isValid = true;
      let firstInvalid = null;

      for (let i = 0; i < currentQty; i++) {
        const nameInput = document.getElementById(`attendeeName${i}`);
        const ageInput = document.getElementById(`attendeeAge${i}`);
        const hidden = document.getElementById(`attendeeData${i}`);

        const nameVal = nameInput ? nameInput.value.trim() : '';
        const ageVal = ageInput ? parseInt(ageInput.value.trim(), 10) : 0;

        if (!nameVal) {
          isValid = false;
          if (nameInput) {
            nameInput.closest('.rapira-input-wrap').style.borderColor = '#9F190E';
            if (!firstInvalid) firstInvalid = nameInput;
          }
        } else if (nameInput) {
          nameInput.closest('.rapira-input-wrap').style.borderColor = '#EAC8B7';
        }

        if (!ageVal || ageVal < 1 || ageVal > 120) {
          isValid = false;
          if (ageInput) {
            ageInput.closest('.rapira-input-wrap').style.borderColor = '#9F190E';
            if (!firstInvalid) firstInvalid = ageInput;
          }
        } else if (ageInput) {
          ageInput.closest('.rapira-input-wrap').style.borderColor = '#EAC8B7';
        }

        if (hidden) {
          hidden.value = (nameVal && ageVal) ? `${nameVal}|${ageVal}` : '';
        }
      }

      if (firstInvalid) {
        firstInvalid.focus();
      }

      return isValid;
    }

    // Intercept form submit before main.js fires
    if (proceedPaymentBtn) {
      proceedPaymentBtn.addEventListener('click', function(e) {
        // Validate agreement checkbox
        if (paymentAgreement && !paymentAgreement.checked) {
          e.preventDefault();
          e.stopPropagation();
          if (checkboxError) checkboxError.style.display = 'block';
          paymentAgreement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        } else {
          if (checkboxError) checkboxError.style.display = 'none';
        }

        // Validate attendee details
        if (!validateAttendees()) {
          e.preventDefault();
          e.stopPropagation();
          alert('Please fill in all attendee names and valid ages before proceeding.');
          return;
        }

        // Sync hidden attendees inputs right before submit
        for (let i = 0; i < currentQty; i++) {
          const nameInput = document.getElementById(`attendeeName${i}`);
          const ageInput = document.getElementById(`attendeeAge${i}`);
          const hidden = document.getElementById(`attendeeData${i}`);
          if (hidden && nameInput && ageInput) {
            hidden.value = `${nameInput.value.trim()}|${ageInput.value.trim()}`;
          }
        }
      }, true); // capture phase
    }

    if (paymentAgreement) {
      paymentAgreement.addEventListener('change', function() {
        if (this.checked && checkboxError) {
          checkboxError.style.display = 'none';
        }
      });
    }

    // Expose global for programmatic quantity adjustment
    window.setTicketQuantity = function(newQty) {
      const q = Math.min(maxAllowed, Math.max(1, parseInt(newQty, 10)));
      renderAttendeeForms(q);
    };

    // Initial Execution
    initSeatsDisplay();
    renderAttendeeForms(initialQty);

    console.log('[RAPIRA CHECKOUT] Initialized successfully with quantity:', initialQty);
  }

  setup();
})();
