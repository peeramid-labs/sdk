import { Address, PublicClient, Hex, WalletClient, type Hash } from "viem";
import { handleRPCError } from "../utils/index";
import abis from "../abis";
const { RankifyDiamondInstanceAbi } = abis;
import InstanceBase from "../rankify/InstanceBase";
import { EnvioGraphQLClient } from "../utils/EnvioGraphQLClient";

/**
 * Structure representing a vote for a proposal
 */
export interface VoteElement {
  proposal: Hex;
  amount: bigint;
}

/**
 * Structure representing a single proposal in the system
 */
export interface DailyProposal {
  proposal: Hex;
  score: bigint;
  proposer: Address;
  exists: boolean;
}

/**
 * Structure representing global statistics for a proposal
 */
export interface ProposalGlobalStats {
  aggregateScore: bigint;
  proposedTimes: bigint;
  repostedTimes: bigint;
}

/**
 * Structure representing UBI parameters
 */
export interface UBIParams {
  dailyClaimAmount: bigint;
  dailySupportAmount: bigint;
  domainName: Hex;
}

/**
 * Structure representing user state
 */
export interface UserState {
  claimedToday: boolean;
  supportSpent: bigint;
}

/**
 * Class for interacting with UBI facet of a Rankify instance
 * Extends InstanceBase and provides UBI-specific functionality
 */
export default class InstanceUBI extends InstanceBase {
  /** Wallet client for write operations (optional) */
  walletClient?: WalletClient;
  /** Account address for write operations */
  account?: Address;

  /**
   * Creates a new InstanceUBI
   * @param {Object} params - Constructor parameters
   * @param {PublicClient} params.publicClient - Public client for blockchain interactions
   * @param {WalletClient} params.walletClient - Optional wallet client for write operations
   * @param {number} params.chainId - Chain ID of the network
   * @param {Address} params.instanceAddress - Address of the Rankify instance with UBI facet
   * @param {Address} params.account - Optional account address for write operations
   * @param {EnvioGraphQLClient} params.envioClient - Envio GraphQL client for event queries
   */
  constructor({
    publicClient,
    walletClient,
    chainId,
    instanceAddress,
    account,
    envioClient,
  }: {
    publicClient: PublicClient;
    walletClient?: WalletClient;
    chainId: number;
    instanceAddress: Address;
    account?: Address;
    envioClient: EnvioGraphQLClient;
  }) {
    super({
      publicClient,
      chainId,
      instanceAddress,
      envioClient,
    });

    this.walletClient = walletClient;
    this.account = account || walletClient?.account?.address;
  }

