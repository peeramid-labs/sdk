import { describe, expect, test, jest } from "@jest/globals";
import Multipass from "../multipass";
import { createPublicClient, createWalletClient, Hex } from "viem";
import { Address } from "viem";
import { RegisterMessage } from "../types";

// Mock viem
jest.mock("viem", () => ({
  ...(jest.requireActual("viem") as object),
  getContract: jest.fn(),
  createPublicClient: jest.fn(),
  createWalletClient: jest.fn(),
  http: jest.fn(),
}));

// Mock utils
jest.mock("../utils", () => ({
  getArtifact: jest.fn().mockReturnValue({
    execute: {
      args: ["TestMultipass", "1.0.0"],
    },
    address: "0x1234567890123456789012345678901234567890",
  }),
}));

describe("Multipass", () => {
  const mockChainId = 1;
  const mockPublicClient = {
    request: jest.fn(),
  };
  const mockWalletClient = {
    account: {
      address: "0x1234567890123456789012345678901234567890" as Address,
    },
    signTypedData: jest.fn<() => Promise<Hex>>(),
  };

  (createPublicClient as jest.Mock).mockReturnValue(mockPublicClient);
  (createWalletClient as jest.Mock).mockReturnValue(mockWalletClient);

  const multipass = new Multipass({
    chainId: mockChainId,
    // eslint-disable-next-line
    publicClient: mockPublicClient as any,
    // eslint-disable-next-line
    walletClient: mockWalletClient as any,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getDappURL", () => {
    test("should return correctly formatted URL", () => {
      const message = { test: "data" };
      const signature = "0xsignature";
      const basepath = "https://example.com";
      const contractAddress = "0x1234";

      const result = multipass.getDappURL(message, signature, basepath, contractAddress);

      expect(result).toBe(
        `${basepath}/?message=${Buffer.from(JSON.stringify(message)).toString("base64")}&contractAddress=${contractAddress}&signature=${signature}&chainId=${mockChainId}`
      );
    });
  });

  describe("signRegistrarMessage", () => {
    test("should sign message correctly", async () => {
      const message: RegisterMessage = {
        name: "0x123" as Hex,
        id: "0x456" as Hex,
        domainName: "0x789" as Hex,
        validUntil: BigInt(1234567890),
        nonce: BigInt(1),
      };
      const verifierAddress = "0x9876543210987654321098765432109876543210" as Address;

      mockWalletClient.signTypedData.mockResolvedValue("0xsignedMessage" as `0x${string}`);

      const result = await multipass.signRegistrarMessage(message, verifierAddress);

      expect(result).toBe("0xsignedMessage");
      expect(mockWalletClient.signTypedData).toHaveBeenCalledWith({
        account: mockWalletClient.account.address,
        domain: {
          name: "TestMultipass",
          version: "1.0.0",
          chainId: mockChainId,
          verifyingContract: verifierAddress,
        },
        types: {
          registerName: [
            { type: "bytes32", name: "name" },
            { type: "bytes32", name: "id" },
            { type: "bytes32", name: "domainName" },
            { type: "uint256", name: "validUntil" },
            { type: "uint96", name: "nonce" },
          ],
        },
        primaryType: "registerName",
        message: message,
      });
    });

    test("should throw error if no account found", async () => {
      const message: RegisterMessage = {
        name: "0x123" as Hex,
        id: "0x456" as Hex,
        domainName: "0x789" as Hex,
        validUntil: BigInt(1234567890),
        nonce: BigInt(1),
      };
      const verifierAddress = "0x9876543210987654321098765432109876543210" as Address;

      const multipassNoAccount = new Multipass({
        chainId: mockChainId,
        // eslint-disable-next-line
        publicClient: mockPublicClient as any,
        // eslint-disable-next-line
        walletClient: { ...mockWalletClient, account: null } as any,
      });

      await expect(multipassNoAccount.signRegistrarMessage(message, verifierAddress)).rejects.toThrow(
        "No account found"
      );
    });
  });

  describe("getRegistrarMessage", () => {
    test("should format message correctly", () => {
      const input = {
        username: "test",
        id: "123",
        domainName: "domain",
        validUntil: 1234567890,
      };

      const result = multipass.getRegistrarMessage(input);

      expect(result).toHaveProperty("name");
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("domainName");
      expect(result).toHaveProperty("validUntil");
      expect(result).toHaveProperty("nonce");
      expect(typeof result.validUntil).toBe("bigint");
      expect(typeof result.nonce).toBe("bigint");
    });
  });
});
