import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/cli/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  splitting: true,
  outDir: "dist",
  bundle: true,
  minify: true,
  sourcemap: true,
  target: "es2020",
  platform: "node",
  external: ["viem"],
});
