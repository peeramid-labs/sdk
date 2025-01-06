import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { MAODistributorClient } from "../../rankify/MAODistributor";
import { createPublic, createWallet } from "../client";
import inquirer from "inquirer";
import { getArtifact } from "../../utils";

// Helper to pad string to 32 bytes, similar to ethers.utils.formatBytes32String
function formatBytes32String(text: string): `0x${string}` {
  const buffer = Buffer.from(text.slice(0, 31), "utf8");
  const paddedBuffer = Buffer.alloc(32);
  buffer.copy(paddedBuffer);
  return `0x${paddedBuffer.toString("hex")}` as `0x${string}`;
}

export const addDistributionCommand = new Command("add-distribution")
  .description("Add a new distribution to the DAO Distributor")
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .option(
    "-k, --key <privateKey>",
    "Private key for signing transactions. If not provided, PRIVATE_KEY environment variable will be used"
  )
  .option("-n, --name <name>", "Distribution name")
  .option("-a, --address <address>", "Distribution address")
  .option("-i, --initializer <address>", "Initializer address (optional)")
  .action(async (options) => {
    const spinner = ora("Initializing clients...").start();

    try {
      const publicClient = createPublic(options.rpc);
      const walletClient = await createWallet(options.rpc, options.key);
      const chainId = Number(await publicClient.getChainId());

      const maoDistributor = new MAODistributorClient(chainId, {
        publicClient,
        walletClient,
      });

      spinner.stop();

      // Use provided name, env var, or default
      let name = options.name;
      if (!name) {
        const defaultName = process.env.DEFAULT_DISTRIBUTION_NAME ?? "MAO Distribution";
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
      let distributionAddress = options.address;
      if (!options.address) {
        const response = await inquirer.prompt([
          {
            type: "input",
            name: "address",
            message: "Input distribution address to add to the distributor contract",
            default: getArtifact(chainId, "DAODistributor").address,
            validate: (input: string) => {
              if (!input.trim()) return "Address cannot be empty";
              return true;
            },
          },
        ]);
        distributionAddress = response.address;
      }

      // Format name as bytes32
      const nameBytes = formatBytes32String(name);

      spinner.start("Adding distribution...");

      const { receipt, distributionAddedEvent } = await maoDistributor.addNamedDistribution(
        walletClient.chain,
        nameBytes,
        distributionAddress,
        options.initializer || "0x0000000000000000000000000000000000000000"
      );

      spinner.succeed("Distribution added successfully!");
      console.log(chalk.green(`\nTransaction hash: ${receipt.transactionHash}`));
      console.log(
        chalk.green(`Distribution ID: ${distributionAddedEvent.args.distribution} (${distributionAddedEvent.args.id})`)
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
