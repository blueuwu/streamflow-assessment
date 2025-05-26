"use client"

import { useRouter } from "next/navigation";
import { AirdropInfo, UserAirdropLeafData } from "@/lib/streamflow";
import { formatBnWithDecimals, getTokenSymbol, getCalculationDecimals } from "@/lib/format-utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useWallet } from "@solana/wallet-adapter-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useBatchUserAirdropDataWithErrorStates } from "@/hooks/useBatchUserAirdropData";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Wifi, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AirdropsGridProps {
  airdrops: AirdropInfo[];
  isLoading?: boolean;
}

interface AirdropRowProps {
  airdrop: AirdropInfo;
  userLeafData: UserAirdropLeafData | null | undefined;
  isLoadingUserData: boolean;
}

function AirdropRow({ airdrop, userLeafData, isLoadingUserData }: AirdropRowProps) {
  const router = useRouter();

  const handleRowClick = () => {
    router.push(`/airdrop/${airdrop.publicKey}`);
  };

  const tokenSymbol = getTokenSymbol(airdrop.mint);
  const calculationDecimals = getCalculationDecimals(airdrop.decimals, airdrop.mint);
  const displayFormatMaxDecimals = 3;

  return (
    <TableRow
      className="hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors cursor-pointer group"
      onClick={handleRowClick}
    >
      <TableCell className="py-6">
        <div className="font-medium text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 text-lg transition-colors">
          {airdrop.name}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1" title={airdrop.publicKey}>
          ID: {airdrop.publicKey.substring(0, 8)}...
        </p>
      </TableCell>
      <TableCell className="py-6">
        <Badge 
          variant={airdrop.isVested ? "secondary" : "outline"} 
          className={`text-sm px-3 py-1.5 ${airdrop.isVested ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' : ''}`}
        >
          {airdrop.isVested ? "Vested" : "Instant"}
        </Badge>
      </TableCell>
      <TableCell className="text-right py-6 text-base">
        {airdrop.numNodesClaimed.toString()}/{airdrop.maxNumNodes.toString()}
      </TableCell>
      <TableCell className="text-right py-6 text-base">
        {formatBnWithDecimals(airdrop.claimedAmount, calculationDecimals, displayFormatMaxDecimals)} / {formatBnWithDecimals(airdrop.totalAmount, calculationDecimals, displayFormatMaxDecimals)}{` ${tokenSymbol}`}
      </TableCell>
      <TableCell className="text-right py-6 text-base">
        {isLoadingUserData ? (
          <Skeleton className="h-5 w-16 inline-block" />
        ) : userLeafData ? (
          <span className={`${userLeafData.isClaimed ? "text-green-600 dark:text-green-400" : ""} font-medium`}>
            {formatBnWithDecimals(userLeafData.totalAllocation, calculationDecimals, displayFormatMaxDecimals)}{` ${tokenSymbol}`}
            {userLeafData.isClaimed && " (Claimed)"}
          </span>
        ) : (
          <span className="text-gray-500 dark:text-gray-400">N/A</span>
        )}
      </TableCell>
    </TableRow>
  );
}

function UserDataErrorAlert({ 
  error, 
  isWalletError, 
  isNetworkError, 
  canRetry, 
  onRetry 
}: {
  error: string;
  isWalletError: boolean;
  isNetworkError: boolean;
  canRetry: boolean;
  onRetry: () => void;
}) {
  if (isWalletError) {
    return null; // Don't show error for wallet not connected
  }

  const getErrorColor = () => {
    if (isNetworkError) return "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800";
    return "bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800";
  };

  const getTextColor = () => {
    if (isNetworkError) return "text-yellow-800 dark:text-yellow-200";
    return "text-orange-800 dark:text-orange-200";
  };

  const getIcon = () => {
    if (isNetworkError) return <Wifi className="h-4 w-4" />;
    return <AlertTriangle className="h-4 w-4" />;
  };

  return (
    <Alert className={`${getErrorColor()} border mb-4`}>
      <div className="flex items-start gap-2">
        <div className={getTextColor()}>
          {getIcon()}
        </div>
        <div className="flex-1">
          <AlertDescription className={`${getTextColor()} text-sm`}>
            <span className="font-medium">
              {isNetworkError ? 'Connection issue' : 'Error loading user data'}:
            </span>{' '}
            {error}
            {canRetry && (
              <Button
                onClick={onRetry}
                variant="outline"
                size="sm"
                className="ml-2"
              >
                <RefreshCw className="mr-1 h-3 w-3" />
                Retry
              </Button>
            )}
          </AlertDescription>
        </div>
      </div>
    </Alert>
  );
}

