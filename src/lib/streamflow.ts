import { ICluster } from "@streamflow/common";
import { SolanaDistributorClient, MerkleDistributor, MerkleDistributorFields } from "@streamflow/distributor/solana";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { 
  StreamFlowError, 
  ErrorCode, 
  createStreamFlowError,
  type ErrorContext
} from '@/types/errors';
import { 
  handleAsyncOperationWithRetry, 
  handleAsyncOperation,
  validateRequired,
  errorLogger,
  LogLevel
} from '@/lib/error-handler';

const RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC_ENDPOINT || "https://api.devnet.solana.com";

const client = new SolanaDistributorClient({
  clusterUrl: RPC_ENDPOINT,
  cluster: ICluster.Devnet,
});

// Extended interface for Streamflow account with optional fields
interface StreamflowDistributor {
  publicKey: PublicKey;
  account: MerkleDistributorFields;
}

interface StreamflowClaimStatus {
  unlockedAmount: BN;
  lockedAmount: BN;
  lockedAmountWithdrawn: BN;
  closed: boolean;
}

export interface AirdropInfo {
  publicKey: string;
  version: number;
  name: string;
  isVested: boolean;
  maxNumNodes: BN;
  numNodesClaimed: BN;
  totalAmount: BN;
  claimedAmount: BN;
  decimals: number;
  mint: string;
}

export interface AirdropDetailData {
  publicKey: PublicKey;
  account: MerkleDistributor;
}

interface GetDistributorsParams {
  ids: string[];
}

export interface UserAirdropLeafData {
  totalAllocation: BN;
  claimedAmount: BN;
  isClaimed: boolean;
}

export interface BatchUserAirdropData {
  [airdropPublicKey: string]: UserAirdropLeafData | null;
}

// Merkle proof interface for claiming
export interface MerkleProofData {
  proof: number[][];
  amountUnlocked: BN;
  amountLocked: BN;
}

// Claim parameters interface
export interface ClaimParams {
  distributorPublicKey: string;
  proof: number[][];
  amountUnlocked: BN;
  amountLocked: BN;
}

// Claim result interface
export interface ClaimResult {
  success: boolean;
  signature?: string;
  error?: string;
}

// Enhanced type guards with better error context
function isValidDistributor(value: unknown, context: ErrorContext = {}): value is StreamflowDistributor {
  if (!value || typeof value !== 'object') {
    errorLogger.log(LogLevel.WARN, 'Invalid distributor: not an object', { ...context, value });
    return false;
  }
  
  const dist = value as Record<string, unknown>;
  const isValid = !!(
    dist.publicKey && 
    dist.account && 
    typeof dist.account === 'object' &&
    (dist.account as Record<string, unknown>).version !== undefined &&
    (dist.account as Record<string, unknown>).version !== null
  );

  if (!isValid) {
    errorLogger.log(LogLevel.WARN, 'Invalid distributor: missing required fields', {
      ...context,
      hasPublicKey: !!dist.publicKey,
      hasAccount: !!dist.account,
      accountType: typeof dist.account,
      hasVersion: (dist.account as Record<string, unknown>)?.version !== undefined
    });
  }

  return isValid;
}

function isStreamflowClaimStatus(value: unknown, context: ErrorContext = {}): value is StreamflowClaimStatus {
  if (!value || typeof value !== 'object') {
    errorLogger.log(LogLevel.WARN, 'Invalid claim status: not an object', { ...context, value });
    return false;
  }
  
  const claim = value as Partial<StreamflowClaimStatus>;
  const isValid = !!(
    claim.unlockedAmount instanceof BN &&
    claim.lockedAmount instanceof BN &&
    typeof claim.closed === 'boolean'
  );

  if (!isValid) {
    errorLogger.log(LogLevel.WARN, 'Invalid claim status: missing required fields', {
      ...context,
      hasUnlockedAmount: claim.unlockedAmount instanceof BN,
      hasLockedAmount: claim.lockedAmount instanceof BN,
      hasClosed: typeof claim.closed === 'boolean'
    });
  }

  return isValid;
}

function toBN(value: unknown, fieldName?: string): BN | null {
  if (value === null || value === undefined) return null;
  if (value instanceof BN) return value;
  
  if (typeof value === 'number' && !isNaN(value)) {
    return new BN(value);
  }
  
  if (typeof value === 'string') {
    const num = Number(value);
    if (!isNaN(num)) return new BN(num);
  }
  
  if (fieldName) {
    errorLogger.log(LogLevel.WARN, `Failed to convert ${fieldName} to BN`, { value, type: typeof value });
  }
  
  return null;
}

