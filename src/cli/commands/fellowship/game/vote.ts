import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { type Hex } from "viem";
import { createPublic, createWallet } from "../../../client";
import { resolvePk } from "../../../getPk";
import GameMaster from "../../../../rankify/GameMaster";
import { CLIUtils } from "../../../utils";
import InstanceBase from "../../../../rankify/InstanceBase";
import RankifyPlayer from "../../../../rankify/Player";
import EnvioGraphQLClient from "../../../../utils/EnvioGraphQLClient";

export const vote = new Command("vote")
  .description("Submit a vote in a Rankify game")
  .argument("<instance>", "Address or instanceId of the Rankify instance")
  .argument("<gameId>", "ID of the game to vote in")
  .argument("<votes>", "Comma-separated list of vote values (e.g. 5,3,0,2,4)")
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .option("-i, --m-index <mnemonicIndex>", "Index to derive from mnemonic")
  .option(
    "-k, --key <privateKey>",
    "Private key or index to derive from mnemonic for signing transactions. If not provided, PRIVATE_KEY environment variable will be used"
  )
  .option("-e, --envio <url>", "Envio GraphQL endpoint URL. If not provided, http://localhost:8080/v1/graphql will be used. Alternatively INDEXER_URL environment variable may be used", "http://localhost:8080/v1/graphql")
  .action(async (instanceAddress, gameId, votesStr, options) => {
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
        spinner
      );

      spinner.text = "Creating Rankify clients...";
      const account = walletClient.account?.address;

      if (!account) {
        spinner.fail("No account available");
        throw new Error("No account available");
      }

       // Create game master client
       spinner.text = "Creating game master client...";
       const gmWalletClient = await createWallet(options.rpc);

       const gameMaster = new GameMaster({
         walletClient: gmWalletClient,
         publicClient,
         chainId,
         envioClient,
       });

      const player = new RankifyPlayer({
        publicClient,
        walletClient,
        chainId,
        instanceAddress: resolvedInstanceAddress,
        account,
        envioClient,
      });

      // Create an instance of InstanceBase to get game state details
      const instanceBase = new InstanceBase({
        instanceAddress: resolvedInstanceAddress,
        publicClient,
        chainId,
        envioClient,
      });

      // Parse votes from comma-separated string
      const voteValues = votesStr.split(",").map((v: string) => BigInt(v.trim()));
      const gameIdBigInt = BigInt(gameId);

      // Get current game state to determine turn if not specified
      spinner.text = "Getting game state...";
      const currentTurn = await instanceBase.getCurrentTurn(gameIdBigInt);

      spinner.text = "Attesting vote...";
      console.log("Attesting vote...", {
        voter: account,
        gameId: gameIdBigInt,
        turn: currentTurn,
        vote: voteValues,
        verifierAddress: resolvedInstanceAddress,
      });

      const attestation = await gameMaster.attestVote({
        voter: account,
        gameId: gameIdBigInt,
        turn: currentTurn,
        vote: voteValues,
        verifierAddress: resolvedInstanceAddress,
      });

      console.log("Attestation:", attestation);

      spinner.text = "Signing vote...";

      const voterSignature = await player.authorizeVoteSubmission({
        gameId: gameIdBigInt,
        vote: voteValues,
        verifierAddress: resolvedInstanceAddress,
        playerSalt: attestation.ballot.salt,
        ballotId: attestation.ballotId,
      });
      console.log("Voter signature:", voterSignature);

      spinner.text = "Submitting vote...";
      // Submit vote to the contract using GameMaster
      const txHash = await gameMaster.submitVote({
        instanceAddress: resolvedInstanceAddress,
        gameId: gameIdBigInt,
        vote: voteValues,
        voter: account,
        voterSignature,
        ballotHash: attestation.ballotHash as Hex,
        ballotId: attestation.ballotId,
      });

      // Wait for transaction receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      spinner.succeed("Vote submitted successfully");
      console.log(chalk.green(`\nVoted in game with ID: ${gameIdBigInt.toString()}`));
      console.log(chalk.green(`Turn: ${currentTurn.toString()}`));
      console.log(chalk.green(`Vote values: ${voteValues.join(", ")}`));
      console.log(chalk.dim("Transaction hash:"), receipt.transactionHash);

    } catch (error) {
      spinner.fail("Failed to submit vote");
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message + "\n" + error.stack : String(error)}`));
      process.exit(1);
    }
  });
