import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import {
  type PublicClient,
  type WalletClient,
  type Address,
  type Hash,
  type TransactionReceipt,
  keccak256,
  toHex,
} from "viem";
import RankifyPlayer from "../Player";
import rankifyAbi from "../../abis/Rankify";
import { createMockEnvioClient } from "../../utils/mockUtils";

// Mock viem
jest.mock("viem", () => ({
  ...(jest.requireActual("viem") as object),
  getContract: jest.fn(),
  createPublicClient: jest.fn(),
  createWalletClient: jest.fn(),
  http: jest.fn(),
  parseEventLogs: jest.fn(),
}));

// Mock utils/artifacts
jest.mock("../../utils/artifacts", () => ({
  getArtifact: jest.fn().mockImplementation(() => {
    const mockAddress = "0x1234567890123456789012345678901234567890";
    const mockArtifact = {
      abi: rankifyAbi,
      address: mockAddress,
      execute: {
        args: ["TestRankify", "1.0.0"],
      },
    };
    return mockArtifact;
  }),
  getContract: jest.fn().mockReturnValue({
    read: {
      allowance: jest.fn<() => Promise<bigint>>().mockResolvedValue(100n),
      balanceOf: jest.fn<() => Promise<bigint>>().mockResolvedValue(100n),
    },
    write: {
      approve: jest.fn<() => Promise<Hash>>().mockResolvedValue("0x123"),
      createGame: jest.fn<() => Promise<Hash>>().mockResolvedValue("0x123"),
    },
  }),
}));

// Create mock functions with correct return types
const mockReadContract = jest.fn(() => Promise.resolve(0n));
const mockSimulateContract = jest.fn(() => Promise.resolve({ request: {} }));
const mockWaitForTransactionReceipt = jest.fn(() => Promise.resolve({} as TransactionReceipt));
const mockWriteContract = jest.fn(() => Promise.resolve("0x" as Hash));
const mockGetContractEvents = jest.fn(() =>
  Promise.resolve([
    {
      args: {
        gameId: 1n,
      },
    },
  ])
);

// Mock implementations
const mockPublicClient = {
  readContract: mockReadContract,
  simulateContract: mockSimulateContract,
  waitForTransactionReceipt: mockWaitForTransactionReceipt,
  getBlockNumber: jest.fn(() => Promise.resolve(1000n)),
  getBytecode: jest.fn(({ blockNumber }) => Promise.resolve(blockNumber >= 100n ? "0x1234" : "0x")),
  chain: { id: 97113 },
} as unknown as PublicClient;

const mockWalletClient = {
  writeContract: mockWriteContract,
  account: {
    address: "0x123" as Address,
  },
} as unknown as WalletClient;

const mockEnvioClient = createMockEnvioClient();

const mockInstanceAddress = "0x456" as Address;
const mockAccount = "0x789" as Address;
const mockChainId = 97113; // Arbitrum One chain ID

