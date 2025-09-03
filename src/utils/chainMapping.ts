// This file is auto-generated. Do not edit manually.
export type ChainMapping = Record<string, string>;

export const chainToPath: ChainMapping = {
  "31337": "localhost",
  "97113": "anvil",
  "421614": "arbsepolia",
} as const;

export function getChainPath(chainId: number): string {
  const path = chainToPath[chainId.toString() as keyof typeof chainToPath];
  if (!path) {
    return "Custom network";
  }
  return path;
}
