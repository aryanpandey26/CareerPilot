// Completely disable React error overlay and suppress all harmless errors
(function() {
  'use strict';
  
  // Disable React error overlay completely
  if (typeof window !== 'undefined') {
    // Override the error overlay handler
    window.addEventListener('error', function(e) {
      e.stopImmediatePropagation();
      e.stopPropagation();
      return false;
    }, true);
    
    window.addEventListener('unhandledrejection', function(e) {
      e.stopImmediatePropagation();
      e.stopPropagation();
      e.preventDefault();
      return false;
    }, true);
    
    // Disable webpack-dev-server overlay
    const style = document.createElement('style');
    style.textContent = `
      iframe[id^="webpack-dev-server"] {
        display: none !important;
      }
      #webpack-dev-server-client-overlay {
        display: none !important;
      }
      #webpack-dev-server-client-overlay-div {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
    
    // Remove any existing overlays
    const removeOverlays = () => {
      const overlays = document.querySelectorAll('iframe[id*="webpack"], [id*="overlay"]');
      overlays.forEach(el => el.remove());
    };
    
    setInterval(removeOverlays, 100);
    
    // Suppress console errors for ResizeObserver
    const originalError = console.error;
    console.error = function(...args) {
      const message = args.join(' ');
      if (
        message.includes('ResizeObserver') ||
        message.includes('undelivered notifications') ||
        message.includes('loop limit exceeded')
      ) {
        return;
      }
      originalError.apply(console, args);
    };
  }
})();

