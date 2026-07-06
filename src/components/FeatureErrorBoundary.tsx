"use client";

import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface FeatureErrorBoundaryProps {
  children: ReactNode;
  featureName: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class FeatureErrorBoundary extends Component<FeatureErrorBoundaryProps, State> {
  constructor(props: FeatureErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[${this.props.featureName}] Error:`, error, errorInfo);

    // Sentry integration point
    if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
      // Sentry.captureException(error, { extra: { feature: this.props.featureName, ...errorInfo } });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center">
          <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-gray-300 font-medium mb-1">
            {this.props.featureName} encountered an error
          </p>
          <p className="text-xs text-gray-500 mb-3">
            {this.state.error?.message || "Something went wrong"}
          </p>
          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
