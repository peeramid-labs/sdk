import { Command } from "commander";
import { createFellowshipCommand } from "./create";
import { list } from "./list";
import { getMetadataCommand } from "./metadata";
import { eip712Command } from "./eip712";
import { paramsCommand } from "./params";
import { game } from "./game/index";
import { gm } from "./gameMaster/index";

export const fellowshipCommand = new Command("fellowship")
  .description("Fellowship contract commands")
  .addCommand(createFellowshipCommand)
  .addCommand(list)
  .addCommand(getMetadataCommand)
  .addCommand(eip712Command)
  .addCommand(paramsCommand)
  .addCommand(game)
  .addCommand(gm);
