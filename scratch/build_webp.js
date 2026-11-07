const sharp = require('sharp');

(async () => {
  await sharp('public/images/how-it-works/card1-vinyl.png')
    .webp({ quality: 90 })
    .toFile('public/images/how-it-works/card1-vinyl.webp');

  await sharp('public/images/how-it-works/card2-crowd.png')
    .webp({ quality: 90 })
    .toFile('public/images/how-it-works/card2-crowd.webp');

  await sharp('public/images/how-it-works/card3-ticket.png')
    .webp({ quality: 90 })
    .toFile('public/images/how-it-works/card3-ticket.webp');

  console.log('WebP assets built successfully!');
})();

