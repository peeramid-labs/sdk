import { ethers, BigNumberish, BigNumber } from "ethers";
import { TurnEndedEventObject } from "rankify-contracts/types/hardhat-diamond-abi/HardhatDiamondABI.sol/RankifyDiamondInstance";
import { SupportedChains, ArtifactTypes, getArtifact, ApiError, ArtifactContractInterfaces } from "../utils/index";
import { RankifyDiamondInstance } from "rankify-contracts/types";
import { deepArrayToObject } from "../utils";
export enum gameStatusEnum {
  created = "Game created",
  open = "Registration open",
  started = "In progress",
  lastTurn = "Playing last turn",
  overtime = "PLaying in overtime",
  finished = "Finished",
  notFound = "not found",
}

export default class InstanceBase {
  provider: ethers.providers.JsonRpcProvider;
  chain: SupportedChains;
  rankifyInstance: RankifyDiamondInstance;

  constructor({
    provider,
    chain,
    rankifyInstance,
  }: {
    provider: ethers.providers.JsonRpcProvider;
    chain: SupportedChains;
    rankifyInstance: RankifyDiamondInstance;
  }) {
    this.provider = provider;
    this.chain = chain;
    this.rankifyInstance = rankifyInstance;
  }

  /**
   * Retrieves the contract instance for the specified chain using the provided provider.
   * @param chain The supported chain for the this.rankifyInstance.
   * @param provider The Web3Provider or Signer instance used for interacting with the blockchain.
   * @returns The contract instance.
   */
  getContract = <T extends ArtifactTypes>(artifactName: T) => {
    const artifact = getArtifact(this.chain, artifactName);

    return new ethers.Contract(artifact.address, artifact.abi, this.provider) as ArtifactContractInterfaces[T];
  };

  /**
   * Retrieves the historic turn information for a specific game and turn ID.
   * @param chain - The supported blockchain network.
   * @param provider - The Web3 provider.
   * @returns The historic turn event object.
   * @throws {ApiError} If the game or turn is not found.
   */
  getHistoricTurn = async (gameId: BigNumberish, turnId: BigNumberish) => {
    //list all events of gameId that ended turnId.
    const filterTurnEnded = this.rankifyInstance.filters.TurnEnded(gameId, turnId);
    const turnEndedEvents = await this.rankifyInstance.queryFilter(filterTurnEnded, 0, "latest");
    //There shall be only one such event
    if (turnEndedEvents.length !== 1) {
      console.error("getHistoricTurn", gameId, turnId, "failed:", turnEndedEvents.length);
      const err = new ApiError("Game not found", { status: 404 });
      throw err;
    }
    return { ...turnEndedEvents[turnEndedEvents.length - 1] };
  };

