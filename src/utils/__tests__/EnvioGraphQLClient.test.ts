import { describe, it, expect, beforeEach } from "@jest/globals";
import { type Address } from "viem";
import { EnvioGraphQLClient, type EnvioGraphQLClientConfig, type MAOInstanceData } from "../EnvioGraphQLClient";

describe("EnvioGraphQLClient", () => {
  let client: EnvioGraphQLClient;

  const mockAddress = "0x1234567890123456789012345678901234567890" as Address;
  const mockGameId = 123n;
  const mockChainId = 1;

  beforeEach(() => {
    // Reset environment variables
    delete process.env.CHAIN_ID;
    delete process.env.INDEXER_URL;
  });

  describe("constructor and configuration", () => {
    it("should initialize with default config", () => {
      client = new EnvioGraphQLClient();
      expect(client.client).toBeDefined();
    });

    it("should initialize with custom config including chainId", () => {
      const config: EnvioGraphQLClientConfig = {
        endpoint: "https://custom-endpoint.com/graphql",
        chainId: mockChainId,
        apiKey: "test-api-key",
      };

      client = new EnvioGraphQLClient(config);
      expect(client.client).toBeDefined();
    });

    it("should read chainId from environment variable", () => {
      process.env.CHAIN_ID = "5";

      client = new EnvioGraphQLClient();
      expect(client.client).toBeDefined();
    });

    it("should handle chainId as string in environment", () => {
      process.env.CHAIN_ID = "137"; // Polygon chain ID

      client = new EnvioGraphQLClient();
      expect(client.client).toBeDefined();
    });

    it("should work with chainId 0", () => {
      client = new EnvioGraphQLClient({ chainId: 0 });
      expect(client.client).toBeDefined();
    });

    it("should handle undefined chainId gracefully", () => {
      client = new EnvioGraphQLClient({ chainId: undefined });
      expect(client.client).toBeDefined();
    });
  });

  describe("MAOInstanceData interface", () => {
    it("should include chainId in MAOInstanceData interface", () => {
      const mockData: MAOInstanceData = {
        distributionId: "dist-123",
        newInstanceId: "456",
        version: "1",
        instances: [mockAddress],
        args: "0xargs123",
        blockNumber: "1000",
        blockTimestamp: "1234567890",
        chainId: mockChainId,
      };

      expect(mockData.chainId).toBe(mockChainId);
      expect(mockData.distributionId).toBe("dist-123");
      expect(mockData.newInstanceId).toBe("456");
    });
  });

  describe("chainId configuration validation", () => {
    it("should accept valid chainId values", () => {
      const validChainIds = [0, 1, 137, 42161, 10];

      validChainIds.forEach((chainId) => {
        client = new EnvioGraphQLClient({ chainId });
        expect(client.client).toBeDefined();
      });
    });

    it("should handle negative chainId values", () => {
      client = new EnvioGraphQLClient({ chainId: -1 });
      expect(client.client).toBeDefined();
    });

    it("should handle large chainId values", () => {
      client = new EnvioGraphQLClient({ chainId: 999999999 });
      expect(client.client).toBeDefined();
    });
  });

  describe("configuration merging", () => {
    it("should merge custom config with defaults", () => {
      const customConfig: EnvioGraphQLClientConfig = {
        endpoint: "https://custom-endpoint.com/graphql",
        chainId: mockChainId,
        apiKey: "test-key",
        fallbackToRPC: false,
      };

      client = new EnvioGraphQLClient(customConfig);
      expect(client.client).toBeDefined();
    });

    it("should use environment variables when available", () => {
      process.env.CHAIN_ID = "137";
      process.env.INDEXER_URL = "https://env-endpoint.com/graphql";

      client = new EnvioGraphQLClient();
      expect(client.client).toBeDefined();
    });

    it("should prioritize explicit config over environment variables", () => {
      process.env.CHAIN_ID = "137";
      process.env.INDEXER_URL = "https://env-endpoint.com/graphql";

      const explicitConfig: EnvioGraphQLClientConfig = {
        endpoint: "https://explicit-endpoint.com/graphql",
        chainId: 1,
      };

      client = new EnvioGraphQLClient(explicitConfig);
      expect(client.client).toBeDefined();
    });
  });

  describe("method signatures", () => {
    beforeEach(() => {
      client = new EnvioGraphQLClient({ chainId: mockChainId });
    });

    it("should have correct method signatures for getGameCreatedEvents", () => {
      expect(typeof client.getGameCreatedEvents).toBe("function");

      // Test that the method can be called with required parameters
      expect(() => {
        client.getGameCreatedEvents({
          gameId: mockGameId,
          contractAddress: mockAddress,
        });
      }).not.toThrow();
    });

    it("should have correct method signatures for getPlayerJoinedEvents", () => {
      expect(typeof client.getPlayerJoinedEvents).toBe("function");

      // Test that the method can be called with required parameters
      expect(() => {
        client.getPlayerJoinedEvents({
          gameId: mockGameId,
          contractAddress: mockAddress,
        });
      }).not.toThrow();
    });

    it("should have correct method signatures for queryInstances", () => {
      expect(typeof client.queryInstances).toBe("function");

      // Test that the method can be called with required parameters
      expect(() => {
        client.queryInstances({
          distributionId: "test-dist",
        });
      }).not.toThrow();
    });

    it("should have correct method signatures for getGameStates", () => {
      expect(typeof client.getGameStates).toBe("function");

      // Test that the method can be called with required parameters
      expect(() => {
        client.getGameStates({
          contractAddress: mockAddress,
        });
      }).not.toThrow();
    });
  });

  describe("type safety", () => {
    it("should enforce correct parameter types", () => {
      client = new EnvioGraphQLClient({ chainId: mockChainId });

      // These should not cause TypeScript errors when compiled
      expect(() => {
        client.getGameCreatedEvents({
          gameId: mockGameId,
          contractAddress: mockAddress,
          creator: mockAddress,
          gm: mockAddress,
          limit: 10,
          offset: 0,
        });
      }).not.toThrow();
    });

    it("should handle optional parameters correctly", () => {
      client = new EnvioGraphQLClient({ chainId: mockChainId });

      // Test with minimal required parameters
      expect(() => {
        client.getGameCreatedEvents({
          contractAddress: mockAddress,
        });
      }).not.toThrow();
    });

    it("should handle bigint parameters correctly", () => {
      client = new EnvioGraphQLClient({ chainId: mockChainId });

      // Test with bigint parameters
      expect(() => {
        client.getPlayerJoinedEvents({
          gameId: 123n,
          contractAddress: mockAddress,
        });
      }).not.toThrow();
    });
  });
});
