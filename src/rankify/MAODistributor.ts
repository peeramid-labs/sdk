/**
 * @file MAO (Meritocratic Autonomous Organization) Distribution implementation
 * Provides functionality for managing and distributing MAO tokens and instances
 */

import { DistributorClient } from "../eds/Distributor";
import { getArtifact, handleRPCError, parseInstantiated } from "../utils";
import { MAOInstances } from "../types/contracts";
import instanceAbi from "../abis/RankifyDiamondInstance";
import rankTokenAbi from "../abis/RankToken";
import govtTokenAbi from "../abis/DistributableGovernanceERC20";
import govtAccessManagerAbi from "../abis/SimpleAccessManager";
import governorAbi from "../abis/Governor";
import {
  getAddress,
  getContract,
  GetContractReturnType,
  Chain,
  encodeAbiParameters,
  GetAbiItemParameters,
  getAbiItem,
  stringToHex,
  PublicClient,
  WalletClient,
  parseEventLogs,
  Address,
  keccak256,
  Hex,
  erc20Abi,
  maxUint256,
  encodePacked,
} from "viem";
import MaoDistributionAbi from "../abis/MAODistribution";
import distributorAbi from "../abis/DAODistributor";
import { ERC7744Abi } from "../abis";
import { logger } from "../utils/logger";
import EnvioGraphQLClient from "../utils/EnvioGraphQLClient";

/**
 * Structure defining token-related arguments
 */
export type TokenArgumentsStructOutput = {
  /** Name of the token */
  tokenName: string;
  /** Symbol for the token */
  tokenSymbol: string;
  /** Amounts to pre-mint for each receiver */
  preMintAmounts: bigint[];
  /** Addresses to receive pre-minted tokens */
  preMintReceivers: Address[];
};

/**
 * Configuration settings for Rankify user settings
 */
export type UserRankifySettingsStructOutput = {
  /** Cost of the principal token */
  principalCost: bigint;
  /** Time constant for principal calculations */
  principalTimeConstant: bigint;
  /** Additional metadata for the settings */
  metadata: string;
  /** URI for the rank token */
  rankTokenURI: string;
  /** Contract URI for the rank token */
  rankTokenContractURI: string;
  /** Owner address */
  owner: Address;
  /** Payment token address */
  paymentToken: Address;
};

/**
 * Combined arguments for new community initialization
 */
export type DistributorArgumentsStruct = {
  /** Token configuration settings */
  tokenSettings: TokenArgumentsStructOutput;
  /** Rankify-specific settings */
  rankifySettings: UserRankifySettingsStructOutput;
};

/**
 * Interface for MAO instance arguments
 */
export interface MAOInstanceArgs {
  owner: Address;
  distributor: Address;
  name: string;
}

/**
 * Collection of contract instances for a MAO deployment
 */
export interface MAOInstanceContracts {
  /** Rank token contract instance */
  rankToken: GetContractReturnType<typeof rankTokenAbi>;
  /** Main instance contract */
  instance: GetContractReturnType<typeof instanceAbi>;
  /** Governance token contract */
  govtToken: GetContractReturnType<typeof govtTokenAbi>;
  /** Access manager for governance token */
  govTokenAccessManager: GetContractReturnType<typeof govtAccessManagerAbi>;
  /** Access manager for ACID */
  ACIDAccessManager: GetContractReturnType<typeof govtAccessManagerAbi>;
  /** Governor contract */
  governor: GetContractReturnType<typeof governorAbi>;
}

/**
 * Client for managing MAO Distribution operations
 * Handles creation, management and interaction with MAO instances
 */
export class MAODistributorClient extends DistributorClient {
  private static readonly DEFAULT_NAME = "MAO-v1.5";
  walletClient?: WalletClient;

  /**
   * Creates a new MAODistributorClient instance
   * @param chainId - ID of the blockchain network
   * @param client - Object containing public and wallet clients
   */
  constructor(
    chainId: number,
    client: {
      publicClient: PublicClient;
      walletClient?: WalletClient;
      address?: Address;
      envioClient: EnvioGraphQLClient;
    },
    address: Address = getArtifact(chainId, "DAODistributor").address
  ) {
    super({
      address: client.address ?? getAddress(address),
      publicClient: client.publicClient,
      envioClient: client.envioClient,
    });
    this.walletClient = client.walletClient;

    if (!this.envioClient) {
      throw new Error("EnvioGraphQLClient is required for MAODistributorClient");
    }
  }

