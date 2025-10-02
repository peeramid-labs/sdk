import {
  type Address,
  type PublicClient,
  type WalletClient,
  getContract as viemGetContract,
  type GetContractReturnType,
  AbiItem,
  Hex,
  Log,
  parseEventLogs,
} from "viem";

import rankifyAbi from "../abis/Rankify";
import multipassAbi from "../abis/Multipass";
import simpleAccessManagerAbi from "../abis/SimpleAccessManager";
import DAODistributorabi from "../abis/DAODistributor";
import MaoDistributionAbi from "../abis/MAODistribution";
import { getChainPath } from "./chainMapping";
import { ERC7744Abi } from "../abis";

export type SupportedChains = "anvil" | "localhost" | "arbsepolia";

export const chainIdMapping: { [key in SupportedChains]: string } = {
  anvil: "97113",
  localhost: "42161",
  arbsepolia: "421614",
};

export type ArtifactTypes =
  | "Rankify"
  | "Multipass"
  | "SimpleAccessManager"
  | "DAODistributor"
  | "CodeIndex"
  | "MAODistribution";

export type ArtifactAbi = {
  Rankify: typeof rankifyAbi;
  Multipass: typeof multipassAbi;
  SimpleAccessManager: typeof simpleAccessManagerAbi;
  DAODistributor: typeof DAODistributorabi;
  CodeIndex: typeof ERC7744Abi;
  MAODistribution: typeof MaoDistributionAbi;
};

/**
 * Retrieves the contract artifact for the specified chain.
 * @param chain The viem Chain object
 * @param artifactName The name of the artifact to retrieve
 * @returns The artifact containing the address and execution args
 * @throws Error if the contract deployment is not found or chain is not supported.
 */
export const getArtifact = (
  chainId: number,
  artifactName: ArtifactTypes,
  overrideChainName?: string
): {
  abi: readonly AbiItem[];
  address: Address;
  execute: { args: string[] };
  receipt: {
    from: Address;
    transactionHash: Hex;
    blockNumber: number;
    args: string[];
    logs: Log<bigint, number, false>[];
  };
} => {
  if (artifactName === "CodeIndex") {
    return {
      abi: ERC7744Abi,
      address: "0xC0dE1D2F7662c63796E544B2647b2A94EE658E07",
      execute: { args: [] },
      receipt: {
        from: "0xC0dE1D2F7662c63796E544B2647b2A94EE658E07",
        transactionHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
        blockNumber: 0,
        args: [],
        logs: [],
      },
    };
  }
  let chainPath: string;
  if (overrideChainName) {
    chainPath = overrideChainName;
  } else {
    chainPath = getChainPath(chainId);
    if (chainPath === "Custom network") {
      chainPath = "arbsepolia";
    }
  }

  const artifact = (
    artifactName === "Multipass"
      ? require(`@peeramid-labs/multipass/deployments/${chainPath}/${artifactName}.json`)
      : require(`rankify-contracts/deployments/${chainPath}/${artifactName}.json`)
  ) as {
    abi: AbiItem[];
    address: Address;
    execute: { args: string[] };
    receipt: {
      from: Address;
      transactionHash: Hex;
      blockNumber: number;
      args: string[];
      logs?: Log<bigint, number, false>[];
    };
  };

  if (!artifact) {
    throw new Error("Contract deployment not found");
  }

  return {
    address: artifact.address,
    execute: artifact.execute,
    abi: artifact.abi,
    receipt: { ...artifact.receipt, logs: parseEventLogs({ abi: artifact.abi, logs: artifact.receipt?.logs ?? [] }) },
  };
};

/**
 * Gets a contract instance with the appropriate ABI and address for the given chain
 * @param chain The chain to get the contract for
 * @param artifactName The name of the contract to get
 * @param client The viem client to use (public or wallet)
 * @returns A viem contract instance
 */
export const getContract = <TArtifactName extends ArtifactTypes, TClient extends PublicClient | WalletClient>(
  chainId: number,
  artifactName: TArtifactName,
  client: TClient,
  overrideArtifact?: {
    address: Address;
    pathOverride: string;
  }
): GetContractReturnType<ArtifactAbi[TArtifactName], TClient> => {
  const artifact = getArtifact(chainId, artifactName, overrideArtifact && overrideArtifact.pathOverride);
  return viemGetContract({
    address: overrideArtifact ? overrideArtifact.address : artifact.address,
    abi: artifact.abi,
    client,
  }) as GetContractReturnType<ArtifactAbi[TArtifactName], TClient>;
};

/**
 * Binary searches for the block where a contract was first deployed
 * @param client The viem public client to use
 * @param address The contract address to search for
 * @param startBlock The block to start searching from (defaults to 0)
 * @param endBlock The block to end searching at (defaults to 'latest')
 * @returns The block number where the contract was first deployed
 */
// eslint-disable-next-line
export const findContractDeploymentBlock = async (
  client: PublicClient,
  address: Address,
  startBlock: bigint = 0n,
  endBlock?: bigint
): Promise<bigint> => {
  const latestBlock = endBlock ?? (await client.getBlockNumber());
  let left = startBlock;
  let right = latestBlock;
  let result = 0n;

  while (left <= right) {
    const mid = left + (right - left) / 2n;
    const code = await client.getCode({ address, blockNumber: mid });

    if (code && code !== "0x") {
      // Contract exists at this block, try earlier
      result = mid;
      right = mid - 1n;
    } else {
      // Contract doesn't exist, try later blocks
      left = mid + 1n;
    }
  }

  return result;
};
