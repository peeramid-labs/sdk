import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { type PublicClient, type WalletClient, type GetContractEventsReturnType, type Hex, type Log } from "viem";
import { GameMaster } from "../GameMaster";
import { MOCK_ADDRESSES, MOCK_HASHES, createMockPublicClient, createMockWalletClient } from "../../__tests__/utils";
import { gameStatusEnum } from "../types";
import aes from "crypto-js/aes";
import { RankifyDiamondInstanceAbi } from "../../abis";
import InstanceBase from "../InstanceBase";

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

// Mock InstanceBase
const mockSharedSigner = jest.fn().mockImplementation(() => "0x0123456789abcdef" as Hex);
const mockGetPlayerPubKey = jest.fn().mockImplementation(async () => `0x${mockPublicKey}` as Hex);

jest.mock("../InstanceBase", () => {
  return {
    __esModule: true,
    default: jest.fn(() => ({
      sharedSigner: mockSharedSigner,
      getPlayerPubKey: mockGetPlayerPubKey,
    })),
  };
});

// Create mock functions with correct return types
const mockReadContract = jest.fn(
  (): Promise<
    | bigint
    | readonly [`0x${string}`, bigint, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, string, string]
    | {
        gamePhase: gameStatusEnum;
        maxPlayerCnt: bigint;
        players: readonly `0x${string}`[];
        currentTurn?: bigint;
        hasEnded?: boolean;
        isOvertime?: boolean;
        startedAt?: bigint;
        registrationOpenAt?: bigint;
        createdBy?: `0x${string}`;
        timePerTurn?: bigint;
        timeToJoin?: bigint;
        turnStartedAt?: bigint;
        maxTurns?: bigint;
      }
    | {
        contractAddresses: readonly `0x${string}`[];
        functionSelectors: readonly `0x${string}`[];
        args: readonly unknown[];
        contractIds: readonly bigint[];
        contractTypes: readonly bigint[];
      }
    | readonly [readonly `0x${string}`[], readonly bigint[]]
    | boolean
    | readonly `0x${string}`[]
  > => Promise.resolve(0n)
);
const mockSimulateContract = jest.fn(() => Promise.resolve({ request: {} }));
const mockGetContractEvents = jest.fn(() => Promise.resolve([] as GetContractEventsReturnType));
const mockGetCode = jest.fn(() => Promise.resolve("0x1234" as Hex));

// Mock public client
const mockPublicClient = createMockPublicClient({
  readContract: mockReadContract,
  simulateContract: mockSimulateContract,
  getContractEvents: mockGetContractEvents,
  getCode: mockGetCode,
});

const mockSignTypedData = jest.fn(() => Promise.resolve("0x123" as `0x${string}`));
const mockSignMessage = jest.fn(() => Promise.resolve("0x123" as `0x${string}`));
// Mock wallet client
const mockWalletClient = createMockWalletClient({
  writeContract: jest.fn(() => Promise.resolve(MOCK_HASHES.TRANSACTION)),
  account: {
    address: MOCK_ADDRESSES.GAME_MASTER,
  },
  signTypedData: mockSignTypedData,
  signMessage: mockSignMessage,
});

