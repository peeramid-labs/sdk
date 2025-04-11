import { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import { Chain } from "viem";
import { MAODistributorClient } from "../../../rankify/MAODistributor";
import { createPublic, createWallet } from "../../client";
import { chainToPath } from "../../../utils/chainMapping";
import { resolvePk } from "../../getPk";

// Define enum for fellowship defaults
enum FellowshipDefaults {
  TOKEN_NAME = "Fellowship Token",
  TOKEN_SYMBOL = "FLSHP",
  PRINCIPAL_COST = "1000000000",
  TIME_CONSTANT = "604800", // 1 week
  METADATA = "ipfs://QmVzSvWjysUfVHzGMQ4y2EduXrVYLApZ3KHQb2gUTR4x6P",
  RANK_TOKEN_URI = "ipfs://your-rank-token-uri"
}

export const createFellowshipCommand = new Command("create")
  .description("Create a new Fellowship")
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .option("-i, --mnemonic-index <index>", "Index to derive from mnemonic")
  .option("-k, --key <privateKey>", "Will be used if no mnemonic index is provided. Private key with admin permissions. If not provided, PRIVATE_KEY environment variable will be used")
  .option("-n, --dist-name <n>", "Distributors package name")
  .option("-y, --yes", "Auto-accept default values for all prompts", false)
  .action(async (options) => {
    const spinner = ora("Initializing clients...").start();

    try {
      const publicClient = await createPublic(options.rpc);
      const walletClient = await createWallet(options.rpc, resolvePk(options.mnemonicIndex ?? options.key, spinner));
      const chainId = Number(await publicClient.getChainId());

      const maoDistributor = new MAODistributorClient(chainId, {
        publicClient,
        walletClient,
      });

      // Default values for fellowship creation
      const defaultValues = {
        tokenName: FellowshipDefaults.TOKEN_NAME,
        tokenSymbol: FellowshipDefaults.TOKEN_SYMBOL,
        principalCost: FellowshipDefaults.PRINCIPAL_COST,
        timeConstant: FellowshipDefaults.TIME_CONSTANT,
        metadata: FellowshipDefaults.METADATA,
        rankTokenUri: FellowshipDefaults.RANK_TOKEN_URI,
        owner: walletClient.account?.address,
      };

      // Check if auto-accept defaults is enabled
      const autoAcceptDefaults = options.yes;
      
      let fellowshipDetails;
      
      if (autoAcceptDefaults) {
        // Auto-accept all default values
        console.log("Auto-accepting default values:");
        console.log(defaultValues);
        fellowshipDetails = defaultValues;
      } else {
        // Prompt user for values
        spinner.text = "Please provide fellowship details...";
        spinner.stop();

        fellowshipDetails = await inquirer.prompt([
          {
            type: "input",
            name: "tokenName",
            message: "Enter token name:",
            default: defaultValues.tokenName,
          },
          {
            type: "input",
            name: "tokenSymbol",
            message: "Enter token symbol:",
            default: defaultValues.tokenSymbol,
          },
          {
            type: "input",
            name: "principalCost",
            message: "Enter principal cost (in wei):",
            default: defaultValues.principalCost,
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
            default: defaultValues.timeConstant, // 1 week
            validate: (input: string) => {
              const num = parseInt(input);
              return !isNaN(num) && num > 0 ? true : "Please enter a valid number greater than 0";
            },
          },
          {
            type: "input",
            name: "metadata",
            message: "Enter metadata URI:",
            default: defaultValues.metadata,
          },
          {
            type: "input",
            name: "rankTokenUri",
            message: "Enter rank token URI:",
            default: defaultValues.rankTokenUri,
          },
          {
            type: "input",
            name: "owner",
            message: "Enter owner address:",
            default: defaultValues.owner,
          },
        ]);
      }
      
      const { tokenName, tokenSymbol, principalCost, timeConstant, metadata, rankTokenUri, owner } = fellowshipDetails;

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
            owner: owner,
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
