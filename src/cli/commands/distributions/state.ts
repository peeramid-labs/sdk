import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { MAODistributorClient } from "../../../rankify/MAODistributor";
import { createPublic, createWallet } from "../../client";
import { DAODistributorAbi } from "../../../abis";
import EnvioGraphQLClient from "../../../utils/EnvioGraphQLClient";

export const stateCommand = new Command("state")
  .description("Get the state of a distribution")
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .option(
    "-d, --distributor <address>",
    "Distributor address, or env DISTRIBUTOR_ADDRESS. If none provided, will attempt to resolve from known chainId artifacts"
  )
  .option(
    "-e, --envio <url>",
    "Envio GraphQL endpoint URL. If not provided, http://localhost:8080/v1/graphql will be used. Alternatively INDEXER_URL environment variable may be used",
    "http://localhost:8080/v1/graphql"
  )
  .action(async (options) => {
    const spinner = ora("Initializing clients...").start();

    const publicClient = await createPublic(options.rpc);
    const walletClient = await createWallet(options.rpc, options.key);
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
      options.distributor || process.env.DISTRIBUTOR_ADDRESS
    );

    const owner = await publicClient.readContract({
      address: maoDistributor.address,
      abi: DAODistributorAbi,
      functionName: "owner",
    });

    spinner.stop();
    console.log(chalk.green(`Owner: ${owner}`));
    const you = walletClient.account?.address;

    const isOwner = owner === you;
    if (isOwner) {
      console.log(chalk.green("You are the owner!"));
    }
  });