// Test vectors from secp256k1 test suite
const mockPrivateKey = "0000000000000000000000000000000000000000000000000000000000000001";
const mockPublicKey = "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";

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
            encryptedProposal: "encrypted_test_proposal",
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
        participantPubKeyHash: "0x1234567890123456789012345678901234567890123456789012345678901234" as Hex,
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
            { type: "address", name: "participant" },
            { type: "uint256", name: "gameId" },
            { type: "bytes32", name: "gmCommitment" },
            { type: "uint256", name: "deadline" },
            { type: "bytes32", name: "participantPubKeyHash" },
          ],
        },
        primaryType: "AttestJoiningGame",
        message: expect.objectContaining({
          participant: MOCK_ADDRESSES.PLAYER,
          gameId: 1n,
          gmCommitment: expect.any(String),
          deadline: expect.any(BigInt),
          participantPubKeyHash: "0x1234567890123456789012345678901234567890123456789012345678901234",
        }),
        account: {
          address: MOCK_ADDRESSES.GAME_MASTER,
        },
      });

      // Verify the return value
      expect(result).toEqual({
        signature: mockSignature,
        gmCommitment: expect.any(String),
        deadline: expect.any(BigInt),
      });
    });
  });

  describe("validateJoinGame", () => {
    it("should validate a valid join game request", async () => {
      const mockGameState = {
        gamePhase: gameStatusEnum.open,
        maxPlayerCnt: 5n,
        players: [],
        joinRequirements: {
          contractAddresses: [] as readonly `0x${string}`[],
          functionSelectors: [] as readonly `0x${string}`[],
          args: [] as readonly unknown[],
          contractIds: [] as readonly bigint[],
          contractTypes: [] as readonly bigint[],
        },
      };

      mockReadContract
        .mockResolvedValueOnce({
          contractAddresses: [] as readonly `0x${string}`[],
          functionSelectors: [] as readonly `0x${string}`[],
          args: [] as readonly unknown[],
          contractIds: [] as readonly bigint[],
          contractTypes: [] as readonly bigint[],
        })
        .mockResolvedValueOnce([[], []] as [readonly `0x${string}`[], readonly bigint[]])
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(mockGameState);

      const result = await gameMaster.validateJoinGame({
        gameId: 1n,
        participant: MOCK_ADDRESSES.PLAYER,
        instanceAddress: MOCK_ADDRESSES.INSTANCE,
      });

      expect(result).toEqual({
        result: true,
        errorMessage: "",
      });
    });

    it("should reject when game is not open", async () => {
      const mockGameState = {
        gamePhase: gameStatusEnum.started,
        maxPlayerCnt: 5n,
        players: [],
        joinRequirements: {
          contractAddresses: [] as readonly `0x${string}`[],
          functionSelectors: [] as readonly `0x${string}`[],
          args: [] as readonly unknown[],
          contractIds: [] as readonly bigint[],
          contractTypes: [] as readonly bigint[],
        },
      };

      mockReadContract
        .mockResolvedValueOnce({
          contractAddresses: [] as readonly `0x${string}`[],
          functionSelectors: [] as readonly `0x${string}`[],
          args: [] as readonly unknown[],
          contractIds: [] as readonly bigint[],
          contractTypes: [] as readonly bigint[],
        })
        .mockResolvedValueOnce([[], []] as [readonly `0x${string}`[], readonly bigint[]])
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(mockGameState);

      const result = await gameMaster.validateJoinGame({
        gameId: 1n,
        participant: MOCK_ADDRESSES.PLAYER,
        instanceAddress: MOCK_ADDRESSES.INSTANCE,
      });

      expect(result).toEqual({
        result: false,
        errorMessage: "Game is not open for registration",
      });
    });

    it("should reject when game is full", async () => {
      const mockGameState = {
        gamePhase: gameStatusEnum.open,
        maxPlayerCnt: 2n,
        players: [MOCK_ADDRESSES.PLAYER, MOCK_ADDRESSES.GAME_MASTER],
        joinRequirements: {
          contractAddresses: [] as readonly `0x${string}`[],
          functionSelectors: [] as readonly `0x${string}`[],
          args: [] as readonly unknown[],
          contractIds: [] as readonly bigint[],
          contractTypes: [] as readonly bigint[],
        },
      };

      mockReadContract
        .mockResolvedValueOnce({
          contractAddresses: [] as readonly `0x${string}`[],
          functionSelectors: [] as readonly `0x${string}`[],
          args: [] as readonly unknown[],
          contractIds: [] as readonly bigint[],
          contractTypes: [] as readonly bigint[],
        })
        .mockResolvedValueOnce([[], []] as [readonly `0x${string}`[], readonly bigint[]])
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce([MOCK_ADDRESSES.PLAYER, MOCK_ADDRESSES.GAME_MASTER])
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(mockGameState);

      const result = await gameMaster.validateJoinGame({
        gameId: 1n,
        participant: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        instanceAddress: MOCK_ADDRESSES.INSTANCE,
      });

      expect(result).toEqual({
        result: false,
        errorMessage: "Game is already full",
      });
    });

    it("should reject when player is already registered", async () => {
      const mockGameState = {
        gamePhase: gameStatusEnum.open,
        maxPlayerCnt: 5n,
        players: [MOCK_ADDRESSES.PLAYER],
        joinRequirements: {
          contractAddresses: [] as readonly `0x${string}`[],
          functionSelectors: [] as readonly `0x${string}`[],
          args: [] as readonly unknown[],
          contractIds: [] as readonly bigint[],
          contractTypes: [] as readonly bigint[],
        },
      };

      mockReadContract
        .mockResolvedValueOnce({
          contractAddresses: [] as readonly `0x${string}`[],
          functionSelectors: [] as readonly `0x${string}`[],
          args: [] as readonly unknown[],
          contractIds: [] as readonly bigint[],
          contractTypes: [] as readonly bigint[],
        })
        .mockResolvedValueOnce([[], []] as [readonly `0x${string}`[], readonly bigint[]])
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce([MOCK_ADDRESSES.PLAYER])
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(mockGameState);

      const result = await gameMaster.validateJoinGame({
        gameId: 1n,
        participant: MOCK_ADDRESSES.PLAYER,
        instanceAddress: MOCK_ADDRESSES.INSTANCE,
      });

      expect(result).toEqual({
        result: false,
        errorMessage: "Player already registered",
      });
    });
  });

  describe("attestProposal", () => {
    it("should attest a proposal correctly", async () => {
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

      mockReadContract.mockResolvedValueOnce(mockDomainData);
      mockSignTypedData.mockResolvedValueOnce("0xsignedProposal" as `0x${string}`);

      const result = await gameMaster.attestProposal({
        instanceAddress: MOCK_ADDRESSES.INSTANCE,
        gameId: 1n,
        proposal: "test_proposal",
        proposerPubKey: "0x0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798" as Hex,
        turn: 1n,
      });

      expect(result).toMatchObject({
        submissionParams: {
          gameId: 1n,
          encryptedProposal: expect.any(String),
          commitment: expect.any(BigInt),
          proposer: expect.any(String),
          gmSignature: "0xsignedProposal",
        },
        proposal: "test_proposal",
        proposerAddress: expect.any(String),
        proposalValue: expect.any(BigInt),
        randomnessValue: expect.any(BigInt),
      });

      // Verify the signature was called with correct parameters
      expect(mockSignTypedData).toHaveBeenCalledWith({
        domain: {
          name: mockDomainData[6],
          version: mockDomainData[7],
          chainId: 1,
          verifyingContract: MOCK_ADDRESSES.INSTANCE,
        },
        types: {
          SubmitProposal: [
            { type: "uint256", name: "gameId" },
            { type: "address", name: "proposer" },
            { type: "string", name: "encryptedProposal" },
            { type: "uint256", name: "commitment" },
          ],
        },
        primaryType: "SubmitProposal",
        message: expect.objectContaining({
          gameId: 1n,
          proposer: expect.any(String),
          encryptedProposal: expect.any(String),
          commitment: expect.any(BigInt),
        }),
        account: {
          address: MOCK_ADDRESSES.GAME_MASTER,
        },
      });
    });

    it("should throw error when wallet client has no account", async () => {
      const gameMasterWithoutAccount = new GameMaster({
        walletClient: { ...mockWalletClient, account: undefined } as WalletClient,
        publicClient: mockPublicClient as PublicClient,
        chainId: 1,
        encryptionCallback: jest.fn(() => Promise.resolve("encrypted_test")),
        decryptionCallback: jest.fn(() => Promise.resolve("decrypted_test")),
        randomnessCallback: jest.fn(() => Promise.resolve(0.5)),
        turnSaltCallback: jest.fn(() => Promise.resolve("0x123" as `0x${string}`)),
      });

      await expect(
        gameMasterWithoutAccount.attestProposal({
          instanceAddress: MOCK_ADDRESSES.INSTANCE,
          gameId: 1n,
          proposal: "test_proposal",
          proposerPubKey: "0x0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798" as Hex,
          turn: 1n,
        })
      ).rejects.toThrow("No account");
    });
  });

  describe("sharedSigner", () => {
    it("should generate a shared signer key correctly", async () => {
      // Test vectors from secp256k1 test suite (without 0x prefix)
      const privateKey = "0000000000000000000000000000000000000000000000000000000000000001";
      const publicKey = "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
      const gameId = 1n;
      const turn = 1n;

      const instance = new InstanceBase({
        publicClient: mockPublicClient as PublicClient,
        chainId: 1,
        instanceAddress: MOCK_ADDRESSES.INSTANCE,
      });

      const result = instance.sharedSigner({
        privateKey: `0x${privateKey}` as Hex,
        publicKey: `0x${publicKey}` as Hex,
        gameId,
        turn,
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
    it("should fetch complete game state details", async () => {
      const mockGameState = {
        gamePhase: gameStatusEnum.open,
        maxPlayerCnt: 5n,
        players: [MOCK_ADDRESSES.PLAYER] as readonly `0x${string}`[],
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
          contractAddresses: [] as readonly `0x${string}`[],
          functionSelectors: [] as readonly `0x${string}`[],
          args: [] as readonly unknown[],
          contractIds: [] as readonly bigint[],
          contractTypes: [] as readonly bigint[],
        }) // joinRequirements
        .mockResolvedValueOnce([[], []] as [readonly `0x${string}`[], readonly bigint[]]) // ongoingScores
        .mockResolvedValueOnce(false) // isLastTurn
        .mockResolvedValueOnce([MOCK_ADDRESSES.PLAYER] as readonly `0x${string}`[]) // players
        .mockResolvedValueOnce(true) // canStart
        .mockResolvedValueOnce(mockGameState); // state

      const instance = new InstanceBase({
        publicClient: mockPublicClient as PublicClient,
        chainId: 1,
        instanceAddress: MOCK_ADDRESSES.INSTANCE,
      });

      const result = await instance.getGameStateDetails(1n);

      expect(result).toMatchObject({
        joinRequirements: {
          contractAddresses: [],
          functionSelectors: [],
          args: [],
          contractIds: [],
          contractTypes: [],
        },
        isOpen: true,
        currentPhaseTimeoutAt: expect.any(BigInt),
        ...mockGameState,
      });

      expect(mockReadContract).toHaveBeenCalledTimes(6);
    });

    it("should handle game over state correctly", async () => {
      const mockGameState = {
        gamePhase: gameStatusEnum.finished,
        maxPlayerCnt: 5n,
        players: [MOCK_ADDRESSES.PLAYER] as readonly `0x${string}`[],
        currentTurn: 10n,
        hasEnded: true,
        isOvertime: false,
        startedAt: 1000n,
        registrationOpenAt: 1n,
        createdBy: MOCK_ADDRESSES.PLAYER,
        timePerTurn: 3600n,
        timeToJoin: 3600n,
        turnStartedAt: 2000n,
        maxTurns: 10n,
      };

      const mockGameOverEvent = [
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
            players: [MOCK_ADDRESSES.PLAYER],
            scores: [100n],
          },
        },
      ];

      mockReadContract
        .mockResolvedValueOnce({
          contractAddresses: [] as readonly `0x${string}`[],
          functionSelectors: [] as readonly `0x${string}`[],
          args: [] as readonly unknown[],
          contractIds: [] as readonly bigint[],
          contractTypes: [] as readonly bigint[],
        })
        .mockResolvedValueOnce([[], []] as [readonly `0x${string}`[], readonly bigint[]])
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce([MOCK_ADDRESSES.PLAYER] as readonly `0x${string}`[])
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(mockGameState);

      mockGetContractEvents.mockResolvedValueOnce(mockGameOverEvent);

      const instance = new InstanceBase({
        publicClient: mockPublicClient as PublicClient,
        chainId: 1,
        instanceAddress: MOCK_ADDRESSES.INSTANCE,
      });

      const result = await instance.getGameStateDetails(1n);

      expect(result).toMatchObject({
        scores: [[MOCK_ADDRESSES.PLAYER], [100n]],
        ...mockGameState,
      });
    });

    it("should handle errors gracefully", async () => {
      mockReadContract.mockRejectedValueOnce(new Error("Contract call failed"));

      const instance = new InstanceBase({
        publicClient: mockPublicClient as PublicClient,
        chainId: 1,
        instanceAddress: MOCK_ADDRESSES.INSTANCE,
      });

      await expect(instance.getGameStateDetails(1n)).rejects.toThrow("Contract call failed");
    });
  });

  describe("decryptTurnVotes", () => {
    it("should decrypt turn votes correctly", async () => {
      // Mock the game key and shared signer calculation
      const mockGameKey = `0x${mockPrivateKey}` as Hex;
      const mockSharedKey = "0x0123456789abcdef" as Hex;
      jest.spyOn(gameMaster, "gameKey").mockResolvedValue(mockGameKey);
      // eslint-disable-next-line
      jest.spyOn(gameMaster as any, "calculateSharedTurnKey").mockResolvedValue(mockSharedKey);

      // Create encrypted ballot using the same encryption method as the actual implementation
      const encryptedBallot = aes.encrypt(JSON.stringify(["1", "2", "3"]), mockSharedKey).toString();

      // Mock VoteSubmitted events
      mockGetContractEvents.mockResolvedValueOnce([
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
            player: MOCK_ADDRESSES.PLAYER,
            sealedBallotId: encryptedBallot,
            gameId: 1n,
            turn: 1n,
          },
        } as Log<bigint, number, false>,
      ]);

      const result = await gameMaster.decryptTurnVotes({
        instanceAddress: MOCK_ADDRESSES.INSTANCE,
        gameId: 1n,
        turn: 1n,
      });

      expect(mockGetContractEvents).toHaveBeenCalledWith({
        address: MOCK_ADDRESSES.INSTANCE,
        abi: RankifyDiamondInstanceAbi,
        eventName: "VoteSubmitted",
        args: { gameId: 1n, turn: 1n },
      });

      expect(result).toEqual([
        {
          player: MOCK_ADDRESSES.PLAYER,
          votes: [1n, 2n, 3n],
        },
      ]);
    });

    it("should return empty array when no votes exist", async () => {
      mockGetContractEvents.mockResolvedValueOnce([]);
      mockGetContractEvents.mockResolvedValueOnce([]);

      const result = await gameMaster.decryptTurnVotes({
        instanceAddress: MOCK_ADDRESSES.INSTANCE,
        gameId: 1n,
        turn: 1n,
      });

      expect(result).toEqual([]);
    });

    it("should handle decryption errors gracefully", async () => {
      // Mock the game key and shared signer calculation
      const mockGameKey = `0x${mockPrivateKey}` as Hex;
      const mockSharedKey = "wrong_key" as Hex;
      jest.spyOn(gameMaster, "gameKey").mockResolvedValue(mockGameKey);
      // eslint-disable-next-line
      jest.spyOn(gameMaster as any, "calculateSharedTurnKey").mockResolvedValue(mockSharedKey);

      // Create an invalid encrypted ballot that will fail decryption
      const invalidEncryptedBallot = "U2FsdGVkX19pbnZhbGlkIGpzb24gZGF0YQ==";
      const mockVoteEvents = [
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
            player: MOCK_ADDRESSES.PLAYER,
            sealedBallotId: invalidEncryptedBallot,
            gameId: 1n,
            turn: 1n,
          },
        } as Log<bigint, number, false>,
      ];
      mockGetContractEvents.mockReset();
      mockGetContractEvents.mockResolvedValueOnce(mockVoteEvents);

      // The decryption should fail and throw an error
      await expect(
        gameMaster.decryptTurnVotes({
          instanceAddress: MOCK_ADDRESSES.INSTANCE,
          gameId: 1n,
          turn: 1n,
        })
      ).rejects.toThrow("Failed to decrypt vote");
    });
  });
});