  /**
   * Converts MAOInstances addresses to their respective contract instances
   * @param addresses Object containing contract addresses for MAO distribution components
   * @returns Object containing initialized contract instances
   * @throws Error if any of the addresses are invalid
   */
  addressesToContracts(addresses: MAOInstances): MAOInstanceContracts {
    const instance = getContract({
      address: getAddress(addresses.ACIDInstance),
      abi: instanceAbi,
      client: this.walletClient ?? this.publicClient,
    });

    const rankToken = getContract({
      address: getAddress(addresses.rankToken),
      abi: rankTokenAbi,
      client: this.walletClient ?? this.publicClient,
    });

    const govtToken = getContract({
      address: getAddress(addresses.govToken),
      abi: govtTokenAbi,
      client: this.walletClient ?? this.publicClient,
    });

    const govTokenAccessManager = getContract({
      address: getAddress(addresses.govTokenAccessManager),
      abi: govtAccessManagerAbi,
      client: this.walletClient ?? this.publicClient,
    });

    const ACIDAccessManager = getContract({
      address: getAddress(addresses.ACIDAccessManager),
      abi: govtAccessManagerAbi,
      client: this.walletClient ?? this.publicClient,
    });

    const governor = getContract({
      address: getAddress(addresses.governor),
      abi: governorAbi,
      client: this.walletClient ?? this.publicClient,
    });

    return { rankToken, instance, govtToken, govTokenAccessManager, ACIDAccessManager, governor };
  }

  parseToContracts(instances: readonly Address[]) {
    return this.addressesToContracts(parseInstantiated(instances as string[]));
  }

  async getDistributions(): Promise<readonly `0x${string}`[]> {
    try {
      return this.publicClient.readContract({
        abi: distributorAbi,
        functionName: "getDistributions",
        address: this.address,
      });
    } catch (e) {
      throw await handleRPCError(e);
    }
  }

  async addNamedDistribution(
    chain: Chain,
    name: `0x${string}`,
    address: `0x${string}`,
    initializer: `0x${string}` = "0x0000000000000000000000000000000000000000"
  ) {
    if (!this.walletClient) {
      throw new Error("Wallet client is required for this operation");
    }

    const code = await this.publicClient.getCode({ address });
    if (!code) throw new Error(`Code not found on ${address} address`);
    const hashCode = keccak256(encodePacked(["bytes"], [code]));
    const distrAddress = await this.publicClient.readContract({
      abi: ERC7744Abi,
      address: getArtifact(chain.id, "CodeIndex").address,
      functionName: "get",
      args: [hashCode],
    });
    logger(`Distribution address ${distrAddress}`);

    if (distrAddress == "0x0000000000000000000000000000000000000000") {
      try {
        const { request } = await this.publicClient.simulateContract({
          abi: ERC7744Abi,
          address: getArtifact(chain.id, "CodeIndex").address,
          functionName: "register",
          args: [address],
          account: this.walletClient.account,
          chain: this.walletClient.chain,
        });
        await this.walletClient
          .writeContract(request)
          .then((h) => this.publicClient.waitForTransactionReceipt({ hash: h }));
      } catch (e) {
        throw await handleRPCError(e);
      }
    }
    try {
      const { request } = await this.publicClient.simulateContract({
        abi: distributorAbi,
        address: this.address,
        functionName: "addNamedDistribution",
        args: [name, hashCode, initializer],
        account: this.walletClient.account,
        chain: this.walletClient.chain,
      });

      const receipt = await this.walletClient
        .writeContract(request)
        .then((h) => this.publicClient.waitForTransactionReceipt({ hash: h }));
      const distributionAddedEvent = parseEventLogs({
        abi: distributorAbi,
        logs: receipt.logs,
        eventName: "DistributionAdded",
      });
      logger(`Distribution added event`);
      logger(distributionAddedEvent);

      return { receipt, distributionAddedEvent: distributionAddedEvent[0] };
    } catch (e) {
      throw await handleRPCError(e);
    }
  }

  async removeDistribution(id: `0x${string}`) {
    if (!this.walletClient) throw new Error("Wallet client is required for this operation");
    try {
      const { request } = await this.publicClient.simulateContract({
        abi: distributorAbi,
        address: this.address,
        functionName: "removeDistribution",
        args: [id],
        account: this.walletClient.account,
        chain: this.walletClient.chain,
      });

      const receipt = await this.walletClient
        .writeContract(request)
        .then((h) => this.publicClient.waitForTransactionReceipt({ hash: h }));
      const distributionRemovedEvent = parseEventLogs({
        abi: distributorAbi,
        logs: receipt.logs,
        eventName: "DistributionRemoved",
      });
      logger(`Distribution removed event`);
      logger(distributionRemovedEvent);

      return { receipt, distributionRemovedEvent: distributionRemovedEvent[0] };
    } catch (e) {
      throw await handleRPCError(e);
    }
  }