  /**
   * Gets the current day number based on block timestamp
   * @returns The current day number (block.timestamp / 1 days)
   */
  getCurrentDay = async (): Promise<bigint> => {
    try {
      return await this.publicClient.readContract({
        address: this.instanceAddress,
        abi: RankifyDiamondInstanceAbi,
        functionName: "getCurrentDay",
      });
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  /**
   * Gets the current day number (alias for getCurrentDay)
   * @returns The current day number
   */
  currentDay = async (): Promise<bigint> => {
    try {
      return await this.publicClient.readContract({
        address: this.instanceAddress,
        abi: RankifyDiamondInstanceAbi,
        functionName: "currentDay",
      });
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  /**
   * Gets the UBI system parameters
   * @returns Object containing dailyClaimAmount, dailySupportAmount, and domainName
   */
  getUBIParams = async (): Promise<UBIParams> => {
    try {
      const [dailyClaimAmount, dailySupportAmount, domainName] = await this.publicClient.readContract({
        address: this.instanceAddress,
        abi: RankifyDiamondInstanceAbi,
        functionName: "getUBIParams",
      });

      console.log("dailyClaimAmount", dailyClaimAmount);
      console.log("dailySupportAmount", dailySupportAmount);
      console.log("domainName", domainName);

      return {
        dailyClaimAmount,
        dailySupportAmount,
        domainName,
      };
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  /**
   * Gets the lifetime statistics for a proposal
   * @param proposalHash - The hash of the proposal
   * @returns Object containing aggregateScore, proposedTimes, and repostedTimes
   */
  getProposalLifetimeStats = async (proposalHash: Hex): Promise<ProposalGlobalStats> => {
    try {
      const result = await this.publicClient.readContract({
        address: this.instanceAddress,
        abi: RankifyDiamondInstanceAbi,
        functionName: "proposalLifetimeStats",
        args: [proposalHash],
      });

      return {
        aggregateScore: result.aggregateScore,
        proposedTimes: result.proposedTimes,
        repostedTimes: result.repostedTimes,
      };
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  /**
   * Gets the daily score for a proposal on a specific day
   * @param proposalHash - The hash of the proposal
   * @param day - The day number to query
   * @returns DailyProposal object with proposal details for that day
   */
  getProposalDailyScore = async (proposalHash: Hex, day: bigint): Promise<DailyProposal> => {
    try {
      const result = await this.publicClient.readContract({
        address: this.instanceAddress,
        abi: RankifyDiamondInstanceAbi,
        functionName: "getProposalDailyScore",
        args: [proposalHash, day],
      });

      return {
        proposal: result.proposal,
        score: result.score,
        proposer: result.proposer,
        exists: result.exists,
      };
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  /**
   * Gets the total number of proposals for a specific day
   * @param day - The day number to query
   * @returns The count of proposals for that day
   */
  getProposalsCnt = async (day: bigint): Promise<bigint> => {
    try {
      return await this.publicClient.readContract({
        address: this.instanceAddress,
        abi: RankifyDiamondInstanceAbi,
        functionName: "getProposalsCnt",
        args: [day],
      });
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  /**
   * Gets the day a user last claimed their tokens
   * @param user - The address of the user
   * @returns The day number of the last claim (0 if never claimed)
   */
  getLastClaimedAt = async (user: Address): Promise<bigint> => {
    try {
      return await this.publicClient.readContract({
        address: this.instanceAddress,
        abi: RankifyDiamondInstanceAbi,
        functionName: "lastClaimedAt",
        args: [user],
      });
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  /**
   * Gets the current state for a user
   * @param user - The address of the user
   * @returns Object containing claimedToday and supportSpent
   */
  getUserState = async (user: Address): Promise<UserState> => {
    try {
      const [claimedToday, supportSpent] = await this.publicClient.readContract({
        address: this.instanceAddress,
        abi: RankifyDiamondInstanceAbi,
        functionName: "getUserState",
        args: [user],
      });

      return {
        claimedToday,
        supportSpent,
      };
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  /**
   * Gets the address of the pauser
   * @returns The address with pausing/unpausing permissions
   */
  getPauser = async (): Promise<Address> => {
    try {
      return await this.publicClient.readContract({
        address: this.instanceAddress,
        abi: RankifyDiamondInstanceAbi,
        functionName: "pauser",
      });
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  /**
   * Gets the Multipass contract address
   * @returns The address of the Multipass contract
   */
  getMultipass = async (): Promise<Address> => {
    try {
      return await this.publicClient.readContract({
        address: this.instanceAddress,
        abi: RankifyDiamondInstanceAbi,
        functionName: "multipass",
      });
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  /**
   * Gets the governance token contract address
   * @returns The address of the DistributableGovernanceERC20 token
   */
  getToken = async (): Promise<Address> => {
    try {
      return await this.publicClient.readContract({
        address: this.instanceAddress,
        abi: RankifyDiamondInstanceAbi,
        functionName: "token",
      });
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  /**
   * Checks if the contract is currently paused
   * @returns True if paused, false otherwise
   */
  isPaused = async (): Promise<boolean> => {
    try {
      return await this.publicClient.readContract({
        address: this.instanceAddress,
        abi: RankifyDiamondInstanceAbi,
        functionName: "paused",
      });
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  /**
   * Gets comprehensive information about a user's current status
   * @param user - The address of the user
   * @returns Object containing user state, last claimed day, and current day
   */
  getUserInfo = async (
    user: Address
  ): Promise<{
    userState: UserState;
    lastClaimedAt: bigint;
    currentDay: bigint;
    canClaim: boolean;
  }> => {
    try {
      const [userState, lastClaimedAt, currentDay] = await Promise.all([
        this.getUserState(user),
        this.getLastClaimedAt(user),
        this.getCurrentDay(),
      ]);

      return {
        userState,
        lastClaimedAt,
        currentDay,
        canClaim: lastClaimedAt < currentDay,
      };
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  /**
   * Gets comprehensive information about a proposal
   * @param proposalHash - The hash of the proposal
   * @param day - Optional day to get daily score (defaults to current day - 1)
   * @returns Object containing lifetime stats and daily score
   */
  getProposalInfo = async (
    proposalHash: Hex,
    day?: bigint
  ): Promise<{
    lifetimeStats: ProposalGlobalStats;
    dailyScore: DailyProposal;
    day: bigint;
  }> => {
    try {
      const queryDay = day ?? (await this.getCurrentDay()) - 1n;
      const [lifetimeStats, dailyScore] = await Promise.all([
        this.getProposalLifetimeStats(proposalHash),
        this.getProposalDailyScore(proposalHash, queryDay),
      ]);

      return {
        lifetimeStats,
        dailyScore,
        day: queryDay,
      };
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  /**
   * Gets all proposals for a specific day (requires querying events or off-chain indexer)
   * This is a helper method that would typically use an indexer/subgraph
   * @param day - The day to query
   * @returns The count of proposals for that day
   */
  getDayProposals = async (day: bigint): Promise<{ count: bigint; day: bigint }> => {
    try {
      const count = await this.getProposalsCnt(day);
      return {
        count,
        day,
      };
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  // ==================== WRITE OPERATIONS ====================

  /**
   * Claims daily UBI tokens and optionally submits a proposal
   * @param proposalText - The proposal text (empty string for no proposal)
   * @returns Transaction hash
   * @throws Error if wallet client is not configured
   */
  claim = async (proposalText: string = ""): Promise<Hash> => {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.account) {
      throw new Error("Account required for write operations");
    }

    try {
      const { request } = await this.publicClient.simulateContract({
        address: this.instanceAddress,
        abi: RankifyDiamondInstanceAbi,
        functionName: "claim",
        args: [proposalText],
        account: this.account,
      });

      const hash = await this.walletClient.writeContract(request);
      return hash;
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  /**
   * Supports one or more proposals from the previous day using quadratic voting
   * @param votes - Array of vote elements (proposal hash and amount)
   * @returns Transaction hash
   * @throws Error if wallet client is not configured
   */
  support = async (votes: VoteElement[]): Promise<Hash> => {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.account) {
      throw new Error("Account required for write operations");
    }

    try {
      const formattedVotes = votes.map((v) => ({
        proposal: v.proposal,
        amount: v.amount,
      })) as readonly { proposal: Hex; amount: bigint }[];

      const { request } = await this.publicClient.simulateContract({
        address: this.instanceAddress,
        abi: RankifyDiamondInstanceAbi,
        functionName: "support",
        args: [formattedVotes],
        account: this.account,
      });

      const hash = await this.walletClient.writeContract(request);
      return hash;
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  /**
   * Pauses the UBI contract (only callable by pauser)
   * @returns Transaction hash
   * @throws Error if wallet client is not configured or caller is not pauser
   */
  pause = async (): Promise<Hash> => {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.account) {
      throw new Error("Account required for write operations");
    }

    try {
      const { request } = await this.publicClient.simulateContract({
        address: this.instanceAddress,
        abi: RankifyDiamondInstanceAbi,
        functionName: "pause",
        account: this.account,
      });

      const hash = await this.walletClient.writeContract(request);
      return hash;
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  /**
   * Unpauses the UBI contract (only callable by pauser)
   * @returns Transaction hash
   * @throws Error if wallet client is not configured or caller is not pauser
   */
  unpause = async (): Promise<Hash> => {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations");
    }
    if (!this.account) {
      throw new Error("Account required for write operations");
    }

    try {
      const { request } = await this.publicClient.simulateContract({
        address: this.instanceAddress,
        abi: RankifyDiamondInstanceAbi,
        functionName: "unpause",
        account: this.account,
      });

      const hash = await this.walletClient.writeContract(request);
      return hash;
    } catch (e) {
      throw await handleRPCError(e);
    }
  };
}
