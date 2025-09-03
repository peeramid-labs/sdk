import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { MAODistributorClient } from "../../../rankify/MAODistributor";
import { createPublic } from "../../client";
import EnvioGraphQLClient from "../../../utils/EnvioGraphQLClient";

export const listCommand = new Command("list")
  .description("List all distributions")
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .option(
    "-d, --distributor <address>",
    "Distributor address, or env DISTRIBUTOR_ADDRESS. If none provided, will attempt to resolve from known chainId artifacts"
  )
  .option(
    "-e, --envio <url>",
    "Envio GraphQL endpoint URL. If not provided, http://localhost:8080/v1/graphql will be used. Alternatively INDEXER_URL environment variable may be used",
    "http://localhost:8080/v1/graphql"
  )
  .action(async (options) => {
    const spinner = ora("Initializing client...").start();

    try {
      const publicClient = await createPublic(options.rpc);
      const chainId = Number(await publicClient.getChainId());

      console.log(`Chain ID: ${chainId}`);
      console.log(`Envio endpoint: ${process.env.INDEXER_URL ?? options.envio}`);

      const maoDistributor = new MAODistributorClient(
        chainId,
        {
          publicClient,
          envioClient: new EnvioGraphQLClient({
            endpoint: process.env.INDEXER_URL ?? options.envio,
          }),
        },
        options.distributor || process.env.DISTRIBUTOR_ADDRESS
      );

      spinner.text = "Fetching distributions...";
      const distributions = await maoDistributor.getDistributions();

      if (distributions.length === 0) {
        spinner.info("No distributions found");
        return;
      }

      spinner.succeed(`Found ${distributions.length} distribution(s)`);

      console.log("\nDistributions:");
      distributions.forEach((distribution, index) => {
        console.log(chalk.blue(`\nDistribution #${index + 1}:`));
        console.log(chalk.green(`ID: ${distribution}`));
      });
    } catch (error) {
      spinner.fail("Failed to list distributions");
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });
