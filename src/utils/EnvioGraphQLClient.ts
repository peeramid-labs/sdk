import { Address } from "viem";
import { GraphQLClient, gql } from "graphql-request";
import { logger } from "./logger";

/**
 * Envio GraphQL API client configuration
 */
export interface EnvioGraphQLClientConfig {
  /**
   * The URL of the Envio GraphQL API
   */
  endpoint: string;

  /**
   * Optional API key for authenticated requests
   */
  apiKey?: string;

  /**
   * Chain ID for filtering events
   */
  chainId?: number;

  /**
   * Whether to fall back to RPC when GraphQL queries fail
   * @default true
   */
  fallbackToRPC?: boolean;

  /**
   * Optional HTTP cookies to include with every GraphQL request.
   * Can be provided either as a serialized cookie string or as a key/value map.
   */
  cookies?: CookieInput;
}

/**
 * Default Envio GraphQL client configuration
 */
const DEFAULT_CONFIG: EnvioGraphQLClientConfig = {
  endpoint: process.env.INDEXER_URL || "http://localhost:8080/v1/graphql",
  chainId: process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID) : undefined,
  fallbackToRPC: true,
};

/**
 * Filter operators for GraphQL queries
 */
type FilterOperator = "_eq" | "_gt" | "_gte" | "_lt" | "_lte" | "_in" | "_neq";

/**
 * Filter value types
 */
type FilterValue = string | number | bigint | boolean | string[] | number[] | bigint[];

/**
 * Generic filter type for GraphQL queries
 */
export type GraphQLFilter = Record<string, Record<FilterOperator, FilterValue>>;

type CookieInput = string | Record<string, string>;

/**
 * Type for GraphQL query variables
 */
type GraphQLQueryVariables = {
  gameId?: string | number;
  creator?: string;
  gm?: string;
  participant?: string;
  proposer?: string;
  player?: string;
  roundNumber?: string | number;
  limit?: number;
  offset?: number;
  contractAddress?: string;
  instanceAddress?: string;
  distributionId?: string;
  instanceId?: string;
};

export interface MAOInstanceData {
  distributionId: string;
  newInstanceId: string;
  version?: string;
  instances: string[];
  args: string;
  blockNumber: string;
  blockTimestamp: string;
  chainId: number;
}

// Raw GraphQL event types for Multipass
interface RawMultipassDomainActivatedEvent {
  id: string;
  domainName: string;
  blockNumber: string;
  blockTimestamp: string;
  chainId: number;
  hash: string;
}

interface RawMultipassDomainDeactivatedEvent {
  id: string;
  domainName: string;
  blockNumber: string;
  blockTimestamp: string;
  chainId: number;
  hash: string;
}

interface RawMultipassDomainFeeChangedEvent {
  id: string;
  domainName: string;
  newFee: string;
  blockNumber: string;
  blockTimestamp: string;
  chainId: number;
  hash: string;
}

interface RawMultipassInitializedDomainEvent {
  id: string;
  registrar: string;
  fee: string;
  domainName: string;
  renewalFee: string;
  referrerReward: string;
  referralDiscount: string;
  blockNumber: string;
  blockTimestamp: string;
  chainId: number;
  hash: string;
}

interface RawMultipassOwnershipTransferredEvent {
  id: string;
  previousOwner: string;
  newOwner: string;
  blockNumber: string;
  blockTimestamp: string;
  chainId: number;
  hash: string;
}

interface RawMultipassReferralProgramChangedEvent {
  id: string;
  domainName: string;
  reward: string;
  discount: string;
  blockNumber: string;
  blockTimestamp: string;
  chainId: number;
  hash: string;
}

interface RawMultipassRegisteredEvent {
  id: string;
  domainName: string;
  wallet: string;
  userId: string;
  nonce: string;
  validUntil: string;
  name: string;
  blockNumber: string;
  blockTimestamp: string;
  chainId: number;
  hash: string;
}

interface RawMultipassRegistrarChangedEvent {
  id: string;
  domainName: string;
  registrar: string;
  blockNumber: string;
  blockTimestamp: string;
  chainId: number;
  hash: string;
}

interface RawMultipassRenewalFeeChangedEvent {
  id: string;
  domainName: string;
  newFee: string;
  blockNumber: string;
  blockTimestamp: string;
  chainId: number;
  hash: string;
}

interface RawMultipassRenewedEvent {
  id: string;
  domainName: string;
  wallet: string;
  userId: string;
  nonce: string;
  validUntil: string;
  name: string;
  blockNumber: string;
  blockTimestamp: string;
  chainId: number;
  hash: string;
}

interface RawMultipassFundsWithdrawnEvent {
  id: string;
  account: string;
  amount: string;
  blockNumber: string;
  blockTimestamp: string;
  chainId: number;
  hash: string;
}

interface RawMultipassNameDeletedEvent {
  id: string;
  domainName: string;
  wallet: string;
  userId: string;
  name: string;
  blockNumber: string;
  blockTimestamp: string;
  chainId: number;
  hash: string;
}

/**
 * Client for interacting with Envio GraphQL API to retrieve indexed blockchain events
 */
export class EnvioGraphQLClient {
  private config: EnvioGraphQLClientConfig;
  public client: GraphQLClient;
  private cookieHeader?: string;
  private headers: Record<string, string>;

  /**
   * Create a new Envio GraphQL client
   * @param config - Optional configuration for the client
   */
  constructor(config: Partial<EnvioGraphQLClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Log the endpoint we're using
    console.debug(`Initializing EnvioGraphQLClient with endpoint: ${this.config.endpoint}`);

    if (this.config.endpoint === DEFAULT_CONFIG.endpoint) {
      console.debug(
        `Using default endpoint ${DEFAULT_CONFIG.endpoint}. Set INDEXER_URL environment variable to override.`
      );
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    };

    if (this.config.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }

    this.cookieHeader = this.buildCookieHeader(this.config.cookies);

    if (this.cookieHeader) {
      headers["Cookie"] = this.cookieHeader;
    }

    this.headers = headers;

    this.client = new GraphQLClient(this.config.endpoint, {
      headers: this.headers,
      credentials: "include",
    });
  }

  /**
   * Update the cookies sent with every GraphQL request.
   * Passing undefined or an empty string clears previously set cookies.
   */
  public setCookies(cookies?: CookieInput | string) {
    this.cookieHeader = this.buildCookieHeader(cookies);

    if (this.cookieHeader) {
      this.headers = {
        ...this.headers,
        Cookie: this.cookieHeader,
      };
    } else {
      const updatedHeaders = { ...this.headers };
      delete updatedHeaders.Cookie;
      this.headers = updatedHeaders;
    }

    this.client.setHeaders(this.headers);
  }

  private buildCookieHeader(cookies?: CookieInput | string): string | undefined {
    if (!cookies) {
      return undefined;
    }

    if (typeof cookies === "string") {
      const trimmed = cookies.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }

    const parts = Object.entries(cookies)
      .filter(([key, value]) => key && value !== undefined && value !== null && value !== "")
      .map(([key, value]) => `${key}=${value}`);

    return parts.length > 0 ? parts.join("; ") : undefined;
  }

