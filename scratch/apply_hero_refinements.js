const fs = require('fs');

// 1. Update views/index.ejs
let indexHtml = fs.readFileSync('views/index.ejs', 'utf8');

// A. Remove navSearchIcon injection
const searchInjectRegex = /if \(!document\.getElementById\('navSearchIcon'\)\) \{[\s\S]*?auth\.parentNode\.insertBefore\(li, auth\);\s*\}\s*\}/;
if (searchInjectRegex.test(indexHtml)) {
  indexHtml = indexHtml.replace(searchInjectRegex, '// Navbar search icon removed per specification');
  console.log('Removed navSearchIcon injection from views/index.ejs');
} else {
  console.log('navSearchIcon injection regex did not match in views/index.ejs');
}

// B. Update carousel-inner to add slide-specific classes & ambient blur
const carouselInnerOldRegex = /<div class="carousel-inner">[\s\S]*?<% heroSlides\.forEach\(\(slide, index\) => \{[\s\S]*?<\/div>\s*<% \}\); %>\s*<\/div>/;

const newCarouselInner = `<div class="carousel-inner">
              <% heroSlides.forEach((slide, index) => { 
                   const targetLink = slide.linkUrl || '/';
                   const isExternal = /^https?:\\/\\//i.test(targetLink);
                   
                   let slideClass = 'rh-slide-custom';
                   let slideBg = '#0E0E0E';
                   if (slide.imageUrl && slide.imageUrl.includes('festival-hero')) {
                     slideClass = 'rh-slide-festival';
                     slideBg = '#1A0806';
                   } else if (slide.imageUrl && slide.imageUrl.includes('ijl3ds')) {
                     slideClass = 'rh-slide-artist-register';
                     slideBg = '#3B115D';
                   } else if (slide.imageUrl && slide.imageUrl.includes('kdfqrs')) {
                     slideClass = 'rh-slide-album-us';
                     slideBg = '#7657CE';
                   } else if (slide.imageUrl && slide.imageUrl.includes('tps9ck')) {
                     slideClass = 'rh-slide-circlebound';
                     slideBg = '#11100C';
                   }
              %>
                <div class="carousel-item <%= index === 0 ? 'active' : '' %> <%= slideClass %>" style="background-color: <%= slideBg %>;" data-slide-index="<%= index %>">
                  <a href="<%= targetLink %>" class="rh-slide-link text-decoration-none d-block w-100 h-100 position-relative" <%= isExternal ? 'target="_blank" rel="noopener noreferrer"' : '' %>>
                    <!-- Ambient blurred backdrop for contained artwork -->
                    <div class="rh-slide-bg-blur" style="background-image: url('<%= slide.imageUrl %>');" aria-hidden="true"></div>
                    
                    <!-- Crisp foreground slide image -->
                    <img src="<%= slide.imageUrl %>" alt="<%= slide.title || 'Slide' %>" class="rh-slide-img" loading="<%= index === 0 ? 'eager' : 'lazy' %>">
                    
                    <div class="editorial-overlay"></div>
                    <% if (slide.title || slide.badge) { %>
                      <div class="carousel-caption">
                        <% if (slide.badge) { %>
                          <span class="badge bg-crimson font-subdisplay px-2 py-1 mb-2 small"><%= slide.badge %></span>
                        <% } %>
                        <% if (slide.title) { %>
                          <h2 class="fs-4 text-white fw-bold mb-1"><%= slide.title %></h2>
                        <% } %>
                      </div>
                    <% } %>
                  </a>
                </div>
              <% }); %>
            </div>`;

if (carouselInnerOldRegex.test(indexHtml)) {
  indexHtml = indexHtml.replace(carouselInnerOldRegex, newCarouselInner);
  console.log('Updated carousel-inner in views/index.ejs');
} else {
  console.log('carousel-inner regex did not match in views/index.ejs');
}

fs.writeFileSync('views/index.ejs', indexHtml, 'utf8');

// 2. Update public/css/homepage.css
let css = fs.readFileSync('public/css/homepage.css', 'utf8');

// A. Remove/replace #navSearchIcon styles
const navSearchCssRegex = /\/\* Search Icon in Navbar \*\/[\s\S]*?body\.rh-homepage-active #navSearchIcon a:hover\s*\{[\s\S]*?\}/;
const newNavSearchCss = `/* Navbar Search Icon Removed */
body:has(.rapira-homepage) #navSearchIcon,
body.rh-homepage-active #navSearchIcon {
  display: none !important;
}`;

if (navSearchCssRegex.test(css)) {
  css = css.replace(navSearchCssRegex, newNavSearchCss);
  console.log('Replaced navSearchIcon styles in homepage.css');
} else {
  console.log('navSearchCssRegex did not match in homepage.css');
}

