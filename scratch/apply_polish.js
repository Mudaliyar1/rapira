const fs = require('fs');
const path = require('path');

// 1. Update views/index.ejs: clean pagination container markup
let indexHtml = fs.readFileSync('views/index.ejs', 'utf8');

const oldPaginationRegex = /<div class="rh-how-pagination[^"]*" id="howWorksPagination"[^>]*>[\s\S]*?<\/div>/;
const newPagination = `<div class="rh-how-pagination" id="howWorksPagination" role="tablist" aria-label="How RAPIRA Works pagination">
        <button type="button" class="rh-how-dot active" data-index="0" aria-label="Go to slide 1"></button>
        <button type="button" class="rh-how-dot" data-index="1" aria-label="Go to slide 2"></button>
        <button type="button" class="rh-how-dot" data-index="2" aria-label="Go to slide 3"></button>
      </div>`;

if (oldPaginationRegex.test(indexHtml)) {
  indexHtml = indexHtml.replace(oldPaginationRegex, newPagination);
  fs.writeFileSync('views/index.ejs', indexHtml, 'utf8');
  console.log('Successfully updated views/index.ejs pagination markup');
} else {
  console.log('Could not find old pagination markup in views/index.ejs');
}

// 2. Update public/css/homepage.css: pagination dots and artist cta button centering
let css = fs.readFileSync('public/css/homepage.css', 'utf8');

// Ensure desktop hides .rh-how-pagination
if (!css.includes('.rapira-homepage .rh-how-pagination {')) {
  console.log('Adding .rh-how-pagination desktop rule');
}

// Let's replace the mobile pagination rules in homepage.css
const oldMobilePagRegex = /\.rapira-homepage \.rh-how-pagination\s*\{[\s\S]*?\.rapira-homepage \.rh-how-dot\.active\s*\{[\s\S]*?\}/;
const newMobilePagCss = `.rapira-homepage .rh-how-pagination {
    display: flex !important;
    flex-direction: row !important;
    justify-content: center !important;
    align-items: center !important;
    gap: 8px !important;
    width: 100% !important;
    margin: 1.25rem auto 0.25rem auto !important;
    padding: 0 !important;
  }
  .rapira-homepage .rh-how-dot {
    width: 8px !important;
    height: 8px !important;
    border-radius: 9999px !important;
    background-color: #EAC8B7 !important;
    border: none !important;
    padding: 0 !important;
    margin: 0 !important;
    cursor: pointer !important;
    outline: none !important;
    transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1) !important;
    flex-shrink: 0 !important;
    box-shadow: none !important;
    display: inline-block !important;
  }
  .rapira-homepage .rh-how-dot.active {
    width: 24px !important;
    border-radius: 12px !important;
    background-color: var(--rh-crimson) !important;
  }`;

if (oldMobilePagRegex.test(css)) {
  css = css.replace(oldMobilePagRegex, newMobilePagCss);
  console.log('Replaced mobile pagination CSS');
} else {
  console.log('Could not find old mobile pagination CSS');
}

// Add desktop rule for .rh-how-pagination if not already before the media query
const desktopPagRule = `
/* How RAPIRA Works Mobile Carousel Pagination (Desktop Hidden) */
.rapira-homepage .rh-how-pagination {
  display: none;
}
`;
if (!css.includes('.rapira-homepage .rh-how-pagination { display: none; }') && !css.includes('/* How RAPIRA Works Mobile Carousel Pagination (Desktop Hidden) */')) {
  css = css.replace('.rapira-homepage .rh-how-card {', desktopPagRule + '\n.rapira-homepage .rh-how-card {');
  console.log('Added desktop hidden rule for .rh-how-pagination');
}

// Now update mobile Artist CTA in homepage.css
const oldMobileCtaActionRegex = /\.rapira-homepage \.rh-artist-cta-action\s*\{[\s\S]*?width:\s*100%;\s*\}\s*\.rapira-homepage \.rh-cta-action-btn\s*\{[\s\S]*?width:\s*100%\s*!important;\s*max-width:\s*290px\s*!important;\s*justify-content:\s*center\s*!important;\s*padding:\s*12px\s*24px\s*!important;\s*\}/;

const newMobileCtaActionCss = `.rapira-homepage .rh-artist-cta-action {
    width: 100% !important;
    display: flex !important;
    justify-content: center !important;
    align-items: center !important;
    margin: 0.5rem auto 0 auto !important;
  }
  .rapira-homepage .rh-cta-action-btn {
    width: 100% !important;
    max-width: 290px !important;
    margin-left: auto !important;
    margin-right: auto !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 12px 28px !important;
    height: 48px !important;
    border-radius: 9999px !important;
    background-color: var(--rh-crimson) !important;
    color: #FFFFFF !important;
    box-shadow: 0 4px 16px rgba(159, 25, 14, 0.25) !important;
  }`;

if (oldMobileCtaActionRegex.test(css)) {
  css = css.replace(oldMobileCtaActionRegex, newMobileCtaActionCss);
  console.log('Replaced mobile Artist CTA CSS');
} else {
  console.log('Could not find old mobile Artist CTA CSS');
}

fs.writeFileSync('public/css/homepage.css', css, 'utf8');
console.log('Successfully written public/css/homepage.css');

