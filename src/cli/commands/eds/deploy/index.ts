import { Command } from "commander";
import { repositoryCommand } from "./repository";

export const deployCommand = new Command("deploy").description("Deploy EDS components").addCommand(repositoryCommand);
