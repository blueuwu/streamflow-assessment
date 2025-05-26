import { 
  StreamFlowError, 
  createStreamFlowError, 
  ErrorCode, 
  withRetry,
  type ErrorContext 
} from '@/types/errors';

/**
 * Error logging levels
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Error logger interface
 */
export interface ErrorLogger {
  log(level: LogLevel, message: string, context?: ErrorContext): void;
  error(error: StreamFlowError): void;
}

/**
 * Console-based error logger implementation
 */
class ConsoleErrorLogger implements ErrorLogger {
  log(level: LogLevel, message: string, context?: ErrorContext): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(logMessage, context);
        break;
      case LogLevel.INFO:
        console.info(logMessage, context);
        break;
      case LogLevel.WARN:
        console.warn(logMessage, context);
        break;
      case LogLevel.ERROR:
        console.error(logMessage, context);
        break;
    }
  }

  error(error: StreamFlowError): void {
    const errorData = error.toJSON();
    console.error(`[${errorData.timestamp}] [ERROR] ${error.getUserMessage()}`, {
      code: error.code,
      message: error.message,
      context: error.context,
      retryable: error.retryable,
      stack: error.stack,
    });
  }
}

/**
 * Global error logger instance
 */
export const errorLogger: ErrorLogger = new ConsoleErrorLogger();

/**
 * Error boundary context for React components
 */
export interface ErrorBoundaryState {
  hasError: boolean;
  error: StreamFlowError | null;
  errorId: string | null;
}

/**
 * Creates a unique error ID for tracking
 */
export function createErrorId(): string {
  return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Handles errors in async operations with proper logging and user-friendly messages
 */
export async function handleAsyncOperation<T>(
  operation: () => Promise<T>,
  operationName: string,
  context: ErrorContext = {}
): Promise<{ data: T | null; error: StreamFlowError | null }> {
  try {
    errorLogger.log(LogLevel.DEBUG, `Starting operation: ${operationName}`, context);
    
    const data = await operation();
    
    errorLogger.log(LogLevel.DEBUG, `Completed operation: ${operationName}`, context);
    return { data, error: null };
  } catch (error) {
    const streamFlowError = createStreamFlowError(error, {
      ...context,
      operation: operationName,
      errorId: createErrorId(),
    });

    errorLogger.error(streamFlowError);
    return { data: null, error: streamFlowError };
  }
}

/**
 * Handles errors in async operations with retry logic
 */
export async function handleAsyncOperationWithRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  context: ErrorContext = {},
  retryConfig?: Parameters<typeof withRetry>[1]
): Promise<{ data: T | null; error: StreamFlowError | null }> {
  try {
    errorLogger.log(LogLevel.DEBUG, `Starting operation with retry: ${operationName}`, context);
    
    const data = await withRetry(operation, retryConfig);
    
    errorLogger.log(LogLevel.DEBUG, `Completed operation with retry: ${operationName}`, context);
    return { data, error: null };
  } catch (error) {
    const streamFlowError = error instanceof StreamFlowError 
      ? error 
      : createStreamFlowError(error, {
          ...context,
          operation: operationName,
          errorId: createErrorId(),
        });

    errorLogger.error(streamFlowError);
    return { data: null, error: streamFlowError };
  }
}

/**
 * Error handler for React Query operations
 */
export function createQueryErrorHandler(queryName: string) {
  return (error: unknown): StreamFlowError => {
    const streamFlowError = createStreamFlowError(error, {
      query: queryName,
      errorId: createErrorId(),
    });

    errorLogger.error(streamFlowError);
    return streamFlowError;
  };
}

/**
 * Creates a standardized error response for API-like operations
 */
export interface OperationResult<T> {
  success: boolean;
  data?: T;
  error?: StreamFlowError;
  errorMessage?: string;
}

export function createSuccessResult<T>(data: T): OperationResult<T> {
  return {
    success: true,
    data,
  };
}

export function createErrorResult<T>(error: StreamFlowError): OperationResult<T> {
  return {
    success: false,
    error,
    errorMessage: error.getUserMessage(),
  };
}

/**
 * Safe wrapper for operations that might throw
 */
export function safeOperation<T>(
  operation: () => T,
  operationName: string,
  context: ErrorContext = {}
): OperationResult<T> {
  try {
    const data = operation();
    return createSuccessResult(data);
  } catch (error) {
    const streamFlowError = createStreamFlowError(error, {
      ...context,
      operation: operationName,
      errorId: createErrorId(),
    });

    errorLogger.error(streamFlowError);
    return createErrorResult(streamFlowError);
  }
}

/**
 * Error boundary helper for component-level error handling
 */
export function handleComponentError(
  error: Error,
  errorInfo: { componentStack: string },
  componentName: string
): StreamFlowError {
  const streamFlowError = createStreamFlowError(error, {
    component: componentName,
    componentStack: errorInfo.componentStack,
    errorId: createErrorId(),
  });

  errorLogger.error(streamFlowError);
  return streamFlowError;
}

/**
 * Validation helper with error handling
 */
export function validateRequired<T>(
  value: T | null | undefined,
  fieldName: string,
  context: ErrorContext = {}
): T {
  if (value === null || value === undefined) {
    throw new StreamFlowError(
      ErrorCode.MISSING_REQUIRED_FIELD,
      `Required field '${fieldName}' is missing`,
      { ...context, fieldName }
    );
  }
  return value;
}

/**
 * Safe JSON parsing with error handling
 */
export function safeJsonParse<T = unknown>(
  jsonString: string,
  context: ErrorContext = {}
): OperationResult<T> {
  try {
    const data = JSON.parse(jsonString) as T;
    return createSuccessResult(data);
  } catch (error) {
    const streamFlowError = createStreamFlowError(error, {
      ...context,
      jsonString: jsonString.substring(0, 100), // Log first 100 chars for debugging
    });
    return createErrorResult(streamFlowError);
  }
}

/**
 * Debounced error handler for frequent operations
 */
export function createDebouncedErrorHandler(delay: number = 1000) {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastError: StreamFlowError | null = null;

  return (error: StreamFlowError) => {
    lastError = error;
    
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      if (lastError) {
        errorLogger.error(lastError);
        lastError = null;
      }
      timeoutId = null;
    }, delay);
  };
}