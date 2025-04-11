import { Command } from "commander";
import { create } from "./create";
import { join } from "./join";
import { start } from "./start";
import { propose } from "./propose";
import { endTurn } from "./end-turn";
import { vote } from "./vote";
import { cancel } from "./cancel";
import { list } from "./list";

export const game = new Command("game")
  .description("Game-related commands for Rankify fellowship")
  .addCommand(create)
  .addCommand(join)
  .addCommand(start)
  .addCommand(propose)
  .addCommand(endTurn)
  .addCommand(vote)
  .addCommand(cancel)
  .addCommand(list);

export { create, join, start, propose, endTurn, vote, cancel, list };