// B. Update mobile hero buttons in homepage.css
const oldMobileHeroCtaRegex = /\.rapira-homepage \.rh-hero-cta-group\s*\{[\s\S]*?flex-direction:\s*column\s*!important;[\s\S]*?\.rapira-homepage \.rh-btn-outline-pill\s*\{[\s\S]*?justify-content:\s*center\s*!important;\s*\}/;

const newMobileHeroCtaCss = `.rapira-homepage .rh-hero-cta-group {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    justify-content: center !important;
    align-items: center !important;
    width: 100% !important;
    max-width: 345px !important;
    margin: 0.65rem auto 0 auto !important;
    gap: 8px !important;
  }
  .rapira-homepage .rh-btn-crimson-solid,
  .rapira-homepage .rh-btn-outline-pill {
    flex: 1 1 0 !important;
    width: auto !important;
    max-width: 165px !important;
    min-width: 0 !important;
    height: 38px !important;
    padding: 7px 12px !important;
    font-size: clamp(0.76rem, 3.2vw, 0.84rem) !important;
    font-weight: 600 !important;
    white-space: nowrap !important;
    justify-content: center !important;
    text-align: center !important;
    border-radius: 9999px !important;
    box-sizing: border-box !important;
    letter-spacing: -0.01em !important;
  }`;

if (oldMobileHeroCtaRegex.test(css)) {
  css = css.replace(oldMobileHeroCtaRegex, newMobileHeroCtaCss);
  console.log('Updated mobile hero CTA buttons in homepage.css');
} else {
  console.log('oldMobileHeroCtaRegex did not match in homepage.css');
}

// C. Update hero banner container and carousel slide rules in homepage.css
const oldHeroBannerRegex = /\/\* Hero Banner Frame \*\/[\s\S]*?\.rapira-homepage \.rh-hero-banner-container \.carousel-indicators \.active\s*\{[\s\S]*?width:\s*32px;\s*\}/;

const newHeroBannerCss = `/* Hero Banner Frame */
.rapira-homepage .rh-hero-banner-container {
  width: 100%;
  height: clamp(380px, 28vw, 420px);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 8px 28px rgba(159, 25, 14, 0.08);
  border: 1px solid var(--rh-border);
  background-color: #0E0E0E;
  position: relative;
}

@media (max-width: 991.98px) and (min-width: 768px) {
  .rapira-homepage .rh-hero-banner-container {
    height: clamp(320px, 36vw, 360px) !important;
    border-radius: 16px !important;
  }
}

@media (max-width: 767.98px) {
  .rapira-homepage .rh-hero-banner-container {
    height: clamp(265px, 72vw, 310px) !important;
    border-radius: 14px !important;
    margin-top: 1.25rem !important;
  }
}

.rapira-homepage .rh-hero-banner-container #mainCarousel,
.rapira-homepage .rh-hero-banner-container .carousel-inner,
.rapira-homepage .rh-hero-banner-container .carousel-item {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

/* Ambient Blurred Backdrop for contained artwork */
.rapira-homepage .rh-slide-bg-blur {
  position: absolute;
  inset: -20px;
  background-size: cover;
  background-position: center;
  filter: blur(32px) brightness(0.65) saturate(1.3);
  transform: scale(1.15);
  opacity: 0.55;
  pointer-events: none;
  z-index: 1;
}

/* Crisp foreground slide image */
.rapira-homepage .rh-slide-img {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
  display: block;
}

/* Slide 0: Festival Panoramic Photo -> full-bleed cover */
.rapira-homepage .rh-slide-festival .rh-slide-bg-blur {
  display: none !important;
}
.rapira-homepage .rh-slide-festival .rh-slide-img {
  object-fit: cover !important;
  object-position: center 38% !important;
}

/* Slide 1: Register as Artist -> contained in center, seamless purple background */
.rapira-homepage .rh-slide-artist-register {
  background-color: #3B115D !important;
}
.rapira-homepage .rh-slide-artist-register .rh-slide-img {
  object-fit: contain !important;
  object-position: center !important;
}

/* Slide 2: US EP Album -> contained in center, seamless purple-maroon background */
.rapira-homepage .rh-slide-album-us {
  background: linear-gradient(135deg, #7657CE 0%, #43213F 100%) !important;
}
.rapira-homepage .rh-slide-album-us .rh-slide-img {
  object-fit: contain !important;
  object-position: center !important;
}

/* Slide 3: Circlebound Artwork -> contained in center, seamless black background */
.rapira-homepage .rh-slide-circlebound {
  background-color: #11100C !important;
}
.rapira-homepage .rh-slide-circlebound .rh-slide-img {
  object-fit: contain !important;
  object-position: center !important;
}

/* Fallback for any other slide */
.rapira-homepage .rh-slide-custom .rh-slide-img {
  object-fit: contain !important;
  object-position: center !important;
}

.rapira-homepage .rh-hero-banner-container .editorial-overlay {
  position: absolute;
  inset: 0;
  z-index: 3;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.02) 0%, rgba(0, 0, 0, 0.22) 100%);
  pointer-events: none;
}

.rapira-homepage .rh-hero-banner-container .carousel-caption {
  position: absolute;
  bottom: 1.25rem;
  left: 2rem;
  right: auto;
  max-width: 480px;
  padding: 0.6rem 1.15rem;
  text-align: left;
  z-index: 4;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

@media (max-width: 767.98px) {
  .rapira-homepage .rh-hero-banner-container .carousel-caption {
    left: 0.85rem !important;
    bottom: 0.65rem !important;
    right: 0.85rem !important;
    max-width: calc(100% - 1.7rem) !important;
    padding: 0.4rem 0.75rem !important;
  }
  .rapira-homepage .rh-hero-banner-container .carousel-caption h2 {
    font-size: 0.92rem !important;
    margin-bottom: 0 !important;
  }
}

.rapira-homepage .rh-hero-banner-container .carousel-indicators [data-bs-target] {
  width: 20px;
  height: 3px;
  border-radius: 2px;
  background-color: rgba(255, 255, 255, 0.5);
  border: none;
  margin: 0 4px;
}

.rapira-homepage .rh-hero-banner-container .carousel-indicators .active {
  background-color: var(--rh-crimson);
  width: 32px;
}`;

if (oldHeroBannerRegex.test(css)) {
  css = css.replace(oldHeroBannerRegex, newHeroBannerCss);
  console.log('Updated hero banner container & carousel rules in homepage.css');
} else {
  console.log('oldHeroBannerRegex did not match in homepage.css');
}

fs.writeFileSync('public/css/homepage.css', css, 'utf8');
console.log('Successfully saved public/css/homepage.css');

