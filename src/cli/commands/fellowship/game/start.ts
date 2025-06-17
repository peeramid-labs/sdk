import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { createPublic, createWallet } from "../../../client";
import RankifyPlayer from "../../../../rankify/Player";
import { resolvePk } from "../../../getPk";
import GameMaster from "../../../../rankify/GameMaster";
import { CLIUtils } from "../../../utils";
import InstanceBase from "../../../../rankify/InstanceBase";
import { gameStatusEnum } from "../../../../types";
import { BlockchainUtils } from "../../../../utils/blockchain";
import EnvioGraphQLClient from "../../../../utils/EnvioGraphQLClient";

export const start = new Command("start")
  .description("Start a game in a Rankify instance")
  .argument("<instance>", "Address or index of the Rankify instance")
  .argument("<gameId>", "ID of the game to start")
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .option("-i, --mIndex <mnemonicIndex>", "Index to derive from mnemonic")
  .option(
    "-k, --key <privateKey>",
    "Private key or index to derive from mnemonic for signing transactions. If not provided, PRIVATE_KEY environment variable will be used"
  )
  .option(
    "-g, --gm-key <privateKey>",
    "Game master private key for signing attestations. If not provided, GM_KEY environment variable will be used"
  )
  .option("--auto-mine", "Automatically mine blocks to advance time on local chains (default: true)", false)
  .option(
    "-e, --envio <url>",
    "Envio GraphQL endpoint URL. If not provided, http://localhost:8080/v1/graphql will be used. Alternatively INDEXER_URL environment variable may be used",
    "http://localhost:8080/v1/graphql"
  )
  .option("-d, --distribution-name <name>", "Distribution name", "MAO Distribution")
  .action(async (instanceAddress, gameId, options) => {
    const spinner = ora("Initializing clients...").start();

    try {
      const publicClient = await createPublic(options.rpc);
      const walletClient = await createWallet(options.rpc, resolvePk(options.mIndex ?? options.mIndex, spinner));
      const chainId = Number(await publicClient.getChainId());
      const envioClient = new EnvioGraphQLClient({
        endpoint: process.env.INDEXER_URL ?? options.envio,
      });
      const resolvedInstanceAddress = await CLIUtils.resolveInstanceAddress(
        instanceAddress,
        chainId,
        publicClient,
        envioClient,
        options.distributionName,
        spinner
      );

      spinner.text = "Creating Rankify player client...";
      const account = walletClient.account?.address;

      if (!account) {
        spinner.fail("No account available");
        throw new Error("No account available");
      }

      const player = new RankifyPlayer({
        publicClient,
        walletClient,
        chainId,
        instanceAddress: resolvedInstanceAddress,
        account,
        envioClient,
      });

      const gmWalletClient = await createWallet(options.rpc, options.gmKey);

      const gameMaster = new GameMaster({
        walletClient: gmWalletClient,
        publicClient,
        chainId,
        envioClient,
      });

      // Get the game state to check if it can be started and get the number of players
      spinner.text = "Getting game state...";
      const gameIdBigInt = BigInt(gameId);

      // Create a base instance to check the game state
      const baseInstance = new InstanceBase({
        instanceAddress: resolvedInstanceAddress,
        publicClient,
        chainId,
        envioClient,
      });
      const gameState = await baseInstance.getGameStateDetails(gameIdBigInt);

      if (gameState.gamePhase !== gameStatusEnum.open) {
        spinner.fail("Game is not in the open phase and cannot be started");
        console.error(chalk.red(`Game phase: ${gameState.gamePhase}`));
        process.exit(1);
      }

      if (gameState.players.length < Number(gameState.minPlayerCnt)) {
        spinner.fail("Not enough players to start the game");
        console.error(
          chalk.red(`Current players: ${gameState.players.length}, Minimum required: ${gameState.minPlayerCnt}`)
        );
        process.exit(1);
      }

      // Check if we're on a local chain and should auto-mine blocks to advance time
      const isLocalChain = BlockchainUtils.isLocalChain(chainId);
      if (isLocalChain && options.autoMine) {
        spinner.text = "Checking if we need to advance time...";

        // Get current block timestamp
        const currentBlock = await publicClient.getBlock({ blockTag: "latest" });
        const currentTimestamp = Number(currentBlock.timestamp);
        const timeToJoin = Number(gameState.timeToJoin);

        // Calculate when the game was created and when it can be started
        const registrationOpenAt = Number(gameState.registrationOpenAt);
        const startTimeCalculated = registrationOpenAt + timeToJoin;

        // If the current time is before the start time, we need to mine blocks
        if (currentTimestamp < startTimeCalculated) {
          const timeNeeded = startTimeCalculated - currentTimestamp + 1; // Add 1 second buffer

          spinner.info(`Game can be started at ${new Date(startTimeCalculated * 1000).toLocaleString()}`);
          spinner.info(`Current blockchain time is ${new Date(currentTimestamp * 1000).toLocaleString()}`);
          spinner.info(`Need to advance time by ${timeNeeded} seconds to start the game`);

          // Mine blocks to advance time
          const result = await BlockchainUtils.increaseTimeAndMine(publicClient, timeNeeded, spinner);

          spinner.succeed(`Advanced blockchain time by ${result.actualIncrease} seconds`);
          spinner.start("Starting game...");
        }
      }

      // Generate deterministic permutation
      spinner.text = "Generating deterministic permutation...";
      await gameMaster.generateDeterministicPermutation({
        gameId: gameIdBigInt,
        turn: 0n,
        size: gameState.players.length,
        verifierAddress: resolvedInstanceAddress,
      });

      // Start the game
      spinner.text = "Starting game...";
      const receipt = await player.startGame(gameIdBigInt);

      spinner.succeed("Game started successfully");
      console.log(chalk.green(`\nStarted game with ID: ${gameIdBigInt.toString()}`));
      console.log(chalk.dim("Transaction hash:"), receipt.transactionHash);
    } catch (error) {
      spinner.fail("Failed to start game");
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message + "\n" + error.stack : String(error)}`));
      process.exit(1);
    }
  });
