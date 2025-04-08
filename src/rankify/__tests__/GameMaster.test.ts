import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import {
  type PublicClient,
  type WalletClient,
  type GetContractEventsReturnType,
  type Hex,
  type Log,
  type Address,
} from "viem";
import { MOCK_ADDRESSES, MOCK_HASHES, createMockPublicClient, createMockWalletClient } from "../../__tests__/utils";
import { gameStatusEnum } from "../../types";
import aes from "crypto-js/aes";
import { RankifyDiamondInstanceAbi } from "../../abis";
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
// Test vectors from secp256k1 test suite
const mockPrivateKey = "0000000000000000000000000000000000000000000000000000000000000001";

const mockPublicKey = "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
const mockSharedSigner = jest.fn().mockImplementation(() => "0x0123456789abcdef" as Hex);
const mockGetPlayerPubKey = jest.fn().mockImplementation(async () => `0x${mockPublicKey}` as Hex);
jest.mock("../InstanceBase", () => {
  return {
    __esModule: true,
    default: MockInstanceBase,
  };
});

class MockInstanceBase {
  sharedSigner = mockSharedSigner;
  getPlayerPubKey = mockGetPlayerPubKey;
}

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

import InstanceBase from "../InstanceBase";
import { GameMaster } from "../GameMaster";
import { publicKeyToAddress } from "viem/accounts";

