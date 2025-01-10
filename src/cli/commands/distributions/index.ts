import { Command } from "commander";
import { listCommand } from "./list";
import { addCommand } from "./add";
import { stateCommand } from "./state";
export const distributionsCommand = new Command("distributions")
  .description("Manage distributions")
  .addCommand(listCommand)
  .addCommand(addCommand)
  .addCommand(stateCommand);
