import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { type PublicClient, type Hex, type Address } from "viem";
import InstanceUBI from "../InstanceUBI";
import { MOCK_ADDRESSES, createMockPublicClient, createMockEnvioClient } from "../../utils/mockUtils";

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
  | Address
  | [bigint, bigint, Hex]
  | [boolean, bigint]
  | {
      proposal: Hex;
      score: bigint;
      proposer: Address;
      exists: boolean;
    }
  | {
      aggregateScore: bigint;
      proposedTimes: bigint;
      repostedTimes: bigint;
    };

// Create mock functions with correct return types
const mockReadContract = jest.fn((): Promise<MockReadContractReturnType> => Promise.resolve(0n));

// Mock public client
const mockPublicClient = createMockPublicClient({
  readContract: mockReadContract,
}) as unknown as PublicClient;

const mockEnvioClient = createMockEnvioClient();

describe("InstanceUBI", () => {
  let ubiClient: InstanceUBI;
  const instanceAddress = MOCK_ADDRESSES.UBI_CONTRACT;
  const chainId = 1;

  beforeEach(() => {
    jest.clearAllMocks();
    ubiClient = new InstanceUBI({
      publicClient: mockPublicClient,
      chainId,
      instanceAddress,
      envioClient: mockEnvioClient,
    });
  });

  describe("Constructor", () => {
    it("should create an instance with correct properties", () => {
      expect(ubiClient).toBeInstanceOf(InstanceUBI);
      expect(ubiClient.publicClient).toBe(mockPublicClient);
      expect(ubiClient.chainId).toBe(chainId);
      expect(ubiClient.instanceAddress).toBe(instanceAddress);
    });
  });

  describe("getCurrentDay", () => {
    it("should return the current day", async () => {
      const mockDay = 12345n;
      mockReadContract.mockResolvedValueOnce(mockDay);

      const result = await ubiClient.getCurrentDay();

      expect(result).toBe(mockDay);
      expect(mockReadContract).toHaveBeenCalledWith({
        address: instanceAddress,
        abi: expect.any(Array),
        functionName: "getCurrentDay",
      });
    });
  });

  describe("currentDay", () => {
    it("should return the current day (alias)", async () => {
      const mockDay = 12345n;
      mockReadContract.mockResolvedValueOnce(mockDay);

      const result = await ubiClient.currentDay();

      expect(result).toBe(mockDay);
      expect(mockReadContract).toHaveBeenCalledWith({
        address: instanceAddress,
        abi: expect.any(Array),
        functionName: "currentDay",
      });
    });
  });

  describe("getUBIParams", () => {
    it("should return UBI parameters", async () => {
      const mockParams: [bigint, bigint, Hex] = [
        1000000000000000000n, // dailyClaimAmount (1 token with 18 decimals)
        10000n, // dailySupportAmount
        "0x1234567890123456789012345678901234567890123456789012345678901234" as Hex, // domainName
      ];
      mockReadContract.mockResolvedValueOnce(mockParams);

      const result = await ubiClient.getUBIParams();

      expect(result.dailyClaimAmount).toBe(mockParams[0]);
      expect(result.dailySupportAmount).toBe(mockParams[1]);
      expect(result.domainName).toBe(mockParams[2]);
      expect(mockReadContract).toHaveBeenCalledWith({
        address: instanceAddress,
        abi: expect.any(Array),
        functionName: "getUBIParams",
      });
    });
  });

  describe("getProposalLifetimeStats", () => {
    it("should return proposal lifetime statistics", async () => {
      const proposalHash = "0x1234567890123456789012345678901234567890123456789012345678901234" as Hex;
      const mockStats = {
        aggregateScore: 5000n,
        proposedTimes: 3n,
        repostedTimes: 2n,
      };
      mockReadContract.mockResolvedValueOnce(mockStats);

      const result = await ubiClient.getProposalLifetimeStats(proposalHash);

      expect(result.aggregateScore).toBe(mockStats.aggregateScore);
      expect(result.proposedTimes).toBe(mockStats.proposedTimes);
      expect(result.repostedTimes).toBe(mockStats.repostedTimes);
      expect(mockReadContract).toHaveBeenCalledWith({
        address: instanceAddress,
        abi: expect.any(Array),
        functionName: "proposalLifetimeStats",
        args: [proposalHash],
      });
    });
  });

  describe("getProposalDailyScore", () => {
    it("should return proposal daily score", async () => {
      const proposalHash = "0x1234567890123456789012345678901234567890123456789012345678901234" as Hex;
      const day = 12345n;
      const mockDailyScore = {
        proposal: proposalHash,
        score: 1000n,
        proposer: MOCK_ADDRESSES.PLAYER_1,
        exists: true,
      };
      mockReadContract.mockResolvedValueOnce(mockDailyScore);

      const result = await ubiClient.getProposalDailyScore(proposalHash, day);

      expect(result.proposal).toBe(mockDailyScore.proposal);
      expect(result.score).toBe(mockDailyScore.score);
      expect(result.proposer).toBe(mockDailyScore.proposer);
      expect(result.exists).toBe(mockDailyScore.exists);
      expect(mockReadContract).toHaveBeenCalledWith({
        address: instanceAddress,
        abi: expect.any(Array),
        functionName: "getProposalDailyScore",
        args: [proposalHash, day],
      });
    });
  });

  describe("getProposalsCnt", () => {
    it("should return the count of proposals for a day", async () => {
      const day = 12345n;
      const mockCount = 42n;
      mockReadContract.mockResolvedValueOnce(mockCount);

      const result = await ubiClient.getProposalsCnt(day);

      expect(result).toBe(mockCount);
      expect(mockReadContract).toHaveBeenCalledWith({
        address: instanceAddress,
        abi: expect.any(Array),
        functionName: "getProposalsCnt",
        args: [day],
      });
    });
  });

  describe("getLastClaimedAt", () => {
    it("should return the last claimed day for a user", async () => {
      const user = MOCK_ADDRESSES.PLAYER_1;
      const mockDay = 12344n;
      mockReadContract.mockResolvedValueOnce(mockDay);

      const result = await ubiClient.getLastClaimedAt(user);

      expect(result).toBe(mockDay);
      expect(mockReadContract).toHaveBeenCalledWith({
        address: instanceAddress,
        abi: expect.any(Array),
        functionName: "lastClaimedAt",
        args: [user],
      });
    });
  });

  describe("getUserState", () => {
    it("should return user state", async () => {
      const user = MOCK_ADDRESSES.PLAYER_1;
      const mockState: [boolean, bigint] = [true, 5000n];
      mockReadContract.mockResolvedValueOnce(mockState);

      const result = await ubiClient.getUserState(user);

      expect(result.claimedToday).toBe(mockState[0]);
      expect(result.supportSpent).toBe(mockState[1]);
      expect(mockReadContract).toHaveBeenCalledWith({
        address: instanceAddress,
        abi: expect.any(Array),
        functionName: "getUserState",
        args: [user],
      });
    });
  });

  describe("getPauser", () => {
    it("should return the pauser address", async () => {
      const mockPauser = MOCK_ADDRESSES.GAME_MASTER;
      mockReadContract.mockResolvedValueOnce(mockPauser);

      const result = await ubiClient.getPauser();

      expect(result).toBe(mockPauser);
      expect(mockReadContract).toHaveBeenCalledWith({
        address: instanceAddress,
        abi: expect.any(Array),
        functionName: "pauser",
      });
    });
  });

  describe("getMultipass", () => {
    it("should return the multipass contract address", async () => {
      const mockMultipass = MOCK_ADDRESSES.MULTIPASS;
      mockReadContract.mockResolvedValueOnce(mockMultipass);

      const result = await ubiClient.getMultipass();

      expect(result).toBe(mockMultipass);
      expect(mockReadContract).toHaveBeenCalledWith({
        address: instanceAddress,
        abi: expect.any(Array),
        functionName: "multipass",
      });
    });
  });

  describe("getToken", () => {
    it("should return the token contract address", async () => {
      const mockToken = MOCK_ADDRESSES.RANK_TOKEN;
      mockReadContract.mockResolvedValueOnce(mockToken);

      const result = await ubiClient.getToken();

      expect(result).toBe(mockToken);
      expect(mockReadContract).toHaveBeenCalledWith({
        address: instanceAddress,
        abi: expect.any(Array),
        functionName: "token",
      });
    });
  });

  describe("isPaused", () => {
    it("should return whether the contract is paused", async () => {
      mockReadContract.mockResolvedValueOnce(false);

      const result = await ubiClient.isPaused();

      expect(result).toBe(false);
      expect(mockReadContract).toHaveBeenCalledWith({
        address: instanceAddress,
        abi: expect.any(Array),
        functionName: "paused",
      });
    });

    it("should return true when contract is paused", async () => {
      mockReadContract.mockResolvedValueOnce(true);

      const result = await ubiClient.isPaused();

      expect(result).toBe(true);
    });
  });

  describe("getUserInfo", () => {
    it("should return comprehensive user information", async () => {
      const user = MOCK_ADDRESSES.PLAYER_1;
      const mockUserState: [boolean, bigint] = [true, 5000n];
      const mockLastClaimedAt = 12345n;
      const mockCurrentDay = 12346n;

      mockReadContract
        .mockResolvedValueOnce(mockUserState)
        .mockResolvedValueOnce(mockLastClaimedAt)
        .mockResolvedValueOnce(mockCurrentDay);

      const result = await ubiClient.getUserInfo(user);

      expect(result.userState.claimedToday).toBe(mockUserState[0]);
      expect(result.userState.supportSpent).toBe(mockUserState[1]);
      expect(result.lastClaimedAt).toBe(mockLastClaimedAt);
      expect(result.currentDay).toBe(mockCurrentDay);
      expect(result.canClaim).toBe(true); // lastClaimedAt < currentDay
    });

    it("should indicate user cannot claim when already claimed today", async () => {
      const user = MOCK_ADDRESSES.PLAYER_1;
      const mockUserState: [boolean, bigint] = [true, 5000n];
      const mockCurrentDay = 12345n;
      const mockLastClaimedAt = 12345n; // Same as current day

      mockReadContract
        .mockResolvedValueOnce(mockUserState)
        .mockResolvedValueOnce(mockLastClaimedAt)
        .mockResolvedValueOnce(mockCurrentDay);

      const result = await ubiClient.getUserInfo(user);

      expect(result.canClaim).toBe(false); // lastClaimedAt == currentDay
    });
  });

  describe("getProposalInfo", () => {
    it("should return comprehensive proposal information", async () => {
      const proposalHash = "0x1234567890123456789012345678901234567890123456789012345678901234" as Hex;
      const mockLifetimeStats = {
        aggregateScore: 5000n,
        proposedTimes: 3n,
        repostedTimes: 2n,
      };
      const mockDailyScore = {
        proposal: proposalHash,
        score: 1000n,
        proposer: MOCK_ADDRESSES.PLAYER_1,
        exists: true,
      };
      const mockCurrentDay = 12345n;

      mockReadContract
        .mockResolvedValueOnce(mockCurrentDay)
        .mockResolvedValueOnce(mockLifetimeStats)
        .mockResolvedValueOnce(mockDailyScore);

      const result = await ubiClient.getProposalInfo(proposalHash);

      expect(result.lifetimeStats).toEqual(mockLifetimeStats);
      expect(result.dailyScore).toEqual(mockDailyScore);
      expect(result.day).toBe(mockCurrentDay - 1n);
    });

    it("should use provided day when specified", async () => {
      const proposalHash = "0x1234567890123456789012345678901234567890123456789012345678901234" as Hex;
      const specifiedDay = 12340n;
      const mockLifetimeStats = {
        aggregateScore: 5000n,
        proposedTimes: 3n,
        repostedTimes: 2n,
      };
      const mockDailyScore = {
        proposal: proposalHash,
        score: 1000n,
        proposer: MOCK_ADDRESSES.PLAYER_1,
        exists: true,
      };

      mockReadContract.mockResolvedValueOnce(mockLifetimeStats).mockResolvedValueOnce(mockDailyScore);

      const result = await ubiClient.getProposalInfo(proposalHash, specifiedDay);

      expect(result.day).toBe(specifiedDay);
    });
  });

  describe("getDayProposals", () => {
    it("should return day proposals information", async () => {
      const day = 12345n;
      const mockCount = 42n;
      mockReadContract.mockResolvedValueOnce(mockCount);

      const result = await ubiClient.getDayProposals(day);

      expect(result.count).toBe(mockCount);
      expect(result.day).toBe(day);
    });
  });
});
