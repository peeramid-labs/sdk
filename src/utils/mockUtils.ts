import { jest } from "@jest/globals";
import { type Address, type Hash, type PublicClient, type WalletClient, type TransactionReceipt } from "viem";
import { EnvioGraphQLClient } from "../utils/EnvioGraphQLClient";

// Common mock chain
export const MOCK_CHAIN = {
  id: 31337, // localhost
  name: "Arbitrum One",
  network: "arbitrum",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://arb1.arbitrum.io/rpc"] },
  },
} as const;

// Common mock hashes
export const MOCK_HASHES = {
  TRANSACTION: "0x0000000000000000000000000000000000000000000000000000000000000123" as Hash,
  BLOCK: "0x0000000000000000000000000000000000000000000000000000000000000456" as Hash,
};

// Common mock addresses
export const MOCK_ADDRESSES = {
  DISTRIBUTOR: "0x1234567890123456789012345678901234567890" as Address,
  RANK_TOKEN: "0x1234567890123456789012345678901234567891" as Address,
  GOVT_TOKEN: "0x1234567890123456789012345678901234567892" as Address,
  GOVT_ACCESS_MANAGER: "0x1234567890123456789012345678901234567893" as Address,
  ACID_ACCESS_MANAGER: "0x1234567890123456789012345678901234567894" as Address,
  ACID_INSTANCE: "0x1234567890123456789012345678901234567895" as Address,
  OWNER: "0x1234567890123456789012345678901234567896" as Address,
  PLAYER: "0x1234567890123456789012345678901234567897" as Address,
  PROPOSER: "0x51cBF46016252921b268EBD47d0a0389F7B93cC0" as Address,
  GAME_MASTER: "0x1234567890123456789012345678901234567898" as Address,
  INSTANCE: "0x1234567890123456789012345678901234567899" as Address,
};

// Common mock functions
export const createMockPublicClient = (overrides = {}) =>
  ({
    readContract: jest.fn(() => Promise.resolve(0n)),
    simulateContract: jest.fn(() => Promise.resolve({ request: {} })),
    waitForTransactionReceipt: jest.fn(() => Promise.resolve(createMockTransactionReceipt())),
    getContractEvents: jest.fn(() => Promise.resolve([])),
    getBlockNumber: jest.fn(() => Promise.resolve(1000n)),
    getBytecode: jest.fn(({ blockNumber }) => Promise.resolve(blockNumber >= 100n ? "0x1234" : "0x")),
    request: jest.fn(),
    chain: MOCK_CHAIN,
    ...overrides,
  }) as unknown as PublicClient;

export const createMockWalletClient = (overrides = {}) =>
  ({
    writeContract: jest.fn(() => Promise.resolve(MOCK_HASHES.TRANSACTION)),
    account: {
      address: MOCK_ADDRESSES.OWNER,
      type: "json-rpc",
      source: "local",
      signMessage: async () => "0x" as Hash,
      signTransaction: async () => "0x" as Hash,
      signTypedData: async () => "0x" as Hash,
    },
    chain: MOCK_CHAIN,
    key: "wallet",
    name: "Wallet Client",
    pollingInterval: 4000,
    request: jest.fn(),
    transport: { type: "http" },
    type: "walletClient",
    uid: "test",
    extend: jest.fn(),
    ...overrides,
  }) as unknown as WalletClient;

// Common mock receipt
export const createMockTransactionReceipt = (overrides = {}): TransactionReceipt => ({
  blockNumber: BigInt(1),
  blockHash: MOCK_HASHES.BLOCK,
  transactionIndex: 0,
  status: "success",
  contractAddress: MOCK_ADDRESSES.DISTRIBUTOR,
  from: MOCK_ADDRESSES.OWNER,
  to: MOCK_ADDRESSES.DISTRIBUTOR,
  logs: [],
  logsBloom: "0x",
  gasUsed: BigInt(1000),
  cumulativeGasUsed: BigInt(1000),
  effectiveGasPrice: BigInt(1000),
  transactionHash: MOCK_HASHES.TRANSACTION,
  type: "eip1559",
  ...overrides,
});

export const createMockEnvioClient = () => {
  const mockClient = {
    getProposalSubmittedEvents: jest.fn(),
    getVoteSubmittedEvents: jest.fn(() => Promise.resolve([])),
    getTurnEndedEvents: jest.fn(),
    getGameCreatedEvents: jest.fn(),
    getPlayerJoinedEvents: jest.fn(),
    getGameStartedEvents: jest.fn(),
    getGameOverEvents: jest.fn(),
    getMAOInstances: jest.fn(),
    queryInstances: jest.fn(),
  };

  return mockClient as unknown as EnvioGraphQLClient;
};
