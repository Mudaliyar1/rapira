const axios = require('axios');
const sharp = require('sharp');

(async () => {
  const urls = [
    'https://res.cloudinary.com/dlbwyl1ci/image/upload/v1771789986/rapira/admin/home-hero-carousel/file_ijl3ds.jpg',
    'https://res.cloudinary.com/dlbwyl1ci/image/upload/v1772997906/rapira/admin/home-hero-carousel/file_kdfqrs.jpg',
    'https://res.cloudinary.com/dlbwyl1ci/image/upload/v1773570082/rapira/admin/home-hero-carousel/file_tps9ck.jpg'
  ];

  for (let i = 0; i < urls.length; i++) {
    const res = await axios.get(urls[i], { responseType: 'arraybuffer' });
    const img = sharp(Buffer.from(res.data));
    const meta = await img.metadata();
    
    // Sample corner colors
    const raw = await img.raw().toBuffer();
    // Top-left pixel
    const tlR = raw[0], tlG = raw[1], tlB = raw[2];
    // Bottom-left pixel
    const blIdx = (meta.height - 1) * meta.width * meta.channels;
    const blR = raw[blIdx], blG = raw[blIdx + 1], blB = raw[blIdx + 2];
    // Center pixel
    const cIdx = (Math.floor(meta.height / 2) * meta.width + Math.floor(meta.width / 2)) * meta.channels;
    const cR = raw[cIdx], cG = raw[cIdx + 1], cB = raw[cIdx + 2];

    console.log(`=== Slide ${i + 1} ===`);
    console.log(`Size: ${meta.width}x${meta.height}, Channels: ${meta.channels}`);
    console.log(`Top-Left: rgb(${tlR}, ${tlG}, ${tlB})`);
    console.log(`Bottom-Left: rgb(${blR}, ${blG}, ${blB})`);
    console.log(`Center: rgb(${cR}, ${cG}, ${cB})`);
  }
})();

