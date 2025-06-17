import { MAOInstances } from "../types/contracts";

export * from "./ApiError";
export * from "./artifacts";

/**
 * Parse an array of contract addresses into a MAOInstances object
 * @param instances - Array of contract addresses in the order they were deployed
 * @returns MAOInstances object with named contract addresses
 */
export const parseInstantiated = (instances: readonly string[]): MAOInstances => {
  return {
    govToken: instances[0],
    govTokenAccessManager: instances[1],
    governor: instances[2],
    ACIDInstance: instances[3],
    ACIDAccessManager: instances[4],
    rankToken: instances[5],
  };
};
