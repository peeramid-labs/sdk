import {
  type Address,
  type PublicClient,
  type WalletClient,
  getContract as viemGetContract,
  type GetContractReturnType,
  AbiItem,
  type Chain,
} from "viem";

import rankifyAbi from "../abis/Rankify";
import rankTokenAbi from "../abis/RankToken";
import multipassAbi from "../abis/Multipass";
import simpleAccessManagerAbi from "../abis/SimpleAccessManager";
import DAODistributorabi from "../abis/DAODistributor";

import { chainToPath, getChainPath } from "./chainMapping";

export type SupportedChains = "anvil" | "localhost";

export const chainIdMapping: { [key in SupportedChains]: string } = {
  anvil: "97113",
  localhost: "42161",
};

export type ArtifactTypes = "Rankify" | "Multipass" | "SimpleAccessManager" | "DAODistributor";

export type ArtifactAbi = {
  Rankify: typeof rankifyAbi;
  Multipass: typeof multipassAbi;
  SimpleAccessManager: typeof simpleAccessManagerAbi;
  DAODistributor: typeof DAODistributorabi;
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
  overrideChainName?: string,
): { abi: readonly AbiItem[]; address: Address; execute: { args: string[] } } => {
  const chainPath = overrideChainName ?? getChainPath(chainId);
  const artifact =
    artifactName === "Multipass"
      ? require(`@peeramid-labs/multipass/deployments/${chainPath}/${artifactName}.json`)
      : require(`rankify-contracts/deployments/${chainPath}/${artifactName}.json`);

  if (!artifact) {
    throw new Error("Contract deployment not found");
  }
  return {
    address: artifact.address as Address,
    execute: artifact.execute,
    abi: artifact.abi,
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
): GetContractReturnType<ArtifactAbi[TArtifactName], TClient> => {
  const artifact = getArtifact(chainId, artifactName);
  return viemGetContract({
    address: artifact.address,
    abi: artifact.abi,
    client,
  }) as GetContractReturnType<ArtifactAbi[TArtifactName], TClient>;
};
