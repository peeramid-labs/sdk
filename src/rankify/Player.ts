import {
  type Address,
  type PublicClient,
  type WalletClient,
  type Hex,
  GetAbiItemParameters,
  ContractFunctionArgs,
  TransactionReceipt,
  keccak256,
  encodePacked,
} from "viem";
import { getContract } from "../utils/artifacts";
import instanceAbi from "../abis/RankifyDiamondInstance";
import InstanceBase from "./InstanceBase";
import { handleRPCError } from "../utils";
import { GmProposalParams } from "../types/contracts";
type stateMutability = "nonpayable" | "payable";
export type NewGameParams = {
  minGameTime: bigint;
  maxGameTime: bigint;
  maxPlayers: number;
  minPlayers: number;
  timePerTurn: bigint;
  timeToJoin: bigint;
  gameMaster: Hex;
  joinRequirements: {
    contractAddresses: readonly Hex[];
    contractIds: readonly bigint[];
    contractTypes: readonly number[];
    ethValues: {
      have: bigint;
      lock: bigint;
      burn: bigint;
      pay: bigint;
      bet: bigint;
    }[];
  };
};

export default class RankifyPlayer extends InstanceBase {
  walletClient: WalletClient;
  account: Address;

  constructor({
    publicClient,
    walletClient,
    chainId,
    instanceAddress,
    account,
  }: {
    publicClient: PublicClient;
    walletClient: WalletClient;
    chainId: number;
    instanceAddress: Address;
    account: Address;
  }) {
    super({
      publicClient,
      chainId,
      instanceAddress,
    });
    this.walletClient = walletClient;
    this.account = account;
  }

  /**
   * Approves the necessary tokens if needed
   * @param value - The amount of tokens to approve
   * @returns A promise that resolves when the tokens are approved
   * @throws If the account is not found or the tokens cannot be approved
   */
  approveTokensIfNeeded = async (value: bigint) => {
    const tokenContract = getContract(this.chainId, "Rankify", this.walletClient);
    if (!this.walletClient.account?.address) throw new Error("Account not found");
    if (value > 0n) {
      try {
        const { request } = await this.publicClient.simulateContract({
          address: tokenContract.address,
          abi: tokenContract.abi,
          functionName: "approve",
          args: [this.instanceAddress, value],
          account: this.walletClient.account,
        });

        const hash = await this.walletClient.writeContract(request);
        await this.publicClient.waitForTransactionReceipt({ hash });
      } catch (e) {
        throw await handleRPCError(e);
      }
    }
  };