  /**
   * Get GameCreated events for a specific creator or game ID
   */
  async getGameCreatedEvents({
    creator,
    gameId,
    gm,
    contractAddress,
    limit = 10,
    offset = 0,
  }: {
    creator?: Address;
    gameId?: bigint;
    gm?: Address;
    contractAddress: Address;
    limit?: number;
    offset?: number;
  }) {
    try {
      // Use direct string interpolation for the query - no variables for numeric fields
      const gameIdStr = gameId !== undefined ? gameId.toString() : undefined;

      // Build where conditions
      const whereParts = [];

      if (creator) {
        whereParts.push(`creator: { _eq: "${creator}" }`);
      }

      if (gameIdStr !== undefined) {
        whereParts.push(`gameId: { _eq: ${gameIdStr} }`);
      }

      if (gm) {
        whereParts.push(`gm: { _eq: "${gm}" }`);
      }

      if (contractAddress) {
        whereParts.push(`srcAddress: { _eq: "${contractAddress}" }`);
      }

      if (this.config.chainId !== undefined) {
        whereParts.push(`chainId: { _eq: ${this.config.chainId} }`);
      }

      const whereClause = whereParts.length > 0 ? whereParts.join(", ") : "";

      // Simpler query with direct string literals instead of variables
      const query = gql`
        query {
          RankifyInstance_gameCreated(
            where: {
              ${whereClause}
            }
            limit: ${limit}
            offset: ${offset}
            order_by: { blockTimestamp: desc }
          ) {
            id
            gameId
            gm
            creator
            rank
            blockNumber
            blockTimestamp
            chainId
            srcAddress
          }
        }
      `;

      const result = await this.client.request<{
        RankifyInstance_gameCreated: Array<{
          id: string;
          gameId: string;
          gm: string;
          creator: string;
          rank: string;
          blockNumber: string;
          blockTimestamp: string;
          chainId: number;
          srcAddress: string;
        }>;
      }>(query);

      return result.RankifyInstance_gameCreated.map((event) => ({
        ...event,
        gameId: BigInt(event.gameId),
        rank: BigInt(event.rank),
        blockNumber: BigInt(event.blockNumber),
        chainId: event.chainId,
        contractAddress: event.srcAddress as Address,
        gm: event.gm as Address,
        creator: event.creator as Address,
      }));
    } catch (error) {
      console.error("Error fetching game created events:", error);
      throw error;
    }
  }

  /**
   * Get player joined events for a specific game and participant
   */
  async getPlayerJoinedEvents({
    gameId,
    participant,
    contractAddress,
  }: {
    gameId: bigint;
    participant?: Address;
    contractAddress: Address;
  }) {
    try {
      // Use direct string interpolation for the query - no variables for numeric fields
      const gameIdStr = gameId.toString();

      // Build where conditions
      const whereParts = [];
      whereParts.push(`gameId: { _eq: ${gameIdStr} }`);

      if (participant) {
        whereParts.push(`participant: { _eq: "${participant}" }`);
      }

      if (contractAddress) {
        whereParts.push(`srcAddress: { _eq: "${contractAddress}" }`);
      }

      if (this.config.chainId !== undefined) {
        whereParts.push(`chainId: { _eq: ${this.config.chainId} }`);
      }

      const whereClause = whereParts.join(", ");

      // Simpler query with direct string literals instead of variables
      const query = gql`
        query {
          RankifyInstance_PlayerJoined(
            where: {
              ${whereClause}
            }
            order_by: { blockTimestamp: asc }
          ) {
            id
            gameId
            participant
            gmCommitment
            voterPubKey
            blockNumber
            blockTimestamp
            chainId
            srcAddress
            transactionIndex
            logIndex
          }
        }
      `;

      const result = await this.client.request<{
        RankifyInstance_PlayerJoined: Array<{
          id: string;
          gameId: string;
          participant: string;
          gmCommitment: string;
          voterPubKey: string;
          blockNumber: string;
          blockTimestamp: string;
          chainId: number;
          srcAddress: string;
          transactionIndex: number;
          logIndex: number;
        }>;
      }>(query);

      return result.RankifyInstance_PlayerJoined.map((event) => ({
        ...event,
        gameId: BigInt(event.gameId),
        blockNumber: BigInt(event.blockNumber),
        chainId: event.chainId,
        contractAddress: event.srcAddress as Address,
        participant: event.participant as Address,
        transactionIndex: event.transactionIndex,
        logIndex: event.logIndex,
      }));
    } catch (error) {
      console.error("Error fetching player joined events:", error);
      throw error;
    }
  }

  /**
   * Get proposal submitted events for a specific game and turn
   */
  async getProposalSubmittedEvents({
    gameId,
    turn,
    proposer,
    contractAddress,
  }: {
    gameId: bigint;
    turn?: bigint;
    proposer?: Address;
    contractAddress: Address;
  }) {
    try {
      // Use direct string interpolation for the query - no variables for numeric fields
      const gameIdStr = gameId.toString();
      const turnStr = turn !== undefined ? turn.toString() : undefined;

      // Build where conditions
      const whereParts = [];
      whereParts.push(`gameId: { _eq: ${gameIdStr} }`);

      if (turnStr !== undefined) {
        whereParts.push(`roundNumber: { _eq: ${turnStr} }`);
      }

      if (proposer) {
        whereParts.push(`proposer: { _eq: "${proposer}" }`);
      }

      if (contractAddress) {
        whereParts.push(`srcAddress: { _eq: "${contractAddress}" }`);
      }

      if (this.config.chainId !== undefined) {
        whereParts.push(`chainId: { _eq: ${this.config.chainId} }`);
      }

      const whereClause = whereParts.join(", ");

      // Simpler query with direct string literals instead of variables
      const query = gql`
        query {
          RankifyInstance_ProposalSubmitted(
            where: {
              ${whereClause}
            }
            order_by: { blockTimestamp: asc }
          ) {
            id
            gameId
            roundNumber
            proposer
            commitment
            encryptedProposal
            gmSignature
            proposerSignature
            blockNumber
            blockTimestamp
            chainId
            srcAddress
          }
        }
      `;

      const result = await this.client.request<{
        RankifyInstance_ProposalSubmitted: Array<{
          id: string;
          gameId: string;
          roundNumber: string;
          proposer: string;
          commitment: string;
          encryptedProposal: string;
          gmSignature: string;
          proposerSignature: string;
          blockNumber: string;
          blockTimestamp: string;
          chainId: number;
          srcAddress: string;
        }>;
      }>(query);

      return result.RankifyInstance_ProposalSubmitted.map((event) => ({
        ...event,
        gameId: BigInt(event.gameId),
        roundNumber: BigInt(event.roundNumber),
        commitment: BigInt(event.commitment),
        blockNumber: BigInt(event.blockNumber),
        chainId: event.chainId,
        contractAddress: event.srcAddress as Address,
        proposer: event.proposer as Address,
      }));
    } catch (error) {
      console.error("Error fetching proposal submitted events:", error);
      throw error;
    }
  }

