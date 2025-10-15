import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import MultipassBase from "../../../multipass/MultipassBase";
import { createPublic, createWallet } from "../../client";
import MultipassOwner from "../../../multipass/Owner";
import inquirer from "inquirer";
import { Address, Hex, hexToString } from "viem";

const domainsCommand = new Command("domains")
  .addCommand(
    new Command("list")
      .description("List all domains")
      .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
      .option("-a, --active", "Only list active domains")
      .action(async (options) => {
        const spinner = ora("Fetching domains...").start();

        try {
          const publicClient = await createPublic(options.rpc);
          const chainId = Number(await publicClient.getChainId());

          const multipass = new MultipassBase({
            chainId,
            publicClient,
          });

          spinner.stop();

          const domains = await multipass.listDomains(options.active);
          domains.forEach((domain) => {
            console.log(chalk.blue(`Domain ${hexToString(domain.name as Hex)}`));
            console.log({
              name: domain.name,
              registrar: domain.registrar,
              fee: domain.fee.toString(),
              renewalFee: domain.renewalFee.toString(),
              registerSize: domain.registerSize.toString(),
              isActive: domain.isActive,
              referrerReward: domain.referrerReward.toString(),
              referralDiscount: domain.referralDiscount.toString(),
            });
          });
        } catch (error) {
          spinner.fail("Failed to fetch domains");
          console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command("create")
      .description("Create a new domain")
      .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
      .option(
        "-k, --key <privateKey>",
        "Private key for signing transactions. If not provided, PRIVATE_KEY environment variable will be used"
      )
      .option("-n, --name <name>", "Name of the domain")
      .option("-f, --fee <fee>", "Registration fee in wei")
      .option("-w, --renewal-fee <renewalFee>", "Renewal fee in wei")
      .option("-e, --referrer-reward <referrerReward>", "Referrer reward in wei")
      .option("-d, --referral-discount <referralDiscount>", "Referral discount in wei")
      .option("-a, --activate", "Activate the domain immediately after initialization")
      .option("-b, --bytes32", "Use bytes32 encoding with length in last byte (UBI format)")
      .option("-t, --registrar <registrar>", "Registrar address")
      .action(async (options) => {
        const spinner = ora("Initializing domain...").start();

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

          const answers = await inquirer.prompt([
            {
              type: "input",
              name: "name",
              message: "Enter domain name:",
              validate: (input: string) => input.trim() !== "" || "Name cannot be empty",
              when: () => !options.name,
              default: options.name,
            },
            {
              type: "input",
              name: "fee",
              message: "Enter registration fee in wei:",
              validate: (input: string) => !isNaN(parseInt(input)) || "Fee must be a number",
              when: () => !options.fee,
              default: options.fee,
            },
            {
              type: "input",
              name: "renewalFee",
              message: "Enter renewal fee in wei:",
              validate: (input: string) => !isNaN(parseInt(input)) || "Renewal fee must be a number",
              when: () => !options.renewalFee,
              default: options.renewalFee,
            },
            {
              type: "input",
              name: "referrerReward",
              message: "Enter referrer reward in wei:",
              validate: (input: string) => !isNaN(parseInt(input)) || "Referrer reward must be a number",
              when: () => !options.referrerReward,
              default: options.referrerReward,
            },
            {
              type: "input",
              name: "referralDiscount",
              message: "Enter referral discount in wei:",
              validate: (input: string) => !isNaN(parseInt(input)) || "Referral discount must be a number",
              when: () => !options.referralDiscount,
              default: options.referralDiscount,
            },
          ]);

          spinner.start("Initializing domain...");

          const tx = await multipass.initializeDomain({
            registrar: options.registrar || (walletClient.account?.address as Address),
            fee: BigInt(answers.fee || options.fee),
            renewalFee: BigInt(answers.renewalFee || options.renewalFee),
            domainName: answers.name || options.name,
            referrerReward: BigInt(answers.referrerReward || options.referrerReward),
            referralDiscount: BigInt(answers.referralDiscount || options.referralDiscount),
            bytes32: options.bytes32,
          });
          await publicClient.waitForTransactionReceipt({ hash: tx });

          spinner.succeed("Domain initialized successfully!");
          console.log(chalk.green("Transaction hash:"), tx);

          if (options.activate) {
            spinner.start("Activating domain...");
            const activationTx = await multipass.activateDomain(answers.name || options.name, options.bytes32);
            await publicClient.waitForTransactionReceipt({ hash: activationTx });
            spinner.succeed("Domain activated successfully!");
            console.log(chalk.green("Activation transaction hash:"), activationTx);
          }
        } catch (error) {
          spinner.fail("Domain initialization failed");
          console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
          process.exit(1);
        }
      })
  );

export default domainsCommand;
