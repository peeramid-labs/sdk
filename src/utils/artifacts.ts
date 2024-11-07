import { RankToken, RankifyDiamondInstance, MultipassDiamond } from "rankify-contracts/types";
import { JsonFragment } from "@ethersproject/abi";
import { Rankify } from "rankify-contracts/types";
import { ethers } from "ethers";
export type SupportedChains = "anvil" | "localhost";

export const chainIdMapping: { [key in SupportedChains]: string } = {
  anvil: "97113",
  localhost: "1337",
};

export type ArtifactTypes = "Rankify" | "RankifyInstance" | "RankToken" | "Multipass";
/**
 * Retrieves the Rankify artifact for the specified chain.
 * @param chain The chain identifier.
 * @param artifactName
 * @returns The Rankify artifact containing the ABI and address.
 * @throws Error if the contract deployment is not found.
 */
export const getArtifact = (
  chain: SupportedChains,
  artifactName: ArtifactTypes,
): { abi: JsonFragment[]; address: string; execute: { args: string[] } } => {
  const artifact =
    artifactName === "Multipass"
      ? require(`@peeramid-labs/multipass/deployments/${chain}/${artifactName}.json`)
      : require(`rankify-contracts/deployments/${chain}/${artifactName}.json`);
  if (!artifact) {
    throw new Error("Contract deployment not found");
  }
  return artifact;
};
export type ArtifactContractInterfaces = {
  Rankify: Rankify;
  RankToken: RankToken;
  RankifyInstance: RankifyDiamondInstance;
  Multipass: MultipassDiamond;
};

/**
 * Retrieves the contract instance for the specified chain using the provided provider.
 * @param chain The supported chain for the contract.
 * @param provider The Web3Provider or Signer instance used for interacting with the blockchain.
 * @returns The contract instance.
 */
export const getContract = <T extends ArtifactTypes>(
  chain: SupportedChains,
  artifactName: T,
  providerOrSigner: ethers.providers.JsonRpcProvider | ethers.providers.JsonRpcSigner,
) => {
  const artifact = getArtifact(chain, artifactName);

  return new ethers.Contract(artifact.address, artifact.abi, providerOrSigner) as ArtifactContractInterfaces[T];
};
