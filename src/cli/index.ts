#!/usr/bin/env node

import { Command } from "commander";
import { fellowshipCommand } from "./commands/fellowship";
import { distributionsCommand } from "./commands/distributions";
import { instancesCommand } from "./commands/instances";
import { multipassCommand } from "./commands/multipass";
import { edsCommand } from "./commands/eds";
import { getPkCommand } from "./commands/getPk";
import { blockchainCommand } from "./commands/blockchain";
import { playbookCommand } from "./commands/playbook";
const { version } = require("../../package.json");

const program = new Command()
  .name("peeramid")
  .description("CLI for interacting with Peeramid contracts")
  .version(version);

// Add commands
program.addCommand(fellowshipCommand);
program.addCommand(distributionsCommand);
program.addCommand(instancesCommand);
program.addCommand(multipassCommand);
program.addCommand(edsCommand);
program.addCommand(getPkCommand);
program.addCommand(blockchainCommand);
program.addCommand(playbookCommand);
program.parse();