describe("RankifyPlayer", () => {
  let player: RankifyPlayer;

  beforeEach(() => {
    jest.clearAllMocks();
    player = new RankifyPlayer({
      publicClient: mockPublicClient,
      walletClient: mockWalletClient,
      chainId: mockChainId,
      instanceAddress: mockInstanceAddress,
      account: mockAccount,
      envioClient: mockEnvioClient,
    });
  });

  describe("createGame", () => {
    // it("should create a game successfully", async () => {
    //   const mockPrice = 100n;
    //   const mockHash = "0xabc" as Hash;
    //   if (!mockWalletClient.account?.address) throw new Error("Account not found");

    //   // Calculate the event signature hash
    //   const eventSignature = "gameCreated(uint256,address,address,uint256)";
    //   const eventSignatureHash = keccak256(toHex(eventSignature));

    //   const mockReceipt = {
    //     status: "success",
    //     blockNumber: 1n,
    //     blockHash: "0x" + "1".padStart(64, "0"),
    //     contractAddress: mockInstanceAddress,
    //     cumulativeGasUsed: 100000n,
    //     effectiveGasPrice: 1000000000n,
    //     from: mockWalletClient.account.address,
    //     gasUsed: 100000n,
    //     logs: [
    //       {
    //         address: mockInstanceAddress,
    //         topics: [
    //           eventSignatureHash, // event signature hash
    //           "0x" + mockWalletClient.account.address.slice(2).padStart(64, "0"), // gm (indexed)
    //           "0x" + mockWalletClient.account.address.slice(2).padStart(64, "0"), // creator (indexed)
    //           "0x" + "1".padStart(64, "0"), // rank (indexed)
    //         ],
    //         data: "0x" + "1".padStart(64, "0"), // gameId (non-indexed)
    //         blockNumber: 1n,
    //         transactionHash: mockHash,
    //         logIndex: 0,
    //         transactionIndex: 0,
    //         removed: false,
    //         blockHash: "0x" + "1".padStart(64, "0"),
    //       },
    //     ],
    //     logsBloom: "0x" + "0".repeat(512),
    //     to: mockInstanceAddress,
    //     transactionHash: mockHash,
    //     transactionIndex: 0,
    //     type: "0x0",
    //   } as unknown as TransactionReceipt;

    //   // Mock the contract events
    //   mockGetContractEvents.mockResolvedValue([
    //     {
    //       args: {
    //         gameId: 1n,
    //       },
    //     },
    //   ] as { args: { gameId: bigint } }[]);

    //   const mockGameParams = {
    //     gameRank: 1n,
    //     minPlayerCnt: 2n,
    //     maxPlayerCnt: 4n,
    //     nTurns: 10n,
    //     voteCredits: 100n,
    //     gameMaster: "0x123" as `0x${string}`,
    //     minGameTime: 300n,
    //     timePerTurn: 60n,
    //     timeToJoin: 300n,
    //     metadata: "ipfs://test-hash",
    //     votePhaseDuration: 1800n,
    //     proposingPhaseDuration: 1800n,
    //   };

    //   // Mock the contract read for price estimation
    //   mockReadContract.mockResolvedValue(mockPrice);

    //   // Mock the contract simulation
    //   mockSimulateContract.mockResolvedValue({
    //     request: {},
    //   });

    //   // Mock the transaction write
    //   mockWriteContract.mockResolvedValue(mockHash);

    //   // Mock the transaction receipt
    //   mockWaitForTransactionReceipt.mockResolvedValue(mockReceipt);

    //   // Execute the createGame function
    //   const result = await player.createGame({
    //     creationArgs: mockGameParams,
    //     openNow: false,
    //   });

    //   // Verify the contract interactions
    //   expect(mockReadContract).toHaveBeenCalledWith({
    //     address: mockInstanceAddress,
    //     abi: expect.any(Array),
    //     functionName: "estimateGamePrice",
    //     args: [mockGameParams.minGameTime],
    //   });

    //   expect(mockSimulateContract).toHaveBeenCalledWith({
    //     address: mockInstanceAddress,
    //     abi: expect.any(Array),
    //     functionName: "createGame",
    //     args: [mockGameParams],
    //     account: mockWalletClient.account?.address,
    //   });

    //   expect(mockWriteContract).toHaveBeenCalled();
    //   expect(mockWaitForTransactionReceipt).toHaveBeenCalledWith({ hash: mockHash });

    //   // Verify the result
    //   expect(result).toEqual({
    //     gameId: 1n,
    //     receipt: mockReceipt,
    //   });
    // });

    it("should throw error when account is not found", async () => {
      const clientWithoutAccount = {
        ...mockWalletClient,
        account: undefined,
      } as unknown as WalletClient;

      const playerWithoutAccount = new RankifyPlayer({
        publicClient: mockPublicClient,
        walletClient: clientWithoutAccount,
        chainId: mockChainId,
        instanceAddress: mockInstanceAddress,
        account: mockAccount,
        envioClient: mockEnvioClient,
      });

      const mockGameParams = {
        gameRank: 1n,
        minPlayerCnt: 2n,
        maxPlayerCnt: 4n,
        nTurns: 10n,
        voteCredits: 100n,
        gameMaster: "0x123" as `0x${string}`,
        minGameTime: 300n,
        timePerTurn: 60n,
        timeToJoin: 300n,
        metadata: "ipfs://test-hash",
        votePhaseDuration: 1800n,
        proposingPhaseDuration: 1800n,
      };

      mockReadContract.mockResolvedValue(100n);

      await expect(playerWithoutAccount.createGame({ creationArgs: mockGameParams, openNow: false })).rejects.toThrow(
        "Account not found"
      );
    });
  });
});
