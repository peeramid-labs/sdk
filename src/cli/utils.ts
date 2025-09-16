import { Address, PublicClient, getAddress } from "viem";
import { MAODistributorClient } from "../rankify/MAODistributor";
import chalk from "chalk";
import { Ora } from "ora";
import EnvioGraphQLClient from "../utils/EnvioGraphQLClient";
import { getArtifact, ArtifactTypes } from "../utils/artifacts";
import instanceAbi from "../abis/RankifyDiamondInstance";
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
    envioClient: EnvioGraphQLClient,
    maoDistributionName: string,
    spinner?: Ora
  ): Promise<Address> {
    // Check if instanceAddress is a number (instance ID) or an address
    const isInstanceId = !instanceAddress.startsWith("0x") && !isNaN(Number(instanceAddress));

    if (isInstanceId) {
      // It's a number, get the instance address using MAODistributorClient
      if (spinner) {
        spinner.text = "Resolving instance ID to address...";
      }

      const maoDistributor = new MAODistributorClient(chainId, { publicClient, envioClient });
      try {
        const instanceId = BigInt(instanceAddress);
        const instance = await maoDistributor.getMAOInstance({ name: maoDistributionName, instanceId });
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

  /**
   * Creates an override artifact for unsupported chains by getting payment token from instance contract
   * @param chainId - The chain ID to check support for
   * @param artifactName - The name of the artifact to check support for
   * @param instanceAddress - The instance address to query for payment token
   * @param publicClient - The public client for contract calls
   * @param spinner - Optional ora spinner for status updates
   * @returns Override artifact object or undefined if chain is supported
   */
  static async overrideArtifact(
    chainId: number,
    artifactName: ArtifactTypes,
    instanceAddress: Address,
    publicClient: PublicClient,
    spinner?: Ora
  ): Promise<{ address: `0x${string}`; pathOverride: string } | undefined> {
    try {
      // Try to get artifacts for current chain
      getArtifact(chainId, artifactName);
      return undefined; // Chain is supported, no override needed
    } catch {
      if (spinner) {
        spinner.text = "Chain not supported, getting payment token from instance contract...";
      }

      try {
        // Get payment token address from instance contract
        const commonParams = await publicClient.readContract({
          abi: instanceAbi,
          address: instanceAddress,
          functionName: "getCommonParams",
        });

        // Fallback to arbsepolia for ABI but use actual payment token address
        const overrideArtifact = {
          address: commonParams.gamePaymentToken as `0x${string}`,
          pathOverride: "arbsepolia",
        };

        console.warn(
          `\n⚠️  Chain ${chainId} not supported for ${artifactName} token artifacts.\n` +
            `Using payment token from instance contract: ${commonParams.gamePaymentToken}\n` +
            `Falling back to Arbitrum Sepolia artifacts for ABI compatibility.\n`
        );

        return overrideArtifact;
      } catch (error) {
        if (spinner) {
          spinner.fail("Failed to get payment token from instance contract");
        }
        throw new Error(
          `Failed to create override artifact: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }
}
