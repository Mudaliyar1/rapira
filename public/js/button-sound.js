// Button Sound Effect Implementation
class ButtonSoundEffect {
  constructor() {
    this.audioContext = null;
    this.soundEnabled = this.getSoundSetting(); // Get initial setting from server or local storage
    this.initAudioContext();
    this.addEventListeners();
    this.setupSettingListener(); // Listen for setting changes
  }

  // Get the sound setting from server-side data or default to true
  getSoundSetting() {
    // Check if there's a global variable set by server (for initial load)
    if (typeof window.websiteSettings !== 'undefined' && window.websiteSettings.siteSettings) {
      return window.websiteSettings.siteSettings.enableButtonSounds !== false;
    }
    // Fallback to localStorage or default to true
    const storedSetting = localStorage.getItem('enableButtonSounds');
    return storedSetting === null ? true : storedSetting === 'true';
  }

  // Update the sound setting
  setSoundSetting(enabled) {
    this.soundEnabled = enabled;
    localStorage.setItem('enableButtonSounds', enabled);
  }

  // Initialize Audio Context on user interaction to comply with browser policies
  initAudioContext() {
    // Create audio context on first user interaction
    const initContext = () => {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      document.body.removeEventListener('click', initContext);
    };
    
    document.body.addEventListener('click', initContext);
  }

  // Create a subtle click sound using Web Audio API
  createClickSound() {
    if (!this.audioContext || !this.soundEnabled) {
      // Fallback to oscillator if context not initialized yet
      return;
    }

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // Configure sound parameters for a subtle, pleasant click
      oscillator.type = 'sine';
      oscillator.frequency.value = 800; // Higher frequency for a subtle click
      gainNode.gain.value = 0.1; // Low volume for non-intrusive feedback

      // Create a quick sound envelope
      const now = this.audioContext.currentTime;
      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      gainNode.gain.setValueAtTime(0.01, now + 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      oscillator.start(now);
      oscillator.stop(now + 0.15); // Stop after 150ms
      
      return true;
    } catch (error) {
      console.warn('Error creating sound:', error);
      return false;
    }
  }

  // Play the click sound
  playSound() {
    if (!this.soundEnabled) return;
    
    // Try Web Audio API first
    if (this.createClickSound()) {
      return;
    }
    
    // Fallback: Try with a short beep using oscillator
    try {
      if (this.audioContext && this.soundEnabled) {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.type = 'square';
        oscillator.frequency.value = 1200;
        gainNode.gain.value = 0.05;
        
        const now = this.audioContext.currentTime;
        gainNode.gain.setValueAtTime(0.05, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        
        oscillator.start(now);
        oscillator.stop(now + 0.08);
      }
    } catch (error) {
      console.warn('Fallback sound also failed:', error);
    }
  }

  // Add event listeners to all buttons
  addEventListeners() {
    // Use event delegation to handle dynamically added buttons
    document.addEventListener('click', (event) => {
      // Check if clicked element or its parent is a button
      const button = event.target.closest('button, .btn, [role="button"], input[type="button"], input[type="submit"]');
      
      if (button) {
        // Check if it's an interactive element that should have sound
        if (this.shouldPlaySound(button)) {
          this.playSound();
        }
      }
    });
  }

  // Determine if sound should play for this element
  shouldPlaySound(element) {
    // Don't play sound for certain elements
    const excludeSelectors = [
      '.btn-close', // Don't play for close buttons to avoid distraction
      '[data-no-sound="true"]', // Explicitly disabled
      '[aria-label="Previous"]', // Carousel controls
      '[aria-label="Next"]', // Carousel controls
      '.carousel-control-prev', // Carousel prev button
      '.carousel-control-next' // Carousel next button
    ];

    // Check if element matches any exclude selector
    for (const selector of excludeSelectors) {
      if (element.matches(selector)) {
        return false;
      }
    }

    // Check if parent has data-no-sound attribute
    if (element.closest('[data-no-sound="true"]')) {
      return false;
    }

    // Check if it's a legitimate button element
    const isButton = 
      element.tagName === 'BUTTON' ||
      element.classList.contains('btn') ||
      element.getAttribute('role') === 'button' ||
      element.type === 'button' ||
      element.type === 'submit';

    return isButton && this.soundEnabled;
  }

  // Setup listener for setting changes (for SPA-like behavior)
  setupSettingListener() {
    // Listen for custom event that might be fired when settings change
    document.addEventListener('buttonSoundsSettingChanged', (event) => {
      this.setSoundSetting(event.detail.enabled);
    });
  }
}

// Initialize the button sound effect when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ButtonSoundEffect();
});