  /**
   * Get vote submitted events for a specific game and turn
   */
  async getVoteSubmittedEvents({
    gameId,
    turn,
    player,
    contractAddress,
  }: {
    gameId: bigint;
    turn?: bigint;
    player?: Address;
    contractAddress: Address;
  }) {
    try {
      // Use direct string interpolation for the query - no variables for numeric fields
      const gameIdStr = gameId.toString();
      const turnStr = turn !== undefined ? turn.toString() : undefined;

      // Build where conditions
      const whereParts = [];
      whereParts.push(`gameId: { _eq: ${gameIdStr} }`);

      if (turnStr !== undefined) {
        whereParts.push(`roundNumber: { _eq: ${turnStr} }`);
      }

      if (player) {
        whereParts.push(`player: { _eq: "${player}" }`);
      }

      if (contractAddress) {
        whereParts.push(`srcAddress: { _eq: "${contractAddress}" }`);
      }

      if (this.config.chainId !== undefined) {
        whereParts.push(`chainId: { _eq: ${this.config.chainId} }`);
      }

      const whereClause = whereParts.join(", ");

      // Simpler query with direct string literals instead of variables
      const query = gql`
        query {
          RankifyInstance_VoteSubmitted(
            where: {
              ${whereClause}
            }
            order_by: { blockTimestamp: asc }
          ) {
            id
            gameId
            roundNumber
            player
            sealedBallotId
            gmSignature
            voterSignature
            ballotHash
            blockNumber
            blockTimestamp
            chainId
            srcAddress
          }
        }
      `;

      const result = await this.client.request<{
        RankifyInstance_VoteSubmitted: Array<{
          id: string;
          gameId: string;
          roundNumber: string;
          player: string;
          sealedBallotId: string;
          gmSignature: string;
          voterSignature: string;
          ballotHash: string;
          blockNumber: string;
          blockTimestamp: string;
          chainId: number;
          srcAddress: string;
        }>;
      }>(query);

      return result.RankifyInstance_VoteSubmitted.map((event) => ({
        ...event,
        gameId: BigInt(event.gameId),
        roundNumber: BigInt(event.roundNumber),
        blockNumber: BigInt(event.blockNumber),
        chainId: event.chainId,
        contractAddress: event.srcAddress as Address,
        player: event.player as Address,
      }));
    } catch (error) {
      console.error("Error fetching vote submitted events:", error);
      throw error;
    }
  }

  /**
   * Get registration open events for a specific game
   */
  async getRegistrationOpenEvents({ gameId, contractAddress }: { gameId: bigint; contractAddress: Address }) {
    try {
      // Use direct string interpolation for the query - no variables for numeric fields
      const gameIdStr = gameId.toString();

      // Build where conditions
      const whereParts = [];
      whereParts.push(`gameId: { _eq: ${gameIdStr} }`);

      if (contractAddress) {
        whereParts.push(`srcAddress: { _eq: "${contractAddress}" }`);
      }

      if (this.config.chainId !== undefined) {
        whereParts.push(`chainId: { _eq: ${this.config.chainId} }`);
      }

      const whereClause = whereParts.join(", ");

      // Simpler query with direct string literals instead of variables
      const query = gql`
        query {
          RankifyInstance_RegistrationOpen(
            where: {
              ${whereClause}
            },
            limit: 1
          ) {
            id
            gameId
            blockNumber
            blockTimestamp
            chainId
            srcAddress
          }
        }
      `;

      const result = await this.client.request<{
        RankifyInstance_RegistrationOpen: Array<{
          id: string;
          gameId: string;
          blockNumber: string;
          blockTimestamp: string;
          chainId: number;
          srcAddress: string;
        }>;
      }>(query);

      return result.RankifyInstance_RegistrationOpen.map((event) => ({
        ...event,
        gameId: BigInt(event.gameId),
        blockNumber: BigInt(event.blockNumber),
        chainId: event.chainId,
        contractAddress: event.srcAddress as Address,
      }));
    } catch (error) {
      console.error("Error fetching registration open events:", error);
      throw error;
    }
  }

  /**
   * Get proposal score events for a specific game and turn
   */
  async getProposalScoreEvents({
    gameId,
    turn,
    contractAddress,
  }: {
    gameId: bigint;
    turn?: bigint;
    contractAddress: Address;
  }) {
    try {
      // Use direct string interpolation for the query - no variables for numeric fields
      const gameIdStr = gameId.toString();
      const turnStr = turn !== undefined ? turn.toString() : undefined;

      // Build where conditions
      const whereParts = [];
      whereParts.push(`gameId: { _eq: ${gameIdStr} }`);

      if (turnStr !== undefined) {
        whereParts.push(`roundNumber: { _eq: ${turnStr} }`);
      }

      if (contractAddress) {
        whereParts.push(`srcAddress: { _eq: "${contractAddress}" }`);
      }

      if (this.config.chainId !== undefined) {
        whereParts.push(`chainId: { _eq: ${this.config.chainId} }`);
      }

      const whereClause = whereParts.join(", ");

      // Simpler query with direct string literals instead of variables
      const query = gql`
        query {
          RankifyInstance_ProposalScore(
            where: {
              ${whereClause}
            }
            order_by: { blockTimestamp: desc }
          ) {
            id
            gameId
            roundNumber
            proposalHash
            proposal
            score
            blockNumber
            blockTimestamp
            chainId
            srcAddress
          }
        }
      `;

      const result = await this.client.request<{
        RankifyInstance_ProposalScore: Array<{
          id: string;
          gameId: string;
          roundNumber: string;
          proposalHash: string;
          proposal: string;
          score: string;
          blockNumber: string;
          blockTimestamp: string;
          chainId: number;
          srcAddress: string;
        }>;
      }>(query);

      return result.RankifyInstance_ProposalScore.map((event) => ({
        ...event,
        gameId: BigInt(event.gameId),
        turn: BigInt(event.roundNumber),
        roundNumber: BigInt(event.roundNumber),
        score: BigInt(event.score),
        blockNumber: BigInt(event.blockNumber),
        chainId: event.chainId,
        contractAddress: event.srcAddress as Address,
      }));
    } catch (error) {
      console.error("Error fetching proposal score events:", error);
      throw error;
    }
  }

