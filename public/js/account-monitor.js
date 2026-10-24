// Account Status Monitor - Real-time account deletion detection
(function() {
  'use strict';

  // Only run for logged-in users
  const currentUser = document.querySelector('body').getAttribute('data-user-id');
  if (!currentUser) {
    console.log('[ACCOUNT MONITOR] No user logged in, skipping monitor');
    return;
  }

  console.log('[ACCOUNT MONITOR] Initializing for user:', currentUser);

  let checkInProgress = false;
  let hasShownDeletedModal = false;

  // Create modal for account deleted notification
  function createAccountDeletedModal() {
    const modal = document.createElement('div');
    modal.id = 'account-deleted-modal';
    modal.className = 'modal fade';
    modal.setAttribute('data-bs-backdrop', 'static');
    modal.setAttribute('data-bs-keyboard', 'false');
    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header bg-danger text-white">
            <h5 class="modal-title">
              <i class="bi bi-exclamation-triangle-fill me-2"></i>
              Account Deleted
            </h5>
          </div>
          <div class="modal-body text-center py-4">
            <div class="mb-4">
              <i class="bi bi-person-x-fill text-danger" style="font-size: 4rem;"></i>
            </div>
            <h5 class="mb-3">Your account has been deleted</h5>
            <p class="text-muted mb-0">
              Your account has been deleted by the website administrator. 
              You will be redirected to more information.
            </p>
          </div>
          <div class="modal-footer justify-content-center border-0">
            <button type="button" class="btn btn-primary" id="account-deleted-go-home">
              <i class="bi bi-house-fill me-2"></i>
              Go to Home
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  // Show account deleted modal
  function showAccountDeletedModal(message) {
    if (hasShownDeletedModal) return;
    hasShownDeletedModal = true;

    console.log('[ACCOUNT MONITOR] Account deleted detected, showing modal');

    const modal = createAccountDeletedModal();
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();

    // Handle "Go to Home" button click
    document.getElementById('account-deleted-go-home').addEventListener('click', function() {
      window.location.href = '/error/account-deleted';
    });

    // Auto-redirect after 5 seconds
    setTimeout(() => {
      window.location.href = '/error/account-deleted';
    }, 5000);
  }

  // Check account status
  async function checkAccountStatus() {
    if (checkInProgress || hasShownDeletedModal) return;
    checkInProgress = true;

    try {
      const response = await fetch('/api/account-status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'same-origin'
      });

      if (!response.ok) {
        console.error('[ACCOUNT MONITOR] API error:', response.status);
        checkInProgress = false;
        return;
      }

      const data = await response.json();
      
      // Account was deleted
      if (data.accountDeleted === true) {
        console.log('[ACCOUNT MONITOR] Account deletion detected!');
        showAccountDeletedModal(data.message);
        return;
      }

      // No longer logged in (session expired)
      if (data.loggedIn === false && !data.accountDeleted) {
        console.log('[ACCOUNT MONITOR] Session expired');
        // Don't show modal for normal logouts, just stop monitoring
        return;
      }

      console.log('[ACCOUNT MONITOR] Account status: OK');
    } catch (error) {
      console.error('[ACCOUNT MONITOR] Check error:', error);
    } finally {
      checkInProgress = false;
    }
  }

  // Initialize monitoring
  function init() {
    console.log('[ACCOUNT MONITOR] Starting periodic checks (every 10 seconds)');
    
    // Initial check after 5 seconds
    setTimeout(checkAccountStatus, 5000);

    // Then check every 10 seconds
    setInterval(checkAccountStatus, 10000);
  }

  // Start monitoring when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
