/**
 * RAPIRA - Interactive Vehicle & Seat Selection Controller
 * Seamlessly manages Step 1 (Vehicle Selection) & Step 2 (Seat Selection)
 * Dynamic pricing from backend, Admin-configured categories, Responsive layout
 */

(function initRapiraBooking() {
  'use strict';

  // Avoid duplicate execution
  if (window.__rapiraBookingInitialized) return;
  window.__rapiraBookingInitialized = true;

  const root = document.querySelector('.rapira-booking-page');
  if (!root) return;

  console.log('[RAPIRA BOOKING] Initializing Vehicle & Seat Selection Controller...');

  // Configuration from Data Attributes
  const concertId = root.getAttribute('data-concert-id') || '';
  const unitPrice = parseFloat(root.getAttribute('data-unit-price')) || 0;
  const maxAllowed = parseInt(root.getAttribute('data-max-tickets'), 10) || 10;
  const commissionEnabled = root.getAttribute('data-commission-enabled') === 'true';
  const commissionPct = parseFloat(root.getAttribute('data-commission-pct')) || 0;
  const initialStepAttr = root.getAttribute('data-initial-step') || 'vehicle';
  const initialQtyAttr = parseInt(root.getAttribute('data-initial-qty'), 10) || 2;
  const initialVehicleAttr = root.getAttribute('data-initial-vehicle') || 'scooter';

  // Vehicle Definitions
  const VEHICLES = {
    cycle: { name: 'Cycle', minQty: 1, maxQty: 1, defaultQty: 1, svg: '/images/booking/bicycle.svg', label: '1 Ticket' },
    scooter: { name: 'Scooter', minQty: 2, maxQty: 2, defaultQty: 2, svg: '/images/booking/scooter.svg', label: '2 Tickets' },
    rickshaw: { name: 'Rickshaw', minQty: 3, maxQty: 3, defaultQty: 3, svg: '/images/booking/auto-rickshaw.svg', label: '3 Tickets' },
    car: { name: 'Car / Cab', minQty: 4, maxQty: 4, defaultQty: 4, svg: '/images/booking/car.svg', label: '4 Tickets' },
    bus: { name: 'Bus', minQty: 5, maxQty: 10, defaultQty: 5, svg: '/images/booking/bus.svg', label: '5-10 Tickets' }
  };

  function getVehicleByQty(qty) {
    if (qty <= 1) return { key: 'cycle', ...VEHICLES.cycle };
    if (qty === 2) return { key: 'scooter', ...VEHICLES.scooter };
    if (qty === 3) return { key: 'rickshaw', ...VEHICLES.rickshaw };
    if (qty === 4) return { key: 'car', ...VEHICLES.car };
    return { key: 'bus', ...VEHICLES.bus };
  }

  // State
  let currentStep = initialStepAttr === 'seats' ? 'seats' : 'vehicle';
  let currentQty = Math.max(1, Math.min(maxAllowed, initialQtyAttr));
  let currentVehicle = VEHICLES[initialVehicleAttr] ? initialVehicleAttr : getVehicleByQty(currentQty).key;
  let selectedSeats = [];
  let currentZoom = 1;

  // DOM Elements - Stepper
  const stepperStep1 = document.getElementById('stepperStep1');
  const stepperStep2 = document.getElementById('stepperStep2');

  // DOM Elements - Step 1: Vehicle
  const stepVehicleSection = document.getElementById('stepVehicleSection');
  const vehicleButtons = document.querySelectorAll('.rapira-vehicle-btn');
  const vehicleSyncName = document.getElementById('vehicleSyncName');
  const vehicleStepperMinus = document.getElementById('vehicleStepperMinus');
  const vehicleStepperPlus = document.getElementById('vehicleStepperPlus');
  const vehicleStepperVal = document.getElementById('vehicleStepperVal');
  const continueToSeatsBtn = document.getElementById('continueToSeatsBtn');

  // DOM Elements - Step 2: Seats
  const stepSeatsSection = document.getElementById('stepSeatsSection');
  const backToVehicleBtn = document.getElementById('backToVehicleBtn');
  const seatMapViewport = document.getElementById('seatMapViewport');
  const seatMapContent = document.getElementById('seatMapContent');
  const allSeatButtons = document.querySelectorAll('.rapira-seat:not(.is-sold)');
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const zoomResetBtn = document.getElementById('zoomResetBtn');

  // DOM Elements - Summary
  const sideStepperMinus = document.getElementById('sideStepperMinus');
  const sideStepperPlus = document.getElementById('sideStepperPlus');
  const sideStepperVal = document.getElementById('sideStepperVal');
  const sideVehicleIcon = document.getElementById('sideVehicleIcon');
  const sideVehicleName = document.getElementById('sideVehicleName');
  const seatCountLabel = document.getElementById('seatCountLabel');
  const seatTargetLabel = document.getElementById('seatTargetLabel');
  const selectedSeatsContainer = document.getElementById('selectedSeatsContainer');
  const summaryCategoryBreakdown = document.getElementById('summaryCategoryBreakdown');
  const summarySubtotalVal = document.getElementById('summarySubtotalVal');
  const summaryCommissionVal = document.getElementById('summaryCommissionVal');
  const summaryTotalAmount = document.getElementById('summaryTotalAmount');
  const proceedCheckoutBtn = document.getElementById('proceedCheckoutBtn');

  // DOM Elements - Mobile Sticky Bar
  const mobileStickyBar = document.getElementById('mobileStickyBar');
  const mobileSummaryIcon = document.getElementById('mobileSummaryIcon');
  const mobileSummaryCount = document.getElementById('mobileSummaryCount');
  const mobileSummaryTotal = document.getElementById('mobileSummaryTotal');
  const mobileProceedCheckoutBtn = document.getElementById('mobileProceedCheckoutBtn');

  // Format Currency
  function formatINR(num) {
    return '₹' + Number(num).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  // Switch Between Step 1 (Vehicle) and Step 2 (Seats)
  function setStep(step) {
    currentStep = step;

    if (currentStep === 'vehicle') {
      if (stepVehicleSection) stepVehicleSection.style.display = 'block';
      if (stepSeatsSection) stepSeatsSection.style.display = 'none';

      if (stepperStep1) {
        stepperStep1.classList.add('active');
        stepperStep1.classList.remove('completed');
      }
      if (stepperStep2) {
        stepperStep2.classList.remove('active');
      }

      if (mobileStickyBar) mobileStickyBar.style.display = 'none';
      document.body.classList.remove('has-seats-checkout-bar');

      // Update URL silently
      try {
        const url = new URL(window.location);
        url.searchParams.set('step', 'vehicle');
        url.searchParams.set('quantity', currentQty);
        url.searchParams.set('vehicle', currentVehicle);
        window.history.replaceState({}, '', url);
      } catch (e) {}

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Step 2: Seats
      if (stepVehicleSection) stepVehicleSection.style.display = 'none';
      if (stepSeatsSection) stepSeatsSection.style.display = 'block';

      if (stepperStep1) {
        stepperStep1.classList.remove('active');
        stepperStep1.classList.add('completed');
      }
      if (stepperStep2) {
        stepperStep2.classList.add('active');
      }

      // Check if on mobile for sticky bar
      if (mobileStickyBar && window.innerWidth < 992) {
        mobileStickyBar.style.display = 'flex';
        document.body.classList.add('has-seats-checkout-bar');
      } else {
        document.body.classList.remove('has-seats-checkout-bar');
      }

      // Auto-select initial seats if none selected yet
      if (selectedSeats.length === 0) {
        autoAllocateSeats();
      }

      renderSeatMapState();
      renderSummary();

      // Auto-center seat layout smoothly if viewport is scrollable
      setTimeout(() => {
        centerSeatMap(false);
      }, 80);

      // Update URL silently
      try {
        const url = new URL(window.location);
        url.searchParams.set('step', 'seats');
        url.searchParams.set('quantity', currentQty);
        url.searchParams.set('vehicle', currentVehicle);
        window.history.replaceState({}, '', url);
      } catch (e) {}
    }
  }

  // Update Quantity Everywhere
  function updateQuantity(newQty, source) {
    if (newQty < 1) newQty = 1;
    if (newQty > maxAllowed) newQty = maxAllowed;
    currentQty = newQty;

    // Synchronize Vehicle if not explicitly chosen
    if (source !== 'vehicleCard') {
      const v = getVehicleByQty(currentQty);
      currentVehicle = v.key;
    }

    const vInfo = VEHICLES[currentVehicle] || getVehicleByQty(currentQty);

    // Update Step 1 Vehicle buttons
    vehicleButtons.forEach(btn => {
      const vType = btn.getAttribute('data-vehicle');
      const isSelected = (vType === currentVehicle);
      btn.classList.toggle('active', isSelected);
      btn.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    });

    // Update Vehicle Name in Sync Strip
    if (vehicleSyncName) vehicleSyncName.textContent = vInfo.name;

    // Update Steppers
    if (vehicleStepperVal) vehicleStepperVal.textContent = currentQty;
    if (sideStepperVal) sideStepperVal.textContent = currentQty;
    if (vehicleStepperMinus) vehicleStepperMinus.disabled = (currentQty <= 1);
    if (vehicleStepperPlus) vehicleStepperPlus.disabled = (currentQty >= maxAllowed);
    if (sideStepperMinus) sideStepperMinus.disabled = (currentQty <= 1);
    if (sideStepperPlus) sideStepperPlus.disabled = (currentQty >= maxAllowed);

    // Update Sidebar & Mobile Summary
    if (sideVehicleName) sideVehicleName.textContent = vInfo.name;
    if (sideVehicleIcon) sideVehicleIcon.src = vInfo.svg;
    if (mobileSummaryIcon) mobileSummaryIcon.src = vInfo.svg;
    if (seatTargetLabel) seatTargetLabel.textContent = currentQty;

    // Adjust selected seats if count exceeds quantity
    if (selectedSeats.length > currentQty) {
      selectedSeats = selectedSeats.slice(0, currentQty);
    } else if (selectedSeats.length < currentQty && currentStep === 'seats') {
      autoAllocateSeats();
    }

    renderSeatMapState();
    renderSummary();
  }

  // Auto-allocate available seats
  function autoAllocateSeats() {
    const available = Array.from(allSeatButtons).map(b => b.getAttribute('data-seat-id'));
    const needed = currentQty - selectedSeats.length;
    let added = 0;

    for (let i = 0; i < available.length && added < needed; i++) {
      const seatId = available[i];
      if (!selectedSeats.includes(seatId)) {
        selectedSeats.push(seatId);
        added++;
      }
    }
  }

  // Render Seat Map Visual State
  function renderSeatMapState() {
    allSeatButtons.forEach(btn => {
      const seatId = btn.getAttribute('data-seat-id');
      const isSelected = selectedSeats.includes(seatId);
      btn.classList.toggle('is-selected', isSelected);
      btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });
  }

  // Render Summary & Pricing
  function renderSummary() {
    const selectedCount = selectedSeats.length;

    if (seatCountLabel) seatCountLabel.textContent = selectedCount;
    if (seatTargetLabel) seatTargetLabel.textContent = currentQty;

    // Render Seat Chips
    if (selectedSeatsContainer) {
      if (selectedCount === 0) {
        selectedSeatsContainer.innerHTML = '<span class="text-muted small" style="align-self: center;">No seats selected yet. Please pick your seats.</span>';
      } else {
        selectedSeatsContainer.innerHTML = '';
        selectedSeats.forEach(seatId => {
          const chip = document.createElement('span');
          chip.className = 'rapira-seat-chip';
          chip.innerHTML = `${seatId} <i class="bi bi-x" data-remove-seat="${seatId}" title="Deselect seat" aria-label="Deselect seat"></i>`;
          selectedSeatsContainer.appendChild(chip);
        });
      }
    }

    // Dynamic Price Calculation
    let subtotal = 0;
    let catNames = new Set();

    if (selectedCount > 0) {
      selectedSeats.forEach(seatId => {
        const btn = document.querySelector(`.rapira-seat[data-seat-id="${seatId}"]`);
        if (btn) {
          const p = parseFloat(btn.getAttribute('data-price')) || unitPrice;
          subtotal += p;
          catNames.add(btn.getAttribute('data-cat') || 'General');
        } else {
          subtotal += unitPrice;
        }
      });
      // If still fewer seats selected than currentQty, add prospective unitPrice
      if (selectedCount < currentQty) {
        subtotal += unitPrice * (currentQty - selectedCount);
      }
    } else {
      subtotal = unitPrice * currentQty;
    }

    subtotal = parseFloat(subtotal.toFixed(2));

    // Platform charges calculation
    let commissionAmount = 0;
    if (commissionEnabled && commissionPct > 0) {
      commissionAmount = parseFloat(((subtotal * commissionPct) / 100).toFixed(2));
    }

    const totalAmount = parseFloat((subtotal + commissionAmount).toFixed(2));

    // Update Breakdown Labels
    const breakdownCategoryText = catNames.size === 1 
      ? `${Array.from(catNames)[0]} (${currentQty} seats)`
      : `Tickets Subtotal (${currentQty} seats)`;

    if (summaryCategoryBreakdown) summaryCategoryBreakdown.textContent = breakdownCategoryText;
    if (summarySubtotalVal) summarySubtotalVal.textContent = formatINR(subtotal);
    if (summaryCommissionVal) summaryCommissionVal.textContent = formatINR(commissionAmount);
    if (summaryTotalAmount) summaryTotalAmount.textContent = formatINR(totalAmount);
    if (mobileSummaryTotal) mobileSummaryTotal.textContent = formatINR(totalAmount);
    if (mobileSummaryCount) mobileSummaryCount.textContent = `${selectedCount} / ${currentQty} Seats`;

    // Enable/Disable Checkout Button
    const isSelectionComplete = (selectedCount === currentQty);
    if (proceedCheckoutBtn) {
      proceedCheckoutBtn.disabled = !isSelectionComplete;
      if (!isSelectionComplete) {
        const diff = currentQty - selectedCount;
        proceedCheckoutBtn.setAttribute('title', `Please select ${diff} more seat${diff > 1 ? 's' : ''}`);
      } else {
        proceedCheckoutBtn.removeAttribute('title');
      }
    }

    if (mobileProceedCheckoutBtn) {
      mobileProceedCheckoutBtn.disabled = !isSelectionComplete;
    }
  }

  // Seat Click Handler
  function handleSeatClick(e) {
    const btn = e.target.closest('.rapira-seat');
    if (!btn || btn.classList.contains('is-sold') || btn.disabled) return;

    const seatId = btn.getAttribute('data-seat-id');
    const existingIndex = selectedSeats.indexOf(seatId);

    if (existingIndex > -1) {
      // Deselect
      selectedSeats.splice(existingIndex, 1);
    } else {
      // Select
      if (selectedSeats.length < currentQty) {
        selectedSeats.push(seatId);
      } else {
        // If already at quota, replace earliest selected seat
        selectedSeats.shift();
        selectedSeats.push(seatId);
      }
    }

    renderSeatMapState();
    renderSummary();
  }

  // Deselect Seat Via Chip Click
  if (selectedSeatsContainer) {
    selectedSeatsContainer.addEventListener('click', function(e) {
      const removeBtn = e.target.closest('[data-remove-seat]');
      if (!removeBtn) return;
      const seatId = removeBtn.getAttribute('data-remove-seat');
      const idx = selectedSeats.indexOf(seatId);
      if (idx > -1) {
        selectedSeats.splice(idx, 1);
        renderSeatMapState();
        renderSummary();
      }
    });
  }

  // Bind Seat Map Click Listener
  if (seatMapViewport) {
    seatMapViewport.addEventListener('click', handleSeatClick);
  }

  // Step 1: Vehicle Button Clicks
  vehicleButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      const v = this.getAttribute('data-vehicle');
      const qty = parseInt(this.getAttribute('data-qty'), 10);
      currentVehicle = v;
      updateQuantity(qty, 'vehicleCard');
    });
  });

  // Step 1 Stepper Controls
  if (vehicleStepperMinus) {
    vehicleStepperMinus.addEventListener('click', () => updateQuantity(currentQty - 1, 'stepper'));
  }
  if (vehicleStepperPlus) {
    vehicleStepperPlus.addEventListener('click', () => updateQuantity(currentQty + 1, 'stepper'));
  }

  // Step 2 Sidebar Stepper Controls
  if (sideStepperMinus) {
    sideStepperMinus.addEventListener('click', () => updateQuantity(currentQty - 1, 'stepper'));
  }
  if (sideStepperPlus) {
    sideStepperPlus.addEventListener('click', () => updateQuantity(currentQty + 1, 'stepper'));
  }

  // Continue to Seats Button
  if (continueToSeatsBtn) {
    continueToSeatsBtn.addEventListener('click', () => setStep('seats'));
  }

  // Back to Vehicle Button
  if (backToVehicleBtn) {
    backToVehicleBtn.addEventListener('click', () => setStep('vehicle'));
  }

  // Stepper Header Click Navigation
  if (stepperStep1) {
    stepperStep1.addEventListener('click', () => setStep('vehicle'));
  }
  if (stepperStep2) {
    stepperStep2.addEventListener('click', () => setStep('seats'));
  }

  // Auto-center seat layout in viewport if layout exceeds viewport width
  function centerSeatMap(smooth = false) {
    if (!seatMapViewport) return;
    const maxScroll = seatMapViewport.scrollWidth - seatMapViewport.clientWidth;
    if (maxScroll > 0) {
      seatMapViewport.scrollTo({
        left: Math.round(maxScroll / 2),
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  }

  // Zoom Controls
  function applyZoom(delta) {
    currentZoom = Math.min(1.4, Math.max(0.75, parseFloat((currentZoom + delta).toFixed(2))));
    if (seatMapContent) {
      seatMapContent.style.transform = `scale(${currentZoom})`;
    }
  }

  if (zoomInBtn) zoomInBtn.addEventListener('click', () => applyZoom(0.15));
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => applyZoom(-0.15));
  if (zoomResetBtn) {
    zoomResetBtn.addEventListener('click', () => {
      currentZoom = 1;
      if (seatMapContent) seatMapContent.style.transform = 'scale(1)';
      setTimeout(() => centerSeatMap(true), 50);
    });
  }

  // Pointer Drag Panning inside seatMapViewport
  if (seatMapViewport) {
    let isDown = false;
    let startX = 0;
    let scrollLeftStart = 0;

    seatMapViewport.addEventListener('pointerdown', (e) => {
      // Don't drag if clicking directly on a seat button
      if (e.target.closest('.rapira-seat')) return;
      isDown = true;
      startX = e.pageX;
      scrollLeftStart = seatMapViewport.scrollLeft;
      seatMapViewport.style.cursor = 'grabbing';
      try { seatMapViewport.setPointerCapture(e.pointerId); } catch (err) {}
    });

    seatMapViewport.addEventListener('pointermove', (e) => {
      if (!isDown) return;
      const dx = e.pageX - startX;
      seatMapViewport.scrollLeft = scrollLeftStart - dx;
    });

    const stopPointerDrag = (e) => {
      if (!isDown) return;
      isDown = false;
      seatMapViewport.style.cursor = '';
      try { seatMapViewport.releasePointerCapture(e.pointerId); } catch (err) {}
    };

    seatMapViewport.addEventListener('pointerup', stopPointerDrag);
    seatMapViewport.addEventListener('pointercancel', stopPointerDrag);
  }

  // Proceed to Checkout
  function proceedToCheckout() {
    if (selectedSeats.length !== currentQty) return;

    const seatsParam = encodeURIComponent(selectedSeats.join(','));
    const checkoutUrl = `/concerts/${concertId}/book?quantity=${currentQty}&seats=${seatsParam}&vehicle=${encodeURIComponent(currentVehicle)}`;

    // Store in sessionStorage for fast recovery
    try {
      sessionStorage.setItem('rapira_booking_data', JSON.stringify({
        concertId,
        quantity: currentQty,
        vehicle: currentVehicle,
        seats: selectedSeats,
        unitPrice,
        timestamp: Date.now()
      }));
    } catch (e) {}

    window.location.href = checkoutUrl;
  }

  if (proceedCheckoutBtn) proceedCheckoutBtn.addEventListener('click', proceedToCheckout);
  if (mobileProceedCheckoutBtn) mobileProceedCheckoutBtn.addEventListener('click', proceedToCheckout);

  // Window Resize: Manage mobile sticky bar & body classes
  window.addEventListener('resize', function() {
    if (mobileStickyBar) {
      if (window.innerWidth < 992 && currentStep === 'seats') {
        mobileStickyBar.style.display = 'flex';
        document.body.classList.add('has-seats-checkout-bar');
      } else {
        mobileStickyBar.style.display = 'none';
        document.body.classList.remove('has-seats-checkout-bar');
      }
    }
  });

  // Initialize State
  updateQuantity(currentQty, 'init');
  setStep(currentStep);

  console.log('[RAPIRA BOOKING] Initialized successfully.');
})();
