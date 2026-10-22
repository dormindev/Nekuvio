/**
 * Integration test: replay the self-stream corpus.
 *
 * `examples/self-stream/` holds 15 captured responses of our own `/stream`
 * endpoint, each with the Nuvio request that produced it and the catalog
 * inputs it consumed (linked back through `used_by`). This test replays each
 * request end to end — request in, response out — and compares the result with
 * the captured snapshot.
 *
 * Only the network is mocked:
 *  - HTTP  — the catalog payloads, served by URL, so the real NekoBT and
 *             Kitsu clients parse them exactly as they do in production
 *  - UDP   — the tracker scrape, so `scrapeTorrents` still derives the
 *             tracker set from each magnet and builds the swarm itself
 *
 * Everything the pipeline derives from the *catalog* is compared exactly.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import fs from 'node:fs';
import path from 'node:path';

import type { Express } from 'express';
import request from 'supertest';

import {
  loadExample,
  loadSelfStreamInputs,
} from './helpers/test-data.js';

interface RawBody {
  error?: boolean;
  data?: unknown;
}

/* The UDP layer: below our own module, so the tracker set still comes from
 * the magnets and `scrapeTorrents` builds the swarm exactly as production
 * does. Only the per-tracker numbers are supplied — the scrape is live and
 * time-dependent, so the catalog holds no scrape values; the snapshot records
 * the maxima it saw and which trackers answered. */
const udp = vi.hoisted(() => ({
  torrents: new Map<string, { complete: number; incomplete: number; trackers: Set<string> }>()
}));

vi.mock('bittorrent-tracker', () => ({
  default: {
    scrape: (options: { announce: string; infoHash: Buffer[] }, callback: Function) => {
      const results: Record<string, unknown> = {};
      for (const hash of options.infoHash) {
        const hex = hash.toString('hex');
        const known = udp.torrents.get(hex);
        // Only the trackers that answered at capture time answer now.
        if (!known || !known.trackers.has(options.announce)) continue;
        results[hex] = {
          announce: options.announce,
          infoHash: hex,
          complete: known.complete,
          incomplete: known.incomplete,
          downloaded: 0
        };
      }
      callback(null, results);
      return { destroy: () => {} };
    }
  }
}));

/* The app's logging is not what this test is about — the by-design failures
 * (a resolve that 404s, a season that is not found) would otherwise fill the
 * test output with expected errors. */
vi.mock('../src/utils/logger.js', () => ({
  logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }
}));

/* The HTTP layer: a router that serves the catalog by URL. */
const http = vi.hoisted(() => ({ routes: new Map<string, unknown>() }));

vi.mock('node-fetch', () => {
  const impl = async (url: string) => {
    const parsed = new URL(String(url));
    const body = http.routes.get(parsed.origin + parsed.pathname);
    const found = body !== undefined;
    return {
      ok: found,
      status: found ? 200 : 404,
      statusText: found ? 'OK' : 'Not Found',
      json: async () => body,
      clone() {
        return this;
      }
    };
  };
  return { default: impl };
});

const NEKOBT = 'https://nekobt.to/api/v1';
const KITSU = 'https://kitsu.io/api/edge';

let app: Express;

beforeAll(async () => {
  delete process.env.PORT;
  app = (await import('../src/app.js')).app;
});

beforeEach(() => {
  http.routes.clear();
  udp.torrents.clear();
});

/** The catalog inputs a self-stream record consumed, grouped by endpoint. */
function inputsOf(recordId: string): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  for (const input of loadSelfStreamInputs(recordId)) {
    (grouped[input.endpoint] ??= []).push(input.id);
  }
  return grouped;
}

/** The captured response of a self-stream record. */
interface Captured {
  streams: Array<{
    url: string;
    infoHash: string;
    fileIdx: number;
    name: string;
    description: string;
    sources: string[];
    behaviorHints: Record<string, unknown>;
  }>;
}

interface RecordMeta {
  id: string;
  params: { type: string; id: string };
  grounds: string;
}

/**
 * Serve the catalog payloads a record consumed.
 *
 * The scrape's values are live, so the catalog holds none — the snapshot's
 * maxima tell us what the scrape saw, and the torrent payload's own counts
 * are pinned to them.
 */
