import { describe, expect, test, jest } from "@jest/globals";
import { DistributorClient } from "../Distributor";
import { createPublicClient, getContract, GetContractEventsReturnType } from "viem";
import { Address } from "viem";
import distributorAbi from "../../abis/Distributor";

// Mock viem
jest.mock("viem", () => ({
  ...(jest.requireActual("viem") as object),
  getContract: jest.fn(),
  createPublicClient: jest.fn(),
  http: jest.fn(),
}));

// Mock data
const mockDistributorAddress = "0x1234567890123456789012345678901234567890";

describe("DistributorClient", () => {
  // Mock public client
  const mockPublicClient = {
    request: jest.fn(),
  };
  (createPublicClient as jest.Mock).mockReturnValue(mockPublicClient);

  const distributor = new DistributorClient({
    address: mockDistributorAddress as Address,
    // eslint-disable-next-line
    publicClient: mockPublicClient as any,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getDistributions", () => {
    test("should return distributions", async () => {
      const mockContract = {
        read: {
          getDistributions: jest.fn<() => Promise<bigint[]>>().mockResolvedValue([1n, 2n, 3n]),
        },
      };
      (getContract as jest.Mock).mockReturnValue(mockContract);

      const result = await distributor.getDistributions();
      expect(result).toEqual([1n, 2n, 3n]);
      expect(getContract).toHaveBeenCalledWith({
        address: mockDistributorAddress,
        abi: distributorAbi,
        client: mockPublicClient,
      });
    });
  });

  describe("getInstances", () => {
    test("should return instances for a distribution ID", async () => {
      const mockInstances: Address[][] = [
        ["0x1234", "0x5678"],
        ["0x9abc", "0xdef0"],
      ];
      const resolved: GetContractEventsReturnType<typeof distributorAbi, "Instantiated"> = [];
      resolved.push({
        args: { instances: mockInstances[0] },
        address: "0x1234567890123456789012345678901234567890",
        blockHash: "0x1234567890123456789012345678901234567890123456789012345678901234",
        blockNumber: BigInt(1),
        data: "0x",
        logIndex: 0,
        transactionHash: "0x1234567890123456789012345678901234567890123456789012345678901234",
        transactionIndex: 0,
        removed: false,
        eventName: "Instantiated",
        topics: ["0x0", "0x1", "0x2", "0x3"],
      });
      resolved.push({
        args: { instances: mockInstances[1] },
        address: "0x1234567890123456789012345678901234567890",
        blockHash: "0x1234567890123456789012345678901234567890123456789012345678901234",
        blockNumber: BigInt(1),
        data: "0x",
        logIndex: 0,
        transactionHash: "0x1234567890123456789012345678901234567890123456789012345678901234",
        transactionIndex: 0,
        removed: false,
        eventName: "Instantiated",
        topics: ["0x0", "0x1", "0x2", "0x3"],
      });

      const mockContract = {
        getEvents: {
          Instantiated: jest
            .fn<() => Promise<GetContractEventsReturnType<typeof distributorAbi, "Instantiated">>>()
            .mockResolvedValue(resolved),
        },
      };
      (getContract as jest.Mock).mockReturnValue(mockContract);

      const result = await distributor.getInstances("0x123");
      expect(result).toEqual(mockInstances);
      expect(getContract).toHaveBeenCalledWith({
        address: mockDistributorAddress,
        abi: distributorAbi,
        client: mockPublicClient,
      });
      expect(mockContract.getEvents.Instantiated).toHaveBeenCalledWith({
        distributionId: "0x123",
      });
    });
  });

  describe("getInstance", () => {
    test("should return instance for a distribution ID and instance ID", async () => {
      const mockInstances: Address[] = ["0x1234", "0x5678"];
      const mockContract = {
        getEvents: {
          Instantiated: jest
            .fn<() => Promise<GetContractEventsReturnType<typeof distributorAbi, "Instantiated">>>()
            .mockResolvedValue([
              {
                args: { instances: mockInstances },
                address: "0x1234567890123456789012345678901234567890",
                blockHash: "0x1234567890123456789012345678901234567890123456789012345678901234",
                blockNumber: BigInt(1),
                data: "0x",
                logIndex: 0,
                transactionHash: "0x1234567890123456789012345678901234567890123456789012345678901234",
                transactionIndex: 0,
                removed: false,
                eventName: "Instantiated",
                topics: ["0x0", "0x1", "0x2", "0x3"],
              },
            ]),
        },
      };
      (getContract as jest.Mock).mockReturnValue(mockContract);

      const result = await distributor.getInstance("0x123", 1n);
      expect(result).toEqual(mockInstances);
      expect(getContract).toHaveBeenCalledWith({
        address: mockDistributorAddress,
        abi: distributorAbi,
        client: mockPublicClient,
      });
      expect(mockContract.getEvents.Instantiated).toHaveBeenCalledWith({
        distributionId: "0x123",
        newInstanceId: 1n,
      });
    });

    test("should throw error when multiple instances found", async () => {
      const mockContract = {
        getEvents: {
          Instantiated: jest
            .fn<() => Promise<GetContractEventsReturnType<typeof distributorAbi, "Instantiated">>>()
            .mockResolvedValue([
              {
                args: { instances: ["0x1234"] },
                address: "0x1234567890123456789012345678901234567890",
                blockHash: "0x1234567890123456789012345678901234567890123456789012345678901234",
                blockNumber: BigInt(1),
                data: "0x",
                logIndex: 0,
                transactionHash: "0x1234567890123456789012345678901234567890123456789012345678901234",
                transactionIndex: 0,
                removed: false,
                eventName: "Instantiated",
                topics: ["0x0", "0x1", "0x2", "0x3"],
              },
              {
                args: { instances: ["0x5678"] },
                address: "0x1234567890123456789012345678901234567890",
                blockHash: "0x1234567890123456789012345678901234567890123456789012345678901234",
                blockNumber: BigInt(1),
                data: "0x",
                logIndex: 1,
                transactionHash: "0x1234567890123456789012345678901234567890123456789012345678901234",
                transactionIndex: 0,
                removed: false,
                eventName: "Instantiated",
                topics: ["0x0", "0x1", "0x2", "0x3"],
              },
            ]),
        },
      };
      (getContract as jest.Mock).mockReturnValue(mockContract);

      await expect(distributor.getInstance("0x123", 1n)).rejects.toThrow(
        "Multiple instances found for distributor 0x123 and instance 1"
      );
    });

    test("should throw error when no instances found", async () => {
      const mockContract = {
        getEvents: {
          Instantiated: jest
            .fn<() => Promise<GetContractEventsReturnType<typeof distributorAbi, "Instantiated">>>()
            .mockResolvedValue([]),
        },
      };
      (getContract as jest.Mock).mockReturnValue(mockContract);

      await expect(distributor.getInstance("0x123", 1n)).rejects.toThrow(
        "No instances found for distributor 0x123 and instance 1"
      );
    });
  });

  describe("getNamedDistributionInstances", () => {
    test("should convert name to hex and return instances", async () => {
      const mockInstances: Address[][] = [["0x1234", "0x5678"]];
      const mockContract = {
        getEvents: {
          Instantiated: jest
            .fn<() => Promise<GetContractEventsReturnType<typeof distributorAbi, "Instantiated">>>()
            .mockResolvedValue([
              {
                args: { instances: mockInstances[0] },
                address: "0x1234567890123456789012345678901234567890",
                blockHash: "0x1234567890123456789012345678901234567890123456789012345678901234",
                blockNumber: BigInt(1),
                data: "0x",
                logIndex: 0,
                transactionHash: "0x1234567890123456789012345678901234567890123456789012345678901234",
                transactionIndex: 0,
                removed: false,
                eventName: "Instantiated",
                topics: ["0x0", "0x1", "0x2", "0x3"],
              },
            ]),
        },
      };
      (getContract as jest.Mock).mockReturnValue(mockContract);

      const result = await distributor.getNamedDistributionInstances({ namedDistribution: "test" });
      expect(result).toEqual(mockInstances);
      expect(getContract).toHaveBeenCalledWith({
        address: mockDistributorAddress,
        abi: distributorAbi,
        client: mockPublicClient,
      });
    });
  });

  describe("getNamedDistributionInstance", () => {
    test("should convert name to hex and return specific instance", async () => {
      const mockInstances: Address[] = ["0x1234", "0x5678"];
      const mockContract = {
        getEvents: {
          Instantiated: jest
            .fn<() => Promise<GetContractEventsReturnType<typeof distributorAbi, "Instantiated">>>()
            .mockResolvedValue([
              {
                args: { instances: mockInstances },
                address: "0x1234567890123456789012345678901234567890",
                blockHash: "0x1234567890123456789012345678901234567890123456789012345678901234",
                blockNumber: BigInt(1),
                data: "0x",
                logIndex: 0,
                transactionHash: "0x1234567890123456789012345678901234567890123456789012345678901234",
                transactionIndex: 0,
                removed: false,
                eventName: "Instantiated",
                topics: ["0x0", "0x1", "0x2", "0x3"],
              },
            ]),
        },
      };
      (getContract as jest.Mock).mockReturnValue(mockContract);

      const result = await distributor.getNamedDistributionInstance("test", 1n);
      expect(result).toEqual(mockInstances);
      expect(getContract).toHaveBeenCalledWith({
        address: mockDistributorAddress,
        abi: distributorAbi,
        client: mockPublicClient,
      });
    });
  });
});
