const { writeFileSync } = require("fs");
const path = require("path");
const stage = process.argv[2];
const copyPackageFile = () => {
  const packageJson = { ...require("../package.json") };
  console.log("pv", packageJson.version);
  delete packageJson.private;

  // Add CLI binary
  packageJson.bin = {
    peeramid: "./cli/cli/index.js",
  };

  console.log("stage is", stage);
  // if (stage === "dev") {
  //   packageJson.dependencies["rankify-contracts"] = "file:../../contracts";
  // }
  packageJson.type = "commonjs";
  packageJson.main = "./lib.commonjs/index.js";
  packageJson.module = "./lib.esm/index.js";
  packageJson.exports["."] = {
    require: "./lib.commonjs/index.js",
    import: "./lib.esm/index.js",
    default: "./lib.esm/index.js",
  };
  if (packageJson.dependencies["rankify-contracts"].startsWith("file")) {
    const split = packageJson.dependencies["rankify-contracts"].split("file:");
    packageJson.dependencies["rankify-contracts"] = `file:../${split[1]}`;
  }
  const tsconfig = require("../tsconfig.json");
  writeFileSync(path.join(tsconfig.compilerOptions.outDir, "package.json"), JSON.stringify(packageJson, null, 2));
};

copyPackageFile();
