import {
  type Address,
  type PublicClient,
  type WalletClient,
  type Hex,
  getContract,
  stringToHex,
  zeroAddress,
  isAddress,
  SignTypedDataParameters,
  TypedDataDomain,
} from "viem";
import { getArtifact, type SupportedChains } from "./utils";
import multipassAbi from "@peeramid-labs/multipass/abi/src/Multipass.sol/Multipass";
import type { RegisterMessage } from "./types";

export type NameQuery = {
  name: Hex;
  id: Hex;
  wallet: Address;
  domainName: Hex;
  targetDomain: Hex;
};

export default class Multipass {
  private chainId: string;
  private name: string;
  private version: string;
  private publicClient: PublicClient;
  private walletClient: WalletClient;
  private instanceAddress: Address;

  constructor({
    chainName,
    publicClient,
    walletClient,
  }: {
    chainName: SupportedChains;
    publicClient: PublicClient;
    walletClient: WalletClient;
  }) {
    const artifact = getArtifact(chainName, "Multipass");
    this.chainId = chainName;
    this.name = artifact.execute.args[0];
    this.version = artifact.execute.args[1];
    this.instanceAddress = artifact.address;
    this.publicClient = publicClient;
    this.walletClient = walletClient;
  }

  public getDappURL(message: any, signature: string, basepath: string, contractAddress: string, domain: string) {
    return (
      basepath +
      "/?message=" +
      Buffer.from(JSON.stringify(message)).toString("base64") +
      "&contractAddress=" +
      contractAddress +
      "&signature=" +
      signature +
      "&chainId=" +
      this.chainId
    );
  }

  public signRegistrarMessage = async (message: RegisterMessage, verifierAddress: Address) => {
    if (!this.walletClient.account?.address) throw new Error("No account found");

    const domain: TypedDataDomain = {
      name: this.name,
      version: this.version,
      chainId: BigInt(this.chainId),
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
      account: this.walletClient.account.address,
      domain: domain,
      types,
      primaryType: "registerName",
      message: { ...message },
    });
  };

  public getRegistrarMessage = ({
    username,
    id,
    domainName,
    validUntil,
  }: {
    username: string;
    id: string;
    domainName: string;
    validUntil: number;
  }): RegisterMessage => {
    return {
      name: stringToHex(username, { size: 32 }),
      id: stringToHex(id, { size: 32 }),
      domainName: stringToHex(domainName, { size: 32 }),
      validUntil: BigInt(validUntil),
      nonce: 0n,
    };
  };

  public formQueryByAddress = ({
    address,
    domainName,
    targetDomain,
  }: {
    address: string;
    targetDomain?: string;
    domainName: string;
  }): NameQuery => {
    if (!isAddress(address)) throw new Error("formQueryByAddress: is not a valid address");
    return {
      name: stringToHex("", { size: 32 }),
      id: stringToHex("", { size: 32 }),
      wallet: address as Address,
      domainName: stringToHex(domainName, { size: 32 }),
      targetDomain: stringToHex(targetDomain ?? "", { size: 32 }),
    };
  };

  public formQueryById = ({
    id,
    domainName,
    targetDomain,
  }: {
    id: string;
    targetDomain?: string;
    domainName: string;
  }): NameQuery => {
    return {
      name: stringToHex("", { size: 32 }),
      id: stringToHex(id, { size: 32 }),
      wallet: zeroAddress,
      domainName: stringToHex(domainName, { size: 32 }),
      targetDomain: stringToHex(targetDomain ?? "", { size: 32 }),
    };
  };

  public formQueryByUsername = ({
    username,
    domainName,
    targetDomain,
  }: {
    username: string;
    targetDomain?: string;
    domainName: string;
  }): NameQuery => {
    return {
      name: stringToHex(username, { size: 32 }),
      id: stringToHex("", { size: 32 }),
      wallet: zeroAddress,
      domainName: stringToHex(domainName, { size: 32 }),
      targetDomain: stringToHex(targetDomain ?? "", { size: 32 }),
    };
  };

  public formQueryByUsernameAndId = ({
    username,
    domainName,
    targetDomain,
    id,
  }: {
    username: string;
    targetDomain?: string;
    domainName: string;
    id: string;
  }): NameQuery => {
    return {
      name: stringToHex(username, { size: 32 }),
      id: stringToHex(id, { size: 32 }),
      wallet: zeroAddress,
      domainName: stringToHex(domainName, { size: 32 }),
      targetDomain: stringToHex(targetDomain ?? "", { size: 32 }),
    };
  };

  public formQueryByFullDetails = ({
    username,
    domainName,
    targetDomain,
    id,
    address,
  }: {
    username: string;
    targetDomain?: string;
    domainName: string;
    id: string;
    address: string;
  }): NameQuery => {
    if (!isAddress(address)) throw new Error("formQueryByAddress: is not a valid address");
    return {
      name: stringToHex(username, { size: 32 }),
      id: stringToHex(id, { size: 32 }),
      wallet: address as Address,
      domainName: stringToHex(domainName, { size: 32 }),
      targetDomain: stringToHex(targetDomain ?? "", { size: 32 }),
    };
  };
}
