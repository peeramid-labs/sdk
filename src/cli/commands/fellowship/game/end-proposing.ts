import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { createPublic, createWallet } from "../../../client";
import GameMaster from "../../../../rankify/GameMaster";
import { CLIUtils } from "../../../utils";
import EnvioGraphQLClient from "../../../../utils/EnvioGraphQLClient";

export const endProposing = new Command("end-proposing")
  .description("End proposing phase in a game")
  .argument("<instance>", "Address or instanceId of the Rankify instance")
  .argument("<game>", "Index of the game")
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .option(
    "-k, --gm-key <privateKey>",
    "Private key for signing transactions. If not provided, PRIVATE_KEY environment variable will be used"
  )
  .option("-d, --distribution-name <name>", "Distribution name", "MAO Distribution")
  .option(
    "-e, --envio <url>",
    "Envio GraphQL endpoint URL. If not provided, http://localhost:8080/v1/graphql will be used. Alternatively INDEXER_URL environment variable may be used",
    "http://localhost:8080/v1/graphql"
  )
  .action(async (instanceAddress, gameId, options) => {
    const spinner = ora("Initializing clients...").start();

    try {
      const publicClient = await createPublic(options.rpc);
      const walletClient = await createWallet(options.rpc, options.gmKey);
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

      spinner.text = "Ending proposing phase...";
      const { hash } = await gameMaster.endProposing({
        instanceAddress: resolvedInstanceAddress,
        gameId: BigInt(gameId),
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      spinner.succeed("Proposing phase ended successfully");
      console.log(chalk.green(`\nTransaction hash: ${receipt.transactionHash}`));
    } catch (error) {
      spinner.fail("Failed to end proposing phase");
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message + "\n" + error.stack : String(error)}`));
      process.exit(1);
    }
  });
