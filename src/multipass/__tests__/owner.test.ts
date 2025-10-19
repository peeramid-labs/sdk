import { MultipassAbi } from "../../abis";
import { describe, expect, test, jest } from "@jest/globals";
import MultipassOwner from "../Owner";
import { type Address, type Hash, type PublicClient, type WalletClient, type Account } from "viem";
import { type Domain } from "../MultipassBase";
import { createMockEnvioClient } from "../../utils/mockUtils";
const mockEnvioClient = createMockEnvioClient();
// Mock viem
jest.mock("viem", () => ({
  ...(jest.requireActual("viem") as object),
  getContract: jest.fn(),
  createPublicClient: jest.fn(),
  createWalletClient: jest.fn(),
  http: jest.fn(),
  stringToHex: jest.fn().mockImplementation((str) => `0x${str}`),
}));

// Mock utils
jest.mock("../../utils", () => ({
  getArtifact: jest.fn().mockReturnValue({
    address: "0x1234567890123456789012345678901234567890",
    abi: MultipassAbi,
    receipt: {
      blockNumber: 100,
    },
  }),
}));

describe("MultipassOwner", () => {
  const mockChainId = 97113;
  const mockAccount = {
    address: "0x1234567890123456789012345678901234567890" as Address,
  } as Account;

  const mockWriteContract = jest.fn<() => Promise<Hash>>();
  mockWriteContract.mockResolvedValue("0xtxhash" as Hash);

  const mockWalletClient = {
    account: mockAccount,
    writeContract: mockWriteContract,
  } as unknown as WalletClient;

  const mockDomainState: Domain = {
    name: "test.domain",
    registrar: "0x1111111111111111111111111111111111111111" as Address,
    fee: BigInt(1000),
    renewalFee: BigInt(100),
    registerSize: BigInt(0),
    isActive: true,
    referrerReward: BigInt(50),
    referralDiscount: BigInt(25),
  };

  const mockReadContract = jest.fn<() => Promise<Domain>>();
  mockReadContract.mockResolvedValue(mockDomainState);

  const mockPublicClient = {
    readContract: mockReadContract,
    getBlockNumber: jest.fn(() => Promise.resolve(1000n)),
    getBytecode: jest.fn(({ blockNumber }) => Promise.resolve(blockNumber >= 100n ? "0x1234" : "0x")),
  } as unknown as PublicClient;

  const multipassOwner = new MultipassOwner({
    chainId: mockChainId,
    walletClient: mockWalletClient,
    publicClient: mockPublicClient,
    envioClient: mockEnvioClient,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getDomainState", () => {
    test("should get domain state with correct parameters", async () => {
      const domainName = "0xtest" as `0x${string}`;
      await multipassOwner.getDomainState(domainName);

      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: expect.any(String),
        abi: expect.any(Array),
        functionName: "getDomainState",
        args: [domainName],
      });
    });
  });

  describe("getDomainStateById", () => {
    test("should get domain state by ID with correct parameters", async () => {
      const id = BigInt(1);
      await multipassOwner.getDomainStateById(id);

      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: expect.any(String),
        abi: expect.any(Array),
        functionName: "getDomainStateById",
        args: [id],
      });
    });
  });

  describe("getContractState", () => {
    test("should get contract state with correct parameters", async () => {
      await multipassOwner.getContractState();

      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: expect.any(String),
        abi: expect.any(Array),
        functionName: "getContractState",
        args: [],
      });
    });
  });

  describe("initializeDomain", () => {
    test("should initialize domain with correct parameters", async () => {
      const params = {
        registrar: "0x1111111111111111111111111111111111111111" as Address,
        fee: BigInt(1000),
        renewalFee: BigInt(100),
        domainName: "test.domain",
        referrerReward: BigInt(50),
        referralDiscount: BigInt(25),
      };

      await multipassOwner.initializeDomain(params);

      expect(mockWalletClient.writeContract).toHaveBeenCalledWith({
        address: expect.any(String),
        abi: expect.any(Array),
        functionName: "initializeDomain",
        args: [
          params.registrar,
          params.fee,
          params.renewalFee,
          expect.any(String),
          params.referrerReward,
          params.referralDiscount,
        ],
        chain: null,
        account: mockWalletClient.account,
      });
    });

    test("should throw error if no account found", async () => {
      const noAccountWalletClient = {
        ...mockWalletClient,
        account: undefined,
      } as unknown as WalletClient;

      const multipassNoAccount = new MultipassOwner({
        chainId: mockChainId,
        walletClient: noAccountWalletClient,
        publicClient: mockPublicClient,
        envioClient: mockEnvioClient,
      });

      await expect(
        multipassNoAccount.initializeDomain({
          registrar: "0x1111111111111111111111111111111111111111" as Address,
          fee: BigInt(1000),
          renewalFee: BigInt(100),
          domainName: "test.domain",
          referrerReward: BigInt(50),
          referralDiscount: BigInt(25),
        })
      ).rejects.toThrow("No account found");
    });
  });

  describe("deactivateDomain", () => {
    test("should deactivate domain with correct parameters", async () => {
      const domainName = "test.domain";

      await multipassOwner.deactivateDomain(domainName);

      expect(mockWalletClient.writeContract).toHaveBeenCalledWith({
        address: expect.any(String),
        abi: expect.any(Array),
        functionName: "deactivateDomain",
        args: [expect.any(String)],
        chain: null,
        account: mockWalletClient.account,
      });
    });
  });

  describe("changeFee", () => {
    test("should change fee with correct parameters", async () => {
      const params = {
        domainName: "test.domain",
        fee: BigInt(2000),
      };

      await multipassOwner.changeFee(params);

      expect(mockWalletClient.writeContract).toHaveBeenCalledWith({
        address: expect.any(String),
        abi: expect.any(Array),
        functionName: "changeFee",
        args: [expect.any(String), params.fee],
        chain: null,
        account: mockWalletClient.account,
      });
    });
  });

  describe("changeRegistrar", () => {
    test("should change registrar with correct parameters", async () => {
      const params = {
        domainName: "test.domain",
        newRegistrar: "0x2222222222222222222222222222222222222222" as Address,
      };

      await multipassOwner.changeRegistrar(params);

      expect(mockWalletClient.writeContract).toHaveBeenCalledWith({
        address: expect.any(String),
        abi: expect.any(Array),
        functionName: "changeRegistrar",
        args: [expect.any(String), params.newRegistrar],
        chain: null,
        account: mockWalletClient.account,
      });
    });
  });

  describe("deleteName", () => {
    test("should delete name with correct parameters", async () => {
      const query = {
        name: "0xname" as `0x${string}`,
        id: "0xid" as `0x${string}`,
        wallet: "0x3333333333333333333333333333333333333333" as Address,
        domainName: "0xdomain" as `0x${string}`,
        targetDomain: "0xtarget" as `0x${string}`,
      };

      await multipassOwner.deleteName(query);

      expect(mockWalletClient.writeContract).toHaveBeenCalledWith({
        address: expect.any(String),
        abi: expect.any(Array),
        functionName: "deleteName",
        args: [query],
        chain: null,
        account: mockWalletClient.account,
      });
    });
  });

  describe("changeReferralProgram", () => {
    test("should change referral program with correct parameters", async () => {
      const params = {
        domainName: "test.domain",
        referrerReward: BigInt(100),
        referralDiscount: BigInt(50),
      };

      await multipassOwner.changeReferralProgram(params);

      expect(mockWalletClient.writeContract).toHaveBeenCalledWith({
        address: expect.any(String),
        abi: expect.any(Array),
        functionName: "changeReferralProgram",
        args: [params.referrerReward, params.referralDiscount, expect.any(String)],
        chain: null,
        account: mockWalletClient.account,
      });
    });
  });

  describe("changeRenewalFee", () => {
    test("should change renewal fee with correct parameters", async () => {
      const params = {
        domainName: "test.domain",
        fee: BigInt(500),
      };

      await multipassOwner.changeRenewalFee(params);

      expect(mockWalletClient.writeContract).toHaveBeenCalledWith({
        address: expect.any(String),
        abi: expect.any(Array),
        functionName: "changeRenewalFee",
        args: [params.fee, expect.any(String)],
        chain: null,
        account: mockWalletClient.account,
      });
    });
  });
});
