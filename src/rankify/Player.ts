import { ethers, BigNumberish, BigNumber, ContractReceipt } from "ethers";
import InstanceBase from "./InstanceBase";
import { SupportedChains } from "../utils/artifacts";
import { RankifyDiamondInstance } from "rankify-contracts/types";
import { IRankifyInstance } from "rankify-contracts/types/hardhat-diamond-abi/HardhatDiamondABI.sol/RankifyDiamondInstance";
import { LibCoinVending } from "rankify-contracts/types/src/mocks/MockVendingMachine";
// import { IRankifyInstance } from "rankify-contracts/types/src/interfaces/IRankifyInstance";

export default class RankifyPlayer extends InstanceBase {
  signer: ethers.providers.JsonRpcSigner;
  constructor({
    signer,
    chain,
    rankifyInstance,
  }: {
    signer: ethers.providers.JsonRpcSigner;
    chain: SupportedChains;
    rankifyInstance: RankifyDiamondInstance;
  }) {
    super({
      provider: signer.provider,
      chain,
      rankifyInstance,
    });
    this.signer = signer;
  }
  /**
   * Approves tokens if needed.
   *
   * @param value - The value of tokens to approve.
   * @param chain - The supported chain.
   * @param signer - The JSON-RPC signer.
   * @returns A promise that resolves to the transaction receipt or 0 if no tokens need to be approved.
   */
  approveTokensIfNeeded = async (value: BigNumberish) => {
    if (ethers.BigNumber.from(value).gt(0)) {
      return this.getContract("Rankify")
        .connect(this.signer)
        .approve(this.rankifyInstance.address, value)
        .then((tx) => tx.wait(1));
    } else return 0;
  };

  createGame = async (
    newGameParams: IRankifyInstance.NewGameParamsInputStruct,
  ): Promise<{
    gameId: BigNumber;
    receipt: ethers.ContractReceipt;
  }> => {
    const contract = this.rankifyInstance.connect(this.signer);
    return contract.estimateGamePrice(newGameParams.minGameTime).then(async (price) =>
      this.approveTokensIfNeeded(price).then(() => {
        return contract.createGame(newGameParams).then((tx) =>
          tx.wait(1).then((receipt) => {
            const event = receipt.events?.find((e) => e.event === "gameCreated");
            if (!event) {
              throw new Error("Failed to create game");
            }
            const gameId = contract.interface.parseLog(event).args.gameId;
            return { gameId, receipt };
          }),
        );
      }),
    );
  };

  /**
   * Joins a game on the specified chain using the provided signer.
   * @param chain - The supported chain on which the game is being joined.
   * @param signer - The JSON-RPC signer used for signing the transaction.
   * @returns A promise that resolves to the transaction receipt once the join transaction is confirmed.
   */
  joinGame = async (gameId: string): Promise<ContractReceipt> => {
    const reqs = await this.rankifyInstance.getJoinRequirements(gameId);
    const values = reqs.ethValues;

    const value = values.bet.add(values.burn).add(values.pay);

    return this.rankifyInstance
      .connect(this.signer)
      .joinGame(gameId, { value: value.toString() ?? "0" })
      .then((tx) => tx.wait(1));
  };

  /**
   * Starts a game on the specified chain using the provided signer.
   * @param chain The supported chain on which the game will be started.
   * @param signer The JSON-RPC signer used to sign the transaction.
   * @returns A promise that resolves to the transaction receipt.
   */
  startGame = async (gameId: string): Promise<ContractReceipt> => {
    return await this.rankifyInstance.startGame(gameId).then((tx) => tx.wait(1));
  };

  /**
   * Cancels a game.
   *
   * @param chain - The supported blockchain network.
   * @param signer - The JSON-RPC signer.
   * @returns A promise that resolves to the transaction receipt.
   */
  cancelGame = async (gameId: string): Promise<ContractReceipt> => {
    return this.rankifyInstance.cancelGame(gameId).then((tx) => tx.wait(1));
  };

  /**
   * Leaves a game.
   * @param chain - The blockchain network.
   * @param signer - The signer object.
   * @returns A promise that resolves to the transaction receipt.
   */
  leaveGame = async (gameId: string) => {
    return this.rankifyInstance
      .connect(this.signer)
      .leaveGame(gameId)
      .then((tx) => tx.wait(1));
  };

  /**
   * Opens the registration for a game on the specified chain using the provided signer.
   * @param chain - The supported chain on which the game is being played.
   * @param signer - The JSON-RPC signer used to interact with the blockchain.
   * @returns A promise that resolves to the transaction receipt.
   */
  openRegistration = async (gameId: string): Promise<ContractReceipt> => {
    const contract = this.rankifyInstance.connect(this.signer);
    return await contract.openRegistration(gameId).then((tx) => tx.wait(1));
  };

  /**
   * Sets the join requirements for a game on the specified chain using the provided signer.
   *
   * @param chain - The supported chain on which the game is being played.
   * @param signer - The JSON-RPC signer used to interact with the contract.
   * @returns A promise that resolves to the transaction receipt.
   */
  setJoinRequirements = async (
    gameId: string,
    config: LibCoinVending.ConfigPositionStruct,
  ): Promise<ContractReceipt> => {
    const contract = this.rankifyInstance.connect(this.signer);
    return contract.setJoinRequirements(gameId, config).then((tx) => tx.wait(1));
  };
}
