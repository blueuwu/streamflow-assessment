"use client";

import React, { Component, ReactNode } from 'react';
import { StreamFlowError, createStreamFlowError } from '@/types/errors';
import { handleComponentError, createErrorId } from '@/lib/error-handler';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: StreamFlowError, retry: () => void) => ReactNode;
  onError?: (error: StreamFlowError) => void;
  showDetails?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: StreamFlowError | null;
  errorId: string | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    const streamFlowError = createStreamFlowError(error);
    return {
      hasError: true,
      error: streamFlowError,
      errorId: createErrorId(),
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const streamFlowError = handleComponentError(error, {
      componentStack: errorInfo.componentStack || 'No stack available'
    }, 'ErrorBoundary');
    
    // Call the onError prop if provided
    if (this.props.onError) {
      this.props.onError(streamFlowError);
    }

    // Update state with the processed error
    this.setState({
      hasError: true,
      error: streamFlowError,
      errorId: streamFlowError.context.errorId as string,
    });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorId: null,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }

      // Default error UI
      return (
        <DefaultErrorFallback
          error={this.state.error}
          onRetry={this.handleRetry}
          showDetails={this.props.showDetails}
        />
      );
    }

    return this.props.children;
  }
}

interface DefaultErrorFallbackProps {
  error: StreamFlowError;
  onRetry: () => void;
  showDetails?: boolean;
}

function DefaultErrorFallback({ error, onRetry, showDetails = false }: DefaultErrorFallbackProps) {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-xl">Something went wrong</CardTitle>
          <CardDescription>
            {error.getUserMessage()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            {error.retryable && (
              <Button
                onClick={onRetry}
                variant="default"
                className="flex-1"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            )}
            <Button
              asChild
              variant="outline"
              className="flex-1"
            >
              <Link href="/">
                <Home className="mr-2 h-4 w-4" />
                Go Home
              </Link>
            </Button>
          </div>
          
          {showDetails && (
            <Alert>
              <AlertDescription className="text-sm">
                <details>
                  <summary className="cursor-pointer font-medium">
                    Technical Details
                  </summary>
                  <div className="mt-2 space-y-1 text-xs">
                    <p><strong>Error Code:</strong> {error.code}</p>
                    <p><strong>Timestamp:</strong> {error.timestamp.toLocaleString()}</p>
                    {typeof error.context.errorId === 'string' && (
                      <p><strong>Error ID:</strong> {String(error.context.errorId)}</p>
                    )}
                    <p><strong>Message:</strong> {error.message}</p>
                  </div>
                </details>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Hook-based error boundary for functional components
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<StreamFlowError | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const handleError = React.useCallback((error: unknown) => {
    const streamFlowError = createStreamFlowError(error, {
      errorId: createErrorId(),
      handledBy: 'useErrorHandler',
    });
    setError(streamFlowError);
  }, []);

  return {
    error,
    hasError: !!error,
    resetError,
    handleError,
  };
}

/**
 * Higher-order component for adding error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
}