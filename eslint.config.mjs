import js from "@eslint/js";
import * as parser from "@typescript-eslint/parser";
import * as pluginTs from "@typescript-eslint/eslint-plugin";
import globals from "globals";
import jestPlugin from "eslint-plugin-jest";
import prettierConfig from "eslint-config-prettier";

export default [
  js.configs.recommended,
  {
    ignores: ["**/node_modules/**", "**/dist/**", "src/abis/*.ts", "scripts", "copyPackageFile.js", "zk_artifacts"],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: parser,
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.test.json"],
        tsconfigRootDir: ".",
      },
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    plugins: {
      "@typescript-eslint": pluginTs,
      jest: jestPlugin,
    },
    rules: {
      ...pluginTs.configs.recommended.rules,
      ...jestPlugin.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/await-thenable": "warn",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-require-imports": "off",
      "no-undef": "error",
    },
  },
  {
    files: ["**/__tests__/**/*.ts", "**/*.test.ts"],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    rules: {
      ...jestPlugin.configs.recommended.rules,
    },
  },
  {
    // Override for test utilities files
    files: ["**/test-utils.ts", "**/test-helpers.ts", "src/__tests__/utils.ts"],
    rules: {
      "jest/no-export": "off",
    },
  },
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    ignores: ["src/**/*.ts", "**/node_modules/**", "**/dist/**"],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Add JavaScript-specific rules here if needed
    },
  },
  prettierConfig,
];
