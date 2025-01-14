import { Chain, createPublicClient, createWalletClient, Hex, http, WalletClient } from "viem";
import { chainToPath } from "../utils/chainMapping";
import { privateKeyToAccount } from "viem/accounts";

export const createPublic = async (rpcUrl?: string) => {
  const endpoint = rpcUrl || process.env.RPC_URL;
  if (!endpoint) {
    throw new Error("RPC URL is required. Either pass it as a parameter or set RPC_URL environment variable");
  }

  const publicClient = createPublicClient({
    transport: http(endpoint),
  });
  const chainId = await publicClient.getChainId();
  const chain: Chain = {
    id: chainId,
    name: chainToPath[chainId.toString()],
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: [endpoint],
      },
      public: {
        http: [endpoint],
      },
    },
  };
  // Create a temporary client to get chain ID
  return createPublicClient({
    transport: http(endpoint),
    chain,
  });
};

export const createWallet = async (rpcUrl?: string, key?: string): Promise<WalletClient> => {
  const endpoint = rpcUrl || process.env.RPC_URL;
  if (!endpoint) {
    throw new Error("RPC URL is required. Either pass it as a parameter or set RPC_URL environment variable");
  }
  const signerKey = key || process.env.PRIVATE_KEY;
  if (!signerKey) {
    throw new Error("Private key is required. Either pass it as a parameter or set PRIVATE_KEY environment variable");
  }

  // Get chain ID using public client
  const publicClient = createPublicClient({
    transport: http(endpoint),
  });
  const chainId = await publicClient.getChainId();
  const chain: Chain = {
    id: chainId,
    name: chainToPath[chainId.toString()],
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: [endpoint],
      },
      public: {
        http: [endpoint],
      },
    },
  };
  const account = privateKeyToAccount(signerKey as Hex);

  return createWalletClient({
    transport: http(endpoint),
    account,
    chain,
    cacheTime: 0,
  });
};
