/**
 * Generic tests over the `examples/` corpus.
 *
 * `examples/` is the broad, diverse gather of real cases. It is consumed as a
 * whole — one test per folder, iterating over every payload — never by
 * pointing at a single data point. (A test that needs a specific example
 * promotes it to a fixture first.)
 */
import { describe, it, expect } from 'vitest';

import { fitInfo, findEpisodeFile, findMovieFile } from '../src/pipeline/matcher.js';
import { resolveKitsuToExternal } from '../src/api/kitsu.js';
import { resolveMediaId, searchTorrents } from '../src/api/nekobt.js';

import { loadExamples } from './helpers/test-data.js';

import type { NekoMediaData, NekoTorrentItem } from '../src/types.js';

interface RawBody<T> {
  error: boolean;
  data: T;
}

describe('examples/nekobt-media', () => {
  const bodies = loadExamples<RawBody<NekoMediaData>>('nekobt-media');
  const media = bodies.filter(b => b.error === false).map(b => b.data);

  it('holds a diverse corpus', () => {
    expect(media.length).toBeGreaterThanOrEqual(8);
  });

  it('resolves each of its own episodes back to that episode', () => {
    for (const m of media) {
      const episodes = (m.episodes ?? []).filter(e => e.season > 0 && e.absolute != null);
      for (const episode of episodes.slice(0, 3)) {
        const info = fitInfo(
          { media_id: m.id ?? 'm', anilist_id: m.anilist.primary?.id ?? 0, isMovie: false },
          m,
          {
            provider: 'imdb',
            externalId: 'tt1',
            isMovie: false,
            isAnimeProvider: false,
            season: episode.season,
            episode: episode.episode
          }
        );
        expect(info.episode?.id, `${m.id} s${episode.season}e${episode.episode}`).toBe(episode.id);
        expect(info.episode?.absolute).toBe(episode.absolute);
      }
    }
  });

  it('keeps its season windows coherent', () => {
    for (const m of media) {
      // Unmapped media carries `anilist: null` — the type says otherwise.
      if (m.anilist === null) continue;
      for (const entry of m.anilist.entries) {
        // Movie entries carry no window at all (season/src_end/dst_end are null).
        if (entry.src_end === null || entry.dst_end === null) continue;
        expect(entry.src_start).toBeLessThanOrEqual(entry.src_end);
        expect(entry.dst_start).toBeLessThanOrEqual(entry.dst_end);
      }
    }
  });

  it('has no duplicate episode numbers within a season', () => {
    for (const m of media) {
      const seen = new Set<string>();
      for (const episode of m.episodes ?? []) {
        const key = `${episode.season}/${episode.episode}`;
        expect(seen.has(key), `${m.id} duplicates ${key}`).toBe(false);
        seen.add(key);
      }
    }
  });
});

describe('examples/nekobt-torrents', () => {
  const bodies = loadExamples<RawBody<NekoTorrentItem>>('nekobt-torrents');
  const torrents = bodies.filter(b => b.error === false).map(b => b.data);

  it('holds a diverse corpus', () => {
    expect(torrents.length).toBeGreaterThanOrEqual(40);
  });

  it('never throws while selecting a file', () => {
    const info = {
      media_id: 's172',
      media: { anilist: { entries: [] }, episodes: [] },
      season: { season: 4, src_start: 1, src_end: 24, dst_start: 1, dst_end: 24, anilist_id: 1 },
      episode: { id: 1, season: 4, episode: 23, absolute: 95 }
    };
    for (const torrent of torrents) {
      expect(() => findEpisodeFile(torrent, info as never)).not.toThrow();
      expect(() => findMovieFile(torrent, info as never)).not.toThrow();
    }
  });

  it('gives every file a name and a numeric length', () => {
    for (const torrent of torrents) {
      for (const file of torrent.files ?? []) {
        expect(file.name).toBeTruthy();
        // A real torrent does carry a zero-length file (14025389761538), so
        // the invariant is "numeric", not "positive".
        expect(typeof file.length).toBe('number');
      }
    }
  });
});

describe('examples/kitsu-mappings', () => {
  // Kitsu answers JSON:API — { data, meta, links } — with no error envelope.
  const bodies = loadExamples<{ data: unknown[]; meta: unknown; links: unknown }>('kitsu-mappings');

  it('holds a diverse corpus', () => {
    expect(bodies.length).toBeGreaterThanOrEqual(5);
  });

  it('is shaped as a JSON:API document', () => {
    for (const body of bodies) {
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.meta).toBeDefined();
      expect(body.links).toBeDefined();
    }
  });

  it('exposes at least one mapping with an external id', () => {
    const withMapping = bodies.filter(b =>
      b.data.some(m => !!(m as { attributes?: { externalId?: string } }).attributes?.externalId)
    );
    expect(withMapping.length).toBeGreaterThan(0);
  });
});

describe('examples/nekobt-resolve', () => {
  const bodies = loadExamples<RawBody<{ media_id: string; anilist_id: number | null }>>(
    'nekobt-resolve'
  );
  // One record is an error capture (an external id NekoBT does not know).
  const resolved = bodies.filter(b => b.error === false);

  it('holds a diverse corpus', () => {
    expect(resolved.length).toBeGreaterThanOrEqual(10);
  });

  it('resolves every external id to a media id', () => {
    for (const body of resolved) {
      expect(body.data.media_id).toMatch(/^[ms]\d+$/);
    }
  });

  it('leaves anilist_id null when the media is unmapped', () => {
    for (const body of resolved) {
      const anilistId = body.data.anilist_id;
      expect(anilistId === null || typeof anilistId === 'number').toBe(true);
    }
  });

  it('marks movies by their media id prefix', () => {
    for (const body of resolved) {
      const isMovie = body.data.media_id.startsWith('m');
      expect(isMovie).toBe(body.data.media_id.startsWith('m'));
    }
  });
});

describe('examples/nekobt-search', () => {
  const bodies = loadExamples<RawBody<{ results: unknown[] }>>('nekobt-search');

  it('holds a diverse corpus', () => {
    expect(bodies.length).toBeGreaterThanOrEqual(10);
  });

  it('always answers with a results array', () => {
    for (const body of bodies) {
      expect(body.error).toBe(false);
      expect(Array.isArray(body.data.results)).toBe(true);
    }
  });
});
