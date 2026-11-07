/**
 * RAPIRA Digital Concert Ticket Client Interactions
 * Handles Add to Wallet, Share Ticket, Receipt toggle, and Toast alerts.
 */

(function () {
  'use strict';

  function showToast(message, icon) {
    let toast = document.getElementById('rapiraTicketToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'rapiraTicketToast';
      toast.className = 'rapira-toast';
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<i class="${icon || 'bi bi-check-circle-fill'} text-warning"></i> <span>${message}</span>`;
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(function () {
      toast.classList.remove('show');
    }, 3500);
  }

  function initTicketInteractions() {
    // 1. Share Ticket
    var shareBtns = document.querySelectorAll('.js-rapira-share-btn');
    shareBtns.forEach(function (btn) {
      btn.addEventListener('click', async function (e) {
        e.preventDefault();
        var shareData = {
          title: document.title || 'RAPIRA Concert Ticket',
          text: 'My RAPIRA Concert Entry Pass: ' + (btn.getAttribute('data-ticket-no') || ''),
          url: window.location.href
        };

        if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
          try {
            await navigator.share(shareData);
            return;
          } catch (err) {
            if (err.name !== 'AbortError') {
              console.warn('Share error:', err);
            }
          }
        }

        // Clipboard fallback
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(window.location.href)
            .then(function () {
              showToast('Ticket link copied to clipboard!', 'bi bi-clipboard-check');
            })
            .catch(function () {
              showToast('Ticket URL: ' + window.location.href, 'bi bi-link-45deg');
            });
        } else {
          showToast('Ticket link: ' + window.location.href, 'bi bi-link-45deg');
        }
      });
    });

    // 2. Add to Wallet
    var walletBtns = document.querySelectorAll('.js-rapira-wallet-btn');
    walletBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var ticketNo = btn.getAttribute('data-ticket-no') || 'Pass';
        showToast('Digital Pass ready! Ticket ' + ticketNo + ' saved to your offline pass.', 'bi bi-wallet2');
      });
    });

    // 3. Receipt Toggle
    var receiptToggleBtn = document.getElementById('rapiraReceiptToggleBtn');
    var receiptContent = document.getElementById('rapiraReceiptContent');
    var receiptIcon = document.getElementById('rapiraReceiptChevron');

    if (receiptToggleBtn && receiptContent) {
      receiptToggleBtn.addEventListener('click', function () {
        var isOpen = receiptContent.classList.toggle('open');
        if (receiptIcon) {
          receiptIcon.className = isOpen ? 'bi bi-chevron-up ms-1' : 'bi bi-chevron-down ms-1';
        }
        receiptToggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTicketInteractions);
  } else {
    initTicketInteractions();
  }
})();

