import { Command } from "commander";
import { pushCommand } from "./push";
import { infoCommand } from "./info";

export const repositoryCommand = new Command("repository")
  .description("Manage EDS repositories")
  .addCommand(pushCommand)
  .addCommand(infoCommand);
