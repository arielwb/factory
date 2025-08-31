import { config as loadEnv } from 'dotenv';
const ENV_FILE = process.env.ENV_FILE || '.env';
loadEnv({ path: ENV_FILE });
loadEnv();
import { container } from '@factory/infra/container';
import { registry } from './plugins';
import { generateOne } from '@factory/factory/generate';

function parseArg(argv: string[], key: string, fallback?: string): string | undefined {
  const match = argv.find(a => a.startsWith(`--${key}=`));
  return match ? match.split('=')[1] : fallback;
}

(async () => {
  const argv = process.argv.slice(2);
  const pluginName = parseArg(argv, 'plugin', process.env.PLUGIN || 'emoji')!;
  const count = Math.max(1, Number(parseArg(argv, 'count', '3')));
  const plugin = registry[pluginName];
  if (!plugin) throw new Error(`Unknown plugin: ${pluginName}`);

  const { db, llm, renderer } = await container();
  let generated = 0;
  for (let i = 0; i < count; i++) {
    const result = await generateOne({ plugin, db, llm, renderer });
    if (!result) {
      console.log('[generate] no more items to generate');
      break;
    }
    generated++;
    console.log('DRAFT_CREATED', result.slug);
  }
  console.log('[generate] total drafts:', generated);
})().catch(e => { console.error('[generate] error', e?.message || e); process.exit(1); });
