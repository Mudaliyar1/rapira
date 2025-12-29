// Theme Manager Implementation
class ThemeManager {
  constructor() {
    this.activeTheme = null;
    this.isInitialized = false;
    
    // Define available themes
    this.themes = [
      'winter', 'summer', 'rainy', 'newyear', 'christmas', 'spring', 'autumn', 'halloween'
    ];
    
    this.init();
  }

  init() {
    // Get the current theme from data attribute or server settings
    this.activeTheme = document.body.getAttribute('data-theme') || null;
    
    // Initialize theme elements
    this.createThemeElements();
    
    // Start theme animations if a theme is active
    if (this.activeTheme) {
      this.applyTheme(this.activeTheme);
      this.startThemeAnimation(this.activeTheme);
    }
    
    this.isInitialized = true;
  }

  // Apply theme to the body
  applyTheme(themeName) {
    // Remove all theme classes
    this.themes.forEach(theme => {
      document.body.classList.remove(`theme-${theme}`);
    });
    
    // Set the new theme
    document.body.setAttribute('data-theme', themeName);
    document.body.classList.add(`theme-${themeName}`);
    
    // Store the active theme
    this.activeTheme = themeName;
    
    // Start the theme-specific animations
    this.startThemeAnimation(themeName);
  }

  // Create theme elements that will be animated
  createThemeElements() {
    // Create containers for different theme elements
    if (!document.getElementById('theme-elements-container')) {
      const container = document.createElement('div');
      container.id = 'theme-elements-container';
      container.style.position = 'fixed';
      container.style.top = '0';
      container.style.left = '0';
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.pointerEvents = 'none';
      container.style.zIndex = '9998';
      container.style.overflow = 'hidden';
      document.body.appendChild(container);
    }
  }

  // Start theme-specific animations
  startThemeAnimation(themeName) {
    // Clear existing animations
    this.clearAnimations();
    
    switch (themeName) {
      case 'winter':
        this.startWinterAnimation();
        break;
      case 'summer':
        this.startSummerAnimation();
        break;
      case 'rainy':
        this.startRainyAnimation();
        break;
      case 'newyear':
        this.startNewYearAnimation();
        break;
      case 'christmas':
        this.startChristmasAnimation();
        break;
      case 'spring':
        this.startSpringAnimation();
        break;
      case 'autumn':
        this.startAutumnAnimation();
        break;
      case 'halloween':
        this.startHalloweenAnimation();
        break;
      default:
        // No theme active
        break;
    }
  }

  // Clear all active animations
  clearAnimations() {
    // Remove all theme elements
    const container = document.getElementById('theme-elements-container');
    if (container) {
      container.innerHTML = '';
    }
  }

  // Winter theme animation - falling snowflakes
  startWinterAnimation() {
    const container = document.getElementById('theme-elements-container');
    
    const createSnowflake = () => {
      const snowflake = document.createElement('div');
      snowflake.className = 'snowflake';
      snowflake.innerHTML = '❄';
      snowflake.style.left = Math.random() * 100 + 'vw';
      snowflake.style.opacity = Math.random() * 0.5 + 0.3;
      snowflake.style.fontSize = (Math.random() * 10 + 10) + 'px';
      snowflake.style.animationDuration = (Math.random() * 3 + 2) + 's';
      
      container.appendChild(snowflake);
      
      // Remove snowflake after animation completes
      setTimeout(() => {
        if (snowflake.parentNode) {
          snowflake.parentNode.removeChild(snowflake);
        }
      }, 5000);
    };
    
    // Create snowflakes at intervals
    this.winterInterval = setInterval(createSnowflake, 300);
  }

