/**
 * Compare fixture payloads against live re-fetches (human triage only).
 *
 * ALWAYS live: re-fetches each fixture endpoint and diffs against the committed
 * payload. Reports shape differences for human triage. Never writes.
 *
 * Driven by:
 *  - test/data/meta.json (fetch spec per endpoint)
 *  - fixtures/<endpoint>/meta.json (records[*].params / fetched / grounds)
 *
 * Usage:  tsx test/scripts/compare-fixtures.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseRegistry,
  resolveEndpointSpec,
  buildUrl,
  fetchJson,
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

interface FixtureRecord {
  id: string;
  params: { path?: Record<string, string>; query?: Record<string, string> };
  fetched: string | null;
  grounds: string;
}

function report(name: string, status: 'ok' | 'warn' | 'error' | 'diff', detail: string): void {
  const icon = status === 'ok' ? '\u2713' : status === 'warn' ? '\u26a0' : status === 'diff' ? '~' : '\u2717';
  console.log(`  ${icon} ${name}: ${detail}`);
}

/**
 * Recursive shape comparison: object keys, array lengths, and element shapes.
 * Reports drift at any depth, not just the top level.
 */
function shapeDiff(committed: unknown, live: unknown, trail = ''): string[] {
  const diffs: string[] = [];
  const at = trail || '(root)';

  if (Array.isArray(committed) && Array.isArray(live)) {
    if (committed.length !== live.length) {
      diffs.push(`${at}: array length ${committed.length} vs ${live.length}`);
    }
    // Compare element shapes (first element is representative for API lists).
    if (committed.length && live.length) {
      diffs.push(...shapeDiff(committed[0], live[0], `${at}[0]`));
    }
    return diffs;
  }

  // One side is an array, the other a plain object — a structural change.
  if (Array.isArray(committed) !== Array.isArray(live)) {
    diffs.push(`${at}: array vs object`);
    return diffs;
  }

  const cObj = typeof committed === 'object' && committed !== null;
  const lObj = typeof live === 'object' && live !== null;
  if (cObj && lObj) {
    const ck = Object.keys(committed as object);
    const lk = Object.keys(live as object);
    const onlyCommitted = ck.filter((k) => !lk.includes(k));
    const onlyLive = lk.filter((k) => !ck.includes(k));
    if (onlyCommitted.length) {
      diffs.push(`${at}: keys only in fixture: ${onlyCommitted.join(', ')}`);
    }
    if (onlyLive.length) {
      diffs.push(`${at}: keys only in live: ${onlyLive.join(', ')}`);
    }
    // Recurse into keys present in both.
    for (const key of ck) {
      if (!lk.includes(key)) continue;
      diffs.push(...shapeDiff(
        (committed as Record<string, unknown>)[key],
        (live as Record<string, unknown>)[key],
        trail ? `${trail}.${key}` : key,
      ));
    }
    return diffs;
  }

  // Scalar mismatch (type change or null vs object).
  if (typeof committed !== typeof live) {
    diffs.push(`${at}: type ${describeType(committed)} vs ${describeType(live)}`);
  }
  return diffs;
}

/**
 * Human-readable type name. `typeof null` is "object" in JavaScript, which
 * would report a null-vs-string difference as "object vs string".
 */
function describeType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

async function fetchRecord(spec: FetchSpec, rec: FixtureRecord): Promise<unknown | Error> {
  const url = buildUrl(spec, rec.params);
  if (!url) return new Error(`cannot build URL (no base url; endpoint="${spec.endpoint}")`);

  try {
    const raw = await fetchJson(url);
    // An error envelope is not a payload — report it as a failure, never as
    // a shape match (an error body would "match" an error fixture).
    if (isErrorBody(raw)) {
      const msg = (raw as { message?: string }).message ?? 'unknown error';
      return new Error(`live returned an error: ${msg}`);
    }
    // Fixtures are stored RAW, exactly as the endpoint answered — so compare
    // the raw body directly. No unwrapping.
    return raw;
  } catch (e) {
    return e instanceof Error ? e : new Error(String(e));
  }
}

export async function compareFixtures(): Promise<number> {
  const reg = parseRegistry(dataDir) as unknown as Registry;
  const fixturesRoot = path.join(dataDir, 'fixtures');
  let issues = 0;
  let compared = 0;

  console.log('Fixture comparison (always live)\n');

  for (const endpoint of fs.readdirSync(fixturesRoot, { withFileTypes: true })) {
    if (!endpoint.isDirectory()) continue;

    const metaPath = path.join(fixturesRoot, endpoint.name, 'meta.json');
    if (!fs.existsSync(metaPath)) {
      report(endpoint.name, 'error', 'meta.json missing');
      issues++;
      continue;
    }

    const meta: { records: FixtureRecord[] } = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const spec = resolveEndpointSpec(endpoint.name, reg);
    if (!spec) {
      report(endpoint.name, 'error', 'no registry spec in test/data/meta.json');
      issues++;
      continue;
    }

    report(endpoint.name, 'ok', `spec: ${spec.endpoint ?? '(inline)'}`);

    for (const rec of meta.records) {
      // Local consistency checks (no network)
      const payloadPath = path.join(fixturesRoot, endpoint.name, `${rec.id}.json`);
      if (!fs.existsSync(payloadPath)) {
        report(`${endpoint.name}/${rec.id}`, 'error', 'payload file missing');
        issues++;
        continue;
      }
      if (rec.fetched === null) {
        report(`${endpoint.name}/${rec.id}`, 'warn', 'fetched is null');
        issues++;
      }
      if (!rec.grounds) {
        report(`${endpoint.name}/${rec.id}`, 'warn', 'grounds field empty');
        issues++;
      }

      // Live comparison
      const committed: unknown = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
      const live = await fetchRecord(spec, rec);

      // Pace requests — NekoBT rate-limits bursts with 429.
      await sleep(REQUEST_DELAY_MS);

      if (live instanceof Error) {
        report(`${endpoint.name}/${rec.id}`, 'error', `live fetch failed: ${live.message}`);
        issues++;
      } else {
        const diffs = shapeDiff(committed, live as unknown);
        if (diffs.length) {
          report(`${endpoint.name}/${rec.id}`, 'diff', diffs.join('; '));
          issues++;
        } else {
          report(`${endpoint.name}/${rec.id}`, 'ok', 'shape matches');
        }
        compared++;
      }
    }
  }

  console.log(`\nCompared ${compared} fixture(s) live; ${issues} issue(s).`);
  return 0;  // never non-zero — human triage tool
}

if (import.meta.url === `file://${process.argv[1]}`) {
  compareFixtures().then(process.exit).catch((e) => { console.error(e); process.exit(1); });
}
