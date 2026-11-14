import React from 'react';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';

/**
 * Global React Error Boundary — catches unhandled rendering errors anywhere
 * in the component tree and displays a full-page recovery UI instead of a
 * white screen. Wrap this as close to the root as possible.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Unhandled rendering error:', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-6 text-slate-900">
          <div className="w-full max-w-md text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-rose-100">
              <AlertCircle className="h-7 w-7 text-rose-600" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-600">
              An unexpected error occurred. You can try again or return to the home page.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <pre className="mx-auto mt-4 max-w-full overflow-auto rounded-lg bg-slate-100 p-3 text-left text-xs text-slate-700">
                {this.state.error.message}
              </pre>
            )}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button type="button" onClick={this.handleRetry}
                className="ui-button ui-button-primary inline-flex items-center gap-2">
                <RotateCcw size={16} aria-hidden="true" /> Try again
              </button>
              <a href="/" className="ui-button ui-button-secondary inline-flex items-center gap-2">
                <Home size={16} aria-hidden="true" /> Go home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
