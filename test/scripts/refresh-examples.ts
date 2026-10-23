/**
 * Re-fetch every `examples/` payload live and refresh `fetched` dates.
 *
 * Driven by:
 *  - `test/data/meta.json` (root registry: fetch specs per endpoint)
 *  - `test/data/examples/<endpoint>/meta.json` (`records[*].params` + `fetched`)
 *
 * Skips:
 *  - `self-stream`  — behavior snapshots of the addon's own responses
 *  - non-HTTP endpoints (`tracker-scrape` speaks UDP announce; `self` is internal)
 *
 * Never touches `fixtures/`, `unsupported/`, `synthetic/`, or assertions.
 * (It only walks `examples/`, so `unsupported/` is out of scope by construction.)
 *
 * Usage:  tsx test/scripts/refresh-examples.ts            # write
 *         tsx test/scripts/refresh-examples.ts --dry-run  # preview only
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseRegistry,
  resolveEndpointSpec,
  buildUrl,
  fetchJson,
  isHttpFetchable,
  isErrorBody,
  FetchSpec,
  Registry,
} from '../helpers/data-catalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');

/** Pause between live requests — NekoBT rate-limits bursts with 429. */
const REQUEST_DELAY_MS = 350;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isDryRun(): boolean {
  return process.argv.includes('--dry-run');
}

interface ExampleRecord {
  id: string;
  params: { path?: Record<string, string>; query?: Record<string, string> };
  fetched: string | null;
  grounds: string;
}

/**
 * Why an example folder cannot be refreshed, or null when it can.
 * Single source of truth for skip reasons.
 */
function skipReasonFor(folder: string, spec: FetchSpec | undefined): string | null {
  if (folder === 'self-stream') {
    return 'behavior snapshots of our own responses, not fetchable';
  }
  if (!spec) {
    return 'no registry spec in test/data/meta.json';
  }
  if (!isHttpFetchable(spec)) {
    return 'not HTTP-fetchable (no url/endpoint in registry)';
  }
  return null;
}

export async function refreshExamples(): Promise<number> {
  const dryRun = isDryRun();
  const reg = parseRegistry(dataDir) as unknown as Registry;
  const examplesRoot = path.join(dataDir, 'examples');
  let refreshed = 0;
  let wouldRefresh = 0;
  let skipped = 0;
  let failed = 0;

  for (const endpoint of fs.readdirSync(examplesRoot, { withFileTypes: true })) {
    if (!endpoint.isDirectory()) continue;

    const spec: FetchSpec | undefined = resolveEndpointSpec(endpoint.name, reg);
    if (!spec || !isHttpFetchable(spec)) {
      console.log(`  skip ${endpoint.name}/ — ${skipReasonFor(endpoint.name, spec)}`);
      skipped++;
      continue;
    }

    const metaPath = path.join(examplesRoot, endpoint.name, 'meta.json');
    if (!fs.existsSync(metaPath)) continue;

    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as { records: ExampleRecord[] };
    const date = new Date().toISOString().split('T')[0];

    for (const rec of meta.records) {
      const payloadPath = path.join(examplesRoot, endpoint.name, `${rec.id}.json`);
      if (!fs.existsSync(payloadPath)) {
        console.warn(`  warn ${endpoint.name}/${rec.id} — missing payload file`);
        failed++;
        continue;
      }

      // The currently committed body — used to decide whether an error
      // response is acceptable (a committed error capture may be re-captured).
      let committedBody: unknown = null;
      try {
        committedBody = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
      } catch {
        console.warn(`  warn ${endpoint.name}/${rec.id} — committed payload is not valid JSON`);
        failed++;
        continue;
      }

      const url = buildUrl(spec, rec.params);
      if (!url) {
        console.log(`  skip ${endpoint.name}/${rec.id} — cannot build URL`);
        skipped++;
        continue;
      }

      if (dryRun) {
        console.log(`  [would refresh] ${endpoint.name}/${rec.id} ← ${url}`);
        wouldRefresh++;
        continue;
      }

      try {
        const live = await fetchJson(url);
        // Never write an error body over a good payload: NekoBT can answer
        // 200 with { error: true, message }. Keep the old payload instead.
        // (A committed payload that IS an error capture may be refreshed with
        // a fresh error body — that is the observation we want to keep.)
        if (isErrorBody(live) && !isErrorBody(committedBody)) {
          const msg = (live as { message?: string }).message ?? 'unknown error';
          console.warn(`  fail  ${endpoint.name}/${rec.id} — live error: ${msg} (payload kept)`);
          failed++;
          await sleep(REQUEST_DELAY_MS);
          continue;
        }
        // Store the raw response body, matching the committed example shape.
        fs.writeFileSync(payloadPath, JSON.stringify(live, null, 2) + '\n');
        rec.fetched = date;
        console.log(`  refreshed ${endpoint.name}/${rec.id} ← ${url}`);
        refreshed++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`  fail  ${endpoint.name}/${rec.id} — ${msg} (payload kept)`);
        failed++;
      }

      // Pace requests — NekoBT rate-limits bursts with 429.
      await sleep(REQUEST_DELAY_MS);
    }

    if (!dryRun) {
      // Only `fetched` dates change in the record metadata.
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
    }
  }

  const suffix = dryRun ? ' (dry run, no writes)' : '';
  const done = dryRun ? wouldRefresh : refreshed;
  console.log(
    `\nRefresh: ${done} record(s)${suffix}, ${skipped} skipped, ${failed} failed.`
  );
  return failed > 0 ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  refreshExamples()
    .then(code => process.exit(code))
    .catch((e) => { console.error(e); process.exit(1); });
}
