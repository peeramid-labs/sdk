import { type Address, type Hash, stringToHex, type WalletClient, type PublicClient } from "viem";
import MultipassBase from "./MultipassBase";
export type NameQuery = {
  name: `0x${string}`;
  id: `0x${string}`;
  wallet: Address;
  domainName: `0x${string}`;
  targetDomain: `0x${string}`;
};

export type Record = {
  name: `0x${string}`;
  id: `0x${string}`;
  domainName: `0x${string}`;
  validUntil: bigint;
  nonce: bigint;
  wallet: Address;
};

export default class MultipassOwner extends MultipassBase {
  private walletClient: WalletClient;

  constructor({
    chainId,
    walletClient,
    publicClient,
  }: {
    chainId: number;
    walletClient: WalletClient;
    publicClient: PublicClient;
  }) {
    super({ chainId, publicClient });
    this.walletClient = walletClient;
  }

  /**
   * Register a new name in Multipass
   * @param params Parameters for registration
   * @param params.record Record to register
   * @param params.registrarSignature Signature from the registrar
   * @param params.referrer Optional referrer query
   * @param params.referralCode Optional referral code
   * @returns Transaction hash
   */
  public async register({
    record,
    registrarSignature,
    referrer = {
      name: "0x",
      id: "0x",
      wallet: "0x",
      domainName: "0x",
      targetDomain: "0x",
    },
    referralCode,
  }: {
    record: Record;
    registrarSignature: `0x${string}`;
    referrer?: NameQuery;
    referralCode?: `0x${string}`;
  }): Promise<Hash> {
    if (!this.walletClient.account) throw new Error("No account found");

    return this.walletClient.writeContract({
      address: this.getContractAddress(),
      abi: this.getAbi(),
      functionName: "register",
      args: [record, registrarSignature, referrer || null, referralCode || "0x"],
      chain: null,
      account: this.walletClient.account,
    });
  }

  /**
   * Renew a record in Multipass
   * @param params Parameters for renewal
   * @param params.query Query to find the record
   * @param params.record Updated record
   * @param params.registrarSignature Signature from the registrar
   * @returns Transaction hash
   */
  public async renewRecord({
    query,
    record,
    registrarSignature,
  }: {
    query: NameQuery;
    record: Record;
    registrarSignature: `0x${string}`;
  }): Promise<Hash> {
    if (!this.walletClient.account) throw new Error("No account found");

    return this.walletClient.writeContract({
      address: this.getContractAddress(),
      abi: this.getAbi(),
      functionName: "renewRecord",
      args: [query, record, registrarSignature],
      chain: null,
      account: this.walletClient.account,
    });
  }

  /**
   * Initialize a new domain in Multipass
   * @param params Parameters for domain initialization
   * @param params.registrar Address of the registrar
   * @param params.fee Registration fee in wei
   * @param params.renewalFee Renewal fee in wei
   * @param params.domainName Domain name as string
   * @param params.referrerReward Reward for referrers in wei
   * @param params.referralDiscount Discount for referred users in wei
   * @param params.bytes32 Whether to use bytes32 encoding with length in last byte (UBI format)
   * @returns Transaction hash
   */
  public async initializeDomain({
    registrar,
    fee,
    renewalFee,
    domainName,
    referrerReward,
    referralDiscount,
    bytes32 = false,
  }: {
    registrar: Address;
    fee: bigint;
    renewalFee: bigint;
    domainName: string;
    referrerReward: bigint;
    referralDiscount: bigint;
    bytes32: boolean;
  }): Promise<Hash> {
    if (!this.walletClient.account) throw new Error("No account found");

    return this.walletClient.writeContract({
      address: this.getContractAddress(),
      abi: this.getAbi(),
      functionName: "initializeDomain",
      args: [
        registrar,
        fee,
        renewalFee,
        bytes32 ? this.getShortStringBytes32(domainName) : stringToHex(domainName, { size: 32 }),
        referrerReward,
        referralDiscount,
      ],
      chain: null,
      account: this.walletClient.account,
    });
  }

  /**
   * Deactivate a domain in Multipass
   * @param domainName Domain name to deactivate
   * @param bytes32 Whether to use bytes32 encoding with length in last byte (UBI format)
   * @returns Transaction hash
   */
  public async deactivateDomain(domainName: string, bytes32: boolean = false): Promise<Hash> {
    if (!this.walletClient.account) throw new Error("No account found");

    return this.walletClient.writeContract({
      address: this.getContractAddress(),
      abi: this.getAbi(),
      functionName: "deactivateDomain",
      args: [bytes32 ? this.getShortStringBytes32(domainName) : stringToHex(domainName, { size: 32 })],
      chain: null,
      account: this.walletClient.account,
    });
  }

