import { Command } from "commander";
import { createPublic } from "../../client";
import chalk from "chalk";
import inquirer from "inquirer";
import { encodePacked, getAddress, keccak256 } from "viem";
import { ERC7744Abi } from "../../../abis";

export const edsCommand = new Command("eds")
  .description("Manage EDS")
  .addCommand(new Command("exists").description("Check if code index exists"))
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .action(async (options) => {
    const publicClient = await createPublic(options.rpc);
    const code = await publicClient.getCode({
      address: "0xC0dE1D2F7662c63796E544B2647b2A94EE658E07",
    });
    console.log(code ? chalk.green("Code index exists") : chalk.red("Code index does not exist"));
  })
  .addCommand(
    new Command("indexed")
      .description("Checks if contract is in the index")
      .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
      .option("-a, --address <address>", "Address of the contract to check")
      .action(async (options) => {
        const publicClient = await createPublic(options.rpc);

        let address = options.address;
        if (!address) {
          const response = await inquirer.prompt([
            {
              type: "input",
              name: "address",
              message: "Enter address of the contract to check",
            },
          ]);
          address = response.address;
        }
        const code = await publicClient.getCode({
          address: getAddress(address),
        });
        if (code) {
          const hashCode = keccak256(encodePacked(["bytes"], [code]));
          const distrAddress = await publicClient.readContract({
            abi: ERC7744Abi,
            address: "0xC0dE1D2F7662c63796E544B2647b2A94EE658E07",
            functionName: "get",
            args: [hashCode],
          });
          const indexed = distrAddress !== "0x0000000000000000000000000000000000000000";
          console.log(indexed ? chalk.green("Contract is in the index") : chalk.red("Contract is not in the index"));
        } else {
          console.log(chalk.red("Contract is not in the index"));
        }
      })
  );
