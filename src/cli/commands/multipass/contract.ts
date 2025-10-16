import { Command } from "commander";
import MultipassBase from "../../../multipass/MultipassBase";
import { Chain, createPublicClient, Hex, http } from "viem";
import ora from "ora";
import chalk from "chalk";
import { createPublic, createWallet } from "../../client";
import { MultipassAbi } from "../../../abis/Multipass";
import { chainToPath } from "../../../utils/chainMapping";
import EnvioGraphQLClient from "../../../utils/EnvioGraphQLClient";

const contractCommand = new Command("contract");

// Initialize the public client

contractCommand
  .command("state")
  .description("Get total number of domains in the contract")
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .option(
    "-e, --envio <url>",
    "Envio GraphQL endpoint URL. If not provided, http://localhost:8080/v1/graphql will be used. Alternatively INDEXER_URL environment variable may be used",
    "http://localhost:8080/v1/graphql"
  )
  .action(async (options) => {
    const spinner = ora("Initializing client...").start();
    const rpcUrl = options.rpc || process.env.RPC_URL;
    const envioClient = new EnvioGraphQLClient({
      endpoint: process.env.INDEXER_URL ?? options.envio,
    });
    if (!rpcUrl) {
      spinner.fail("RPC URL is required");
      process.exit(1);
    }
    const publicClient = createPublicClient({
      transport: http(rpcUrl),
    });
    const chainId = await publicClient.getChainId();
    spinner.stop();
    const multipass = new MultipassBase({
      chainId,
      publicClient,
      envioClient,
    });
    const state = await multipass.getContractState();
    console.log("Total number of domains:", state.toString());
  });

contractCommand
  .command("owner")
  .description("Get the current owner of the contract")
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .option(
    "-e, --envio <url>",
    "Envio GraphQL endpoint URL. If not provided, http://localhost:8080/v1/graphql will be used. Alternatively INDEXER_URL environment variable may be used",
    "http://localhost:8080/v1/graphql"
  )
  .action(async (options) => {
    const spinner = ora("Fetching owner...").start();
    const rpcUrl = options.rpc || process.env.RPC_URL;
    if (!rpcUrl) {
      spinner.fail("RPC URL is required");
      process.exit(1);
    }
    const publicClient = createPublicClient({
      transport: http(rpcUrl),
    });
    const chainId = await publicClient.getChainId();
    spinner.stop();
    const envioClient = new EnvioGraphQLClient({
      endpoint: process.env.INDEXER_URL ?? options.envio,
    });
    const multipass = new MultipassBase({
      chainId,
      publicClient,
      envioClient,
    });
    const owner = await multipass.publicClient.readContract({
      address: multipass.getContractAddress(),
      abi: MultipassAbi,
      functionName: "owner",
      args: [],
    });
    console.log("Contract Owner:", owner);
  });

contractCommand
  .command("eip712-domain")
  .description("Get the EIP712 domain details")
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .option(
    "-e, --envio <url>",
    "Envio GraphQL endpoint URL. If not provided, http://localhost:8080/v1/graphql will be used. Alternatively INDEXER_URL environment variable may be used",
    "http://localhost:8080/v1/graphql"
  )
  .action(async (options) => {
    const spinner = ora("Fetching EIP712 domain...").start();
    const rpcUrl = options.rpc || process.env.RPC_URL;
    if (!rpcUrl) {
      spinner.fail("RPC URL is required");
      process.exit(1);
    }
    const publicClient = createPublicClient({
      transport: http(rpcUrl),
    });
    const chainId = await publicClient.getChainId();
    const envioClient = new EnvioGraphQLClient({
      endpoint: process.env.INDEXER_URL ?? options.envio,
    });
    spinner.stop();
    const multipass = new MultipassBase({
      chainId,
      publicClient,
      envioClient,
    });
    const eip712Domain = await multipass.publicClient.readContract({
      address: multipass.getContractAddress(),
      abi: MultipassAbi,
      functionName: "eip712Domain",
      args: [],
    });
    console.log("EIP712 Domain:", eip712Domain);
  });

contractCommand
  .command("supports-interface")
  .description("Check if a specific interface is supported")
  .argument("<interfaceId>", "Interface ID to check")
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .option(
    "-e, --envio <url>",
    "Envio GraphQL endpoint URL. If not provided, http://localhost:8080/v1/graphql will be used. Alternatively INDEXER_URL environment variable may be used",
    "http://localhost:8080/v1/graphql"
  )
  .action(async (interfaceId: Hex, options) => {
    const spinner = ora("Checking interface support...").start();
    const rpcUrl = options.rpc || process.env.RPC_URL;
    if (!rpcUrl) {
      spinner.fail("RPC URL is required");
      process.exit(1);
    }
    const publicClient = createPublicClient({
      transport: http(rpcUrl),
    });
    const chainId = await publicClient.getChainId();
    const envioClient = new EnvioGraphQLClient({
      endpoint: process.env.INDEXER_URL ?? options.envio,
    });
    spinner.stop();
    const multipass = new MultipassBase({
      chainId,
      publicClient,
      envioClient,
    });
    const isSupported = await multipass.publicClient.readContract({
      address: multipass.getContractAddress(),
      abi: MultipassAbi,
      functionName: "supportsInterface",
      args: [interfaceId],
    });
    console.log(`Interface ${interfaceId} supported:`, isSupported);
  });

contractCommand
  .command("transfer")
  .description("Transfer contract ownership to a new address")
  .argument("<newOwner>", "New owner's address")
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .option(
    "-k, --key <privateKey>",
    "Private key for signing transactions. If not provided, PRIVATE_KEY environment variable will be used"
  )
  .option(
    "-e, --envio <url>",
    "Envio GraphQL endpoint URL. If not provided, http://localhost:8080/v1/graphql will be used. Alternatively INDEXER_URL environment variable may be used",
    "http://localhost:8080/v1/graphql"
  )
  .action(async (newOwner: string, options) => {
    const spinner = ora("Transferring ownership...").start();
    try {
      const publicClient = await createPublic(options.rpc);
      const walletClient = await createWallet(options.rpc, options.key);
      const chainId = Number(await publicClient.getChainId());

      if (!walletClient.account) {
        throw new Error("No account found");
      }
      const envioClient = new EnvioGraphQLClient({
        endpoint: process.env.INDEXER_URL ?? options.envio,
      });
      const multipass = new MultipassBase({
        chainId,
        publicClient,
        envioClient,
      });
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
      const tx = await walletClient.writeContract({
        address: multipass.getContractAddress(),
        abi: MultipassAbi,
        functionName: "transferOwnership",
        args: [newOwner as `0x${string}`],
        account: walletClient.account,
        chain,
      });

      spinner.succeed("Ownership transferred successfully!");
      console.log(chalk.green("Transaction hash:"), tx);
    } catch (error) {
      spinner.fail("Ownership transfer failed");
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });
export default contractCommand;
