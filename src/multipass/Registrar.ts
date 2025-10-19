import { type Address, type WalletClient, type Hex, TypedDataDomain, PublicClient } from "viem";
import { getArtifact } from "../utils";
import type { RegisterMessage } from "../types";
import MultipassBase from "./MultipassBase";
import EnvioGraphQLClient from "../utils/EnvioGraphQLClient";

/**
 * Structure representing a name query for Multipass
 * @public
 */
export type NameQuery = {
  /** Hex-encoded name */
  name: Hex;
  /** Hex-encoded ID */
  id: Hex;
  /** Wallet address */
  wallet: Address;
  /** Hex-encoded domain name */
  domainName: Hex;
  /** Hex-encoded target domain */
  targetDomain: Hex;
};

/**
 * Main Multipass class for handling registrations and queries
 * @extends MultipassBase
 */
export default class Multipass extends MultipassBase {
  /** Name of the contract */
  private name: string;
  /** Version of the contract */
  private version: string;
  /** Wallet client for signing transactions */
  private walletClient: WalletClient;

  /**
   * Creates a new Multipass instance
   * @param params - Constructor parameters
   * @param params.chainId - ID of the blockchain network
   * @param params.walletClient - Wallet client for signing transactions
   */
  constructor({
    chainId,
    walletClient,
    publicClient,
    envioClient,
  }: {
    chainId: number;
    walletClient: WalletClient;
    publicClient: PublicClient;
    envioClient: EnvioGraphQLClient;
  }) {
    super({ chainId, publicClient, envioClient });
    const artifact = getArtifact(chainId, "Multipass");
    this.name = artifact.execute.args[0];
    this.version = artifact.execute.args[1];
    this.walletClient = walletClient;
  }

  /**
   * Signs a registrar message for registration
   * @param message - Message to sign
   * @param verifierAddress - Address of the verifier contract
   * @returns Signed message
   */
  public signRegistrarMessage = async (message: RegisterMessage, verifierAddress: Address) => {
    if (!this.walletClient.account?.address) throw new Error("No account found");

    const domain: TypedDataDomain = {
      name: this.name,
      version: this.version,
      chainId: this.chainId,
      verifyingContract: verifierAddress,
    };

    const types = {
      registerName: [
        { type: "bytes32", name: "name" },
        { type: "bytes32", name: "id" },
        { type: "bytes32", name: "domainName" },
        { type: "uint256", name: "validUntil" },
        { type: "uint96", name: "nonce" },
      ],
    } as const;

    return this.walletClient.signTypedData({
      account: this.walletClient.account,
      domain: domain,
      types,
      primaryType: "registerName",
      message: { ...message },
    });
  };

  /**
   * Generates a URL for a dapp
   * @param message - Message object to be encoded in the URL
   * @param signature - Signature to be encoded in the URL
   * @param basepath - Base path of the URL
   * @param contractAddress - Address of the contract
   * @returns The generated URL
   */
  public getDappURL(message: object, signature: string, basepath: string, contractAddress: string): string {
    return super.getDappURL(message, signature, basepath, contractAddress);
  }
}
