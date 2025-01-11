import { Address, PublicClient, type GetContractReturnType, type Block, zeroAddress } from "viem";
import { ApiError, findContractDeploymentBlock, handleRPCError } from "../utils/index";

import instanceAbi from "../abis/RankifyDiamondInstance";

/**
 * Enum representing different states of a game instance
 * @public
 */
export enum gameStatusEnum {
  /** Game has been created but not opened for registration */
  created = "Game created",
  /** Game is open for player registration */
  open = "Registration open",
  /** Game is in progress */
  started = "In progress",
  /** Game is in its final turn */
  lastTurn = "Playing last turn",
  /** Game is in overtime */
  overtime = "PLaying in overtime",
  /** Game has finished */
  finished = "Finished",
  /** Game was not found */
  notFound = "not found",
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

  /**
   * Creates a new InstanceBase
   * @param {Object} params - Constructor parameters
   * @param {PublicClient} params.publicClient - Public client for blockchain interactions
   * @param {number} params.chainId - Chain ID of the network
   * @param {Address} params.instanceAddress - Address of the Rankify instance contract
   */
  constructor({
    publicClient,
    chainId,
    instanceAddress,
    creationBlock = 0n,
  }: {
    publicClient: PublicClient;
    chainId: number;
    instanceAddress: Address;
    creationBlock?: bigint;
  }) {
    this.publicClient = publicClient;
    this.chainId = chainId;
    this.instanceAddress = instanceAddress;
    this.creationBlock = creationBlock;
  }

  /**
   * Retrieves the historic turn information for a specific game and turn ID.
   * @returns The historic turn event object.
   * @throws {ApiError} If the game or turn is not found.
   */
  getHistoricTurn = async (gameId: bigint, turnId: bigint) => {
    const logs = await this.publicClient.getContractEvents({
      address: this.instanceAddress,
      abi: instanceAbi,
      fromBlock: await this.getCreationBlock(),
      eventName: "TurnEnded",
      args: {
        gameId,
        turn: turnId,
      },
    });

    if (logs.length !== 1) {
      console.error("getHistoricTurn", gameId, turnId, "failed:", logs.length);
      throw new ApiError("Game not found", { status: 404 });
    }

    return logs[0];
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
    if (!gameId) throw new Error("gameId not set");
    if (!turnId) throw new Error("turnId not set");
    const voteEvents = await this.publicClient.getContractEvents({
      address: this.instanceAddress,
      abi: instanceAbi,
      fromBlock: await this.getCreationBlock(),
      eventName: "VoteSubmitted",
      args: {
        gameId,
        turn: turnId,
      },
    });

    const proposalEvents = await this.publicClient.getContractEvents({
      address: this.instanceAddress,
      abi: instanceAbi,
      fromBlock: await this.getCreationBlock(),
      eventName: "ProposalSubmitted",
      args: {
        gameId,
        turn: turnId,
      },
    });

    return { voteEvents, proposalEvents };
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
      const lastTurnEndedEvent = await this.publicClient.getContractEvents({
        address: this.instanceAddress,
        abi: instanceAbi,
        fromBlock: await this.getCreationBlock(),
        eventName: "TurnEnded",
        args: { turn: currentTurn - 1n, gameId },
      });

      if (lastTurnEndedEvent.length !== 1) {
        console.error("getOngoingProposals", gameId, "failed:", lastTurnEndedEvent.length);
        throw new ApiError("Game not found", { status: 404 });
      }

      const args = lastTurnEndedEvent[0].args as { newProposals: unknown[] };
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
    const log = await this.publicClient.getContractEvents({
      address: this.instanceAddress,
      abi: instanceAbi,
      fromBlock: await this.getCreationBlock(),
      eventName: "RegistrationOpen",
      args: {
        gameId: gameId,
      },
    });

    if (log.length !== 1) {
      console.error("getRegistrationDeadline", gameId, "failed:", log.length);
      throw new ApiError("Game not found", { status: 404 });
    }

    const block = await this.publicClient.getBlock({ blockNumber: log[0].blockNumber });

    if (timeToJoin) {
      return Number(block.timestamp) + timeToJoin;
    }

    try {
      const gameState = await this.publicClient.readContract({
        address: this.instanceAddress,
        abi: instanceAbi,
        functionName: "getGameState",
        args: [gameId],
      });

      return Number(block.timestamp) + Number(gameState.timeToJoin);
    } catch (e) {
      throw await handleRPCError(e);
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

    const eventName = currentTurn === 1n ? "GameStarted" : "TurnEnded";
    const args = currentTurn === 1n ? { gameId } : { gameId, turnId: currentTurn - 1n };

    const logs = await this.publicClient.getContractEvents({
      address: this.instanceAddress,
      abi: instanceAbi,
      fromBlock: await this.getCreationBlock(),
      eventName: eventName,
      args: args,
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
    if (!gameId) throw new Error("gameId not set");
    try {
      const logs = await this.publicClient.getContractEvents({
        address: this.instanceAddress,
        abi: instanceAbi,
        eventName: "ProposalScore",
        args: { gameId },
      });

      return logs;
    } catch (e) {
      throw await handleRPCError(e);
    }
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
   * Retrieves the game state for a specific game.
   * @param gameId - The ID of the game.
   * @returns A promise that resolves to an object containing the game state.
   */
  getGameStateDetails = async (gameId: bigint) => {
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
      if (state.hasEnded) {
        const LastTurnScores = await this.publicClient.getContractEvents({
          address: this.instanceAddress,
          abi: instanceAbi,
          eventName: "GameOver",
          args: { gameId },
          fromBlock: await this.getCreationBlock(),
        });
        const evt = LastTurnScores[0];
        if (evt.args?.scores && evt.args?.players) scores = [players, evt.args.scores];
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
        isLastTurn,
        isOpen: state.registrationOpenAt > 0n,
        currentPhaseTimeout: players,
        canStart,
        gamePhase,
        currentPhaseTimeoutAt,
        ...state,
      };
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  getGameStates = async ({ pageParam = 0, pageSize = 10 }: { pageParam?: number; pageSize?: number }) => {
    const { numGames } = await this.getCommonParams();

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
      Array.from({ length: realPageSize }, (_, i) => i + startIndex).map(async (gameId) => {
        return this.publicClient.readContract({
          address: this.instanceAddress,
          abi: instanceAbi,
          functionName: "getGameState",
          args: [BigInt(gameId)],
        });
      })
    );

    return {
      items: gameStates,
      nextPage,
      hasMore,
    };
  };
}

/**
 * Contract type for Rankify instance
 */
export type RankifyContract = GetContractReturnType<typeof instanceAbi, PublicClient>;
