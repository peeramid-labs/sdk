import { Address, PublicClient, type GetContractReturnType, type Block } from "viem";
import { SupportedChains, ApiError } from "../utils/index";

import instanceAbi from "../abis/RankifyDiamondInstance";

export enum gameStatusEnum {
  created = "Game created",
  open = "Registration open",
  started = "In progress",
  lastTurn = "Playing last turn",
  overtime = "PLaying in overtime",
  finished = "Finished",
  notFound = "not found",
}

export type RankifyContract = GetContractReturnType<typeof instanceAbi, PublicClient>;

export default class InstanceBase {
  publicClient: PublicClient;
  chain: SupportedChains;
  instanceAddress: Address;

  constructor({
    publicClient,
    chain,
    instanceAddress,
  }: {
    publicClient: PublicClient;
    chain: SupportedChains;
    instanceAddress: Address;
  }) {
    this.publicClient = publicClient;
    this.chain = chain;
    this.instanceAddress = instanceAddress;
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

  /**
   * Retrieves the previous turn information for a specific game.
   * @param gameId - The ID of the game.
   * @returns The previous turn information for the specified game.
   */
  getPreviousTurnStats = async (gameId: bigint) => {
    const currentTurn = (await this.publicClient.readContract({
      address: this.instanceAddress,
      abi: instanceAbi,
      functionName: "getTurn",
      args: [gameId],
    })) as bigint;

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
      eventName: "VoteSubmitted",
      args: {
        gameId,
        turn: turnId,
      },
    });

    const proposalEvents = await this.publicClient.getContractEvents({
      address: this.instanceAddress,
      abi: instanceAbi,
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
      const turn = (await this.publicClient.readContract({
        address: this.instanceAddress,
        abi: instanceAbi,
        functionName: "getTurn",
        args: [gameId],
      })) as bigint;
      return this.getVoting(gameId, turn);
    } catch (error) {
      console.error(error);
    }
  };