  /**
   * Change the registration fee for a domain
   * @param params Parameters for changing fee
   * @param params.domainName Domain name
   * @param params.fee New fee in wei
   * @param params.bytes32 Whether to use bytes32 encoding with length in last byte (UBI format)
   * @returns Transaction hash
   */
  public async changeFee({
    domainName,
    fee,
    bytes32 = false,
  }: {
    domainName: string;
    fee: bigint;
    bytes32?: boolean;
  }): Promise<Hash> {
    if (!this.walletClient.account) throw new Error("No account found");

    return this.walletClient.writeContract({
      address: this.getContractAddress(),
      abi: this.getAbi(),
      functionName: "changeFee",
      args: [bytes32 ? this.getShortStringBytes32(domainName) : stringToHex(domainName, { size: 32 }), fee],
      chain: null,
      account: this.walletClient.account,
    });
  }

  /**
   * Change the registrar for a domain
   * @param params Parameters for changing registrar
   * @param params.domainName Domain name
   * @param params.newRegistrar Address of the new registrar
   * @param params.bytes32 Whether to use bytes32 encoding with length in last byte (UBI format)
   * @returns Transaction hash
   */
  public async changeRegistrar({
    domainName,
    newRegistrar,
    bytes32 = false,
  }: {
    domainName: string;
    newRegistrar: Address;
    bytes32?: boolean;
  }): Promise<Hash> {
    if (!this.walletClient.account) throw new Error("No account found");

    return this.walletClient.writeContract({
      address: this.getContractAddress(),
      abi: this.getAbi(),
      functionName: "changeRegistrar",
      args: [bytes32 ? this.getShortStringBytes32(domainName) : stringToHex(domainName, { size: 32 }), newRegistrar],
      chain: null,
      account: this.walletClient.account,
    });
  }

  /**
   * Delete a name from a domain
   * @param query Name query containing the details of the name to delete
   * @returns Transaction hash
   */
  public async deleteName(query: NameQuery): Promise<Hash> {
    if (!this.walletClient.account) throw new Error("No account found");

    return this.walletClient.writeContract({
      address: this.getContractAddress(),
      abi: this.getAbi(),
      functionName: "deleteName",
      args: [query],
      chain: null,
      account: this.walletClient.account,
    });
  }

  /**
   * Change the referral program parameters for a domain
   * @param params Parameters for changing referral program
   * @param params.domainName Domain name
   * @param params.referrerReward New referrer reward in wei
   * @param params.referralDiscount New referral discount in wei
   * @param params.bytes32 Whether to use bytes32 encoding with length in last byte (UBI format)
   * @returns Transaction hash
   */
  public async changeReferralProgram({
    domainName,
    referrerReward,
    referralDiscount,
    bytes32 = false,
  }: {
    domainName: string;
    referrerReward: bigint;
    referralDiscount: bigint;
    bytes32?: boolean;
  }): Promise<Hash> {
    if (!this.walletClient.account) throw new Error("No account found");

    return this.walletClient.writeContract({
      address: this.getContractAddress(),
      abi: this.getAbi(),
      functionName: "changeReferralProgram",
      args: [
        referrerReward,
        referralDiscount,
        bytes32 ? this.getShortStringBytes32(domainName) : stringToHex(domainName, { size: 32 }),
      ],
      chain: null,
      account: this.walletClient.account,
    });
  }

  /**
   * Change the renewal fee for a domain
   * @param params Parameters for changing renewal fee
   * @param params.domainName Domain name
   * @param params.fee New renewal fee in wei
   * @param params.bytes32 Whether to use bytes32 encoding with length in last byte (UBI format)
   * @returns Transaction hash
   */
  public async changeRenewalFee({
    domainName,
    fee,
    bytes32 = false,
  }: {
    domainName: string;
    fee: bigint;
    bytes32?: boolean;
  }): Promise<Hash> {
    if (!this.walletClient.account) throw new Error("No account found");

    return this.walletClient.writeContract({
      address: this.getContractAddress(),
      abi: this.getAbi(),
      functionName: "changeRenewalFee",
      args: [fee, bytes32 ? this.getShortStringBytes32(domainName) : stringToHex(domainName, { size: 32 })],
      chain: null,
      account: this.walletClient.account,
    });
  }

  /**
   * Activate a domain in Multipass
   * @param domainName Domain name to activate
   * @param bytes32 Whether to use bytes32 encoding with length in last byte (UBI format)
   * @returns Transaction hash
   */
  public async activateDomain(domainName: string, bytes32: boolean = false): Promise<Hash> {
    if (!this.walletClient.account) throw new Error("No account found");

    return this.walletClient.writeContract({
      address: this.getContractAddress(),
      abi: this.getAbi(),
      functionName: "activateDomain",
      args: [bytes32 ? this.getShortStringBytes32(domainName) : stringToHex(domainName, { size: 32 })],
      chain: null,
      account: this.walletClient.account,
    });
  }
}
