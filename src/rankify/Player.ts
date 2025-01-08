import {
  type Address,
  type PublicClient,
  type WalletClient,
  type Hex,
  GetAbiItemParameters,
  ContractFunctionArgs,
} from "viem";
import { getContract } from "../utils/artifacts";
import instanceAbi from "../abis/RankifyDiamondInstance";
import InstanceBase from "./InstanceBase";
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

  approveTokensIfNeeded = async (value: bigint) => {
    const tokenContract = getContract(this.chainId, "Rankify", this.walletClient);
    if (!this.walletClient.account?.address) throw new Error("Account not found");
    if (value > 0n) {
      const { request } = await this.publicClient.simulateContract({
        address: tokenContract.address,
        abi: tokenContract.abi,
        functionName: "approve",
        args: [this.instanceAddress, value],
        account: this.walletClient.account,
      });

      const hash = await this.walletClient.writeContract(request);
      await this.publicClient.waitForTransactionReceipt({ hash });
    }
  };

  createGame = async (creationArgs: ContractFunctionArgs<typeof instanceAbi, stateMutability, "createGame">[0]) => {
    // if (!creationArgs) throw new Error("args is required");
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

    return {
      gameId,
      receipt,
    };
  };

  joinGame = async (gameId: bigint) => {
    const reqs = (await this.publicClient.readContract({
      address: this.instanceAddress,
      abi: instanceAbi,
      functionName: "getJoinRequirements",
      args: [gameId],
    })) as { ethValues: { have: bigint; lock: bigint; burn: bigint; pay: bigint; bet: bigint } };

    const values = reqs.ethValues;
    const value = values.bet + values.burn + values.pay;
    if (this.walletClient.account?.address) throw new Error("Account not found");
    const { request } = await this.publicClient.simulateContract({
      address: this.instanceAddress,
      abi: instanceAbi,
      functionName: "joinGame",
      args: [gameId],
      value,
      account: this.walletClient.account,
    });

    const hash = await this.walletClient.writeContract(request);
    return this.publicClient.waitForTransactionReceipt({ hash });
  };

  startGame = async (gameId: bigint) => {
    if (!this.walletClient.account?.address) throw new Error("Account not found");
    const { request } = await this.publicClient.simulateContract({
      address: this.instanceAddress,
      abi: instanceAbi,
      functionName: "startGame",
      args: [gameId],
      account: this.walletClient.account,
    });

    const hash = await this.walletClient.writeContract(request);
    return this.publicClient.waitForTransactionReceipt({ hash });
  };

  cancelGame = async (gameId: bigint) => {
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
  };

  leaveGame = async (gameId: bigint) => {
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
  };

  openRegistration = async (gameId: bigint) => {
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
  };

  setJoinRequirements = async (params: GetAbiItemParameters<typeof instanceAbi, "setJoinRequirements">["args"]) => {
    if (!this.walletClient.account?.address) throw new Error("Account not found");
    if (!params) throw new Error("params is required");
    const { request } = await this.publicClient.simulateContract({
      address: this.instanceAddress,
      abi: instanceAbi,
      functionName: "setJoinRequirements",
      args: params,
      account: this.walletClient.account,
    });

    const hash = await this.walletClient.writeContract(request);
    return this.publicClient.waitForTransactionReceipt({ hash });
  };
}
