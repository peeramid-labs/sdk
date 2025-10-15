/**
 * @file Main entry point for the Rankify SDK
 * Exports core components and utilities for interacting with Peeramid protocol
 */

// Core exports
export { default as Multipass } from "./multipass/Registrar";
export { default as InstanceBase } from "./rankify/InstanceBase";
export { default as InstancePlayer } from "./rankify/Player";
export { default as MultipassBase, type NameQuery } from "./multipass/MultipassBase";
export { default as Registrar } from "./multipass/Registrar";
export { GameMaster } from "./rankify/GameMaster";
export { default as InstanceUBI } from "./ubi/InstanceUBI";

// Utility exports
export * from "./utils";
export * from "./types";
export * from "./rankify/MAODistributor";
export { default as RankTokenClient } from "./rankify/RankToken";

// GraphQL client for indexed data
export { default as EnvioGraphQLClient, type EnvioGraphQLClientConfig } from "./utils/EnvioGraphQLClient";

// Type exports
export { type MAOInstances, type GmProposalParams } from "./types/contracts";
export type { VoteElement, DailyProposal, ProposalGlobalStats, UBIParams, UserState } from "./ubi/InstanceUBI";

// Re-export the abis object
export { abis } from "./abis/index";
