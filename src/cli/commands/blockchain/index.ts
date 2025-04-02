import { Command } from "commander";
import { mineBlock } from "./mineBlock";

export const blockchainCommand = new Command("blockchain")
  .description("Blockchain utility commands")
  .addCommand(mineBlock);
