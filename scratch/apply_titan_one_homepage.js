const fs = require('fs');

const p = 'public/css/homepage.css';
let css = fs.readFileSync(p, 'utf8');

// 1. Replace Font Face Declarations (Lines 20-50)
const fontFaceSection = `/* ========================================================
   TITAN ONE FONT (Google Fonts / SIL Open Font License 1.1)
   Designed by Rodrigo Fuenzalida
   Official Final Selected Display Typeface for RAPIRA
   ======================================================== */
@font-face {
  font-family: 'Titan One';
  src: url('/fonts/titan-one.woff2') format('woff2'),
       url('/fonts/titan-one.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

/* Secondary Fallback Display Font */
@font-face {
  font-family: 'Tanker';
  src: url('/fonts/tanker.woff2') format('woff2'),
       url('/fonts/tanker.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}`;

// Find start of NOTRE FONT and replace up to end of TANKER FONT
const notreStart = css.indexOf('/* ========================================================\n   NOTRE FONT');
const tankerEnd = css.indexOf('/* Offset main padding', notreStart);

if (notreStart !== -1 && tankerEnd !== -1) {
  css = css.substring(0, notreStart) + fontFaceSection + '\n\n' + css.substring(tankerEnd);
  console.log('Replaced @font-face declarations with Titan One');
} else {
  console.error('Could not find @font-face marker!');
}

// 2. Update Navbar Brand font-family
css = css.replace(
  "font-family: 'Anton', sans-serif !important;\n  font-size: 1.85rem !important;",
  "font-family: 'Titan One', 'Impact', sans-serif !important;\n  font-size: 1.75rem !important;\n  letter-spacing: -0.01em !important;"
);
console.log('Updated Navbar Brand font');

// 3. Update Footer Brand font-family (first occurrence around line 350)
css = css.replace(
  "font-family: 'Anton', sans-serif !important;\n  font-size: 1.85rem !important;\n  color: #9F190E !important;",
  "font-family: 'Titan One', 'Impact', sans-serif !important;\n  font-size: 1.85rem !important;\n  letter-spacing: -0.01em !important;\n  color: #9F190E !important;"
);

// 4. Update Footer Brand (around line 2850)
css = css.replace(
  "font-family: 'Notre', 'Anton', sans-serif !important;\n  font-size: 2.2rem;",
  "font-family: 'Titan One', 'Impact', sans-serif !important;\n  font-size: 2.1rem;\n  letter-spacing: -0.01em;"
);
console.log('Updated Footer Brand fonts');

// 5. Update Hero Headline (.rapira-homepage .rh-hero-headline)
const heroTarget = `.rapira-homepage .rh-hero-headline {
  font-family: 'Notre', 'Tanker', 'Anton', sans-serif !important;
  font-size: clamp(3.2rem, 9.4vw, 8.2rem);
  line-height: 0.92;
  color: var(--rh-crimson);
  margin: 0;
  letter-spacing: 0.01em;
  text-transform: uppercase;
  text-align: center;
  user-select: none;
}`;

const heroReplacement = `.rapira-homepage .rh-hero-headline {
  font-family: 'Titan One', 'Impact', 'Arial Black', sans-serif !important;
  font-size: clamp(2.4rem, 7.2vw, 6.4rem);
  line-height: 1.04;
  color: var(--rh-crimson);
  margin: 0;
  letter-spacing: -0.01em;
  text-transform: uppercase;
  text-align: center;
  user-select: none;
}`;

if (css.includes(heroTarget)) {
  css = css.replace(heroTarget, heroReplacement);
  console.log('Updated Hero Headline CSS');
} else {
  console.log('Hero headline target not found exactly, searching substring...');
  const hIdx = css.indexOf('.rapira-homepage .rh-hero-headline {');
  const hEnd = css.indexOf('}', hIdx);
  css = css.substring(0, hIdx) + heroReplacement + css.substring(hEnd + 1);
  console.log('Replaced Hero Headline CSS via index');
}

// 6. Update Hero Headline Mobile Media Query (under @media (max-width: 767.98px))
const heroMobileTarget = `.rapira-homepage .rh-hero-headline {
    font-size: clamp(2rem, 8.8vw, 3.2rem) !important;
    line-height: 0.96 !important;
    letter-spacing: normal !important;
    word-break: normal !important;
    overflow-wrap: normal !important;
    white-space: normal !important;
    padding: 0 0.5rem !important;
    margin: 0 auto !important;
    max-width: 100% !important;
  }`;

const heroMobileReplacement = `.rapira-homepage .rh-hero-headline {
    font-size: clamp(1.8rem, 8.2vw, 2.75rem) !important;
    line-height: 1.08 !important;
    letter-spacing: -0.01em !important;
    word-break: normal !important;
    overflow-wrap: normal !important;
    white-space: normal !important;
    padding: 0 0.5rem !important;
    margin: 0 auto !important;
    max-width: 100% !important;
  }`;

if (css.includes(heroMobileTarget)) {
  css = css.replace(heroMobileTarget, heroMobileReplacement);
  console.log('Updated Hero Headline Mobile CSS');
}

// 7. Update Section Titles (.rh-section-title)
const sectionTarget = `.rapira-homepage .rh-section-title {
  font-family: 'Anton', sans-serif;
  font-size: clamp(1.85rem, 3.4vw, 2.5rem);
  font-weight: 400;
  color: var(--rh-crimson);
  letter-spacing: 0.02em;
  margin: 0;
  line-height: 1.1;
}`;

