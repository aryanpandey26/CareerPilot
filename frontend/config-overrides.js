const { override } = require('customize-cra');

module.exports = override(
  (config) => {
    // Disable webpack dev server overlay
    if (config.devServer) {
      config.devServer.client = {
        overlay: false,
      };
    }
    
    // Ignore ResizeObserver errors in webpack
    config.ignoreWarnings = [
      /ResizeObserver/,
      /undelivered notifications/,
    ];
    
    return config;
  }
);
