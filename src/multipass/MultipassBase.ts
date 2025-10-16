import {
  type Address,
  type Hex,
  stringToHex,
  zeroAddress,
  isAddress,
  type PublicClient,
  stringToBytes,
  toHex,
} from "viem";
import type { RegisterMessage } from "../types";
import { MultipassAbi } from "../abis";
import { getArtifact } from "../utils";
import EnvioGraphQLClient from "../utils/EnvioGraphQLClient";

export type Domain = {
  name: string;
  registrar: Address;
  fee: bigint;
  renewalFee: bigint;
  registerSize: bigint;
  isActive: boolean;
  referrerReward: bigint;
  referralDiscount: bigint;
};

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

interface CustomRecord {
  name: string;
  id: string;
  domainName: string;
  // Add other fields as needed
}

/**
 * Base class for Multipass functionality
 */
export default class MultipassBase {
  /** Chain ID for the network */
  chainId: number;
  /** Public client for reading contracts */
  publicClient: PublicClient;
  envioClient: EnvioGraphQLClient;

  /**
   * Creates a new MultipassBase instance
   * @param params - Constructor parameters
   * @param params.chainId - ID of the blockchain network
   * @param params.publicClient - Public client for reading contracts
   * @param params.envioClient - Envio GraphQL client for querying data
   */
  constructor({
    chainId,
    publicClient,
    envioClient,
  }: {
    chainId: number;
    publicClient: PublicClient;
    envioClient: EnvioGraphQLClient;
  }) {
    this.chainId = chainId;
    this.publicClient = publicClient;
    this.envioClient = envioClient;
  }

