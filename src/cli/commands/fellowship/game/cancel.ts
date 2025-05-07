import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { getAddress } from "viem";
import { createPublic, createWallet } from "../../../client";
import Player from "../../../../rankify/Player";
import { EnvioGraphQLClient } from "../../../../utils/EnvioGraphQLClient";

export const cancel = new Command("cancel")
  .description("Cancel a game")
  .argument("<instance>", "Address of the Rankify instance")
  .argument("<game>", "Index of the game")
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .option(
    "-k, --key <privateKey>",
    "Private key for signing transactions. If not provided, PRIVATE_KEY environment variable will be used"
  )
  .option(
    "-e, --envio <url>",
    "Envio GraphQL endpoint URL. If not provided, http://localhost:8080/v1/graphql will be used. Alternatively INDEXER_URL environment variable may be used",
    "http://localhost:8080/v1/graphql"
  )
  .action(async (instanceAddress, gameId, options) => {
    const spinner = ora("Initializing clients...").start();

    try {
      const publicClient = await createPublic(options.rpc);
      const walletClient = await createWallet(options.rpc, options.key);
      const chainId = Number(await publicClient.getChainId());
      if (!walletClient.account) throw new Error("No account found");

      const envioClient = new EnvioGraphQLClient({
        endpoint: process.env.INDEXER_URL ?? options.envio,
      });

      const player = new Player({
        publicClient,
        walletClient,
        chainId,
        instanceAddress: getAddress(instanceAddress),
        account: walletClient.account.address,
        envioClient,
      });

      spinner.start("Canceling thread...");

      const receipt = await player.cancelGame(BigInt(gameId));
      console.log(receipt);
      spinner.stop();
    } catch (error) {
      spinner.fail("Failed to cancel game");
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message + "\n" + error.stack : String(error)}`));
      process.exit(1);
    }
  });
