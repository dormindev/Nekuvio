import { describe, expect, it } from 'vitest';

import {
  findEpisodeFile,
  findMovieFile,
  fitInfo
} from '../src/pipeline/matcher.js';
import type {
  FitInfoResult,
  NekoMediaData,
  NekoMediaResolveData,
  NuvioParsedRequest
} from '../src/types.js';

import { loadFixtureData, loadSynthetic } from './helpers/test-data.js';


// The media below are real captures from the data catalog. The *request* is
// what varies — the media stays fixed, so every assertion is checked against
// a shape the API actually returns.
const s172 = loadFixtureData<NekoMediaData>('nekobt-media', 's172');
const m145 = loadFixtureData<NekoMediaData>('nekobt-media', 'm145');
const unmapped = loadFixtureData<NekoMediaData>('nekobt-media', 's11599');
const s1545 = loadFixtureData<NekoMediaData>('nekobt-media', 's1545');

// The primary season of s172 carries the series title with its synonyms; one
// of s1545's entries carries a title without any.
const primarySeason = s172.anilist.entries.find(e => e.season === 1)!;
const season4 = s172.anilist.entries.find(e => e.season === 4)!;
const withoutSynonyms = s1545.anilist.entries.find(
  e => e.media?.title && (e.media.title.synonyms ?? []).length === 0
)!;

function request(overrides: Partial<NuvioParsedRequest>): NuvioParsedRequest {
  return {
    provider: 'imdb',
    externalId: 'tt1',
    isMovie: false,
    isAnimeProvider: false,
    season: null,
    episode: null,
    ...overrides
  };
}

describe('fitInfo', () => {
  const nekoId: NekoMediaResolveData = {
    media_id: 's172',
    anilist_id: 182205,
    isMovie: false
  };

  it('correctly maps request season and episode to anime episode', () => {
    const info = fitInfo(nekoId, s172, request({ season: 4, episode: 23 }));

    expect(info.media_id).toBe('s172');
    expect(info.season).toBeTruthy();
    expect(info.season?.season).toBe(4);
    expect(info.episode).toBeTruthy();
    expect(info.episode?.episode).toBe(23);
    expect(info.episode?.absolute).toBe(95);
    expect(info.episode?.id).toBe(220939);
  });

  it('resolves the primary season when the request matches it', () => {
    // The primary entry of s172 is season 1 (src 1-24, dst 1-24).
    const info = fitInfo(
      { media_id: 's172', anilist_id: 101280, isMovie: false },
      s172,
      request({ season: 1, episode: 1 })
    );

    expect(info.season?.season).toBe(1);
    expect(info.season?.isPrimary).toBe(true);
    expect(info.episode?.season).toBe(1);
  });

  it('applies the src_start offset when the matched season is not primary', () => {
    // s172's second season-2 entry runs src 13-24 → dst 1-12, and it is not
    // the primary season, so the episode is renumbered into src space:
    // 5 + (src_start 13 - 1) = 17.
    const info = fitInfo(
      { media_id: 's172', anilist_id: 116742, isMovie: false },
      s172,
      request({ isAnimeProvider: true, episode: 5 })
    );

    expect(info.season?.season).toBe(2);
    expect(info.season?.isPrimary).toBe(false);
    expect(info.episode?.episode).toBe(17);
    expect(info.episode?.id).toBe(4269);
    expect(info.episode?.absolute).toBe(41);
  });

  it('handles movie request: returns null episode when nekoId.isMovie is true', () => {
    const info = fitInfo(
      { media_id: 'm145', anilist_id: 20954, isMovie: true },
      m145,
      request({ isMovie: true })
    );

    expect(info.episode).toBeNull();
    expect(info.season?.season).toBeNull();
  });

  it('handles media with null anilist (unmapped media like s11599 or m1305) without crashing', () => {
    const info = fitInfo(
      { media_id: 's11599', anilist_id: 1, isMovie: false },
      unmapped,
      request({ season: 1, episode: 1 })
    );

    expect(info.season).toBeNull();
    expect(info.episode?.id).toBe(524767);
  });

  it('resolves real fixture s172 (Slime S4) accurately', () => {
    const info = fitInfo(nekoId, s172, request({ season: 4, episode: 23 }));

    expect(info.media_id).toBe('s172');
    expect(info.episode?.id).toBe(220939);
    expect(info.episode?.title).toBe("Granville's Hope");
  });

  it('falls back to request season and episode in media.episodes when season info is null', () => {
    // Season 0 entries are skipped for non-anime providers, so no season is
    // found and the episode is looked up in media.episodes directly.
    const info = fitInfo(nekoId, s172, request({ season: 0, episode: 1 }));

    expect(info.season).toBeNull();
    expect(info.episode).toBeTruthy();
    expect(info.episode?.id).toBe(4215);
    expect(info.episode?.season).toBe(0);
    expect(info.episode?.episode).toBe(1);
  });

  it('throws error if episode entry is not found in media.episodes', () => {
    expect(() =>
      fitInfo(nekoId, s172, request({ season: 4, episode: 99 }))
    ).toThrow(/Episode entry with season 4 and episode 99 not found/);
  });

  it('handles the anime-provider season-with-episode-0 offset and skips season 0 entries', () => {
    // No real release has a season whose entry starts at dst 2 with ord 1, so
    // the shape is assumed (synthetic/nekobt-media/episode-zero).
    const media = loadSynthetic<{ data: NekoMediaData }>('nekobt-media', 'episode-zero').data;

    const info = fitInfo(
      { media_id: 's9001', anilist_id: 182205, isMovie: false },
      media,
      request({ isAnimeProvider: true, episode: 2 })
    );

    expect(info.season?.season).toBe(1);
    // isPrimary: episode 2 + (-dst_start + 1) = 2 + (-1) = 1
    expect(info.episode?.episode).toBe(1);
    expect(info.episode?.id).toBe(220900);
  });

  it('skips anilist entries whose season does not match a non-anime request', () => {
    // s172 has entries for seasons 0, 1, 2, 3 and 4 — season 3 is the only
    // one covering the requested episode range of season 2.
    const info = fitInfo(
      { media_id: 's172', anilist_id: 156822, isMovie: false },
      s172,
      request({ season: 3, episode: 5 })
    );

    expect(info.season?.season).toBe(3);
    expect(info.episode?.season).toBe(3);
  });

  it('uses the season src_start when a movie request resolves to series media', () => {
    const info = fitInfo(nekoId, s172, request({ isMovie: true }));

    expect(info.episode?.episode).toBe(1);
    expect(info.episode?.id).toBe(172749);
  });

  it('throws when movie-resolved media is requested as a series', () => {
    expect(() =>
      fitInfo(
        { media_id: 'm145', anilist_id: 20954, isMovie: true },
        m145,
        request({ season: 1, episode: 1 })
      )
    ).toThrow(/do not match/);
  });
});

