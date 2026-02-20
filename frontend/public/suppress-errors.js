// Suppress React error overlay for harmless errors
(function() {
  'use strict';
  
  // List of errors to suppress
  const suppressedPatterns = [
    /ResizeObserver/i,
    /loop completed with undelivered notifications/i,
    /loop limit exceeded/i,
  ];
  
  // Function to check if error should be suppressed
  const shouldSuppress = (message) => {
    return suppressedPatterns.some(pattern => pattern.test(message));
  };
  
  // Intercept and suppress errors before they reach React's error overlay
  const originalError = window.Error;
  window.Error = function(message) {
    if (shouldSuppress(String(message))) {
      return new originalError(''); // Return empty error
    }
    return new originalError(message);
  };
  
  // Also handle console errors
  const originalConsoleError = console.error;
  console.error = function(...args) {
    const message = args.join(' ');
    if (shouldSuppress(message)) {
      return; // Suppress
    }
    originalConsoleError.apply(console, args);
  };
  
  // Suppress unhandled rejections
  window.addEventListener('unhandledrejection', function(event) {
    const message = String(event.reason?.message || event.reason || '');
    if (shouldSuppress(message)) {
      event.preventDefault();
    }
  });
  
  // Disable React DevTools error overlay for specific errors
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    const originalOnError = window.__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot;
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot = function(...args) {
      try {
        if (originalOnError) {
          originalOnError.apply(this, args);
        }
      } catch (error) {
        if (!shouldSuppress(String(error.message))) {
          throw error;
        }
      }
    };
  }
})();
