async function fetchPages() {
  const urls = [
    'http://localhost:3000/',
    'http://localhost:3000/concerts',
    'http://localhost:3000/artists',
    'http://localhost:3000/content'
  ];
  for (const u of urls) {
    try {
      const res = await fetch(u);
      const html = await res.text();
      const imgs = html.match(/(?:src|href|url\()[\s=:\"\']{1,4}(https?:\/\/[^\"\'\)]+|\/images\/[^\"\'\)]+)/gi) || [];
      console.log('=== ' + u + ' ===');
      console.log(Array.from(new Set(imgs)));
    } catch (e) {
      console.log('Error ' + u + ':', e.message);
    }
  }
}
fetchPages();