  /**
   * Gets a specific MAO instance by name and instance ID
   * @param params Parameters for getting the instance
   * @param params.name The name of the distribution (defaults to DEFAULT_NAME)
   * @param params.instanceId The ID of the instance to retrieve
   * @param params.fromBlock Optional block to start searching from (defaults to contract creation block)
   * @returns The MAO instance contracts
   */
  async getMAOInstance({
    name = MAODistributorClient.DEFAULT_NAME,
    instanceId,
  }: {
    name?: string;
    instanceId: bigint;
  }): Promise<MAOInstanceContracts> {
    // Convert instanceId to string before passing to queryInstances
    const instanceIdStr = instanceId.toString();

    const logs = await this.envioClient.queryInstances({
      distributionId: stringToHex(name, { size: 32 }),
      instanceId: instanceIdStr,
    });

    if (logs.length === 0) {
      console.error("No instance found");
      throw new Error(`No instance found for distribution ${name} and id ${instanceId}`);
    }

    if (logs.length > 1) {
      console.error("Multiple instances found");
      throw new Error(`Multiple instances found for distribution ${name} and id ${instanceId}`);
    }

    const { instances } = logs[0];
    if (!instances) throw new Error(`No instances found for distribution ${name} and id ${instanceId}`);
    return this.addressesToContracts(parseInstantiated(instances as string[]));
  }

  /**
   * Get MAOInstances instances by distribution name
   * @param params.namedDistribution Distribution name (defaults to "MAO Distribution")
   * @param params.fromBlock Block to start searching from (defaults to contract creation block)
   * @returns Array of MAOInstances contract instances
   */
  async getMAOInstances({
    namedDistribution = MAODistributorClient.DEFAULT_NAME,
  }: {
    namedDistribution?: string;
  } = {}): Promise<
    {
      instances: MAOInstanceContracts;
      maoInstanceId: bigint;
    }[]
  > {
    const logs = await this.envioClient.queryInstances({
      distributionId: stringToHex(namedDistribution, { size: 32 }),
    });

    const instances = logs
      .map((l) => ({
        instances: parseInstantiated(l.instances as string[]),
        maoInstanceId: BigInt(l.newInstanceId),
      }))
      .map((ip) => ({
        instances: this.addressesToContracts(ip.instances),
        maoInstanceId: ip.maoInstanceId,
      }));

    return instances;
  }

  async getInstantiatePrice(distributorsId: Hex): Promise<bigint> {
    try {
      return this.publicClient.readContract({
        abi: distributorAbi,
        functionName: "instantiationCosts",
        address: this.address,
        args: [distributorsId],
      });
    } catch (e) {
      throw await handleRPCError(e);
    }
  }

  async setInstantiationAllowance(amount?: bigint) {
    logger(`Setting instantiation allowance ${amount?.toString ? amount : maxUint256}`);
    if (!this.walletClient) throw new Error("walletClient is required, use constructor with walletClient");
    if (!this.walletClient.account?.address) throw new Error("No account address found");
    const paymentToken = await this.publicClient.readContract({
      abi: distributorAbi,
      functionName: "paymentToken",
      address: this.address,
    });

    try {
      const { request } = await this.publicClient.simulateContract({
        abi: erc20Abi,
        functionName: "approve",
        address: paymentToken,
        args: [this.address, amount ? amount : maxUint256],
        account: this.walletClient.account,
        chain: this.walletClient.chain,
      });

      await this.walletClient.writeContract(request);
    } catch (err) {
      throw await handleRPCError(err);
    }
  }

  async needsAllowance(distributorsId: Hex) {
    if (!this.walletClient) throw new Error("walletClient is required, use constructor with walletClient");
    if (!this.walletClient.account?.address) throw new Error("No account address found");
    try {
      const paymentToken = await this.publicClient.readContract({
        abi: distributorAbi,
        functionName: "paymentToken",
        address: this.address,
      });
      const allowance = await this.publicClient.readContract({
        abi: erc20Abi,
        functionName: "allowance",
        address: paymentToken,
        args: [this.walletClient.account?.address, this.address],
      });
      const chainid = this.publicClient?.chain?.id;
      if (!chainid) throw new Error("No chain id found");
      const balance = await this.publicClient.readContract({
        abi: erc20Abi,
        functionName: "balanceOf",
        address: paymentToken,
        args: [this.walletClient.account?.address],
      });
      logger(`Balance ${balance.toString()}`);
      logger(`Allowance ${allowance.toString()} for ${this.walletClient.account?.address} on ${this.address}`);
      return allowance < (await this.getInstantiatePrice(distributorsId));
    } catch (e) {
      throw await handleRPCError(e);
    }
  }

