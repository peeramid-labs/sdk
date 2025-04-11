import { Command } from "commander";
import { mine } from "./mine";

export const blockchainCommand = new Command("blockchain")
  .description("Blockchain utility commands")
  .addCommand(mine);
