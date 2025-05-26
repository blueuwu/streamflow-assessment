"use client";


import { AirdropsGrid } from "@/components/airdrops-grid"
import { SearchAirdrop } from "@/components/search-airdrop"
import { useGetAirdropsWithErrorStates } from "@/hooks/useGetAirdropsQuery";
import { AirdropInfo } from "@/lib/streamflow";
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/error-boundary";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, RefreshCw, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";

const LATEST_AIRDROPS_LIMIT = 9;

interface SortOption {
  label: string;
  value: keyof AirdropInfo;
  direction: 'asc' | 'desc';
}

const sortOptions: SortOption[] = [
  { label: 'Newest', value: 'version', direction: 'desc' },
];

function isValidVersion(version: number): boolean {
  // Validate that version is a valid timestamp (10 digits)
  return !isNaN(version) && String(version).length === 10;
}

function ErrorDisplay({ 
  error, 
  isNetworkError, 
  isRetryableError, 
  canRetry, 
  onRetry 
}: {
  error: string;
  isNetworkError: boolean;
  isRetryableError: boolean;
  canRetry: boolean;
  onRetry: () => void;
}) {
  const getErrorIcon = () => {
    if (isNetworkError) return <Wifi className="h-5 w-5" />;
    return <AlertTriangle className="h-5 w-5" />;
  };

  const getErrorColor = () => {
    if (isNetworkError) return "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800";
    return "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800";
  };

  const getTextColor = () => {
    if (isNetworkError) return "text-yellow-800 dark:text-yellow-200";
    return "text-red-800 dark:text-red-200";
  };

  return (
    <Alert className={`${getErrorColor()} border`}>
      <div className="flex items-start gap-3">
        <div className={getTextColor()}>
          {getErrorIcon()}
        </div>
        <div className="flex-1">
          <AlertDescription className={`${getTextColor()} font-medium`}>
            {isNetworkError ? 'Connection Problem' : 'Error Loading Airdrops'}
          </AlertDescription>
          <AlertDescription className={`${getTextColor()} mt-1`}>
            {error}
          </AlertDescription>
          {isRetryableError && canRetry && (
            <Button
              onClick={onRetry}
              variant="outline"
              size="sm"
              className="mt-3"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          )}
        </div>
      </div>
    </Alert>
  );
}

function HomeContent() {
  const { 
    data: allAirdrops, 
    isLoading, 
    error: queryError,
    isNetworkError,
    isRetryableError,
    errorMessage,
    canRetry,
    retryOperation
  } = useGetAirdropsWithErrorStates();

  const latestAirdrops = useMemo(() => {
    if (!allAirdrops) return [];

    return allAirdrops
      .filter(airdrop => isValidVersion(airdrop.version))
      .sort((a, b) => b.version - a.version)
      .slice(0, LATEST_AIRDROPS_LIMIT);
  }, [allAirdrops]);

  return (
    <div className="bg-gradient-to-b from-blue-50 to-white dark:from-blue-950 dark:to-gray-900">
      <main className="container py-8 lg:py-12">
        <div className="flex flex-col gap-8 lg:gap-12">
          <section className="space-y-6 lg:space-y-8">
            <div className="flex flex-col gap-3 text-center max-w-4xl mx-auto">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                Claim Your Airdrops
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-lg lg:text-xl">
                Connect your wallet to view and claim available airdrops
              </p>
            </div>
            <SearchAirdrop />
          </section>
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight lg:text-3xl">
                Latest Airdrops
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Sort by:
                </span>
                <select 
                  className="rounded-md border border-gray-200 bg-white px-3 py-1 text-sm dark:border-gray-800 dark:bg-gray-900"
                  aria-label="Sort airdrops"
                >
                  {sortOptions.map(option => (
                    <option key={option.value} value={`${option.value}-${option.direction}`}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: LATEST_AIRDROPS_LIMIT }).map((_, i) => (
                  <Skeleton key={i} className="h-48 rounded-lg" />
                ))}
              </div>
            ) : queryError ? (
              <ErrorDisplay
                error={errorMessage || 'An unexpected error occurred'}
                isNetworkError={isNetworkError}
                isRetryableError={isRetryableError}
                canRetry={canRetry || false}
                onRetry={retryOperation}
              />
            ) : (
              <AirdropsGrid airdrops={latestAirdrops} />
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <ErrorBoundary>
      <HomeContent />
    </ErrorBoundary>
  );
}
