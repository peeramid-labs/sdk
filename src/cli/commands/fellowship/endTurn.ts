import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { Chain, getAddress } from "viem";
import { createPublic, createWallet } from "../../client";
import { chainToPath } from "../../../utils/chainMapping";
import GameMaster from "../../../rankify/GameMaster";

export const endTurn = new Command("endTurn")
  .description("End turn in a game")
  .argument("<instance>", "Address of the Rankify instance")
  .argument("<game>", "Index of the game")
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .option(
    "-k, --key <privateKey>",
    "Private key for signing transactions. If not provided, PRIVATE_KEY environment variable will be used"
  )
  .action(async (instanceAddress, gameId, options) => {
    const spinner = ora("Initializing clients...").start();

    try {
      const publicClient = await createPublic(options.rpc);
      const walletClient = await createWallet(options.rpc, options.key);
      const chainId = Number(await publicClient.getChainId());

      const gameMaster = new GameMaster({
        publicClient,
        walletClient,
        chainId,
      });

      spinner.start("Ending turn...");

      const chain: Chain = {
        id: chainId,
        name: chainToPath[chainId.toString()],
        nativeCurrency: {
          name: "Ether",
          symbol: "ETH",
          decimals: 18,
        },
        rpcUrls: {
          default: {
            http: [options.rpc || process.env.RPC_URL!],
          },
          public: {
            http: [options.rpc || process.env.RPC_URL!],
          },
        },
      };

      const hash = await gameMaster.endTurn({ instanceAddress: getAddress(instanceAddress), gameId: BigInt(gameId) });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(receipt);
      spinner.stop();
    } catch (error) {
      spinner.fail("Failed to end turn");
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message + "\n" + error.stack : String(error)}`));
      process.exit(1);
    }
  });
