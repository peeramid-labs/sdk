import { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import { Chain } from "viem";
import { MAODistributorClient } from "../../../rankify/MAODistributor";
import { createPublic, createWallet } from "../../client";
import { chainToPath } from "../../../utils/chainMapping";

export const createFellowshipCommand = new Command("create")
  .description("Create a new Fellowship")
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .option(
    "-k, --key <privateKey>",
    "Private key for signing transactions. If not provided, PRIVATE_KEY environment variable will be used"
  )
  .option("-n, --dist-name <name>", "Distributors package name")
  .action(async (options) => {
    const spinner = ora("Initializing clients...").start();

    try {
      const publicClient = await createPublic(options.rpc);
      const walletClient = await createWallet(options.rpc, options.key);
      const chainId = Number(await publicClient.getChainId());

      const maoDistributor = new MAODistributorClient(chainId, {
        publicClient,
        walletClient,
      });

      spinner.text = "Please provide fellowship details...";
      spinner.stop();

      const { tokenName, tokenSymbol, principalCost, timeConstant, metadata, rankTokenUri } = await inquirer.prompt([
        {
          type: "input",
          name: "tokenName",
          message: "Enter token name:",
          default: "Fellowship Token",
        },
        {
          type: "input",
          name: "tokenSymbol",
          message: "Enter token symbol:",
          default: "FLSHP",
        },
        {
          type: "input",
          name: "principalCost",
          message: "Enter principal cost (in wei):",
          default: "1000000000000000000", // 1 ETH
          validate: (input: string) => {
            try {
              BigInt(input);
              return true;
            } catch {
              return "Please enter a valid number";
            }
          },
        },
        {
          type: "input",
          name: "timeConstant",
          message: "Enter time constant (in seconds):",
          default: "604800", // 1 week
          validate: (input: string) => {
            const num = parseInt(input);
            return !isNaN(num) && num > 0 ? true : "Please enter a valid number greater than 0";
          },
        },
        {
          type: "input",
          name: "metadata",
          message: "Enter metadata URI:",
          default: "ipfs://your-metadata-uri",
        },
        {
          type: "input",
          name: "rankTokenUri",
          message: "Enter rank token URI:",
          default: "ipfs://your-rank-token-uri",
        },
      ]);

      spinner.start("Creating fellowship...");

      const args = [
        {
          tokenSettings: {
            tokenName,
            tokenSymbol,
          },
          rankifySettings: {
            principalCost: BigInt(principalCost),
            principalTimeConstant: BigInt(timeConstant),
            rankTokenURI: rankTokenUri,
            rankTokenContractURI: metadata, // Using same URI for contract metadata
          },
        },
      ] as const;

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

      const contracts = await maoDistributor.instantiate(args, options.distName, chain);

      spinner.succeed("Fellowship created successfully!");

      console.log("\nDeployed Contracts:");
      console.log(chalk.green(`Rank Token: ${contracts.rankToken.address}`));
      console.log(chalk.green(`Instance: ${contracts.instance.address}`));
      console.log(chalk.green(`Governance Token: ${contracts.govtToken.address}`));
      console.log(chalk.green(`Governance Access Manager: ${contracts.govTokenAccessManager.address}`));
      console.log(chalk.green(`ACID Access Manager: ${contracts.ACIDAccessManager.address}`));
    } catch (error) {
      spinner.fail("Failed to create fellowship");
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });
