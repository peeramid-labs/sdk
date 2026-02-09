import { GameMaster } from "../../rankify/GameMaster";
import { execSync } from "child_process";
import { Address } from "viem";

export function executeCommand(command: string, description?: string) {
  if (description) {
    console.log(`\n${description}`);
  }
  console.log(`Executing: ${command}`);
  try {
    execSync(command, { stdio: "inherit" });
  } catch (error) {
    console.error(`Error executing command: ${command}`);
    throw error;
  }
}

export function executeCommandWithOutput(command: string, description?: string): string {
  if (description) {
    console.log(`\n${description}`);
  }
  console.log(`Executing: ${command}`);
  try {
    const output = execSync(command, { encoding: "utf-8" });
    console.log(output);
    return output;
  } catch (error) {
    console.error(`Error executing command: ${command}`);
    throw error;
  }
}

export function sleep(seconds: number) {
  console.log(`Waiting ${seconds} seconds...`);
  execSync(`sleep ${seconds}`);
}

export function logSection(title: string) {
  console.log(`\n=== ${title} ===`);
}

export function logSuccess(message: string) {
  console.log(`\n✅ ${message}`);
}

export function logError(message: string, error?: unknown) {
  console.error(`\n❌ ${message}`, error);
}

/**
 * Store or update thread in API server
 * Use with owner, threadType, and metadata to create a new thread
 * Use with only gamePhase to update an existing thread
 */
