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
   * Whether to fall back to RPC when GraphQL queries fail
   * @default true
   */
  fallbackToRPC?: boolean;
}

/**
 * Default Envio GraphQL client configuration
 */
const DEFAULT_CONFIG: EnvioGraphQLClientConfig = {
  endpoint: process.env.INDEXER_URL || "http://localhost:8080/v1/graphql",
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
}

/**
 * Client for interacting with Envio GraphQL API to retrieve indexed blockchain events
 */
export class EnvioGraphQLClient {
  private config: EnvioGraphQLClientConfig;
  public client: GraphQLClient;

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

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (this.config.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }

    this.client = new GraphQLClient(this.config.endpoint, {
      headers,
    });
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
          srcAddress: string;
        }>;
      }>(query);

      return result.RankifyInstance_gameCreated.map((event) => ({
        ...event,
        gameId: BigInt(event.gameId),
        rank: BigInt(event.rank),
        blockNumber: BigInt(event.blockNumber),
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
          srcAddress: string;
          transactionIndex: number;
          logIndex: number;
        }>;
      }>(query);

      return result.RankifyInstance_PlayerJoined.map((event) => ({
        ...event,
        gameId: BigInt(event.gameId),
        blockNumber: BigInt(event.blockNumber),
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
          srcAddress: string;
        }>;
      }>(query);

      return result.RankifyInstance_ProposalSubmitted.map((event) => ({
        ...event,
        gameId: BigInt(event.gameId),
        roundNumber: BigInt(event.roundNumber),
        commitment: BigInt(event.commitment),
        blockNumber: BigInt(event.blockNumber),
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
          srcAddress: string;
        }>;
      }>(query);

      return result.RankifyInstance_VoteSubmitted.map((event) => ({
        ...event,
        gameId: BigInt(event.gameId),
        roundNumber: BigInt(event.roundNumber),
        blockNumber: BigInt(event.blockNumber),
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
          srcAddress: string;
        }>;
      }>(query);

      return result.RankifyInstance_RegistrationOpen.map((event) => ({
        ...event,
        gameId: BigInt(event.gameId),
        blockNumber: BigInt(event.blockNumber),
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
          srcAddress: string;
        }>;
      }>(query);

      return result.RankifyInstance_GameOver.map((event) => ({
        ...event,
        gameId: BigInt(event.gameId),
        scores: event.scores.map((score) => BigInt(score)),
        blockNumber: BigInt(event.blockNumber),
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
          srcAddress: string;
        }>;
      }>(query);

      return result.RankifyInstance_GameStarted.map((event) => ({
        ...event,
        gameId: BigInt(event.gameId),
        blockNumber: BigInt(event.blockNumber),
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
          version?: string;
          srcAddress: string;
        }>;
      }>(query);

      return result.DAODistributor_Instantiated.map((event) => ({
        ...event,
        blockNumber: BigInt(event.blockNumber),
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

    const variables = {
      gameId: gameId.toString(),
      roundNumber: turn.toString(),
      contractAddress: contractAddress,
    };

    const query = gql`
      query GetProposingStageEnded($gameId: numeric!, $roundNumber: numeric!, $contractAddress: String!) {
        RankifyInstance_ProposingStageEnded(
          where: { gameId: { _eq: $gameId }, roundNumber: { _eq: $roundNumber }, srcAddress: { _eq: $contractAddress } }
        ) {
          id
          gameId
          roundNumber
          numProposals
          proposals
          blockNumber
          blockTimestamp
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
        srcAddress: string;
      }>;
    }>(query, variables);

    return result.RankifyInstance_ProposingStageEnded.map((event) => ({
      ...event,
      gameId: BigInt(event.gameId),
      roundNumber: BigInt(event.roundNumber),
      numProposals: Number(event.numProposals),
      blockNumber: BigInt(event.blockNumber),
      blockTimestamp: Number(event.blockTimestamp),
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

    const query = `
      query GetVotingStageResults($gameId: numeric!, $turn: numeric!, $contractAddress: String!) {
        RankifyInstance_VotingStageResults(
          where: { gameId: { _eq: $gameId }, roundNumber: { _eq: $turn }, srcAddress: { _eq: $contractAddress } }
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
          blockNumber
          blockTimestamp
          srcAddress
        }
      }
    `;

    const variables = {
      gameId: gameId.toString(),
      turn: turn.toString(),
      contractAddress,
    };

    const result = (await this.client.request(query, variables)) as {
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
        blockNumber: string;
        blockTimestamp: string;
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
      blockNumber: BigInt(event.blockNumber),
      blockTimestamp: Number(event.blockTimestamp),
      srcAddress: event.srcAddress as Address,
    }));
  };
}
export default EnvioGraphQLClient;
