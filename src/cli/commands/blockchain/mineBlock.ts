import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { createPublic, createWallet } from "../../client";
import { BlockchainUtils } from "../../../utils/blockchain";

export const mineBlock = new Command("mineBlock")
  .description("Increase next block timestamp and mine a new block")
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .option(
    "-k, --key <privateKey>",
    "Private key for signing transactions. If not provided, PRIVATE_KEY environment variable will be used"
  )
  .option("-t, --time-increase <seconds>", "Number of seconds to increase the timestamp by", "1")
  .action(async (options) => {
    const spinner = ora("Initializing clients...").start();

    try {
      const publicClient = await createPublic(options.rpc);
      
      // We create the wallet client for authentication but don't use it directly
      await createWallet(options.rpc, options.key);
      const chainId = Number(await publicClient.getChainId());

      const currentBlock = await publicClient.getBlock({ blockTag: "latest" });
      console.log(`Current block: ${currentBlock.number}, timestamp: ${currentBlock.timestamp}`);

      // Check if we're on a local development chain
      if (!BlockchainUtils.isLocalChain(chainId)) {
        spinner.fail("This command can only be used on local development chains (Anvil, Hardhat, or Ganache)");
        process.exit(1);
      }

      // Parse time increase option
      const timeIncrease = parseInt(options.timeIncrease);
      
      // Use the utility function to increase time and mine
      const result = await BlockchainUtils.increaseTimeAndMine(publicClient, timeIncrease, spinner);
      
      spinner.succeed(`Successfully mined a new block`);
      console.log(chalk.green(`New block: ${result.newBlock.number}, timestamp: ${result.newBlock.timestamp}`));
      console.log(chalk.green(`Timestamp increased by: ${result.actualIncrease} seconds`));
      
    } catch (error) {
      spinner.fail("Failed to mine block");
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message + "\n" + error.stack : String(error)}`));
      process.exit(1);
    }
  });
