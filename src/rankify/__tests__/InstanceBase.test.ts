import { describe, expect, it, jest } from "@jest/globals";
import { type PublicClient, type GetContractEventsReturnType, type Hex } from "viem";
import InstanceBase from "../InstanceBase";
import { MOCK_ADDRESSES, MOCK_HASHES, createMockEnvioClient, createMockPublicClient } from "../../utils/mockUtils";
const mockEnvioClient = createMockEnvioClient();
// Mock viem
jest.mock("viem", () => ({
  ...(jest.requireActual("viem") as object),
  getContract: jest.fn(),
  createPublicClient: jest.fn(),
  http: jest.fn(),
}));

type MockReadContractReturnType =
  | bigint
  | boolean
  | readonly [`0x${string}`, bigint, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, string, string]
  | { gamePhase: bigint; maxPlayerCnt: bigint; players: `0x${string}`[]; currentTurn: bigint }
  | {
      contractAddresses: `0x${string}`[];
      functionSelectors: `0x${string}`[];
      args: unknown[];
      contractIds: bigint[];
      contractTypes: bigint[];
    }
  | readonly [`0x${string}`[], bigint[]]
  | `0x${string}`[]
  | {
      gamePhase: bigint;
      maxPlayerCnt: bigint;
      players: `0x${string}`[];
      currentTurn: bigint;
      hasEnded: boolean;
      isOvertime: boolean;
      startedAt: bigint;
      registrationOpenAt: bigint;
      createdBy: `0x${string}`;
      timePerTurn: bigint;
      timeToJoin: bigint;
      turnStartedAt: bigint;
      maxTurns: bigint;
    };

// Create mock functions with correct return types
const mockReadContract = jest.fn((): Promise<MockReadContractReturnType> => Promise.resolve(0n));
const mockGetContractEvents = jest.fn(() => Promise.resolve([] as GetContractEventsReturnType));

// Mock public client
const mockPublicClient = createMockPublicClient({
  readContract: mockReadContract,
  getContractEvents: mockGetContractEvents,
});

describe("InstanceBase", () => {
  const instance = new InstanceBase({
    publicClient: mockPublicClient as PublicClient,
    chainId: 1,
    instanceAddress: MOCK_ADDRESSES.INSTANCE,
    envioClient: mockEnvioClient,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getEIP712Domain", () => {
    it("should return EIP712 domain data", async () => {
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
        MOCK_HASHES.TRANSACTION,
        1n,
        MOCK_ADDRESSES.INSTANCE,
        MOCK_HASHES.TRANSACTION,
        MOCK_HASHES.BLOCK,
        MOCK_HASHES.TRANSACTION,
        "TestContract",
        "1",
      ];

      mockReadContract.mockResolvedValueOnce(mockDomainData);

      const result = await instance.getEIP712Domain();

      expect(result).toEqual({
        domainSeparator: mockDomainData[0],
        chainId: mockDomainData[1],
        verifierContract: mockDomainData[2],
        hashedName: mockDomainData[3],
        hashedVersion: mockDomainData[4],
        typeHash: mockDomainData[5],
        name: mockDomainData[6],
        version: mockDomainData[7],
      });

      expect(mockReadContract).toHaveBeenCalledWith({
        address: instance.instanceAddress,
        abi: expect.any(Array),
        functionName: "inspectEIP712Hashes",
      });
    });

    it("should handle errors", async () => {
      mockReadContract.mockRejectedValueOnce(new Error("Contract call failed"));
      await expect(instance.getEIP712Domain()).rejects.toThrow("Contract call failed");
    });
  });

  describe("pkdf", () => {
    it("should generate a deterministic hash based on input parameters", () => {
      const result = instance.pkdf({
        privateKey: MOCK_HASHES.TRANSACTION,
        turn: 1n,
        gameId: 1n,
        contractAddress: MOCK_ADDRESSES.INSTANCE,
        chainId: 1,
        scope: "turnSalt",
      });

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
      expect(result.startsWith("0x")).toBe(true);
    });
  });

  describe("sharedSigner", () => {
    it("should generate a shared signer key", () => {
      // Test vectors from secp256k1 test suite (without 0x prefix)
      const privateKey = "0000000000000000000000000000000000000000000000000000000000000001";
      const publicKey = "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";

      const result = instance.sharedSigner({
        privateKey: `0x${privateKey}` as Hex,
        publicKey: `0x${publicKey}` as Hex,
        gameId: 1n,
        turn: 1n,
        contractAddress: MOCK_ADDRESSES.INSTANCE,
        chainId: 1,
      });

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
      expect(result.startsWith("0x")).toBe(true);
      expect(result.length).toBe(66); // 32 bytes hex + "0x" prefix
    });
  });

  describe("getGameStateDetails", () => {
    it("should fetch game state details", async () => {
      const mockGameState = {
        gamePhase: 1n,
        maxPlayerCnt: 5n,
        players: [MOCK_ADDRESSES.PLAYER],
        currentTurn: 1n,
        hasEnded: false,
        isOvertime: false,
        startedAt: 0n,
        registrationOpenAt: 1n,
        createdBy: MOCK_ADDRESSES.PLAYER,
        timePerTurn: 3600n,
        timeToJoin: 3600n,
        turnStartedAt: 0n,
        maxTurns: 10n,
      };

      // Mock all the required contract calls
      mockReadContract
        .mockResolvedValueOnce({
          contractAddresses: [],
          functionSelectors: [],
          args: [],
          contractIds: [],
          contractTypes: [],
        })
        .mockResolvedValueOnce([[], []] as [`0x${string}`[], bigint[]])
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce([MOCK_ADDRESSES.PLAYER])
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(mockGameState);

      const result = await instance.getGameStateDetails(1n);

      expect(result).toMatchObject({
        isOpen: true,
        players: [MOCK_ADDRESSES.PLAYER],
        joinRequirements: {
          contractAddresses: [],
          functionSelectors: [],
          args: [],
          contractIds: [],
          contractTypes: [],
        },
      });
    });
  });
});
