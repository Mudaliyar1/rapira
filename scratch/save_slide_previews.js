const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs');

(async () => {
  const urls = [
    'https://res.cloudinary.com/dlbwyl1ci/image/upload/v1771789986/rapira/admin/home-hero-carousel/file_ijl3ds.jpg',
    'https://res.cloudinary.com/dlbwyl1ci/image/upload/v1772997906/rapira/admin/home-hero-carousel/file_kdfqrs.jpg',
    'https://res.cloudinary.com/dlbwyl1ci/image/upload/v1773570082/rapira/admin/home-hero-carousel/file_tps9ck.jpg'
  ];

  for (let i = 0; i < urls.length; i++) {
    const res = await axios.get(urls[i], { responseType: 'arraybuffer' });
    await sharp(Buffer.from(res.data)).resize(400).toFile(`scratch/slide_${i + 1}_preview.jpg`);
    console.log(`Saved scratch/slide_${i + 1}_preview.jpg`);
  }
})();