  /**
   * Retrieves the previous turn information for a specific game.
   * @param gameId - The ID of the game.
   * @returns The previous turn information for the specified game.
   */
  getPreviousTurnStats = async (gameId: BigNumberish) => {
    const currentTurn = await this.rankifyInstance.getTurn(gameId);
    if (currentTurn.gt(1)) {
      return this.getHistoricTurn(gameId, currentTurn.sub(1));
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
  getVoting = async (gameId: BigNumberish, turnId: BigNumberish) => {
    if (!gameId) throw new Error("gameId not set");
    if (!turnId) throw new Error("turnId not set");
    const filterVoteEvent = this.rankifyInstance.filters.VoteSubmitted(gameId, turnId);
    const filterProposalEvent = this.rankifyInstance.filters.ProposalSubmitted(gameId, turnId, null, null, null);
    const proposalEvents = await this.rankifyInstance.queryFilter(filterProposalEvent, 0, "latest");
    const voteEvents = await this.rankifyInstance.queryFilter(filterVoteEvent, 0, "latest");
    const fixedProposalArgs = proposalEvents.map((event) => {
      return {
        ...event,
        args: {
          gameId: event.args[0],
          turn: event.args[1],
          proposer: event.args[2],
          commitmentHash: event.args[3],
          proposalEncryptedByGM: event.args[4],
        },
      };
    });

    // for (const filterProposalEvent in filterProposalEvents.topics) {
    //   if (filterProposalEvent)
    //     proposals.push(contract.interface.parseLog({ log: proposalEvent }));
    // }
    // for (const voteEvent in voteEvents) {
    //   playersVoted.push(voteEvent[2]);
    // }
    return { voteEvents, proposalEvents: fixedProposalArgs };
  };

  /**
   * Retrieves the ongoing voting for a specific game.
   *
   * @param gameId - The ID of the game.
   * @returns The ongoing voting for the specified game.
   */
  getOngoingVoting = async (gameId: BigNumberish) => {
    this.rankifyInstance
      .getTurn(gameId)
      .then((turn) => this.getVoting(gameId, turn))
      .catch(console.error);
  };

  /**
   * Retrieves the ongoing proposals for a specific game on a supported chain.
   *
   * @param gameId - The ID of the game.
   * @returns The ongoing proposals for the specified game.
   */
  getOngoingProposals = async (gameId: BigNumberish) => {
    const currentTurn = await this.rankifyInstance.getTurn(gameId);
    //list all events of gameId that ended turnId.
    const filter = this.rankifyInstance.filters.TurnEnded(gameId, currentTurn.sub(1));
    const TurnEndedEvents = await this.rankifyInstance.queryFilter(filter, 0, "latest");
    const args = this.rankifyInstance.interface.parseLog(TurnEndedEvents[0]).args as any as TurnEndedEventObject;
    return args.newProposals;
  };

  /**
   * Retrieves the registration deadline for a specific game.
   * @param gameId - The ID of the game.
   * @param timeToJoin - Optional. The additional time (in seconds) to join the game.
   * @returns A Promise that resolves to the registration deadline timestamp.
   */
  getRegistrationDeadline = async (gameId: BigNumberish, timeToJoin?: number) => {
    const filter = this.rankifyInstance.filters.RegistrationOpen(gameId);
    return this.rankifyInstance.queryFilter(filter, 0, "latest").then((events) =>
      events[0].getBlock().then(async (block) => {
        if (timeToJoin) return block.timestamp + timeToJoin;
        else return this.rankifyInstance.getGameState(gameId).then((gs) => block.timestamp + gs.timeToJoin.toNumber());
      }),
    );
  };

  /**
   * Resolves the deadline for the current turn.
   * If `timePerTurn` is provided, the deadline is calculated by adding `timePerTurn` to the current block timestamp.
   * Otherwise, the deadline is obtained from the contract state and calculated by adding `timePerTurn` to the current block timestamp.
   * @param block The current block.
   * @param gameId The ID of the game.
   * @param timePerTurn The time duration per turn (optional).
   * @returns The deadline for the current turn.
   */
  resolveTurnDeadline = async (block: ethers.providers.Block, gameId: BigNumberish, timePerTurn?: number) => {
    if (timePerTurn) return block.timestamp + timePerTurn;
    return this.rankifyInstance.getGameState(gameId).then((gs) => gs.timePerTurn.toNumber() + block.timestamp);
  };

  /**
   * Retrieves the deadline for the current turn in a game.
   *
   * @param chainName - The name of the blockchain network.
   * @param provider - The Web3Provider instance.
   * @param gameId - The ID of the game.
   * @param timePerTurn - Optional. The duration of each turn in seconds.
   * @returns A Promise that resolves to the deadline for the current turn, or 0 if the turn has not started.
   * @throws An error if the gameId is not set.
   */
  getTurnDeadline = async (gameId: BigNumberish, timePerTurn?: number) => {
    if (!gameId) throw new Error("gameId not set");

    return this.rankifyInstance.getTurn(gameId).then(async (ct) => {
      if (ct.eq(0)) return 0;
      const filter = ct.eq(1)
        ? this.rankifyInstance.filters.GameStarted(gameId)
        : this.rankifyInstance.filters.TurnEnded(gameId, ct.sub(1));
      return this.rankifyInstance
        .queryFilter(filter, 0, "latest")
        .then(async (evts) =>
          evts[0].getBlock().then(async (block) => this.resolveTurnDeadline(block, gameId, timePerTurn)),
        );
    });
  };
  getContractState = async () => {
    const cs = await this.rankifyInstance.getContractState().then((x) => deepArrayToObject(x));
    return cs;
  };

  getPlayersGame = async (account: string) => {
    return this.rankifyInstance.getPlayersGame(account);
  };

  /**
   * Retrieves the list of proposal scores for a specific game.
   * @param gameId - The ID of the game.
   * @returns A Promise that resolves to the list of proposal scores.
   * @throws An error if the gameId is not set.
   */
  getProposalScoresList = async (gameId: string) => {
    if (!gameId) throw new Error("gameId not set");
    const proposalScoreFilter = this.rankifyInstance.filters.ProposalScore(gameId);
    const res = await this.rankifyInstance.queryFilter(proposalScoreFilter, 0, "latest");
    return deepArrayToObject(res);
  };

  /**
   * Retrieves the current turn of a game.
   * @param gameId - The ID of the game.
   * @returns A Promise that resolves to the current turn of the game.
   */
  getCurrentTurn = async (gameId: string) => {
    const currentTurn = await this.rankifyInstance.getTurn(gameId);
    return currentTurn;
  };

  /**
   * Retrieves the game state for a specific game.
   * @param gameId - The ID of the game.
   * @returns A promise that resolves to an object containing the game state.
   */
  getGameState = async (gameId: string) => {
    const gameMaster = await this.rankifyInstance.getGM(gameId);
    const joinRequirements = await this.rankifyInstance.getJoinRequirements(gameId);
    const requirementsPerContract = await Promise.all(
      joinRequirements.contractAddresses.map(async (address, idx) => {
        return this.rankifyInstance.getJoinRequirementsByToken(
          gameId,
          address,
          joinRequirements.contractIds[idx],
          joinRequirements.contractTypes[idx],
        );
      }),
    );
    const promises: any[] = [];

    promises.push(this.rankifyInstance.getScores(gameId));
    promises.push(this.rankifyInstance.getTurn(gameId));
    promises.push(this.rankifyInstance.isGameOver(gameId));
    promises.push(this.rankifyInstance.isOvertime(gameId));
    promises.push(this.rankifyInstance.isLastTurn(gameId));
    promises.push(this.rankifyInstance.isRegistrationOpen(gameId));
    promises.push(this.rankifyInstance.gameCreator(gameId));
    promises.push(this.rankifyInstance.getGameRank(gameId));
    promises.push(this.rankifyInstance.getPlayers(gameId));
    promises.push(this.rankifyInstance.canStartGame(gameId));
    return Promise.all(promises).then((values) => {
      const scores = values[0] as [string, BigNumber];
      const currentTurn = values[1] as BigNumber;
      const isFinished = values[2] as boolean;
      const isOvertime = values[3] as boolean;
      const isLastTurn = values[4] as boolean;
      const isOpen = values[5] as boolean;
      const createdBy = values[6] as string;
      const gameRank = values[7] as BigNumber;
      const players = values[8] as string[];
      const canStart = values[9] as boolean;
      const gamePhase = (isFinished as boolean)
        ? gameStatusEnum["finished"]
        : isOvertime
          ? gameStatusEnum["overtime"]
          : isLastTurn
            ? gameStatusEnum["lastTurn"]
            : currentTurn.gt(0)
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
    });
  };
}
