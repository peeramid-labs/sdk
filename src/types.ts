/**
 * @file Core type definitions for the Peeramid SDK
 */

import { Address, Hex, WalletClient } from "viem";

/**
 * Criteria used for searching entities in the system
 */
export enum SearchCriteria {
  id,
  username,
  address,
}

/**
 * Represents a signer's identity in the system
 */
export interface SignerIdentity {
  /** User's display name */
  name: string;
  /** Unique identifier for the user */
  id: string;
  /** Wallet client associated with the signer */
  wallet: WalletClient;
}

/**
 * Message structure for user registration
 */
export interface RegisterMessage {
  /** Hex encoded name */
  name: Hex;
  /** Hex encoded unique identifier */
  id: Hex;
  /** Hex encoded domain name */
  domainName: Hex;
  /** Timestamp until which the registration is valid */
  validUntil: bigint;
  /** Registration nonce */
  nonce: bigint;
}

export enum SUBMISSION_TYPES {
  MARKDOWN = "MARKDOWN",
  IMAGE = "IMAGE",
  VIDEO = "VIDEO",
  AUDIO = "AUDIO",
  BYTES = "BYTES",
}

export enum CONTENT_STORAGE {
  IPFS = "IPFS",
  ARWEAVE = "ARWEAVE",
  USER_URL = "USER_URL",
}

/**
 * Represents a submission allowed for a fellowship thread
 * @public
 * @param type - Type of the submission
 * @param rules - Rules for the submission
 * @param customValidation - Custom validation rules for the submission
 * @param store_at - Where the submission will be stored
 */
export interface Submission {
  type: SUBMISSION_TYPES;
  rules: AudioRules | VideoRules | ImageRules | TextRules | BytesRules;
  customValidation?: ValidationRule[];
  store_at: CONTENT_STORAGE;
}
/**
 * Metadata for a fellowship
 * @public
 * @see https://docs.opensea.io/docs/contract-level-metadata
 * @param name - Name of the fellowship
 * @param description - Description of the fellowship
 * @param image - Image of the fellowship
 * @param banner_image - Banner image of the fellowship
 * @param featured_image - Featured image of the fellowship
 * @param external_link - External link of the fellowship
 * @param collaborators - Addresses of the collaborators of the fellowship
 * @param submissions - Submissions allowed for the fellowship threads
 */
export type FellowshipMetadata = {
  // extends https://docs.opensea.io/docs/contract-level-metadata
  name: string;
  description: string;
  image: string; // ar://<hash> or ipfs://<hash> or https://<url>
  banner_image?: string;
  featured_image?: string;
  external_link?: string;
  collaborators?: Address[];
  submissions: Submission[];
};

/**
 * Metadata for a game
 * @public
 * @param name - Name of the game
 * @param description - Description of the game
 * @param image - Image of the game
 * @param banner_image - Banner image of the game
 * @param featured_image - Featured image of the game
 * @param tags - Tags of the game
 * @param submissions - Submissions allowed for the game
 */
export interface GameMetadata<T extends FellowshipMetadata> {
  //Represents game. Can be issued as unique NFT in theory
  name: string;
  description: string;
  image?: string;
  banner_image?: string;
  featured_image?: string;
  tags?: string[];
  submissions: Partial<T>["submissions"];
}

export type MediaFormat = {
  mimeTypes: string[];
  maxSizeBytes?: number;
  minSizeBytes?: number;
};

export type AudioRules = MediaFormat & {
  maxDurationSeconds?: number;
  minDurationSeconds?: number;
  allowedEncodings?: string[]; // e.g., ['mp3', 'wav', 'ogg']
  minBitrate?: number;
  maxBitrate?: number;
};

export type VideoRules = AudioRules & {
  minResolution?: { width: number; height: number };
  maxResolution?: { width: number; height: number };
  maxFrameRate?: number;
  minFrameRate?: number;
};

export type ImageRules = MediaFormat & {
  minResolution?: { width: number; height: number };
  maxResolution?: { width: number; height: number };
  allowedFormats?: string[]; // e.g., ['jpeg', 'png', 'webp']
  maxAspectRatio?: number;
  minAspectRatio?: number;
};

export type TextRules = {
  minLength?: number;
  maxLength?: number;
  allowedFormats?: string[]; // e.g., ['plain', 'markdown', 'html']
  allowedCharsets?: string[]; // e.g., ['utf-8', 'ascii']
};

export type BytesRules = {
  minSize?: number;
  maxSize?: number;
  allowedEncodings?: string[]; // e.g., ['base64', 'hex']
};

export type SubmissionContent = {
  AUDIO: {
    data: ArrayBuffer;
    duration: number;
    bitrate?: number;
    channels?: number;
    sampleRate?: number;
  };
  VIDEO: {
    data: ArrayBuffer;
    duration: number;
    width: number;
    height: number;
    frameRate?: number;
    bitrate?: number;
  };
  IMAGE: {
    data: ArrayBuffer;
    width: number;
    height: number;
    format: string;
  };
  MARKDOWN: {
    content: string;
    length: number;
  };
  BYTES: {
    data: ArrayBuffer;
    size: number;
    encoding?: string;
  };
}[SUBMISSION_TYPES];

export type ValidationRule = {
  type: "script_url" | "regex" | "function";
  value: string | ((content: SubmissionContent) => boolean);
  errorMessage: string;
};

/**
 * Enum representing different states of a game instance
 * @public
 */
export enum gameStatusEnum {
  /** Game has been created but not opened for registration */
  created = "Game created",
  /** Game is open for player registration */
  open = "Registration open",
  /** Game is in progress */
  started = "In progress",
  /** Game is in its final turn */
  lastTurn = "Playing last turn",
  /** Game is in overtime */
  overtime = "PLaying in overtime",
  /** Game has finished */
  finished = "Finished",
  /** Game was not found */
  notFound = "not found",
}

/// JOIN REQUIREMENTS, ACCORDING TO libCoinVending.sol

export interface numericConditon {
  have: bigint;
  lock: bigint;
  burn: bigint;
  pay: bigint;
  bet: bigint;
}

export interface JoinRequirementsInput {
  ethValues: numericConditon;
  contracts: configSmartRequirement[];
}

export interface configSmartRequirement {
  contractAddress: Address;
  contractId: string;
  contractType: ContractTypes;
  contractRequirement: ContractCondition;
}

export interface ContractCondition {
  have: TransactionProperties;
  lock: TransactionProperties;
  burn: TransactionProperties;
  pay: TransactionProperties;
  bet: TransactionProperties;
}

export interface TransactionProperties {
  data: Hex;
  amount: bigint;
}

export enum ContractTypes {
  ERC20,
  ERC1155,
  ERC721,
}
