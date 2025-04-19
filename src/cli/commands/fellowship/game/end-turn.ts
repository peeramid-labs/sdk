import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { createPublic, createWallet } from "../../../client";
import GameMaster from "../../../../rankify/GameMaster";
import { CLIUtils } from "../../../utils";
import EnvioGraphQLClient from "../../../../utils/EnvioGraphQLClient";

export const endTurn = new Command("end-turn")
  .description("End turn in a game")
  .argument("<instance>", "Address or instanceId of the Rankify instance")
  .argument("<game>", "Index of the game")
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .option(
    "-k, --key <privateKey>",
    "Private key for signing transactions. If not provided, PRIVATE_KEY environment variable will be used"
  )
  .action(async (instanceAddress, gameId, options) => {
    const spinner = ora("Initializing clients...").start();

    try {
      const publicClient = await createPublic(options.rpc);
      const walletClient = await createWallet(options.rpc, options.key);
      const chainId = Number(await publicClient.getChainId());
      const envioClient = new EnvioGraphQLClient({
        endpoint: process.env.INDEXER_URL ?? options.envio,
      });

      const gameMaster = new GameMaster({
        publicClient,
        walletClient,
        chainId,
        envioClient,
      });

      spinner.start("Ending turn...");

      const resolvedInstanceAddress = await CLIUtils.resolveInstanceAddress(
        instanceAddress,
        chainId,
        publicClient,
        envioClient,
        spinner
      );

      const hash = await gameMaster.endTurn({ instanceAddress: resolvedInstanceAddress, gameId: BigInt(gameId) });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(receipt);
      spinner.stop();
    } catch (error) {
      spinner.fail("Failed to end turn");
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message + "\n" + error.stack : String(error)}`));
      process.exit(1);
    }
  });
