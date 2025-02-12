import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { type PublicClient, type WalletClient, type GetContractEventsReturnType, type Hex } from "viem";
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
const mockReadContract = jest.fn(
  (): Promise<
    | bigint
    | readonly [`0x${string}`, bigint, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, string, string]
  > => Promise.resolve(0n)
);
const mockSimulateContract = jest.fn(() => Promise.resolve({ request: {} }));
const mockGetContractEvents = jest.fn(() => Promise.resolve([] as GetContractEventsReturnType));

// Mock public client
const mockPublicClient = createMockPublicClient({
  readContract: mockReadContract,
  simulateContract: mockSimulateContract,
  getContractEvents: mockGetContractEvents,
});

const mockSignTypedData = jest.fn(() => Promise.resolve("0x123" as `0x${string}`));
// Mock wallet client
const mockWalletClient = createMockWalletClient({
  writeContract: jest.fn(() => Promise.resolve(MOCK_HASHES.TRANSACTION)),
  account: {
    address: MOCK_ADDRESSES.GAME_MASTER,
  },
  signTypedData: mockSignTypedData,
});

describe("GameMaster", () => {
  let gameMaster: GameMaster;

  beforeEach(() => {
    jest.clearAllMocks();
    gameMaster = new GameMaster({
      walletClient: mockWalletClient as WalletClient,
      publicClient: mockPublicClient as PublicClient,
      chainId: 1,
      encryptionCallback: jest.fn((data: string) => Promise.resolve("encrypted_" + data)),
      decryptionCallback: jest.fn((data: string) => {
        return Promise.resolve(data === "encrypted_test_proposal" ? "test_proposal" : data.split("_")[1]);
      }),
      randomnessCallback: jest.fn(() => Promise.resolve(0.1)),
      turnSaltCallback: jest.fn(() => Promise.resolve("0x123" as `0x${string}`)),
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

  describe("signJoiningGame", () => {
    it("should sign joining game event", async () => {
      const mockDomainData: readonly [
        `0x${string}`,
        bigint,
        `0x${string}`,
        `0x${string}`,
        `0x${string}`,
        `0x${string}`,
        string,
        string,
      ] = [
        "0x1234567890123456789012345678901234567890123456789012345678901234", // domainSeparator
        1n, // chainId
        "0x2345678901234567890123456789012345678901", // verifierContract
        "0x3456789012345678901234567890123456789012345678901234567890123456", // hashedName
        "0x4567890123456789012345678901234567890123456789012345678901234567", // hashedVersion
        "0x5678901234567890123456789012345678901234567890123456789012345678", // typeHash
        "TestContract", // name
        "1", // version
      ];

      mockSignTypedData.mockResolvedValueOnce("0xsignedMessage" as `0x${string}`);

      mockReadContract.mockResolvedValueOnce(mockDomainData);

      // Mock signTypedData on walletClient
      const mockSignature = "0xsignedMessage" as `0x${string}`;
      //const mockSignTypedData = jest.fn<Promise<`0x${string}`>, [any]>().mockResolvedValue(mockSignature);

      const gameMasterWithMockedWallet = new GameMaster({
        walletClient: mockWalletClient,
        publicClient: mockPublicClient as PublicClient,
        chainId: 1,
        encryptionCallback: jest.fn((data: string) => Promise.resolve("encrypted_" + data)),
        decryptionCallback: jest.fn((data: string) => {
          return Promise.resolve(data === "encrypted_test_proposal" ? "test_proposal" : data.split("_")[1]);
        }),
        randomnessCallback: jest.fn(() => Promise.resolve(0.1)),
        turnSaltCallback: jest.fn(() => Promise.resolve("0x123" as `0x${string}`)),
      });

      const result = await gameMasterWithMockedWallet.signJoiningGame({
        gameId: 1n,
        participant: MOCK_ADDRESSES.PLAYER,
        instanceAddress: MOCK_ADDRESSES.INSTANCE,
      });

      // Verify readContract was called with correct parameters
      expect(mockReadContract).toHaveBeenCalledWith({
        address: MOCK_ADDRESSES.INSTANCE,
        abi: expect.any(Array),
        functionName: "inspectEIP712Hashes",
      });

      // Verify the signature was called with correct parameters
      expect(mockSignTypedData).toHaveBeenCalledWith({
        domain: {
          name: mockDomainData[6],
          version: mockDomainData[7],
          chainId: Number(mockDomainData[1]),
          verifyingContract: MOCK_ADDRESSES.INSTANCE,
        },
        types: {
          AttestJoiningGame: [
            { type: "address", name: "instance" },
            { type: "address", name: "participant" },
            { type: "uint256", name: "gameId" },
            { type: "bytes32", name: "gmCommitment" },
          ],
        },
        primaryType: "AttestJoiningGame",
        message: {
          instance: MOCK_ADDRESSES.INSTANCE,
          participant: MOCK_ADDRESSES.PLAYER,
          gameId: 1n,
          gmCommitment: expect.any(String), // Since this is generated using stringToHex
        },
        account: MOCK_ADDRESSES.PLAYER,
      });

      // Verify the return value
      expect(result).toEqual({
        signature: mockSignature,
        gmCommitment: expect.any(String),
      });
    });
  });
});
