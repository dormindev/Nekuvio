import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

import type { Express } from 'express';
import type { Server } from 'node:http';
import request from 'supertest';

import { resolveKitsuToExternal } from '../src/api/kitsu.js';
import { resolveMediaId, getMedia, searchTorrents, getTorrent } from '../src/api/nekobt.js';
import { scrapeTorrents } from '../src/api/tracker-scrapper.js';
import type { NekoTorrentItem } from '../src/types.js';

import { loadFixture } from './helpers/fixtures.js';


/*
 * app.ts pulls in the network boundary (nekobt, tracker-scrapper, kitsu).
 * We mock those so the route layer can be exercised deterministically, while
 * keeping the real parser / matcher / streamBuilder pipeline.
 */
vi.mock('../src/api/nekobt.js', () => ({
  resolveMediaId: vi.fn(),
  getMedia: vi.fn(),
  searchTorrents: vi.fn(),
  getTorrent: vi.fn(),
}));
vi.mock('../src/api/tracker-scrapper.js', () => ({
  scrapeTorrents: vi.fn(),
}));
vi.mock('../src/api/kitsu.js', () => ({
  resolveKitsuToExternal: vi.fn(),
}));

// Imported dynamically so process.env.PORT is controlled at module-eval time.
let app: Express;
let startServer: (port?: number | string) => Server;

beforeAll(async () => {
  delete process.env.PORT;
  const mod = await import('../src/app.js');
  app = mod.app;
  startServer = mod.startServer;
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('app routes', () => {
  it('serves the manifest with CORS headers', async () => {
    const res = await request(app).get('/manifest.json');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['access-control-allow-headers']).toBe('*');
    expect(res.body).toMatchObject({
      resources: ['stream'],
      types: ['anime', 'series', 'movie'],
    });
    expect(res.body.idPrefixes).toEqual(
      expect.arrayContaining(['tt', 'kitsu', 'anilist', 'mal', 'tmdb', 'tvdb'])
    );
  });

  it('returns constructed streams for a series request', async () => {
    const media = loadFixture<any>('media_s172.json');
    const torrent = loadFixture<NekoTorrentItem>('torrent_s172.json');

    vi.mocked(resolveMediaId).mockResolvedValue({
      media_id: 's172',
      anilist_id: 182205,
      isMovie: false,
    });
    vi.mocked(getMedia).mockResolvedValue(media);
    vi.mocked(searchTorrents).mockResolvedValue([torrent]);
    vi.mocked(getTorrent).mockResolvedValue(torrent);
    vi.mocked(scrapeTorrents).mockResolvedValue([
      { torrent, trackers: [], seeders: 0, leechers: 0 },
    ]);

    const res = await request(app).get('/stream/series/tt123:4:24.json');

    expect(res.status).toBe(200);
    expect(res.body.streams).toHaveLength(1);
    expect(res.body.streams[0].infoHash).toBe(torrent.infohash);
    expect(res.body.streams[0].name).toMatch(/NekoBT/);
    expect(res.body.streams[0].fileIdx).toBe(0);
  });

  it('translates kitsu IDs to MAL before resolving media', async () => {
    vi.mocked(resolveKitsuToExternal).mockResolvedValue({ name: 'mal', id: '59970' });
    vi.mocked(resolveMediaId).mockResolvedValue(null);

    const res = await request(app).get('/stream/series/kitsu:49235:24.json');

    expect(res.status).toBe(200);
    expect(resolveKitsuToExternal).toHaveBeenCalledWith('49235');
    expect(resolveMediaId).toHaveBeenCalledWith('mal-59970');
    expect(res.body).toEqual({ streams: [] });
  });

  it('returns empty streams when media cannot be resolved', async () => {
    vi.mocked(resolveMediaId).mockResolvedValue(null);

    const res = await request(app).get('/stream/series/tt999:1:1.json');

    expect(res.status).toBe(200);
    expect(resolveMediaId).toHaveBeenCalledWith('imdb-tt999');
    expect(res.body).toEqual({ streams: [] });
  });

  it('returns empty streams when processing throws', async () => {
    vi.mocked(resolveMediaId).mockRejectedValue(new Error('boom'));

    const res = await request(app).get('/stream/series/tt123:4:24.json');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ streams: [] });
  });

  it('builds a movie stream and searches torrents with a null episode id', async () => {
    const torrent = loadFixture<NekoTorrentItem>('torrent_s172.json');

    vi.mocked(resolveMediaId).mockResolvedValue({ media_id: 'm145', isMovie: true });
    vi.mocked(getMedia).mockResolvedValue({ anilist: null, episodes: [] } as any);
    vi.mocked(searchTorrents).mockResolvedValue([torrent]);
    vi.mocked(getTorrent).mockResolvedValue({
      ...torrent,
      files: [
        { name: 'Sample.mkv', length: 1000 },
        { name: 'Movie.1080p.mkv', length: 5_000_000_000 }
      ]
    });
    vi.mocked(scrapeTorrents).mockResolvedValue([
      { torrent, trackers: [], seeders: 0, leechers: 0 }
    ]);

    const res = await request(app).get('/stream/movie/tt5323662.json');

    expect(res.status).toBe(200);
    expect(res.body.streams).toHaveLength(1);
    expect(res.body.streams[0].fileIdx).toBe(1);
    // Movie requests have no episode, so the search falls back to a null episode id.
    expect(searchTorrents).toHaveBeenCalledWith('m145', null);
  });

  it('skips streams when getTorrent details return null', async () => {
    const torrent = loadFixture<NekoTorrentItem>('torrent_s172.json');

    vi.mocked(resolveMediaId).mockResolvedValue({ media_id: 'm145', isMovie: true });
    vi.mocked(getMedia).mockResolvedValue({ anilist: null, episodes: [] } as any);
    vi.mocked(searchTorrents).mockResolvedValue([torrent]);
    vi.mocked(getTorrent).mockResolvedValue(null);
    vi.mocked(scrapeTorrents).mockResolvedValue([
      { torrent, trackers: [], seeders: 0, leechers: 0 }
    ]);

    const res = await request(app).get('/stream/movie/tt5323662.json');

    expect(res.status).toBe(200);
    expect(res.body.streams).toHaveLength(0);
  });
});

describe('startServer', () => {
  it('listens on an explicit ephemeral port and closes cleanly', async () => {
    const server = startServer(0);
    await new Promise<void>(resolve => server.once('listening', () => resolve()));

    expect((server.address() as { port: number }).port).toBeGreaterThan(0);

    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it('defaults to the PORT environment variable when no port is passed', async () => {
    vi.resetModules();
    const originalPort = process.env.PORT;

    try {
      process.env.PORT = '0';
      const mod = await import('../src/app.js');
      const server = mod.startServer();
      await new Promise<void>(resolve => server.once('listening', () => resolve()));

      expect((server.address() as { port: number }).port).toBeGreaterThan(0);

      await new Promise<void>(resolve => server.close(() => resolve()));
    } finally {
      if (originalPort === undefined) {
        delete process.env.PORT;
      } else {
        process.env.PORT = originalPort;
      }
    }
  });
});
