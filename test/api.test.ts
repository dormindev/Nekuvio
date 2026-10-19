import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Client from 'bittorrent-tracker';
import fetch, { type Response } from 'node-fetch';

import { resolveKitsuToExternal } from '../src/api/kitsu.js';
import {
  getMedia,
  getTorrent,
  nekoFetch,
  resolveMediaId,
  searchTorrents
} from '../src/api/nekobt.js';
import { scrapeTorrents } from '../src/api/tracker-scrapper.js';
import type { NekoTorrentItem } from '../src/types.js';

import { loadFixture } from './helpers/fixtures.js';


vi.mock('node-fetch', () => {
  return {
    default: vi.fn()
  };
});

vi.mock('bittorrent-tracker', () => {
  return {
    default: {
      scrape: vi.fn()
    }
  };
});

const mockedFetch = vi.mocked(fetch);
const mockedTracker = vi.mocked(Client);

afterEach(() => {
  vi.useRealTimers();
});

describe('api/kitsu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves Kitsu ID to MAL mapping using fixture', async () => {
    const fixtureData = loadFixture('kitsu-mappings', '49235');
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => fixtureData
    } as unknown as Response;

    mockedFetch.mockResolvedValueOnce(mockResponse);

    const result = await resolveKitsuToExternal('49235');
    expect(result).toEqual({
      name: 'mal',
      id: '59970'
    });
    expect(mockedFetch).toHaveBeenCalledWith(
      'https://kitsu.io/api/edge/anime/49235/mappings',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/vnd.api+json'
        })
      })
    );
  });

  it('throws error when kitsu response is not ok', async () => {
    const mockResponse = {
      ok: false,
      status: 404,
      statusText: 'Not Found'
    } as unknown as Response;

    mockedFetch.mockResolvedValueOnce(mockResponse);

    await expect(resolveKitsuToExternal('9999999')).rejects.toThrow(
      'Failed to resolve Kitsu ID 9999999: 404 Not Found'
    );
  });

  it('throws error when no useful mapping is found in kitsu response', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({ data: [] })
    } as unknown as Response;

    mockedFetch.mockResolvedValueOnce(mockResponse);

    await expect(resolveKitsuToExternal('12345')).rejects.toThrow(
      'No useful mapping found for Kitsu ID 12345'
    );
  });

  it('treats a non-array data payload as having no mappings', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({ data: null })
    } as unknown as Response;

    mockedFetch.mockResolvedValueOnce(mockResponse);

    await expect(resolveKitsuToExternal('12345')).rejects.toThrow(
      'No useful mapping found for Kitsu ID 12345'
    );
  });
});

