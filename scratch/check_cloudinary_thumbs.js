const https = require('https');

const urls = [
  // Videos & derived jpgs
  'https://res.cloudinary.com/dlbwyl1ci/video/upload/v1771783781/rapira/artist-posts/videos/file_i4o4zn.jpg',
  'https://res.cloudinary.com/dlbwyl1ci/video/upload/so_0/v1771783781/rapira/artist-posts/videos/file_i4o4zn.jpg',
  'https://res.cloudinary.com/dlbwyl1ci/video/upload/v1772370075/rapira/artist-posts/videos/file_lueitr.jpg',
  'https://res.cloudinary.com/dlbwyl1ci/video/upload/v1772882951/rapira/artist-posts/videos/file_jgs8ey.jpg',
  'https://res.cloudinary.com/dlbwyl1ci/video/upload/so_0/v1772882951/rapira/artist-posts/videos/file_jgs8ey.jpg',
  'https://res.cloudinary.com/dlbwyl1ci/video/upload/v1772883353/rapira/artist-posts/videos/file_rhulqk.jpg',
  'https://res.cloudinary.com/dlbwyl1ci/video/upload/v1773255019/rapira/artist-posts/videos/file_kdchpp.jpg',
  'https://res.cloudinary.com/dlbwyl1ci/video/upload/so_0/v1773255019/rapira/artist-posts/videos/file_kdchpp.jpg',
  // Audio thumbnails
  'https://res.cloudinary.com/dlbwyl1ci/image/upload/v1776446015/rapira/artist-posts/thumbnails/file_zgzzd3.jpg'
];

async function checkUrl(url) {
  return new Promise((resolve) => {
    const req = https.get(url, (res) => {
      resolve({ url, status: res.statusCode, contentType: res.headers['content-type'], length: res.headers['content-length'] });
    });
    req.on('error', (err) => resolve({ url, error: err.message }));
  });
}

(async () => {
  for (const u of urls) {
    const r = await checkUrl(u);
    console.log(r.status, r.contentType, r.length, r.url);
  }
})();

