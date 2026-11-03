// Run a Hevy sync from the command line: `npm run sync`
// Reads .env.local the same way Next.js does.
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

async function main() {
  const { getDb } = await import('../src/db');
  const { HevyClient } = await import('../src/lib/hevy/client');
  const { syncHevy } = await import('../src/lib/sync/hevy');
  const result = await syncHevy(await getDb(), HevyClient.fromEnv());
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
