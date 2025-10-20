import { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import { Chain, zeroAddress } from "viem";
import { MAODistributorClient } from "../../../rankify/MAODistributor";
import { createPublic, createWallet } from "../../client";
import { chainToPath } from "../../../utils/chainMapping";
import { resolvePk } from "../../getPk";
import EnvioGraphQLClient from "../../../utils/EnvioGraphQLClient";

// Define enum for fellowship defaults
enum FellowshipDefaults {
  TOKEN_NAME = "Fellowship Token",
  TOKEN_SYMBOL = "FLSHP",
  PRINCIPAL_COST = "1000000000",
  TIME_CONSTANT = "604800", // 1 week
  METADATA = "ipfs://QmVzSvWjysUfVHzGMQ4y2EduXrVYLApZ3KHQb2gUTR4x6P",
  RANK_TOKEN_URI = "ipfs://your-rank-token-uri",
  VOTING_DELAY = "7200",
  VOTING_PERIOD = "50400",
  QUORUM = "4",
}

export const createFellowshipCommand = new Command("create")
  .description("Create a new Fellowship")
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .option("-i, --mnemonic-index <index>", "Index to derive from mnemonic")
  .option(
    "-k, --key <privateKey>",
    "Will be used if no mnemonic index is provided. Private key with admin permissions. If not provided, PRIVATE_KEY environment variable will be used"
  )
  .option("-n, --dist-name <n>", "Distributors package name")
  .option("-y, --yes", "Auto-accept default values for all prompts", false)
  .option(
    "-e, --envio <url>",
    "Envio GraphQL endpoint URL. If not provided, http://localhost:8080/v1/graphql will be used. Alternatively INDEXER_URL environment variable may be used",
    "http://localhost:8080/v1/graphql"
  )
  .option("-d, --distribution-name <name>", "Distribution name", "MAO Distribution")
  .option(
    "-p, --payment-token <address>",
    "Payment token address. If not provided, will use the Rankify token address",
    undefined
  )
  .option(
    "-a, --distributor-address <address>",
    "Distributor address, or env DISTRIBUTOR_ADDRESS. If none provided, will attempt to resolve from known chainId artifacts"
  )
  .action(async (options) => {
    const spinner = ora("Initializing clients...").start();

    try {
      const publicClient = await createPublic(options.rpc);
      const walletClient = await createWallet(options.rpc, resolvePk(options.mnemonicIndex ?? options.key, spinner));
      const chainId = Number(await publicClient.getChainId());

      const maoDistributor = new MAODistributorClient(
        chainId,
        {
          publicClient,
          walletClient,
          envioClient: new EnvioGraphQLClient({
            endpoint: process.env.INDEXER_URL ?? options.envio,
          }),
        },
        options.distributorAddress || process.env.DISTRIBUTOR_ADDRESS
      );

      // Default values for fellowship creation
      const defaultValues = {
        tokenName: FellowshipDefaults.TOKEN_NAME,
        tokenSymbol: FellowshipDefaults.TOKEN_SYMBOL,
        principalCost: FellowshipDefaults.PRINCIPAL_COST,
        timeConstant: FellowshipDefaults.TIME_CONSTANT,
        metadata: FellowshipDefaults.METADATA,
        rankTokenUri: FellowshipDefaults.RANK_TOKEN_URI,
        votingDelay: FellowshipDefaults.VOTING_DELAY,
        votingPeriod: FellowshipDefaults.VOTING_PERIOD,
        quorum: FellowshipDefaults.QUORUM,
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
            name: "votingDelay",
            message: "Enter voting delay (in seconds):",
            default: defaultValues.votingDelay,
            validate: (input: string) => {
              const num = parseInt(input);
              return !isNaN(num) && num > 0 ? true : "Please enter a valid number greater than 0";
            },
          },
          {
            type: "input",
            name: "votingPeriod",
            message: "Enter voting period (in seconds):",
            default: defaultValues.votingPeriod,
            validate: (input: string) => {
              const num = parseInt(input);
              return !isNaN(num) && num > 0 ? true : "Please enter a valid number greater than 0";
            },
          },
          {
            type: "input",
            name: "quorum",
            message: "Enter quorum (in percentage):",
            default: defaultValues.quorum,
            validate: (input: string) => {
              const num = parseInt(input);
              return !isNaN(num) && num > 0 ? true : "Please enter a valid number greater than 0";
            },
          },
        ]);
      }

      const { tokenName, tokenSymbol, principalCost, timeConstant, metadata, rankTokenUri } = fellowshipDetails;

      spinner.start("Creating fellowship...");

      // Get payment token address from options or fallback to Rankify address
      let paymentToken;
      paymentToken = options.paymentToken ?? zeroAddress;
      if (!options.paymentToken) {
        console.warn(
          " ⚠️ If you are using development build, you MUST provide a payment token address via --payment-token, otherwise an UBI token will be deployed."
        );
      }

      const args = [
        {
          govSettings: {
            tokenName,
            tokenSymbol,
            preMintAmounts: [],
            preMintReceivers: [],
            orgName: tokenName,
            votingDelay: Number(fellowshipDetails.votingDelay),
            votingPeriod: Number(fellowshipDetails.votingPeriod),
            quorum: BigInt(fellowshipDetails.quorum),
          },
          rankifySettings: {
            principalCost: BigInt(principalCost),
            principalTimeConstant: BigInt(timeConstant),
            rankTokenURI: rankTokenUri,
            rankTokenContractURI: metadata,
            paymentToken,
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
