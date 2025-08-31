import { config as loadEnv } from "dotenv";
const ENV_FILE = process.env.ENV_FILE || ".env";
loadEnv({ path: ENV_FILE });
loadEnv();
import { container } from "@factory/infra/container";
import { dedupe, parseFlags, validateItems, withCache } from "@factory/factory/ingest/utils";
import { emojiPlugin } from "@factory/plugins/emoji";
import type { NichePlugin } from "@factory/core/plugins";

const registry: Record<string, NichePlugin> = {
  emoji: emojiPlugin
};

function parsePluginArg(argv: string[]): string {
  const arg = argv.find((a) => a.startsWith("--plugin="));
  return arg ? arg.split("=")[1] : "emoji";
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const name = parsePluginArg(process.argv.slice(2));
  const plugin = registry[name];
  if (!plugin) throw new Error(`Unknown plugin: ${name}`);
  const { db } = await container();

  const limit = Number(process.env.INGEST_LIMIT || flags.limit || 10);
  const live = process.env.INGEST_DRIVER ? process.env.INGEST_DRIVER !== "mock" : flags.live;
  const nocache = Boolean(process.env.INGEST_NOCACHE === "true" || flags.nocache);
  console.log(`[ingest] plugin=${name} live=${live} limit=${limit} nocache=${nocache}`);

  const items = await withCache(
    `${name}-${live ? "live" : "mock"}.json`,
    () => plugin.discover({ limit, live }),
    nocache
  );
  const valid = validateItems(dedupe(items));
  await db.upsertSourceItems(valid);
  console.log(`[ingest] upserted=${valid.length} firstTerm=${valid[0]?.term ?? "-"}`);
}

main().catch((e) => {
  console.error(`[ingest] error`, e?.message || e);
  process.exit(1);
});
