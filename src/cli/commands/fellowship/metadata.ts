import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { Address } from "viem";
import RankTokenClient from "../../../rankify/RankToken";
import { createPublic } from "../../client";

export const getMetadataCommand = new Command("metadata")
  .description("Get metadata for a RankToken")
  .argument("<address>", "The RankToken contract address")
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .option(
    "-i, --ipfs-gateway <url>",
    "IPFS gateway URL. If not provided, IPFS_GATEWAY environment variable will be used"
  )
  .action(async (address: Address, options) => {
    const spinner = ora("Initializing client...").start();

    try {
      const publicClient = await createPublic(options.rpc);
      const chainId = await publicClient.getChainId();
      spinner.text = "Fetching metadata...";

      const rankToken = new RankTokenClient({
        address,
        chainId,
        publicClient,
      });
      const ipfsGateway = options.ipfsGateway || process.env.IPFS_GATEWAY;
      if (!ipfsGateway) throw new Error("IPFS gateway URL is not provided");

      const metadata = await rankToken.getMetadata(ipfsGateway);
      spinner.succeed("Metadata fetched successfully");

      console.log("\nMetadata:");
      console.log(JSON.stringify(metadata, null, 2));
    } catch (error) {
      spinner.fail("Operation failed");
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });
