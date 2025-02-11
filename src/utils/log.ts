import chalk from "chalk";

export function logger(message: string, level: number = 0) {
  const printTimestamp = process.env.VERBOSE_TIMESTAMP;
  const printLevel = Number(process.env.VERBOSE_LEVEL ?? 0);
  const timestampMessage = printTimestamp ? chalk.greenBright(`[${new Date().toISOString()}]`) : "";
  if (process.env.VERBOSE && printLevel >= level) {
    const stack = new Error().stack;
    const stackTrace = stack?.split("\n")[2]?.trim()?.split(" ")[1]?.split(".");
    const caller = stackTrace?.slice(Math.max(0, stackTrace.length - level - 1)).join(".") || "unknown";
    if (level == 3) console.log(`${timestampMessage}[${chalk.red(caller)}]`, message);
    else if (level == 2) console.log(`${timestampMessage}[${chalk.green(caller)}]`, message);
    else if (level == 1) console.log(`${timestampMessage}[${chalk.yellow(caller)}]`, message);
    else console.log(`${timestampMessage}[${chalk.blue(caller)}]`, message);
  }
}
