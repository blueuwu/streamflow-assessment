import BN from "bn.js";

/**
 * Formats a BN (BigNumber) with decimal places for display
 * @param bn The BN to format
 * @param decimals Number of decimal places the BN represents
 * @param maxDisplayDecimals Maximum decimal places to show in output
 * @returns Formatted string representation
 */
export const formatBnWithDecimals = (
  bn: BN | undefined | null,
  decimals: number = 0,
  maxDisplayDecimals?: number
): string => {
  if (!bn) return "0";

  let baseStr: string;
  if (decimals === 0) {
    baseStr = bn.toString(10);
  } else {
    const bnStr = bn.toString(10);
    const len = bnStr.length;
    if (len <= decimals) {
      baseStr = "0." + "0".repeat(decimals - len) + bnStr;
    } else {
      baseStr = bnStr.slice(0, len - decimals) + "." + bnStr.slice(len - decimals);
    }
  }

  const parts = baseStr.split('.');
  const integerPart = parts[0];
  let fractionalPart = parts[1] || "";

  if (maxDisplayDecimals !== undefined) {
    if (maxDisplayDecimals === 0) {
      return integerPart;
    }
    fractionalPart = fractionalPart.substring(0, maxDisplayDecimals);
  }

  // Remove trailing zeros
  fractionalPart = fractionalPart.replace(/0+$/, "");

  if (fractionalPart.length > 0) {
    return `${integerPart}.${fractionalPart}`;
  } else {
    return integerPart;
  }
};

/**
 * Gets the appropriate token symbol based on mint address
 * @param mintAddress The mint address of the token
 * @returns Token symbol string
 */
export const getTokenSymbol = (mintAddress?: string): string => {
  if (!mintAddress) {
    return "units";
  }
  
  // SOL mint address
  if (mintAddress === "So11111111111111111111111111111111111111112") {
    return "SOL";
  }
  
  // Add other known token mappings here as needed
  // Example:
  // if (mintAddress === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v") {
  //   return "USDC";
  // }
  
  return "tokens";
};

/**
 * Calculates the appropriate decimal places for token amount calculations
 * @param baseDecimals The base decimals from the airdrop
 * @param mintAddress The mint address to determine token type
 * @returns Number of decimals to use for calculations
 */
export const getCalculationDecimals = (baseDecimals: number, mintAddress?: string): number => {
  const isSol = mintAddress === "So11111111111111111111111111111111111111112";
  // If baseDecimals is 0, use default decimals for the token type
  if (baseDecimals === 0) {
    return isSol ? 9 : 6;
  }
  
  // Otherwise, use the provided decimals as-is
  return baseDecimals;
};