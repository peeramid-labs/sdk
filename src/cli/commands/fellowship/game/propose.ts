import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { createPublic, createWallet } from "../../../client";
import { resolvePk } from "../../../getPk";
import GameMaster from "../../../../rankify/GameMaster";
import { CLIUtils } from "../../../utils";
import InstanceBase from "../../../../rankify/InstanceBase";
import RankifyPlayer from "../../../../rankify/Player";
import { Address, Hex, bytesToHex, hexToBytes } from "viem";
import * as secp256k1 from "@noble/secp256k1";
import { gameStatusEnum } from "../../../../types";
import EnvioGraphQLClient from "../../../../utils/EnvioGraphQLClient";

export const propose = new Command("propose")
  .description("Submit a proposal for a game turn")
  .argument("<instance>", "Address or index of the Rankify instance")
  .argument("<gameId>", "ID of the game to propose for")
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .option("-i, --m-index <mnemonicIndex>", "Index to derive from mnemonic")
  .option(
    "-k, --key <privateKey>",
    "Private key if no mnemonic index is provided. If both not provided, PRIVATE_KEY environment variable will be used"
  )
  .option(
    "-g, --gm-key <privateKey>",
    "Game master private key for signing attestations. If not provided, PRIVATE_KEY environment variable will be used"
  )
  .option("-t, --title <title>", "Title of the proposal", "Default title")
  .option("-b, --body <body>", "Body content of the proposal", "Default body")
  .option("-f, --file <filePath>", "Path to a markdown file containing the proposal content")
  .option(
    "-e, --envio <url>",
    "Envio GraphQL endpoint URL. If not provided, http://localhost:8080/v1/graphql will be used. Alternatively INDEXER_URL environment variable may be used",
    "http://localhost:8080/v1/graphql"
  )
  .option("-d, --distribution-name <name>", "Distribution name", "MAO Distribution")
  .action(async (instanceAddress, gameId, options) => {
    const spinner = ora("Initializing clients...").start();
    try {
      // Initialize clients
      const publicClient = await createPublic(options.rpc);
      const privateKey = resolvePk(options.mIndex ?? options.key, spinner);
      const walletClient = await createWallet(options.rpc, privateKey);
      const chainId = Number(await publicClient.getChainId());
      const account = walletClient.account?.address;
      const envioClient = new EnvioGraphQLClient({
        endpoint: process.env.INDEXER_URL ?? options.envio,
      });
      if (!account) {
        spinner.fail("No account available");
        throw new Error("No account available");
      }

      // Resolve instance address
      const resolvedInstanceAddress = await CLIUtils.resolveInstanceAddress(
        instanceAddress,
        chainId,
        publicClient,
        envioClient,
        options.distributionName,
        spinner
      );

      // Create game master client
      spinner.text = "Creating game master client...";
      const gmWalletClient = await createWallet(options.rpc, options.gmKey);

      const gameMaster = new GameMaster({
        walletClient: gmWalletClient,
        publicClient,
        chainId,
        envioClient,
      });

      // Create player client
      spinner.text = "Creating player client...";
      const player = new RankifyPlayer({
        publicClient,
        walletClient,
        chainId,
        instanceAddress: resolvedInstanceAddress,
        account,
        envioClient,
      });

      // Get game state to check if proposal can be submitted
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

      // Check if game is in a valid state for proposals
      if (
        gameState.gamePhase !== gameStatusEnum.started &&
        gameState.gamePhase !== gameStatusEnum.lastTurn &&
        gameState.gamePhase !== gameStatusEnum.overtime
      ) {
        spinner.fail("Game is not in an active phase that accepts proposals");
        console.error(chalk.red(`Game phase: ${gameState.gamePhase}`));
        process.exit(1);
      }

      // Check if the player is part of the game
      if (!gameState.players.includes(account as Address)) {
        spinner.fail("You are not a player in this game");
        process.exit(1);
      }

      // Get proposal content
      let title = options.title;
      let body = options.body;

      // Validate proposal content
      if (!title || !body) {
        spinner.fail("Proposal must have both title and body content");
        console.log(chalk.yellow("Provide content using --title and --body options, or --file option"));
        process.exit(1);
      }

      // Format the proposal as JSON
      const proposalContent = JSON.stringify({
        title,
        body,
      });

      // Derive public key from private key
      const privateKeyBytes = hexToBytes(privateKey as Hex);
      const publicKeyBytes = secp256k1.getPublicKey(privateKeyBytes, false);
      const publicKey = bytesToHex(publicKeyBytes) as Hex;

      console.log(`Attesting proposal...`);
      console.log({
        instanceAddress: resolvedInstanceAddress,
        gameId: gameIdBigInt,
        proposal: proposalContent,
        proposerPubKey: publicKey,
        turn: gameState.currentTurn,
      });

      // Attest the proposal
      spinner.text = "Attesting proposal...";
      const { submissionParams } = await gameMaster.attestProposal({
        instanceAddress: resolvedInstanceAddress,
        gameId: gameIdBigInt,
        proposal: proposalContent,
        proposerPubKey: publicKey,
        turn: gameState.currentTurn,
      });

      // Sign the proposal commitment
      spinner.text = "Signing proposal commitment...";
      const proposerSignature = await player.signProposalCommitment(submissionParams);

      // Submit the proposal
      spinner.text = "Submitting proposal...";
      const txHash = await gameMaster.submitProposal({
        instanceAddress: resolvedInstanceAddress,
        submissionParams,
        proposerSignature,
      });

      // Wait for transaction receipt
      spinner.text = "Waiting for transaction confirmation...";
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      spinner.succeed("Proposal submitted successfully");
      console.log(
        chalk.green(
          `\nProposal submitted for game ${gameIdBigInt.toString()}, turn ${gameState.currentTurn.toString()}`
        )
      );
      console.log(chalk.dim("Transaction hash:"), receipt.transactionHash);
      console.log(chalk.dim("Title:"), title);
      console.log(chalk.dim("Body preview:"), body.length > 100 ? body.substring(0, 100) + "..." : body);
    } catch (error) {
      spinner.fail("Failed to submit proposal");
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message + "\n" + error.stack : String(error)}`));
      process.exit(1);
    }
  });