export function AirdropsGrid({ airdrops, isLoading }: AirdropsGridProps) {
  const { publicKey: userWalletPublicKey } = useWallet();
  
  // Extract airdrop public keys for batch fetching
  const airdropPublicKeys = airdrops.map(airdrop => airdrop.publicKey);
  
  // Use enhanced batch hook with error states
  const { 
    data: batchUserData, 
    isLoading: isLoadingUserData,
    error,
    isWalletError,
    isNetworkError,
    errorMessage,
    canRetry,
    retryOperation,
    stats,
    hasPartialData
  } = useBatchUserAirdropDataWithErrorStates(
    airdropPublicKeys,
    userWalletPublicKey ? userWalletPublicKey.toBase58() : null,
    !!userWalletPublicKey
  );

  if (isLoading) {
    return (
      <Card className="shadow-lg">
        <CardHeader className="space-y-2 px-6 py-5">
          <CardTitle className="text-2xl">Airdrops</CardTitle>
          <CardDescription>Loading airdrop campaigns...</CardDescription>
        </CardHeader>
        <CardContent className="px-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                <Skeleton className="h-6 w-2/5" />
                <Skeleton className="h-6 w-1/5" />
                <Skeleton className="h-6 w-1/5" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!airdrops || airdrops.length === 0) {
    return (
      <Card className="shadow-lg">
        <CardHeader className="px-6 py-5">
          <CardTitle className="text-2xl">Airdrops</CardTitle>
        </CardHeader>
        <CardContent className="px-6">
          <p className="text-center text-gray-500 dark:text-gray-400 py-12 text-lg">
            No airdrops available.
          </p>
        </CardContent>
      </Card>
    );
  }

  const displayedAirdrops = airdrops.slice(0, 9);

  // Create description with user data status
  const getCardDescription = () => {
    if (!userWalletPublicKey) {
      return "Connect wallet to see your amounts.";
    }
    
    if (isLoadingUserData) {
      return "Loading your airdrop data...";
    }
    
    if (error && !hasPartialData) {
      return `Showing ${displayedAirdrops.length} of ${airdrops.length} airdrops. ${errorMessage}`;
    }
    
    if (stats) {
      const successText = stats.successful > 0 
        ? `Your data loaded for ${stats.successful}/${stats.total} airdrops.`
        : "Unable to load your airdrop data.";
      return `Showing ${displayedAirdrops.length} of ${airdrops.length} airdrops. ${successText}`;
    }
    
    return `Showing ${displayedAirdrops.length} of ${airdrops.length} airdrops. Your wallet: ${userWalletPublicKey.toBase58().substring(0,6)}...`;
  };

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="space-y-3 px-6 py-5 border-b dark:border-gray-800">
        <CardTitle className="text-2xl font-semibold mb-2">Airdrop Campaigns</CardTitle>
        <CardDescription className="text-base">
          {getCardDescription()}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 py-4">
        {/* Show user data error if applicable */}
        {error && !isWalletError && (
          <UserDataErrorAlert
            error={errorMessage || 'Failed to load user data'}
            isWalletError={isWalletError}
            isNetworkError={isNetworkError}
            canRetry={canRetry || false}
            onRetry={retryOperation}
          />
        )}
        
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/80 dark:bg-gray-800/80 hover:bg-gray-50/80 dark:hover:bg-gray-800/80">
              <TableHead className="py-4 text-base font-semibold text-gray-700 dark:text-gray-300">Name / ID</TableHead>
              <TableHead className="py-4 text-base font-semibold text-gray-700 dark:text-gray-300">Type</TableHead>
              <TableHead className="py-4 text-base font-semibold text-gray-700 dark:text-gray-300 text-right">Recipients (Claimed/Total)</TableHead>
              <TableHead className="py-4 text-base font-semibold text-gray-700 dark:text-gray-300 text-right">Amount (Claimed/Total)</TableHead>
              <TableHead className="py-4 text-base font-semibold text-gray-700 dark:text-gray-300 text-right">Your Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedAirdrops.map((airdrop) => (
              <AirdropRow
                key={airdrop.publicKey}
                airdrop={airdrop}
                userLeafData={batchUserData?.[airdrop.publicKey]}
                isLoadingUserData={isLoadingUserData}
              />
            ))}
          </TableBody>
        </Table>
        {airdrops.length > 9 && (
          <div className="mt-6 text-center">
            <p className="text-base text-gray-600 dark:text-gray-400">
              And {airdrops.length - 9} more airdrops.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