  /**
   * Creates a new game
   * @param creationArgs - The arguments for creating a new game
   * @param openNow - Whether to open the game registration immediately
   * @returns A promise that resolves to the game ID and receipt
   * @throws If the account is not found or the game cannot be created
   */
  createGame = async ({
    creationArgs,
    openNow,
  }: {
    creationArgs: ContractFunctionArgs<typeof instanceAbi, stateMutability, "createGame">[0];
    openNow: boolean;
  }) => {
    // if (!creationArgs) throw new Error("args is required");
    try {
      const estimationArgs: ContractFunctionArgs<typeof instanceAbi, "pure" | "view", "estimateGamePrice"> = [
        creationArgs.minGameTime,
      ];
      const price = await this.publicClient.readContract({
        address: this.instanceAddress,
        abi: instanceAbi,
        functionName: "estimateGamePrice",
        args: estimationArgs,
      });

      await this.approveTokensIfNeeded(price);
      if (!this.walletClient.account?.address) throw new Error("Account not found");
      const { request } = await this.publicClient.simulateContract({
        address: this.instanceAddress,
        abi: instanceAbi,
        functionName: "createGame",
        args: [creationArgs],
        account: this.walletClient.account.address,
      });

      const hash = await this.walletClient.writeContract(request);
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

      const events = await this.publicClient.getContractEvents({
        address: this.instanceAddress,
        abi: instanceAbi,
        eventName: "gameCreated",
        args: {},
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber,
      });

      if (events.length > 1) {
        throw new Error("Failed to create game: Multiple GameCreated events found");
      }
      if (events.length === 0) {
        throw new Error("Failed to create game: GameCreated event not found");
      }
      if (!events[0].args) throw new Error("Failed to create game: Event args not found");
      if (!("gameId" in events[0].args)) throw new Error("Failed to create game: GameId not found");
      const { gameId } = events[0].args;

      let openingReceipt: TransactionReceipt | undefined;
      if (openNow) {
        if (!gameId) throw new Error("Failed to create game: GameId not found");
        openingReceipt = await this.openRegistration(gameId);
      }

      return {
        gameId,
        receipt,
        openingReceipt,
      };
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  /**
   * Joins a game
   * @param params - The parameters for joining a game
   * @returns A promise that resolves to the transaction receipt
   * @throws If the account is not found or the game cannot be joined
   */
  joinGame = async ({
    gameId,
    signature,
    gmCommitment,
    deadline,
    pubkey,
  }: {
    gameId: bigint;
    signature: Address;
    gmCommitment: Hex;
    deadline: number;
    pubkey: Hex;
  }) => {
    try {
      const reqs = (await this.publicClient.readContract({
        address: this.instanceAddress,
        abi: instanceAbi,
        functionName: "getJoinRequirements",
        args: [gameId],
      })) as { ethValues: { have: bigint; lock: bigint; burn: bigint; pay: bigint; bet: bigint } };

      const values = reqs.ethValues;
      const value = values.bet + values.burn + values.pay;
      if (!this.walletClient.account?.address) throw new Error("Account not found");
      const { request } = await this.publicClient.simulateContract({
        address: this.instanceAddress,
        abi: instanceAbi,
        functionName: "joinGame",
        args: [gameId, signature, gmCommitment, BigInt(deadline), pubkey],
        value,
        account: this.walletClient.account,
      });

      const hash = await this.walletClient.writeContract(request);
      return this.publicClient.waitForTransactionReceipt({ hash });
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  estimateGamePrice = async (minimumGameTime: bigint): Promise<bigint> => {
    try {
      const estimationArgs: ContractFunctionArgs<typeof instanceAbi, "pure" | "view", "estimateGamePrice"> = [
        minimumGameTime,
      ];
      const price = await this.publicClient.readContract({
        address: this.instanceAddress,
        abi: instanceAbi,
        functionName: "estimateGamePrice",
        args: estimationArgs,
      });

      return price;
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  /**
   * Starts a game
   * @param gameId - The ID of the game to start
   * @param permutationCommitment - The permutation commitment for the game
   * @returns A promise that resolves to the transaction receipt
   * @throws If the account is not found or the game cannot be started
   */
  startGame = async (gameId: bigint, permutationCommitment: bigint) => {
    try {
      if (!this.walletClient.account?.address) throw new Error("Account not found");
      const { request } = await this.publicClient.simulateContract({
        address: this.instanceAddress,
        abi: instanceAbi,
        functionName: "startGame",
        args: [gameId, permutationCommitment],
        account: this.walletClient.account,
      });

      const hash = await this.walletClient.writeContract(request);
      return this.publicClient.waitForTransactionReceipt({ hash });
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  /**
   * Cancels a game
   * @param gameId - The ID of the game to cancel
   * @returns A promise that resolves to the transaction receipt
   * @throws If the account is not found or the game cannot be canceled
   */
  cancelGame = async (gameId: bigint) => {
    try {
      if (!this.walletClient.account?.address) throw new Error("Account not found");
      const { request } = await this.publicClient.simulateContract({
        address: this.instanceAddress,
        abi: instanceAbi,
        functionName: "cancelGame",
        args: [gameId],
        account: this.walletClient.account,
      });

      const hash = await this.walletClient.writeContract(request);
      return this.publicClient.waitForTransactionReceipt({ hash });
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  /**
   * Leaves a game
   * @param gameId - The ID of the game to leave
   * @returns A promise that resolves to the transaction receipt
   * @throws If the account is not found or the game cannot be left
   */
  leaveGame = async (gameId: bigint) => {
    try {
      if (!this.walletClient.account?.address) throw new Error("Account not found");
      const { request } = await this.publicClient.simulateContract({
        address: this.instanceAddress,
        abi: instanceAbi,
        functionName: "leaveGame",
        args: [gameId],
        account: this.walletClient.account,
      });

      const hash = await this.walletClient.writeContract(request);
      return this.publicClient.waitForTransactionReceipt({ hash });
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  /**
   * Opens the registration for a game
   * @param gameId - The ID of the game to open registration for
   * @returns A promise that resolves to the transaction receipt
   * @throws If the account is not found or the registration cannot be opened
   */
  openRegistration = async (gameId: bigint) => {
    try {
      if (!this.walletClient.account?.address) throw new Error("Account not found");
      const { request } = await this.publicClient.simulateContract({
        address: this.instanceAddress,
        abi: instanceAbi,
        functionName: "openRegistration",
        args: [gameId],
        account: this.walletClient.account,
      });

      const hash = await this.walletClient.writeContract(request);
      return this.publicClient.waitForTransactionReceipt({ hash });
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  /**
   * Sets the join requirements for a game
   * @param params - The parameters for setting the join requirements
   * @returns A promise that resolves to the transaction receipt
   * @throws If the account is not found or the join requirements cannot be set
   */
  setJoinRequirements = async (params: GetAbiItemParameters<typeof instanceAbi, "setJoinRequirements">["args"]) => {
    if (!this.walletClient.account?.address) throw new Error("Account not found");
    if (!params) throw new Error("params is required");
    try {
      const { request } = await this.publicClient.simulateContract({
        address: this.instanceAddress,
        abi: instanceAbi,
        functionName: "setJoinRequirements",
        args: params,
        account: this.walletClient.account,
      });

      const hash = await this.walletClient.writeContract(request);
      return this.publicClient.waitForTransactionReceipt({ hash });
    } catch (e) {
      await handleRPCError(e);
    }
  };

  /**
   * Signs a proposal commitment
   * @param params - The parameters for signing a proposal commitment
   * @returns A promise that resolves to the signed proposal commitment
   * @throws If the account is not found or the proposal commitment cannot be signed
   */
  signProposalCommitment = async (params: GmProposalParams) => {
    const proposalTypes = {
      AuthorizeProposalSubmission: [
        { type: "uint256", name: "gameId" },
        { type: "string", name: "encryptedProposal" },
        { type: "uint256", name: "commitment" },
      ],
    };
    const eip712 = await this.getEIP712Domain();

    return this.walletClient.signTypedData({
      domain: {
        name: eip712.name,
        version: eip712.version,
        chainId: eip712.chainId,
        verifyingContract: this.instanceAddress,
      },
      types: proposalTypes,
      primaryType: "AuthorizeProposalSubmission",
      message: {
        gameId: params.gameId,
        encryptedProposal: params.encryptedProposal,
        commitment: params.commitment,
      },
      account: this.account,
    });
  };

  /**
   * Signs an authorize vote submission
   * @param params - The parameters for signing an authorize vote submission
   * @returns A promise that resolves to the signed authorize vote submission
   * @throws If the account is not found or the authorize vote submission cannot be signed
   */
  authorizeVoteSubmission = async (params: {
    gameId: bigint;
    vote: bigint[];
    verifierAddress: Address;
    playerSalt: Hex;
    ballotId: string;
  }) => {
    const voteTypes = {
      AuthorizeVoteSubmission: [
        { name: "gameId", type: "uint256" },
        { name: "sealedBallotId", type: "string" },
        { name: "ballotHash", type: "bytes32" },
      ],
    };
    const { gameId, vote, verifierAddress, playerSalt, ballotId } = params;
    const eip712 = await this.getEIP712Domain();

    const ballotHash: string = keccak256(encodePacked(["uint256[]", "bytes32"], [vote, playerSalt]));
    return this.walletClient.signTypedData({
      domain: {
        name: eip712.name,
        version: eip712.version,
        chainId: this.chainId,
        verifyingContract: verifierAddress,
      },
      types: voteTypes,
      primaryType: "AuthorizeVoteSubmission",
      message: {
        gameId,
        sealedBallotId: ballotId,
        ballotHash,
      },
      account: this.account,
    });
  };
}
