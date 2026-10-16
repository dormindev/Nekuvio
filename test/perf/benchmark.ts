/*
 * Latency benchmark for the Nuvio stream endpoint.
 *
 * Two sections:
 *   1. Phase breakdown — times each pipeline phase by driving the real
 *      modules directly (mirrors streamRequest() in src/app.ts; keep in
 *      sync). This shows where latency actually comes from per query —
 *      e.g. a query with 0 candidate torrents has a ~0ms tail regardless
 *      of serial vs. parallel execution (decision 004, Note 2).
 *   2. Endpoint latency — wall-clock time of GET /stream/... through an
 *      in-process HTTP server.
 *
 * To avoid rate limiting nekobt.to and the tracker endpoints, requests are
 * paced (BENCH_COOLDOWN_MS between every request) and the endpoint order
 * rotates each iteration so no endpoint is systematically measured last.
 *
 * Env:
 *   BENCH_ITERATIONS    recorded runs per endpoint for section 2 (default 5)
 *   BENCH_COOLDOWN_MS   pause between requests (default 1500)
 *   BENCH_PHASE_PASSES  pipeline passes per endpoint for section 1 (default 1)
 */

import http from 'node:http';
import { performance } from 'node:perf_hooks';

import { app, startServer } from '../../src/app.js';
import { parseNuvioId } from '../../src/utils/parser.js';
import { resolveKitsuToExternal } from '../../src/api/kitsu.js';
import { resolveMediaId, getMedia, searchTorrents, getTorrent } from '../../src/api/nekobt.js';
import { scrapeTorrents } from '../../src/api/tracker-scrapper.js';
import { fitInfo } from '../../src/pipeline/matcher.js';

const TEST_ENDPOINTS = [
  // 1. Popular series (Kitsu ID)
  '/stream/series/kitsu:49235:24.json',
  // 2. Movie (IMDb ID)
  '/stream/movie/tt5323662.json',
  // 3. Anime season 0 specials (IMDb ID)
  '/stream/series/tt0434665:0:1.json'
];

function envInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

const ITERATIONS = envInt('BENCH_ITERATIONS', 5);
const COOLDOWN_MS = envInt('BENCH_COOLDOWN_MS', 1500);
const PHASE_PASSES = envInt('BENCH_PHASE_PASSES', 1);

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const avg = (values: number[]): number =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

/* -------------------------------------------------------------------------- */
/* Section 1: phase breakdown                                                 */
/* -------------------------------------------------------------------------- */

interface PhaseSample {
  resolve: number;
  media: number;
  search: number;
  scrape: number;
  details: number;
  torrents: number;
}

interface PhaseRow {
  endpoint: string;
  resolve: number;
  media: number;
  search: number;
  scrape: number;
  details: number;
  torrents: number;
}

/**
 * Drives one full pipeline pass for an endpoint by calling the same modules
 * streamRequest() uses, in the same order (mirrors src/app.ts — keep in
 * sync). All instrumentation lives here so production code stays untouched.
 */
async function timePipelinePhases(endpoint: string): Promise<PhaseSample> {
  const [, , type, rawId] = endpoint.split('/');
  // The Express route is /stream/:type/:id.json — the extension is not part
  // of the id. Mirror that stripping here.
  const request = parseNuvioId(type!, rawId!.replace(/\.json$/, ''));

  const sample: PhaseSample = { resolve: 0, media: 0, search: 0, scrape: 0, details: 0, torrents: 0 };

  let start = performance.now();

  let nekoExternalId: string;
  if (request.provider === 'kitsu') {
    const provider = await resolveKitsuToExternal(request.externalId);
    nekoExternalId = `${provider.name}-${provider.id}`;
  } else {
    nekoExternalId = `${request.provider}-${request.externalId}`;
  }

  const nekoId = await resolveMediaId(nekoExternalId);
  sample.resolve = performance.now() - start;

  if (!nekoId) {
    throw new Error(`resolve returned no media id for ${endpoint}`);
  }

  start = performance.now();
  const media = await getMedia(nekoId.media_id);
  const info = fitInfo(nekoId, media, request);
  sample.media = performance.now() - start;

  start = performance.now();
  const torrents = await searchTorrents(nekoId.media_id, info.episode?.id ?? null);
  sample.search = performance.now() - start;
  sample.torrents = torrents.length;

  // Tail phases timed separately so the table can show what the serial tail
  // (scrape + details) would cost vs. the parallelized tail (max of both)
  // introduced by decision 004.
  start = performance.now();
  await scrapeTorrents(torrents);
  sample.scrape = performance.now() - start;

  start = performance.now();
  await Promise.all(torrents.map(t => getTorrent(t.id)));
  sample.details = performance.now() - start;

  return sample;
}