describe("GameMaster", () => {
  let gameMaster: GameMaster;

  beforeEach(() => {
    jest.clearAllMocks();
    gameMaster = new GameMaster({
      walletClient: mockWalletClient as WalletClient,
      publicClient: mockPublicClient as PublicClient,
      chainId: 1,
    });
  });

  describe("decryptProposals", () => {
    it("should decrypt proposals for a game turn in default", async () => {
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
            encryptedProposal: await gameMaster
              .encryptProposal({
                proposal: "test_proposal",
                turn: 1n,
                instanceAddress: MOCK_ADDRESSES.INSTANCE,
                gameId: 1n,
                proposerPubKey: ("0x" + mockPublicKey) as Hex,
              })
              .then((encryptedProposal) => encryptedProposal.encryptedProposal),
            proposer: publicKeyToAddress(`0x${mockPublicKey}`) as Hex as Address,
            gameId: 1n,
            turn: 1n,
          },
        },
      ];

      //mock join game events for the players
      const joinGameEvent = {
        address: MOCK_ADDRESSES.INSTANCE,
        blockHash: MOCK_HASHES.BLOCK,
        blockNumber: 1n,
        transactionIndex: 0,
        logIndex: 0,
        transactionHash: MOCK_HASHES.TRANSACTION,
        data: "0x" as const,
        args: {
          player: MOCK_ADDRESSES.PLAYER,
          voterPubKey: ("0x" + mockPublicKey) as Hex,
        },
      };
      // eslint-disable-next-line
      mockGetContractEvents.mockResolvedValueOnce(mockEvents);

      // eslint-disable-next-line
      mockGetContractEvents.mockResolvedValueOnce([joinGameEvent] as any);
      

      const result = await gameMaster.decryptProposals({
        instanceAddress: MOCK_ADDRESSES.INSTANCE,
        gameId: 1n,
        turn: 1n,
        players: [MOCK_ADDRESSES.PROPOSER],
      });

      expect(result).toEqual([
        {
          proposer: publicKeyToAddress(`0x${mockPublicKey}`) as Hex as Address,
          proposal: "test_proposal",
        },
      ]);


      const resultPadded = await gameMaster.decryptProposals({
        instanceAddress: MOCK_ADDRESSES.INSTANCE,
        gameId: 1n,
        turn: 1n,
        players: [MOCK_ADDRESSES.PROPOSER],
        padToMaxSize: true
      });

      expect(resultPadded.length).toEqual(15);

      mockGetContractEvents.mockClear();
    });

    it("should return array item element for each player even if he didn't propose", async () => {
      mockGetContractEvents.mockResolvedValueOnce([]);
      const result = await gameMaster.decryptProposals({
        instanceAddress: MOCK_ADDRESSES.INSTANCE,
        gameId: 1n,
        turn: 1n,
        players: [MOCK_ADDRESSES.PROPOSER],
      });
      expect(result.length).toEqual(1);
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

  describe("proposals integrity", () => {
    it("should generate valid proposals integrity with real zkit proofs and verify permutations", async () => {
      // Test with 3 proposals to keep test runtime reasonable
      const testProposals = [
        { proposal: "proposal1", proposer: MOCK_ADDRESSES.PLAYER },
        { proposal: "proposal2", proposer: MOCK_ADDRESSES.GAME_MASTER },
        { proposal: "proposal3", proposer: "0x3456789012345678901234567890123456789012" as Address },
      ];

      //mock join game events for the players
      const joinGameEvents = testProposals.map((p) => ({
        address: MOCK_ADDRESSES.INSTANCE,
        blockHash: MOCK_HASHES.BLOCK,
        blockNumber: 1n,
        transactionIndex: 0,
        logIndex: 0,
        transactionHash: MOCK_HASHES.TRANSACTION,
        data: "0x" as const,
        args: {
          player: p.proposer,
          voterPubKey: "0x0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798" as Hex,
        },
      }));
      // eslint-disable-next-line
      mockGetContractEvents.mockImplementationOnce(() => Promise.resolve([joinGameEvents[0]] as any));
      // eslint-disable-next-line
      mockGetContractEvents.mockImplementationOnce(() => Promise.resolve([joinGameEvents[1]] as any));
      // eslint-disable-next-line
      mockGetContractEvents.mockImplementationOnce(() => Promise.resolve([joinGameEvents[2]] as any));

      const result = await gameMaster.getProposalsIntegrity({
        size: 3,
        gameId: 1n,
        turn: 1n,
        verifierAddress: MOCK_ADDRESSES.INSTANCE,
        proposals: testProposals,
      });

      // Verify structure and types
      expect(result).toMatchObject({
        newProposals: {
          a: expect.any(Array),
          b: expect.any(Array),
          c: expect.any(Array),
          proposals: expect.any(Array),
          permutationCommitment: expect.any(BigInt),
        },
        permutation: expect.any(Array),
        proposalsNotPermuted: expect.any(Array),
        nullifier: expect.any(BigInt),
      });

      // Verify permutation properties
      expect(result.permutation).toHaveLength(15);
      expect(result.permutation.every((p) => typeof p === "bigint")).toBe(true);
      expect(new Set(result.permutation).size).toBe(15); // All elements should be unique

      // Test permuteArray matches the result
      const permutedByMethod = await gameMaster.permuteArray<string>({
        array: testProposals.map((p) => p.proposal) as string[],
        gameId: 1n,
        turn: 1n, // The permutation is generated with turn - 1n
        verifierAddress: MOCK_ADDRESSES.INSTANCE,
      });
      expect(permutedByMethod).toEqual(result.newProposals.proposals);

      // Test reversePermutation recovers original order
      const recoveredOrder = await gameMaster.reversePermutation<string>({
        permutedArray: result.newProposals.proposals as string[],
        gameId: 1n,
        turn: 1n, // The permutation is generated with turn - 1n
        verifierAddress: MOCK_ADDRESSES.INSTANCE,
      });
      expect(recoveredOrder).toEqual(testProposals.map((p) => p.proposal));

      // Verify proof structure
      expect(result.newProposals.a).toHaveLength(2); // Groth16 proof format
      expect(result.newProposals.b[0]).toHaveLength(2);
      expect(result.newProposals.b[1]).toHaveLength(2);
      expect(result.newProposals.c).toHaveLength(2);
    });

    it("should handle maximum number of proposals and verify permutations", async () => {
      // Test with max size (15 proposals)
      const maxProposals = Array.from({ length: 15 }, (_, i) => ({
        proposal: `proposal${i + 1}`,
        proposer: `0x${(i + 1).toString().padStart(40, "0")}` as Address,
      }));

      const joinGameEvents = maxProposals.map((p) => ({
        address: MOCK_ADDRESSES.INSTANCE,
        blockHash: MOCK_HASHES.BLOCK,
        blockNumber: 1n,
        transactionIndex: 0,
        logIndex: 0,
        transactionHash: MOCK_HASHES.TRANSACTION,
        data: "0x" as const,
        args: {
          player: p.proposer,
          voterPubKey: "0x0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798" as Hex,
        },
      }));

      // eslint-disable-next-line
      mockGetContractEvents.mockImplementation(() => Promise.resolve([joinGameEvents[0]] as any));

      const result = await gameMaster.getProposalsIntegrity({
        size: 15,
        gameId: 1n,
        turn: 1n,
        verifierAddress: MOCK_ADDRESSES.INSTANCE,
        proposals: maxProposals,
      });

      // Verify permutation size
      expect(result.permutation).toHaveLength(15);
      expect(new Set(result.permutation).size).toBe(15); // All elements should be unique

      // Test permuteArray matches the result
      const permutedByMethod = await gameMaster.permuteArray<string>({
        array: maxProposals.map((p) => p.proposal) as string[],
        gameId: 1n,
        turn: 1n, // The permutation is generated with turn - 1n
        verifierAddress: MOCK_ADDRESSES.INSTANCE,
      });
      expect(permutedByMethod).toEqual(result.newProposals.proposals);

      // Test reversePermutation recovers original order
      const recoveredOrder = await gameMaster.reversePermutation<string>({
        permutedArray: result.newProposals.proposals as string[],
        gameId: 1n,
        turn: 1n, // The permutation is generated with turn - 1n
        verifierAddress: MOCK_ADDRESSES.INSTANCE,
      });
      expect(recoveredOrder).toEqual(maxProposals.map((p) => p.proposal));

      // Verify that permuted proposals contain all original proposals
      const sortedOriginal = Array.from(maxProposals.map((p) => p.proposal)).sort();
      const sortedPermuted = Array.from(result.newProposals.proposals).sort();
      expect(sortedPermuted).toEqual(sortedOriginal);
    });

    it("should maintain permutation consistency across multiple calls", async () => {
      const testProposals = [
        { proposal: "proposal1", proposer: MOCK_ADDRESSES.PLAYER },
        { proposal: "proposal2", proposer: MOCK_ADDRESSES.GAME_MASTER },
        { proposal: "proposal3", proposer: "0x3456789012345678901234567890123456789012" as Address },
      ];

      // Get permutation results from multiple methods
      const integrityResult = await gameMaster.getProposalsIntegrity({
        size: 3,
        gameId: 1n,
        turn: 1n,
        verifierAddress: MOCK_ADDRESSES.INSTANCE,
        proposals: testProposals,
      });

      const permutedArray1 = await gameMaster.permuteArray<string>({
        array: testProposals.map((p) => p.proposal) as string[],
        gameId: 1n,
        turn: 1n,
        verifierAddress: MOCK_ADDRESSES.INSTANCE,
      });

      const permutedArray2 = await gameMaster.permuteArray<string>({
        array: testProposals.map((p) => p.proposal) as string[],
        gameId: 1n,
        turn: 1n,
        verifierAddress: MOCK_ADDRESSES.INSTANCE,
      });

      // Verify all permutations are consistent
      expect(permutedArray1).toEqual(integrityResult.newProposals.proposals);
      expect(permutedArray2).toEqual(integrityResult.newProposals.proposals);
      expect(permutedArray1).toEqual(permutedArray2);
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
        players: [MOCK_ADDRESSES.PLAYER]
      });

      expect(mockGetContractEvents).toHaveBeenCalledWith({
        address: MOCK_ADDRESSES.INSTANCE,
        abi: RankifyDiamondInstanceAbi,
        eventName: "VoteSubmitted",
        args: { gameId: 1n, turn: 1n },
        fromBlock: 0n,
      });

      expect(result).toEqual([[1n, 2n, 3n]]);
    });

    it("should return empty array when no votes exist", async () => {
      mockGetContractEvents.mockResolvedValueOnce([]);
      mockGetContractEvents.mockResolvedValueOnce([]);

      const result = await gameMaster.decryptTurnVotes({
        instanceAddress: MOCK_ADDRESSES.INSTANCE,
        gameId: 1n,
        turn: 1n,
        players: [MOCK_ADDRESSES.PLAYER]
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
