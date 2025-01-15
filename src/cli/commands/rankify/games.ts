import { Command } from "commander";
import { createPublic } from "../../client.js";
import { InstanceBase } from "../../../rankify/index.js";
import chalk from "chalk";
import { getChainPath } from "../../../utils/chainMapping.js";
import type { Chain } from "viem";

export const games = new Command("games")
  .description("List games in a Rankify instance")
  .argument("<instance>", "Address of the Rankify instance")
  .option("-c, --chain <chain>", "Chain to use", "sepolia")
  .option("-p, --page <page>", "Page number", "0")
  .option("-s, --size <size>", "Page size", "10")
  .action(async (instance, options) => {
    const client = createPublic(options.chain as Chain);
    const rankify = new InstanceBase({
      publicClient: client,
      chainId: getChainPath(options.chain as Chain).id,
      instanceAddress: instance,
    });

    const { items } = await rankify.getGameStates({
      pageParam: parseInt(options.page),
      pageSize: parseInt(options.size),
    });

    console.log(chalk.bold("\nGames:"));
    items.forEach((game, i) => {
      const index = parseInt(options.page) * parseInt(options.size) + i;
      console.log(
        chalk.green(`\nGame ${index}:`),
        "\n  Created by:",
        game.createdBy,
        "\n  Phase:",
        game.gamePhase,
        "\n  Max turns:",
        game.maxTurns.toString(),
        "\n  Current turn:",
        game.currentTurn.toString(),
        "\n  Time per turn:",
        game.timePerTurn.toString(),
        "\n  Time to join:",
        game.timeToJoin.toString()
      );
    });
  });