  /**
   * Create a new MAODistribution instance
   * @param args Distribution arguments (encoded as bytes)
   * @param name Distributor name (defaults to "MAO-v1.5")
   * @returns Array of created contract addresses
   */
  async instantiate(
    args: GetAbiItemParameters<typeof MaoDistributionAbi, "distributionSchema">["args"],
    name: string = MAODistributorClient.DEFAULT_NAME,
    chain: Chain
  ): Promise<MAOInstanceContracts> {
    logger(`Instantiating ${name}`);
    if (!args) throw new Error("args is required");
    if (!this.walletClient) throw new Error("walletClient is required, use constructor with walletClient");
    const abiItem = getAbiItem({ abi: MaoDistributionAbi, name: "distributionSchema" });
    const encodedParams = encodeAbiParameters(abiItem.inputs, args);
    const encodedName = stringToHex(name, { size: 32 });
    if (!this.walletClient.account?.address) throw new Error("No account address found");
    try {
      if (await this.needsAllowance(encodedName)) await this.setInstantiationAllowance();
      const { request } = await this.publicClient.simulateContract({
        abi: distributorAbi,
        address: this.address,
        functionName: "instantiate",
        args: [encodedName, encodedParams],
        account: this.walletClient.account,
        chain: chain,
      });
      const receipt = await this.walletClient
        .writeContract(request)
        .then((h) => this.publicClient.waitForTransactionReceipt({ hash: h }));
      const instantiatedEvent = parseEventLogs({
        abi: distributorAbi,
        logs: receipt.logs,
        eventName: "Instantiated",
      });

      if (instantiatedEvent.length == 0) {
        console.error("Transaction receipt:", receipt);
        throw new Error("Instantiated event not found in transaction receipt");
      }
      if (instantiatedEvent.length > 1) {
        console.error("Transaction receipt:", receipt);
        throw new Error("Multiple Instantiated events found in transaction receipt");
      }
      const addresses = parseInstantiated(instantiatedEvent[0].args.instances as string[]);
      return this.addressesToContracts(addresses);
      // eslint-disable-next-line
    } catch (e: any) {
      throw await handleRPCError(e);
    }
  }

  /**
   * Check if a player is in a specific game
   * @param gameId The ID of the game to check
   * @param player The address of the player
   * @returns Whether the player is in the game
   */
  async isPlayerInGame(gameId: bigint, player: Address): Promise<boolean> {
    try {
      return this.publicClient.readContract({
        abi: instanceAbi,
        functionName: "isPlayerInGame",
        address: this.address,
        args: [gameId, player],
      });
    } catch (e) {
      throw await handleRPCError(e);
    }
  }

  /**
   * Create and open a game in one transaction
   * @param params Game parameters
   * @param requirements Game requirements
   * @returns The created game ID
   */
  async createAndOpenGame(
    params: {
      gameMaster: Address;
      gameRank: bigint;
      maxPlayerCnt: bigint;
      minPlayerCnt: bigint;
      voteCredits: bigint;
      nTurns: bigint;
      minGameTime: bigint;
      timePerTurn: bigint;
      metadata: string;
      timeToJoin: bigint;
      votePhaseDuration: bigint;
      proposingPhaseDuration: bigint;
    },
    requirements: {
      ethValues: {
        have: bigint;
        lock: bigint;
        burn: bigint;
        pay: bigint;
        bet: bigint;
      };
      contracts: readonly {
        contractAddress: Address;
        contractId: bigint;
        contractType: number;
        contractRequirement: {
          have: { data: Hex; amount: bigint };
          lock: { data: Hex; amount: bigint };
          burn: { data: Hex; amount: bigint };
          pay: { data: Hex; amount: bigint };
          bet: { data: Hex; amount: bigint };
        };
      }[];
    }
  ): Promise<bigint> {
    if (!this.walletClient) throw new Error("Wallet client is required for this operation");
    try {
      const { request } = await this.publicClient.simulateContract({
        abi: instanceAbi,
        address: this.address,
        functionName: "createAndOpenGame",
        args: [params, requirements],
        account: this.walletClient.account,
        chain: this.walletClient.chain,
      });

      const receipt = await this.walletClient
        .writeContract(request)
        .then((h) => this.publicClient.waitForTransactionReceipt({ hash: h }));

      const gameCreatedEvent = parseEventLogs({
        abi: instanceAbi,
        logs: receipt.logs,
        eventName: "gameCreated",
      });

      if (gameCreatedEvent.length === 0) {
        throw new Error("Game created event not found in transaction receipt");
      }

      return gameCreatedEvent[0].args.gameId;
    } catch (e) {
      throw await handleRPCError(e);
    }
  }
}
