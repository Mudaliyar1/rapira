const fs = require('fs');

let css = fs.readFileSync('public/css/homepage.css', 'utf8');

// Find the section between .rh-how-cards-track::-webkit-scrollbar and .rh-how-pagination
const startMarker = '  .rapira-homepage .rh-how-cards-track::-webkit-scrollbar {\r\n    display: none !important;\r\n  }';
const altStartMarker = '  .rapira-homepage .rh-how-cards-track::-webkit-scrollbar {\n    display: none !important;\n  }';

const endMarker = '  .rapira-homepage .rh-how-pagination {';

const replacement = `  .rapira-homepage .rh-how-cards-track::-webkit-scrollbar {
    display: none !important;
  }
  /* Mobile How RAPIRA Works Cards: Dedicated 2-Column Responsive Layout (Zero Text/Image Collision) */
  .rapira-homepage .rh-how-card {
    flex: 0 0 86% !important;
    width: 86% !important;
    max-width: 335px !important;
    min-width: 290px !important;
    min-height: 405px !important;
    height: 405px !important;
    scroll-snap-align: start !important;
    scroll-snap-stop: always !important;
    border-radius: 20px !important;
    position: relative !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
  }
  .rapira-homepage .rh-how-card-inner {
    display: flex !important;
    flex-direction: row !important;
    justify-content: space-between !important;
    align-items: stretch !important;
    width: 100% !important;
    height: 100% !important;
    padding: 1.75rem 1.15rem 1.65rem 1.35rem !important;
    position: relative !important;
    box-sizing: border-box !important;
    overflow: hidden !important;
    z-index: 2 !important;
  }

  /* Left Text Column: Dedicated, Unconstrained Width Never Touched by Artwork */
  .rapira-homepage .rh-card-content {
    flex: 1 1 auto !important;
    width: 61% !important;
    max-width: 63% !important;
    min-width: 0 !important;
    height: 100% !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: flex-start !important;
    justify-content: flex-start !important;
    position: relative !important;
    z-index: 2 !important;
    padding-right: 0.5rem !important;
  }
  .rapira-homepage .rh-card-number {
    font-size: 2.5rem !important;
    line-height: 1 !important;
    margin: 0 0 0.35rem 0 !important;
    pointer-events: none !important;
    user-select: none !important;
  }
  .rapira-homepage .rh-card-badge {
    width: 38px !important;
    height: 38px !important;
    font-size: 1.05rem !important;
    border-radius: 12px !important;
    margin: 0 0 0.65rem 0 !important;
    flex-shrink: 0 !important;
  }
  .rapira-homepage .rh-card-title {
    font-size: clamp(1.4rem, 4.8vw, 1.65rem) !important;
    line-height: 1.1 !important;
    letter-spacing: -0.01em !important;
    margin: 0 0 0.45rem 0 !important;
    word-break: normal !important;
  }
  .rapira-homepage .rh-card-desc {
    font-size: 0.81rem !important;
    line-height: 1.48 !important;
    margin: 0 0 0.85rem 0 !important;
  }
  .rapira-homepage .rh-card-cta-btn {
    width: 38px !important;
    height: 38px !important;
    border-radius: 50% !important;
    font-size: 1rem !important;
    margin-top: auto !important;
    flex-shrink: 0 !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
  }

  /* Right Artwork Column: Reserved Visual Region Strictly Within Card Boundaries */
  .rapira-homepage .rh-card-art {
    position: relative !important;
    top: auto !important;
    right: auto !important;
    bottom: auto !important;
    left: auto !important;
    flex: 0 0 39% !important;
    width: 39% !important;
    max-width: 39% !important;
    height: 100% !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    pointer-events: none !important;
    user-select: none !important;
    z-index: 1 !important;
    overflow: hidden !important;
  }

  /* Card 01 (Discover - Vinyl Record): Scaled & Perfectly Contained in Right Column */
  .rapira-homepage .rh-card-discover .rh-card-art {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    overflow: hidden !important;
  }
  .rapira-homepage .rh-card-discover .rh-card-art picture {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 100% !important;
    height: 100% !important;
  }
  .rapira-homepage .rh-card-discover .rh-art-img {
    width: 100% !important;
    max-width: 110px !important;
    height: auto !important;
    aspect-ratio: 1 / 1 !important;
    object-fit: contain !important;
    position: static !important;
    transform: none !important;
    border-radius: 50% !important;
    filter: drop-shadow(0 6px 14px rgba(159, 25, 14, 0.14)) !important;
  }

  /* Card 02 (Connect - Crimson Concert Crowd): Fully Contained in Right Column */
  .rapira-homepage .rh-card-connect .rh-card-art {
    display: flex !important;
    align-items: flex-end !important;
    justify-content: center !important;
    overflow: hidden !important;
    border-radius: 0 20px 20px 0 !important;
    -webkit-mask-image: linear-gradient(to right, transparent 0%, black 14%, black 100%);
    mask-image: linear-gradient(to right, transparent 0%, black 14%, black 100%);
  }
  .rapira-homepage .rh-card-connect .rh-card-art picture {
    width: 100% !important;
    height: 100% !important;
    display: block !important;
  }
  .rapira-homepage .rh-card-connect .rh-art-img {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
    object-position: center bottom !important;
    position: static !important;
    transform: none !important;
  }

  /* Card 03 (Experience - Ticket): Fully Contained in Right Column */
  .rapira-homepage .rh-card-experience .rh-card-art {
    display: flex !important;
    align-items: flex-end !important;
    justify-content: center !important;
    overflow: hidden !important;
    border-radius: 0 20px 20px 0 !important;
  }
  .rapira-homepage .rh-card-experience .rh-card-art picture {
    width: 100% !important;
    height: 100% !important;
    display: flex !important;
    align-items: flex-end !important;
    justify-content: center !important;
  }
  .rapira-homepage .rh-card-experience .rh-art-img {
    width: 100% !important;
    max-width: 110px !important;
    height: auto !important;
    max-height: 90% !important;
    object-fit: contain !important;
    object-position: center bottom !important;
    position: static !important;
    transform: none !important;
    filter: drop-shadow(0 6px 14px rgba(159, 25, 14, 0.10)) !important;
  }

  `;

let sIdx = css.indexOf(startMarker);
let markerLen = startMarker.length;
if (sIdx === -1) {
  sIdx = css.indexOf(altStartMarker);
  markerLen = altStartMarker.length;
}

const eIdx = css.indexOf(endMarker);

if (sIdx !== -1 && eIdx !== -1) {
  css = css.slice(0, sIdx) + replacement + css.slice(eIdx);
  fs.writeFileSync('public/css/homepage.css', css, 'utf8');
  console.log('Successfully updated mobile card layout in public/css/homepage.css');
} else {
  console.log('Markers not found:', sIdx, eIdx);
}

