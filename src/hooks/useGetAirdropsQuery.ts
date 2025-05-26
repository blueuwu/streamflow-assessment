import { useQuery } from "@tanstack/react-query";
import { getAirdrops, AirdropInfo } from "@/lib/streamflow";
import { createQueryErrorHandler } from "@/lib/error-handler";
import { StreamFlowError } from "@/types/errors";

// Define a query key for caching and refetching
const AIRDROPS_QUERY_KEY = "airdrops";

/**
 * React Query hook to fetch airdrop information with enhanced error handling.
 * @param mint Optional. The token mint address to filter by.
 * @param admin Optional. The admin/creator address to filter by.
 * @param limit Optional. The maximum number of airdrops to fetch.
 */
export const useGetAirdropsQuery = (
  mint?: string, 
  admin?: string, 
  limit: number = 25
) => {
  return useQuery<AirdropInfo[], StreamFlowError>({
    queryKey: [AIRDROPS_QUERY_KEY, { mint, admin, limit }],
    queryFn: async () => {
      try {
        return await getAirdrops(mint, admin, limit);
      } catch (error) {
        // Transform error using our error handler
        const errorHandler = createQueryErrorHandler('getAirdrops');
        throw errorHandler(error);
      }
    },
    // Enhanced error handling and retry configuration
    retry: (failureCount, error) => {
      // Don't retry for certain types of errors
      if (error instanceof StreamFlowError) {
        // Don't retry validation errors or permanent failures
        if (!error.retryable) {
          return false;
        }
        // Limit retries for retryable errors
        return failureCount < 2;
      }
      // Default retry behavior for unknown errors
      return failureCount < 1;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    refetchOnWindowFocus: false, // Prevent excessive refetching
    refetchOnMount: true,
    // Enhanced error boundary integration
    throwOnError: false, // Let the component handle errors gracefully
  });
};

/**
 * Hook to get airdrops with specific error states
 */
export const useGetAirdropsWithErrorStates = (
  mint?: string, 
  admin?: string, 
  limit: number = 25
) => {
  const query = useGetAirdropsQuery(mint, admin, limit);

  return {
    ...query,
    // Enhanced error state information
    isNetworkError: query.error?.code === 'NETWORK_ERROR',
    isValidationError: query.error?.code === 'INVALID_DATA_FORMAT',
    isRetryableError: query.error?.retryable ?? false,
    errorMessage: query.error?.getUserMessage() || null,
    canRetry: query.error?.retryable && !query.isFetching,
    // Utility function to manually retry
    retryOperation: () => {
      if (query.error?.retryable) {
        query.refetch();
      }
    },
  };
};