describe('findMovieFile', () => {
  const dummyInfo: FitInfoResult = {
    media_id: 'm145',
    media: { anilist: { entries: [] }, episodes: [] },
    season: null,
    episode: null
  };

  it('selects the largest video file in a movie torrent', () => {
    // A real release that carries the movie among the episodes: the 2.4 GB
    // movie file is the largest one in the torrent.
    const torrent = loadFixtureData<{ files: Array<{ name: string; length: number }> }>(
      'nekobt-torrents', '7514276465159'
    );

    const match = findMovieFile(torrent, dummyInfo);

    expect(match).toBeTruthy();
    expect(match?.name).toContain('The Movie');
    expect(match?.length).toBe(2411031290);
  });

  it('returns null if files list is empty', () => {
    expect(findMovieFile({ files: [] }, dummyInfo)).toBeNull();
  });
});

describe('findEpisodeFile', () => {
  // The real Slime S4 release: 24 files named S04E01 … S04E24, so the file for
  // episode 23 sits at index 22.
  const sxxEyyTorrent = loadFixtureData<{ files: Array<{ name: string; length: number }> }>(
    'nekobt-torrents', '14474579778825'
  );

  const info: FitInfoResult = {
    media_id: 's172',
    media: { anilist: { entries: [] }, episodes: [] },
    season: {
      season: 4,
      src_start: 1,
      src_end: 24,
      dst_start: 1,
      dst_end: 24,
      anilist_id: 182205,
      media: season4.media
    },
    episode: {
      id: 220939,
      season: 4,
      episode: 23,
      absolute: 95
    }
  };

  it('matches files using SxxEyy pattern', () => {
    const match = findEpisodeFile(sxxEyyTorrent, info);

    expect(match).toBeTruthy();
    expect(match?.index).toBe(22);
    expect(match?.name).toContain('S04E23');
  });

  it('matches files with multi-episode range SxxEyy-Ezz pattern', () => {
    // No real release names a file as a range — assumed shape.
    const torrent = loadSynthetic<{ data: { files: Array<{ name: string; length: number }> } }>(
      'nekobt-torrents', 'episode-range'
    ).data;

    const match = findEpisodeFile(torrent, info);

    expect(match).toBeTruthy();
    expect(match?.index).toBe(0);
    expect(match?.name).toContain('S04E20-E24');
  });

  it('matches files with dot/underscore separated SxxEyy pattern', () => {
    // No real release separates the Sxx and Eyy tokens — assumed shape.
    const torrent = loadSynthetic<{ data: { files: Array<{ name: string; length: number }> } }>(
      'nekobt-torrents', 'underscore-separated'
    ).data;

    const match = findEpisodeFile(torrent, info);

    expect(match).toBeTruthy();
    expect(match?.index).toBe(0);
    expect(match?.name).toContain('S04_E23');
  });

  it('matches files with separated season and episode pattern', () => {
    // A real release naming the season in words: "4th Season - 24".
    const torrent = loadFixtureData<{ files: Array<{ name: string; length: number }> }>(
      'nekobt-torrents', '14414565343489'
    );

    const match = findEpisodeFile(
      torrent,
      { ...info, episode: { id: 1, season: 4, episode: 24, absolute: 96 } }
    );

    expect(match).toBeTruthy();
    expect(match?.index).toBe(0);
    expect(match?.name).toContain('4th Season - 24');
  });

  it('matches files using absolute episode pattern when SxxEyy is absent', () => {
    // A real release naming the file by its absolute number only.
    const torrent = loadFixtureData<{ files: Array<{ name: string; length: number }> }>(
      'nekobt-torrents', '14042604076552'
    );

    const match = findEpisodeFile(
      torrent,
      { ...info, episode: { id: 1, season: 1, episode: 1180, absolute: 1180 } }
    );

    expect(match).toBeTruthy();
    expect(match?.index).toBe(0);
    expect(match?.name).toContain('1180');
  });

  it('matches files with EP / E prefix and leading zeros in absolute episode', () => {
    // A real release using the EP prefix: "One Piece EP1180".
    const torrent = loadFixtureData<{ files: Array<{ name: string; length: number }> }>(
      'nekobt-torrents', '14060867155212'
    );

    const match = findEpisodeFile(
      torrent,
      { ...info, episode: { id: 1, season: 1, episode: 1180, absolute: 1180 } }
    );

    expect(match).toBeTruthy();
    expect(match?.index).toBe(0);
    expect(match?.name).toContain('EP1180');
  });

  it('matches files when info.season is null using info.episode.season', () => {
    const match = findEpisodeFile(
      sxxEyyTorrent,
      { ...info, season: null }
    );

    expect(match).toBeTruthy();
    expect(match?.index).toBe(22);
  });

  it('returns null if torrent files array is empty', () => {
    expect(findEpisodeFile({ files: [] }, info)).toBeNull();
  });

  it('returns null if no files match the episode', () => {
    const torrent = loadFixtureData<{ files: Array<{ name: string; length: number }> }>(
      'nekobt-torrents', '14474579778825'
    );

    const match = findEpisodeFile(
      torrent,
      { ...info, episode: { id: 1, season: 4, episode: 99, absolute: 99 } }
    );

    expect(match).toBeNull();
  });

  it('skips absolute matching when the absolute episode number is missing', () => {
    // The real release names its file by its absolute number ("One Piece -
    // 1180"). With the absolute number missing from the fit info, the
    // absolute strategy is off and the episode-only strategy looks for the
    // episode number instead — which the file does not carry.
    const torrent = loadFixtureData<{ files: Array<{ name: string; length: number }> }>(
      'nekobt-torrents', '14042604076552'
    );

    const withoutAbsolute: FitInfoResult = {
      ...info,
      episode: { id: 1, season: 1, episode: 23, absolute: 0 }
    };

    expect(findEpisodeFile(torrent, withoutAbsolute)).toBeNull();
  });

  it('matches files by named season including synonyms', () => {
    // No real release names a file after the series title alone — assumed shape.
    const torrent = loadSynthetic<{ data: { files: Array<{ name: string; length: number }> } }>(
      'nekobt-torrents', 'named-season'
    ).data;

    // The real title of s172's primary season, synonyms included.
    const namedInfo: FitInfoResult = {
      ...info,
      season: { ...info.season!, media: primarySeason.media }
    };

    const match = findEpisodeFile(torrent, namedInfo);

    expect(match?.index).toBe(0);
  });

  it('matches files by named season when there are no synonyms', () => {
    const torrent = loadSynthetic<{ data: { files: Array<{ name: string; length: number }> } }>(
      'nekobt-torrents', 'named-season'
    ).data;

    // A real media whose title carries no synonyms at all (s1545, an One Piece
    // film entry) — the matcher must still match on the title alone.
    const namedInfo: FitInfoResult = {
      ...info,
      season: { ...info.season!, media: withoutSynonyms.media },
      episode: { id: 1, season: 1, episode: 1, absolute: 1 }
    };

    const match = findEpisodeFile(torrent, namedInfo);

    expect(match?.index).toBe(1);
  });
});
