import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { createPublic, createWallet } from "../../../client";
import GameMaster from "../../../../rankify/GameMaster";
import { CLIUtils } from "../../../utils";
import EnvioGraphQLClient from "../../../../utils/EnvioGraphQLClient";

export const forceEndStale = new Command("force-end-stale")
  .description("Force end a stale game that is stuck in proposing phase")
  .argument("<instance>", "Address or instanceId of the Rankify instance")
  .argument("<game>", "Index of the game")
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .option(
    "-k, --key <privateKey>",
    "Private key for signing transactions. If not provided, PRIVATE_KEY environment variable will be used"
  )
  .option("-d, --distribution-name <n>", "Distribution name", "MAO Distribution")
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

      const gameMaster = new GameMaster({
        walletClient,
        publicClient,
        chainId,
        envioClient,
      });

      spinner.text = "Force ending stale game...";

      // Note: This function will need to be implemented once the ABI is updated
      console.log(chalk.yellow("Note: forceEndStaleGame function not yet available in current ABI version."));
      console.log(chalk.yellow("Please update ABI when new contract is deployed."));
      console.log(chalk.red("Command not yet functional - requires updated contract ABI."));

      // Placeholder for future implementation:
      // const { hash } = await gameMaster.forceEndStaleGame({ instanceAddress: resolvedInstanceAddress, gameId: BigInt(gameId) });
      // const receipt = await publicClient.waitForTransactionReceipt({ hash });
      //
      // spinner.succeed("Stale game ended successfully");
      // console.log(chalk.green(`\nTransaction hash: ${receipt.transactionHash}`));

      spinner.fail("Command not yet available");
      process.exit(1);
    } catch (error) {
      spinner.fail("Failed to force end stale game");
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message + "\n" + error.stack : String(error)}`));
      process.exit(1);
    }
  });
