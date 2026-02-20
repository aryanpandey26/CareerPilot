import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Filter out ResizeObserver errors
    if (
      error?.message?.includes('ResizeObserver') ||
      error?.message?.includes('undelivered notifications')
    ) {
      return { hasError: false };
    }
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Filter out ResizeObserver errors
    if (
      error?.message?.includes('ResizeObserver') ||
      error?.message?.includes('undelivered notifications')
    ) {
      return;
    }
    
    // Log other errors for debugging
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="text-destructive text-4xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-secondary mb-4">
              Something went wrong
            </h1>
            <p className="text-slate-600 mb-6">
              We encountered an unexpected error. Please refresh the page to continue.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-primary text-white px-6 py-3 rounded-md font-medium hover:bg-primary/90 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
