import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import RankTokenClient from "../RankToken";
import { SUBMISSION_TYPES, CONTENT_STORAGE, FellowshipMetadata } from "../../types";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

// Mock fetch globally
global.fetch = jest.fn(() =>
  Promise.resolve(
    new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  )
);

describe("RankTokenClient", () => {
  let rankToken: RankTokenClient;
  let mockFetch: jest.Mock;
  // Clean up mocks after each test
  afterEach(() => {
    jest.clearAllMocks();
  });
  beforeEach(() => {
    // Create a new instance before each test
    const publicClient = createPublicClient({
      chain: mainnet,
      transport: http(),
    });

    rankToken = new RankTokenClient({
      chainId: 1,
      address: "0x123",
      publicClient,
    });

    // Mock fetch with proper typing
    mockFetch = jest.fn();
    // eslint-disable-next-line
    (global as any).fetch = mockFetch;
  });

  describe("getMetadata", () => {
    const validMetadata: FellowshipMetadata = {
      name: "The MIAO Fellowship",
      description:
        "The Meritocratic Interplanetary Autonomous Organization Protocol Council is the decentralized managerial body that governs the development and evolution and growth of Peeramid Network.",
      image: "https://tma.rankify.it/logo.png",
      external_link: "https://tma.rankify.it",
      submissions: [
        {
          type: "MARKDOWN" as SUBMISSION_TYPES,
          rules: {
            minLength: 0,
            maxLength: 10000,
            allowedFormats: ["markdown"],
            allowedCharsets: ["utf-8", "utf-16", "utf-32"],
          },
          customValidation: [],
          store_at: "IPFS" as CONTENT_STORAGE,
        },
      ],
    };

    it("should handle IPFS URIs correctly", async () => {
      // Mock the contract URI call
      jest.spyOn(rankToken, "getRankTokenURI").mockResolvedValue("ipfs://test-hash");

      // Mock fetch response
      mockFetch.mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify(validMetadata), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      );

      const metadata = await rankToken.getMetadata("https://peeramid.infura-ipfs.io/ipfs/");

      expect(mockFetch).toHaveBeenCalledWith("https://peeramid.infura-ipfs.io/ipfs/test-hash");
      expect(metadata).toEqual(validMetadata);
    });

    it("should handle Arweave URIs correctly", async () => {
      // Mock the contract URI call
      jest.spyOn(rankToken, "getRankTokenURI").mockResolvedValue("ar://test-hash");

      // Mock fetch response
      mockFetch.mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify(validMetadata), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      );

      const metadata = await rankToken.getMetadata("https://peeramid.infura-ipfs.io/ipfs/");

      expect(mockFetch).toHaveBeenCalledWith("https://arweave.net/test-hash");
      expect(metadata).toEqual(validMetadata);
    });

    it("should throw error for invalid metadata format", async () => {
      // Mock the contract URI call
      jest.spyOn(rankToken, "getRankTokenURI").mockResolvedValue("https://test.com");

      // Mock fetch response with invalid metadata
      const invalidMetadata = {
        name: "Test",
        // Missing required fields
      };

      mockFetch.mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify(invalidMetadata), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      );

      await expect(rankToken.getMetadata("https://peeramid.infura-ipfs.io/ipfs/")).rejects.toThrow(
        "Invalid metadata format"
      );
    });

    it("should throw error for non-JSON response", async () => {
      // Mock the contract URI call
      jest.spyOn(rankToken, "getRankTokenURI").mockResolvedValue("https://test.com");

      // Mock fetch response with non-JSON data
      mockFetch.mockImplementation(() =>
        Promise.resolve(
          new Response("Not JSON", {
            status: 200,
            headers: { "Content-Type": "text/plain" },
          })
        )
      );

      await expect(rankToken.getMetadata("https://peeramid.infura-ipfs.io/ipfs/")).rejects.toThrow();
    });

    it("should throw error for HTTP error", async () => {
      // Mock the contract URI call
      jest.spyOn(rankToken, "getRankTokenURI").mockResolvedValue("https://test.com");

      // Mock fetch response with error status
      mockFetch.mockImplementation(() =>
        Promise.resolve(
          new Response("Not Found", {
            status: 404,
          })
        )
      );

      await expect(rankToken.getMetadata("https://peeramid.infura-ipfs.io/ipfs/")).rejects.toThrow(
        "HTTP error! status: 404"
      );
    });

    it("should validate complex metadata with all optional fields", async () => {
      // Mock the contract URI call
      jest.spyOn(rankToken, "getRankTokenURI").mockResolvedValue("https://test.com");

      const complexMetadata: FellowshipMetadata = {
        ...validMetadata,
        banner_image: "ipfs://banner-hash",
        featured_image: "ipfs://featured-hash",
        external_link: "https://example.com",
        collaborators: ["0x123", "0x456"],
        submissions: [
          {
            type: SUBMISSION_TYPES.AUDIO,
            rules: {
              mimeTypes: ["audio/mp3"],
              maxSizeBytes: 10000000,
              maxDurationSeconds: 300,
            },
            store_at: CONTENT_STORAGE.IPFS,
          },
          {
            type: SUBMISSION_TYPES.IMAGE,
            rules: {
              mimeTypes: ["image/jpeg", "image/png"],
              maxSizeBytes: 5000000,
            },
            store_at: CONTENT_STORAGE.ARWEAVE,
          },
        ],
      };

      mockFetch.mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify(complexMetadata), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      );

      const metadata = await rankToken.getMetadata("https://peeramid.infura-ipfs.io/ipfs/");
      expect(metadata).toEqual(complexMetadata);
    });
  });
});