  // Summer theme animation - sun rays
  startSummerAnimation() {
    const container = document.getElementById('theme-elements-container');
    
    const createSunRay = () => {
      const sunRay = document.createElement('div');
      sunRay.className = 'sun-ray';
      sunRay.style.left = Math.random() * 100 + 'vw';
      sunRay.style.top = Math.random() * 30 + 'vh';
      sunRay.style.animationDuration = (Math.random() * 2 + 1) + 's';
      
      container.appendChild(sunRay);
      
      // Remove sun ray after a while
      setTimeout(() => {
        if (sunRay.parentNode) {
          sunRay.parentNode.removeChild(sunRay);
        }
      }, 3000);
    };
    
    // Create sun rays at intervals
    this.summerInterval = setInterval(createSunRay, 500);
  }

  // Rainy theme animation - falling raindrops
  startRainyAnimation() {
    const container = document.getElementById('theme-elements-container');
    
    const createRaindrop = () => {
      const raindrop = document.createElement('div');
      raindrop.className = 'raindrop';
      raindrop.style.left = Math.random() * 100 + 'vw';
      raindrop.style.animationDuration = (Math.random() * 0.5 + 0.3) + 's';
      
      container.appendChild(raindrop);
      
      // Remove raindrop after animation completes
      setTimeout(() => {
        if (raindrop.parentNode) {
          raindrop.parentNode.removeChild(raindrop);
        }
      }, 2000);
    };
    
    // Create raindrops at intervals
    this.rainyInterval = setInterval(createRaindrop, 100);
  }

  // New Year theme animation - confetti
  startNewYearAnimation() {
    const container = document.getElementById('theme-elements-container');
    
    const createConfetti = () => {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      confetti.style.left = Math.random() * 100 + 'vw';
      confetti.style.backgroundColor = this.getRandomColor();
      confetti.style.width = (Math.random() * 8 + 6) + 'px';
      confetti.style.height = (Math.random() * 8 + 6) + 'px';
      confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
      
      container.appendChild(confetti);
      
      // Remove confetti after animation completes
      setTimeout(() => {
        if (confetti.parentNode) {
          confetti.parentNode.removeChild(confetti);
        }
      }, 5000);
    };
    
    // Create confetti at intervals
    this.newYearInterval = setInterval(createConfetti, 150);
  }

  // Christmas theme animation - floating decorations
  startChristmasAnimation() {
    const container = document.getElementById('theme-elements-container');
    const decorations = ['🎄', '🎁', '⭐', '⛄', '🔔', '🤶', '🎅'];
    
    const createDecoration = () => {
      const decoration = document.createElement('div');
      decoration.className = 'christmas-decoration';
      decoration.innerHTML = decorations[Math.floor(Math.random() * decorations.length)];
      decoration.style.left = Math.random() * 100 + 'vw';
      decoration.style.top = Math.random() * 100 + 'vh';
      decoration.style.animationDuration = (Math.random() * 4 + 3) + 's';
      decoration.style.opacity = Math.random() * 0.5 + 0.5;
      
      container.appendChild(decoration);
      
      // Remove decoration after animation completes
      setTimeout(() => {
        if (decoration.parentNode) {
          decoration.parentNode.removeChild(decoration);
        }
      }, 8000);
    };
    
    // Create decorations at intervals
    this.christmasInterval = setInterval(createDecoration, 800);
  }

  // Spring theme animation - falling petals
  startSpringAnimation() {
    const container = document.getElementById('theme-elements-container');
    
    const createPetal = () => {
      const petal = document.createElement('div');
      petal.className = 'spring-petal';
      petal.style.left = Math.random() * 100 + 'vw';
      petal.style.backgroundColor = this.getRandomPastelColor();
      petal.style.animationDuration = (Math.random() * 4 + 3) + 's';
      petal.style.opacity = Math.random() * 0.5 + 0.5;
      
      container.appendChild(petal);
      
      // Remove petal after animation completes
      setTimeout(() => {
        if (petal.parentNode) {
          petal.parentNode.removeChild(petal);
        }
      }, 7000);
    };
    
    // Create petals at intervals
    this.springInterval = setInterval(createPetal, 400);
  }

