import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { type PublicClient, type WalletClient, type GetContractEventsReturnType, Hex } from "viem";
import { GameMaster } from "../GameMaster";
import { MOCK_ADDRESSES, MOCK_HASHES, createMockPublicClient, createMockWalletClient } from "../../__tests__/utils";

// Mock viem
jest.mock("viem", () => ({
  ...(jest.requireActual("viem") as object),
  getContract: jest.fn(),
  createPublicClient: jest.fn(),
  createWalletClient: jest.fn(),
  http: jest.fn(),
  keccak256: jest.fn((input: Hex) => input),
  encodePacked: jest.fn((types: readonly string[], values: readonly unknown[]) => values.join("") as Hex),
}));

// Create mock functions with correct return types
const mockReadContract = jest.fn(() => Promise.resolve(0n));
const mockSimulateContract = jest.fn(() => Promise.resolve({ request: {} }));
const mockGetContractEvents = jest.fn(() => Promise.resolve([] as GetContractEventsReturnType));

// Mock public client
const mockPublicClient = createMockPublicClient({
  readContract: mockReadContract,
  simulateContract: mockSimulateContract,
  getContractEvents: mockGetContractEvents,
});

// Mock wallet client
const mockWalletClient = createMockWalletClient({
  writeContract: jest.fn(() => Promise.resolve(MOCK_HASHES.TRANSACTION)),
  account: {
    address: MOCK_ADDRESSES.GAME_MASTER,
  },
});

describe("GameMaster", () => {
  let gameMaster: GameMaster;

  beforeEach(() => {
    jest.clearAllMocks();
    gameMaster = new GameMaster({
      EIP712name: "TestGame",
      EIP712Version: "1.0.0",
      instanceAddress: MOCK_ADDRESSES.INSTANCE,
      walletClient: mockWalletClient as WalletClient,
      publicClient: mockPublicClient as PublicClient,
      chainId: 1,
      encryptionCallback: jest.fn((data: string) => Promise.resolve("encrypted_" + data)),
      decryptionCallback: jest.fn((data: string) =>
        Promise.resolve(data === "encrypted_test_proposal" ? "test_proposal" : data.split("_")[1])
      ),
      randomnessCallback: jest.fn(() => Promise.resolve(0.1)),
      turnSaltCallback: jest.fn(() => Promise.resolve("0x123" as Hex)),
    });
  });

  describe("decryptProposals", () => {
    it("should decrypt proposals for a game turn", async () => {
      const mockEvents = [
        {
          address: MOCK_ADDRESSES.INSTANCE,
          blockHash: MOCK_HASHES.BLOCK,
          blockNumber: 1000n,
          data: "0x" as const,
          logIndex: 0,
          transactionHash: MOCK_HASHES.TRANSACTION,
          transactionIndex: 0,
          removed: false,
          topics: [] as [`0x${string}`, ...`0x${string}`[]] | [],
          args: {
            proposalEncryptedByGM: "encrypted_test_proposal",
            proposer: MOCK_ADDRESSES.PLAYER,
            gameId: 1n,
            turn: 1n,
          },
        },
      ];
      mockGetContractEvents.mockResolvedValueOnce(mockEvents);

      const result = await gameMaster.decryptProposals({
        instanceAddress: MOCK_ADDRESSES.INSTANCE,
        gameId: 1n,
        turn: 1n,
      });
      expect(result).toEqual([
        {
          proposer: MOCK_ADDRESSES.PLAYER,
          proposal: "test_proposal",
        },
      ]);
    });

    it("should return empty array when no proposals exist", async () => {
      mockGetContractEvents.mockResolvedValueOnce([]);
      const result = await gameMaster.decryptProposals({
        instanceAddress: MOCK_ADDRESSES.INSTANCE,
        gameId: 1n,
        turn: 1n,
      });
      expect(result).toEqual([]);
    });
  });

  describe("shuffle", () => {
    it("should shuffle an array", async () => {
      const array = [1, 2, 3, 4, 5];
      const result = await gameMaster.shuffle(array);
      expect(result).toHaveLength(array.length);
      expect(result).toEqual(expect.arrayContaining(array));
      expect(result).toEqual([2, 3, 4, 5, 1]);
    });
  });
});
