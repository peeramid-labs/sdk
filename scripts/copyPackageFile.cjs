const { writeFileSync } = require("fs");
const path = require("path");

const copyPackageFile = () => {
  const packageJson = { ...require("../package.json") };
  delete packageJson.private;

  // packageJson.bin = {
  //   peeramid: "./dist/cli/index.js",
  // };

  // packageJson.main = "./dist/index.js";
  // packageJson.module = "./dist/index.js";
  // packageJson.types = "./dist/index.d.ts";
  // packageJson.exports = {
  //   ".": {
  //     types: "./dist/index.d.ts",
  //     import: "./dist/index.js",
  //     require: "./dist/index.cjs",
  //     default: "./dist/index.js",
  //   },
  //   "./cli": {
  //     types: "./dist/cli/index.d.ts",
  //     import: "./dist/cli/index.js",
  //     require: "./dist/cli/index.cjs",
  //     default: "./dist/cli/index.js",
  //   },
  // };

  writeFileSync(path.join("package.json"), JSON.stringify(packageJson, null, 2));
};

copyPackageFile();
