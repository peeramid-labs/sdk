import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";

export const playbookCommand = new Command("playbook")
  .description("Execute playbook scripts from the playbooks folder")
  .argument("<playbook-name>", "Name of the playbook to execute (without .sh extension)")
  .option("-f, --fellowship-id <id>", "Fellowship ID", "1")
  .option("-g, --game-id <id>", "Game ID", "1")
  .option("--run-to-turn <turn>", "Run up to this turn number")
  .option("--finish-turn <boolean>", "Whether to finish the last turn (true/false)")
  .allowUnknownOption(true) // Allow passing through other options to the script
  .action(async (playbookName, options, command) => {
    const playbooksDir = path.join(__dirname, "../playbooks");
    const playbookFile = path.join(playbooksDir, `${playbookName}.sh`);

    // Check if the playbook exists
    if (!fs.existsSync(playbookFile)) {
      console.error(`Error: Playbook '${playbookName}' not found in ${playbooksDir}`);
      console.log("Available playbooks:");
      
      // List available playbooks
      const playbooks = fs.readdirSync(playbooksDir)
        .filter(file => file.endsWith(".sh"))
        .map(file => file.replace(".sh", ""));
      
      playbooks.forEach(pb => console.log(`  - ${pb}`));
      return;
    }

    // Build command arguments
    const fellowshipId = options.fellowshipId;
    const gameId = options.gameId;
    
    let args = [fellowshipId, gameId];
    
    // Add optional arguments if provided
    if (options.runToTurn) {
      args.push(options.runToTurn);
      
      if (options.finishTurn) {
        args.push(options.finishTurn);
      }
    }
    
    // Get any passthrough arguments
    const passthroughArgs = command.args.slice(1); // Skip the playbook name
    
    // Execute the playbook
    console.log(`Executing playbook: ${playbookName}`);
    console.log(`Using fellowshipId=${fellowshipId}, gameId=${gameId}`);
    
    const cmd = `bash ${playbookFile} ${args.join(" ")} ${passthroughArgs.join(" ")}`;
    console.log(`Running: ${cmd}`);
    
    const childProcess = exec(cmd);
    
    childProcess.stdout?.on("data", (data) => {
      process.stdout.write(data);
    });
    
    childProcess.stderr?.on("data", (data) => {
      process.stderr.write(data);
    });
    
    childProcess.on("close", (code) => {
      console.log(`Playbook execution completed with code ${code}`);
    });
  });
