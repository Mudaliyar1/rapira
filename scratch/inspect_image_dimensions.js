const sharp = require('sharp');
const axios = require('axios');
const fs = require('fs');

(async () => {
  // Slide 0: local file
  const meta0 = await sharp('public/images/festival-hero.jpg').metadata();
  console.log('Slide 0 (/images/festival-hero.jpg):', meta0.width, 'x', meta0.height, 'ratio:', (meta0.width / meta0.height).toFixed(2));

  // Remote slides
  const remoteUrls = [
    'https://res.cloudinary.com/dlbwyl1ci/image/upload/v1771789986/rapira/admin/home-hero-carousel/file_ijl3ds.jpg',
    'https://res.cloudinary.com/dlbwyl1ci/image/upload/v1772997906/rapira/admin/home-hero-carousel/file_kdfqrs.jpg',
    'https://res.cloudinary.com/dlbwyl1ci/image/upload/v1773570082/rapira/admin/home-hero-carousel/file_tps9ck.jpg'
  ];

  for (let i = 0; i < remoteUrls.length; i++) {
    try {
      const res = await axios.get(remoteUrls[i], { responseType: 'arraybuffer' });
      const meta = await sharp(Buffer.from(res.data)).metadata();
      console.log(`Slide ${i + 1} (${remoteUrls[i]}):`, meta.width, 'x', meta.height, 'ratio:', (meta.width / meta.height).toFixed(2));
    } catch (e) {
      console.error(`Slide ${i + 1} error:`, e.message);
    }
  }
})();

