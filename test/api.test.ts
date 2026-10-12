import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fetch, { Response } from 'node-fetch';
import Client from 'bittorrent-tracker';
import { resolveKitsuToExternal } from '../src/api/kitsu.js';
import { resolveMediaId, getMedia, searchTorrents, getTorrent, nekoFetch } from '../src/api/nekobt.js';
import { scrapeTorrents } from '../src/api/tracker-scrapper.js';
import { NekoTorrentItem } from '../src/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadFixture<T>(filename: string): T {
  const filepath = path.join(__dirname, 'fixtures', filename);
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

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

describe('api/kitsu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves Kitsu ID to MAL mapping using fixture', async () => {
    const fixtureData = loadFixture('kitsu_49235_mappings.json');
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

  it('getMedia retrieves media details using media_s172 fixture', async () => {
    const realMedia = loadFixture('media_s172.json');

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
    const realTorrent = loadFixture<NekoTorrentItem>('torrent_s172.json');

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
    const realTorrent = loadFixture<NekoTorrentItem>('torrent_s172.json');

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
});

describe('api/tracker-scrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scrapeTorrents collects scrape stats and builds swarms', async () => {
    const realTorrent = loadFixture<NekoTorrentItem>('torrent_s172.json');

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
    const realTorrent = loadFixture<NekoTorrentItem>('torrent_s172.json');

    mockedTracker.scrape.mockImplementation((opts: any, cb: any) => {
      cb(new Error('Connection refused'), null);
      return { destroy: vi.fn() } as any;
    });

    const swarms = await scrapeTorrents([realTorrent], 200);
    expect(swarms).toHaveLength(1);
    expect(swarms[0].seeders).toBe(0);
    expect(swarms[0].leechers).toBe(0);
  });
});