  /**
   * Generates a URL for a dapp
   * @param message - Message object to be encoded in the URL
   * @param signature - Signature to be encoded in the URL
   * @param basepath - Base path of the URL
   * @param contractAddress - Address of the contract
   * @returns The generated URL
   */
  public getDappURL(message: object, signature: string, basepath: string, contractAddress: string) {
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

  /**
   * Convert a string to bytes32 format with length encoded in the last byte (UBI format)
   * @param text - The string to convert
   * @returns Hex string representing the bytes32 value
   */
  public getShortStringBytes32(text: string): `0x${string}` {
    const utf8Bytes = stringToBytes(text);
    const len = utf8Bytes.length;

    if (len > 31) {
      throw new Error(`String "${text}" is too long for a bytes32. Maximum length is 31 bytes.`);
    }

    const bytes32Array = new Uint8Array(32);
    bytes32Array.set(utf8Bytes);
    bytes32Array[31] = len;

    return toHex(bytes32Array);
  }

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

  /**
   * Creates a name query by address
   * @param params - Parameters for creating the query
   * @param params.address - Address to be encoded in the query
   * @param params.domainName - Domain name to be encoded in the query
   * @param params.targetDomain - Target domain to be encoded in the query
   * @returns The generated name query
   */
  public formQueryByAddress = ({
    address,
    domainName,
    targetDomain,
    useBytes32,
  }: {
    address: string;
    domainName: string;
    targetDomain?: string;
    useBytes32?: boolean;
  }): NameQuery => {
    if (!isAddress(address)) throw new Error("formQueryByAddress: is not a valid address");
    return {
      name: stringToHex("", { size: 32 }),
      id: stringToHex("", { size: 32 }),
      wallet: address,
      domainName: useBytes32 ? this.getShortStringBytes32(domainName) : stringToHex(domainName, { size: 32 }),
      targetDomain: stringToHex(targetDomain ?? "", { size: 32 }),
    };
  };

  /**
   * Creates a name query by ID
   * @param params - Parameters for creating the query
   * @param params.id - ID to be encoded in the query
   * @param params.domainName - Domain name to be encoded in the query
   * @param params.targetDomain - Target domain to be encoded in the query
   * @returns The generated name query
   */
  public formQueryById = ({
    id,
    domainName,
    targetDomain,
  }: {
    id: string;
    domainName: string;
    targetDomain?: string;
  }): NameQuery => {
    return {
      name: stringToHex("", { size: 32 }),
      id: stringToHex(id, { size: 32 }),
      wallet: zeroAddress,
      domainName: stringToHex(domainName, { size: 32 }),
      targetDomain: stringToHex(targetDomain ?? "", { size: 32 }),
    };
  };

  /**
   * Creates a name query by username
   * @param params - Parameters for creating the query
   * @param params.username - Username to be encoded in the query
   * @param params.domainName - Domain name to be encoded in the query
   * @param params.targetDomain - Target domain to be encoded in the query
   * @returns The generated name query
   */
  public formQueryByUsername = ({
    username,
    domainName,
    targetDomain,
  }: {
    username: string;
    domainName: string;
    targetDomain?: string;
  }): NameQuery => {
    return {
      name: stringToHex(username, { size: 32 }),
      id: "0x",
      wallet: zeroAddress,
      domainName: stringToHex(domainName, { size: 32 }),
      targetDomain: stringToHex(targetDomain ?? "", { size: 32 }),
    };
  };

  /**
   * Creates a name query by username and ID
   * @param params - Parameters for creating the query
   * @param params.username - Username to be encoded in the query
   * @param params.id - ID to be encoded in the query
   * @param params.domainName - Domain name to be encoded in the query
   * @param params.targetDomain - Target domain to be encoded in the query
   * @returns The generated name query
   */
  public formQueryByUsernameAndId = ({
    username,
    id,
    domainName,
    targetDomain,
  }: {
    username: string;
    id: string;
    domainName: string;
    targetDomain?: string;
  }): NameQuery => {
    return {
      name: stringToHex(username, { size: 32 }),
      id: stringToHex(id, { size: 32 }),
      wallet: zeroAddress,
      domainName: stringToHex(domainName, { size: 32 }),
      targetDomain: stringToHex(targetDomain ?? "", { size: 32 }),
    };
  };

  /**
   * Creates a name query with full details
   * @param params - Parameters for creating the query
   * @param params.username - Username to be encoded in the query
   * @param params.id - ID to be encoded in the query
   * @param params.domainName - Domain name to be encoded in the query
   * @param params.targetDomain - Target domain to be encoded in the query
   * @param params.address - Address to be encoded in the query
   * @returns The generated name query
   */
  public formQueryByFullDetails = ({
    username,
    id,
    domainName,
    targetDomain,
    address,
  }: {
    username: string;
    id: string;
    domainName: string;
    targetDomain?: string;
    address: string;
  }): NameQuery => {
    if (!isAddress(address)) throw new Error("formQueryByAddress: is not a valid address");
    return {
      name: stringToHex(username, { size: 32 }),
      id: stringToHex(id, { size: 32 }),
      wallet: address,
      domainName: stringToHex(domainName, { size: 32 }),
      targetDomain: stringToHex(targetDomain ?? "", { size: 32 }),
    };
  };
  public getContractAddress(): Address {
    const artifact = getArtifact(this.chainId, "Multipass");
    return artifact.address as Address;
  }

  protected getAbi() {
    return MultipassAbi;
  }

  /**
   * Get domain state
   * @param domainName Domain name to query
   * @returns Domain state
   */
  public async getDomainState(domainName: `0x${string}`): Promise<Domain> {
    return this.publicClient.readContract({
      address: this.getContractAddress(),
      abi: MultipassAbi,
      functionName: "getDomainState",
      args: [domainName],
    });
  }

  /**
   * Get domain state by ID
   * @param id Domain ID to query
   * @returns Domain state
   */
  public async getDomainStateById(id: bigint): Promise<Domain> {
    return this.publicClient.readContract({
      address: this.getContractAddress(),
      abi: MultipassAbi,
      functionName: "getDomainStateById",
      args: [id],
    });
  }

  /**
   * Get contract state
   * @returns Total number of domains
   */
  public async getContractState(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.getContractAddress(),
      abi: MultipassAbi,
      functionName: "getContractState",
      args: [],
    });
  }

  /**
   * List all domains with their active status
   * @param onlyActive If true, only return active domains
   * @returns Array of domains with their states
   */
  public async listDomains(onlyActive?: boolean): Promise<Domain[]> {
    const initializedFilter = await this.envioClient.getMultipassInitializedDomainEvents({});

    const activatedFilter = await this.envioClient.getMultipassDomainActivatedEvents({});

    const deactivatedFilter = await this.envioClient.getMultipassDomainDeactivatedEvents({});

    const domains = new Map<string, Domain>();

    // Process initialized domains
    for (const event of initializedFilter) {
      const domainState = await this.getDomainState(event.domainName as `0x${string}`);
      domains.set(event.domainName as string, domainState);
    }

    // Update active status
    for (const event of activatedFilter) {
      const domain = domains.get(event.domainName as string)!;
      domain.isActive = true;
      domains.set(event.domainName as string, domain);
    }

    // Update deactive status
    for (const event of deactivatedFilter) {
      const domain = domains.get(event.domainName as string)!;
      domain.isActive = false;
      domains.set(event.domainName as string, domain);
    }

    let result = Array.from(domains.values());
    if (onlyActive) {
      result = result.filter((domain) => domain.isActive);
    }

    return result;
  }

  /**
   * List all records with their states
   * @param onlyActive If true, only return active records
   * @returns Array of records with their states
   */
  public async listRecords(onlyActive?: boolean): Promise<Array<{ record: CustomRecord; isActive: boolean }>> {
    const registeredFilterP = this.envioClient.getMultipassRegisteredEvents({});

    const renewedFilterP = this.envioClient.getMultipassRenewedEvents({});

    const deletedFilterP = this.envioClient.getMultipassNameDeletedEvents({});

    const [registeredFilter, renewedFilter, deletedFilter] = await Promise.all([
      registeredFilterP,
      renewedFilterP,
      deletedFilterP,
    ]);
    const records = new Map<string, { record: CustomRecord; isActive: boolean }>();

    // Process registered records
    for (const event of registeredFilter) {
      const key = `${event.name}-${event.userId}-${event.domainName}`;
      records.set(key, { record: event, isActive: true });
    }

    // Update renewed records
    for (const event of renewedFilter) {
      const key = `${event.name}-${event.userId}-${event.domainName}`;
      records.set(key, { record: event, isActive: true });
    }

    // Update deleted records
    for (const event of deletedFilter) {
      const key = `${event.name}-${event.userId}-${event.domainName}`;
      if (records.has(key)) {
        const record = records.get(key)!;
        record.isActive = false;
        records.set(key, record);
      }
    }

    let result = Array.from(records.values());
    if (onlyActive) {
      result = result.filter((record) => record.isActive);
    }

    return result;
  }
}