  // Autumn theme animation - falling leaves
  startAutumnAnimation() {
    const container = document.getElementById('theme-elements-container');
    const leaves = ['🍃', '🍂', '🍁'];
    
    const createLeaf = () => {
      const leaf = document.createElement('div');
      leaf.className = 'autumn-leaf';
      leaf.innerHTML = leaves[Math.floor(Math.random() * leaves.length)];
      leaf.style.left = Math.random() * 100 + 'vw';
      leaf.style.animationDuration = (Math.random() * 5 + 4) + 's';
      leaf.style.opacity = Math.random() * 0.5 + 0.5;
      
      container.appendChild(leaf);
      
      // Remove leaf after animation completes
      setTimeout(() => {
        if (leaf.parentNode) {
          leaf.parentNode.removeChild(leaf);
        }
      }, 10000);
    };
    
    // Create leaves at intervals
    this.autumnInterval = setInterval(createLeaf, 600);
  }

  // Halloween theme animation - spooky elements
  startHalloweenAnimation() {
    const container = document.getElementById('theme-elements-container');
    const spookyElements = ['👻', '🎃', '🕷️', '🕸️', '🦇', '🔮', '☠️', '😱'];
    
    const createSpooky = () => {
      const spooky = document.createElement('div');
      spooky.className = 'halloween-spooky';
      spooky.innerHTML = spookyElements[Math.floor(Math.random() * spookyElements.length)];
      spooky.style.left = Math.random() * 100 + 'vw';
      spooky.style.top = Math.random() * 100 + 'vh';
      spooky.style.animationDuration = (Math.random() * 3 + 2) + 's';
      spooky.style.opacity = Math.random() * 0.5 + 0.5;
      
      container.appendChild(spooky);
      
      // Remove spooky element after animation completes
      setTimeout(() => {
        if (spooky.parentNode) {
          spooky.parentNode.removeChild(spooky);
        }
      }, 8000);
    };
    
    // Create spooky elements at intervals
    this.halloweenInterval = setInterval(createSpooky, 1000);
  }

  // Helper function to get random color
  getRandomColor() {
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Helper function to get random pastel color
  getRandomPastelColor() {
    const colors = ['#ff9aa2', '#ffb7b2', '#ffdac1', '#e2f0cb', '#b5ead7', '#c7ceea'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Method to change theme
  changeTheme(themeName) {
    if (this.themes.includes(themeName)) {
      this.applyTheme(themeName);
    }
  }

  // Method to disable all themes
  disableAllThemes() {
    // Remove theme attribute and class
    document.body.removeAttribute('data-theme');
    this.themes.forEach(theme => {
      document.body.classList.remove(`theme-${theme}`);
    });
    
    // Clear animations
    this.clearAnimations();
    this.activeTheme = null;
  }

  // Cleanup method
  destroy() {
    // Clear all intervals
    if (this.winterInterval) clearInterval(this.winterInterval);
    if (this.summerInterval) clearInterval(this.summerInterval);
    if (this.rainyInterval) clearInterval(this.rainyInterval);
    if (this.newYearInterval) clearInterval(this.newYearInterval);
    if (this.christmasInterval) clearInterval(this.christmasInterval);
    if (this.springInterval) clearInterval(this.springInterval);
    if (this.autumnInterval) clearInterval(this.autumnInterval);
    if (this.halloweenInterval) clearInterval(this.halloweenInterval);
    
    // Clear animations
    this.clearAnimations();
  }
}

// Initialize theme manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.themeManager = new ThemeManager();
});

// Add a global function to manually change theme
window.changeTheme = function(themeName) {
  if (window.themeManager && window.themeManager.isInitialized) {
    window.themeManager.changeTheme(themeName);
  }
};

// Add a global function to disable all themes
window.disableAllThemes = function() {
  if (window.themeManager && window.themeManager.isInitialized) {
    window.themeManager.disableAllThemes();
  }
};