const sectionReplacement = `.rapira-homepage .rh-section-title {
  font-family: 'Titan One', 'Impact', 'Arial Black', sans-serif !important;
  font-size: clamp(1.6rem, 2.8vw, 2.25rem);
  font-weight: 400;
  color: var(--rh-crimson);
  letter-spacing: -0.01em;
  margin: 0;
  line-height: 1.15;
}`;

if (css.includes(sectionTarget)) {
  css = css.replace(sectionTarget, sectionReplacement);
  console.log('Updated Section Titles CSS');
}

// 8. Update Coming Soon Card
css = css.replace(
  `.rapira-homepage .rh-coming-soon-card h3 {\n  font-family: 'Anton', sans-serif;`,
  `.rapira-homepage .rh-coming-soon-card h3 {\n  font-family: 'Titan One', 'Impact', sans-serif !important;\n  letter-spacing: -0.01em;`
);

// 9. Update "How RAPIRA Works" Section Headings
// 9a. Headline: DISCOVER. CONNECT. EXPERIENCE.
const howHeadlineTarget = `.rapira-homepage .rh-how-headline {
  font-family: 'Notre', 'Tanker', 'Anton', sans-serif !important;
  font-size: clamp(2.4rem, 5.2vw, 4.2rem);
  line-height: 0.95;
  color: var(--rh-crimson);
  text-transform: uppercase;
  letter-spacing: 0.01em;
  margin: 0 auto 0.75rem auto;
  max-width: 900px;
  text-align: center;
}`;

const howHeadlineReplacement = `.rapira-homepage .rh-how-headline {
  font-family: 'Titan One', 'Impact', 'Arial Black', sans-serif !important;
  font-size: clamp(1.9rem, 4.2vw, 3.3rem);
  line-height: 1.1;
  color: var(--rh-crimson);
  text-transform: uppercase;
  letter-spacing: -0.01em;
  margin: 0 auto 0.75rem auto;
  max-width: 900px;
  text-align: center;
}`;

if (css.includes(howHeadlineTarget)) {
  css = css.replace(howHeadlineTarget, howHeadlineReplacement);
  console.log('Updated How RAPIRA Works headline CSS');
}

// 9b. How RAPIRA Works headline mobile
css = css.replace(
  `.rapira-homepage .rh-how-headline {\n    font-size: clamp(2rem, 8.4vw, 2.75rem);`,
  `.rapira-homepage .rh-how-headline {\n    font-size: clamp(1.55rem, 6.8vw, 2.2rem) !important;\n    line-height: 1.15 !important;\n    letter-spacing: -0.01em !important;`
);

// 9c. Card Numbers: 01, 02, 03
css = css.replace(
  `font-family: 'Notre', 'Tanker', 'Anton', sans-serif !important;\n  font-size: clamp(3.2rem, 3.8vw, 3.8rem);\n  line-height: 0.95;\n  font-weight: 900;`,
  `font-family: 'Titan One', 'Impact', sans-serif !important;\n  font-size: clamp(2.6rem, 3.2vw, 3.4rem);\n  line-height: 1;\n  font-weight: 400;\n  letter-spacing: -0.02em;`
);

// 9d. Card Titles: DISCOVER, CONNECT, EXPERIENCE
css = css.replace(
  `.rapira-homepage .rh-card-title {\n  font-family: 'Notre', 'Tanker', 'Anton', sans-serif !important;\n  font-size: clamp(1.9rem, 2.3vw, 2.5rem);\n  line-height: 1;`,
  `.rapira-homepage .rh-card-title {\n  font-family: 'Titan One', 'Impact', sans-serif !important;\n  font-size: clamp(1.65rem, 2vw, 2.15rem);\n  line-height: 1.1;\n  letter-spacing: -0.01em;`
);

// 10. Update "Are You an Artist?" Title (.rh-artist-cta-title)
const ctaTarget = `.rapira-homepage .rh-artist-cta-title {
  font-family: 'Notre', 'Tanker', 'Anton', sans-serif !important;
  font-size: clamp(2.2rem, 4vw, 3.2rem);
  line-height: 0.96;
  color: var(--rh-crimson);
  margin: 0 0 1rem 0;
  letter-spacing: 0.01em;
  text-transform: uppercase;
}`;

const ctaReplacement = `.rapira-homepage .rh-artist-cta-title {
  font-family: 'Titan One', 'Impact', 'Arial Black', sans-serif !important;
  font-size: clamp(1.85rem, 3.4vw, 2.75rem);
  line-height: 1.08;
  color: var(--rh-crimson);
  margin: 0 0 1rem 0;
  letter-spacing: -0.01em;
  text-transform: uppercase;
}`;

if (css.includes(ctaTarget)) {
  css = css.replace(ctaTarget, ctaReplacement);
  console.log('Updated Artist CTA Title CSS');
}

// 10b. Artist CTA mobile
css = css.replace(
  `.rapira-homepage .rh-artist-cta-title {\n    font-size: 2.1rem;\n    line-height: 1.0;`,
  `.rapira-homepage .rh-artist-cta-title {\n    font-size: clamp(1.65rem, 6.8vw, 2.1rem) !important;\n    line-height: 1.15 !important;\n    letter-spacing: -0.01em !important;`
);

fs.writeFileSync(p, css, 'utf8');
console.log('public/css/homepage.css successfully updated with Titan One!');

