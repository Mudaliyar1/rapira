/**
 * RAPIRA Homepage Motion Controller
 * Uses the official Motion JavaScript API (motion.dev)
 * Strictly client-side Vanilla JS; no React dependencies.
 */
(function () {
  'use strict';

  function initMotion() {
    if (!window.Motion) {
      console.warn('[Motion] window.Motion not available, skipping motion enhancements.');
      return;
    }

    const { animate, inView } = window.Motion;

    // Respect user's accessibility / reduced-motion preferences
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      console.log('[Motion] prefers-reduced-motion detected; skipping entrance animations.');
      return;
    }

    // 1. Hero Entrance Animations (Fast, subtle, premium)
    const headline = document.querySelector('.rh-hero-headline');
    if (headline) {
      animate(headline, { opacity: [0, 1], y: [16, 0] }, { duration: 0.7, easing: [0.16, 1, 0.3, 1] });
    }

    const stamp = document.querySelector('.rh-hero-stamp');
    if (stamp) {
      animate(stamp, { opacity: [0, 1] }, { duration: 0.8, delay: 0.15 });
    }

    const script = document.querySelector('.rh-hero-script');
    if (script) {
      animate(script, { opacity: [0, 1] }, { duration: 0.8, delay: 0.2 });
    }

    const tagline = document.querySelector('.rh-hero-tagline-wrap');
    if (tagline) {
      animate(tagline, { opacity: [0, 1], y: [10, 0] }, { duration: 0.6, delay: 0.25 });
    }

    const cta = document.querySelector('.rh-hero-cta-group');
    if (cta) {
      animate(cta, { opacity: [0, 1], y: [10, 0] }, { duration: 0.6, delay: 0.35 });
    }

    const banner = document.querySelector('.rh-hero-banner-container');
    if (banner) {
      animate(banner, { opacity: [0, 1], y: [14, 0] }, { duration: 0.8, delay: 0.45 });
    }

    // 2. Hero & Action Buttons Interactive Feedback (Small hover lift & press feedback)
    const interactiveButtons = document.querySelectorAll(
      '.rh-btn-crimson-solid, .rh-btn-outline-pill, .rh-section-btn, .rh-artist-btn, .rh-artist-cta-btn, .rh-btn-white-pill, .rh-cta-action-btn'
    );
    interactiveButtons.forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        animate(btn, { y: -2, scale: 1.02 }, { duration: 0.18, easing: 'ease-out' });
      });
      btn.addEventListener('mouseleave', () => {
        animate(btn, { y: 0, scale: 1 }, { duration: 0.18, easing: 'ease-out' });
      });
      btn.addEventListener('mousedown', () => {
        animate(btn, { scale: 0.97, y: 0 }, { duration: 0.1 });
      });
      btn.addEventListener('mouseup', () => {
        animate(btn, { scale: 1.02, y: -2 }, { duration: 0.12 });
      });
    });

    // 3. Artist Cards Restrained Hover Elevation / Image Scale
    document.querySelectorAll('.rh-artist-card').forEach(card => {
      const img = card.querySelector('.rh-artist-img');
      card.addEventListener('mouseenter', () => {
        animate(card, { y: -4 }, { duration: 0.25, easing: [0.16, 1, 0.3, 1] });
        if (img) animate(img, { scale: 1.03 }, { duration: 0.35, easing: 'ease-out' });
      });
      card.addEventListener('mouseleave', () => {
        animate(card, { y: 0 }, { duration: 0.25, easing: 'ease-out' });
        if (img) animate(img, { scale: 1 }, { duration: 0.35, easing: 'ease-out' });
      });
    });

    // 4. Reel Cards Smooth Hover Feedback (Card elevation; play button scaling handled cleanly by CSS)
    document.querySelectorAll('.rh-reel-card').forEach(card => {
      card.addEventListener('mouseenter', () => {
        animate(card, { y: -4 }, { duration: 0.25, easing: [0.16, 1, 0.3, 1] });
      });
      card.addEventListener('mouseleave', () => {
        animate(card, { y: 0 }, { duration: 0.25, easing: 'ease-out' });
      });
    });

    // 5. Section Scroll Reveal via inView (Safe, Progressive Enhancement)
    document.querySelectorAll('.container > section').forEach(sec => {
      inView(sec, (info) => {
        animate(info.target, { opacity: [0, 1], y: [16, 0] }, { duration: 0.55, easing: [0.16, 1, 0.3, 1] });
      }, { margin: '0px 0px -40px 0px' });
    });

    console.log('[Motion] Homepage animations initialized successfully.');
  }

  // Dedicated Reel Modal Viewer is now managed centrally by /js/reel-viewer.js

  // 9. Featured Artists Mobile Swipeable Carousel Dots Sync & Dot Navigation
  function initArtistsCarousel() {
    const container = document.getElementById('homeArtistsContainer');
    const dotsContainer = document.getElementById('homeArtistsDots');
    if (!container || !dotsContainer) return;

    const dots = Array.from(dotsContainer.querySelectorAll('.rh-dot'));
    const cards = Array.from(container.querySelectorAll('.rh-artist-col'));
    if (!dots.length || !cards.length) return;

    // Tapping a dot navigates to its corresponding artist card
    dots.forEach((dot, idx) => {
      dot.addEventListener('click', function(e) {
        e.preventDefault();
        if (cards[idx]) {
          cards[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
        }
      });
    });

    // Update active dot based on card center alignment (accurate for both forward and backward swipes)
    let scrollTicking = false;
    function updateActiveDot() {
      const containerRect = container.getBoundingClientRect();
      const containerCenter = containerRect.left + containerRect.width / 2;

      let closestIdx = 0;
      let minDistance = Infinity;

      cards.forEach((card, idx) => {
        const cardRect = card.getBoundingClientRect();
        const cardCenter = cardRect.left + cardRect.width / 2;
        const distance = Math.abs(containerCenter - cardCenter);
        if (distance < minDistance) {
          minDistance = distance;
          closestIdx = idx;
        }
      });

      dots.forEach((dot, idx) => {
        dot.classList.toggle('active', idx === closestIdx);
      });
      scrollTicking = false;
    }

    container.addEventListener('scroll', function() {
      if (!scrollTicking) {
        requestAnimationFrame(updateActiveDot);
        scrollTicking = true;
      }
    }, { passive: true });

    updateActiveDot();
  }

  // 10. "How RAPIRA Works" Mobile Swipeable Carousel Dots Sync & Dot Navigation
  function initHowWorksCarousel() {
    const track = document.getElementById('howWorksTrack');
    const pagination = document.getElementById('howWorksPagination');
    if (!track || !pagination) return;

    const dots = Array.from(pagination.querySelectorAll('.rh-how-dot'));
    const cards = Array.from(track.querySelectorAll('.rh-how-card'));
    if (!dots.length || !cards.length) return;

    dots.forEach((dot, idx) => {
      dot.addEventListener('click', function(e) {
        e.preventDefault();
        if (cards[idx]) {
          cards[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
        }
      });
    });

    let scrollTicking = false;
    function updateActiveDot() {
      const trackRect = track.getBoundingClientRect();
      const trackCenter = trackRect.left + trackRect.width / 2;

      let closestIdx = 0;
      let minDistance = Infinity;

      cards.forEach((card, idx) => {
        const cardRect = card.getBoundingClientRect();
        const cardCenter = cardRect.left + cardRect.width / 2;
        const distance = Math.abs(trackCenter - cardCenter);
        if (distance < minDistance) {
          minDistance = distance;
          closestIdx = idx;
        }
      });

      dots.forEach((dot, idx) => {
        dot.classList.toggle('active', idx === closestIdx);
      });
      scrollTicking = false;
    }

    track.addEventListener('scroll', function() {
      if (!scrollTicking) {
        requestAnimationFrame(updateActiveDot);
        scrollTicking = true;
      }
    }, { passive: true });

    updateActiveDot();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      initMotion();
      initArtistsCarousel();
      initHowWorksCarousel();
    });
  } else {
    initMotion();
    initArtistsCarousel();
    initHowWorksCarousel();
  }
})();