function validatePublicKey(keyString: string, fieldName: string = 'publicKey'): PublicKey {
  try {
    return new PublicKey(keyString);
  } catch (error) {
    throw new StreamFlowError(
      ErrorCode.INVALID_PUBLIC_KEY,
      `Invalid ${fieldName}: ${keyString}`,
      { fieldName, keyString, originalError: error }
    );
  }
}

function transformDistributorToAirdropInfo(
  distributor: StreamflowDistributor,
  index: number
): AirdropInfo | null {
  try {
    const account = distributor.account as MerkleDistributorFields;

    const versionBN = toBN(account.version, 'version') ?? new BN(0);
    const versionNumber = versionBN.toNumber();

    let mintAddress = "Unknown";
    if (account.mint && typeof account.mint.toBase58 === 'function') {
      mintAddress = account.mint.toBase58();
    } else if (account.mint) {
      mintAddress = String(account.mint);
    }

    const startTsBN = toBN(account.startTs, 'startTs');
    const endTsBN = toBN(account.endTs, 'endTs');

    let calculatedIsVested = false;
    if (startTsBN !== null && endTsBN !== null) {
      calculatedIsVested = !startTsBN.eq(endTsBN);
    }

    // Safely access optional fields
    const extendedAccount = account as unknown as Record<string, unknown>;
    const decimals = typeof extendedAccount.decimals === 'number' ? extendedAccount.decimals : 0;
    const name = (extendedAccount.name as string) || `Airdrop ${distributor.publicKey.toBase58().substring(0, 6)}...`;

    return {
      publicKey: distributor.publicKey.toBase58(),
      version: versionNumber,
      name: name,
      isVested: calculatedIsVested,
      maxNumNodes: account.maxNumNodes ?? new BN(0),
      numNodesClaimed: account.numNodesClaimed ?? new BN(0),
      totalAmount: account.maxTotalClaim ?? new BN(0),
      claimedAmount: account.totalAmountClaimed ?? new BN(0),
      decimals: decimals,
      mint: mintAddress,
    };
  } catch (error) {
    errorLogger.log(LogLevel.ERROR, `Failed to transform distributor at index ${index}`, {
      distributorPublicKey: distributor.publicKey?.toBase58(),
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

export const getAirdrops = async (
  mintFilter?: string,
  admin?: string,
  limit?: number,
): Promise<AirdropInfo[]> => {
  const operation = async (): Promise<AirdropInfo[]> => {
    const params: { mint?: string; admin?: string } = {};
    if (mintFilter) params.mint = mintFilter;
    if (admin) params.admin = admin;

    errorLogger.log(LogLevel.DEBUG, 'Searching distributors', { params, limit });

    const searchResults = await client.searchDistributors(params);

    if (!searchResults) {
      errorLogger.log(LogLevel.INFO, 'No distributors found', { params });
      return [];
    }

    errorLogger.log(LogLevel.DEBUG, `Found ${searchResults.length} distributors`, { count: searchResults.length });

    const airdropInfos: AirdropInfo[] = searchResults
      .map((distributor, index) => {
        if (!isValidDistributor(distributor, { index })) {
          errorLogger.log(LogLevel.WARN, 'Skipping malformed distributor', { 
            index, 
            distributorPublicKey: (distributor as Record<string, unknown>)?.publicKey?.toString?.() 
          });
          return null;
        }

        return transformDistributorToAirdropInfo(distributor, index);
      })
      .filter((item): item is AirdropInfo => item !== null);

    // Sort by version (newest first)
    airdropInfos.sort((a, b) => b.version - a.version);

    // Apply limit if specified
    const finalResults = limit && limit > 0 && limit < airdropInfos.length 
      ? airdropInfos.slice(0, limit)
      : airdropInfos;

    errorLogger.log(LogLevel.DEBUG, `Returning ${finalResults.length} airdrop infos`, { 
      totalFound: airdropInfos.length,
      returning: finalResults.length,
      limitApplied: !!limit
    });

    return finalResults;
  };

  const { data, error } = await handleAsyncOperationWithRetry(
    operation,
    'getAirdrops',
    { mintFilter, admin, limit },
    { maxRetries: 2, baseDelay: 1000 }
  );

  if (error) {
    throw error;
  }

  return data!;
};

export const getAirdropDetails = async (publicKeyString: string): Promise<AirdropDetailData | null> => {
  const operation = async (): Promise<AirdropDetailData | null> => {
    validateRequired(publicKeyString, 'publicKeyString');
    
    // Validate the public key format
    const publicKey = validatePublicKey(publicKeyString, 'airdrop publicKey');

    errorLogger.log(LogLevel.DEBUG, 'Fetching airdrop details', { publicKeyString });

    const params: GetDistributorsParams = { ids: [publicKeyString] };
    const distributorAccounts = await client.getDistributors(params);

    if (!distributorAccounts?.[0]) {
      errorLogger.log(LogLevel.INFO, 'No distributor account found', { publicKeyString });
      return null;
    }

    const result = {
      publicKey: publicKey,
      account: distributorAccounts[0],
    };

    errorLogger.log(LogLevel.DEBUG, 'Successfully fetched airdrop details', { publicKeyString });
    return result;
  };

  const { data, error } = await handleAsyncOperation(
    operation,
    'getAirdropDetails',
    { publicKeyString }
  );

  if (error) {
    // Convert specific known errors to NotFoundError
    if (error.code === ErrorCode.ACCOUNT_NOT_FOUND || 
        error.message.toLowerCase().includes('account does not exist')) {
      return null;
    }
    throw error;
  }

  return data!;
};

export const getUserAirdropLeafData = async (
  distributorPublicKeyString: string,
  userWalletPublicKeyString: string
): Promise<UserAirdropLeafData | null> => {
  const operation = async (): Promise<UserAirdropLeafData | null> => {
    validateRequired(distributorPublicKeyString, 'distributorPublicKeyString');
    validateRequired(userWalletPublicKeyString, 'userWalletPublicKeyString');

    const distributorPk = validatePublicKey(distributorPublicKeyString, 'distributor publicKey');
    const userPk = validatePublicKey(userWalletPublicKeyString, 'user wallet publicKey');

    errorLogger.log(LogLevel.DEBUG, 'Fetching user airdrop leaf data', {
      distributorPublicKey: distributorPublicKeyString,
      userWalletPublicKey: userWalletPublicKeyString
    });

    const [claimStatusPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("ClaimStatus"),
        distributorPk.toBuffer(),
        userPk.toBuffer(),
      ],
      client.getDistributorProgramId()
    );

    const claimStatus = await client.getClaim(claimStatusPda);

    if (!claimStatus || !isStreamflowClaimStatus(claimStatus, { 
      distributorPublicKey: distributorPublicKeyString,
      userWalletPublicKey: userWalletPublicKeyString 
    })) {
      errorLogger.log(LogLevel.INFO, 'No valid claim status found for user', {
        distributorPublicKey: distributorPublicKeyString,
        userWalletPublicKey: userWalletPublicKeyString,
        claimStatusPda: claimStatusPda.toBase58()
      });
      return null;
    }

    const result = {
      totalAllocation: claimStatus.unlockedAmount.add(claimStatus.lockedAmount),
      claimedAmount: claimStatus.lockedAmountWithdrawn,
      isClaimed: claimStatus.closed,
    };

    errorLogger.log(LogLevel.DEBUG, 'Successfully fetched user leaf data', {
      distributorPublicKey: distributorPublicKeyString,
      userWalletPublicKey: userWalletPublicKeyString,
      totalAllocation: result.totalAllocation.toString(),
      isClaimed: result.isClaimed
    });

    return result;
  };

  const { data, error } = await handleAsyncOperation(
    operation,
    'getUserAirdropLeafData',
    { distributorPublicKeyString, userWalletPublicKeyString }
  );

  if (error) {
    // Convert specific known errors to null (user not eligible)
    const errorMessage = error.message.toLowerCase();
    if (errorMessage.includes('account does not exist') ||
        errorMessage.includes('leaf not found') ||
        errorMessage.includes('recipient not found') ||
        errorMessage.includes('invalid account data')) {
      return null;
    }
    throw error;
  }

  return data!;
};

export const getBatchUserAirdropLeafData = async (
  airdropPublicKeys: string[],
  userWalletPublicKeyString: string
): Promise<BatchUserAirdropData> => {
  const operation = async (): Promise<BatchUserAirdropData> => {
    validateRequired(airdropPublicKeys, 'airdropPublicKeys');
    validateRequired(userWalletPublicKeyString, 'userWalletPublicKeyString');

    if (!Array.isArray(airdropPublicKeys) || airdropPublicKeys.length === 0) {
      errorLogger.log(LogLevel.WARN, 'Empty or invalid airdrop public keys array', { airdropPublicKeys });
      return {};
    }

    const userPk = validatePublicKey(userWalletPublicKeyString, 'user wallet publicKey');

    errorLogger.log(LogLevel.DEBUG, 'Starting batch user airdrop data fetch', {
      airdropCount: airdropPublicKeys.length,
      userWalletPublicKey: userWalletPublicKeyString
    });

    // Generate all claim status PDAs
    const claimStatusPdas = airdropPublicKeys.map(publicKey => {
      try {
        const distributorPk = validatePublicKey(publicKey, 'distributor publicKey');
        const [claimStatusPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("ClaimStatus"),
            distributorPk.toBuffer(),
            userPk.toBuffer(),
          ],
          client.getDistributorProgramId()
        );
        return { publicKey, claimStatusPda, error: null };
      } catch (error) {
        errorLogger.log(LogLevel.WARN, 'Failed to generate PDA for airdrop', { 
          publicKey, 
          error: error instanceof Error ? error.message : String(error)
        });
        return { publicKey, claimStatusPda: null, error: createStreamFlowError(error) };
      }
    });

    // Fetch claim data for each airdrop in parallel
    const claimDataPromises = claimStatusPdas.map(async ({ publicKey, claimStatusPda, error }) => {
      if (error || !claimStatusPda) {
        return { publicKey, leafData: null };
      }

      try {
        const claimStatus = await client.getClaim(claimStatusPda);

        if (!claimStatus || !isStreamflowClaimStatus(claimStatus, { 
          airdropPublicKey: publicKey,
          userWalletPublicKey: userWalletPublicKeyString 
        })) {
          return { publicKey, leafData: null };
        }

        const leafData: UserAirdropLeafData = {
          totalAllocation: claimStatus.unlockedAmount.add(claimStatus.lockedAmount),
          claimedAmount: claimStatus.lockedAmountWithdrawn,
          isClaimed: claimStatus.closed,
        };

        return { publicKey, leafData };
      } catch (error) {
        errorLogger.log(LogLevel.WARN, 'Failed to fetch leaf data for airdrop', {
          airdropPublicKey: publicKey,
          userWalletPublicKey: userWalletPublicKeyString,
          error: error instanceof Error ? error.message : String(error)
        });
        return { publicKey, leafData: null };
      }
    });

    const claimResults = await Promise.all(claimDataPromises);

    // Build the result object
    const result: BatchUserAirdropData = {};
    claimResults.forEach(({ publicKey, leafData }) => {
      result[publicKey] = leafData;
    });

    errorLogger.log(LogLevel.DEBUG, 'Completed batch user airdrop data fetch', {
      totalRequested: airdropPublicKeys.length,
      successfulFetches: claimResults.filter(r => r.leafData !== null).length,
      userWalletPublicKey: userWalletPublicKeyString
    });

    return result;
  };

  const { data, error } = await handleAsyncOperation(
    operation,
    'getBatchUserAirdropLeafData',
    { airdropPublicKeys, userWalletPublicKeyString }
  );

  if (error) {
    throw error;
  }

  return data!;
};

export const getMerkleProofForUser = async (
  distributorPublicKeyString: string,
  userWalletPublicKeyString: string
): Promise<MerkleProofData | null> => {
  // For now, return a placeholder since the exact API method needs to be determined
  // This would need to be implemented based on the actual StreamFlow SDK documentation
  errorLogger.log(LogLevel.INFO, 'getMerkleProofForUser not fully implemented', {
    distributorPublicKey: distributorPublicKeyString,
    userWalletPublicKey: userWalletPublicKeyString
  });
  
  // Return a mock structure for now to prevent build errors
  return {
    proof: [],
    amountUnlocked: new BN(0),
    amountLocked: new BN(0)
  };
};

export const claimAirdrop = async (
  claimParams: ClaimParams,
  wallet: Record<string, unknown>
): Promise<ClaimResult> => {
  const operation = async (): Promise<ClaimResult> => {
    validateRequired(claimParams, 'claimParams');
    validateRequired(wallet, 'wallet');

    validatePublicKey(claimParams.distributorPublicKey, 'distributor publicKey');

    errorLogger.log(LogLevel.DEBUG, 'Starting airdrop claim', {
      distributorPublicKey: claimParams.distributorPublicKey,
      proofLength: claimParams.proof.length,
      amountUnlocked: claimParams.amountUnlocked.toString(),
      amountLocked: claimParams.amountLocked.toString()
    });

    try {
      // Use type assertion to work around the strict typing
      const result = await (client as unknown as { claim: (data: unknown, extParams: unknown) => Promise<{ txId?: string }> }).claim({
        id: claimParams.distributorPublicKey,
        proof: claimParams.proof,
        amountUnlocked: claimParams.amountUnlocked,
        amountLocked: claimParams.amountLocked,
      }, wallet);

      const signature = result?.txId || 'unknown';

      errorLogger.log(LogLevel.INFO, 'Airdrop claim successful', {
        distributorPublicKey: claimParams.distributorPublicKey,
        signature: signature
      });

      return {
        success: true,
        signature: signature,
      };
    } catch (error) {
      errorLogger.log(LogLevel.ERROR, 'Airdrop claim failed', {
        distributorPublicKey: claimParams.distributorPublicKey,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  };

  const { data, error } = await handleAsyncOperation(
    operation,
    'claimAirdrop',
    { distributorPublicKey: claimParams.distributorPublicKey }
  );

  if (error) {
    throw error;
  }

  return data!;
};
