import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { Address } from "viem";
import InstanceBase from "../../../rankify/InstanceBase";
import { createPublic } from "../../client";

export const paramsCommand = new Command("params")
  .description("Get parameters for a Fellowship")
  .argument("<address>", "The Fellowship contract address")
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .action(async (address: Address, options) => {
    const spinner = ora("Initializing client...").start();

    try {
      const publicClient = await createPublic(options.rpc);
      const chainId = await publicClient.getChainId();
      spinner.text = "Fetching parameters...";

      const fellowship = new InstanceBase({
        instanceAddress: address,
        chainId,
        publicClient,
      });

      const { commonParams, numGames } = await fellowship.getContractState();
      const {
        beneficiary,
        rankTokenAddress,
        minimumParticipantsInCircle,
        principalTimeConstant,
        principalCost,
        gamePaymentToken,
        derivedToken,
        proposalIntegrityVerifier,
      } = commonParams;
      spinner.succeed("Parameters fetched successfully");

      console.log("\nParameters:");
      console.log({
        beneficiary,
        rankTokenAddress,
        minimumParticipantsInCircle: minimumParticipantsInCircle.toString(),
        principalTimeConstant: principalTimeConstant.toString(),
        principalCost: principalCost.toString(),
        gamePaymentToken,
        derivedToken,
        proposalIntegrityVerifier,
        numGames: numGames.toString(),
      });
    } catch (error) {
      spinner.fail("Operation failed");
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });
