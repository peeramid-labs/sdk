// This file is auto-generated. Do not edit manually.
export type ChainMapping = Record<string, string>;

export const chainToPath: ChainMapping = {
  "31337": "localhost",
  "97113": "anvil",
  "23772": "buildbear",
} as const;

export function getChainPath(chainId: number): string {
  const path = chainToPath[chainId.toString() as keyof typeof chainToPath];
  if (!path) {
    throw new Error(`Chain ID ${chainId} is not supported`);
  }
  return path;
}
