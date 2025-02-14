import { describe, expect, test, jest } from "@jest/globals";
import * as viem from "viem";
import { type Address } from "viem";
import { DistributorAbi } from "../../abis/Distributor";
import { DistributorClient } from "../Distributor";

// Create spies
const mockGetContract = jest.spyOn(viem, "getContract");
jest.spyOn(viem, "createPublicClient");
jest.spyOn(viem, "createWalletClient");
const mockReadContract = jest.fn();

// Mock data
const mockDistributorAddress = "0x1234567890123456789012345678901234567890";

describe("DistributorClient", () => {
  // Mock public client
  const mockPublicClient = {
    request: jest.fn(),
    getBlockNumber: jest.fn(() => Promise.resolve(1000n)),
    getBytecode: jest.fn(({ blockNumber }) => Promise.resolve(blockNumber >= 100n ? "0x1234" : "0x")),
    chain: { id: 97113 },
    readContract: mockReadContract,
  };

  const distributor = new DistributorClient({
    address: mockDistributorAddress as Address,
    // eslint-disable-next-line
    publicClient: mockPublicClient as any,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Setup default mock for getContract
    mockGetContract.mockImplementation(() => ({
      getEvents: {
        Instantiated: jest.fn().mockResolvedValue([]),
      },
    }));
    // Setup default mock for readContract
    mockReadContract.mockResolvedValue([]);
  });

  describe("getDistributions", () => {
    test("should return distributions", async () => {
      mockReadContract.mockResolvedValueOnce([1n, 2n, 3n]);

      const result = await distributor.getDistributions();
      expect(result.map((v) => v.toString())).toEqual(["1", "2", "3"]);
      expect(mockReadContract).toHaveBeenCalledWith({
        address: mockDistributorAddress,
        abi: DistributorAbi,
        functionName: "getDistributions",
      });
    });
  });

  describe("getInstances", () => {
    test("should return instances for a distribution ID", async () => {
      const mockInstances: Address[][] = [
        ["0x1234", "0x5678"],
        ["0x9abc", "0xdef0"],
      ];
      const resolved: GetContractEventsReturnType<typeof DistributorAbi, "Instantiated"> = [];
      resolved.push({
        args: { instances: mockInstances[0], version: 1n, newInstanceId: 1n },
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
        args: { instances: mockInstances[1], version: 1n, newInstanceId: 2n },
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
            .fn<() => Promise<GetContractEventsReturnType<typeof DistributorAbi, "Instantiated">>>()
            .mockResolvedValue(resolved),
        },
      };
      mockGetContract.mockReturnValue(mockContract);

      const result = await distributor.getInstances("0x123");
      expect(result).toEqual([
        { addresses: mockInstances[0], version: 1n, newInstanceId: 1n },
        { addresses: mockInstances[1], version: 1n, newInstanceId: 2n },
      ]);
      expect(mockGetContract).toHaveBeenCalledWith({
        address: mockDistributorAddress,
        abi: DistributorAbi,
        client: mockPublicClient,
      });
      expect(mockContract.getEvents.Instantiated).toHaveBeenCalledWith(
        {
          distributionId: "0x123",
        },
        { fromBlock: 1n, toBlock: "latest" }
      );
    });
  });

  describe("getInstance", () => {
    test("should return instance for a distribution ID and instance ID", async () => {
      const mockInstance: Address[] = ["0x1234", "0x5678"];
      const mockContract = {
        getEvents: {
          Instantiated: jest
            .fn<() => Promise<GetContractEventsReturnType<typeof DistributorAbi, "Instantiated">>>()
            .mockResolvedValue([
              {
                args: { instances: mockInstance, newInstanceId: 1n, version: 1n },
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
      mockGetContract.mockReturnValue(mockContract);

      const result = await distributor.getInstance("0x123", 1n);
      expect(result).toEqual(mockInstance);
      expect(mockGetContract).toHaveBeenCalledWith({
        address: mockDistributorAddress,
        abi: DistributorAbi,
        client: mockPublicClient,
      });
      expect(mockContract.getEvents.Instantiated).toHaveBeenCalledWith(
        {
          distributionId: "0x123",
          newInstanceId: 1n,
        },
        { fromBlock: 1n, toBlock: "latest" }
      );
    });

    test("should throw error when multiple instances found", async () => {
      const mockContract = {
        getEvents: {
          Instantiated: jest
            .fn<() => Promise<GetContractEventsReturnType<typeof DistributorAbi, "Instantiated">>>()
            .mockResolvedValue([
              {
                args: { instances: ["0x1234"], version: 1n, newInstanceId: 1n },
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
                args: { instances: ["0x5678"], version: 1n, newInstanceId: 1n },
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
      mockGetContract.mockReturnValue(mockContract);

      await expect(distributor.getInstance("0x123", 1n)).rejects.toThrow(
        "Multiple instances found for distributor 0x123 and instance 1"
      );
    });

    test("should throw error when no instances found", async () => {
      mockGetContract.mockReturnValueOnce({
        getEvents: {
          Instantiated: jest
            .fn<() => Promise<GetContractEventsReturnType<typeof DistributorAbi, "Instantiated">>>()
            .mockResolvedValue([]),
        },
      });
      // mockContractEvents.mockReturnValueOnce([]);

      await expect(
        distributor.getInstance("0x0000000000000000000000000000000000000000000000000000000000000001", 1n)
      ).rejects.toThrow(
        "No instances found for distributor 0x0000000000000000000000000000000000000000000000000000000000000001 and instance 1"
      );
    });
  });

  describe("getNamedDistributionInstances", () => {
    test("should convert name to hex and return instances", async () => {
      const mockInstances: Address[][] = [["0x1234", "0x5678"]];
      const mockContract = {
        getEvents: {
          Instantiated: jest
            .fn<() => Promise<GetContractEventsReturnType<typeof DistributorAbi, "Instantiated">>>()
            .mockResolvedValue([
              {
                args: { instances: mockInstances[0], version: 1n, newInstanceId: 1n },
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
      mockGetContract.mockReturnValue(mockContract);

      const result = await distributor.getNamedDistributionInstances({ namedDistribution: "test" });
      expect(result).toEqual(mockInstances);
      expect(mockGetContract).toHaveBeenCalledWith({
        address: mockDistributorAddress,
        abi: DistributorAbi,
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
            .fn<() => Promise<GetContractEventsReturnType<typeof DistributorAbi, "Instantiated">>>()
            .mockResolvedValue([
              {
                args: { instances: mockInstances, version: 1n, newInstanceId: 1n },
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
      mockGetContract.mockReturnValue(mockContract);

      const result = await distributor.getNamedDistributionInstance("test", 1n);
      expect(result).toEqual(mockInstances);
      expect(mockGetContract).toHaveBeenCalledWith({
        address: mockDistributorAddress,
        abi: DistributorAbi,
        client: mockPublicClient,
      });
    });
  });
});
