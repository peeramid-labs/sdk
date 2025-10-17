#!/usr/bin/env ts-node

import {
  executeCommand,
  createGameAndGetId,
  logSection,
  logSuccess,
  findProposalPosition,
  decryptProposalsWithRetry,
  storeOrUpdateThreadInApi,
} from "./utils";
import { GameMaster } from "../../rankify/GameMaster";
import { Address } from "viem";

async function runPart1(fellowshipId: number, instanceAddress: Address, gameMaster: GameMaster) {
  logSection("Running Part 1: Initialize game and play");

  const timePerTurn = 3000;
  const votingPeriod = timePerTurn / 2;
  const proposingPeriod = timePerTurn / 2;
  const timeToJoin = 3000;
  const metadata = "ipfs://QmZuHWcCaSKBrbquCFwhWMTZ5qmxQGxzQhy8NJgaKsY1J8";
  if (!process.env.MNEMONIC) throw new Error("MNEMONIC environment variable is not set");
  // Create game and capture the game ID
  const gameId = createGameAndGetId(instanceAddress, 1, {
    turns: 3,
    timeToJoin: timeToJoin,
    timePerTurn: timePerTurn,
    votingPeriod: votingPeriod,
    proposingPeriod: proposingPeriod,
    voteCredits: 1,
    metadata: metadata,
  });

  // Store thread in API server
  await storeOrUpdateThreadInApi({
    threadId: gameId,
    fellowshipId: fellowshipId,
    instanceAddress: instanceAddress,
    owner: gameMaster.walletClient.account?.address || "0x0",
    threadType: "MARKUP",
    metadata: metadata,
  });

  // Join game with multiple identities
  for (let i = 0; i <= 4; i++) {
    executeCommand(
      `pnpm cli fellowship game join ${fellowshipId} ${gameId} -i ${i} --gm-key ${process.env.GM_KEY}`,
      `Joining game with identity ${i}`
    );
  }

  executeCommand(
    `pnpm cli fellowship game start ${fellowshipId} ${gameId} -i 1 --auto-mine --key ${process.env.GM_KEY}`,
    "Starting game"
  );

  // Update game phase to "In progress"
  await storeOrUpdateThreadInApi({
    threadId: gameId,
    fellowshipId: fellowshipId,
    instanceAddress: instanceAddress,
    gamePhase: "In progress",
  });

  // Proposals for turn 1 - store in array matching player order
  const turn1ProposalTitles = [
    null, // Player 0 doesn't propose
    "Everything was clear to me",
    "Couldn't login with Telegram",
    "Make a move button is visible even if I made a move",
    "Found no bugs - everything is fine",
  ];

  const turn1ProposalBodies = [
    null,
    "<p>I understood everything without any problems. Made proposal successfully.</p>",
    "<p>I tried to login with Telegram but it didn't work. Invalid Domain name error pops out.</p>",
    "<p>I made a move in 1st turn but make a move button is still active and and blinking calling my attention to it.</p>",
    "<p>Really do not know what to say</p>",
  ];

  // Submit proposals
  for (let i = 0; i < turn1ProposalTitles.length; i++) {
    if (turn1ProposalTitles[i]) {
      executeCommand(
        `pnpm cli fellowship game propose ${fellowshipId} ${gameId} -i ${i} -t "${turn1ProposalTitles[i]}" -b "${turn1ProposalBodies[i]}" --gm-key "${process.env.GM_KEY}"`,
        `Player ${i} submitting proposal`
      );
    }
  }

  executeCommand(`pnpm cli blockchain mine -t ${proposingPeriod}`, "Mining blockchain");
  executeCommand(
    `pnpm cli fellowship game end-proposing ${fellowshipId} ${gameId} --gm-key "${process.env.GM_KEY}"`,
    "Ending proposing phase"
  );

  // Voting for turn 1 - decrypt proposals to get permutation
  console.log("\nDecrypting proposals to calculate correct voting positions...");

  // Get players list from the game state
  const gameState = await gameMaster.getGameState({ instanceAddress, gameId: BigInt(gameId) });
  const players = [...gameState.players];

  const turn1Proposals = await decryptProposalsWithRetry(gameMaster, {
    instanceAddress,
    gameId: BigInt(gameId),
    turn: 1n,
    players: players,
    permute: true,
  });

  // Map of player index to which proposal they want to vote for (by original proposer index)
  const turn1VoteIntents = [
    { voter: 0, targetProposer: 2 },
    { voter: 1, targetProposer: 3 },
    { voter: 2, targetProposer: 3 },
    { voter: 3, targetProposer: 4 },
    { voter: 4, targetProposer: 3 },
  ];

  for (const { voter, targetProposer } of turn1VoteIntents) {
    // Find the position of the target proposer in the permuted proposals array
    const targetPosition = findProposalPosition(turn1Proposals, players, targetProposer);

    if (targetPosition === -1) {
      console.log(`Player ${voter} skipping vote for player ${targetProposer}`);
      continue;
    }

    // Create vote array with 1 credit at the target position
    const voteArray = new Array(turn1Proposals.length).fill(0);
    voteArray[targetPosition] = 1;
    const voteString = voteArray.join(",");

    executeCommand(
      `pnpm cli fellowship game vote ${fellowshipId} ${gameId} "${voteString}" -i ${voter} --gm-key ${process.env.GM_KEY}`,
      `Player ${voter} voting for proposal at position ${targetPosition} (originally from player ${targetProposer})`
    );
  }

  executeCommand(`pnpm cli blockchain mine -t ${votingPeriod}`, "Mining blockchain");
  executeCommand(
    `pnpm cli fellowship game end-voting ${fellowshipId} ${gameId} --gm-key ${process.env.GM_KEY}`,
    "Ending voting phase"
  );

  // Proposals for turn 2 - store in array matching player order
  const turn2ProposalTitles = [
    "There is bug in Thread creation modal",
    null, // Player 1 doesn't propose
    "Couldn't create a game",
    "Vote interface was hard to understand",
    "Found no bugs - everything is fine",
  ];

  const turn2ProposalBodies = [
    "<p>ETA is not calculated correctly. 1 hour is not shown as 1 hour but as 1:00</p>",
    null,
    "<p>I tried to create a game but it didn't work. I got an error message. xs233</p>",
    "<p>I would make it more intuitive. For example, add a tooltip or a hint. Or even better change it to tab view - to look same as historical turn.</p>",
    "<p>Really do not know what to say</p>",
  ];

  // Submit proposals
  for (let i = 0; i < turn2ProposalTitles.length; i++) {
    if (turn2ProposalTitles[i]) {
      executeCommand(
        `pnpm cli fellowship game propose ${fellowshipId} ${gameId} -i ${i} -t "${turn2ProposalTitles[i]}" -b "${turn2ProposalBodies[i]}" --gm-key "${process.env.GM_KEY}"`,
        `Player ${i} submitting proposal for turn 2`
      );
    }
  }

  executeCommand(`pnpm cli blockchain mine -t ${proposingPeriod}`, "Mining blockchain");
  executeCommand(
    `pnpm cli fellowship game end-proposing ${fellowshipId} ${gameId} --gm-key ${process.env.GM_KEY}`,
    "Ending proposing phase"
  );

  // Voting for turn 2 - decrypt proposals to get permutation
  console.log("\nDecrypting proposals to calculate correct voting positions...");
  const turn2Proposals = await decryptProposalsWithRetry(gameMaster, {
    instanceAddress,
    gameId: BigInt(gameId),
    turn: 2n,
    players,
    permute: true,
  });

  // Player 0, 1, 2, 4 want to vote for player 0's proposal, player 3 wants to vote for player 2's
  const turn2VoteIntents = [
    { voter: 0, targetProposer: 3 },
    { voter: 1, targetProposer: 0 },
    { voter: 2, targetProposer: 0 },
    { voter: 3, targetProposer: 2 },
    { voter: 4, targetProposer: 0 },
  ];

  for (const { voter, targetProposer } of turn2VoteIntents) {
    // Find the position of the target proposer in the permuted proposals array
    const targetPosition = findProposalPosition(turn2Proposals, players, targetProposer);

    if (targetPosition === -1) {
      console.log(`Player ${voter} skipping vote for player ${targetProposer}`);
      continue;
    }

    const voteArray = new Array(turn2Proposals.length).fill(0);
    voteArray[targetPosition] = 1;
    const voteString = voteArray.join(",");

    executeCommand(
      `pnpm cli fellowship game vote ${fellowshipId} ${gameId} "${voteString}" -i ${voter} --gm-key "${process.env.GM_KEY}"`,
      `Player ${voter} voting for proposal at position ${targetPosition} (originally from player ${targetProposer})`
    );
  }

  executeCommand(`pnpm cli blockchain mine -t ${votingPeriod}`, "Mining blockchain");
  executeCommand(
    `pnpm cli fellowship game end-voting ${fellowshipId} ${gameId} --gm-key "${process.env.GM_KEY}"`,
    "Ending voting phase"
  );

  // Proposals for turn 3
  for (let i = 0; i <= 4; i++) {
    executeCommand(
      `pnpm cli fellowship game propose ${fellowshipId} ${gameId} -i ${i} --gm-key "${process.env.GM_KEY}" -t "Dummy data" -b "<p>Dummy data</p>"`,
      `Turn 3 Proposal ${i + 1}`
    );
  }

  executeCommand(`pnpm cli blockchain mine -t ${proposingPeriod}`, "Mining blockchain");
  executeCommand(
    `pnpm cli fellowship game end-proposing ${fellowshipId} ${gameId} --gm-key "${process.env.GM_KEY}"`,
    "Ending proposing phase"
  );
}

/**
 * Main function to run the demo script playbook
 * Can be called directly or imported by other modules
 */
export async function runDemoScript(args: string[], gameMaster: GameMaster): Promise<void> {
  if (args.length < 2) {
    console.log("Usage: runDemoScript <fellowshipId> <instanceAddress>");
    console.log("  fellowshipId: number - fellowship ID");
    console.log("  instanceAddress: address - Rankify instance address");
    console.log("Note: Game ID will be automatically captured from the create command");
    throw new Error("Invalid arguments");
  }

  const fellowshipId = parseInt(args[0]);
  const instanceAddress = args[1] as Address;

  console.log(`Running demo script with fellowship ${fellowshipId}, instance ${instanceAddress}`);
  console.log(`Using GameMaster: ${gameMaster.walletClient.account?.address}`);

  await runPart1(fellowshipId, instanceAddress, gameMaster);

  logSuccess("Demo script completed successfully!");
}

function main() {
  console.log("This script should be run through cliPlaybooks.sh which provides the GameMaster instance");
  console.log("Usage: ./cliPlaybooks.sh demo-script <fellowshipId> <instanceAddress>");
  process.exit(1);
}

if (require.main === module) {
  main();
}
