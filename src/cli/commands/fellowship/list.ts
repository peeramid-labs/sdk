import { Command } from "commander";
import { createPublic } from "../../client.js";
import InstanceBase from "../../../rankify/InstanceBase";
import chalk from "chalk";
import { getAddress } from "viem";

export const list = new Command("list")
  .description("List games in a Rankify instance")
  .argument("<instance>", "Address of the Rankify instance")
  .option("-r, --rpc <url>", "RPC endpoint URL. If not provided, RPC_URL environment variable will be used")
  .option("-p, --page <page>", "Page number", "0")
  .option("-s, --size <size>", "Page size", "10")
  .action(async (instance, options) => {
    const client = await createPublic(options.rpc);
    const chainId = await client.getChainId();
    const rankify = new InstanceBase({
      publicClient: client,
      chainId,
      instanceAddress: getAddress(instance),
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
