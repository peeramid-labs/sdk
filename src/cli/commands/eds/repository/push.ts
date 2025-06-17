import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import { getAddress, isAddress, isHex } from "viem";
import { createPublic, createWallet } from "../../../client";
import { RepositoryClient } from "../../../../eds/Repository";
import { resolvePk } from "../../../getPk";

export const pushCommand = new Command("push")
  .description("Push a new release to an existing EDS repository")
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .option("-i, --mnemonic-index <index>", "Index to derive from mnemonic")
  .option(
    "-k, --key <privateKey>",
    "Will be used if no mnemonic index is provided. Private key with admin permissions. If not provided, PRIVATE_KEY environment variable will be used"
  )
  .option("-a, --address <address>", "Repository contract address")
  .option("-d, --dist-hash <hash>", "Distribution hash (0x...)")
  .option("-m, --metadata <metadata>", "Metadata string for the release")
  .option("--major <number>", "Major version number", "1")
  .option("--minor <number>", "Minor version number", "0")
  .option("--patch <number>", "Patch version number", "0")
  .action(async (options) => {
    const spinner = ora("Initializing clients...").start();

    try {
      // Create clients
      const publicClient = await createPublic(options.rpc);
      const walletClient = await createWallet(options.rpc, resolvePk(options.mnemonicIndex ?? options.key, spinner));

      spinner.stop();

      // Get parameters
      let repositoryAddress = options.address;
      let distHash = options.distHash;
      let metadata = options.metadata;
      let major = parseInt(options.major);
      let minor = parseInt(options.minor);
      let patch = parseInt(options.patch);

      // Prompt for missing parameters
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

      if (!distHash) {
        const response = await inquirer.prompt([
          {
            type: "input",
            name: "distHash",
            message: "Enter the distribution hash (0x...):",
            validate: (input) => {
              if (!input.trim()) return "Distribution hash is required";
              if (!isHex(input)) return "Invalid hex format - must start with 0x";
              return true;
            },
          },
        ]);
        distHash = response.distHash;
      }

      if (!metadata) {
        const response = await inquirer.prompt([
          {
            type: "input",
            name: "metadata",
            message: "Enter the metadata for this release:",
            validate: (input) => {
              if (!input.trim()) return "Metadata is required";
              return true;
            },
          },
        ]);
        metadata = response.metadata;
      }

      // Prompt for version if not all provided
      if (isNaN(major) || isNaN(minor) || isNaN(patch)) {
        const versionResponse = await inquirer.prompt([
          {
            type: "input",
            name: "major",
            message: "Enter major version number:",
            default: "1",
            validate: (input) => {
              const num = parseInt(input);
              return !isNaN(num) && num >= 0 ? true : "Please enter a valid non-negative number";
            },
          },
          {
            type: "input",
            name: "minor",
            message: "Enter minor version number:",
            default: "0",
            validate: (input) => {
              const num = parseInt(input);
              return !isNaN(num) && num >= 0 ? true : "Please enter a valid non-negative number";
            },
          },
          {
            type: "input",
            name: "patch",
            message: "Enter patch version number:",
            default: "0",
            validate: (input) => {
              const num = parseInt(input);
              return !isNaN(num) && num >= 0 ? true : "Please enter a valid non-negative number";
            },
          },
        ]);
        major = parseInt(versionResponse.major);
        minor = parseInt(versionResponse.minor);
        patch = parseInt(versionResponse.patch);
      }

      // Validate inputs
      if (!isAddress(repositoryAddress)) {
        console.error(chalk.red("Invalid repository address"));
        process.exit(1);
      }

      if (!isHex(distHash)) {
        console.error(chalk.red("Invalid distribution hash format"));
        process.exit(1);
      }

      // Create repository client
      const repositoryClient = new RepositoryClient({
        address: getAddress(repositoryAddress),
        publicClient,
        walletClient,
      });

      const pushSpinner = ora("Pushing new release...").start();

      try {
        // Push the new release
        const receipt = await repositoryClient.newRelease(distHash as `0x${string}`, metadata, { major, minor, patch });

        pushSpinner.succeed(chalk.green("Release pushed successfully!"));

        // Print the release details
        console.log(chalk.bold("\n📦 Release Details:"));
        console.log(`${chalk.blue("Repository:")} ${repositoryAddress}`);
        console.log(`${chalk.blue("Version:")} ${major}.${minor}.${patch}`);
        console.log(`${chalk.blue("Distribution Hash:")} ${distHash}`);
        console.log(`${chalk.blue("Metadata:")} ${metadata}`);
        console.log(`${chalk.blue("Transaction Hash:")} ${chalk.green(receipt.transactionHash)}`);
        console.log(`${chalk.blue("Block Number:")} ${receipt.blockNumber}`);
      } catch (error) {
        pushSpinner.fail(chalk.red("Release push failed"));
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : "Unknown error"}`));
        process.exit(1);
      }
    } catch (error) {
      spinner.fail(chalk.red("Failed to initialize clients"));
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : "Unknown error"}`));
      process.exit(1);
    }
  });
