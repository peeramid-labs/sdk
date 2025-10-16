import { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import { stringToHex, type Address, zeroAddress, hexToString, Hex } from "viem";
import MultipassBase from "../../../multipass/MultipassBase";
import MultipassOwner, { type NameQuery, type Record } from "../../../multipass/Owner";
import { createPublic, createWallet } from "../../client";
import EnvioGraphQLClient from "../../../utils/EnvioGraphQLClient";

export const domainCommand = new Command("domain").description("Domain operations for Multipass").addCommand(
  new Command("query")
    .description("Query for user records")
    .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
    .option(
      "-e, --envio <url>",
      "Envio GraphQL endpoint URL. If not provided, http://localhost:8080/v1/graphql will be used. Alternatively INDEXER_URL environment variable may be used",
      "http://localhost:8080/v1/graphql"
    )
    .action(async (options) => {
      const spinner = ora("Initializing client...").start();

      try {
        const publicClient = await createPublic(options.rpc);
        const chainId = Number(await publicClient.getChainId());
        const envioClient = new EnvioGraphQLClient({
          endpoint: process.env.INDEXER_URL ?? options.envio,
        });
        const multipass = new MultipassBase({
          chainId,
          publicClient,
          envioClient,
        });

        spinner.text = "Please select query type...";
        spinner.stop();

        const { queryType } = await inquirer.prompt([
          {
            type: "list",
            name: "queryType",
            message: "Select query type:",
            choices: [
              { name: "Query by Address", value: "address" },
              { name: "Query by ID", value: "id" },
              { name: "Query by Username", value: "username" },
              { name: "Query by Username and ID", value: "usernameAndId" },
              { name: "Query by Full Details", value: "fullDetails" },
            ],
          },
        ]);

        let query;
        switch (queryType) {
          case "address": {
            const { address, domainName, targetDomain } = await inquirer.prompt([
              {
                type: "input",
                name: "address",
                message: "Enter wallet address:",
                validate: (input: string) => input.trim() !== "" || "Address cannot be empty",
              },
              {
                type: "input",
                name: "domainName",
                message: "Enter domain name:",
                validate: (input: string) => input.trim() !== "" || "Domain name cannot be empty",
              },
              {
                type: "input",
                name: "targetDomain",
                message: "Enter target domain (optional):",
              },
            ]);
            query = multipass.formQueryByAddress({ address, domainName, targetDomain });
            break;
          }
          case "id": {
            const { id, domainName, targetDomain } = await inquirer.prompt([
              {
                type: "input",
                name: "id",
                message: "Enter ID:",
                validate: (input: string) => input.trim() !== "" || "ID cannot be empty",
              },
              {
                type: "input",
                name: "domainName",
                message: "Enter domain name:",
                validate: (input: string) => input.trim() !== "" || "Domain name cannot be empty",
              },
              {
                type: "input",
                name: "targetDomain",
                message: "Enter target domain (optional):",
              },
            ]);
            query = multipass.formQueryById({ id, domainName, targetDomain });
            break;
          }
          case "username": {
            const { username, domainName, targetDomain } = await inquirer.prompt([
              {
                type: "input",
                name: "username",
                message: "Enter username:",
                validate: (input: string) => input.trim() !== "" || "Username cannot be empty",
              },
              {
                type: "input",
                name: "domainName",
                message: "Enter domain name:",
                validate: (input: string) => input.trim() !== "" || "Domain name cannot be empty",
              },
              {
                type: "input",
                name: "targetDomain",
                message: "Enter target domain (optional):",
              },
            ]);
            query = multipass.formQueryByUsername({ username, domainName, targetDomain });
            break;
          }
          case "usernameAndId": {
            const { username, id, domainName, targetDomain } = await inquirer.prompt([
              {
                type: "input",
                name: "username",
                message: "Enter username:",
                validate: (input: string) => input.trim() !== "" || "Username cannot be empty",
              },
              {
                type: "input",
                name: "id",
                message: "Enter ID:",
                validate: (input: string) => input.trim() !== "" || "ID cannot be empty",
              },
              {
                type: "input",
                name: "domainName",
                message: "Enter domain name:",
                validate: (input: string) => input.trim() !== "" || "Domain name cannot be empty",
              },
              {
                type: "input",
                name: "targetDomain",
                message: "Enter target domain (optional):",
              },
            ]);
            query = multipass.formQueryByUsernameAndId({ username, id, domainName, targetDomain });
            break;
          }
          case "fullDetails": {
            const { username, id, address, domainName, targetDomain } = await inquirer.prompt([
              {
                type: "input",
                name: "username",
                message: "Enter username:",
                validate: (input: string) => input.trim() !== "" || "Username cannot be empty",
              },
              {
                type: "input",
                name: "id",
                message: "Enter ID:",
                validate: (input: string) => input.trim() !== "" || "ID cannot be empty",
              },
              {
                type: "input",
                name: "address",
                message: "Enter wallet address:",
                validate: (input: string) => input.trim() !== "" || "Address cannot be empty",
              },
              {
                type: "input",
                name: "domainName",
                message: "Enter domain name:",
                validate: (input: string) => input.trim() !== "" || "Domain name cannot be empty",
              },
              {
                type: "input",
                name: "targetDomain",
                message: "Enter target domain (optional):",
              },
            ]);
            query = multipass.formQueryByFullDetails({ username, id, address, domainName, targetDomain });
            break;
          }
        }

        spinner.succeed("Query formed successfully!");

        if (!query) {
          throw new Error("Failed to form query");
        }

        console.log("\nQuery Details:");
        console.log(chalk.green("Name:"), query.name);
        console.log(chalk.green("ID:"), query.id);
        console.log(chalk.green("Wallet:"), query.wallet);
        console.log(chalk.green("Domain Name:"), query.domainName);
        console.log(chalk.green("Target Domain:"), query.targetDomain);
      } catch (error) {
        spinner.fail("Query formation failed");
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    })
);

interface RegisterAnswers {
  name: string;
  id: string;
  domainName: string;
  validUntil: string;
  registrarSignature: string;
  referrerAddress: string;
  referralCode: string;
  wallet: string;
}

interface RenewAnswers {
  name: string;
  id: string;
  domainName: string;
  validUntil: string;
  registrarSignature: string;
  wallet: string;
}

domainCommand
  .addCommand(
    new Command("register")
      .description("Register a new record for a user")
      .option("-n, --name <name>", "Name to register")
      .option("-i, --id <id>", "ID to register")
      .option("-d, --domain <domainName>", "Domain name")
      .option("-v, --valid-until <validUntil>", "Valid until timestamp (in seconds)")
      .option("-s, --signature <registrarSignature>", "Registrar signature")
      .option("-f, --referrer <referrerAddress>", "Referrer address (optional)")
      .option("-c, --code <referralCode>", "Referral code (optional)")
      .option(
        "-e, --envio <url>",
        "Envio GraphQL endpoint URL. If not provided, http://localhost:8080/v1/graphql will be used. Alternatively INDEXER_URL environment variable may be used",
        "http://localhost:8080/v1/graphql"
      )
      .action(async (options) => {
        const spinner = ora("Initializing clients...").start();

        try {
          const publicClient = await createPublic(options.rpc);
          const walletClient = await createWallet(options.rpc, options.key);
          const chainId = Number(await publicClient.getChainId());
          const envioClient = new EnvioGraphQLClient({
            endpoint: process.env.INDEXER_URL ?? options.envio,
          });
          const multipass = new MultipassOwner({
            chainId,
            walletClient,
            publicClient,
            envioClient,
          });

          spinner.stop();

          const answers = await inquirer.prompt<RegisterAnswers>([
            {
              type: "input",
              name: "name",
              message: "Enter name:",
              validate: (input: string) => input.trim() !== "" || "Name cannot be empty",
              when: () => !options.name,
              default: options.name,
            },
            {
              type: "input",
              name: "id",
              message: "Enter ID:",
              validate: (input: string) => input.trim() !== "" || "ID cannot be empty",
              when: () => !options.id,
              default: options.id,
            },
            {
              type: "input",
              name: "domainName",
              message: "Enter domain name:",
              validate: (input: string) => input.trim() !== "" || "Domain name cannot be empty",
              when: () => !options.domain,
              default: options.domain,
            },
            {
              type: "input",
              name: "validUntil",
              message: "Enter valid until timestamp (in seconds):",
              validate: (input: string) => {
                const num = parseInt(input);
                return !isNaN(num) && num > Date.now() / 1000 ? true : "Please enter a valid future timestamp";
              },
              when: () => !options.validUntil,
              default: options.validUntil,
            },
            {
              type: "input",
              name: "registrarSignature",
              message: "Enter registrar signature:",
              validate: (input: string) => input.trim() !== "" || "Signature cannot be empty",
              when: () => !options.signature,
              default: options.signature,
            },
            {
              type: "input",
              name: "referrerAddress",
              message: "Enter referrer address (optional):",
              default: options.referrer || zeroAddress,
              when: () => !options.referrer,
            },
            {
              type: "input",
              name: "referralCode",
              message: "Enter referral code (optional):",
              default: options.code || "0x",
              when: () => !options.code,
            },
            {
              type: "input",
              name: "wallet",
              message: "Enter wallet address:",
              default: options.wallet,
              when: () => !options.wallet,
            },
          ]);

          spinner.start("Registering name...");

          const record: Record = {
            name: stringToHex(answers.name || options.name, { size: 32 }),
            id: stringToHex(answers.id || options.id, { size: 32 }),
            domainName: stringToHex(answers.domainName || options.domain, { size: 32 }),
            validUntil: BigInt(answers.validUntil || options.validUntil),
            nonce: 0n,
            wallet: (answers.wallet || options.wallet) as Address,
          };

          const referrer: NameQuery | undefined =
            (answers.referrerAddress || options.referrer) !== zeroAddress
              ? {
                  name: "0x" as `0x${string}`,
                  id: "0x" as `0x${string}`,
                  wallet: (answers.referrerAddress || options.referrer) as Address,
                  domainName: stringToHex(answers.domainName || options.domain, { size: 32 }),
                  targetDomain: "0x" as `0x${string}`,
                }
              : undefined;

          const tx = await multipass.register({
            record,
            registrarSignature: (answers.registrarSignature || options.signature) as `0x${string}`,
            referrer,
            referralCode: (answers.referralCode || options.code) as `0x${string}`,
          });

          spinner.succeed("Name registered successfully!");
          console.log(chalk.green("Transaction hash:"), tx);
        } catch (error) {
          spinner.fail("Registration failed");
          console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command("renew")
      .description("Renew a record for a user")
      .option("-n, --name <name>", "Name to renew")
      .option("-i, --id <id>", "ID to renew")
      .option("-d, --domain <domainName>", "Domain name")
      .option("-v, --valid-until <validUntil>", "Valid until timestamp (in seconds)")
      .option("-s, --signature <registrarSignature>", "Registrar signature")
      .option("-w, --wallet <address>", "Wallet address")
      .option(
        "-e, --envio <url>",
        "Envio GraphQL endpoint URL. If not provided, http://localhost:8080/v1/graphql will be used. Alternatively INDEXER_URL environment variable may be used",
        "http://localhost:8080/v1/graphql"
      )
      .action(async (options) => {
        const spinner = ora("Initializing clients...").start();

        try {
          const publicClient = await createPublic(options.rpc);
          const walletClient = await createWallet(options.rpc, options.key);
          const chainId = Number(await publicClient.getChainId());
          const envioClient = new EnvioGraphQLClient({
            endpoint: process.env.INDEXER_URL ?? options.envio,
          });
          const multipass = new MultipassOwner({
            chainId,
            walletClient,
            publicClient,
            envioClient,
          });

          spinner.stop();

          const answers = await inquirer.prompt<RenewAnswers>([
            {
              type: "input",
              name: "name",
              message: "Enter name:",
              validate: (input: string) => input.trim() !== "" || "Name cannot be empty",
              when: () => !options.name,
              default: options.name,
            },
            {
              type: "input",
              name: "id",
              message: "Enter ID:",
              validate: (input: string) => input.trim() !== "" || "ID cannot be empty",
              when: () => !options.id,
              default: options.id,
            },
            {
              type: "input",
              name: "domainName",
              message: "Enter domain name:",
              validate: (input: string) => input.trim() !== "" || "Domain name cannot be empty",
              when: () => !options.domain,
              default: options.domain,
            },
            {
              type: "input",
              name: "validUntil",
              message: "Enter valid until timestamp (in seconds):",
              validate: (input: string) => {
                const num = parseInt(input);
                return !isNaN(num) && num > Date.now() / 1000 ? true : "Please enter a valid future timestamp";
              },
              when: () => !options.validUntil,
              default: options.validUntil,
            },
            {
              type: "input",
              name: "registrarSignature",
              message: "Enter registrar signature:",
              validate: (input: string) => input.trim() !== "" || "Signature cannot be empty",
              when: () => !options.signature,
              default: options.signature,
            },
            {
              type: "input",
              name: "wallet",
              message: "Enter wallet address:",
              default: options.wallet,
              when: () => !options.wallet,
            },
          ]);

          spinner.start("Renewing record...");

          const query: NameQuery = {
            name: stringToHex(answers.name || options.name, { size: 32 }),
            id: stringToHex(answers.id || options.id, { size: 32 }),
            domainName: stringToHex(answers.domainName || options.domain, { size: 32 }),
            targetDomain: "0x" as `0x${string}`,
            wallet: zeroAddress,
          };

          const record: Record = {
            name: stringToHex(answers.name || options.name, { size: 32 }),
            id: stringToHex(answers.id || options.id, { size: 32 }),
            domainName: stringToHex(answers.domainName || options.domain, { size: 32 }),
            validUntil: BigInt(answers.validUntil || options.validUntil),
            nonce: 1n,
            wallet: (answers.wallet || options.wallet) as Address,
          };

          const tx = await multipass.renewRecord({
            query,
            record,
            registrarSignature: (answers.registrarSignature || options.signature) as `0x${string}`,
          });
          spinner.succeed("Record renewed successfully!");
          console.log(chalk.green("Transaction hash:"), tx);
        } catch (error) {
          spinner.fail("Renewal failed");
          console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command("activate")
      .description("Activate a domain")
      .argument("<domainName>", "Name of the domain to activate")
      .option("-b, --bytes32", "Use bytes32 encoding with length in last byte (UBI format)")
      .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
      .option(
        "-k, --key <privateKey>",
        "Private key for signing transactions. If not provided, PRIVATE_KEY environment variable will be used"
      )
      .action(async (domainName, options) => {
        const spinner = ora("Activating domain...").start();

        try {
          const publicClient = await createPublic(options.rpc);
          const walletClient = await createWallet(options.rpc, options.key);
          const chainId = Number(await publicClient.getChainId());

          const multipass = new MultipassOwner({
            chainId,
            walletClient,
            publicClient,
          });

          spinner.stop();

          // Show information about encoding format
          if (options.bytes32) {
            console.log(chalk.yellow("Using UBI bytes32 format (length encoded in last byte)"));
          }

          const tx = await multipass.activateDomain(domainName, options.bytes32);

          spinner.succeed("Domain activated successfully!");
          console.log(chalk.green("Transaction hash:"), tx);
          console.log(chalk.green("Domain name:"), domainName);
          if (options.bytes32) {
            console.log(chalk.green("Bytes32 (UBI format):"), multipass.getShortStringBytes32(domainName));
          } else {
            console.log(chalk.green("Bytes32 (standard):"), stringToHex(domainName, { size: 32 }));
          }
        } catch (error) {
          spinner.fail("Domain activation failed");
          console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command("state")
      .description("Get the state of a domain")
      .argument("<domainName>", "Name of the domain to get the state for")
      .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
      .action(async (domainName, options) => {
        const spinner = ora("Fetching domain state...").start();

        try {
          const publicClient = await createPublic(options.rpc);
          const chainId = Number(await publicClient.getChainId());

          const multipass = new MultipassBase({
            chainId,
            publicClient,
          });

          spinner.stop();

          const state = await multipass.getDomainState(stringToHex(domainName, { size: 32 }));

          console.log("Domain State:", {
            name: state.name,
            registrar: state.registrar,
            fee: state.fee.toString(),
            renewalFee: state.renewalFee.toString(),
            registerSize: state.registerSize.toString(),
            isActive: state.isActive,
            referrerReward: state.referrerReward.toString(),
            referralDiscount: state.referralDiscount.toString(),
          });
        } catch (error) {
          spinner.fail("Failed to fetch domain state");
          console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command("records")
      .description("List all records on a domain")
      .argument("<domainName>", "Name of the domain to list records for")
      .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
      .option("-a, --active", "Only list active records")
      .action(async (domainName, options) => {
        const spinner = ora("Fetching records...").start();

        try {
          const publicClient = await createPublic(options.rpc);
          const chainId = Number(await publicClient.getChainId());

          const multipass = new MultipassBase({
            chainId,
            publicClient,
          });

          spinner.stop();

          const records = await multipass.listRecords(options.active);

          console.log("Records:");
          records.forEach(({ record, isActive }) => {
            if (hexToString(record.domainName as Hex) === domainName) {
              console.log({
                name: record.name,
                id: record.id,
                domainName: record.domainName,
                isActive,
              });
            }
          });
        } catch (error) {
          spinner.fail("Failed to fetch records");
          console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
          process.exit(1);
        }
      })
  );
