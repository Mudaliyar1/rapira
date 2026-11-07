const fs = require('fs');

const p = 'views/index.ejs';
let content = fs.readFileSync(p, 'utf8');

// 1. Replace real reels card tag
const realTarget = `<div class="rh-reel-card" 
                   role="button"
                   tabindex="0"
                   aria-label="Play reel by <%= reelArtistName %>"
                   onclick="window.openRapiraReelIndex ? window.openRapiraReelIndex(<%= index %>) : window.openRapiraReel('<%= reel._id %>', '<%= mediaUrl %>', '<%= mediaType %>', '<%= reelArtistName %>', '<%= reelArtistImg %>', '<%= posterUrl %>', '<%= safeCaption %>')"
                   onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault(); window.openRapiraReelIndex ? window.openRapiraReelIndex(<%= index %>) : window.openRapiraReel('<%= reel._id %>', '<%= mediaUrl %>', '<%= mediaType %>', '<%= reelArtistName %>', '<%= reelArtistImg %>', '<%= posterUrl %>', '<%= safeCaption %>');}">`;

const realReplacement = `<div class="rh-reel-card" 
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
                   onclick="window.openRapiraReelCard ? window.openRapiraReelCard(this) : (window.openRapiraReelIndex ? window.openRapiraReelIndex(<%= index %>) : window.openRapiraReel('<%= reel._id %>', '<%= mediaUrl %>', '<%= mediaType %>', '<%= reelArtistName %>', '<%= reelArtistImg %>', '<%= posterUrl %>', '<%= safeCaption %>'))"
                   onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault(); this.click();}">`;

if (content.includes(realTarget)) {
  content = content.replace(realTarget, realReplacement);
  console.log('Replaced real card markup');
} else {
  console.log('Real card target not found directly, checking variations...');
}

// 2. Replace mock reels card tag
const mockTarget = `<div class="rh-reel-card"
                   role="button"
                   tabindex="0"
                   aria-label="Play reel by <%= mReel.artist %>"
                   onclick="window.openRapiraReelIndex ? window.openRapiraReelIndex(<%= idx %>) : window.openRapiraReel('mock-<%= idx %>', '<%= mReel.video %>', 'video', '<%= mReel.artist %>', '/images/default-profile.svg', '<%= mReel.img %>', 'Rapira festival reel')"
                   onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault(); window.openRapiraReelIndex ? window.openRapiraReelIndex(<%= idx %>) : window.openRapiraReel('mock-<%= idx %>', '<%= mReel.video %>', 'video', '<%= mReel.artist %>', '/images/default-profile.svg', '<%= mReel.img %>', 'Rapira festival reel');}">`;

const mockReplacement = `<div class="rh-reel-card"
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
                   onclick="window.openRapiraReelCard ? window.openRapiraReelCard(this) : (window.openRapiraReelIndex ? window.openRapiraReelIndex(<%= idx %>) : window.openRapiraReel('mock-<%= idx %>', '<%= mReel.video %>', 'video', '<%= mReel.artist %>', '/images/default-profile.svg', '<%= mReel.img %>', 'Rapira festival reel'))"
                   onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault(); this.click();}">`;

if (content.includes(mockTarget)) {
  content = content.replace(mockTarget, mockReplacement);
  console.log('Replaced mock card markup');
}

// 3. Clean up the extra script tag at the bottom if present
const scriptMarker = '<!-- Client-Side Reels Array Injection';
const scriptIdx = content.indexOf(scriptMarker);
if (scriptIdx !== -1) {
  const endDiv = '</div>';
  const lastDivIdx = content.lastIndexOf(endDiv);
  content = content.substring(0, scriptIdx).trimEnd() + '\n</div>\n';
  console.log('Cleaned up client-side reels array injection script tag');
}

fs.writeFileSync(p, content, 'utf8');
console.log('views/index.ejs card data attributes updated!');

