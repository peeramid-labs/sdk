import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { MAODistributorClient } from "../../../rankify/MAODistributor";
import { createPublic, createWallet } from "../../client";
import inquirer from "inquirer";

export const removeCommand = new Command("remove")
  .description("Remove a distribution")
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .action(async (options) => {
    const spinner = ora("Initializing clients...").start();

    try {
      const publicClient = await createPublic(options.rpc);
      const walletClient = await createWallet(options.rpc, options.key);
      const chainId = Number(await publicClient.getChainId());

      const maoDistributor = new MAODistributorClient(chainId, {
        publicClient,
        walletClient,
      });

      spinner.stop();

      // Use provided name, env var, or default
      let id = options.id;
      if (!id) {
        const response = await inquirer.prompt([
          {
            type: "input",
            name: "id",
            message: "Enter distribution ID:",
            validate: (input: string) => {
              if (!input.trim()) return "Name cannot be empty";
              return true;
            },
          },
        ]);
        id = response.id;
      }

      spinner.start("removing distribution...");
      if (!walletClient.chain) throw new Error("Chain not found");
      const { receipt, distributionRemovedEvent } = await maoDistributor.removeDistribution(id);

      spinner.succeed("Distribution removed successfully!");
      console.log(chalk.green(`\nTransaction hash: ${receipt.transactionHash}`));
      console.log(chalk.green(`Distribution ID: ${distributionRemovedEvent.args.id}`));

      // Verify the distribution was removed
      const distributions = await maoDistributor.getDistributions();
      const removed = distributions.some((d) => d !== id);

      if (!removed) {
        console.log(chalk.green("\nDistribution verified to be removed from the list!"));
      } else {
        console.log(
          chalk.yellow(
            "\nWarning: Distribution was removed but not found in the list. It may take a few blocks to appear."
          )
        );
      }
    } catch (error) {
      spinner.fail("Failed to remove distribution");
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });
