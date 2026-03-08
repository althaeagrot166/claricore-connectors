import { replayDeadLetterJobs } from "@claricore/queue";

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "dlq:replay") {
    const limit = Number(args[0] ?? "50");
    const replayed = await replayDeadLetterJobs(limit);
    console.log(JSON.stringify({ action: "dlq:replay", replayed }));
    return;
  }
  console.log("usage: pnpm --filter @claricore/cli start dlq:replay [limit]");
}

void main();