  /**
   * Retrieves the ongoing proposals for a specific game.
   * @param gameId - The ID of the game.
   * @returns The ongoing proposals for the specified game.
   */
  getOngoingProposals = async (gameId: bigint) => {
    try {
      const currentTurn = (await this.publicClient.readContract({
        address: this.instanceAddress,
        abi: instanceAbi,
        functionName: "getTurn",
        args: [gameId],
      })) as bigint;

      const lastTurnEndedEvent = await this.publicClient.getContractEvents({
        address: this.instanceAddress,
        abi: instanceAbi,
        eventName: "TurnEnded",
        args: { turn: currentTurn - 1n, gameId },
      });

      if (lastTurnEndedEvent.length !== 1) {
        console.error("getOngoingProposals", gameId, "failed:", lastTurnEndedEvent.length);
        throw new ApiError("Game not found", { status: 404 });
      }

      const args = lastTurnEndedEvent[0].args as { newProposals: unknown[] };
      return args.newProposals;
    } catch (error) {
      console.error("Error in getOngoingProposals:", error);
      return [];
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
      eventName: "RegistrationOpen",
      args: {
        gameId,
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

    const gameState = (await this.publicClient.readContract({
      address: this.instanceAddress,
      abi: instanceAbi,
      functionName: "getGameState",
      args: [gameId],
    })) as { timeToJoin: bigint };

    return Number(block.timestamp) + Number(gameState.timeToJoin);
  };

  /**
   * Resolves the deadline for the current turn.
   * @param block The current block.
   * @param gameId The ID of the game.
   * @param timePerTurn The time duration per turn (optional).
   * @returns The deadline for the current turn.
   */
  resolveTurnDeadline = async (block: Block, gameId: bigint, timePerTurn?: number) => {
    if (timePerTurn) return Number(block.timestamp) + timePerTurn;

    const gameState = await this.publicClient.readContract({
      address: this.instanceAddress,
      abi: instanceAbi,
      functionName: "getGameState",
      args: [gameId],
    });

    return Number(block.timestamp) + Number(gameState.timePerTurn);
  };

  /**
   * Retrieves the deadline for the current turn in a game.
   * @param gameId - The ID of the game.
   * @param timePerTurn - Optional. The duration of each turn in seconds.
   * @returns A Promise that resolves to the deadline for the current turn, or 0 if the turn has not started.
   */
  getTurnDeadline = async (gameId: bigint, timePerTurn?: number) => {
    if (!gameId) throw new Error("gameId not set");

    const currentTurn = (await this.publicClient.readContract({
      address: this.instanceAddress,
      abi: instanceAbi,
      functionName: "getTurn",
      args: [gameId],
    })) as bigint;

    if (currentTurn === 0n) return 0;

    const eventName = currentTurn === 1n ? "GameStarted" : "TurnEnded";
    const args = currentTurn === 1n ? { gameId } : { gameId, turnId: currentTurn - 1n };

    const logs = await this.publicClient.getContractEvents({
      address: this.instanceAddress,
      abi: instanceAbi,
      eventName: eventName,
      args,
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
    const state = await this.publicClient.readContract({
      address: this.instanceAddress,
      abi: instanceAbi,
      functionName: "getContractState",
    });
    return state;
  };

  /**
   * Retrieves a player's game.
   * @param account - The player's account address.
   */
  getPlayersGame = async (account: Address) => {
    return this.publicClient.readContract({
      address: this.instanceAddress,
      abi: instanceAbi,
      functionName: "getPlayersGame",
      args: [account],
    });
  };

  /**
   * Retrieves the list of proposal scores for a specific game.
   * @param gameId - The ID of the game.
   * @returns A Promise that resolves to the list of proposal scores.
   */
  getProposalScoresList = async (gameId: bigint) => {
    if (!gameId) throw new Error("gameId not set");

    const logs = await this.publicClient.getContractEvents({
      address: this.instanceAddress,
      abi: instanceAbi,
      eventName: "ProposalScore",
      args: { gameId },
    });

    return logs;
  };

  /**
   * Retrieves the current turn of a game.
   * @param gameId - The ID of the game.
   * @returns A Promise that resolves to the current turn of the game.
   */
  getCurrentTurn = async (gameId: bigint) => {
    return this.publicClient.readContract({
      address: this.instanceAddress,
      abi: instanceAbi,
      functionName: "getTurn",
      args: [gameId],
    });
  };

  /**
   * Retrieves the game state for a specific game.
   * @param gameId - The ID of the game.
   * @returns A promise that resolves to an object containing the game state.
   */
  getGameState = async (gameId: bigint) => {
    const [
      gameMaster,
      joinRequirements,
      scores,
      currentTurn,
      isFinished,
      isOvertime,
      isLastTurn,
      isOpen,
      createdBy,
      gameRank,
      players,
      canStart,
    ] = await Promise.all([
      this.publicClient.readContract({
        address: this.instanceAddress,
        abi: instanceAbi,
        functionName: "getGM",
        args: [gameId],
      }),
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
        functionName: "getTurn",
        args: [gameId],
      }),
      this.publicClient.readContract({
        address: this.instanceAddress,
        abi: instanceAbi,
        functionName: "isGameOver",
        args: [gameId],
      }),
      this.publicClient.readContract({
        address: this.instanceAddress,
        abi: instanceAbi,
        functionName: "isOvertime",
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
        functionName: "isRegistrationOpen",
        args: [gameId],
      }),
      this.publicClient.readContract({
        address: this.instanceAddress,
        abi: instanceAbi,
        functionName: "gameCreator",
        args: [gameId],
      }),
      this.publicClient.readContract({
        address: this.instanceAddress,
        abi: instanceAbi,
        functionName: "getGameRank",
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
    ]);

    const requirementsPerContract = await Promise.all(
      joinRequirements.contractAddresses.map(async (address, idx) => {
        return this.publicClient.readContract({
          address: this.instanceAddress,
          abi: instanceAbi,
          functionName: "getJoinRequirementsByToken",
          args: [gameId, address, joinRequirements.contractIds[idx], joinRequirements.contractTypes[idx]],
        });
      }),
    );

    const gamePhase = isFinished
      ? gameStatusEnum["finished"]
      : isOvertime
        ? gameStatusEnum["overtime"]
        : isLastTurn
          ? gameStatusEnum["lastTurn"]
          : currentTurn > 0n
            ? gameStatusEnum["started"]
            : isOpen
              ? gameStatusEnum["open"]
              : gameMaster
                ? gameStatusEnum["created"]
                : gameStatusEnum["notFound"];

    return {
      gameMaster,
      joinRequirements,
      requirementsPerContract,
      scores,
      currentTurn,
      isFinished,
      isOvertime,
      isLastTurn,
      isOpen,
      createdBy,
      gameRank,
      players,
      canStart,
      gamePhase,
    };
  };
}
