const { writeFileSync } = require("fs");
const path = require("path");
const stage = process.argv[2];
const copyPackageFile = () => {
  const packageJson = require("../package.json");
  console.log("pv", packageJson.version);
  delete packageJson.private;
  console.log("stage is", stage);
  // if (stage === "dev") {
  //   packageJson.dependencies["rankify-contracts"] = "file:../../contracts";
  // }
  packageJson.type = "commonjs";
  packageJson.main = "./lib.commonjs/src/index.js";
  packageJson.module = "./lib.esm/src/index.js";
  packageJson.exports["."] = {
    require: "./lib.commonjs/index.js",
    import: "./lib.esm/src/index.js",
    default: "./lib.esm/src/index.js",
  };
  const tsconfig = require("../tsconfig.json");
  writeFileSync(path.join(tsconfig.compilerOptions.outDir, "package.json"), JSON.stringify(packageJson, null, 2));
};

copyPackageFile();
