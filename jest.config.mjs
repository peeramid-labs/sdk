/** @type {import('jest').Config} */
export default {
  testEnvironment: "node",
  transform: {
    "^.+\\.(t|j)sx?$": ["@swc/jest"],
  },
  transformIgnorePatterns: [],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node", "mjs"],
  modulePathIgnorePatterns: ["<rootDir>/dist/"],
};
