import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { Address } from "viem";
import InstanceBase from "../../../rankify/InstanceBase";
import { createPublic } from "../../client";
import EnvioGraphQLClient from "../../../utils/EnvioGraphQLClient";

export const paramsCommand = new Command("params")
  .description("Get parameters for a Fellowship")
  .argument("<address>", "The Fellowship contract address")
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .option("-e, --envio <url>", "Envio GraphQL endpoint URL. If not provided, http://localhost:8080/v1/graphql will be used. Alternatively INDEXER_URL environment variable may be used", "http://localhost:8080/v1/graphql")
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
        envioClient: new EnvioGraphQLClient({
          endpoint: process.env.INDEXER_URL ?? options.envio,
        }),
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
