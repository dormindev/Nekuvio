// Staleness warning for examples/ data.
// The check itself lives here (pure functions, unit-testable); the wiring that
// actually prints the warning is test/setup/staleness.global.ts, registered as
// vitest `globalSetup` so it runs exactly once per test run.
//
// Reads every examples/*/meta.json record fetched date. If the OLDEST date is
// older than STALENESS_DAYS (default 14), logs a warning.
//
// - fetched:null records (self-stream snapshots) are excluded.
// - unsupported/ is excluded by vitest config, so its records never enter the scan.
// - Warning-only: never a test failure or slow path.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to test/data/examples — independent of the working directory. */
export const EXAMPLES_ROOT = path.join(__dirname, '..', 'data', 'examples');

const DEFAULT_DAYS = 14;

export interface StalenessHit {
  date: Date;
  endpoint: string;
  id: string;
}

// Find the OLDEST non-null fetched date across examples/*/meta.json records.
// The oldest record is the one that determines whether the data has gone stale:
// a single freshly-refreshed endpoint must not silence the whole warning.
export function oldestFetchedDate(examplesRoot: string): StalenessHit | null {
  if (!fs.existsSync(examplesRoot)) return null;
  let oldest: StalenessHit | null = null;

  for (const endpoint of fs.readdirSync(examplesRoot, { withFileTypes: true })) {
    if (!endpoint.isDirectory()) continue;
    const metaPath = path.join(examplesRoot, endpoint.name, 'meta.json');
    if (!fs.existsSync(metaPath)) continue;

    let meta: { records?: Array<{ id?: string; fetched: string | null }> } = {};
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch {
      continue;
    }
    for (const rec of meta.records ?? []) {
      if (rec.fetched === null) continue;  // excluded: behavior snapshots
      const d = new Date(rec.fetched);
      if (isNaN(d.getTime())) continue;
      if (oldest === null || d < oldest.date) {
        oldest = { date: d, endpoint: endpoint.name, id: rec.id ?? '(unknown)' };
      }
    }
  }
  return oldest;
}

/**
 * Resolve the staleness threshold. Falls back to the default when
 * STALENESS_DAYS is unset, blank, or not a finite number — an invalid value
 * must never silently disable the warning.
 */
export function resolveThresholdDays(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.STALENESS_DAYS;
  if (raw === undefined || raw.trim() === '') return DEFAULT_DAYS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_DAYS;
  return parsed;
}

/**
 * Log a warning if examples/ data exceeds the staleness threshold.
 * @param examplesRoot  - directory to scan (injectable for testing)
 * @param daysThreshold - max age in days before warning
 */
export function warnOnStaleExamples(examplesRoot?: string, daysThreshold?: number): void {
  const root = examplesRoot ?? EXAMPLES_ROOT;
  const days = daysThreshold ?? resolveThresholdDays();

  const oldest = oldestFetchedDate(root);
  if (!oldest) return;

  const age = (Date.now() - oldest.date.getTime()) / (1000 * 60 * 60 * 24);
  if (age > days) {
    const msg = `[staleness] examples/ data is ${Math.round(age)} days old ` +
      `(oldest: ${oldest.endpoint}/${oldest.id} fetched ${oldest.date.toISOString().split('T')[0]}, ` +
      `threshold ${days}d). Run: npm run test:examples:refresh`;
    console.warn(msg);
  }
}