  /**
   * Get game over events for a specific game
   */
  async getGameOverEvents({ gameId, contractAddress }: { gameId: bigint; contractAddress: Address }) {
    try {
      // Use direct string interpolation for the query - no variables for numeric fields
      const gameIdStr = gameId.toString();

      // Build where conditions
      const whereParts = [];
      whereParts.push(`gameId: { _eq: ${gameIdStr} }`);

      if (contractAddress) {
        whereParts.push(`srcAddress: { _eq: "${contractAddress}" }`);
      }

      if (this.config.chainId !== undefined) {
        whereParts.push(`chainId: { _eq: ${this.config.chainId} }`);
      }

      const whereClause = whereParts.join(", ");

      // Simpler query with direct string literals instead of variables
      const query = gql`
        query {
          RankifyInstance_GameOver(
            where: {
              ${whereClause}
            },
            limit: 1
          ) {
            id
            gameId
            players
            scores
            blockNumber
            blockTimestamp
            chainId
            srcAddress
          }
        }
      `;

      const result = await this.client.request<{
        RankifyInstance_GameOver: Array<{
          id: string;
          gameId: string;
          players: string[];
          scores: string[];
          blockNumber: string;
          blockTimestamp: string;
          chainId: number;
          srcAddress: string;
        }>;
      }>(query);

      return result.RankifyInstance_GameOver.map((event) => ({
        ...event,
        gameId: BigInt(event.gameId),
        scores: event.scores.map((score) => BigInt(score)),
        blockNumber: BigInt(event.blockNumber),
        chainId: event.chainId,
        contractAddress: event.srcAddress as Address,
        players: event.players.map((player) => player as Address),
      }));
    } catch (error) {
      console.error("Error fetching game over events:", error);
      throw error;
    }
  }

  /**
   * Get game started events for a specific game
   */
  async getGameStartedEvents({ gameId, contractAddress }: { gameId: bigint; contractAddress: Address }) {
    try {
      // Use direct string interpolation for the query - no variables for numeric fields
      const gameIdStr = gameId.toString();

      // Build where conditions
      const whereParts = [];
      whereParts.push(`gameId: { _eq: ${gameIdStr} }`);

      if (contractAddress) {
        whereParts.push(`srcAddress: { _eq: "${contractAddress}" }`);
      }

      if (this.config.chainId !== undefined) {
        whereParts.push(`chainId: { _eq: ${this.config.chainId} }`);
      }

      const whereClause = whereParts.join(", ");

      // Simpler query with direct string literals instead of variables
      const query = gql`
        query {
          RankifyInstance_GameStarted(
            where: {
              ${whereClause}
            },
            limit: 1,
            order_by: { blockTimestamp: desc }
          ) {
            id
            gameId
            blockNumber
            blockTimestamp
            chainId
            srcAddress
          }
        }
      `;

      const result = await this.client.request<{
        RankifyInstance_GameStarted: Array<{
          id: string;
          gameId: string;
          blockNumber: string;
          blockTimestamp: string;
          chainId: number;
          srcAddress: string;
        }>;
      }>(query);

      return result.RankifyInstance_GameStarted.map((event) => ({
        ...event,
        gameId: BigInt(event.gameId),
        blockNumber: BigInt(event.blockNumber),
        chainId: event.chainId,
        contractAddress: event.srcAddress as Address,
      }));
    } catch (error) {
      console.error("Error fetching game started events:", error);
      throw error;
    }
  }

