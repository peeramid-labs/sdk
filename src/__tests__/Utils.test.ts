import { describe, expect, test } from "@jest/globals";
import { createMockPublicClient, createMockWalletClient, MOCK_CHAIN } from "../utils/mockUtils";

// Add tests
describe("Test utilities", () => {
  test("createMockPublicClient should return a client with expected methods", () => {
    const client = createMockPublicClient();
    expect(client.readContract).toBeDefined();
    expect(client.simulateContract).toBeDefined();
    expect(client.waitForTransactionReceipt).toBeDefined();
    expect(client.getContractEvents).toBeDefined();
    expect(client.getBlockNumber).toBeDefined();
    expect(client.getBytecode).toBeDefined();
    expect(client.request).toBeDefined();
    expect(client.chain).toBeDefined();
    expect((client.chain as typeof MOCK_CHAIN).id).toBe(31337);
  });

  test("createMockWalletClient should return a client with expected methods", () => {
    const client = createMockWalletClient();
    expect(client.writeContract).toBeDefined();
  });
});
