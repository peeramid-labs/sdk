import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { getAddress } from "viem";
import { createPublic, createWallet } from "../../../client";
import { resolvePk } from "../../../getPk";
import InstanceAdmininstrative from "../../../../rankify/InstanceAdmininstrative";

export const addWhitelistedGM = new Command("add")
  .description("Add a game master to a whitelisted ones, this allows them to call joinGameByMaster")
  .argument("<instance>", "Address of the fellowship instance")
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .option("-i, --mnemonic-index <index>", "Index to derive from mnemonic")
  .option(
    "-k, --key <privateKey>",
    "Will be used if no mnemonic index is provided. Private key with admin permissions. If not provided, PRIVATE_KEY environment variable will be used"
  )
  .option("-g, --game-master-address <address>", "Game master address. ")
  .action(async (instanceAddress, options) => {
    const spinner = ora("Initializing clients...").start();

    try {
      const publicClient = await createPublic(options.rpc);
      const walletClient = await createWallet(options.rpc, resolvePk(options.mIndex ?? options.key, spinner));

      const chainId = Number(await publicClient.getChainId());

      const resolvedInstanceAddress = getAddress(instanceAddress);

      spinner.text = "Creating Rankify player client...";
      const account = walletClient.account?.address;

      if (!account) {
        spinner.fail("No account available");
        throw new Error("No account available");
      }

      const admin = new InstanceAdmininstrative({
        publicClient,
        walletClient,
        chainId,
        instanceAddress: resolvedInstanceAddress,
      });

      spinner.text = "Checking chain support and preparing token approval...";

      spinner.text = "Executing...";

      const hash = await admin.addWhitelistedGM(getAddress(options.gameMasterAddress));

      spinner.succeed("Game created and opened successfully");

      console.log(chalk.green(`\nGM added, tx hash: ${hash}`));
    } catch (error) {
      spinner.fail("Failed to add game master");
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message + "\n" + error.stack : String(error)}`));
      process.exit(1);
    }
  });
