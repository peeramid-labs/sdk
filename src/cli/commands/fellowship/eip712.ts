import { Command } from "commander";
import { createPublic } from "../../client";
import chalk from "chalk";
import ora from "ora";
import InstanceBase from "../../../rankify/InstanceBase";
import { getAddress } from "viem";

export const eip712Command = new Command("eip712")
  .description("Get EIP712 domain data for the fellowship contract")
  .argument("<instance>", "Address of the Rankify instance")
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .action(async (instance, options) => {
    const spinner = ora("Initializing client...").start();

    try {
      const publicClient = await createPublic(options.rpc);
      const chainId = await publicClient.getChainId();
      spinner.text = "Fetching EIP712 domain data...";

      const rankify = new InstanceBase({
        publicClient,
        chainId,
        instanceAddress: getAddress(instance),
      });

      const domain = await rankify.getEIP712Domain();
      spinner.succeed("Domain data fetched successfully");

      console.log(chalk.bold("\nEIP712 Domain Data:"));
      console.log(chalk.green("Domain Separator:"), domain.domainSeparator);
      console.log(chalk.green("Chain ID:"), domain.chainId.toString());
      console.log(chalk.green("Verifier Contract:"), domain.verifierContract);
      console.log(chalk.green("Name:"), domain.name);
      console.log(chalk.green("Version:"), domain.version);
      console.log(chalk.green("Type Hash:"), domain.typeHash);
      console.log(chalk.green("Hashed Name:"), domain.hashedName);
      console.log(chalk.green("Hashed Version:"), domain.hashedVersion);
    } catch (error) {
      spinner.fail("Operation failed");
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });
