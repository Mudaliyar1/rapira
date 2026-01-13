# Loading Spinner Documentation

## Overview

The Loading Spinner System is a real-time loader that automatically shows loading animations when users click on redirect buttons throughout the website. The system is automatically initialized on all pages and requires minimal configuration.

## Features

✅ **Automatic Detection** - Automatically detects and handles all redirect buttons
✅ **Real-time Feedback** - Shows loading spinner immediately on button clicks
✅ **Multiple Spinner Styles** - Rotating spinner, dots, pulse effects
✅ **AJAX Support** - Monitors AJAX requests and fetch calls
✅ **Mobile Responsive** - Works seamlessly on all device sizes
✅ **Accessibility** - Respects prefers-reduced-motion settings
✅ **Custom Messages** - Support for custom loading text
✅ **Debounce Protection** - Prevents accidental double-clicks

## How It Works

The system automatically intercepts:
1. **Link clicks** - `<a>` tags that navigate to different pages
2. **Button clicks** - Buttons with navigation functionality
3. **Form submissions** - Forms that redirect users
4. **AJAX requests** - Background data loading
5. **Browser navigation** - Back/forward button presses

## Usage

### Basic Usage (No Configuration Needed)

The system works automatically! Simply add the CSS and JS files to your layout (already done in main.ejs and admin.ejs):

```html
<!-- In <head> -->
<link rel="stylesheet" href="/css/loading-spinner.css">

<!-- Before </body> -->
<script src="/js/loading-spinner.js"></script>
```

### Standard Buttons

All standard buttons will automatically show the loader:

```html
<!-- Navigation link -->
<a href="/artists" class="btn btn-primary">View Artists</a>

<!-- Button with onclick -->
<button onclick="window.location='/concerts'" class="btn btn-primary">View Concerts</button>

<!-- Form submission -->
<form action="/search" method="GET" class="form">
  <button type="submit" class="btn btn-primary">Search</button>
</form>
```

### Custom Loading Text

Specify custom text for specific buttons:

```html
<a href="/profile" class="btn btn-primary" data-loader-text="Loading Profile">Go to Profile</a>
```

The loader will show: "Loading Profile..."

### Disable Loader for Specific Elements

If you want to prevent the loader from showing for certain buttons:

```html
<!-- External links that open in new tab (auto-skipped) -->
<a href="https://example.com" target="_blank" class="btn btn-primary">External Link</a>

<!-- Email/Phone links (auto-skipped) -->
<a href="mailto:info@example.com" class="btn btn-primary">Email Us</a>

<!-- Prevent loader on specific button -->
<a href="/page" class="btn btn-primary" data-no-loader="true">Skip Loader</a>
```

## JavaScript API

You can control the loader programmatically:

### Show Loader

```javascript
// Show with default text
window.loaderManager.show();

// Show with custom text
window.loaderManager.show('Loading your profile...');
```

### Hide Loader

```javascript
window.loaderManager.hide();
```

### Check if Loading

```javascript
if (window.loaderManager.isLoadingNow()) {
  console.log('Currently loading');
}
```

### Set Custom Text

```javascript
window.loaderManager.setText('Processing your request...');
```

### Toggle Loader

```javascript
window.loaderManager.toggle('Loading...');
```

### Adjust Debounce Time

```javascript
// Set debounce time to 500ms (default is 300ms)
window.loaderManager.setDebounceTime(500);
```

## Spinner Styles

The system includes multiple spinner variations:

### Default Rotating Spinner
- Smooth rotating circle with gradient colors
- Used by default in the overlay

### Dots Spinner
- Three animated dots that bounce
- Alternative visual style

### Pulse Spinner
- Pulsing circle that grows and shrinks
- Can be used as variant

### Progress Bar
```javascript
window.loaderManager.showProgressBar();
setTimeout(() => {
  window.loaderManager.hideProgressBar();
}, 2000);
```

## Color Variations

Customize spinner colors by adding classes:

```html
<!-- Primary color spinner -->
<div class="spinner spinner-primary"></div>

<!-- Success color spinner -->
<div class="spinner spinner-success"></div>

<!-- Danger color spinner -->
<div class="spinner spinner-danger"></div>

<!-- Warning color spinner -->
<div class="spinner spinner-warning"></div>

<!-- Info color spinner -->
<div class="spinner spinner-info"></div>

<!-- Custom gradient (default) -->
<div class="spinner spinner-custom"></div>
```

## Examples

### Example 1: Simple Navigation

```html
<a href="/concerts" class="btn btn-gradient-purple btn-lg">Explore Concerts</a>
<!-- Loader automatically shows with text "Explore Concerts..." -->
```

### Example 2: Artist Discovery

```html
<a href="/artists" class="btn btn-primary" data-loader-text="Finding Artists">
  Discover Artists
</a>
<!-- Loader shows: "Finding Artists..." -->
```

### Example 3: Custom Button Handler

```html
<button class="btn btn-primary" onclick="navigateToVenues()">
  View Venues
</button>

<script>
function navigateToVenues() {
  window.loaderManager.show('Loading venues...');
  setTimeout(() => {
    window.location = '/venues';
  }, 500);
}
</script>
```

### Example 4: AJAX Request with Loader

```javascript
// Fetch API (loader auto-shows for non-GET requests)
fetch('/api/user-data', {
  method: 'POST',
  body: JSON.stringify({ id: 123 })
})
.then(res => res.json())
.then(data => {
  window.loaderManager.hide();
  console.log(data);
});
```

### Example 5: Manual Loader Control

```javascript
// Start a long operation
window.loaderManager.show('Processing payment...');

// Simulate work
setTimeout(() => {
  window.loaderManager.hide();
  alert('Payment processed!');
}, 3000);
```

## Accessibility

The loader respects browser accessibility settings:

- **Prefers Reduced Motion**: If user has reduced motion enabled, animations are simplified
- **Focus Management**: Loader doesn't interfere with keyboard navigation
- **Screen Readers**: Overlay doesn't block screen reader access

## Mobile Optimization

- Spinner size adjusts on smaller screens
- Touch-friendly interaction
- Performance optimized for mobile devices
- Works with mobile browser back/forward buttons

## CSS Customization

You can override spinner colors in your CSS:

```css
/* Custom spinner color */
.spinner {
  border-top-color: #your-color;
}

/* Custom overlay background */
.loading-overlay {
  background: rgba(0, 0, 0, 0.5); /* Adjust opacity */
}

/* Custom spinner size */
.spinner {
  width: 80px;
  height: 80px;
}

/* Custom text color */
.loading-text {
  color: #your-color;
}
```

## Performance Considerations

- Loader is lightweight (~15KB minified)
- No external dependencies required
- Minimal DOM manipulation
- Efficient event delegation
- Automatic cleanup on navigation

## Browser Support

- Chrome/Edge (Latest)
- Firefox (Latest)
- Safari (Latest)
- Mobile browsers (iOS Safari, Chrome Mobile)
- IE 11+ (with polyfills)

## Troubleshooting

### Loader not showing on button click

1. Check that loading-spinner.js is loaded before page content
2. Ensure button has proper href or onclick attribute
3. Check browser console for errors
4. Verify button doesn't have `data-no-loader="true"`

### Loader stuck on screen

```javascript
// Manually hide the loader
window.loaderManager.hide();
```

### Custom text not showing

```html
<!-- Correct syntax -->
<a href="/page" data-loader-text="Custom Text">Link</a>

<!-- Make sure text is in data attribute -->
```

### Performance issues

- Check that debounce time is set appropriately
- Disable loader for high-frequency buttons: `data-no-loader="true"`
- Monitor console for AJAX request loops

## Advanced Configuration

### Custom Loader Initialization

```javascript
// If you need to customize before initialization
window.addEventListener('DOMContentLoaded', function() {
  // Create custom manager instance
  const customLoader = new LoadingSpinnerManager();
  customLoader.setDebounceTime(500);
  customLoader.show('Custom Loader');
});
```

### Custom Spinner HTML

To customize the spinner HTML, edit the `createLoadingOverlay()` method in loading-spinner.js:

```javascript
createLoadingOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'loading-overlay';
  overlay.className = 'loading-overlay';
  // Customize HTML here
  overlay.innerHTML = `your custom HTML`;
  document.body.appendChild(overlay);
}
```

## Support

For issues or questions:
1. Check browser console (F12) for errors
2. Verify CSS and JS files are loaded (Network tab)
3. Check that loading-spinner.js loads after DOM
4. Ensure Bootstrap is loaded before loading-spinner.js

## Version History

- **v1.0.0** - Initial release
  - Automatic redirect detection
  - Multiple spinner styles
  - AJAX support
  - Mobile responsive
  - Accessibility features

## License

Part of the Rapira project - All rights reserved
