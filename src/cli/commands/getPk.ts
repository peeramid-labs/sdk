import { Command } from "commander";
import chalk from "chalk";
import { getPkFromMnemonic } from "../getPk";
import { privateKeyToAccount } from "viem/accounts";

export const getPkCommand = new Command("getPk")
  .description("Derive a private key from a mnemonic phrase")
  .option("-i, --index <number>", "Index of the private key to derive", "0")
  .option("-s, --show", "Show the private key in the console (use with caution)")
  .action(async (options) => {
    try {
      let privateKey;
      const index = parseInt(options.index);
      
      if (isNaN(index) || index < 0) {
        throw new Error("Index must be a non-negative integer");
      }
      
      // Get private key from mnemonic
      privateKey = getPkFromMnemonic(index);
      console.log(chalk.blue(`\nDerived private key at index ${index}`));
      
      // Get the account address from the private key
      const account = privateKeyToAccount(privateKey);
      
      if (options.show) {
        console.log(chalk.green("\nPrivate Key:"), privateKey);
        console.log(chalk.yellow("\nWarning: Never share your private key with anyone!"));
      } else {
        // Only show the first and last few characters for safety
        const maskedKey = `${privateKey.substring(0, 6)}...${privateKey.substring(privateKey.length - 4)}`;
        console.log(chalk.green("\nPrivate Key (masked):"), maskedKey);
        console.log(chalk.yellow("\nUse the --show flag to display the full private key (use with caution)"));
      }
      
      // Show account address
      console.log(chalk.green("\nAccount Address:"), account.address);
      
      // Show derivation path info
      console.log(chalk.dim("\nDerivation Path:"), `m/44'/60'/0'/0/${index}`);
      
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

export default getPkCommand;