function serveInputs(record: RecordMeta, captured: Captured): void {
  const inputs = inputsOf(record.id);

  for (const id of inputs['kitsu-mappings'] ?? []) {
    http.routes.set(`${KITSU}/anime/${id}/mappings`, loadExample('kitsu-mappings', id));
  }

  for (const id of inputs['nekobt-resolve'] ?? []) {
    const body = loadExample<RawBody>('nekobt-resolve', id);
    http.routes.set(`${NEKOBT}/media/resolve`, body);
    // The media lookup is keyed by the id the resolve answered with.
    const mediaId = (body.data as { media_id?: string } | undefined)?.media_id;
    for (const media of inputs['nekobt-media'] ?? []) {
      if (media === mediaId) {
        http.routes.set(`${NEKOBT}/media/${mediaId}`, loadExample('nekobt-media', media));
      }
    }
  }

  // The search that produced this response is the one whose results match it.
  // A record with no streams has no matching search, so the first linked one
  // is served — its candidates simply did not match the requested episode.
  const streamHashes = captured.streams.map(s => s.infoHash);
  const searches = inputs['nekobt-search'] ?? [];
  for (const [index, id] of searches.entries()) {
    const body = loadExample<RawBody>('nekobt-search', id);
    const results = (body.data as { results?: Array<{ infohash: string }> } | undefined)?.results ?? [];
    const matches = results.length === streamHashes.length &&
      results.every((r, i) => r.infohash === streamHashes[i]);
    if (matches || index === 0) {
      http.routes.set(`${NEKOBT}/torrents/search`, body);
    }
  }

  // The torrent's own peer counts are live data that has drifted since the
  // snapshot was taken, so the replay pins them to the snapshot's moment —
  // everything else in the payload is served as captured.
  const peers = new Map<string, { complete: number; incomplete: number }>();
  for (const stream of captured.streams) {
    const match = stream.description.match(/🟢↑ (\d+) • 🔴↓ (\d+)/);
    if (match) {
      peers.set(stream.infoHash, {
        complete: Number(match[1]),
        incomplete: Number(match[2])
      });
    }
  }

  for (const id of inputs['nekobt-torrents'] ?? []) {
    const body = loadExample<RawBody>('nekobt-torrents', id);
    const torrent = body.data as { infohash?: string; seeders?: number; leechers?: number };
    const pinned = torrent.infohash ? peers.get(torrent.infohash) : undefined;
    if (pinned) {
      http.routes.set(`${NEKOBT}/torrents/${id}`, {
        ...body,
        data: { ...torrent, seeders: pinned.complete, leechers: pinned.incomplete }
      });
    } else {
      http.routes.set(`${NEKOBT}/torrents/${id}`, body);
    }
  }

  // The scrape's values are live, so the catalog holds none — the snapshot
  // records the maxima it saw and which trackers answered.
  for (const stream of captured.streams) {
    const pinned = peers.get(stream.infoHash);
    udp.torrents.set(stream.infoHash, {
      complete: pinned?.complete ?? 0,
      incomplete: pinned?.incomplete ?? 0,
      trackers: new Set(stream.sources.map(s => s.replace(/^tracker:/, '')))
    });
  }
}

/**
 * Compare a replayed response with the captured one.
 *
 * Everything is compared exactly, except the order of `sources` — the trackers
 * are scraped concurrently, so their order is not stable.
 */
function expectSameResponse(actual: Captured, expected: Captured): void {
  expect(actual.streams.length).toBe(expected.streams.length);

  for (const [index, want] of expected.streams.entries()) {
    const got = actual.streams[index];
    const where = `stream ${index} (${want.infoHash.slice(0, 12)})`;

    expect(got.url, where).toBe(want.url);
    expect(got.infoHash, where).toBe(want.infoHash);
    expect(got.fileIdx, where).toBe(want.fileIdx);
    expect(got.name, where).toBe(want.name);
    expect(got.behaviorHints, where).toEqual(want.behaviorHints);

    // The description is built entirely from the torrent payload and the
    // scrape — and the stub replays the scrape the snapshot saw.
    expect(got.description, where).toBe(want.description);

    // The trackers are scraped concurrently, so their order is not stable.
    expect([...got.sources].sort(), where).toEqual([...want.sources].sort());
  }
}

const records: RecordMeta[] = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, 'data', 'examples', 'self-stream', 'meta.json'), 'utf8'
  )
).records;

describe('the self-stream corpus', () => {
  it('holds the captured responses of our own endpoint', () => {
    expect(records.length).toBeGreaterThanOrEqual(10);
  });

  for (const record of records) {
    it(`replays ${record.id}`, async () => {
      const captured = loadExample<Captured>('self-stream', record.id);
      serveInputs(record, captured);

      const res = await request(app).get(
        `/stream/${record.params.type}/${record.params.id}.json`
      );

      expect(res.status).toBe(200);
      expectSameResponse(res.body as Captured, captured);
    });
  }
});
