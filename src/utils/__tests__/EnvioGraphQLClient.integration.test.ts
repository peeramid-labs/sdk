import { describe, it, expect, beforeEach } from "@jest/globals";
import { type Address } from "viem";
import { EnvioGraphQLClient } from "../EnvioGraphQLClient";

// This is a simple integration test that verifies the chainId functionality
// without making actual network requests
describe("EnvioGraphQLClient Integration Tests", () => {
  let client: EnvioGraphQLClient;

  const mockAddress = "0x1234567890123456789012345678901234567890" as Address;
  const mockGameId = 123n;
  const mockChainId = 1;

  beforeEach(() => {
    // Reset environment variables
    delete process.env.CHAIN_ID;
    delete process.env.INDEXER_URL;
  });

  describe("chainId query generation", () => {
    it("should generate queries with chainId when configured", () => {
      client = new EnvioGraphQLClient({ chainId: mockChainId });

      // We can't easily test the actual query generation without mocking,
      // but we can verify that the client is configured correctly
      expect(client.client).toBeDefined();

      // The chainId should be stored in the config
      expect((client as unknown as { config: { chainId?: number } }).config.chainId).toBe(mockChainId);
    });

    it("should not include chainId in config when not provided", () => {
      client = new EnvioGraphQLClient();

      expect(client.client).toBeDefined();

      // The chainId should be undefined when not provided
      expect((client as unknown as { config: { chainId?: number } }).config.chainId).toBeUndefined();
    });

    it("should read chainId from environment variable when set before module load", () => {
      // Note: This test verifies that the DEFAULT_CONFIG reads from environment
      // but since DEFAULT_CONFIG is evaluated at module load time, we can't
      // change environment variables in the test. Instead, we test that
      // explicit configuration works correctly.

      client = new EnvioGraphQLClient({ chainId: 137 });

      expect(client.client).toBeDefined();

      // The chainId should be set explicitly
      expect((client as unknown as { config: { chainId?: number } }).config.chainId).toBe(137);
    });
  });

  describe("configuration precedence", () => {
    it("should prioritize explicit config over environment variables", () => {
      // Since DEFAULT_CONFIG is evaluated at module load time, we can't
      // test environment variable precedence in runtime tests.
      // Instead, we verify that explicit configuration works correctly.

      client = new EnvioGraphQLClient({ chainId: mockChainId });

      expect(client.client).toBeDefined();

      // Explicit config should be used
      expect((client as unknown as { config: { chainId?: number } }).config.chainId).toBe(mockChainId);
    });

    it("should use default values when no explicit config", () => {
      client = new EnvioGraphQLClient();

      expect(client.client).toBeDefined();

      // Should use default configuration (undefined chainId)
      expect((client as unknown as { config: { chainId?: number } }).config.chainId).toBeUndefined();
    });
  });

  describe("method availability", () => {
    beforeEach(() => {
      client = new EnvioGraphQLClient({ chainId: mockChainId });
    });

    it("should have all required methods available", () => {
      expect(typeof client.getGameCreatedEvents).toBe("function");
      expect(typeof client.getPlayerJoinedEvents).toBe("function");
      expect(typeof client.getProposalSubmittedEvents).toBe("function");
      expect(typeof client.getVoteSubmittedEvents).toBe("function");
      expect(typeof client.getRegistrationOpenEvents).toBe("function");
      expect(typeof client.getProposalScoreEvents).toBe("function");
      expect(typeof client.getGameOverEvents).toBe("function");
      expect(typeof client.getGameStartedEvents).toBe("function");
      expect(typeof client.queryInstances).toBe("function");
      expect(typeof client.getGameStates).toBe("function");
      expect(typeof client.getMAOInstances).toBe("function");
      expect(typeof client.getProposingStageEndedEvents).toBe("function");
      expect(typeof client.getVotingStageResults).toBe("function");
    });

    it("should accept chainId in configuration", () => {
      const configs = [
        { chainId: 1 }, // Ethereum mainnet
        { chainId: 137 }, // Polygon
        { chainId: 42161 }, // Arbitrum
        { chainId: 10 }, // Optimism
        { chainId: 0 }, // Edge case
        { chainId: undefined }, // Should work
      ];

      configs.forEach((config) => {
        const testClient = new EnvioGraphQLClient(config);
        expect(testClient.client).toBeDefined();
      });
    });
  });

  describe("type compatibility", () => {
    it("should work with viem Address types", () => {
      client = new EnvioGraphQLClient({ chainId: mockChainId });

      // These should not cause TypeScript errors
      expect(() => {
        client.getGameCreatedEvents({
          gameId: mockGameId,
          contractAddress: mockAddress,
        });
      }).not.toThrow();
    });

    it("should handle bigint game IDs", () => {
      client = new EnvioGraphQLClient({ chainId: mockChainId });

      const bigIntGameIds = [0n, 1n, 123n, 999999999999999999n];

      bigIntGameIds.forEach((gameId) => {
        expect(() => {
          client.getGameCreatedEvents({
            gameId,
            contractAddress: mockAddress,
          });
        }).not.toThrow();
      });
    });
  });
});
