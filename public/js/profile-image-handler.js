/**
 * Profile Image Handler
 * Provides consistent default profile image handling across the application
 */

// Default profile image configuration
const DEFAULT_PROFILE_CONFIG = {
    svg: '/images/default-profile.svg',
    fallbackClass: 'default-profile-fallback',
    size: {
        small: 32,
        medium: 48,
        large: 100,
        xlarge: 150
    }
};

/**
 * Handle profile image error and apply fallback
 * @param {HTMLImageElement} img - The image element that failed to load
 * @param {string} size - Size variant (small, medium, large, xlarge)
 */
function handleProfileImageError(img, size = 'medium') {
    if (img.dataset.fallbackApplied) return; // Prevent infinite loop
    
    img.dataset.fallbackApplied = 'true';
    img.src = DEFAULT_PROFILE_CONFIG.svg;
    img.classList.add(DEFAULT_PROFILE_CONFIG.fallbackClass);
    
    // Apply size-specific styling
    const sizeValue = DEFAULT_PROFILE_CONFIG.size[size] || DEFAULT_PROFILE_CONFIG.size.medium;
    img.style.width = sizeValue + 'px';
    img.style.height = sizeValue + 'px';
    img.style.objectFit = 'cover';
}

/**
 * Initialize profile image error handling for all profile images on the page
 */
function initializeProfileImageHandling() {
    document.addEventListener('DOMContentLoaded', function() {
        // Find all profile images and add error handling
        const profileImages = document.querySelectorAll('img[alt*="Profile"], img[alt*="profile"], .profile-image, .user-avatar');
        
        profileImages.forEach(img => {
            if (!img.onerror) {
                img.onerror = function() {
                    handleProfileImageError(this, img.dataset.size || 'medium');
                };
            }
        });
    });
}

/**
 * Create a profile image element with proper fallback handling
 * @param {string} src - Image source URL
 * @param {string} alt - Alt text
 * @param {string} size - Size variant
 * @param {string} className - Additional CSS classes
 * @returns {HTMLImageElement} Configured image element
 */
function createProfileImage(src, alt, size = 'medium', className = '') {
    const img = document.createElement('img');
    const sizeValue = DEFAULT_PROFILE_CONFIG.size[size] || DEFAULT_PROFILE_CONFIG.size.medium;
    
    img.src = src || DEFAULT_PROFILE_CONFIG.svg;
    img.alt = alt;
    img.className = `rounded-circle ${className}`.trim();
    img.style.width = sizeValue + 'px';
    img.style.height = sizeValue + 'px';
    img.style.objectFit = 'cover';
    img.dataset.size = size;
    
    img.onerror = function() {
        handleProfileImageError(this, size);
    };
    
    return img;
}

// Initialize when script loads
initializeProfileImageHandling();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        handleProfileImageError,
        createProfileImage,
        DEFAULT_PROFILE_CONFIG
    };
}
