import { Command } from "commander";
import { createFellowshipCommand } from "./create";
import { list } from "./list";
import { getMetadataCommand } from "./metadata";
import { eip712Command } from "./eip712";

export const fellowshipCommand = new Command("fellowship")
  .description("Fellowship contract commands")
  .addCommand(createFellowshipCommand)
  .addCommand(list)
  .addCommand(getMetadataCommand)
  .addCommand(eip712Command);