export async function storeOrUpdateThreadInApi(params: {
  threadId: number;
  fellowshipId: number;
  instanceAddress: string;
  gamePhase?: string;
  owner?: string;
  threadType?: string;
  metadata?: string;
  apiUrl?: string;
  authToken?: string;
}): Promise<void> {
  const apiUrl = params.apiUrl || process.env.API_URL;

  if (!apiUrl) {
    console.log("⚠️  API_URL not set, skipping thread operation in API");
    return;
  }

  const { threadId, fellowshipId, instanceAddress, gamePhase, owner, threadType, metadata, authToken } = params;

  // Determine if this is a create or update operation
  const isCreate = !!(owner && threadType && metadata);
  const action = isCreate ? "Storing" : "Updating";

  console.log(`\n${action} thread ${threadId} in API server...`);

  try {
    let threadData: {
      id: number;
      fellowshipId: number;
      instanceAddress: string;
      gamePhase?: string;
      owner?: string;
      threadType?: string;
      metadata?: Record<string, unknown>;
      canStartEarlyIfFull?: boolean;
      onlyOwnerCanStart?: boolean;
      canStartNextTurnIfFinished?: boolean;
      private?: boolean;
      cronChecked?: boolean;
    } = {
      id: threadId,
      fellowshipId: fellowshipId,
      instanceAddress: instanceAddress,
    };

    // If creating, include all required fields
    if (isCreate && owner && threadType && metadata) {
      // Fetch metadata from IPFS
      let metadataObject;
      try {
        const ipfsUrl = metadata.replace("ipfs://", process.env.IPFS_GATEWAY || "https://ipfs.io/ipfs/");
        const response = await fetch(ipfsUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch metadata: ${response.statusText}`);
        }
        metadataObject = await response.json();
      } catch (error) {
        console.error("Error fetching metadata from IPFS:", error);
        // Use fallback metadata
        metadataObject = {
          name: "Game",
          description: "Rankify game",
        };
      }

      threadData = {
        ...threadData,
        gamePhase: gamePhase || "Registration open",
        owner: owner,
        threadType: threadType,
        metadata: metadataObject,
        canStartEarlyIfFull: false,
        onlyOwnerCanStart: false,
        canStartNextTurnIfFinished: true,
        private: false,
        cronChecked: false,
      };
    } else if (gamePhase) {
      // If updating, only include gamePhase
      threadData.gamePhase = gamePhase;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    };

    if (authToken) {
      headers["Cookie"] = `privy-id-token=${authToken}`;
    }

    // Add GM secret to headers
    const gmSecret = process.env.GM_SECRET || process.env.CRON_SECRET;
    if (gmSecret) {
      headers["x-gm-secret"] = gmSecret;
    }

    const response = await fetch(`${apiUrl}/thread/cron/store`, {
      method: "POST",
      headers,
      body: JSON.stringify(threadData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    if (isCreate) {
      console.log(`✅ Thread stored in API successfully. Code: ${result.code}`);
    } else {
      console.log(`✅ Thread updated successfully`);
    }
  } catch (error) {
    console.error(`Error ${action.toLowerCase()} thread in API:`, error);
    throw error;
  }
}

/**
 * Retry a function with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.log(
        `Attempt ${attempt + 1}/${maxRetries} failed: ${error instanceof Error ? error.message : String(error)}`
      );

      if (attempt < maxRetries - 1) {
        const delay = initialDelayMs * Math.pow(2, attempt);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Decrypt proposals with retry logic
 */
export async function decryptProposalsWithRetry(
  gameMaster: GameMaster,
  params: {
    instanceAddress: Address;
    gameId: bigint;
    turn: bigint;
    players: Address[];
    permute: boolean;
  },
  maxRetries: number = 3
): Promise<Array<{ proposer: Address; proposal: string }>> {
  console.log(`Decrypting proposals for turn ${params.turn}...`);

  return await retryWithBackoff(() => gameMaster.decryptProposals(params), maxRetries);
}

/**
 * Find the position of a target proposer in the permuted proposals array
 */
export function findProposalPosition(
  proposals: Array<{ proposer: string; proposal: string }>,
  players: string[],
  targetProposerIndex: number
): number {
  // Get the proposer's address from the players array
  const targetProposerAddress = players[targetProposerIndex];

  if (!targetProposerAddress) {
    console.log(`Warning: Invalid player index ${targetProposerIndex}`);
    return -1;
  }

  // Find the position of the target proposer in the permuted proposals array
  const targetPosition = proposals.findIndex((p) => p.proposer.toLowerCase() === targetProposerAddress.toLowerCase());

  if (targetPosition === -1) {
    console.log(`Warning: Cannot find proposal from ${targetProposerAddress} in permuted array`);
  }

  return targetPosition;
}

/**
 * Execute a create game command and extract the game ID from output
 */
export function createGameAndGetId(
  fellowshipId: number,
  createIndex: number,
  options: {
    turns?: number;
    timeToJoin?: number;
    timePerTurn?: number;
    votingPeriod?: number;
    proposingPeriod?: number;
    voteCredits?: number;
    metadata?: string;
  } = {}
): number {
  const {
    turns = 3,
    timeToJoin = 3000,
    timePerTurn = 3000,
    voteCredits = 1,
    metadata = "ipfs://QmZuHWcCaSKBrbquCFwhWMTZ5qmxQGxzQhy8NJgaKsY1J8",
  } = options;

  // If voting/proposing periods are not set, divide time-per-turn by 2
  const votingPeriod = options.votingPeriod ?? Math.floor(timePerTurn / 2);
  const proposingPeriod = options.proposingPeriod ?? Math.floor(timePerTurn / 2);

  const createOutput = executeCommandWithOutput(
    `pnpm cli fellowship game create ${fellowshipId} -i ${createIndex} --turns ${turns} --time-to-join ${timeToJoin} --time-per-turn ${timePerTurn} --voting-period ${votingPeriod} --proposing-period ${proposingPeriod} --vote-credits ${voteCredits} --metadata ${metadata}`,
    `Creating fellowship game in fellowship ${fellowshipId}`
  );

  // Extract game ID from output: "Game created with ID: 1"
  const gameIdMatch = createOutput.match(/Game created with ID: (\d+)/);
  if (!gameIdMatch) {
    throw new Error("Failed to extract game ID from create command output");
  }

  const gameId = parseInt(gameIdMatch[1]);
  console.log(`\n✅ Captured game ID: ${gameId}`);
  return gameId;
}
