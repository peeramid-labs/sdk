const fs = require("fs");
const path = require("path");
const { inspect } = require("util");

function processAbiFile(sourcePath, destDir) {
  const content = fs.readFileSync(sourcePath, "utf8");
  const fileName = path.basename(sourcePath, ".json");
  const destPath = path.join(destDir, `${fileName}.ts`);
  console.log("parsing abi file", sourcePath);
  // Convert JSON to TypeScript
  const tsContent = `export const ${fileName}Abi = ${JSON.stringify(JSON.parse(content), null, 2)} as const; export default ${fileName}Abi;`;
  fs.writeFileSync(destPath, tsContent);
}

function copyAbiFiles(source, destDir) {
  const files = fs.readdirSync(source);

  files.forEach((file) => {
    const sourcePath = path.join(source, file);

    if (fs.lstatSync(sourcePath).isDirectory()) {
      copyAbiFiles(sourcePath, destDir);
    } else if (file.endsWith(".json")) {
      processAbiFile(sourcePath, destDir);
    }
  });
}

// Ensure src/abis directory exists
const abiDestDir = path.join(__dirname, "../src/abis");
if (!fs.existsSync(abiDestDir)) {
  fs.mkdirSync(abiDestDir, { recursive: true });
}

// Copy rankify-contracts ABIs
const rankifyAbiSource = path.join(__dirname, "../node_modules/rankify-contracts/abi");
if (fs.existsSync(rankifyAbiSource)) {
  copyAbiFiles(rankifyAbiSource, abiDestDir);
}

// Copy @peeramid-labs ABIs
const peeramidDir = path.join(__dirname, "../node_modules/@peeramid-labs");
if (fs.existsSync(peeramidDir)) {
  fs.readdirSync(peeramidDir).forEach((pkg) => {
    const abiDir = path.join(peeramidDir, pkg, "abi");
    if (fs.existsSync(abiDir)) {
      copyAbiFiles(abiDir, abiDestDir);
    }
  });
}
