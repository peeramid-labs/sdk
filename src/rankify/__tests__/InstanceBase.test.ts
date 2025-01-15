import { describe, expect, it, jest } from "@jest/globals";
import { type PublicClient } from "viem";
import InstanceBase from "../InstanceBase";

describe("InstanceBase", () => {
  const mockPublicClient = {
    readContract: jest.fn(),
  } as unknown as PublicClient;

  const instance = new InstanceBase({
    publicClient: mockPublicClient,
    chainId: 1,
    instanceAddress: "0x1234567890123456789012345678901234567890",
  });

  describe("getEIP712Domain", () => {
    it("should return EIP712 domain data", async () => {
      const mockDomainData = [
        "0x1234567890123456789012345678901234567890123456789012345678901234", // domainSeparator
        1n, // chainId
        "0x2345678901234567890123456789012345678901", // verifierContract
        "0x3456789012345678901234567890123456789012345678901234567890123456", // hashedName
        "0x4567890123456789012345678901234567890123456789012345678901234567", // hashedVersion
        "0x5678901234567890123456789012345678901234567890123456789012345678", // typeHash
        "TestContract", // name
        "1", // version
      ];

      jest.spyOn(mockPublicClient, "readContract").mockResolvedValueOnce(mockDomainData);

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

      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: instance.instanceAddress,
        abi: expect.any(Array),
        functionName: "inspectEIP712Hashes",
      });
    });

    it("should handle errors", async () => {
      jest.spyOn(mockPublicClient, "readContract").mockRejectedValueOnce(new Error("Contract call failed"));

      await expect(instance.getEIP712Domain()).rejects.toThrow("Contract call failed");
    });
  });
});
