import { Command } from "commander";
import { createFellowshipCommand } from "./create";
import { getMetadataCommand } from "./metadata";
import { list } from "./list";

export const fellowshipsCommand = new Command("fellowship")
  .description("Manage fellowship")
  .addCommand(createFellowshipCommand)
  .addCommand(getMetadataCommand)
  .addCommand(list);
