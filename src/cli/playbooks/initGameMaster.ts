#!/usr/bin/env ts-node

import { createPublic, createWallet } from "../client";
import { GameMaster } from "../../rankify/GameMaster";
import EnvioGraphQLClient from "../../utils/EnvioGraphQLClient";

/**
 * Simple GameMaster initializer for playbooks
 */
export async function createGameMaster(): Promise<GameMaster> {
  const rpcUrl = process.env.RPC_URL;
  const gmPrivateKey = process.env.GM_KEY || process.env.PRIVATE_KEY;
  const envioUrl = process.env.INDEXER_URL || "http://localhost:8080/v1/graphql";

  if (!rpcUrl) {
    throw new Error("RPC_URL environment variable is required");
  }

  if (!gmPrivateKey) {
    throw new Error("GM_KEY or PRIVATE_KEY environment variable is required");
  }

  console.log("Initializing GameMaster...");

  // Create clients
  const publicClient = await createPublic(rpcUrl);
  const walletClient = await createWallet(rpcUrl, gmPrivateKey);
  const chainId = Number(await publicClient.getChainId());
  const envioClient = new EnvioGraphQLClient({
    endpoint: envioUrl,
  });

  // Create GameMaster instance
  const gameMaster = new GameMaster({
    walletClient,
    publicClient,
    chainId,
    envioClient,
  });

  console.log(`✅ GameMaster initialized`);
  console.log(`   Address: ${walletClient.account?.address}`);
  console.log(`   Chain ID: ${chainId}`);

  return gameMaster;
}

if (require.main === module) {
  createGameMaster().catch((error) => {
    console.error("Failed to create GameMaster:", error);
    process.exit(1);
  });
}
