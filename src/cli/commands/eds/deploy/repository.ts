import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import { getAddress, isAddress } from "viem";
import { createPublic, createWallet } from "../../../client";
import { EDSClient } from "../../../../eds/EDS";
import { EnvioGraphQLClient } from "../../../../utils/EnvioGraphQLClient";
import { resolvePk } from "../../../getPk";

export const repositoryCommand = new Command("repository")
  .description("Deploy a new EDS repository")
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .option("-i, --mnemonic-index <index>", "Index to derive from mnemonic")
  .option(
    "-k, --key <privateKey>",
    "Will be used if no mnemonic index is provided. Private key with admin permissions. If not provided, PRIVATE_KEY environment variable will be used"
  )
  .option(
    "-e, --envio <url>",
    "Envio GraphQL endpoint URL. If not provided, http://localhost:8080/v1/graphql will be used. Alternatively INDEXER_URL environment variable may be used",
    "http://localhost:8080/v1/graphql"
  )
  .option("-o, --owner <address>", "Owner address for the repository")
  .option("-n, --name <name>", "Name of the repository")
  .option("-u, --uri <uri>", "URI for the repository metadata")
  .action(async (options) => {
    const spinner = ora("Initializing clients...").start();

    try {
      // Create clients
      const publicClient = await createPublic(options.rpc);
      const walletClient = await createWallet(options.rpc, resolvePk(options.mnemonicIndex ?? options.key, spinner));
      const envioClient = new EnvioGraphQLClient({ endpoint: options.envio });

      // Create EDS client
      const edsClient = new EDSClient({
        publicClient,
        walletClient,
        envioClient,
      });

      spinner.stop();

      // Get parameters
      let owner = options.owner;
      let name = options.name;
      let uri = options.uri;

      // Prompt for missing parameters
      if (!owner) {
        const response = await inquirer.prompt([
          {
            type: "input",
            name: "owner",
            default: walletClient.account?.address,
            message: "Enter the owner address for the repository:",
            validate: (input) => {
              if (!input.trim()) return "Owner address is required";
              if (!isAddress(input)) return "Invalid address format";
              return true;
            },
          },
        ]);
        owner = response.owner;
      }

      if (!name) {
        const response = await inquirer.prompt([
          {
            type: "input",
            name: "name",
            message: "Enter the repository name:",
            validate: (input) => {
              if (!input.trim()) return "Repository name is required";
              return true;
            },
          },
        ]);
        name = response.name;
      }

      if (!uri) {
        const response = await inquirer.prompt([
          {
            type: "input",
            name: "uri",
            message: "Enter the repository URI:",
            validate: (input) => {
              if (!input.trim()) return "Repository URI is required";
              return true;
            },
          },
        ]);
        uri = response.uri;
      }

      // Validate owner address
      if (!isAddress(owner)) {
        console.error(chalk.red("Invalid owner address"));
        process.exit(1);
      }

      const deploySpinner = ora("Deploying repository...").start();

      try {
        // Deploy the repository
        const repositoryClient = await edsClient.newRepository(getAddress(owner), name, uri);

        deploySpinner.succeed(chalk.green("Repository deployed successfully!"));

        // Print the repository address
        console.log(chalk.bold("\n📋 Repository Details:"));
        console.log(`${chalk.blue("Address:")} ${chalk.green(repositoryClient.address)}`);
        console.log(`${chalk.blue("Owner:")} ${owner}`);
        console.log(`${chalk.blue("Name:")} ${name}`);
        console.log(`${chalk.blue("URI:")} ${uri}`);

        // Note: Repository address is printed above for CLI usage
      } catch (error) {
        deploySpinner.fail(chalk.red("Repository deployment failed"));
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : "Unknown error"}`));
        process.exit(1);
      }
    } catch (error) {
      spinner.fail(chalk.red("Failed to initialize clients"));
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : "Unknown error"}`));
      process.exit(1);
    }
  });