describe('api/nekobt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolveMediaId returns media ID resolution info with isMovie=false for series', async () => {
    const mockPayload = {
      data: {
        media_id: 's172',
        anilist_id: 182205
      }
    };

    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockPayload
    } as unknown as Response);

    const result = await resolveMediaId('anilist-182205');
    expect(result).toEqual({
      media_id: 's172',
      anilist_id: 182205,
      isMovie: false
    });
  });

  it('resolveMediaId marks isMovie=true for movie IDs starting with m', async () => {
    const mockPayload = {
      data: {
        media_id: 'm145',
        anilist_id: 199
      }
    };

    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockPayload
    } as unknown as Response);

    const result = await resolveMediaId('imdb-tt0245429');
    expect(result).toEqual({
      media_id: 'm145',
      anilist_id: 199,
      isMovie: true
    });
  });

  it('resolveMediaId returns null on failed response', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: true, message: 'Not found' })
    } as unknown as Response);

    const result = await resolveMediaId('invalid-id');
    expect(result).toBeNull();
  });

  it('getMedia retrieves media details using nekobt-media/s172 fixture', async () => {
    const realMedia = loadFixture('nekobt-media', 's172');

    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: realMedia })
    } as unknown as Response);

    const result = await getMedia('s172');
    expect(result).toEqual(realMedia);
  });

  it('getMedia throws error when API returns error', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: true, message: 'Internal error' })
    } as unknown as Response);

    await expect(getMedia('s172')).rejects.toThrow(/nekoBT media lookup failed/);
  });

  it('searchTorrents returns torrent list matching episode', async () => {
    const realTorrent = loadFixture<NekoTorrentItem>('nekobt-torrents', '14064189768715');

    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { results: [realTorrent] } })
    } as unknown as Response);

    const result = await searchTorrents('s172', 220940);
    expect(result).toEqual([realTorrent]);
  });

  it('searchTorrents returns empty array on failure', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: true })
    } as unknown as Response);

    const result = await searchTorrents('s172', 220940);
    expect(result).toEqual([]);
  });

  it('getTorrent returns torrent info by ID', async () => {
    const realTorrent = loadFixture<NekoTorrentItem>('nekobt-torrents', '14064189768715');

    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: realTorrent })
    } as unknown as Response);

    const result = await getTorrent('14064189768715');
    expect(result).toEqual(realTorrent);
  });

  it('getTorrent returns null on error', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: true })
    } as unknown as Response);

    const result = await getTorrent('not-found');
    expect(result).toBeNull();
  });

  it('nekoFetch handles 429 rate limit retry with retry-after header', async () => {
    vi.useFakeTimers();

    const rateLimitResponse = {
      ok: false,
      status: 429,
      headers: new Map([['retry-after', '1']]),
      clone: () => ({ json: async () => ({ retry_after: 1 }) })
    } as unknown as Response;

    const okResponse = {
      ok: true,
      status: 200,
      json: async () => ({ success: true })
    } as unknown as Response;

    mockedFetch
      .mockResolvedValueOnce(rateLimitResponse)
      .mockResolvedValueOnce(okResponse);

    const fetchPromise = nekoFetch('https://nekobt.to/api/v1/test');
    await vi.advanceTimersByTimeAsync(1500);

    const result = await fetchPromise;
    expect(result.data).toEqual({ success: true });

    vi.useRealTimers();
  });

  it('nekoFetch defaults the retry wait when no retry-after is provided', async () => {
    vi.useFakeTimers();

    const rateLimitResponse = {
      ok: false,
      status: 429,
      headers: new Map(),
      clone: () => ({ json: async () => ({}) })
    } as unknown as Response;

    const okResponse = {
      ok: true,
      status: 200,
      json: async () => ({ success: true })
    } as unknown as Response;

    mockedFetch
      .mockResolvedValueOnce(rateLimitResponse)
      .mockResolvedValueOnce(okResponse);

    const fetchPromise = nekoFetch('https://nekobt.to/api/v1/test');
    await vi.advanceTimersByTimeAsync(2100);

    const result = await fetchPromise;
    expect(result.data).toEqual({ success: true });
  });

  it('nekoFetch rethrows network errors', async () => {
    mockedFetch.mockRejectedValueOnce(new Error('network down'));

    await expect(nekoFetch('https://nekobt.to/api/v1/test')).rejects.toThrow('network down');
  });

  it('nekoFetch returns null data for a non-JSON response body', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('invalid json');
      }
    } as unknown as Response);

    const result = await nekoFetch('https://nekobt.to/api/v1/test');
    expect(result.data).toBeNull();
  });

  it('resolveMediaId returns null when the response carries no data', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => null
    } as unknown as Response);

    const result = await resolveMediaId('anilist-1');
    expect(result).toBeNull();
  });

  it('getMedia returns null when the response carries no data', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({})
    } as unknown as Response);

    const result = await getMedia('s172');
    expect(result).toBeNull();
  });

  it('searchTorrents omits the episode filter when episodeId is null', async () => {
    const realTorrent = loadFixture<NekoTorrentItem>('nekobt-torrents', '14064189768715');

    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { results: [realTorrent] } })
    } as unknown as Response);

    const result = await searchTorrents('s172', null);
    expect(result).toEqual([realTorrent]);
  });

  it('searchTorrents returns an empty array when results are not an array', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: {} })
    } as unknown as Response);

    const result = await searchTorrents('s172', 220940);
    expect(result).toEqual([]);
  });

  it('getTorrent returns null when the response carries no data', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({})
    } as unknown as Response);

    const result = await getTorrent('123');
    expect(result).toBeNull();
  });
});

