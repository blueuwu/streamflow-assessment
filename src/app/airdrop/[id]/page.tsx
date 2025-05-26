"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, CheckCircle, Users, AlertTriangle, RefreshCw, Wifi } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ConnectWalletButton } from "@/components/connect-wallet-button"
import { getAirdropDetails, getUserAirdropLeafData, UserAirdropLeafData, AirdropDetailData, claimAirdrop, getMerkleProofForUser } from "@/lib/streamflow"
import { formatBnWithDecimals } from "@/lib/format-utils"
import { useWallet } from "@solana/wallet-adapter-react"
import BN from "bn.js"
import { Skeleton } from "@/components/ui/skeleton"
import { PublicKey } from "@solana/web3.js"
import { ErrorBoundary } from "@/components/error-boundary"
import { handleAsyncOperation } from "@/lib/error-handler"
import { StreamFlowError, ErrorCode } from "@/types/errors"

interface VestingConfig {
  numPeriods: BN;
  cliffTs: BN;
}

interface AirdropAccount {
  version: BN;
  mint: PublicKey;
  maxNumNodes: BN;
  numNodesClaimed: BN;
  maxTotalClaim: BN;
  totalAmountClaimed: BN;
  startTs: BN;
  endTs: BN;
  decimals?: number;
  name?: string;
  vestingConfig?: VestingConfig;
}

interface LoadingState {
  airdrop: boolean;
  userLeaf: boolean;
}

interface ErrorState {
  airdrop: StreamFlowError | null;
  userLeaf: StreamFlowError | null;
}

const getAirdropType = (isVested: boolean): string => {
  return isVested ? "Vested" : "Instant";
};

const isVestingConfig = (value: unknown): value is VestingConfig => {
  if (!value || typeof value !== 'object') return false;
  const config = value as Partial<VestingConfig>;
  return !!(
    config.numPeriods instanceof BN &&
    config.cliffTs instanceof BN
  );
};

