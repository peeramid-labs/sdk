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
export { default as GameMaster } from "./rankify/GameMaster";

// Utility exports
export * from "./utils";
export * from "./types";
export * from "./rankify/MAODistributor";
export { default as RankTokenClient } from "./rankify/RankToken";

// Type exports
export { type MAOInstances, type GmProposalParams } from "./types/contracts";

// Re-export the abis object
export { abis } from "./abis/index";
