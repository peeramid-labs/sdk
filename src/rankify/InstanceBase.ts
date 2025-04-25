import {
  Address,
  PublicClient,
  type GetContractReturnType,
  type Block,
  zeroAddress,
  ContractFunctionReturnType,
  keccak256,
  encodePacked,
  Hex,
} from "viem";
import { ApiError, findContractDeploymentBlock, handleRPCError } from "../utils/index";
import { getSharedSecret } from "@noble/secp256k1";
import { CONTENT_STORAGE, FellowshipMetadata, GameMetadata, gameStatusEnum, SUBMISSION_TYPES } from "../types";
import instanceAbi from "../abis/RankifyDiamondInstance";
import { reversePermutation } from "../utils/permutations";
import { MAODistributorClient, MAOInstanceContracts } from "./MAODistributor";
import RankTokenClient from "./RankToken";
import { EnvioGraphQLClient } from "../utils/EnvioGraphQLClient";
import { logger } from "../utils/logger";

export interface GameState extends ContractFunctionReturnType<typeof instanceAbi, "view", "getGameState"> {
  joinRequirements: ContractFunctionReturnType<typeof instanceAbi, "view", "getJoinRequirements">;
  requirementsPerContract: ContractFunctionReturnType<typeof instanceAbi, "view", "getJoinRequirementsByToken">[];
  scores: readonly [readonly `0x${string}`[], readonly bigint[]];
  isLastTurn: boolean;
  isOpen: boolean;
  canStart: boolean;
  gamePhase: gameStatusEnum;
  currentPhaseTimeoutAt: bigint;
  players: readonly `0x${string}`[];
}

/**
 * Base class for interacting with a Rankify game instance
 * Provides core functionality for managing game state and interactions
 */
export default class InstanceBase {
  /** Public client for blockchain interactions */
  publicClient: PublicClient;
  /** Chain ID of the network */
  chainId: number;
  /** Address of the Rankify instance contract */
  instanceAddress: Address;
  creationBlock: bigint;
  instanceContracts?: MAOInstanceContracts;
  envioClient: EnvioGraphQLClient;

  /**
   * Creates a new InstanceBase
   * @param {Object} params - Constructor parameters
   * @param {PublicClient} params.publicClient - Public client for blockchain interactions
   * @param {number} params.chainId - Chain ID of the network
   * @param {Address} params.instanceAddress - Address of the Rankify instance contract
   * @param {EnvioGraphQLClient} [params.envioClient] - Optional Envio GraphQL client
   */
  constructor({
    publicClient,
    chainId,
    instanceAddress,
    creationBlock = 0n,
    envioClient,
  }: {
    publicClient: PublicClient;
    chainId: number;
    instanceAddress: Address;
    creationBlock?: bigint;
    envioClient: EnvioGraphQLClient;
  }) {
    this.publicClient = publicClient;
    this.chainId = chainId;
    this.instanceAddress = instanceAddress;
    this.creationBlock = creationBlock;
    this.envioClient = envioClient;
  }

  /**
   * Retrieves the historic turn information for a specific game and turn ID.
   * @returns The historic turn event object.
   * @throws {ApiError} If the game or turn is not found.
   */
  getHistoricTurn = async (gameId: bigint, turnId: bigint) => {
    const [logsWithProposals, logsWithVotesAndPermutation] = await Promise.all([
      this.envioClient.getTurnEndedEvents({ gameId, turn: turnId, contractAddress: this.instanceAddress }),
      this.envioClient.getTurnEndedEvents({ gameId, turn: turnId + 1n, contractAddress: this.instanceAddress }),
    ]);

    if (logsWithProposals.length === 0 || logsWithVotesAndPermutation.length === 0) {
      return [];
    }

    const gameState = await this.getGameState(gameId);
    const players = logsWithProposals[0]?.players || [];
    const permutation = logsWithVotesAndPermutation[0]?.proposerIndices || [];
    const proposalsPermuted = { ...logsWithProposals[0] }?.newProposals?.slice(
      0,
      logsWithProposals[0]?.players?.length
    );
    const proposalsOrdered = reversePermutation({ array: proposalsPermuted || [], permutation });
    const votesPermuted = { ...logsWithVotesAndPermutation[0] }?.votes || [];
    const votesOrdered = votesPermuted.map((vote) => reversePermutation({ array: vote, permutation }));
    const maxVotes = BigInt(Math.floor(Math.sqrt(Number(gameState.voteCredits))));
    const blockNumber = logsWithProposals[0].blockNumber;
    const blockTimestamp = await this.getBlockTimestamp(blockNumber);

    const returnObject = proposalsOrdered.map((proposal, proposersIndex) => {
      const proposer = players[proposersIndex];
      if (proposal === "") {
        return {
          player: proposer,
          proposal: "",
          score: 0n,
          scoreList: [],
        };
      }

      const scoreList = votesOrdered
        .map((playersVote, votersIndex) => {
          const isIdleVoter = playersVote.reduce((acc, vote) => acc + vote, 0n) === 0n;
          if (votersIndex === proposersIndex) {
            return { score: 0n, player: proposer };
          }
          return { score: isIdleVoter ? maxVotes : playersVote[proposersIndex], player: players[votersIndex] };
        })
        .filter((score) => score.score > 0n);
      return {
        player: proposer,
        proposal,
        score: scoreList.reduce((acc, score) => acc + score.score, 0n),
        scoreList,
        blockTimestamp,
      };
    });

    return returnObject;
  };

