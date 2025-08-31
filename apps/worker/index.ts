import { config as loadEnv } from "dotenv";
const ENV_FILE = process.env.ENV_FILE || ".env";
loadEnv({ path: ENV_FILE });
loadEnv();
import { container } from "@factory/infra/container";
import { registry } from "./plugins";

(async () => {
  try {
    const { db, llm, renderer } = await container();
    const pluginName = (process.argv.find((a) => a.startsWith("--plugin="))?.split("=")[1]) || process.env.PLUGIN || "emoji";
    const plugin = registry[pluginName];
    if (!plugin) throw new Error(`Unknown plugin: ${pluginName}`);
    console.log(`[worker] ENV=${process.env.ENV || "local"} plugin=${pluginName} LLM_DRIVER=${process.env.LLM_DRIVER} OPENAI_MODEL=${process.env.OPENAI_MODEL || "gpt-4o-mini"}`);
    const { generateOne } = await import("@factory/factory/generate");
    try {
      const result = await generateOne({ plugin, db, llm, renderer });
      if (!result) {
        console.log("NO_ITEMS: run ingest first, e.g. pnpm run ingest:emoji -- --mock");
        return;
      }
      console.log("DRAFT_CREATED", result.slug);
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (/LLM_QUOTA/.test(msg) || err?.status === 429 || err?.code === "insufficient_quota") {
        console.error(`[worker] LLM quota/rate limit: ${msg}`);
        console.error(`[worker] Tip: verify billing/quota. Request will stop.`);
      } else {
        console.error(`[worker] LLM error: ${msg}`);
      }
      process.exit(1);
    }
  } catch (e: any) {
    console.error(`[worker] fatal error:`, e?.message || e);
    process.exit(1);
  }
})();
