import { PublicClient } from "viem";
import { Ora } from "ora";

/**
 * Utility functions for blockchain operations
 */
export class BlockchainUtils {
  /**
   * Checks if the current chain is a local development chain
   * @param chainId The chain ID to check
   * @returns True if the chain is a local development chain
   */
  static isLocalChain(chainId: number): boolean {
    // Hardhat = 31337, Ganache = 1337, Anvil = 97113
    return chainId === 31337 || chainId === 1337 || chainId === 97113;
  }

  /**
   * Increases the next block timestamp and mines a new block
   * @param publicClient The viem public client
   * @param timeIncrease Number of seconds to increase the timestamp by
   * @param spinner Optional ora spinner for displaying progress
   * @returns Object containing the old and new block information
   */
  static async increaseTimeAndMine(
    publicClient: PublicClient,
    timeIncrease: number,
    spinner?: Ora
  ): Promise<{
    oldBlock: { number: bigint; timestamp: bigint };
    newBlock: { number: bigint; timestamp: bigint };
    actualIncrease: number;
  }> {
    // Get current block
    const currentBlock = await publicClient.getBlock({ blockTag: "latest" });
    
    if (spinner) {
      spinner.info(`Current block: ${currentBlock.number}, timestamp: ${currentBlock.timestamp}`);
    }

    // Calculate new timestamp
    const newTimestamp = Number(currentBlock.timestamp) + timeIncrease;
    
    if (spinner) {
      spinner.start(`Increasing block timestamp by ${timeIncrease} seconds and mining a new block...`);
    }
    
    // Use JSON-RPC methods directly to manipulate local blockchain
    // First, set the next block's timestamp
    await publicClient.transport.request({
      method: "evm_setNextBlockTimestamp",
      params: [newTimestamp],
    });
    
    // Then mine a block
    await publicClient.transport.request({
      method: "evm_mine",
      params: [],
    });
    
    // Get the new block to confirm changes
    const newBlock = await publicClient.getBlock({ blockTag: "latest" });
    
    return {
      oldBlock: {
        number: currentBlock.number,
        timestamp: currentBlock.timestamp
      },
      newBlock: {
        number: newBlock.number,
        timestamp: newBlock.timestamp
      },
      actualIncrease: Number(newBlock.timestamp) - Number(currentBlock.timestamp)
    };
  }
}
