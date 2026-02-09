import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import {
  type Address,
  Hex,
  bytesToHex,
  encodePacked,
  hexToBytes,
  keccak256,
  erc20Abi,
  maxUint256,
  ContractFunctionReturnType,
} from "viem";
import { createPublic, createWallet } from "../../../client";
import RankifyPlayer from "../../../../rankify/Player";
import { resolvePk } from "../../../getPk";
import GameMaster from "../../../../rankify/GameMaster";
import { CLIUtils } from "../../../utils";
import * as secp256k1 from "@noble/secp256k1";
import EnvioGraphQLClient from "../../../../utils/EnvioGraphQLClient";
import instanceAbi from "../../../../abis/RankifyDiamondInstance";
import { ContractTypes } from "../../../../types";

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
  .option(
    "-g, --gm-key <privateKey>",
    "Private key for signing transactions. If not provided, PRIVATE_KEY environment variable will be used"
  )
  .option("-n, --distribution-name <name>", "Distribution name", "MAO Distribution")
  .option(
    "-e, --envio <url>",
    "Envio GraphQL endpoint URL. If not provided, http://localhost:8080/v1/graphql will be used. Alternatively INDEXER_URL environment variable may be used",
    "http://localhost:8080/v1/graphql"
  )
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

      const gmWalletClient = await createWallet(options.rpc, options.gmKey || process.env.GM_KEY);

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

      const {
        signature: gmSignature,
        gmCommitment,
        deadline,
      } = await gameMaster.signJoiningGame(
        {
          instanceAddress: resolvedInstanceAddress,
          gameId: gameIdBigInt,
          participant: account,
          participantPubKeyHash: keccak256(encodePacked(["string"], [publicKey])),
        },
        timeToJoin
      );

      const ensureTokenBalanceAndAllowance = async (tokenAddress: Address, requiredAmount: bigint) => {
        if (!walletClient.account?.address) throw new Error("No account available");
        if (requiredAmount <= 0n) return;

        const [balance, allowance] = await Promise.all([
          publicClient.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [walletClient.account.address],
          }),
          publicClient.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: "allowance",
            args: [walletClient.account.address, resolvedInstanceAddress],
          }),
        ]);

        if (balance < requiredAmount) {
          if (!gmWalletClient.account?.address) {
            throw new Error("GM wallet account not configured for payment token transfer");
          }
          const shortfall = requiredAmount - balance;
          spinner.info(`Transferring ${shortfall.toString()} tokens from GM wallet to player for ${tokenAddress}`);
          const { request } = await publicClient.simulateContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: "transfer",
            args: [walletClient.account.address, shortfall],
            account: gmWalletClient.account,
          });
          const transferHash = await gmWalletClient.writeContract(request);
          await publicClient.waitForTransactionReceipt({ hash: transferHash });
          spinner.info(`Payment token transfer completed (tx: ${transferHash})`);
        }

        if (allowance < requiredAmount) {
          spinner.info(`Approving payment token ${tokenAddress} for Rankify instance`);
          const { request } = await publicClient.simulateContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: "approve",
            args: [resolvedInstanceAddress, maxUint256],
            account: walletClient.account,
          });
          const approvalHash = await walletClient.writeContract(request);
          await publicClient.waitForTransactionReceipt({ hash: approvalHash });
          spinner.info(`Approval transaction completed (tx: ${approvalHash})`);
        }
      };

      const ensureErc20Requirements = async () => {
        const joinRequirements = (await publicClient.readContract({
          address: resolvedInstanceAddress,
          abi: instanceAbi,
          functionName: "getJoinRequirements",
          args: [gameIdBigInt],
        })) as ContractFunctionReturnType<typeof instanceAbi, "view", "getJoinRequirements">;

        const contractAddresses = Array.from(joinRequirements.contractAddresses ?? []);
        const contractIds = Array.from(joinRequirements.contractIds ?? []);
        const contractTypes = Array.from(joinRequirements.contractTypes ?? []);

        const requirementsPerContract = await Promise.all(
          contractAddresses.map((address, idx) =>
            publicClient.readContract({
              address: resolvedInstanceAddress,
              abi: instanceAbi,
              functionName: "getJoinRequirementsByToken",
              args: [gameIdBigInt, address, contractIds[idx] ?? 0n, contractTypes[idx] ?? 0n],
            })
          )
        );

        for (let idx = 0; idx < contractAddresses.length; idx++) {
          const tokenAddress = contractAddresses[idx];
          const contractType = contractTypes[idx];
          if (!tokenAddress || contractType === undefined) continue;
          if (Number(contractType) !== ContractTypes.ERC20) continue;
          const requirementDetails = requirementsPerContract[idx];
          const payAmount = requirementDetails?.pay?.amount ?? 0n;
          if (payAmount <= 0n) continue;
          await ensureTokenBalanceAndAllowance(tokenAddress as Address, payAmount);
        }
      };

      spinner.text = "Preparing payment tokens...";
      await ensureErc20Requirements();

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
