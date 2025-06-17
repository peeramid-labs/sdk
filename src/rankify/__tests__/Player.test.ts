import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { type PublicClient, type WalletClient, type Address, type Hash, type TransactionReceipt } from "viem";
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
  beforeEach(() => {
    jest.clearAllMocks();
    new RankifyPlayer({
      publicClient: mockPublicClient,
      walletClient: mockWalletClient,
      chainId: mockChainId,
      instanceAddress: mockInstanceAddress,
      account: mockAccount,
      envioClient: mockEnvioClient,
    });
  });

  describe("createGame", () => {
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
