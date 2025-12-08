/**
 * Generate a default avatar URL with user's first letter
 * Uses a public avatar service or generates a simple SVG
 */

const getAvatarURL = (name) => {
  if (!name || typeof name !== 'string') {
    return '/images/default-profile.svg';
  }

  // Get first letter
  const firstLetter = name.trim().charAt(0).toUpperCase();

  // Use UI Avatars API - generates colorful initials avatars
  // Format: https://ui-avatars.com/api/?name=FIRST+LETTER&background=RANDOM&color=fff
  const colors = [
    'FF6B6B', // Red
    '4ECDC4', // Teal
    '45B7D1', // Blue
    'FFA502', // Orange
    'A8E6CF', // Green
    'FFD3B6', // Peach
    'FF9999', // Light Red
    '99CCFF', // Light Blue
    'FFCC99', // Light Orange
    'CC99FF'  // Light Purple
  ];

  // Use hash of name to pick consistent color
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % colors.length;
  const selectedColor = colors[colorIndex];

  // Return UI Avatars URL
  const avatarUrl = `https://ui-avatars.com/api/?name=${firstLetter}&background=${selectedColor}&color=fff&bold=true&size=200&font-size=0.4`;
  
  return avatarUrl;
};

module.exports = { getAvatarURL };
