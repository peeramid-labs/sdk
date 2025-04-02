import { Address, PublicClient, getAddress } from "viem";
import { MAODistributorClient } from "../rankify/MAODistributor";
import chalk from "chalk";
import { Ora } from "ora";

/**
 * Utility functions for CLI commands
 */
export class CLIUtils {
  /**
   * Resolves an instance address from either an ID or a direct address
   * @param instanceAddress - The instance address or ID
   * @param chainId - The chain ID
   * @param publicClient - The public client
   * @param spinner - Optional ora spinner for status updates
   * @returns The resolved instance address
   */
  static async resolveInstanceAddress(
    instanceAddress: string,
    chainId: number,
    publicClient: PublicClient,
    spinner?: Ora
  ): Promise<Address> {
    // Check if instanceAddress is a number (instance ID) or an address
    const isInstanceId = !instanceAddress.startsWith('0x') && !isNaN(Number(instanceAddress));
    
    if (isInstanceId) {
      // It's a number, get the instance address using MAODistributorClient
      if (spinner) {
        spinner.text = "Resolving instance ID to address...";
      }
      
      const maoDistributor = new MAODistributorClient(chainId, { publicClient });
      try {
        const instanceId = BigInt(instanceAddress);
        const instance = await maoDistributor.getMAOInstance({ instanceId });
        const resolvedAddress = instance.instance.address;
        
        if (spinner) {
          spinner.succeed(`Resolved instance ID ${instanceAddress} to address ${resolvedAddress}`);
        }
        
        return resolvedAddress;
      } catch (error) {
        if (spinner) {
          spinner.fail(`Failed to resolve instance ID ${instanceAddress}`);
        }
        
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    } else {
      // It's already an address
      try {
        return getAddress(instanceAddress);
      } catch (error) {
        if (spinner) {
          spinner.fail(`Invalid instance address: ${instanceAddress}`);
        }
        
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    }
  }
}
