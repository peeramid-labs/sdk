const { writeFileSync } = require("fs");
const path = require("path");
const stage = process.argv[2];
const copyPackageFile = () => {
  const packageJson = require("./package.json");
  console.log("pv", packageJson.version);
  delete packageJson.private;
  console.log("stage is", stage);
  // if (stage === "dev") {
  //   packageJson.dependencies["rankify-contracts"] = "file:../../contracts";
  // }
  packageJson.type = "commonjs";
  packageJson.main = "./lib.commonjs/index.js";
  packageJson.module = "./lib.esm/index.js";
  packageJson.exports["."] = {
    require: "./lib.commonjs/index.js",
    default: "./lib.esm/index.js",
  };
  const tsconfig = require("./tsconfig.json");
  writeFileSync(path.join(tsconfig.compilerOptions.outDir, "package.json"), JSON.stringify(packageJson, null, 2));
};

copyPackageFile();
