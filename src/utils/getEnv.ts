/**
 * Safely retrieves an environment variable
 * @param print - If true, masks the value with 'X' characters
 * @param key - The environment variable key to retrieve
 * @returns The environment variable value or masked value
 * @throws Error if environment variable is not set
 */
export function getProcessEnv(print: boolean, key: string) {
  const ret = process.env[key];
  if (!ret) {
    throw new Error(key + " must be exported in env");
  }
  return print ? "X".repeat(ret.length) : ret;
}
