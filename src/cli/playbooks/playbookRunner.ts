#!/usr/bin/env ts-node

import { createGameMaster } from "./initGameMaster";
import { logError } from "./utils";

/**
 * Simple playbook runner that creates GameMaster and calls the appropriate playbook
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log("Usage: ts-node playbookRunner.ts <playbook_name> [args...]");
    console.log("Available playbooks:");
    console.log("  demo-script");
    console.log("  push-game-to-next-phase");
    process.exit(1);
  }

  const playbookName = args[0];
  const playbookArgs = args.slice(1);

  try {
    // Create GameMaster instance
    const gameMaster = await createGameMaster();

    // Import and run the appropriate playbook
    switch (playbookName) {
      case "demo-script": {
        const { runDemoScript } = await import("./demo-script");
        await runDemoScript(playbookArgs, gameMaster);
        break;
      }
      case "push-game-to-next-phase": {
        const { runPushGameToNextPhase } = await import("./push-game-to-next-phase");
        await runPushGameToNextPhase(playbookArgs, gameMaster);
        break;
      }
      default:
        throw new Error(`Unknown playbook: ${playbookName}`);
    }
  } catch (error) {
    logError(`Playbook ${playbookName} failed:`, error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
