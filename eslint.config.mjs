import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    // Base configuration for all files
    ignores: ["**/node_modules/**", "**/dist/**", "src/abis/*.ts", "scripts", "copyPackageFile.js"],
  },
  {
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    // TypeScript files configuration
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.test.json"],
        tsconfigRootDir: ".",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/await-thenable": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    // JavaScript files configuration
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    ignores: ["src/**/*.ts", "**/node_modules/**", "**/dist/**"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      sourceType: "module",
    },
    rules: {
      // Add JavaScript-specific rules here if needed
    },
  }
);
