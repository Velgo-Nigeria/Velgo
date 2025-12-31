import React, { Component, ReactNode, ErrorInfo } from 'react';
import { ShieldIcon } from './Brand';

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

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-white dark:bg-gray-900 p-6 text-center">
          <ShieldIcon className="h-16 w-auto mb-6 opacity-20 dark:opacity-10" />
          <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Something went wrong.</h1>
          <p className="text-gray-500 text-sm mb-8 max-w-xs mx-auto leading-relaxed">
            We encountered an unexpected error. Please try reloading the app.
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-gray-900 dark:bg-white dark:text-gray-900 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-transform"
          >
            Reload Velgo
          </button>
          
          <div className="mt-8 text-[10px] text-gray-400 font-mono">
             Error Code: {this.state.error?.message?.slice(0, 30) || 'Unknown'}
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}