import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import * as viem from "viem";
import { GetContractEventsReturnType, type Address } from "viem";
import { DistributorAbi } from "../../abis/Distributor";
import { DistributorClient } from "../Distributor";
import { MOCK_ADDRESSES, createMockEnvioClient } from "../../__tests__/utils";
import { MAOInstanceData } from "../../utils/EnvioGraphQLClient";
// Create spies
const mockGetContract = jest.spyOn(viem, "getContract");
jest.spyOn(viem, "createPublicClient");
jest.spyOn(viem, "createWalletClient");
const mockReadContract = jest.fn();

// Mock data
const mockDistributorAddress = "0x1234567890123456789012345678901234567890";

describe("DistributorClient", () => {
  const mockEnvioClient = createMockEnvioClient();

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
    envioClient: mockEnvioClient,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Setup default mock for getContract
    // eslint-disable-next-line
    (mockGetContract as any).mockImplementation(() => ({
      getEvents: {
        // eslint-disable-next-line
        Instantiated: jest
          .fn<() => Promise<GetContractEventsReturnType<typeof DistributorAbi, "Instantiated">>>()
          .mockResolvedValue([]),
      },
    }));
    // Setup default mock for readContract
    // eslint-disable-next-line
    (mockReadContract as any).mockResolvedValue([]);
  });

  describe("getDistributions", () => {
    test("should return distributions", async () => {
      // eslint-disable-next-line
      (mockReadContract as any).mockResolvedValueOnce([1n, 2n, 3n]);

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
      const resolved = [] as MAOInstanceData[];

      resolved.push({
        distributionId: "0x0000000000000000000000000000000000000000000000000000000000000001",
        newInstanceId: "1",
        instances: mockInstances[0],
        version: "1",
        blockNumber: "1",
        blockTimestamp: "1",
        args: "",
      });
      resolved.push({
        distributionId: "0x0000000000000000000000000000000000000000000000000000000000000001",
        newInstanceId: "2",
        instances: mockInstances[1],
        version: "1",
        blockNumber: "1",
        blockTimestamp: "1",
        args: "",
      });
      jest.spyOn(mockEnvioClient, 'queryInstances').mockResolvedValue(resolved);

      const result = await distributor.getInstances(
        "0x0000000000000000000000000000000000000000000000000000000000000001"
      );
      expect(result).toEqual([
        { addresses: mockInstances[0], version: 1n, newInstanceId: 1n },
        { addresses: mockInstances[1], version: 1n, newInstanceId: 2n },
      ]);
      expect(mockEnvioClient.queryInstances).toHaveBeenCalledWith({
        distributionId: "0x0000000000000000000000000000000000000000000000000000000000000001",
      });
    });
  });

  describe("getInstance", () => {
    test("should return instance for a distribution ID and instance ID", async () => {
      const mockInstance: Address[] = ["0x1234", "0x5678"];
      const resolved = [{
        distributionId: "0x0000000000000000000000000000000000000000000000000000000000000001",
        newInstanceId: "1",
        instances: mockInstance,
        version: "1",
        blockNumber: "1",
        blockTimestamp: "1",
        args: "",
      }];
      jest.spyOn(mockEnvioClient, 'queryInstances').mockResolvedValue(resolved);

      const result = await distributor.getInstance(
        "0x0000000000000000000000000000000000000000000000000000000000000001",
        1n
      );
      expect(result).toEqual(mockInstance);
      expect(mockEnvioClient.queryInstances).toHaveBeenCalledWith({
        distributionId: "0x0000000000000000000000000000000000000000000000000000000000000001",
        instanceId: "1",
      });
    });

    test("should throw error when multiple instances found", async () => {
      const resolved = [
        {
          distributionId: "0x0000000000000000000000000000000000000000000000000000000000000001",
          newInstanceId: "1",
          instances: ["0x1234"],
          version: "1",
          blockNumber: "1",
          blockTimestamp: "1",
          args: "",
        },
        {
          distributionId: "0x0000000000000000000000000000000000000000000000000000000000000001",
          newInstanceId: "1",
          instances: ["0x5678"],
          version: "1",
          blockNumber: "1",
          blockTimestamp: "1",
          args: "",
        }
      ];
      jest.spyOn(mockEnvioClient, 'queryInstances').mockResolvedValue(resolved);

      await expect(
        distributor.getInstance("0x0000000000000000000000000000000000000000000000000000000000000001", 1n)
      ).rejects.toThrow(
        "Multiple instances found for distributor 0x0000000000000000000000000000000000000000000000000000000000000001 and instance 1"
      );
      expect(mockEnvioClient.queryInstances).toHaveBeenCalledWith({
        distributionId: "0x0000000000000000000000000000000000000000000000000000000000000001",
        instanceId: "1",
      });
    });

    test("should throw error when no instances found", async () => {
      jest.spyOn(mockEnvioClient, 'queryInstances').mockResolvedValue([]);

      await expect(
        distributor.getInstance("0x0000000000000000000000000000000000000000000000000000000000000001", 1n)
      ).rejects.toThrow(
        "No instances found for distributor 0x0000000000000000000000000000000000000000000000000000000000000001 and instance 1"
      );
      expect(mockEnvioClient.queryInstances).toHaveBeenCalledWith({
        distributionId: "0x0000000000000000000000000000000000000000000000000000000000000001",
        instanceId: "1",
      });
    });
  });

  describe("getNamedDistributionInstances", () => {
    test("should convert name to hex and return instances", async () => {
      const mockInstances: Address[][] = [["0x1234", "0x5678"]];
      const resolved = [{
        distributionId: "0x7465737400000000000000000000000000000000000000000000000000000000", // "test" in hex
        newInstanceId: "1",
        instances: mockInstances[0],
        version: "1",
        blockNumber: "1",
        blockTimestamp: "1",
        args: "",
      }];
      jest.spyOn(mockEnvioClient, 'queryInstances').mockResolvedValue(resolved);

      const result = await distributor.getNamedDistributionInstances({ namedDistribution: "test" });
      expect(result).toEqual(mockInstances);
      expect(mockEnvioClient.queryInstances).toHaveBeenCalledWith({
        distributionId: "0x7465737400000000000000000000000000000000000000000000000000000000",
      });
    });
  });

  describe("getNamedDistributionInstance", () => {
    test("should convert name to hex and return specific instance", async () => {
      const mockInstances: Address[] = ["0x1234", "0x5678"];
      const resolved = [{
        distributionId: "0x7465737400000000000000000000000000000000000000000000000000000000", // "test" in hex
        newInstanceId: "1",
        instances: mockInstances,
        version: "1",
        blockNumber: "1",
        blockTimestamp: "1",
        args: "",
      }];
      jest.spyOn(mockEnvioClient, 'queryInstances').mockResolvedValue(resolved);

      const result = await distributor.getNamedDistributionInstance("test", 1n);
      expect(result).toEqual(mockInstances);
      expect(mockEnvioClient.queryInstances).toHaveBeenCalledWith({
        distributionId: "0x7465737400000000000000000000000000000000000000000000000000000000",
        instanceId: "1",
      });
    });
  });
});
