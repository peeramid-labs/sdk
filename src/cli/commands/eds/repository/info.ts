import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import { getAddress, isAddress } from "viem";
import { createPublic, createWallet } from "../../../client";
import { RepositoryClient } from "../../../../eds/Repository";
import { resolvePk } from "../../../getPk";

export const infoCommand = new Command("info")
  .description("Get information about an EDS repository")
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .option("-i, --mnemonic-index <index>", "Index to derive from mnemonic")
  .option(
    "-k, --key <privateKey>",
    "Will be used if no mnemonic index is provided. Private key with admin permissions. If not provided, PRIVATE_KEY environment variable will be used"
  )
  .option("-a, --address <address>", "Repository contract address")
  .action(async (options) => {
    const spinner = ora("Initializing clients...").start();

    try {
      // Create clients
      const publicClient = await createPublic(options.rpc);
      const walletClient = await createWallet(options.rpc, resolvePk(options.mnemonicIndex ?? options.key, spinner));

      spinner.stop();

      // Get repository address
      let repositoryAddress = options.address;

      if (!repositoryAddress) {
        const response = await inquirer.prompt([
          {
            type: "input",
            name: "repositoryAddress",
            message: "Enter the repository contract address:",
            validate: (input) => {
              if (!input.trim()) return "Repository address is required";
              if (!isAddress(input)) return "Invalid address format";
              return true;
            },
          },
        ]);
        repositoryAddress = response.repositoryAddress;
      }

      // Validate address
      if (!isAddress(repositoryAddress)) {
        console.error(chalk.red("Invalid repository address"));
        process.exit(1);
      }

      // Create repository client
      const repositoryClient = new RepositoryClient({
        address: getAddress(repositoryAddress),
        publicClient,
        walletClient,
      });

      const infoSpinner = ora("Fetching repository information...").start();

      try {
        // Get repository information
        const [name, uri, latestRelease] = await Promise.all([
          repositoryClient.getName(),
          repositoryClient.getUri(),
          repositoryClient.getLatestRelease().catch(() => null), // May not have releases yet
        ]);

        infoSpinner.succeed(chalk.green("Repository information retrieved!"));

        // Print the repository information
        console.log(chalk.bold("\n📚 Repository Information:"));
        console.log(`${chalk.blue("Address:")} ${repositoryAddress}`);
        console.log(`${chalk.blue("Name:")} ${name}`);
        console.log(`${chalk.blue("URI:")} ${uri}`);

        if (latestRelease) {
          console.log(chalk.bold("\n📦 Latest Release:"));
          console.log(`${chalk.blue("Version:")} ${latestRelease.major}.${latestRelease.minor}.${latestRelease.patch}`);
          console.log(`${chalk.blue("Distribution Hash:")} ${latestRelease.distributionHash}`);
          console.log(`${chalk.blue("Metadata:")} ${latestRelease.metadata}`);
        } else {
          console.log(chalk.yellow("\n📦 No releases found"));
        }
      } catch (error) {
        infoSpinner.fail(chalk.red("Failed to retrieve repository information"));
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : "Unknown error"}`));
        process.exit(1);
      }
    } catch (error) {
      spinner.fail(chalk.red("Failed to initialize clients"));
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : "Unknown error"}`));
      process.exit(1);
    }
  });
