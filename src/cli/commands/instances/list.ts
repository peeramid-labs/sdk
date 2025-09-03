import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { MAODistributorClient } from "../../../rankify/MAODistributor";
import { createPublic } from "../../client";
import { parseInstantiated } from "../../../utils";
import { getAddress } from "viem";
import EnvioGraphQLClient from "../../../utils/EnvioGraphQLClient";
export const listCommand = new Command("list")
  .description("List all registered instances")
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .option("-a, --address <address>", "Address of the Distributor contract")
  .option(
    "-e, --envio <url>",
    "Envio GraphQL endpoint URL. If not provided, http://localhost:8080/v1/graphql will be used. Alternatively INDEXER_URL environment variable may be used",
    "http://localhost:8080/v1/graphql"
  )
  .option(
    "-d, --distributor-address <address>",
    "Distributor address, or env DISTRIBUTOR_ADDRESS. If none provided, will attempt to resolve from known chainId artifacts"
  )
  .action(async (options) => {
    const spinner = ora("Initializing client...").start();

    try {
      const publicClient = await createPublic(options.rpc);
      const chainId = Number(await publicClient.getChainId());

      const maoDistributor = new MAODistributorClient(
        chainId,
        {
          publicClient,
          address: options.address && getAddress(options.address),
          envioClient: new EnvioGraphQLClient({
            endpoint: process.env.INDEXER_URL ?? options.envio,
          }),
        },
        options.distributorAddress || process.env.DISTRIBUTOR_ADDRESS
      );

      spinner.text = "Fetching instances...";
      const distributions = await maoDistributor.getDistributions();
      // console.log(distributions);
      const instancePromises = distributions.map((d) => maoDistributor.getInstances(d));
      const instanceArrays = await Promise.all(instancePromises);
      const instances = instanceArrays.flat().map((i) => parseInstantiated(i.addresses));

      if (instances.length === 0) {
        spinner.info("No instances found");
        return;
      }

      spinner.succeed(`Found ${instances.length} instance(s)`);

      console.log("\nInstances:");
      instanceArrays.flat().forEach((instance, index) => {
        console.log(chalk.blue(`\nInstance #${instance.newInstanceId.toString()}:`));
        console.log(chalk.green("Gov Token:"), instances[index].govToken);
        console.log(chalk.green("Gov Token Access Manager:"), instances[index].govTokenAccessManager);
        console.log(chalk.green("ACID Instance:"), instances[index].ACIDInstance);
        console.log(chalk.green("ACID Access Manager:"), instances[index].ACIDAccessManager);
        console.log(chalk.green("Rank Token:"), instances[index].rankToken);
      });
    } catch (error) {
      spinner.fail("Failed to list instances");
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });
