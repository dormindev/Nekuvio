import Client, { ScrapeResponse, ScrapeResult } from "bittorrent-tracker";
import type { NekoTorrentItem } from "../types.js";
import { logger } from "../utils/logger.js";
import { inspect } from "util";

const DEFAULT_TIMEOUT_MS = 500;

export interface TrackerResult {
  tracker: string;
  seeders: number;
  leechers: number;
}

export interface TorrentSwarm {
  torrent: NekoTorrentItem;
  trackers: TrackerResult[];
  seeders: number;
  leechers: number;
}

interface TrackerStats {
  complete: number;
  incomplete: number;
  downloaded: number;
}

export async function scrapeTorrents(
  torrents: NekoTorrentItem[],
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<TorrentSwarm[]> {
  const trackerHashes = groupTorrentsByTracker(torrents);
  const trackerResults = await scrapeTrackers(trackerHashes, timeoutMs);

  return buildTorrentSwarms(torrents, trackerResults);
}

function groupTorrentsByTracker(
  torrents: NekoTorrentItem[],
): Map<string, Set<string>> {
  const trackerHashes = new Map<string, Set<string>>();

  for (const torrent of torrents) {
    for (const tracker of getTrackers(torrent.magnet)) {
      let hashes = trackerHashes.get(tracker);
      if (!hashes) trackerHashes.set(tracker, hashes = new Set());

      hashes.add(torrent.infohash.toLowerCase());
    }
  }

  return trackerHashes;
}

async function scrapeTrackers(
  trackerHashes: Map<string, Set<string>>,
  timeoutMs: number,
): Promise<Map<string, TrackerResult[]>> {
  const results = new Map<string, TrackerResult[]>();

  await Promise.allSettled(
    [...trackerHashes.entries()].map(async ([tracker, hashes]) => {
      try {
        const scraped = await scrapeTracker(tracker, [...hashes], timeoutMs);

        for (const [infoHash, stat] of scraped) {
          let trackerResults = results.get(infoHash);
          if (!trackerResults) results.set(infoHash, trackerResults = []);

          trackerResults.push({
            tracker,
            seeders: stat.complete,
            leechers: stat.incomplete,
          });
        }
      } catch (error) {
        logger.debug(`[tracker] ${tracker}: failed`, error);
      }
    }),
  );

  return results;
}

function buildTorrentSwarms(
  torrents: NekoTorrentItem[],
  trackerResults: Map<string, TrackerResult[]>,
): TorrentSwarm[] {
  return torrents.map(torrent => {
    const trackers = trackerResults.get(torrent.infohash.toLowerCase()) ?? [];

    return {
      torrent,
      trackers,
      seeders: Math.max(0, ...trackers.map(x => x.seeders)),
      leechers: Math.max(0, ...trackers.map(x => x.leechers)),
    };
  });
}

function getTrackers(magnet: string): string[] {
  return [...new Set(new URL(magnet).searchParams.getAll("tr"))];
}

function normalizeInfoHash(infoHash: string): string {
  const decoded = Buffer.from(infoHash, "hex").toString();

  return /^[0-9a-f]{40}$/i.test(decoded)
    ? decoded.toLowerCase()
    : infoHash.toLowerCase();
}

function isScrapeResult(data: ScrapeResponse): data is ScrapeResult {
  return "infoHash" in data;
}

function scrapeTracker(
  tracker: string,
  infoHashes: string[],
  timeoutMs: number,
): Promise<Map<string, TrackerStats>> {
  logger.debug(
    `[tracker] ${tracker}: scraping ${infoHashes.length} hashes`,
  );
  logger.debug(`[tracker] ${tracker}: hashes: ${infoHashes}`);

  return new Promise((resolve, reject) => {
    let settled = false;
    let client: ReturnType<typeof Client.scrape> | undefined;

    const timeout = setTimeout(() => {
      if (settled) return;

      settled = true;

      logger.debug(`[tracker] ${tracker}: timeout after ${timeoutMs}ms, destroying client`);

      client?.destroy();

      reject(new Error(`Tracker timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    logger.debug(`[tracker] scrape start: ${tracker}`);

    client = Client.scrape(
      {
        announce: tracker,
        infoHash: infoHashes.map(infoHash => Buffer.from(infoHash, "hex")),
      },
      (error, data) => {
        logger.debug(`[tracker] ${tracker}: CALLBACK FIRED`);

        if (settled) return;
        settled = true;

        clearTimeout(timeout);

        if (error) {
          reject(error);
          return;
        }

        logger.debug(`[tracker] ${tracker}: scrape response ${inspect(data, { depth: 5 })}`);
        logger.debug(`[tracker] ${tracker}: ${Object.keys(data).length} results`);

        const results = new Map<string, TrackerStats>();

        const entries = isScrapeResult(data)
          ? [[data.infoHash, data] as const]
          : Object.entries(data);

        for (const [infoHash, entry] of entries) {
          const normalizedInfoHash = normalizeInfoHash(infoHash);

          logger.debug(`[tracker] ${tracker} ${normalizedInfoHash}:`, {
            seeders: entry.complete,
            leechers: entry.incomplete,
          });

          results.set(normalizedInfoHash, {
            complete: entry.complete,
            incomplete: entry.incomplete,
            downloaded: entry.downloaded,
          });
        }

        resolve(results);
      },
    );
  });
}
