/**
 * Custom error types for the StreamFlow application
 * Provides specific error classes for different types of failures
 */

export enum ErrorCode {
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  RPC_ERROR = 'RPC_ERROR',
  
  // API errors
  INVALID_PUBLIC_KEY = 'INVALID_PUBLIC_KEY',
  ACCOUNT_NOT_FOUND = 'ACCOUNT_NOT_FOUND',
  INVALID_ACCOUNT_DATA = 'INVALID_ACCOUNT_DATA',
  DISTRIBUTOR_NOT_FOUND = 'DISTRIBUTOR_NOT_FOUND',
  
  // User/Wallet errors
  WALLET_NOT_CONNECTED = 'WALLET_NOT_CONNECTED',
  WALLET_DISCONNECTED = 'WALLET_DISCONNECTED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  
  // Data validation errors
  INVALID_DATA_FORMAT = 'INVALID_DATA_FORMAT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  TYPE_VALIDATION_ERROR = 'TYPE_VALIDATION_ERROR',
// Transaction errors
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  TRANSACTION_TIMEOUT = 'TRANSACTION_TIMEOUT',
  
  // Application errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
}

export interface ErrorContext {
  [key: string]: unknown;
}

/**
 * Base error class for all StreamFlow application errors
 */
export class StreamFlowError extends Error {
  public readonly code: ErrorCode;
  public readonly context: ErrorContext;
  public readonly timestamp: Date;
  public readonly retryable: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    context: ErrorContext = {},
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'StreamFlowError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date();
    this.retryable = retryable;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, StreamFlowError);
    }
  }

  /**
   * Creates a user-friendly error message
   */
  public getUserMessage(): string {
    switch (this.code) {
      case ErrorCode.NETWORK_ERROR:
        return 'Network connection failed. Please check your internet connection and try again.';
      case ErrorCode.CONNECTION_TIMEOUT:
        return 'Request timed out. Please try again.';
      case ErrorCode.RPC_ERROR:
        return 'Blockchain connection failed. Please try again later.';
      case ErrorCode.ACCOUNT_NOT_FOUND:
        return 'The requested account could not be found.';
      case ErrorCode.DISTRIBUTOR_NOT_FOUND:
        return 'The airdrop campaign could not be found.';
      case ErrorCode.INVALID_PUBLIC_KEY:
        return 'Invalid address format provided.';
      case ErrorCode.WALLET_NOT_CONNECTED:
        return 'Please connect your wallet to continue.';
      case ErrorCode.WALLET_DISCONNECTED:
        return 'Wallet was disconnected. Please reconnect to continue.';
      case ErrorCode.TRANSACTION_FAILED:
        return 'Transaction failed. Please try again.';
      case ErrorCode.TRANSACTION_TIMEOUT:
        return 'Transaction timed out. Please try again.';
      case ErrorCode.INVALID_DATA_FORMAT:
        return 'The received data format is invalid.';
      case ErrorCode.UNAUTHORIZED:
        return 'You are not authorized to perform this action.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  /**
   * Converts error to JSON for logging
   */
  public toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      retryable: this.retryable,
      stack: this.stack,
    };
  }
}

/**
 * Network-related errors
 */
export class NetworkError extends StreamFlowError {
  constructor(message: string, context: ErrorContext = {}) {
    super(ErrorCode.NETWORK_ERROR, message, context, true);
    this.name = 'NetworkError';
  }
}

/**
 * RPC/Blockchain-related errors
 */
export class RpcError extends StreamFlowError {
  constructor(message: string, context: ErrorContext = {}) {
    super(ErrorCode.RPC_ERROR, message, context, true);
    this.name = 'RpcError';
  }
}

/**
 * Wallet-related errors
 */
export class WalletError extends StreamFlowError {
  constructor(code: ErrorCode, message: string, context: ErrorContext = {}) {
    super(code, message, context, false);
    this.name = 'WalletError';
  }
}

/**
 * Data validation errors
 */
export class ValidationError extends StreamFlowError {
  constructor(message: string, context: ErrorContext = {}) {
    super(ErrorCode.INVALID_DATA_FORMAT, message, context, false);
    this.name = 'ValidationError';
  }
}

/**
 * Account/Distributor not found errors
 */
export class NotFoundError extends StreamFlowError {
  constructor(code: ErrorCode, message: string, context: ErrorContext = {}) {
    super(code, message, context, false);
    this.name = 'NotFoundError';
  }
}

/**
 * Utility function to create appropriate error from unknown error
 */
export function createStreamFlowError(error: unknown, context: ErrorContext = {}): StreamFlowError {
  if (error instanceof StreamFlowError) {
    return error;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Network/Connection errors
    if (message.includes('network') || message.includes('fetch')) {
      return new NetworkError(error.message, { ...context, originalError: error });
    }
    
    if (message.includes('timeout')) {
      return new StreamFlowError(ErrorCode.CONNECTION_TIMEOUT, error.message, context, true);
    }
    
    // Account/Data errors
    if (message.includes('account does not exist') || message.includes('account not found')) {
      return new NotFoundError(ErrorCode.ACCOUNT_NOT_FOUND, error.message, context);
    }
    
    if (message.includes('invalid public key') || message.includes('invalid address')) {
      return new StreamFlowError(ErrorCode.INVALID_PUBLIC_KEY, error.message, context);
    }
    
    if (message.includes('invalid account data')) {
      return new StreamFlowError(ErrorCode.INVALID_ACCOUNT_DATA, error.message, context);
    }
    
    // Default to unknown error
    return new StreamFlowError(
      ErrorCode.UNKNOWN_ERROR,
      error.message,
      { ...context, originalError: error },
      true
    );
  }

  // Non-Error objects
  return new StreamFlowError(
    ErrorCode.UNKNOWN_ERROR,
    typeof error === 'string' ? error : 'An unknown error occurred',
    { ...context, originalError: error },
    true
  );
}

/**
 * Error retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBackoff: boolean;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  exponentialBackoff: true,
};

/**
 * Utility function to implement retry logic with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const { maxRetries, baseDelay, maxDelay, exponentialBackoff } = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  let lastError: StreamFlowError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = createStreamFlowError(error, { attempt, maxRetries });

      // Don't retry if not retryable or this is the last attempt
      if (!lastError.retryable || attempt === maxRetries) {
        throw lastError;
      }

      // Calculate delay
      let delay = baseDelay;
      if (exponentialBackoff) {
        delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}
