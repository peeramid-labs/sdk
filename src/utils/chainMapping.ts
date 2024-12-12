// This file is auto-generated. Do not edit manually.
export type ChainMapping = Record<number, string>;

export const chainToPath: ChainMapping = {
  "42161": "localhost",
  "97113": "anvil",
} as const;

export function getChainPath(chainId: number): string {
  const path = chainToPath[chainId];
  if (!path) {
    throw new Error(`Chain ID ${chainId} is not supported`);
  }
  return path;
}
