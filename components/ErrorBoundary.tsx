import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = this.state.error?.message || 'An unexpected error occurred.';
      let isFirestoreError = false;
      
      try {
        const parsed = JSON.parse(errorMessage);
        if (parsed.error && parsed.operationType) {
          isFirestoreError = true;
          errorMessage = `Firestore Error (${parsed.operationType} on ${parsed.path}): ${parsed.error}`;
        }
      } catch (e) {
        // Not a JSON string, ignore
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-200 p-4">
          <div className="bg-gray-900 border border-red-900/50 p-6 rounded-lg max-w-2xl w-full shadow-xl">
            <h2 className="text-xl font-semibold text-red-400 mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
              Application Error
            </h2>
            <div className="bg-black/50 p-4 rounded text-sm font-mono text-red-300 overflow-auto max-h-96 whitespace-pre-wrap break-words">
              {errorMessage}
            </div>
            <button
              className="mt-6 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded transition-colors"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
