import { Command } from "commander";
import { addWhitelistedGM } from "./add";

export const gm = new Command("gm").description("Fellowship contract commands").addCommand(addWhitelistedGM);
