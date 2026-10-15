import http from 'node:http';
import { performance } from 'node:perf_hooks';
import { app, startServer } from '../../src/app.js';

interface BenchmarkResult {
  endpoint: string;
  durations: number[];
  avg: number;
  p50: number;
  p95: number;
  min: number;
  max: number;
}

const TEST_ENDPOINTS = [
  // 1. Popular series (Kitsu ID)
  '/stream/series/kitsu:49235:24.json',
  // 2. Movie (IMDb ID)
  '/stream/movie/tt5323662.json',
  // 3. Anime season episode (IMDb ID)
  '/stream/series/tt0434665:0:1.json'
];

function makeRequest(port: number, path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const req = http.get(`http://127.0.0.1:${port}${path}`, (res) => {
      res.on('data', () => {});
      res.on('end', () => {
        const duration = performance.now() - start;
        resolve(duration);
      });
    });
    req.on('error', reject);
  });
}

function calculateStats(endpoint: string, durations: number[]): BenchmarkResult {
  const sorted = [...durations].sort((a, b) => a - b);
  const avg = sorted.reduce((sum, val) => sum + val, 0) / sorted.length;
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  return {
    endpoint,
    durations,
    avg,
    p50,
    p95,
    min,
    max,
  };
}

async function runBenchmark(iterations = 3) {
  const server = startServer(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const port = (server.address() as { port: number }).port;

  console.log(`\n=== Running Latency Benchmark (${iterations} iterations per endpoint) ===\n`);

  const results: BenchmarkResult[] = [];

  for (const endpoint of TEST_ENDPOINTS) {
    console.log(`Benchmarking: ${endpoint}`);
    const durations: number[] = [];

    // Warm-up run (not recorded)
    try {
      await makeRequest(port, endpoint);
    } catch (e) {
      console.warn(`Warm-up failed for ${endpoint}:`, e);
    }

    for (let i = 0; i < iterations; i++) {
      try {
        const duration = await makeRequest(port, endpoint);
        durations.push(duration);
        process.stdout.write(`  Run ${i + 1}: ${duration.toFixed(1)}ms\n`);
      } catch (err) {
        console.error(`  Run ${i + 1} failed:`, err);
      }
    }

    if (durations.length > 0) {
      results.push(calculateStats(endpoint, durations));
    }
  }

  await new Promise<void>((resolve) => server.close(() => resolve()));

  console.log('\n=== Benchmark Results Summary ===\n');
  console.table(
    results.map((r) => ({
      Endpoint: r.endpoint,
      'Avg (ms)': r.avg.toFixed(1),
      'p50 (ms)': r.p50.toFixed(1),
      'p95 (ms)': r.p95.toFixed(1),
      'Min (ms)': r.min.toFixed(1),
      'Max (ms)': r.max.toFixed(1),
    }))
  );

  return results;
}

runBenchmark(3).catch(console.error);
