import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PACKAGES_WITH_DEPLOYMENTS = ["@peeramid-labs/multipass", "rankify-contracts"];

function findDeploymentDirs(packagePath) {
  try {
    const deploymentsPath = path.join(packagePath, "deployments");
    if (!fs.existsSync(deploymentsPath)) return [];

    return fs.readdirSync(deploymentsPath).filter((dir) => {
      try {
        return fs.statSync(path.join(deploymentsPath, dir)).isDirectory();
      } catch (err) {
        console.warn(`Error checking directory ${dir}:`, err);
        return false;
      }
    });
  } catch (err) {
    console.warn(`Error reading deployments directory:`, err);
    return [];
  }
}

function getChainId(packagePath, deploymentDir) {
  try {
    const chainIdPath = path.join(packagePath, "deployments", deploymentDir, ".chainId");
    if (!fs.existsSync(chainIdPath)) {
      console.warn(`No .chainId file found in ${deploymentDir}`);
      return null;
    }

    const chainId = fs.readFileSync(chainIdPath, "utf-8").trim();
    const parsedId = parseInt(chainId, 10);
    if (isNaN(parsedId)) {
      console.warn(`Invalid chain ID in ${chainIdPath}: ${chainId}`);
      return null;
    }
    return parsedId;
  } catch (err) {
    console.warn(`Error reading chainId for ${deploymentDir}:`, err);
    return null;
  }
}

async function formatFile(filePath) {
  try {
    console.log("Running prettier...");
    await execAsync(`pnpm prettier --write "${filePath}"`);
    console.log("Running eslint...");
    await execAsync(`pnpm eslint --fix "${filePath}"`);
    console.log("Formatting complete!");
  } catch (err) {
    console.warn("Error running formatters:", err);
  }
}

async function generateMapping() {
  try {
    const mapping = {
      31337: "localhost",
    };
    const projectRoot = path.resolve(__dirname, "..");

    for (const pkg of PACKAGES_WITH_DEPLOYMENTS) {
      const packagePath = path.join(projectRoot, "node_modules", pkg);
      if (!fs.existsSync(packagePath)) {
        console.warn(`Package ${pkg} not found in node_modules`);
        continue;
      }

      const deploymentDirs = findDeploymentDirs(packagePath);
      console.log(`Found deployment directories for ${pkg}:`, deploymentDirs);

      for (const dir of deploymentDirs) {
        const chainId = getChainId(packagePath, dir);
        if (chainId !== null) {
          mapping[chainId] = dir;
          console.log(`Mapped chain ID ${chainId} to ${dir}`);
        }
      }
    }

    // Generate TypeScript file
    const tsContent = `// This file is auto-generated. Do not edit manually.
export type ChainMapping = Record<string, string>;

export const chainToPath: ChainMapping = ${JSON.stringify(mapping, null, 2)} as const;

export function getChainPath(chainId: number): string {
  const path = chainToPath[chainId.toString() as keyof typeof chainToPath];
  if (!path) {
    return "Custom network";
  }
  return path;
}
`;

    const outputPath = path.join(projectRoot, "src", "utils", "chainMapping.ts");
    fs.writeFileSync(outputPath, tsContent);
    console.log(`Chain mapping generated successfully at ${outputPath}`);
    console.log("Mapping contents:", mapping);

    // Format the generated file
    await formatFile(outputPath);
  } catch (err) {
    console.error("Error generating chain mapping:", err);
    process.exit(1);
  }
}

generateMapping().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
