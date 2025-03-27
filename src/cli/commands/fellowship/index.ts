import { Command } from "commander";
import { createFellowshipCommand } from "./create";
import { games } from "./games";
import { list } from "./list";
import { getMetadataCommand } from "./metadata";
import { eip712Command } from "./eip712";
import { endTurn } from "./endTurn";
import { paramsCommand } from "./params";
import { cancel } from "./cancel";
export const fellowshipCommand = new Command("fellowship")
  .description("Fellowship contract commands")
  .addCommand(createFellowshipCommand)
  .addCommand(list)
  .addCommand(getMetadataCommand)
  .addCommand(eip712Command)
  .addCommand(games)
  .addCommand(endTurn)
  .addCommand(paramsCommand)
  .addCommand(cancel);
