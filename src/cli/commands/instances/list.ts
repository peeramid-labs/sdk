import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { MAODistributorClient } from "../../../rankify/MAODistributor";
import { createPublic } from "../../client";
import { parseInstantiated } from "../../../utils";
import { getAddress } from "viem";

export const listCommand = new Command("list")
  .description("List all registered instances")
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .option("-a, --address <address>", "Address of the Distributor contract")
  .action(async (options) => {
    const spinner = ora("Initializing client...").start();

    try {
      const publicClient = await createPublic(options.rpc);
      const chainId = Number(await publicClient.getChainId());

      const maoDistributor = new MAODistributorClient(chainId, {
        publicClient,
        address: options.address && getAddress(options.address),
      });

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