  /**
   * Reorganizes votes array based on proposerIndices mapping
   * @param votes - Array of votes for each player
   * @param proposerIndices - Array of indices mapping shuffled order to original order
   * @returns Reorganized votes array
   */
  reorganizeVotes = (votes: readonly (readonly bigint[])[], proposerIndices: readonly bigint[]): bigint[][] => {
    return votes.map((playerVotes) => {
      return reversePermutation({ array: playerVotes, permutation: proposerIndices });
    });
  };

  getCreationBlock = async () => {
    if (this.creationBlock == 0n)
      this.creationBlock = await findContractDeploymentBlock(this.publicClient, this.instanceAddress);
    return this.creationBlock;
  };

  /**
   * Retrieves the previous turn information for a specific game.
   * @param gameId - The ID of the game.
   * @returns The previous turn information for the specified game.
   */
  getPreviousTurnStats = async (gameId: bigint) => {
    let currentTurn;
    try {
      currentTurn = await this.publicClient.readContract({
        address: this.instanceAddress,
        abi: instanceAbi,
        functionName: "getTurn",
        args: [gameId],
      });
    } catch (e) {
      throw await handleRPCError(e);
    }

    if (currentTurn > 1n) {
      return this.getHistoricTurn(gameId, currentTurn - 1n);
    } else {
      return {
        players: "N/A",
        scores: "N/A",
        turnSalt: "N/A",
        voters: ["N/A"],
        votesRevealed: ["N/A"],
      };
    }
  };

  /**
   * Retrieves the voting information for a specific game and turn.
   * @param gameId - The ID of the game.
   * @param turnId - The ID of the turn.
   * @returns The voting information for the specified game and turn.
   */
  getVoting = async (gameId: bigint, turnId: bigint) => {
    const voteEvents = await this.envioClient.getVoteSubmittedEvents({
      gameId,
      turn: turnId,
      contractAddress: this.instanceAddress,
    });
    return voteEvents.map((event) => ({
      player: event.player as Address,
      sealedBallotId: event.sealedBallotId,
      gmSignature: event.gmSignature,
      voterSignature: event.voterSignature,
      ballotHash: event.ballotHash,
    }));
  };

  /**
   * Retrieves the ongoing voting for a specific game.
   * @param gameId - The ID of the game.
   */
  getOngoingVoting = async (gameId: bigint) => {
    try {
      const turn = await this.publicClient.readContract({
        address: this.instanceAddress,
        abi: instanceAbi,
        functionName: "getTurn",
        args: [gameId],
      });
      return this.getVoting(gameId, turn);
    } catch (error) {
      throw await handleRPCError(error);
    }
  };

  /**
   * Retrieves the ongoing proposals for a specific game.
   * @param gameId - The ID of the game.
   * @returns The ongoing proposals for the specified game.
   */
  getOngoingProposals = async (gameId: bigint) => {
    try {
      const currentTurn = await this.publicClient.readContract({
        address: this.instanceAddress,
        abi: instanceAbi,
        functionName: "getTurn",
        args: [gameId],
      });
      const lastTurnEndedEvent = await this.envioClient.getTurnEndedEvents({
        gameId,
        turn: currentTurn - 1n,
        contractAddress: this.instanceAddress,
      });
      lastTurnEndedEvent[0].newProposals = lastTurnEndedEvent[0]?.newProposals?.slice(
        0,
        lastTurnEndedEvent[0]?.players?.length
      );

      if (lastTurnEndedEvent.length !== 1) {
        console.error("getOngoingProposals", gameId, "failed:", lastTurnEndedEvent.length);
        throw new ApiError("Game not found", { status: 404 });
      }

      const args = lastTurnEndedEvent[0] as { newProposals: unknown[] };
      return { currentTurn, proposals: args.newProposals };
    } catch (error) {
      throw await handleRPCError(error);
    }
  };

