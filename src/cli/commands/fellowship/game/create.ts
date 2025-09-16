import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { getAddress } from "viem";
import { createPublic, createWallet } from "../../../client";
import RankifyPlayer from "../../../../rankify/Player";
import { resolvePk } from "../../../getPk";
import { CLIUtils } from "../../../utils";
import EnvioGraphQLClient from "../../../../utils/EnvioGraphQLClient";

export const create = new Command("create")
  .description("Create a new game in a Rankify instance")
  .argument("<instance>", "Address or instanceId of the Rankify instance")
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .option("-i, --m-index <mnemonicIndex>", "Index to derive from mnemonic")
  .option(
    "-k, --key <privateKey>",
    "Will be used if no mnemonic index is provided. Private key with admin permissions. If not provided, PRIVATE_KEY environment variable will be used"
  )
  .option("--gm <address>", "Game master address", "0xaA63aA2D921F23f204B6Bcb43c2844Fb83c82eb9")
  .option("--rank <number>", "Game rank", "1")
  .option("--max-players <number>", "Maximum number of players", "9")
  .option("--min-players <number>", "Minimum number of players", "5")
  .option("--min-game-time <seconds>", "Minimum game time in seconds", "3600")
  .option("--turns <number>", "Number of turns", "5")
  .option("--time-per-turn <seconds>", "Time per turn in seconds", "3000")
  .option("--voting-period <seconds>", "Voting period in seconds", "1500")
  .option("--proposing-period <seconds>", "Proposing period in seconds", "1500")
  .option("--vote-credits <number>", "Vote credits per player", "14")
  .option("--time-to-join <seconds>", "Time to join in seconds", "1800")
  .option("--metadata <string>", "Game metadata (ipfs url)", "ipfs://QmXLnWFvdbVzbHN3dqbhfnPPPtHSiKxx2B8gySLaRHhFmW")
  .option(
    "-e, --envio <url>",
    "Envio GraphQL endpoint URL. If not provided, http://localhost:8080/v1/graphql will be used. Alternatively INDEXER_URL environment variable may be used",
    "http://localhost:8080/v1/graphql"
  )
  .option("-d, --distribution-name <name>", "Distribution name", "MAO Distribution")
  .action(async (instanceAddress, options) => {
    const spinner = ora("Initializing clients...").start();

    try {
      const publicClient = await createPublic(options.rpc);
      const walletClient = await createWallet(options.rpc, resolvePk(options.mIndex ?? options.key, spinner));

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

      spinner.text = "Checking chain support and preparing token approval...";

      // Check if chain is supported, if not prepare override artifact for token approval
      const overrideArtifact = await CLIUtils.overrideArtifact(
        chainId,
        "Rankify",
        resolvedInstanceAddress,
        publicClient,
        spinner
      );

      spinner.text = "Creating and opening game...";

      const params = {
        gameRank: BigInt(options.rank),
        minPlayerCnt: BigInt(options.minPlayers),
        maxPlayerCnt: BigInt(options.maxPlayers),
        nTurns: BigInt(options.turns),
        voteCredits: BigInt(options.voteCredits),
        gameMaster: getAddress(options.gm),
        minGameTime: BigInt(options.minGameTime),
        timePerTurn: BigInt(options.timePerTurn),
        timeToJoin: BigInt(options.timeToJoin),
        metadata: options.metadata || "{}",
        votePhaseDuration: BigInt(options.votingPeriod),
        proposingPhaseDuration: BigInt(options.proposingPeriod),
      };

      const requirements = {
        ethValues: {
          have: 0n,
          lock: 0n,
          burn: 0n,
          pay: 0n,
          bet: 0n,
        },
        contracts: [],
      };

      const gameId = await player.createAndOpenGame(params, requirements, overrideArtifact);

      spinner.succeed("Game created and opened successfully");

      console.log(chalk.green(`\nGame created with ID: ${gameId.toString()}`));
    } catch (error) {
      spinner.fail("Failed to create game");
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message + "\n" + error.stack : String(error)}`));
      process.exit(1);
    }
  });
