const fs = require("fs");
const path = require("path");
const { inspect } = require("util");

function processAbiFile(sourcePath, destDir) {
  const content = fs.readFileSync(sourcePath, "utf8");
  const fileName = path.basename(sourcePath, ".json").replace("-", "");
  const destPath = path.join(destDir, `${fileName.replace("-", "")}.ts`);
  console.log("parsing abi file", sourcePath);
  // Convert JSON to TypeScript with both a named export and a default export
  const tsContent = `export const ${fileName}Abi = ${JSON.stringify(JSON.parse(content), null, 2)} as const;\nexport default ${fileName}Abi;`;
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

function generateIndexFile(destDir) {
  const files = fs.readdirSync(destDir);
  const tsFiles = files.filter((file) => file.endsWith(".ts") && file !== "index.ts");

  // Create imports
  const imports = tsFiles
    .map((file) => {
      const name = path.basename(file, ".ts").replace("-", "");
      return `import { ${name}Abi } from './${name}';`;
    })
    .join("\n");

  // Create named exports
  const namedExports = tsFiles
    .map((file) => {
      const name = path.basename(file, ".ts");
      return `export { ${name}Abi } from './${name}';`;
    })
    .join("\n");

  // Create the abis object
  const abiObjectEntries = tsFiles
    .filter((file) => path.basename(file, ".ts") == "superinterface")
    .map((file) => {
      const name = path.basename(file, ".ts");
      return `  ${name}Abi`;
    })
    .join(",\n");

  const indexContent = `${imports}

// Re-export all ABIs
${namedExports}

// Create and export the abis object
const abis = {
${abiObjectEntries}
} as const;

export { abis };
export default abis;
`;

  fs.writeFileSync(path.join(destDir, "index.ts"), indexContent);
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

// Generate index file
generateIndexFile(abiDestDir);

fs.cpSync("./node_modules/rankify-contracts/zk_artifacts/", "./zk_artifacts", { recursive: true });