function ErrorDisplay({ 
  error, 
  onRetry, 
  context 
}: {
  error: StreamFlowError;
  onRetry?: () => void;
  context: string;
}) {
  const isNetworkError = error.code === ErrorCode.NETWORK_ERROR || error.code === ErrorCode.RPC_ERROR;
  const isNotFound = error.code === ErrorCode.ACCOUNT_NOT_FOUND || error.code === ErrorCode.DISTRIBUTOR_NOT_FOUND;

  const getIcon = () => {
    if (isNetworkError) return <Wifi className="h-5 w-5" />;
    if (isNotFound) return <AlertTriangle className="h-5 w-5" />;
    return <AlertTriangle className="h-5 w-5" />;
  };

  const getColor = () => {
    if (isNetworkError) return "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200";
    if (isNotFound) return "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 text-blue-800 dark:text-blue-200";
    return "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800 text-red-800 dark:text-red-200";
  };

  return (
    <Alert className={`${getColor()} border`}>
      <div className="flex items-start gap-3">
        {getIcon()}
        <div className="flex-1">
          <AlertDescription className="font-medium">
            {context}
          </AlertDescription>
          <AlertDescription className="mt-1">
            {error.getUserMessage()}
          </AlertDescription>
          {error.retryable && onRetry && (
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

function AirdropPageContent() {
  const { id: airdropPublicKeyString } = useParams()
  const { publicKey: userWalletPublicKey, connected: walletConnected, ...wallet } = useWallet();

  const [airdropData, setAirdropData] = useState<AirdropDetailData | null | undefined>(undefined);
  const [userLeafData, setUserLeafData] = useState<UserAirdropLeafData | null | undefined>(undefined);
  const [loading, setLoading] = useState<LoadingState>({ airdrop: true, userLeaf: false });
  const [errors, setErrors] = useState<ErrorState>({ airdrop: null, userLeaf: null });
  const [claimed, setClaimed] = useState(false);

  // Fetch airdrop details
  useEffect(() => {
    if (airdropPublicKeyString && typeof airdropPublicKeyString === 'string') {
      const fetchDetails = async () => {
        setLoading(prev => ({ ...prev, airdrop: true }));
        setAirdropData(undefined);
        setUserLeafData(undefined);
        setLoading(prev => ({ ...prev, userLeaf: false }));
        setErrors({ airdrop: null, userLeaf: null });
        setClaimed(false);
        
        const { data, error } = await handleAsyncOperation(
          () => getAirdropDetails(airdropPublicKeyString),
          'getAirdropDetails',
          { publicKeyString: airdropPublicKeyString }
        );

        if (error) {
          setErrors(prev => ({ ...prev, airdrop: error }));
          setAirdropData(null);
        } else {
          setAirdropData(data);
          setErrors(prev => ({ ...prev, airdrop: null }));
        }
        
        setLoading(prev => ({ ...prev, airdrop: false }));
      };
      fetchDetails();
    } else {
      setAirdropData(null);
      setLoading(prev => ({ ...prev, airdrop: false }));
      setErrors(prev => ({ ...prev, airdrop: new StreamFlowError(
        ErrorCode.INVALID_PUBLIC_KEY,
        'Invalid airdrop ID provided',
        { airdropId: airdropPublicKeyString }
      )}));
    }
  }, [airdropPublicKeyString]);

  // Fetch user leaf data
  useEffect(() => {
    if (!walletConnected) {
      setUserLeafData(undefined);
      setLoading(prev => ({ ...prev, userLeaf: false }));
      setErrors(prev => ({ ...prev, userLeaf: null }));
      setClaimed(false);
      return;
    }

    if (!(airdropData && 'publicKey' in airdropData)) {
      setLoading(prev => ({ ...prev, userLeaf: false }));
      setUserLeafData(undefined);
      setErrors(prev => ({ ...prev, userLeaf: null }));
      setClaimed(false);
      return;
    }

    if (userWalletPublicKey) {
      const fetchUserLeaf = async () => {
        setLoading(prev => ({ ...prev, userLeaf: true }));
        setUserLeafData(undefined);
        setErrors(prev => ({ ...prev, userLeaf: null }));
        
        const { data, error } = await handleAsyncOperation(
          () => getUserAirdropLeafData(
            airdropData.publicKey.toBase58(),
            userWalletPublicKey.toBase58()
          ),
          'getUserAirdropLeafData',
          { 
            distributorPublicKey: airdropData.publicKey.toBase58(),
            userWalletPublicKey: userWalletPublicKey.toBase58()
          }
        );

        if (error) {
          // Only set error if it's not a "not found" type error
          if (error.code !== ErrorCode.ACCOUNT_NOT_FOUND) {
            setErrors(prev => ({ ...prev, userLeaf: error }));
          }
          setUserLeafData(null);
          setClaimed(false);
        } else {
          setUserLeafData(data);
          setClaimed(data?.isClaimed ?? false);
          setErrors(prev => ({ ...prev, userLeaf: null }));
        }
        
        setLoading(prev => ({ ...prev, userLeaf: false }));
      };
      fetchUserLeaf();
    } else {
      setLoading(prev => ({ ...prev, userLeaf: false }));
      setUserLeafData(undefined);
      setErrors(prev => ({ ...prev, userLeaf: null }));
    }
  }, [airdropData, userWalletPublicKey, walletConnected]);

  const handleClaim = async () => {
    if (!airdropData?.publicKey || !userWalletPublicKey || !userLeafData) return;
    
    try {
      console.log("Starting claim process for airdrop:", airdropData.publicKey.toBase58(), "User:", userWalletPublicKey.toBase58());
      
      // Get merkle proof for the user
      const proofData = await getMerkleProofForUser(
        airdropData.publicKey.toBase58(),
        userWalletPublicKey.toBase58()
      );
      
      if (!proofData) {
        console.error("Could not get merkle proof for user");
        alert("Unable to generate claim proof. Please try again later.");
        return;
      }
      
      // Optimistic update
      setClaimed(true);
      
      // Execute the claim transaction
      const result = await claimAirdrop(
        {
          distributorPublicKey: airdropData.publicKey.toBase58(),
          proof: proofData.proof,
          amountUnlocked: proofData.amountUnlocked,
          amountLocked: proofData.amountLocked,
        },
        wallet // Full wallet adapter object
      );
      
      if (result.success) {
        console.log("Claim successful! Transaction:", result.signature);
        // Update the user leaf data to reflect the claim
        if (userLeafData) {
          setUserLeafData({
            ...userLeafData,
            isClaimed: true
          });
        }
        alert(`Claim successful! Transaction: ${result.signature}`);
      } else {
        setClaimed(false);
        alert("Claim failed. Please try again.");
      }
    } catch (error) {
      setClaimed(false);
      console.error("Claim failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      alert(`Claim failed: ${errorMessage}`);
    }
  };

  const retryAirdropFetch = () => {
    if (airdropPublicKeyString && typeof airdropPublicKeyString === 'string') {
      setErrors(prev => ({ ...prev, airdrop: null }));
      // Trigger re-fetch by updating a dependency (we can add a counter state if needed)
      window.location.reload();
    }
  };

  const retryUserDataFetch = () => {
    if (userWalletPublicKey && airdropData) {
      setErrors(prev => ({ ...prev, userLeaf: null }));
      // Force re-fetch user data
      setUserLeafData(undefined);
      setLoading(prev => ({ ...prev, userLeaf: true }));
    }
  };

  if (loading.airdrop || airdropData === undefined) {
    return (
      <div className="flex items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-blue-950 dark:to-gray-900 min-h-[70vh]">
        <div className="space-y-4 p-8">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    );
  }

  if (errors.airdrop || !airdropData || !airdropData.account) {
    return (
      <div className="bg-gradient-to-b from-blue-50 to-white dark:from-blue-950 dark:to-gray-900">
        <main className="container px-4 py-12 md:px-6 flex flex-col items-center justify-center min-h-[70vh]">
          <div className="w-full max-w-md space-y-4">
            {errors.airdrop ? (
              <ErrorDisplay
                error={errors.airdrop}
                onRetry={errors.airdrop.retryable ? retryAirdropFetch : undefined}
                context="Failed to load airdrop details"
              />
            ) : (
              <div className="text-center space-y-4 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-xl">
                <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Airdrop Not Found</h1>
                <p className="text-gray-500 dark:text-gray-400">
                  The airdrop with ID <code className="bg-gray-100 dark:bg-gray-700 p-1 rounded text-sm">{typeof airdropPublicKeyString === 'string' ? airdropPublicKeyString : ""}</code> could not be found or loaded.
                </p>
              </div>
            )}
            <div className="text-center">
              <Button
                asChild
                className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-600"
              >
                <Link href="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Home
                </Link>
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const account = airdropData.account as unknown as AirdropAccount;
  
  const name = account.name ?? "Unnamed Airdrop";
  const decimals = account.decimals ?? 0;
  const vestingConfig = account.vestingConfig && isVestingConfig(account.vestingConfig) ? account.vestingConfig : null;
  
  const isVested = !account.startTs.eq(account.endTs);
  const airdropType = getAirdropType(isVested);

  const recipientsProgress = account.maxNumNodes.gtn(0)
    ? account.numNodesClaimed.muln(100).div(account.maxNumNodes).toNumber()
    : 0;

  

  const cliffDateString = vestingConfig?.cliffTs
    ? new Date(vestingConfig.cliffTs.toNumber() * 1000).toLocaleDateString()
    : null;

  return (
    <div className="bg-gradient-to-b from-blue-50 to-white dark:from-blue-950 dark:to-gray-900">
      <main className="container px-4 py-6 md:px-6 md:py-12">
        <div className="mb-6">
          <Button asChild variant="ghost" className="p-0 hover:bg-transparent">
            <Link
              href="/"
              className="flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to all airdrops
            </Link>
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold">{name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    variant={airdropType === "Instant" ? "default" : "outline"}
                    className={airdropType === "Instant" ? "bg-blue-500 dark:bg-blue-600" : ""}
                  >
                    {airdropType}
                  </Badge>
                  <span className="text-sm text-gray-500 dark:text-gray-400 truncate" title={airdropData.publicKey.toBase58()}>
                    ID: {airdropData.publicKey.toBase58().substring(0,8)}...
                  </span>
                </div>
              </div>
            </div>

            <Card className="dark:bg-gray-900/50">
              <CardHeader>
                <CardTitle>Airdrop Details</CardTitle>
                <CardDescription>{name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 dark:bg-blue-900/50 dark:text-blue-300">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Recipients</div>
                      <div className="font-medium">
                        {account.numNodesClaimed.toString()}/{account.maxNumNodes.toString()}
                      </div>
                    </div>
                  </div>
                </div>

                <Separator className="dark:bg-gray-800" />

                <div>
                  <h3 className="font-medium mb-2">Distribution Progress</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Recipients</span>
                        <span>
                          {account.numNodesClaimed.toString()}/{account.maxNumNodes.toString()} ({recipientsProgress}%)
                        </span>
                      </div>
                      <Progress
                        value={recipientsProgress}
                        className="h-2 bg-gray-200 dark:bg-gray-700"
                      />
                    </div>
                  </div>
                </div>

                {isVested && vestingConfig && (
                  <>
                    <Separator className="dark:bg-gray-800" />
                    <div>
                      <h3 className="font-medium mb-2">Vesting Schedule</h3>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="flex flex-col">
                          <span className="text-sm text-gray-500 dark:text-gray-400">Vesting Period</span>
                          <span>{vestingConfig.numPeriods.toString()} periods</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm text-gray-500 dark:text-gray-400">Cliff Period</span>
                          <span>{cliffDateString || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="sticky top-20 dark:bg-gray-900/50">
              <CardHeader>
                <CardTitle>Your Allocation</CardTitle>
                <CardDescription>
                  {!walletConnected ? "Connect your wallet to check eligibility and claim." : 
                   loading.userLeaf ? "Checking your allocation..." :
                   userLeafData ? "You are eligible for this airdrop." :
                   "Not eligible"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {!walletConnected ? (
                  <div className="text-center py-4">
                    <ConnectWalletButton />
                  </div>
                ) : loading.userLeaf ? (
                  <div className="space-y-2 py-4">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-10 w-full mt-4" />
                  </div>
                ) : errors.userLeaf ? (
                  <ErrorDisplay
                    error={errors.userLeaf}
                    onRetry={errors.userLeaf.retryable ? retryUserDataFetch : undefined}
                    context="Failed to load your allocation data"
                  />
                ) : userLeafData ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Token</span>
                        <span>
                          {account.mint.toBase58().substring(0,4)}...{account.mint.toBase58().substring(account.mint.toBase58().length - 4)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Your Total Allocation</span>
                        <div className="text-right">
                          <div>
                            {formatBnWithDecimals(userLeafData.totalAllocation, decimals)}
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Claim Status</span>
                        <span className={userLeafData.isClaimed || claimed ? "text-green-600 dark:text-green-400" : ""}>
                          {userLeafData.isClaimed || claimed ? "Claimed" : "Not Claimed"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Type</span>
                        <span>{airdropType}</span>
                      </div>
                    </div>

                    <Separator className="dark:bg-gray-800" />

                    {userLeafData.isClaimed || claimed ? (
                      <div className="bg-green-50 text-green-700 p-4 rounded-lg flex items-center gap-2 dark:bg-green-900/20 dark:text-green-400">
                        <CheckCircle className="h-5 w-5" />
                        <span>Successfully claimed!</span>
                      </div>
                    ) : (
                      <Button
                        onClick={handleClaim}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-600"
                      >
                        Claim {formatBnWithDecimals(userLeafData.totalAllocation, decimals)}
                      </Button>
                    )}

                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      By claiming, you agree to the terms and conditions of this airdrop.
                      {airdropType === "Vested" && " Tokens will be vested according to the vesting schedule."}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                    You are not eligible for this airdrop, or your allocation data could not be loaded.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function AirdropPage() {
  return (
    <ErrorBoundary>
      <AirdropPageContent />
    </ErrorBoundary>
  );
}
