const fs = require('fs');

const p = 'views/index.ejs';
let content = fs.readFileSync(p, 'utf8');

// Update safeCaption definition
const oldDef = `const captionStr = reel.caption || '';
                 const safeCaption = captionStr.replace(/"/g, '&quot;').replace(/'/g, "\\\\'");`;

// Let's find captionStr in index.ejs
const captionIdx = content.indexOf('const captionStr = reel.caption ||');
if (captionIdx !== -1) {
  const nextSemi = content.indexOf(';', content.indexOf('const safeCaption', captionIdx));
  const snippet = content.substring(captionIdx, nextSemi + 1);
  console.log('Found snippet:\n', snippet);
  
  const newSnippet = `const captionStr = reel.caption || '';
                 const safeCaption = captionStr.replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/\\r?\\n/g, ' ');`;
  content = content.replace(snippet, newSnippet);
  console.log('Replaced caption snippet');
}

// Update real card onclick to simple window.openRapiraReelCard(this)
const cardStart = content.indexOf('<div class="rh-reel-card" \n                   role="button"');
if (cardStart !== -1) {
  const cardEnd = content.indexOf('>', cardStart);
  const oldTag = content.substring(cardStart, cardEnd + 1);
  console.log('Found real card tag');
  
  const newTag = `<div class="rh-reel-card" 
                   role="button"
                   tabindex="0"
                   aria-label="Play reel by <%= reelArtistName %>"
                   data-reel-index="<%= index %>"
                   data-reel-id="<%= reel._id %>"
                   data-media-url="<%= mediaUrl %>"
                   data-media-type="<%= mediaType %>"
                   data-artist-name="<%= reelArtistName %>"
                   data-artist-img="<%= reelArtistImg %>"
                   data-artist-id="<%= (reel.artist && reel.artist._id) ? reel.artist._id : '' %>"
                   data-verified="<%= (reel.artist && reel.artist.verified) ? 'true' : 'false' %>"
                   data-poster-url="<%= posterUrl %>"
                   data-caption="<%= safeCaption %>"
                   data-likes="<%= reel.likesCount || 0 %>"
                   data-comments="<%= reel.commentsCount || 0 %>"
                   onclick="window.openRapiraReelCard(this)"
                   onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault(); window.openRapiraReelCard(this);}">`;
  content = content.replace(oldTag, newTag);
  console.log('Replaced real card tag with clean onclick');
}

// Update mock card onclick
const mockStart = content.indexOf('<div class="rh-reel-card"\n                   role="button"');
if (mockStart !== -1) {
  const mockEnd = content.indexOf('>', mockStart);
  const oldMockTag = content.substring(mockStart, mockEnd + 1);
  console.log('Found mock card tag');
  
  const newMockTag = `<div class="rh-reel-card"
                   role="button"
                   tabindex="0"
                   aria-label="Play reel by <%= mReel.artist %>"
                   data-reel-index="<%= idx %>"
                   data-reel-id="mock-<%= idx %>"
                   data-media-url="<%= mReel.video %>"
                   data-media-type="video"
                   data-artist-name="<%= mReel.artist %>"
                   data-artist-img="/images/default-profile.svg"
                   data-artist-id=""
                   data-verified="true"
                   data-poster-url="<%= mReel.img %>"
                   data-caption="Rapira festival reel"
                   data-likes="1200"
                   data-comments="24"
                   onclick="window.openRapiraReelCard(this)"
                   onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault(); window.openRapiraReelCard(this);}">`;
  content = content.replace(oldMockTag, newMockTag);
  console.log('Replaced mock card tag with clean onclick');
}

fs.writeFileSync(p, content, 'utf8');
console.log('Updated views/index.ejs successfully!');

