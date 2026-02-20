import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Comprehensive error suppression for harmless runtime errors
const suppressedErrors = [
  'ResizeObserver loop completed with undelivered notifications',
  'ResizeObserver loop limit exceeded',
  'Script error',
  'Non-Error promise rejection captured',
];

// Suppress window errors
const errorHandler = (event) => {
  const message = event.message || event.reason?.message || '';
  
  // Check if error should be suppressed
  if (suppressedErrors.some(err => message.includes(err))) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return true;
  }
  
  // Also suppress ResizeObserver errors from error event
  if (event.error?.constructor?.name === 'ResizeObserver') {
    event.preventDefault();
    event.stopImmediatePropagation();
    return true;
  }
};

// Handle regular errors
window.addEventListener('error', errorHandler, true);

// Handle promise rejections
window.addEventListener('unhandledrejection', (event) => {
  const message = event.reason?.message || String(event.reason) || '';
  
  if (suppressedErrors.some(err => message.includes(err))) {
    event.preventDefault();
    return;
  }
});

// Override console.error to filter out ResizeObserver errors in development
const originalConsoleError = console.error;
console.error = (...args) => {
  const message = args.join(' ');
  if (suppressedErrors.some(err => message.includes(err))) {
    return; // Suppress the error
  }
  originalConsoleError.apply(console, args);
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