describe('api/tracker-scrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scrapeTorrents collects scrape stats and builds swarms', async () => {
    const realTorrent = loadFixture<NekoTorrentItem>('nekobt-torrents', '14064189768715');

    mockedTracker.scrape.mockImplementation((opts: any, cb: any) => {
      const infoHash = realTorrent.infohash.toLowerCase();
      cb(null, {
        [infoHash]: {
          complete: 42,
          incomplete: 5,
          downloaded: 100
        }
      });
      return { destroy: vi.fn() } as any;
    });

    const swarms = await scrapeTorrents([realTorrent], 1000);
    expect(swarms).toHaveLength(1);
    expect(swarms[0].torrent).toEqual(realTorrent);
    expect(swarms[0].seeders).toBe(42);
    expect(swarms[0].leechers).toBe(5);
    expect(swarms[0].trackers.length).toBeGreaterThan(0);
  });

  it('handles tracker error gracefully and defaults seeders and leechers', async () => {
    const realTorrent = loadFixture<NekoTorrentItem>('nekobt-torrents', '14064189768715');

    mockedTracker.scrape.mockImplementation((opts: any, cb: any) => {
      cb(new Error('Connection refused'), null);
      return { destroy: vi.fn() } as any;
    });

    const swarms = await scrapeTorrents([realTorrent], 200);
    expect(swarms).toHaveLength(1);
    expect(swarms[0].seeders).toBe(0);
    expect(swarms[0].leechers).toBe(0);
  });

  it('times out and defaults stats when a tracker never responds', async () => {
    vi.useFakeTimers();
    const realTorrent = loadFixture<NekoTorrentItem>('nekobt-torrents', '14064189768715');
    const destroy = vi.fn();

    mockedTracker.scrape.mockImplementation(() => ({ destroy }) as any);

    const promise = scrapeTorrents([realTorrent], 500);
    await vi.advanceTimersByTimeAsync(500);
    const swarms = await promise;

    expect(destroy).toHaveBeenCalled();
    expect(swarms).toHaveLength(1);
    expect(swarms[0].seeders).toBe(0);
    expect(swarms[0].leechers).toBe(0);
  });

  it('ignores a tracker callback that arrives after the timeout', async () => {
    vi.useFakeTimers();
    const realTorrent = loadFixture<NekoTorrentItem>('nekobt-torrents', '14064189768715');
    let capturedCb: ((error: any, data: any) => void) | undefined;

    mockedTracker.scrape.mockImplementation((_opts: any, cb: any) => {
      capturedCb = cb;
      return { destroy: vi.fn() } as any;
    });

    const promise = scrapeTorrents([realTorrent], 500);
    await vi.advanceTimersByTimeAsync(500);

    // The timeout already settled the request; a late callback must be a no-op.
    capturedCb?.(null, {});
    const swarms = await promise;

    expect(swarms).toHaveLength(1);
    expect(swarms[0].seeders).toBe(0);
  });

  it('safely ignores a timeout that fires after the scrape already settled', async () => {
    vi.useFakeTimers();
    const realTorrent = loadFixture<NekoTorrentItem>('nekobt-torrents', '14064189768715');
    // Simulate the defensive case where the timeout is not cleared in time, so it
    // can fire after the scrape callback has already settled the request.
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout').mockImplementation(() => {});

    mockedTracker.scrape.mockImplementation((_opts: any, cb: any) => {
      cb(null, {
        [realTorrent.infohash.toLowerCase()]: { complete: 5, incomplete: 1, downloaded: 2 }
      });
      return { destroy: vi.fn() } as any;
    });

    try {
      const promise = scrapeTorrents([realTorrent], 500);
      await vi.runAllTimersAsync();
      const swarms = await promise;

      // Resolved from the scrape callback, not rejected by the stale timeout.
      expect(swarms[0].seeders).toBe(5);
      expect(swarms[0].leechers).toBe(1);
    } finally {
      clearTimeoutSpy.mockRestore();
    }
  });

  it('handles a single ScrapeResult response', async () => {
    const realTorrent = loadFixture<NekoTorrentItem>('nekobt-torrents', '14064189768715');

    mockedTracker.scrape.mockImplementation((_opts: any, cb: any) => {
      cb(null, {
        infoHash: realTorrent.infohash,
        complete: 10,
        incomplete: 2,
        downloaded: 50
      });
      return { destroy: vi.fn() } as any;
    });

    const swarms = await scrapeTorrents([realTorrent], 1000);
    expect(swarms[0].seeders).toBe(10);
    expect(swarms[0].leechers).toBe(2);
  });

  it('groups multiple torrents under their shared trackers', async () => {
    const torrent = loadFixture<NekoTorrentItem>('nekobt-torrents', '14064189768715');
    const otherTorrent = { ...torrent, infohash: 'b'.repeat(40) };

    mockedTracker.scrape.mockImplementation((_opts: any, cb: any) => {
      cb(null, {});
      return { destroy: vi.fn() } as any;
    });

    const swarms = await scrapeTorrents([torrent, otherTorrent], 1000);
    expect(swarms).toHaveLength(2);
    expect(swarms[0].seeders).toBe(0);
    expect(swarms[1].seeders).toBe(0);
  });

  it('normalizes hex-of-hex infohash keys returned by trackers', async () => {
    const torrent = loadFixture<NekoTorrentItem>('nekobt-torrents', '14064189768715');
    const infohash = 'abcdef0123456789abcdef0123456789abcdef01';
    const hexOfHex = Buffer.from(infohash).toString('hex');
    const shapedTorrent = { ...torrent, infohash };

    mockedTracker.scrape.mockImplementation((_opts: any, cb: any) => {
      cb(null, {
        [hexOfHex]: { complete: 7, incomplete: 1, downloaded: 3 }
      });
      return { destroy: vi.fn() } as any;
    });

    const swarms = await scrapeTorrents([shapedTorrent], 1000);
    expect(swarms[0].seeders).toBe(7);
    expect(swarms[0].leechers).toBe(1);
  });
});
