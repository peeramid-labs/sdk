import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { MAODistributorClient } from "../../../rankify/MAODistributor";
import { createPublic, createWallet } from "../../client";
import inquirer from "inquirer";
import { getArtifact } from "../../../utils";
import { resolvePk } from "../../getPk";
import EnvioGraphQLClient from "../../../utils/EnvioGraphQLClient";

// Define enum for distribution defaults
enum DistributionDefaults {
  NAME = "MAO-v1.3"
}

// Helper to pad string to 32 bytes, similar to ethers.utils.formatBytes32String
function formatBytes32String(text: string): `0x${string}` {
  const buffer = Buffer.from(text.slice(0, 31), "utf8");
  const paddedBuffer = Buffer.alloc(32);
  buffer.copy(paddedBuffer);
  return `0x${paddedBuffer.toString("hex")}` as `0x${string}`;
}

export const addCommand = new Command("add")
  .description("Add a new distribution")
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .option("-d, --distributor <address>", "Address of the distributor")
  .option("-i, --m-index <mnemonicIndex>", "Index to derive from mnemonic")
  .option("-k, --key <privateKey>", "Will be used if no mnemonic index is provided. Private key with admin permissions. If not provided, PRIVATE_KEY environment variable will be used")
  .option("-y, --yes", "Auto-accept default values for all prompts", false)
  .option("-e, --envio <url>", "Envio GraphQL endpoint URL. If not provided, http://localhost:8080/v1/graphql will be used. Alternatively INDEXER_URL environment variable may be used", "http://localhost:8080/v1/graphql")
  .action(async (options) => {
    const spinner = ora("Initializing clients...").start();

    try {
      const publicClient = await createPublic(options.rpc);
      const walletClient = await createWallet(options.rpc, resolvePk(options.mIndex ?? options.key, spinner));
      const chainId = Number(await publicClient.getChainId());

      const maoDistributor = new MAODistributorClient(chainId, {
        address: options.distributor ?? undefined,
        publicClient,
        walletClient,
        envioClient: new EnvioGraphQLClient({
          endpoint: process.env.INDEXER_URL ?? options.envio,
        }),
      });

      spinner.stop();

      // Default values
      const defaultName = process.env.DEFAULT_DISTRIBUTION_NAME ?? DistributionDefaults.NAME;
      const defaultAddress = getArtifact(chainId, "MAODistribution").address;

      // Check if auto-accept defaults is enabled
      const autoAcceptDefaults = options.yes;

      let name = options.name;
      let distributionAddress = options.address;

      if (!name) {
        if (autoAcceptDefaults) {
          console.log(`Auto-accepting default distribution name: ${defaultName}`);
          name = defaultName;
        } else {
          const response = await inquirer.prompt([
            {
              type: "input",
              name: "name",
              message: "Enter distribution name:",
              default: defaultName,
              validate: (input: string) => {
                if (!input.trim()) return "Name cannot be empty";
                return true;
              },
            },
          ]);
          name = response.name;
        }
      }

      if (!distributionAddress) {
        if (autoAcceptDefaults) {
          console.log(`Auto-accepting default distribution address: ${defaultAddress}`);
          distributionAddress = defaultAddress;
        } else {
          const response = await inquirer.prompt([
            {
              type: "input",
              name: "address",
              message: "Input distribution address to add to the distributor contract",
              default: defaultAddress,
              validate: (input: string) => {
                if (!input.trim()) return "Address cannot be empty";
                return true;
              },
            },
          ]);
          distributionAddress = response.address;
        }
      }

      // Format name as bytes32
      const nameBytes = formatBytes32String(name);

      spinner.start("Adding distribution...");
      if (!walletClient.chain) throw new Error("Chain not found");
      const { receipt, distributionAddedEvent } = await maoDistributor.addNamedDistribution(
        walletClient.chain,
        nameBytes,
        distributionAddress,
        options.initializer || "0x0000000000000000000000000000000000000000"
      );

      spinner.succeed("Distribution added successfully!");
      console.log(chalk.green(`\nTransaction hash: ${receipt.transactionHash}`));
      console.log(
        chalk.green(
          `Distribution ID: ${distributionAddedEvent.args.distribution} (${distributionAddedEvent.args.id}), address ${distributionAddress}`
        )
      );

      // Verify the distribution was added
      const distributions = await maoDistributor.getDistributions();
      const added = distributions.some((d) => d === nameBytes);

      if (added) {
        console.log(chalk.green("\nDistribution verified in the list!"));
      } else {
        console.log(
          chalk.yellow(
            "\nWarning: Distribution was added but not found in the list. It may take a few blocks to appear."
          )
        );
      }
    } catch (error) {
      spinner.fail("Failed to add distribution");
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });
