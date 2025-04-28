import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { type Address, Hex, bytesToHex, encodePacked, hexToBytes, keccak256 } from "viem";
import { createPublic, createWallet } from "../../../client";
import RankifyPlayer from "../../../../rankify/Player";
import { resolvePk } from "../../../getPk";
import GameMaster from "../../../../rankify/GameMaster";
import { CLIUtils } from "../../../utils";
import * as secp256k1 from "@noble/secp256k1";
import EnvioGraphQLClient from "../../../../utils/EnvioGraphQLClient";

export const join = new Command("join")
  .description("Join an existing game in a Rankify instance")
  .argument("<instance>", "Address or instanceId of the Rankify instance")
  .argument("<gameId>", "ID of the game to join")
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .option("-i, --m-index <mnemonicIndex>", "Index to derive from mnemonic")
  .option(
    "-k, --key <privateKey>",
    "Private key or index to derive from mnemonic for signing transactions. Will be used if no mnemonic index is provided. If both not provided, PRIVATE_KEY environment variable will be used"
  )
  .option("-n, --distribution-name <name>", "Distribution name", "MAO Distribution")
  .option("-e, --envio <url>", "Envio GraphQL endpoint URL. If not provided, http://localhost:8080/v1/graphql will be used. Alternatively INDEXER_URL environment variable may be used", "http://localhost:8080/v1/graphql")
  .action(async (instanceAddress, gameId, options) => {
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

      const gmWalletClient = await createWallet(options.rpc);

      const gameMaster = new GameMaster({
        walletClient: gmWalletClient,
        publicClient,
        chainId,
        envioClient,
      });

      spinner.text = "Getting public key...";

      const privateKeyBytes = hexToBytes(resolvePk(options.mIndex ?? options.key, spinner) as Hex);
      const publicKeyBytes = secp256k1.getPublicKey(privateKeyBytes, false);
      const publicKey = bytesToHex(publicKeyBytes) as Hex;
      const gameIdBigInt = BigInt(gameId);

      spinner.text = "Validating game join eligibility...";
      const { result: isValid, errorMessage } = await gameMaster.validateJoinGame({
        instanceAddress: resolvedInstanceAddress,
        gameId: gameIdBigInt,
        participant: account,
      });

      if (!isValid) {
        spinner.fail(`Cannot join game: ${errorMessage}`);
        process.exit(1);
      }

      spinner.text = "Getting attestation from game master...";
      const blockTimestamp = await publicClient.getBlock({ blockTag: "latest" }).then((block) => block.timestamp);
      const timeToJoin = Number(blockTimestamp) + 60 * 10; // 10 minutes to join

      console.log({
        instanceAddress: resolvedInstanceAddress,
        gameId: gameIdBigInt,
        participant: account,
        participantPubKeyHash: keccak256(encodePacked(["string"], [publicKey])),
      });

      const { signature: gmSignature, gmCommitment, deadline } = await gameMaster.signJoiningGame(
        {
          instanceAddress: resolvedInstanceAddress,
          gameId: gameIdBigInt,
          participant: account,
          participantPubKeyHash: keccak256(encodePacked(["string"], [publicKey])),
        },
        timeToJoin
      );

      spinner.text = "Joining game...";
      const receipt = await player.joinGame({
        gameId: gameIdBigInt,
        signature: gmSignature as Address,
        gmCommitment: gmCommitment as Hex,
        deadline: Number(deadline),
        pubkey: publicKey,
      });

      spinner.succeed("Successfully joined the game");
      console.log(chalk.green(`\nJoined game with ID: ${gameIdBigInt.toString()}`));
      console.log(chalk.dim("Transaction hash:"), receipt.transactionHash);

    } catch (error) {
      spinner.fail("Failed to join game");
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message + "\n" + error.stack : String(error)}`));
      process.exit(1);
    }
  });
