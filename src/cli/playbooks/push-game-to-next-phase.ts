#!/usr/bin/env ts-node

import {
  executeCommand,
  createGameAndGetId,
  logSection,
  logSuccess,
  logError,
  storeOrUpdateThreadInApi,
} from "./utils";
import { GameMaster } from "../../rankify/GameMaster";
import { Address } from "viem";

enum TurnPhase {
  PROPOSING = 0,
  VOTING = 1,
}

/**
 * Push game to next phase
 * - If no gameId: create and start game
 * - If gameId exists: advance to next phase based on current state
 */
async function pushToNextPhase(
  fellowshipId: number,
  instanceAddress: Address,
  gameMaster: GameMaster,
  gameId?: number
): Promise<number> {
  try {
    let currentGameId = gameId;

    // If no game ID provided, create and start a new game
    if (!currentGameId) {
      logSection("No game ID provided - Creating and starting new game");

      const timePerTurn = 3000;
      const timeToJoin = 3000;
      const metadata = "ipfs://QmZuHWcCaSKBrbquCFwhWMTZ5qmxQGxzQhy8NJgaKsY1J8";

      // Create game and capture the game ID
      currentGameId = createGameAndGetId(fellowshipId, 1, {
        turns: 3,
        timeToJoin: timeToJoin,
        timePerTurn: timePerTurn,
        voteCredits: 1,
        metadata: metadata,
      });

      // Store thread in API server
      await storeOrUpdateThreadInApi({
        threadId: currentGameId,
        fellowshipId: fellowshipId,
        instanceAddress: instanceAddress,
        owner: gameMaster.walletClient.account?.address || "0x0",
        threadType: "MARKUP",
        metadata: metadata,
      });

      // Join game with multiple identities
      for (let i = 0; i <= 4; i++) {
        executeCommand(
          `pnpm cli fellowship game join ${fellowshipId} ${currentGameId} -i ${i}`,
          `Joining game with identity ${i}`
        );
      }

      executeCommand(
        `pnpm cli fellowship game start ${fellowshipId} ${currentGameId} -i 1 --auto-mine`,
        "Starting game"
      );

      // Update game phase to "In progress"
      await storeOrUpdateThreadInApi({
        threadId: currentGameId,
        fellowshipId: fellowshipId,
        instanceAddress: instanceAddress,
        gamePhase: "In progress",
      });

      logSuccess(`Game ${currentGameId} created and started successfully!`);
      return currentGameId;
    }

    // Game ID exists - get current state and advance to next phase
    logSection(`Advancing game ${currentGameId} to next phase`);

    const gameState = await gameMaster.getGameState({
      instanceAddress,
      gameId: BigInt(currentGameId),
    });

    console.log(`Current game phase: ${gameState.gamePhase}`);
    console.log(`Current turn: ${gameState.currentTurn}`);
    console.log(`Current phase: ${gameState.phase === 0n ? "PROPOSING" : "VOTING"}`);

    // Check if game has ended
    if (gameState.hasEnded) {
      console.log("⚠️  Game has already ended. No further phases to advance.");
      return currentGameId;
    }

    // Check if game has started
    if (!gameState.hasStarted) {
      logError("Game has not started yet. Cannot advance phases.");
      throw new Error("Game not started");
    }

    const currentPhase = Number(gameState.phase);

    if (currentPhase === TurnPhase.PROPOSING) {
      logSection("Current phase: PROPOSING - Submitting proposals and ending proposing stage");

      // Submit dummy proposals for all players
      const players = [...gameState.players];
      for (let i = 0; i < players.length; i++) {
        executeCommand(
          `pnpm cli fellowship game propose ${fellowshipId} ${currentGameId} -i ${i} -t "Auto proposal ${gameState.currentTurn}" -b "<p>Automatically generated proposal for turn ${gameState.currentTurn}</p>"`,
          `Player ${i} submitting proposal`
        );
      }

      // Get proposing period from game state
      const proposingPeriod = Number(gameState.proposingPhaseDuration);
      executeCommand(`pnpm cli blockchain mine -t ${proposingPeriod}`, "Mining blockchain");

      executeCommand(
        `pnpm cli fellowship game end-proposing ${fellowshipId} ${currentGameId}`,
        "Ending proposing phase"
      );

      logSuccess("Advanced to VOTING phase");
    } else if (currentPhase === TurnPhase.VOTING) {
      logSection("Current phase: VOTING - Submitting votes and ending voting stage");

      // Get voting period from game state
      const votingPeriod = Number(gameState.votePhaseDuration);

      // Submit dummy votes for all players
      // Each player votes for the next player's proposal (to avoid self-voting)
      const players = [...gameState.players];

      for (let i = 0; i < players.length; i++) {
        const voteArray = new Array(players.length).fill(0);
        // Vote for the next player's proposal (wraps around to 0 if at the end)
        const targetIndex = (i + 1) % players.length;
        voteArray[targetIndex] = 1;
        const voteString = voteArray.join(",");

        executeCommand(
          `pnpm cli fellowship game vote ${fellowshipId} ${currentGameId} "${voteString}" -i ${i}`,
          `Player ${i} voting for player ${targetIndex}'s proposal`
        );
      }

      executeCommand(`pnpm cli blockchain mine -t ${votingPeriod}`, "Mining blockchain");

      executeCommand(`pnpm cli fellowship game end-voting ${fellowshipId} ${currentGameId}`, "Ending voting phase");

      logSuccess("Voting phase completed - moved to next turn or game ended");
    }

    // Check final game state and update game phase in API
    const finalGameState = await gameMaster.getGameState({
      instanceAddress,
      gameId: BigInt(currentGameId),
    });

    const gamePhase = finalGameState.hasEnded ? "Finished" : "In progress";

    await storeOrUpdateThreadInApi({
      threadId: currentGameId,
      fellowshipId: fellowshipId,
      instanceAddress: instanceAddress,
      gamePhase: gamePhase,
    });

    console.log(`✅ Game phase updated to: ${gamePhase}`);

    return currentGameId;
  } catch (error) {
    logError("Error pushing game to next phase:", error);
    throw error;
  }
}

/**
 * Main function to run the pushGameToNextPhase playbook
 */
export async function runPushGameToNextPhase(args: string[], gameMaster: GameMaster): Promise<void> {
  if (args.length < 2) {
    console.log("Usage: runPushGameToNextPhase <fellowshipId> <instanceAddress> [gameId]");
    console.log("  fellowshipId: number - fellowship ID");
    console.log("  instanceAddress: address - Rankify instance address");
    console.log("  gameId: number (optional) - game ID to advance, if not provided creates new game");
    throw new Error("Invalid arguments");
  }

  const fellowshipId = parseInt(args[0]);
  const instanceAddress = args[1] as Address;
  const gameId = args[2] ? parseInt(args[2]) : undefined;

  console.log(`Running push game to next phase with fellowship ${fellowshipId}, instance ${instanceAddress}`);
  if (gameId) {
    console.log(`Advancing existing game ${gameId}`);
  } else {
    console.log(`No game ID provided - will create new game`);
  }
  console.log(`Using GameMaster: ${gameMaster.walletClient.account?.address}`);

  const resultGameId = await pushToNextPhase(fellowshipId, instanceAddress, gameMaster, gameId);

  logSuccess(`Playbook completed! Game ID: ${resultGameId}`);
}

function main() {
  console.log("This script should be run through cliPlaybooks.sh which provides the GameMaster instance");
  console.log("Usage: ./cliPlaybooks.sh push-game-to-next-phase <fellowshipId> <instanceAddress> [gameId]");
  process.exit(1);
}

if (require.main === module) {
  main();
}