async function runPhaseBreakdown(): Promise<PhaseRow[]> {
  console.log(`\n=== Phase Breakdown (${PHASE_PASSES} pass(es) per endpoint, ${COOLDOWN_MS}ms pacing) ===\n`);

  const rows: PhaseRow[] = [];

  for (const endpoint of TEST_ENDPOINTS) {
    const samples: PhaseSample[] = [];

    for (let pass = 0; pass < PHASE_PASSES; pass++) {
      try {
        samples.push(await timePipelinePhases(endpoint));
      } catch (err) {
        console.warn(`  phase pass failed for ${endpoint}:`, err instanceof Error ? err.message : err);
        break;
      }

      if (pass < PHASE_PASSES - 1) await sleep(COOLDOWN_MS);
    }

    await sleep(COOLDOWN_MS);

    if (samples.length === 0) continue;

    rows.push({
      endpoint,
      resolve: avg(samples.map(s => s.resolve)),
      media: avg(samples.map(s => s.media)),
      search: avg(samples.map(s => s.search)),
      scrape: avg(samples.map(s => s.scrape)),
      details: avg(samples.map(s => s.details)),
      torrents: Math.round(avg(samples.map(s => s.torrents)))
    });
  }

  console.table(rows.map(row => ({
    Endpoint: row.endpoint,
    'Resolve (ms)': Math.round(row.resolve),
    'Media (ms)': Math.round(row.media),
    'Search (ms)': Math.round(row.search),
    'Upstream (ms)': Math.round(row.resolve + row.media + row.search),
    'Scrape (ms)': Math.round(row.scrape),
    'Details (ms)': Math.round(row.details),
    'Serial tail (ms)': Math.round(row.scrape + row.details),
    'Parallel tail (ms)': Math.round(Math.max(row.scrape, row.details)),
    Torrents: row.torrents
  })));

  return rows;
}

/* -------------------------------------------------------------------------- */
/* Section 2: endpoint latency                                                */
/* -------------------------------------------------------------------------- */

interface BenchmarkResult {
  endpoint: string;
  durations: number[];
  avg: number;
  p50: number;
  p95: number;
  min: number;
  max: number;
}

function makeRequest(port: number, path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const req = http.get(`http://127.0.0.1:${port}${path}`, (res) => {
      res.on('data', () => {});
      res.on('end', () => {
        resolve(performance.now() - start);
      });
    });
    req.on('error', reject);
  });
}

function calculateStats(endpoint: string, durations: number[]): BenchmarkResult {
  const sorted = [...durations].sort((a, b) => a - b);

  return {
    endpoint,
    durations,
    avg: avg(sorted),
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

async function runLatency(iterations: number): Promise<BenchmarkResult[]> {
  const server = startServer(0);
  await new Promise<void>(resolve => server.once('listening', () => resolve()));
  const port = (server.address() as { port: number }).port;

  console.log(`\n=== Endpoint Latency (${iterations} iterations per endpoint, rotated, ${COOLDOWN_MS}ms pacing) ===\n`);

  // Warm-up run per endpoint (not recorded), paced like everything else.
  for (const endpoint of TEST_ENDPOINTS) {
    try {
      await makeRequest(port, endpoint);
    } catch (e) {
      console.warn(`Warm-up failed for ${endpoint}:`, e);
    }
    await sleep(COOLDOWN_MS);
  }

  const durationsByEndpoint = new Map<string, number[]>(
    TEST_ENDPOINTS.map(endpoint => [endpoint, []])
  );

  // Round-robin: the starting endpoint shifts every iteration so no endpoint
  // is systematically measured last (position bias on live services).
  for (let i = 0; i < iterations; i++) {
    for (let e = 0; e < TEST_ENDPOINTS.length; e++) {
      const endpoint = TEST_ENDPOINTS[(e + i) % TEST_ENDPOINTS.length];

      try {
        const duration = await makeRequest(port, endpoint);
        durationsByEndpoint.get(endpoint)!.push(duration);
        console.log(`  iter ${i + 1} [${endpoint}]: ${duration.toFixed(1)}ms`);
      } catch (err) {
        console.error(`  iter ${i + 1} [${endpoint}] failed:`, err);
      }

      await sleep(COOLDOWN_MS);
    }
  }

  await new Promise<void>(resolve => server.close(() => resolve()));

  const results = [...durationsByEndpoint.entries()]
    .filter(([, durations]) => durations.length > 0)
    .map(([endpoint, durations]) => calculateStats(endpoint, durations));

  console.table(results.map(r => ({
    Endpoint: r.endpoint,
    'Avg (ms)': r.avg.toFixed(1),
    'p50 (ms)': r.p50.toFixed(1),
    'p95 (ms)': r.p95.toFixed(1),
    'Min (ms)': r.min.toFixed(1),
    'Max (ms)': r.max.toFixed(1),
    Runs: r.durations.length
  })));

  return results;
}

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

async function main() {
  console.log(`\n=== Running Latency Benchmark ===`);
  console.log(`iterations=${ITERATIONS} cooldown=${COOLDOWN_MS}ms phasePasses=${PHASE_PASSES}\n`);

  await runPhaseBreakdown();
  await runLatency(ITERATIONS);

  console.log('\nNotes:');
  console.log('- Phase breakdown attributes latency to a pipeline phase; endpoint order rotates each iteration and requests are paced to avoid rate limiting upstream services.');
  console.log('- Session-to-session totals vary with live upstream latency; compare phases, not raw totals, across sessions.');
  console.log("- 'Upstream' (resolve + media + search) is always serial and runs before the tail; decision 004 does not affect it.");
  console.log("- 'Serial tail' vs 'Parallel tail' shows what decision 004 saves for each query (scrape + details vs max of both); with 0 candidate torrents both tails are 0ms — the query pays only the upstream cost.");

  // node-fetch keep-alive sockets to nekobt.to would otherwise hold the
  // event loop open after the server is closed.
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
