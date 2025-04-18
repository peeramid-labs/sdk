import { Address, Hex } from "viem";
import { GraphQLClient, gql } from "graphql-request";

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
  endpoint: "http://localhost:8080/graphql",
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
  gameId?: string;
  creator?: string;
  gm?: string;
  participant?: string;
  proposer?: string;
  player?: string;
  turn?: string;
  limit?: number;
  offset?: number;
  contractAddress?: string;
};

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
    const variables: GraphQLQueryVariables = { limit, offset };

    if (creator) {
      variables.creator = creator.toLowerCase();
    }

    if (gameId !== undefined) {
      variables.gameId = gameId.toString();
    }

    if (gm) {
      variables.gm = gm.toLowerCase();
    }

    variables.contractAddress = contractAddress;

    const query = gql`
      query GetGameCreatedEvents($creator: String, $gameId: String, $gm: String, $contractAddress: String, $limit: Int, $offset: Int) {
        RankifyInstance_gameCreated(
          where: {
            ${creator ? "creator: { _eq: $creator }" : ""}
            ${gameId !== undefined ? `${creator ? ", " : ""}gameId: { _eq: $gameId }` : ""}
            ${gm ? `${creator || gameId !== undefined ? ", " : ""}gm: { _eq: $gm }` : ""}
            ${contractAddress ? `${creator || gameId !== undefined || gm ? ", " : ""}srcAddress: { _eq: $contractAddress }` : ""}
          }
          limit: $limit
          offset: $offset
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

    try {
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
      }>(query, variables);

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
    const variables: GraphQLQueryVariables = {
      gameId: gameId.toString(),
    };

    if (participant) {
      variables.participant = participant.toLowerCase();
    }

    variables.contractAddress = contractAddress;

    const query = gql`
      query GetPlayerJoinedEvents($gameId: String!, $participant: String, $contractAddress: String) {
        RankifyInstance_PlayerJoined(
          where: {
            gameId: { _eq: $gameId }
            ${participant ? ", participant: { _eq: $participant }" : ""}
            ${contractAddress ? ", srcAddress: { _eq: $contractAddress }" : ""}
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
        }
      }
    `;

    try {
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
        }>;
      }>(query, variables);

      return result.RankifyInstance_PlayerJoined.map((event) => ({
        ...event,
        gameId: BigInt(event.gameId),
        blockNumber: BigInt(event.blockNumber),
        contractAddress: event.srcAddress as Address,
        participant: event.participant as Address,
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
    const variables: GraphQLQueryVariables = {
      gameId: gameId.toString(),
    };

    if (turn !== undefined) {
      variables.turn = turn.toString();
    }

    if (proposer) {
      variables.proposer = proposer.toLowerCase();
    }

    variables.contractAddress = contractAddress.toLowerCase();

    const query = gql`
      query GetProposalSubmittedEvents($gameId: String!, $turn: String, $proposer: String, $contractAddress: String) {
        RankifyInstance_ProposalSubmitted(
          where: {
            gameId: { _eq: $gameId }
            ${turn !== undefined ? ", turn: { _eq: $turn }" : ""}
            ${proposer ? ", proposer: { _eq: $proposer }" : ""}
            ${contractAddress ? ", srcAddress: { _eq: $contractAddress }" : ""}
          }
          order_by: { blockTimestamp: asc }
        ) {
          id
          gameId
          turn
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

    try {
      const result = await this.client.request<{
        RankifyInstance_ProposalSubmitted: Array<{
          id: string;
          gameId: string;
          turn: string;
          proposer: string;
          commitment: string;
          encryptedProposal: string;
          gmSignature: string;
          proposerSignature: string;
          blockNumber: string;
          blockTimestamp: string;
          srcAddress: string;
        }>;
      }>(query, variables);

      return result.RankifyInstance_ProposalSubmitted.map((event) => ({
        ...event,
        gameId: BigInt(event.gameId),
        turn: BigInt(event.turn),
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
    const variables: GraphQLQueryVariables = {
      gameId: gameId.toString(),
    };

    if (turn !== undefined) {
      variables.turn = turn.toString();
    }

    if (player) {
      variables.player = player;
    }

    variables.contractAddress = contractAddress;

    const query = gql`
      query GetVoteSubmittedEvents($gameId: String!, $turn: String, $player: String, $contractAddress: String) {
        RankifyInstance_VoteSubmitted(
          where: {
            gameId: { _eq: $gameId }
            ${turn !== undefined ? ", turn: { _eq: $turn }" : ""}
            ${player ? ", player: { _eq: $player }" : ""}
            ${contractAddress ? ", srcAddress: { _eq: $contractAddress }" : ""}
          }
          order_by: { blockTimestamp: asc }
        ) {
          id
          gameId
          turn
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

    try {
      const result = await this.client.request<{
        RankifyInstance_VoteSubmitted: Array<{
          id: string;
          gameId: string;
          turn: string;
          player: string;
          sealedBallotId: string;
          gmSignature: string;
          voterSignature: string;
          ballotHash: string;
          blockNumber: string;
          blockTimestamp: string;
          srcAddress: string;
        }>;
      }>(query, variables);

      return result.RankifyInstance_VoteSubmitted.map((event) => ({
        ...event,
        gameId: BigInt(event.gameId),
        turn: BigInt(event.turn),
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
    const variables: GraphQLQueryVariables = {
      gameId: gameId.toString(),
    };

    variables.contractAddress = contractAddress;

    const query = gql`
      query GetRegistrationOpenEvents($gameId: String!, $contractAddress: String) {
        RankifyInstance_RegistrationOpen(
          where: {
            gameId: { _eq: $gameId }
            ${contractAddress ? ", srcAddress: { _eq: $contractAddress }" : ""}
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

    try {
      const result = await this.client.request<{
        RankifyInstance_RegistrationOpen: Array<{
          id: string;
          gameId: string;
          blockNumber: string;
          blockTimestamp: string;
          srcAddress: string;
        }>;
      }>(query, variables);

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
   * Get turn ended events for a specific game and turn
   */
  async getTurnEndedEvents({
    gameId,
    turn,
    contractAddress,
  }: {
    gameId: bigint;
    turn?: bigint;
    contractAddress: Address;
  }) {
    const variables: GraphQLQueryVariables = {
      gameId: gameId.toString(),
    };

    if (turn !== undefined) {
      variables.turn = turn.toString();
    }

    variables.contractAddress = contractAddress;

    const query = gql`
      query GetTurnEndedEvents($gameId: String!, $turn: String, $contractAddress: String) {
        RankifyInstance_TurnEnded(
          where: {
            gameId: { _eq: $gameId }
            ${turn !== undefined ? ", turn: { _eq: $turn }" : ""}
            ${contractAddress ? ", srcAddress: { _eq: $contractAddress }" : ""}
          }
          order_by: { turn: desc }
          limit: 1
        ) {
          id
          gameId
          turn
          players
          scores
          newProposals
          proposerIndices
          votes
          blockNumber
          blockTimestamp
          srcAddress
        }
      }
    `;

    try {
      const result = await this.client.request<{
        RankifyInstance_TurnEnded: Array<{
          id: string;
          gameId: string;
          turn: string;
          players: string[];
          scores: string[];
          newProposals: string[];
          proposerIndices: string[];
          votes: string[][];
          blockNumber: string;
          blockTimestamp: string;
          srcAddress: string;
        }>;
      }>(query, variables);

      return result.RankifyInstance_TurnEnded.map((event) => ({
        ...event,
        gameId: BigInt(event.gameId),
        turn: BigInt(event.turn),
        scores: event.scores.map((score) => BigInt(score)),
        proposerIndices: event.proposerIndices.map((index) => BigInt(index)),
        votes: event.votes.map((row) => row.map((vote) => BigInt(vote))),
        blockNumber: BigInt(event.blockNumber),
        contractAddress: event.srcAddress as Address,
        players: event.players.map((player) => player as Address),
      }));
    } catch (error) {
      console.error("Error fetching turn ended events:", error);
      throw error;
    }
  }

  /**
   * Get game over events for a specific game
   */
  async getGameOverEvents({ gameId, contractAddress }: { gameId: bigint; contractAddress: Address }) {
    const variables: GraphQLQueryVariables = {
      gameId: gameId.toString(),
    };

    variables.contractAddress = contractAddress;

    const query = gql`
      query GetGameOverEvents($gameId: String!, $contractAddress: String) {
        RankifyInstance_GameOver(
          where: {
            gameId: { _eq: $gameId }
            ${contractAddress ? ", srcAddress: { _eq: $contractAddress }" : ""}
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

    try {
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
      }>(query, variables);

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
}
export default EnvioGraphQLClient;
