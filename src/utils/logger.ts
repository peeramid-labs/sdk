import { ApiError } from "./ApiError";
import { logger as baseLogger } from "./log";

/**
 * Logger function for the SDK
 * Re-exports the base logger from log.ts
 */
export const logger = baseLogger;

/**
 * Re-export ApiError for convenience
 */
export { ApiError };
