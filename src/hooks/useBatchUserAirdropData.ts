import { useQuery } from "@tanstack/react-query";
import { getBatchUserAirdropLeafData, BatchUserAirdropData } from "@/lib/streamflow";
import { createQueryErrorHandler } from "@/lib/error-handler";
import { StreamFlowError, ErrorCode } from "@/types/errors";

/**
 * React Query hook to batch fetch user airdrop leaf data for multiple airdrops with enhanced error handling.
 * This solves the N+1 query problem by fetching all user data in parallel.
 * @param airdropPublicKeys Array of airdrop public keys to fetch data for
 * @param userWalletPublicKey User's wallet public key (as string)
 * @param enabled Whether the query should run (typically when wallet is connected)
 */
export const useBatchUserAirdropData = (
  airdropPublicKeys: string[],
  userWalletPublicKey: string | null,
  enabled: boolean = true
) => {
  return useQuery<BatchUserAirdropData, StreamFlowError>({
    queryKey: ["batchUserAirdropData", airdropPublicKeys, userWalletPublicKey],
    queryFn: async () => {
      if (!userWalletPublicKey) {
        throw new StreamFlowError(
          ErrorCode.WALLET_NOT_CONNECTED,
          "User wallet public key is required for fetching airdrop data",
          { airdropCount: airdropPublicKeys.length }
        );
      }

      if (!Array.isArray(airdropPublicKeys) || airdropPublicKeys.length === 0) {
        // Return empty result for empty arrays rather than throwing
        return {};
      }

      try {
        return await getBatchUserAirdropLeafData(airdropPublicKeys, userWalletPublicKey);
      } catch (error) {
        // Transform error using our error handler
        const errorHandler = createQueryErrorHandler('batchUserAirdropData');
        throw errorHandler(error);
      }
    },
    enabled: enabled && !!userWalletPublicKey && airdropPublicKeys.length > 0,
    // Enhanced error handling and retry configuration
    retry: (failureCount, error) => {
      if (error instanceof StreamFlowError) {
        // Don't retry wallet errors or validation errors
        if (error.code === ErrorCode.WALLET_NOT_CONNECTED || 
            error.code === ErrorCode.INVALID_PUBLIC_KEY ||
            !error.retryable) {
          return false;
        }
        // Limit retries for retryable errors
        return failureCount < 1; // Less aggressive retry for batch operations
      }
      return failureCount < 1;
    },
    retryDelay: (attemptIndex) => Math.min(2000 * 2 ** attemptIndex, 15000),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    // For batch operations, we prefer partial data over complete failure
    throwOnError: false,
    // Reset query when wallet changes
    refetchOnReconnect: true,
  });
};

/**
 * Enhanced hook with additional error state information and utilities
 */
export const useBatchUserAirdropDataWithErrorStates = (
  airdropPublicKeys: string[],
  userWalletPublicKey: string | null,
  enabled: boolean = true
) => {
  const query = useBatchUserAirdropData(airdropPublicKeys, userWalletPublicKey, enabled);

  // Calculate success/failure statistics
  const stats = query.data ? (() => {
    const entries = Object.entries(query.data);
    const successful = entries.filter(([, value]) => value !== null).length;
    const failed = entries.length - successful;
    const successRate = entries.length > 0 ? (successful / entries.length) * 100 : 0;
    
    return {
      total: entries.length,
      successful,
      failed,
      successRate: Math.round(successRate),
    };
  })() : null;

  return {
    ...query,
    // Enhanced error state information
    isWalletError: query.error?.code === ErrorCode.WALLET_NOT_CONNECTED,
    isNetworkError: query.error?.code === ErrorCode.NETWORK_ERROR,
    isValidationError: query.error?.code === ErrorCode.INVALID_PUBLIC_KEY,
    isRetryableError: query.error?.retryable ?? false,
    errorMessage: query.error?.getUserMessage() || null,
    canRetry: query.error?.retryable && !query.isFetching && !!userWalletPublicKey,
    
    // Data statistics
    stats,
    hasPartialData: !!query.data && Object.keys(query.data).length > 0,
    isEmpty: !!query.data && Object.keys(query.data).length === 0,
    
    // Utility functions
    retryOperation: () => {
      if (query.error?.retryable && userWalletPublicKey) {
        query.refetch();
      }
    },
    getUserDataForAirdrop: (airdropPublicKey: string) => {
      return query.data?.[airdropPublicKey] || null;
    },
    getAirdropsWithUserData: () => {
      if (!query.data) return [];
      return Object.entries(query.data)
        .filter(([, userData]) => userData !== null)
        .map(([airdropPublicKey]) => airdropPublicKey);
    },
    getFailedAirdrops: () => {
      if (!query.data) return airdropPublicKeys;
      return airdropPublicKeys.filter(key => query.data![key] === null);
    },
  };
};

/**
 * Hook specifically for checking if user has any claimable airdrops
 */
export const useHasClaimableAirdrops = (
  airdropPublicKeys: string[],
  userWalletPublicKey: string | null,
  enabled: boolean = true
) => {
  const { data, isLoading, error } = useBatchUserAirdropData(
    airdropPublicKeys, 
    userWalletPublicKey, 
    enabled
  );

  const claimableCount = data ? Object.values(data).filter(
    userData => userData && !userData.isClaimed && userData.totalAllocation.gtn(0)
  ).length : 0;

  return {
    hasClaimableAirdrops: claimableCount > 0,
    claimableCount,
    totalAirdrops: airdropPublicKeys.length,
    isLoading,
    error,
  };
};