  /**
   * Retrieves the registration deadline for a specific game.
   * @param gameId - The ID of the game.
   * @param timeToJoin - Optional. The additional time (in seconds) to join the game.
   * @returns A Promise that resolves to the registration deadline timestamp.
   */
  getRegistrationDeadline = async (gameId: bigint, timeToJoin?: number) => {
    try {
      const registrationEvents = await this.envioClient.getRegistrationOpenEvents({
        gameId,
        contractAddress: this.instanceAddress,
      });

      if (timeToJoin) {
        return Number(registrationEvents[0].blockTimestamp) + timeToJoin;
      }

      try {
        const gameState = await this.publicClient.readContract({
          address: this.instanceAddress,
          abi: instanceAbi,
          functionName: "getGameState",
          args: [gameId],
        });

        return Number(registrationEvents[0].blockTimestamp) + Number(gameState.timeToJoin);
      } catch (e) {
        throw await handleRPCError(e);
      }
    } catch (err) {
      logger(`Error fetching events from Envio: ${err}`);
    }
  };

  /**
   * Resolves the deadline for the current turn.
   * @param block The current block.
   * @param gameId The ID of the game.
   * @param timePerTurn The time duration per turn (optional).
   * @returns The deadline for the current turn.
   */
  resolveTurnDeadline = async (block: Block, gameId: bigint, timePerTurn?: number) => {
    try {
      if (timePerTurn) return Number(block.timestamp) + timePerTurn;

      const gameState = await this.publicClient.readContract({
        address: this.instanceAddress,
        abi: instanceAbi,
        functionName: "getGameState",
        args: [gameId],
      });

      return Number(block.timestamp) + Number(gameState.timePerTurn);
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  /**
   * Retrieves the deadline for the current turn in a game.
   * @param gameId - The ID of the game.
   * @param timePerTurn - Optional. The duration of each turn in seconds.
   * @returns A Promise that resolves to the deadline for the current turn, or 0 if the turn has not started.
   */
  getTurnDeadline = async (gameId: bigint, timePerTurn?: number) => {
    if (!gameId) throw new Error("gameId not set");

    const currentTurn = await this.publicClient.readContract({
      address: this.instanceAddress,
      abi: instanceAbi,
      functionName: "getTurn",
      args: [gameId],
    });

    if (currentTurn === 0n) return 0;

    const logs =  currentTurn === 1n  ? await this.envioClient.getGameStartedEvents({
      gameId,
      contractAddress: this.instanceAddress,
    }) : await this.envioClient.getTurnEndedEvents({
      turn: currentTurn - 1n,
      gameId,
      contractAddress: this.instanceAddress,
    });

    if (logs.length !== 1) {
      console.error("getTurnDeadline", gameId, "failed:", logs.length);
      throw new ApiError("Game not found", { status: 404 });
    }

    const block = await this.publicClient.getBlock({ blockNumber: logs[0].blockNumber });
    return this.resolveTurnDeadline(block, gameId, timePerTurn);
  };

  /**
   * Retrieves the contract state.
   */
  getContractState = async () => {
    try {
      const state = await this.publicClient.readContract({
        address: this.instanceAddress,
        abi: instanceAbi,
        functionName: "getContractState",
      });
      return state;
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  /**
   * Retrieves a player's game.
   * @param account - The player's account address.
   */
  getPlayersGame = async (account: Address) => {
    try {
      return this.publicClient.readContract({
        address: this.instanceAddress,
        abi: instanceAbi,
        functionName: "getPlayersGame",
        args: [account],
      });
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  /**
   * Retrieves the list of proposal scores for a specific game.
   * @param gameId - The ID of the game.
   * @returns A Promise that resolves to the list of proposal scores.
   */
  getProposalScoresList = async (gameId: bigint) => {
    return this.envioClient.getProposalScoreEvents({
      gameId,
      contractAddress: this.instanceAddress,
    });
  };

  /**
   * Retrieve s the current turn of a game.
   * @param gameId - The ID of the game.
   * @returns A Promise that resolves to the current turn of the game.
   */
  getCurrentTurn = async (gameId: bigint) => {
    try {
      return this.publicClient.readContract({
        address: this.instanceAddress,
        abi: instanceAbi,
        functionName: "getTurn",
        args: [gameId],
      });
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  /**
   * Retrieve s the palyers of a game.
   * @param gameId - The ID of the game.
   * @returns A Promise that resolves to the player addresses of the game.
   */
  getPlayers = async (gameId: bigint) => {
    try {
      return this.publicClient.readContract({
        address: this.instanceAddress,
        abi: instanceAbi,
        functionName: "getPlayers",
        args: [gameId],
      });
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  getGameState = async (gameId: bigint) => {
    try {
      const state = await this.publicClient.readContract({
        address: this.instanceAddress,
        abi: instanceAbi,
        functionName: "getGameState",
        args: [gameId],
      });
      return state;
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  /**
   * Retrieves the game state for a specific game.
   * @param gameId - The ID of the game.
   * @returns A promise that resolves to an object containing the game state.
   */
  getGameStateDetails = async (gameId: bigint): Promise<GameState> => {
    try {
      const [joinRequirements, ongoingScores, isLastTurn, players, canStart, state] = await Promise.all([
        this.publicClient.readContract({
          address: this.instanceAddress,
          abi: instanceAbi,
          functionName: "getJoinRequirements",
          args: [gameId],
        }),
        this.publicClient.readContract({
          address: this.instanceAddress,
          abi: instanceAbi,
          functionName: "getScores",
          args: [gameId],
        }),
        this.publicClient.readContract({
          address: this.instanceAddress,
          abi: instanceAbi,
          functionName: "isLastTurn",
          args: [gameId],
        }),
        this.publicClient.readContract({
          address: this.instanceAddress,
          abi: instanceAbi,
          functionName: "getPlayers",
          args: [gameId],
        }),
        this.publicClient.readContract({
          address: this.instanceAddress,
          abi: instanceAbi,
          functionName: "canStartGame",
          args: [gameId],
        }),
        this.publicClient.readContract({
          address: this.instanceAddress,
          abi: instanceAbi,
          functionName: "getGameState",
          args: [gameId],
        }),
      ]);

      const requirementsPerContract = await Promise.all(
        joinRequirements.contractAddresses.map(async (address, idx) => {
          return this.publicClient.readContract({
            address: this.instanceAddress,
            abi: instanceAbi,
            functionName: "getJoinRequirementsByToken",
            args: [gameId, address, joinRequirements.contractIds[idx], joinRequirements.contractTypes[idx]],
          });
        })
      );

      let scores = ongoingScores;
      let returnPlayers = players;

      if (state.hasEnded) {
        const GameOverEvents = await this.envioClient.getGameOverEvents({
          gameId,
          contractAddress: this.instanceAddress
        });
        const evt = GameOverEvents[0];
        if (evt?.scores && evt?.players) {
          returnPlayers = evt.players;
          scores = [returnPlayers, evt.scores];
        }
      }

      const gamePhase = state.hasEnded
        ? gameStatusEnum["finished"]
        : state.isOvertime
          ? gameStatusEnum["overtime"]
          : isLastTurn
            ? gameStatusEnum["lastTurn"]
            : state.startedAt > 0n
              ? gameStatusEnum["started"]
              : state.registrationOpenAt > 0n
                ? gameStatusEnum["open"]
                : state.createdBy !== zeroAddress
                  ? gameStatusEnum["created"]
                  : gameStatusEnum["notFound"];

      const currentPhaseTimeoutAt =
        gamePhase === gameStatusEnum["started"]
          ? state.turnStartedAt + state.timePerTurn
          : gamePhase === gameStatusEnum["open"]
            ? state.registrationOpenAt + state.timeToJoin
            : state.startedAt + state.timePerTurn;

      return {
        joinRequirements,
        requirementsPerContract,
        scores,
        players: returnPlayers,
        isLastTurn,
        isOpen: state.registrationOpenAt > 0n,
        currentPhaseTimeoutAt,
        canStart,
        gamePhase,
        ...state,
      };
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  getGameStates = async ({
    pageParam = 0,
    pageSize = 10,
  }: {
    pageParam?: number;
    pageSize?: number;
  }): Promise<{
    items: (ContractFunctionReturnType<typeof instanceAbi, "view", "getGameState"> & {
      gamePhase: gameStatusEnum;
    })[];
    nextPage: number | undefined;
    hasMore: boolean;
  }> => {
    const { numGames } = await this.getContractState();

    const totalGames = Number(numGames);
    const startIndex = pageParam * pageSize;

    if (startIndex >= totalGames) {
      return {
        items: [],
        nextPage: undefined,
        hasMore: false,
      };
    }

    const realPageSize = Math.min(pageSize, totalGames - startIndex);
    const hasMore = startIndex + realPageSize < totalGames;
    const nextPage = hasMore ? pageParam + 1 : undefined;

    const gameStates = await Promise.all(
      Array.from({ length: realPageSize }, (_, i) => i + startIndex).map(async (index) => {
        const gameId = index + 1;
        return this.publicClient
          .readContract({
            address: this.instanceAddress,
            abi: instanceAbi,
            functionName: "getGameState",
            args: [BigInt(gameId)],
          })
          .then((r) => {
            const gamePhase = r.hasEnded
              ? gameStatusEnum["finished"]
              : r.isOvertime
                ? gameStatusEnum["overtime"]
                : r.currentTurn - r.maxTurns === 0n
                  ? gameStatusEnum["lastTurn"]
                  : r.startedAt > 0n
                    ? gameStatusEnum["started"]
                    : r.registrationOpenAt > 0n
                      ? gameStatusEnum["open"]
                      : r.createdBy !== zeroAddress
                        ? gameStatusEnum["created"]
                        : gameStatusEnum["notFound"];
            return { ...r, gamePhase };
          });
      })
    );

    return {
      items: gameStates,
      nextPage,
      hasMore,
    };
  };

  getEIP712Domain = async () => {
    /**
     * Reads the EIP712 domain data from the contract
     * @returns {Promise<object>} The domain data including separator, chainId, etc.
     * @throws {Error} If the contract call fails
     */
    const domain = await this.publicClient.readContract({
      address: this.instanceAddress,
      abi: instanceAbi,
      functionName: "inspectEIP712Hashes",
    });
    return {
      domainSeparator: domain[0],
      chainId: domain[1],
      verifierContract: domain[2],
      hashedName: domain[3],
      hashedVersion: domain[4],
      typeHash: domain[5],
      name: domain[6],
      version: domain[7],
    };
  };

  pkdf = ({
    chainId,
    privateKey,
    gameId,
    turn,
    contractAddress,
    scope = "default",
  }: {
    chainId: number;
    privateKey: Hex;
    gameId: bigint;
    turn: bigint;
    contractAddress: Address;
    scope?: "default" | "turnSalt";
  }) => {
    const derivedPrivateKey = keccak256(
      encodePacked(
        ["bytes32", "uint256", "uint256", "address", "uint256", "bytes32"],
        [privateKey, gameId, turn, contractAddress, BigInt(chainId), keccak256(encodePacked(["string"], [scope]))]
      )
    );
    return derivedPrivateKey;
  };

  sharedSigner = ({
    publicKey,
    privateKey,
    gameId,
    turn,
    contractAddress,
    chainId,
  }: {
    publicKey: Hex;
    privateKey: Hex;
    gameId: bigint;
    turn: bigint;
    contractAddress: Address;
    chainId: number;
  }) => {
    // Remove '0x' prefix if present
    const privKeyHex = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
    const pubKeyHex = publicKey.startsWith("0x") ? publicKey.slice(2) : publicKey;

    const sharedSecret = getSharedSecret(privKeyHex, pubKeyHex, true);
    const sharedKey = keccak256(sharedSecret);

    const derivedPrivateKey = this.pkdf({
      privateKey: sharedKey,
      gameId,
      turn,
      contractAddress,
      chainId,
    });
    return derivedPrivateKey;
  };

  getPlayerPubKey = async ({
    instanceAddress,
    gameId,
    player,
  }: {
    instanceAddress: Address;
    gameId: bigint;
    player: Address;
  }): Promise<Hex> => {
    const playerJoinedEvents = await this.envioClient.getPlayerJoinedEvents({
      gameId,
      participant: player,
      contractAddress: instanceAddress,
    });
    const latestEvent = playerJoinedEvents
      .sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber))
      .sort((a, b) => a.transactionIndex - b.transactionIndex)
      .sort((a, b) => a.logIndex - b.logIndex)[0];
    if (!latestEvent.voterPubKey) throw new Error("No voterPubKey found in event data, that is unexpected");

    if (!player) throw new Error("No player found in event data, that is unexpected");

    return latestEvent.voterPubKey as Hex;
  };

  // Type guard for FellowshipMetadata
  isGameMetadata(data: unknown, fellowshipMetadata: FellowshipMetadata): data is GameMetadata<FellowshipMetadata> {
    if (!data || typeof data !== "object") return false;
    const metadata = data as Record<string, unknown>;

    // Check required fields
    if (typeof metadata.name !== "string") return false;
    if (typeof metadata.description !== "string") return false;
    if (metadata.image !== undefined && typeof metadata.image !== "string") return false;

    // Check optional fields if present
    if (metadata.banner_image !== undefined && typeof metadata.banner_image !== "string") return false;
    if (metadata.featured_image !== undefined && typeof metadata.featured_image !== "string") return false;
    if (metadata.external_link !== undefined && typeof metadata.external_link !== "string") return false;

    // Check tags if present
    if (metadata.tags !== undefined) {
      if (!Array.isArray(metadata.tags)) return false;
      if (!metadata.tags.every((tag) => typeof tag === "string")) return false;
    }

    // Check submissions
    if (!Array.isArray(metadata.submissions)) return false;

    return metadata.submissions.every((submission) => {
      if (!submission || typeof submission !== "object") return false;
      const r = submission as Record<string, unknown>;

      // Check submission fields
      const submissionType = r.type as string;
      const storageType = r.store_at as string | undefined;

      if (!Object.values(SUBMISSION_TYPES).includes(submissionType as SUBMISSION_TYPES)) return false;
      if (typeof r.rules !== "object" || r.rules === null) return false;
      if (storageType !== undefined && !Object.values(CONTENT_STORAGE).includes(storageType as CONTENT_STORAGE))
        return false;

      // Check if submission is included in fellowshipMetadata.submissions
      if (!fellowshipMetadata.submissions.some((s) => JSON.stringify(s) === JSON.stringify(submission))) return false;

      return true;
    });
  }

  private getBlockTimestamp = async (blockNumber: bigint): Promise<bigint> => {
    const block = await this.publicClient.getBlock({ blockNumber });
    return BigInt(block.timestamp);
  };

  private getMAOInstanceContracts = async (): Promise<MAOInstanceContracts> => {
    if (!this.instanceContracts) {
      const distributor = new MAODistributorClient(this.chainId, {
        publicClient: this.publicClient,
        envioClient: this.envioClient,
      });
      const instanceId = await distributor.getInstanceFromAddress(this.instanceAddress);
      this.instanceContracts = await distributor.getMAOInstance({ instanceId: instanceId  });
    }
    return this.instanceContracts;
  };

  private getFellowshipMetadata = async (ipfsGateway: string): Promise<FellowshipMetadata> => {
    const rankTokenClient = new RankTokenClient({
      address: (await this.getMAOInstanceContracts()).rankToken.address,
      chainId: this.chainId,
      publicClient: this.publicClient,
    });

    return await rankTokenClient.getMetadata(ipfsGateway);
  };

  getGameMetadata = async (
    ipfsGateway: string,
    gameId: bigint
    //fellowshipMetadata?: FellowshipMetadata
  ): Promise<GameMetadata<FellowshipMetadata>> => {
    try {
      const { metadata } = await this.getGameStateDetails(gameId);
      // Handle different URI formats
      const processedUri = metadata.startsWith("ipfs://")
        ? metadata.replace("ipfs://", `${ipfsGateway}`)
        : metadata.startsWith("ar://")
          ? `https://arweave.net/${metadata.slice(5)}`
          : metadata;
      console.log("fetching from", processedUri);
      const response = await fetch(processedUri);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const rawData: unknown = await response.json();

      if (typeof rawData !== "object" || rawData === null) {
        throw new Error("Invalid response: expected JSON object");
      }

      //TODO: uncomment when fellowship metadata update interface is implemented and validation is added
      // if (!this.isGameMetadata(rawData, await this.getFellowshipMetadata(ipfsGateway))) {
      //   throw new Error("Invalid metadata format");
      // }

      return rawData as GameMetadata<FellowshipMetadata>;
    } catch (error) {
      console.error("Error fetching metadata:", error);
      throw error;
    }
  };
}

/**
 * Contract type for Rankify instance
 */
export type RankifyContract = GetContractReturnType<typeof instanceAbi, PublicClient>;
