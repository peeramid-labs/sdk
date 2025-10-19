import { Address, WalletClient, PublicClient } from "viem";
import { RankifyDiamondInstanceAbi } from "../abis";
import { handleRPCError } from "../utils";
import { logger } from "../utils/log";

/**
 * InstanceAdmininstrative class for managing game state and cryptographic operations in Rankify
 * Extends InstanceBase to provide game master specific functionality
 * @public
 */
export class InstanceAdmininstrative {
  walletClient: WalletClient;
  publicClient: PublicClient;
  chainId: number;
  instanceAddress: Address;

  /**
   * Creates a new InstanceAdmininstrative instance

   * @param walletClient - Viem wallet client for transactions
   * @param publicClient - Viem public client for reading state
   * @param chainId - Chain ID of the network
   * @param envioClient - Envio GraphQL client for reading indexed events
   */
  constructor({
    walletClient,
    chainId,
    publicClient,
    instanceAddress,
  }: {
    walletClient: WalletClient;
    publicClient: PublicClient;
    chainId: number;
    instanceAddress: Address;
  }) {
    this.chainId = chainId;
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.instanceAddress = instanceAddress;
  }

  async addWhitelistedGM(address: Address) {
    try {
      // Implementation for adding a whitelisted game master
      const { request } = await this.publicClient.simulateContract({
        abi: RankifyDiamondInstanceAbi,
        account: this.walletClient.account,
        address: this.instanceAddress,
        functionName: "addWhitelistedGM",
        args: [address],
      });
      const hash = await this.walletClient.writeContract(request);

      logger(`Proposing stage ended. Transaction hash: ${hash}`);

      return {
        hash,
      };
    } catch (error) {
      throw await handleRPCError(error);
    }
  }

  async removeWhitelistedGM(address: Address) {
    try {
      // Implementation for adding a whitelisted game master
      const { request } = await this.publicClient.simulateContract({
        abi: RankifyDiamondInstanceAbi,
        account: this.walletClient.account,
        address: this.instanceAddress,
        functionName: "removeWhitelistedGM",
        args: [address],
      });
      const hash = await this.walletClient.writeContract(request);

      logger(`Proposing stage ended. Transaction hash: ${hash}`);

      return {
        hash,
      };
    } catch (error) {
      throw await handleRPCError(error);
    }
  }
}

export default InstanceAdmininstrative;