  /**
   * Query MAO instances from the Envio GraphQL API
   * @param params Query parameters for filtering instances
   * @returns Array of MAO instance data
   */
  async queryInstances(params: {
    distributor?: Address;
    creator?: Address;
    distributionId?: string;
    instanceId?: bigint | string;
  }): Promise<MAOInstanceData[]> {
    try {
      // Convert parameters to strings
      const instanceIdStr = params.instanceId ? params.instanceId.toString() : undefined;
      const distributionIdStr = params.distributionId || undefined;

      // Build where conditions using the proper Envio GraphQL syntax
      const conditions = [];

      // Add simple equality conditions using _eq operator
      if (instanceIdStr) {
        conditions.push(`newInstanceId: { _eq: "${instanceIdStr}" }`);
      }

      if (distributionIdStr) {
        conditions.push(`distributionId: { _eq: "${distributionIdStr}" }`);
      }

      if (this.config.chainId !== undefined) {
        conditions.push(`chainId: { _eq: ${this.config.chainId} }`);
      }

      // For a simple query, let's just use these two main identifiers
      // and filter the results client-side for other criteria

      console.log("Querying DAODistributor_Instantiated with params:", {
        instanceId: instanceIdStr,
        distributionId: distributionIdStr,
      });

      const query = gql`
        query {
          DAODistributor_Instantiated(
            where: {
              ${conditions.length > 0 ? conditions.join(", ") : ""}
            }
            order_by: { blockTimestamp: desc }
            limit: ${instanceIdStr ? 1 : 100}
          ) {
            id
            distributionId
            newInstanceId
            instances
            args
            blockNumber
            blockTimestamp
            chainId
            version
          }
        }
      `;

      // Log the query for debugging (as a string)
      logger("GraphQL query:", 3);
      logger(query, 3);

      const result = await this.client.request<{
        DAODistributor_Instantiated: Array<{
          id: string;
          distributionId: string;
          newInstanceId: string;
          instances: string[];
          args: string;
          blockNumber: string;
          blockTimestamp: string;
          chainId: number;
          version?: string;
        }>;
      }>(query);

      if (!result.DAODistributor_Instantiated || result.DAODistributor_Instantiated.length === 0) {
        logger("No instances found with the given parameters", 3);
        return [];
      }

      logger(`Found ${result.DAODistributor_Instantiated.length} instance(s)`, 3);

      // Filter results client-side based on additional criteria
      let results = result.DAODistributor_Instantiated;

      // Return the filtered results
      return results.map((event) => ({
        distributionId: event.distributionId,
        newInstanceId: event.newInstanceId,
        version: event.version,
        instances: event.instances,
        args: event.args,
        blockNumber: event.blockNumber,
        blockTimestamp: event.blockTimestamp,
        chainId: event.chainId,
      }));
    } catch (error) {
      console.error("Error querying instances:", error);

      // Log more details about the error to help diagnose issues
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }

      if (
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof error.response === "object" &&
        error.response !== null &&
        "status" in error.response &&
        error.response.status === 404
      ) {
        console.error(
          "Server returned 404 - Check if the Envio indexer is running and accessible at",
          this.config.endpoint
        );
      } else if (
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof error.response === "object" &&
        error.response !== null &&
        "errors" in error.response
      ) {
        console.error("GraphQL errors:", error.response.errors);
      }

      throw error;
    }
  }

  /**
   * Get multiple game states with pagination
   */
  async getGameStates({
    skip = 0,
    first = 10,
    orderDirection = "desc",
    contractAddress,
  }: {
    skip?: number;
    first?: number;
    orderDirection?: "asc" | "desc";
    contractAddress: Address;
  }) {
    const variables: GraphQLQueryVariables = {
      limit: first,
      offset: skip,
      contractAddress: contractAddress,
    };

    const query = gql`
      query GetGames($limit: Int, $offset: Int, $contractAddress: String) {
        RankifyInstance_gameCreated(
          where: {
            srcAddress: { _eq: $contractAddress }
            ${this.config.chainId !== undefined ? `chainId: { _eq: ${this.config.chainId} }` : ""}
          }
          limit: $limit
          offset: $offset
          order_by: { blockTimestamp: ${orderDirection} }
        ) {
          gameId
          gm
          creator
          rank
          blockNumber
          blockTimestamp
          chainId
          srcAddress
        }
      }
    `;

    try {
      const result = await this.client.request<{
        RankifyInstance_gameCreated: Array<{
          gameId: string;
          gm: string;
          creator: string;
          rank: string;
          blockNumber: string;
          blockTimestamp: string;
          chainId: number;
          srcAddress: string;
        }>;
      }>(query, variables);

      // Fetch additional state info for each game
      const gameStates = await Promise.all(
        result.RankifyInstance_gameCreated.map(async (game) => {
          const gameId = BigInt(game.gameId);
          const [gameStartedEvents, gameOverEvents] = await Promise.all([
            this.getGameStartedEvents({ gameId, contractAddress }),
            this.getGameOverEvents({ gameId, contractAddress }),
          ]);

          // Determine current state
          const hasStarted = gameStartedEvents.length > 0;
          const isLastTurn = gameOverEvents.length > 0;
          const hasEnded = gameOverEvents.length > 0;

          return {
            gameId,
            gm: game.gm as Address,
            creator: game.creator as Address,
            rank: BigInt(game.rank),
            turn: 0n,
            hasStarted,
            isLastTurn,
            hasEnded,
            createdAt: game.blockTimestamp,
            contractAddress,
          };
        })
      );

      return gameStates;
    } catch (error) {
      console.error("Error fetching game states:", error);
      throw error;
    }
  }

  /**
   * Get MAO instances for a specific distribution
   */
  async getMAOInstances({ distributionId, contractAddress }: { distributionId: string; contractAddress: Address }) {
    try {
      // Build where conditions
      const whereParts = [];
      whereParts.push(`distributionId: { _eq: "${distributionId}" }`);

      if (contractAddress) {
        whereParts.push(`srcAddress: { _eq: "${contractAddress}" }`);
      }

      if (this.config.chainId !== undefined) {
        whereParts.push(`chainId: { _eq: ${this.config.chainId} }`);
      }

      const whereClause = whereParts.join(", ");

      // Simpler query with direct string literals instead of variables
      const query = gql`
        query {
          DAODistributor_Instantiated(
            where: {
              ${whereClause}
            }
            order_by: { blockTimestamp: desc }
          ) {
            id
            distributionId
            newInstanceId
            instances
            args
            blockNumber
            blockTimestamp
            chainId
            version
            srcAddress
          }
        }
      `;

      const result = await this.client.request<{
        DAODistributor_Instantiated: Array<{
          id: string;
          distributionId: string;
          newInstanceId: string;
          instances: string[];
          args: string;
          blockNumber: string;
          blockTimestamp: string;
          chainId: number;
          version?: string;
          srcAddress: string;
        }>;
      }>(query);

      return result.DAODistributor_Instantiated.map((event) => ({
        ...event,
        blockNumber: BigInt(event.blockNumber),
        chainId: event.chainId,
        contractAddress: event.srcAddress as Address,
      }));
    } catch (error) {
      console.error("Error fetching MAO instances:", error);
      throw error;
    }
  }

  async getProposingStageEndedEvents({
    gameId,
    turn,
    contractAddress,
  }: {
    gameId: bigint;
    turn: bigint;
    contractAddress: Address;
  }) {
    if (!gameId || !turn) {
      throw new Error("gameId and turn are required");
    }

    // Use direct string interpolation for the query - no variables for numeric fields
    const gameIdStr = gameId.toString();
    const roundNumberStr = turn.toString();

    const query = gql`
      query {
        RankifyInstance_ProposingStageEnded(
          where: {
            gameId: { _eq: ${gameIdStr} },
            roundNumber: { _eq: ${roundNumberStr} },
            srcAddress: { _eq: "${contractAddress}" }
            ${this.config.chainId !== undefined ? `, chainId: { _eq: ${this.config.chainId} }` : ""}
          }
        ) {
          id
          gameId
          roundNumber
          numProposals
          proposals
          blockNumber
          blockTimestamp
          chainId
          srcAddress
        }
      }
    `;

    const result = await this.client.request<{
      RankifyInstance_ProposingStageEnded: Array<{
        id: string;
        gameId: string;
        roundNumber: string;
        numProposals: string;
        proposals: string[];
        blockNumber: string;
        blockTimestamp: string;
        chainId: number;
        srcAddress: string;
      }>;
    }>(query);

    return result.RankifyInstance_ProposingStageEnded.map((event) => ({
      ...event,
      gameId: BigInt(event.gameId),
      roundNumber: BigInt(event.roundNumber),
      numProposals: Number(event.numProposals),
      blockNumber: BigInt(event.blockNumber),
      blockTimestamp: Number(event.blockTimestamp),
      chainId: event.chainId,
      srcAddress: event.srcAddress as Address,
    }));
  }

  getVotingStageResults = async ({
    gameId,
    turn,
    contractAddress,
  }: {
    gameId: bigint;
    turn: bigint;
    contractAddress: string;
  }) => {
    if (!gameId || !turn) {
      throw new Error("gameId and turn are required");
    }

    // Use direct string interpolation for the query - no variables for numeric fields
    const gameIdStr = gameId.toString();
    const turnStr = turn.toString();

    const query = gql`
      query {
        RankifyInstance_VotingStageResults(
          where: {
            gameId: { _eq: ${gameIdStr} },
            roundNumber: { _eq: ${turnStr} },
            srcAddress: { _eq: "${contractAddress}" }
            ${this.config.chainId !== undefined ? `, chainId: { _eq: ${this.config.chainId} }` : ""}
          }
        ) {
          id
          gameId
          roundNumber
          winner
          players
          scores
          votesSorted
          isActive
          finalizedVotingMatrix
          permutation
          blockNumber
          blockTimestamp
          chainId
          srcAddress
        }
      }
    `;

    const result = (await this.client.request(query)) as {
      RankifyInstance_VotingStageResults: Array<{
        id: string;
        gameId: string;
        roundNumber: string;
        winner: string;
        players: string[];
        scores: string[];
        votesSorted: string[][];
        isActive: boolean[];
        finalizedVotingMatrix: string[][];
        permutation: string[];
        blockNumber: string;
        blockTimestamp: string;
        chainId: number;
        srcAddress: string;
      }>;
    };

    return result.RankifyInstance_VotingStageResults.map((event) => ({
      ...event,
      gameId: BigInt(event.gameId),
      roundNumber: BigInt(event.roundNumber),
      winner: event.winner as Address,
      players: event.players.map((player) => player as Address),
      scores: event.scores.map((score) => BigInt(score)),
      votesSorted: event.votesSorted.map((votes) => votes.map((vote) => BigInt(vote))),
      finalizedVotingMatrix: event.finalizedVotingMatrix.map((votes) => votes.map((vote) => BigInt(vote))),
      permutation: event.permutation.map((index) => BigInt(index)),
      blockNumber: BigInt(event.blockNumber),
      blockTimestamp: Number(event.blockTimestamp),
      chainId: event.chainId,
      srcAddress: event.srcAddress as Address,
    }));
  };

  private async _queryMultipassEvents<T, R>(
    eventName: string,
    params: Record<string, string | number | bigint | undefined>,
    fields: string,
    mapper: (event: T) => R
  ): Promise<R[]> {
    try {
      const whereParts = Object.entries(params)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${key}: { _eq: "${value}" }`);

      if (this.config.chainId !== undefined) {
        whereParts.push(`chainId: { _eq: ${this.config.chainId} }`);
      }

      const whereClause = whereParts.join(", ");

      const query = gql`
        query {
          ${eventName}(
            where: { ${whereClause} },
            order_by: { blockTimestamp: desc }
          ) {
            ${fields}
          }
        }
      `;

      const result = await this.client.request<{ [key: string]: T[] }>(query);
      return result[eventName].map(mapper);
    } catch (error) {
      console.error(`Error fetching ${eventName} events:`, error);
      throw error;
    }
  }

  async getMultipassDomainActivatedEvents(params: { domainName?: string }) {
    return this._queryMultipassEvents(
      "MultipassDomainActivated",
      params,
      "id domainName blockNumber blockTimestamp chainId hash",
      (event: RawMultipassDomainActivatedEvent) => ({ ...event, blockNumber: BigInt(event.blockNumber) })
    );
  }

  async getMultipassDomainDeactivatedEvents(params: { domainName?: string }) {
    return this._queryMultipassEvents(
      "MultipassDomainDeactivated",
      params,
      "id domainName blockNumber blockTimestamp chainId hash",
      (event: RawMultipassDomainDeactivatedEvent) => ({ ...event, blockNumber: BigInt(event.blockNumber) })
    );
  }

  async getMultipassDomainFeeChangedEvents(params: { domainName?: string; newFee?: bigint }) {
    return this._queryMultipassEvents(
      "MultipassDomainFeeChanged",
      { ...params, newFee: params.newFee?.toString() },
      "id domainName newFee blockNumber blockTimestamp chainId hash",
      (event: RawMultipassDomainFeeChangedEvent) => ({
        ...event,
        blockNumber: BigInt(event.blockNumber),
        newFee: BigInt(event.newFee),
      })
    );
  }

  async getMultipassInitializedDomainEvents(params: { domainName?: string; registrar?: Address }) {
    return this._queryMultipassEvents(
      "MultipassInitializedDomain",
      params,
      "id registrar fee domainName renewalFee referrerReward referralDiscount blockNumber blockTimestamp chainId hash",
      (event: RawMultipassInitializedDomainEvent) => ({
        ...event,
        registrar: event.registrar as Address,
        fee: BigInt(event.fee),
        renewalFee: BigInt(event.renewalFee),
        referrerReward: BigInt(event.referrerReward),
        referralDiscount: BigInt(event.referralDiscount),
        blockNumber: BigInt(event.blockNumber),
      })
    );
  }

  async getMultipassOwnershipTransferredEvents(params: { previousOwner?: Address; newOwner?: Address }) {
    return this._queryMultipassEvents(
      "MultipassOwnershipTransferred",
      params,
      "id previousOwner newOwner blockNumber blockTimestamp chainId hash",
      (event: RawMultipassOwnershipTransferredEvent) => ({
        ...event,
        previousOwner: event.previousOwner as Address,
        newOwner: event.newOwner as Address,
        blockNumber: BigInt(event.blockNumber),
      })
    );
  }

  async getMultipassReferralProgramChangedEvents(params: { domainName?: string }) {
    return this._queryMultipassEvents(
      "MultipassReferralProgramChanged",
      params,
      "id domainName reward discount blockNumber blockTimestamp chainId hash",
      (event: RawMultipassReferralProgramChangedEvent) => ({
        ...event,
        reward: BigInt(event.reward),
        discount: BigInt(event.discount),
        blockNumber: BigInt(event.blockNumber),
      })
    );
  }

  async getMultipassRegisteredEvents(params: { domainName?: string; wallet?: Address; userId?: string }) {
    return this._queryMultipassEvents(
      "MultipassRegistered",
      params,
      "id domainName wallet userId nonce validUntil name blockNumber blockTimestamp chainId hash",
      (event: RawMultipassRegisteredEvent) => ({
        ...event,
        wallet: event.wallet as Address,
        nonce: BigInt(event.nonce),
        validUntil: BigInt(event.validUntil),
        blockNumber: BigInt(event.blockNumber),
      })
    );
  }

  async getMultipassRegistrarChangedEvents(params: { domainName?: string; registrar?: Address }) {
    return this._queryMultipassEvents(
      "MultipassRegistrarChanged",
      params,
      "id domainName registrar blockNumber blockTimestamp chainId hash",
      (event: RawMultipassRegistrarChangedEvent) => ({
        ...event,
        registrar: event.registrar as Address,
        blockNumber: BigInt(event.blockNumber),
      })
    );
  }

  async getMultipassRenewalFeeChangedEvents(params: { domainName?: string; newFee?: bigint }) {
    return this._queryMultipassEvents(
      "MultipassRenewalFeeChanged",
      { ...params, newFee: params.newFee?.toString() },
      "id domainName newFee blockNumber blockTimestamp chainId hash",
      (event: RawMultipassRenewalFeeChangedEvent) => ({
        ...event,
        newFee: BigInt(event.newFee),
        blockNumber: BigInt(event.blockNumber),
      })
    );
  }

  async getMultipassRenewedEvents(params: { domainName?: string; wallet?: Address; userId?: string }) {
    return this._queryMultipassEvents(
      "MultipassRenewed",
      params,
      "id domainName wallet userId nonce validUntil name blockNumber blockTimestamp chainId hash",
      (event: RawMultipassRenewedEvent) => ({
        ...event,
        wallet: event.wallet as Address,
        nonce: BigInt(event.nonce),
        validUntil: BigInt(event.validUntil),
        blockNumber: BigInt(event.blockNumber),
      })
    );
  }

  async getMultipassFundsWithdrawnEvents(params: { account?: Address }) {
    // Note: `fundsWithdawn` is used to match the provided schema name
    return this._queryMultipassEvents(
      "MultipassfundsWithdawn",
      params,
      "id account amount blockNumber blockTimestamp chainId hash",
      (event: RawMultipassFundsWithdrawnEvent) => ({
        ...event,
        account: event.account as Address,
        amount: BigInt(event.amount),
        blockNumber: BigInt(event.blockNumber),
      })
    );
  }

  async getMultipassNameDeletedEvents(params: { domainName?: string; wallet?: Address; userId?: string }) {
    return this._queryMultipassEvents(
      "MultipassNameDeleted",
      params,
      "id domainName wallet userId name blockNumber blockTimestamp chainId hash",
      (event: RawMultipassNameDeletedEvent) => ({
        ...event,
        wallet: event.wallet as Address,
        blockNumber: BigInt(event.blockNumber),
      })
    );
  }

  // ==================== UBI QUERIES ====================

  /**
   * Get UBI proposal events by proposer
   */
  async getUBIProposingByAddressEvents({
    instanceAddress,
    proposer,
    day,
    limit = 100,
    offset = 0,
  }: {
    instanceAddress: Address;
    proposer?: Address;
    day?: bigint;
    limit?: number;
    offset?: number;
  }) {
    try {
      const variables: {
        instanceAddress: string;
        proposer?: string;
        day?: string;
        chainId?: number;
        limit: number;
        offset: number;
      } = {
        instanceAddress,
        limit,
        offset,
      };

      if (proposer) {
        variables.proposer = proposer;
      }

      if (day !== undefined) {
        variables.day = day.toString();
      }

      if (this.config.chainId !== undefined) {
        variables.chainId = this.config.chainId;
      }

      const query = gql`
        query GetUBIProposingByAddress($instanceAddress: String!, $proposer: String, $day: numeric, $chainId: Int, $limit: Int!, $offset: Int!) {
          UBIProposingByAddress(
            where: {
              instanceAddress: { _eq: $instanceAddress }
              ${proposer !== undefined ? "proposer: { _eq: $proposer }" : ""}
              ${day !== undefined ? "day: { _eq: $day }" : ""}
              ${this.config.chainId !== undefined ? "chainId: { _eq: $chainId }" : ""}
            }
            order_by: { blockTimestamp: desc }
            limit: $limit
            offset: $offset
          ) {
            id
            proposer
            day
            proposal
            proposalText
            scoreWhenProposed
            instanceAddress
            blockNumber
            blockTimestamp
            chainId
            hash
          }
        }
      `;

      const result = await this.client.request<{
        UBIProposingByAddress: Array<{
          id: string;
          proposer: string;
          day: string;
          proposal: string;
          proposalText: string;
          scoreWhenProposed: string;
          instanceAddress: string;
          blockNumber: string;
          blockTimestamp: string;
          chainId: number;
          hash: string;
        }>;
      }>(query, variables);

      return result.UBIProposingByAddress.map((event) => ({
        ...event,
        proposer: event.proposer as Address,
        day: BigInt(event.day),
        scoreWhenProposed: BigInt(event.scoreWhenProposed),
        instanceAddress: event.instanceAddress as Address,
        blockNumber: BigInt(event.blockNumber),
        chainId: event.chainId,
      }));
    } catch (error) {
      console.error("Error fetching UBI proposing events:", error);
      throw error;
    }
  }

  /**
   * Get UBI proposal score updates by proposal hash
   */
  async getUBIProposalScoreUpdatedByProposalEvents({
    instanceAddress,
    proposal,
    day,
    limit = 100,
    offset = 0,
  }: {
    instanceAddress: Address;
    proposal?: string;
    day?: bigint;
    limit?: number;
    offset?: number;
  }) {
    try {
      const variables: {
        instanceAddress: string;
        proposal?: string;
        day?: string;
        chainId?: number;
        limit: number;
        offset: number;
      } = {
        instanceAddress,
        limit,
        offset,
      };

      if (proposal) {
        variables.proposal = proposal;
      }

      if (day !== undefined) {
        variables.day = day.toString();
      }

      if (this.config.chainId !== undefined) {
        variables.chainId = this.config.chainId;
      }

      const query = gql`
        query GetUBIProposalScoreUpdated($instanceAddress: String!, $proposal: String, $day: numeric, $chainId: Int, $limit: Int!, $offset: Int!) {
          UBIProposalScoreUpdatedByProposal(
            where: {
              instanceAddress: { _eq: $instanceAddress }
              ${proposal !== undefined ? "proposal: { _eq: $proposal }" : ""}
              ${day !== undefined ? "day: { _eq: $day }" : ""}
              ${this.config.chainId !== undefined ? "chainId: { _eq: $chainId }" : ""}
            }
            order_by: { blockTimestamp: desc }
            limit: $limit
            offset: $offset
          ) {
            id
            dailyScore
            day
            proposal
            proposer
            instanceAddress
            blockNumber
            blockTimestamp
            chainId
            hash
          }
        }
      `;

      const result = await this.client.request<{
        UBIProposalScoreUpdatedByProposal: Array<{
          id: string;
          dailyScore: string;
          day: string;
          proposal: string;
          proposer: string;
          instanceAddress: string;
          blockNumber: string;
          blockTimestamp: string;
          chainId: number;
          hash: string;
        }>;
      }>(query, variables);

      return result.UBIProposalScoreUpdatedByProposal.map((event) => ({
        ...event,
        dailyScore: BigInt(event.dailyScore),
        day: BigInt(event.day),
        proposer: event.proposer as Address,
        instanceAddress: event.instanceAddress as Address,
        blockNumber: BigInt(event.blockNumber),
        chainId: event.chainId,
      }));
    } catch (error) {
      console.error("Error fetching UBI proposal score updated events:", error);
      throw error;
    }
  }

  /**
   * Get UBI voting events by address
   */
  async getUBIVotingByAddressEvents({
    instanceAddress,
    participant,
    proposal,
    day,
    limit = 100,
    offset = 0,
  }: {
    instanceAddress: Address;
    participant?: Address;
    proposal?: string;
    day?: bigint;
    limit?: number;
    offset?: number;
  }) {
    try {
      const variables: {
        instanceAddress: string;
        participant?: string;
        proposal?: string;
        day?: string;
        chainId?: number;
        limit: number;
        offset: number;
      } = {
        instanceAddress,
        limit,
        offset,
      };

      if (participant) {
        variables.participant = participant;
      }

      if (proposal) {
        variables.proposal = proposal;
      }

      if (day !== undefined) {
        variables.day = day.toString();
      }

      if (this.config.chainId !== undefined) {
        variables.chainId = this.config.chainId;
      }

      const query = gql`
        query GetUBIVotingByAddress($instanceAddress: String!, $participant: String, $proposal: String, $day: numeric, $chainId: Int, $limit: Int!, $offset: Int!) {
          UBIVotingByAddress(
            where: {
              instanceAddress: { _eq: $instanceAddress }
              ${participant !== undefined ? "participant: { _eq: $participant }" : ""}
              ${proposal !== undefined ? "proposal: { _eq: $proposal }" : ""}
              ${day !== undefined ? "day: { _eq: $day }" : ""}
              ${this.config.chainId !== undefined ? "chainId: { _eq: $chainId }" : ""}
            }
            order_by: { blockTimestamp: desc }
            limit: $limit
            offset: $offset
          ) {
            id
            participant
            day
            proposal
            amount
            instanceAddress
            blockNumber
            blockTimestamp
            chainId
            hash
          }
        }
      `;

      const result = await this.client.request<{
        UBIVotingByAddress: Array<{
          id: string;
          participant: string;
          day: string;
          proposal: string;
          amount: string;
          instanceAddress: string;
          blockNumber: string;
          blockTimestamp: string;
          chainId: number;
          hash: string;
        }>;
      }>(query, variables);

      return result.UBIVotingByAddress.map((event) => ({
        ...event,
        participant: event.participant as Address,
        day: BigInt(event.day),
        amount: BigInt(event.amount),
        instanceAddress: event.instanceAddress as Address,
        blockNumber: BigInt(event.blockNumber),
        chainId: event.chainId,
      }));
    } catch (error) {
      console.error("Error fetching UBI voting events:", error);
      throw error;
    }
  }

  /**
   * Get UBI claimed events
   */
  async getUBIClaimedEvents({
    instanceAddress,
    user,
    limit = 100,
    offset = 0,
  }: {
    instanceAddress: Address;
    user?: Address;
    limit?: number;
    offset?: number;
  }) {
    try {
      const variables: {
        instanceAddress: string;
        user?: string;
        chainId?: number;
        limit: number;
        offset: number;
      } = {
        instanceAddress,
        limit,
        offset,
      };

      if (user) {
        variables.user = user;
      }

      if (this.config.chainId !== undefined) {
        variables.chainId = this.config.chainId;
      }

      const query = gql`
        query GetUBIClaimed($instanceAddress: String!, $user: String, $chainId: Int, $limit: Int!, $offset: Int!) {
          UBIClaimed(
            where: {
              instanceAddress: { _eq: $instanceAddress }
              ${user !== undefined ? "user: { _eq: $user }" : ""}
              ${this.config.chainId !== undefined ? "chainId: { _eq: $chainId }" : ""}
            }
            order_by: { blockTimestamp: desc }
            limit: $limit
            offset: $offset
          ) {
            id
            user
            amount
            instanceAddress
            blockNumber
            blockTimestamp
            chainId
            hash
          }
        }
      `;

      const result = await this.client.request<{
        UBIClaimed: Array<{
          id: string;
          user: string;
          amount: string;
          instanceAddress: string;
          blockNumber: string;
          blockTimestamp: string;
          chainId: number;
          hash: string;
        }>;
      }>(query, variables);

      return result.UBIClaimed.map((event) => ({
        ...event,
        user: event.user as Address,
        amount: BigInt(event.amount),
        instanceAddress: event.instanceAddress as Address,
        blockNumber: BigInt(event.blockNumber),
        chainId: event.chainId,
      }));
    } catch (error) {
      console.error("Error fetching UBI claimed events:", error);
      throw error;
    }
  }

  /**
   * Get UBI repost events by reposter
   */
  async getUBIRepostByReposterEvents({
    instanceAddress,
    reposter,
    day,
    limit = 100,
    offset = 0,
  }: {
    instanceAddress: Address;
    reposter?: Address;
    day?: bigint;
    limit?: number;
    offset?: number;
  }) {
    try {
      const variables: {
        instanceAddress: string;
        reposter?: string;
        day?: string;
        chainId?: number;
        limit: number;
        offset: number;
      } = {
        instanceAddress,
        limit,
        offset,
      };

      if (reposter) {
        variables.reposter = reposter;
      }

      if (day !== undefined) {
        variables.day = day.toString();
      }

      if (this.config.chainId !== undefined) {
        variables.chainId = this.config.chainId;
      }

      const query = gql`
        query GetUBIRepostByReposter($instanceAddress: String!, $reposter: String, $day: numeric, $chainId: Int, $limit: Int!, $offset: Int!) {
          UBIRepostByReposter(
            where: {
              instanceAddress: { _eq: $instanceAddress }
              ${reposter !== undefined ? "reposter: { _eq: $reposter }" : ""}
              ${day !== undefined ? "day: { _eq: $day }" : ""}
              ${this.config.chainId !== undefined ? "chainId: { _eq: $chainId }" : ""}
            }
            order_by: { blockTimestamp: desc }
            limit: $limit
            offset: $offset
          ) {
            id
            proposer
            day
            proposal
            reposter
            proposalText
            instanceAddress
            blockNumber
            blockTimestamp
            chainId
            hash
          }
        }
      `;

      const result = await this.client.request<{
        UBIRepostByReposter: Array<{
          id: string;
          proposer: string;
          day: string;
          proposal: string;
          reposter: string;
          proposalText: string;
          instanceAddress: string;
          blockNumber: string;
          blockTimestamp: string;
          chainId: number;
          hash: string;
        }>;
      }>(query, variables);

      return result.UBIRepostByReposter.map((event) => ({
        ...event,
        proposer: event.proposer as Address,
        reposter: event.reposter as Address,
        day: BigInt(event.day),
        instanceAddress: event.instanceAddress as Address,
        blockNumber: BigInt(event.blockNumber),
        chainId: event.chainId,
      }));
    } catch (error) {
      console.error("Error fetching UBI repost events:", error);
      throw error;
    }
  }

  /**
   * Get UBI proposal lifetime score
   */
  async getUBIProposalLifetimeScoreEvents({
    instanceAddress,
    limit = 100,
    offset = 0,
  }: {
    instanceAddress: Address;
    limit?: number;
    offset?: number;
  }) {
    try {
      const variables: {
        instanceAddress: string;
        chainId?: number;
        limit: number;
        offset: number;
      } = {
        instanceAddress,
        limit,
        offset,
      };

      if (this.config.chainId !== undefined) {
        variables.chainId = this.config.chainId;
      }

      const query = gql`
        query GetUBIProposalLifetimeScore($instanceAddress: String!, $chainId: Int, $limit: Int!, $offset: Int!) {
          UBIProposalLifetimeScore(
            where: {
              instanceAddress: { _eq: $instanceAddress }
              ${this.config.chainId !== undefined ? "chainId: { _eq: $chainId }" : ""}
            }
            order_by: { blockTimestamp: desc }
            limit: $limit
            offset: $offset
          ) {
            id
            lifeTimeScore
            proposedTimes
            repostedTimes
            instanceAddress
            blockNumber
            blockTimestamp
            chainId
            hash
          }
        }
      `;

      const result = await this.client.request<{
        UBIProposalLifetimeScore: Array<{
          id: string;
          lifeTimeScore: string;
          proposedTimes: string;
          repostedTimes: string;
          instanceAddress: string;
          blockNumber: string;
          blockTimestamp: string;
          chainId: number;
          hash: string;
        }>;
      }>(query, variables);

      return result.UBIProposalLifetimeScore.map((event) => ({
        ...event,
        lifeTimeScore: BigInt(event.lifeTimeScore),
        proposedTimes: BigInt(event.proposedTimes),
        repostedTimes: BigInt(event.repostedTimes),
        instanceAddress: event.instanceAddress as Address,
        blockNumber: BigInt(event.blockNumber),
        chainId: event.chainId,
      }));
    } catch (error) {
      console.error("Error fetching UBI proposal lifetime score events:", error);
      throw error;
    }
  }
}
export default EnvioGraphQLClient;
