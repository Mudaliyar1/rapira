const fs = require('fs');

let css = fs.readFileSync('public/css/homepage.css', 'utf8');

const targetBlock = `.rapira-homepage .rh-artist-cta-action {
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
  }
}`;

const replacementBlock = `.rapira-homepage .rh-artist-cta-action {
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.rapira-homepage .rh-cta-action-btn {
  font-family: 'Poppins', sans-serif;
  font-size: 0.95rem !important;
  font-weight: 600 !important;
  padding: 12px 32px !important;
  height: 48px !important;
  white-space: nowrap !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  background-color: var(--rh-crimson) !important;
  color: #FFFFFF !important;
  border-radius: 9999px !important;
  border: 1px solid var(--rh-crimson) !important;
  box-shadow: 0 4px 16px rgba(159, 25, 14, 0.25) !important;
  text-decoration: none !important;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
  cursor: pointer !important;
}

.rapira-homepage .rh-cta-action-btn:hover {
  background-color: #82140B !important;
  border-color: #82140B !important;
  color: #FFFFFF !important;
  transform: translateY(-2px) !important;
  box-shadow: 0 8px 24px rgba(159, 25, 14, 0.35) !important;
}

@media (max-width: 991.98px) {
  .rapira-homepage .rh-artist-cta-card {
    padding: 2.5rem 2rem;
  }
}

@media (max-width: 767.98px) {
  .rapira-homepage .rh-artist-cta-card {
    padding: 2rem 1.5rem;
    border-radius: 16px;
  }
  .rapira-homepage .rh-artist-cta-title {
    font-size: clamp(1.65rem, 6.8vw, 2.1rem) !important;
    line-height: 1.15 !important;
    letter-spacing: -0.01em !important;
  }
  .rapira-homepage .rh-artist-cta-desc {
    font-size: 0.94rem;
    line-height: 1.55;
    margin-bottom: 1.4rem;
  }
  .rapira-homepage .rh-artist-cta-action {
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
  }
}`;

if (css.includes(targetBlock)) {
  css = css.replace(targetBlock, replacementBlock);
  fs.writeFileSync('public/css/homepage.css', css, 'utf8');
  console.log('Successfully restored desktop rules and set mobile centering!');
} else {
  console.log('Target block not found');
}

