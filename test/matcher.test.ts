import { describe, it, expect } from 'vitest';

import { fitInfo, findEpisodeFile, findMovieFile } from '../src/pipeline/matcher.js';
import type { NekoMediaData, NekoMediaResolveData, NuvioParsedRequest, FitInfoResult } from '../src/types.js';

import { loadFixture } from './helpers/fixtures.js';


describe('fitInfo', () => {
  const mockNekoId: NekoMediaResolveData = {
    media_id: 's172',
    anilist_id: 182205,
    isMovie: false
  };

  const mockMedia: NekoMediaData = {
    anilist: {
      primary: {
        id: 182205
      },
      entries: [
        {
          season: 4,
          src_start: 1,
          src_end: 24,
          dst_start: 1,
          dst_end: 24,
          anilist_id: 182205
        }
      ]
    },
    episodes: [
      {
        id: 220939,
        season: 4,
        episode: 23,
        absolute: 95,
        title: "Granville's Hope"
      }
    ]
  };

  it('correctly maps request season and episode to anime episode', () => {
    const request: NuvioParsedRequest = {
      provider: 'imdb',
      externalId: 'tt123',
      isMovie: false,
      isAnimeProvider: false,
      season: 4,
      episode: 23
    };

    const info = fitInfo(mockNekoId, mockMedia, request);
    expect(info.media_id).toBe('s172');
    expect(info.season).toBeTruthy();
    expect(info.season?.season).toBe(4);
    expect(info.episode).toBeTruthy();
    expect(info.episode?.episode).toBe(23);
    expect(info.episode?.absolute).toBe(95);
    expect(info.episode?.id).toBe(220939);
  });

  it('supports offset dst_start and src_start calculations with isPrimary', () => {
    const customMedia: NekoMediaData = {
      anilist: {
        primary: {
          id: 9999
        },
        entries: [
          {
            season: 2,
            src_start: 1,
            src_end: 12,
            dst_start: 13,
            dst_end: 24,
            anilist_id: 9999
          }
        ]
      },
      episodes: [
        {
          id: 555,
          season: 2,
          episode: 2, // (14 - 13) + 1 = 2
          absolute: 14
        }
      ]
    };

    const request: NuvioParsedRequest = {
      provider: 'kitsu',
      externalId: '123',
      isMovie: false,
      isAnimeProvider: true,
      season: null,
      episode: 14
    };

    const info = fitInfo({ media_id: 's99', anilist_id: 9999, isMovie: false }, customMedia, request);
    expect(info.episode).toBeTruthy();
    expect(info.episode?.episode).toBe(2);
    expect(info.episode?.id).toBe(555);
  });

  it('handles movie request: returns null episode when nekoId.isMovie is true', () => {
    const movieMedia: NekoMediaData = {
      anilist: {
        primary: {
          id: 1111
        },
        entries: [
          {
            season: 1,
            src_start: 1,
            src_end: 1,
            dst_start: 1,
            dst_end: 1,
            anilist_id: 1111
          }
        ]
      },
      episodes: []
    };

    const request: NuvioParsedRequest = {
      provider: 'imdb',
      externalId: 'tt555',
      isMovie: true,
      isAnimeProvider: false,
      season: null,
      episode: null
    };

    const info = fitInfo({ media_id: 'm1', anilist_id: 1111, isMovie: true }, movieMedia, request);
    expect(info.media_id).toBe('m1');
    expect(info.episode).toBeNull();
  });

  it('handles media with null anilist (unmapped media like s11599 or m1305) without crashing', () => {
    const mediaWithoutAnilist: NekoMediaData = {
      id: 's11599',
      media_id: 's11599',
      anilist: null as any,
      episodes: [
        {
          id: 101,
          season: 1,
          episode: 1,
          absolute: 1
        }
      ]
    };

    const request: NuvioParsedRequest = {
      provider: 'tvdb',
      externalId: '460809',
      isMovie: false,
      isAnimeProvider: false,
      season: 1,
      episode: 1
    };

    const info = fitInfo({ media_id: 's11599', isMovie: false }, mediaWithoutAnilist, request);
    expect(info.media_id).toBe('s11599');
    expect(info.season).toBeNull();
    expect(info.episode).toBeTruthy();
    expect(info.episode?.id).toBe(101);
  });

  it('resolves real fixture s172 (Slime S4) accurately', () => {
    const realMedia = loadFixture<NekoMediaData>('media_s172.json');
    const request: NuvioParsedRequest = {
      provider: 'imdb',
      externalId: 'tt123',
      isMovie: false,
      isAnimeProvider: false,
      season: 4,
      episode: 23
    };

    const info = fitInfo({ media_id: 's172', anilist_id: 182205, isMovie: false }, realMedia, request);
    expect(info.season).toBeTruthy();
    expect(info.season?.season).toBe(4);
    expect(info.episode).toBeTruthy();
    expect(info.episode?.episode).toBe(23);
    expect(info.episode?.absolute).toBe(95);
  });

  it('falls back to request season and episode in media.episodes when season info is null', () => {
    const mediaWithSpecialEpisode: NekoMediaData = {
      anilist: {
        primary: { id: 182205 },
        entries: [
          {
            season: 4,
            src_start: 1,
            src_end: 24,
            dst_start: 1,
            dst_end: 24,
            anilist_id: 182205
          }
        ]
      },
      episodes: [
        {
          id: 9991,
          season: 0,
          episode: 1,
          absolute: 100
        }
      ]
    };

    const request: NuvioParsedRequest = {
      provider: 'imdb',
      externalId: 'tt1',
      isMovie: false,
      isAnimeProvider: false,
      season: 0,
      episode: 1
    };

    const info = fitInfo({ media_id: 's1', anilist_id: 999999, isMovie: false }, mediaWithSpecialEpisode, request);
    expect(info.season).toBeNull();
    expect(info.episode).toBeTruthy();
    expect(info.episode?.id).toBe(9991);
    expect(info.episode?.season).toBe(0);
    expect(info.episode?.episode).toBe(1);
  });

  it('throws error if episode entry is not found in media.episodes', () => {
    expect(() => {
      fitInfo(mockNekoId, mockMedia, {
        provider: 'imdb',
        externalId: 'tt1',
        isMovie: false,
        isAnimeProvider: false,
        season: 4,
        episode: 99
      });
    }).toThrow(/Episode entry with season 4 and episode 99 not found/);
  });

  it('handles the anime-provider season-with-episode-0 offset and skips season 0 entries', () => {
    const media: NekoMediaData = {
      anilist: {
        primary: { id: 500 },
        entries: [
          // Season 0 special: skipped by the anime-provider branch.
          { season: 0, src_start: 1, src_end: 1, dst_start: 1, dst_end: 1, ord: 0, anilist_id: 500 },
          // dst_start === 2 && ord === 1: probable season with an episode 0.
          { season: 1, src_start: 1, src_end: 12, dst_start: 2, dst_end: 13, ord: 1, anilist_id: 500 }
        ]
      },
      episodes: [
        // isPrimary: episode 2 + (-dst_start + 1) = 2 + (-1) = 1
        { id: 900, season: 1, episode: 1, absolute: 2 }
      ]
    };

    const request: NuvioParsedRequest = {
      provider: 'kitsu',
      externalId: '1',
      isMovie: false,
      isAnimeProvider: true,
      season: null,
      episode: 2
    };

    const info = fitInfo({ media_id: 's1', anilist_id: 500, isMovie: false }, media, request);
    expect(info.episode?.id).toBe(900);
  });

  it('applies the src_start offset when the matched season is not primary', () => {
    const media: NekoMediaData = {
      anilist: {
        primary: { id: 111 }, // differs from nekoId.anilist_id -> isPrimary false
        entries: [
          { season: 3, src_start: 10, src_end: 30, dst_start: 1, dst_end: 20, anilist_id: 999 }
        ]
      },
      episodes: [
        // not primary: episode 12 + (src_start - 1) = 12 + 9 = 21
        { id: 950, season: 3, episode: 21, absolute: 40 }
      ]
    };

    const request: NuvioParsedRequest = {
      provider: 'kitsu',
      externalId: '1',
      isMovie: false,
      isAnimeProvider: true,
      season: null,
      episode: 12
    };

    const info = fitInfo({ media_id: 's1', anilist_id: 999, isMovie: false }, media, request);
    expect(info.episode?.id).toBe(950);
  });

  it('skips anilist entries whose season does not match a non-anime request', () => {
    const media: NekoMediaData = {
      anilist: {
        primary: { id: 182205 },
        entries: [
          { season: 3, src_start: 1, src_end: 12, dst_start: 1, dst_end: 12, anilist_id: 182205 },
          { season: 4, src_start: 1, src_end: 24, dst_start: 1, dst_end: 24, anilist_id: 182205 }
        ]
      },
      episodes: [
        { id: 220939, season: 4, episode: 23, absolute: 95 }
      ]
    };

    const request: NuvioParsedRequest = {
      provider: 'imdb',
      externalId: 'tt1',
      isMovie: false,
      isAnimeProvider: false,
      season: 4,
      episode: 23
    };

    const info = fitInfo({ media_id: 's172', anilist_id: 182205, isMovie: false }, media, request);
    expect(info.episode?.id).toBe(220939);
  });

  it('uses the season src_start when a movie request resolves to series media', () => {
    const media: NekoMediaData = {
      anilist: {
        primary: { id: 700 },
        entries: [
          { season: 2, src_start: 5, src_end: 10, dst_start: 1, dst_end: 6, anilist_id: 700 }
        ]
      },
      episodes: [
        { id: 800, season: 2, episode: 5, absolute: 30 }
      ]
    };

    const request: NuvioParsedRequest = {
      provider: 'imdb',
      externalId: 'tt1',
      isMovie: true,
      isAnimeProvider: false,
      season: null,
      episode: null
    };

    const info = fitInfo({ media_id: 's1', anilist_id: 700, isMovie: false }, media, request);
    expect(info.episode?.id).toBe(800);
  });

  it('throws when movie-resolved media is requested as a series', () => {
    const media: NekoMediaData = {
      anilist: {
        primary: { id: 600 },
        entries: [
          { season: null as any, src_start: 1, src_end: 1, dst_start: 1, dst_end: 1, anilist_id: 600 }
        ]
      },
      episodes: []
    };

    const request: NuvioParsedRequest = {
      provider: 'imdb',
      externalId: 'tt1',
      isMovie: false,
      isAnimeProvider: false,
      season: 1,
      episode: 1
    };

    expect(() =>
      fitInfo({ media_id: 'm1', anilist_id: 600, isMovie: true }, media, request)
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
    const torrent = {
      files: [
        { name: 'Spirited.Away.Sample.mkv', length: 50_000_000 },
        { name: 'Spirited.Away.2001.1080p.BluRay.x265.mkv', length: 4_500_000_000 },
        { name: 'Featurette.mkv', length: 200_000_000 }
      ]
    };

    const match = findMovieFile(torrent, dummyInfo);
    expect(match).toBeTruthy();
    expect(match?.index).toBe(1);
    expect(match?.name).toBe('Spirited.Away.2001.1080p.BluRay.x265.mkv');
    expect(match?.length).toBe(4_500_000_000);
  });

  it('returns null if files list is empty', () => {
    expect(findMovieFile({ files: [] }, dummyInfo)).toBeNull();
  });
});

describe('findEpisodeFile', () => {
  const info: FitInfoResult = {
    media_id: 's172',
    media: { anilist: { entries: [] }, episodes: [] },
    season: {
      season: 4,
      src_start: 1,
      src_end: 24,
      dst_start: 1,
      dst_end: 24,
      anilist_id: 182205
    },
    episode: {
      id: 220939,
      season: 4,
      episode: 23,
      absolute: 95
    }
  };

  it('matches files using SxxEyy pattern', () => {
    const torrent = {
      files: [
        { name: 'Slime S04E22.mkv', length: 1000 },
        { name: '[Delta] That Time I Got Reincarnated as a Slime S04E23 [1080p].mkv', length: 292935189 },
        { name: 'Slime S04E24.mkv', length: 1000 }
      ]
    };

    const match = findEpisodeFile(torrent, info);
    expect(match).toBeTruthy();
    expect(match?.index).toBe(1);
    expect(match?.name).toBe('[Delta] That Time I Got Reincarnated as a Slime S04E23 [1080p].mkv');
  });

  it('matches files with multi-episode range SxxEyy-Ezz pattern', () => {
    const torrent = {
      files: [
        { name: 'Slime S04E01-E10.mkv', length: 2000 },
        { name: '[Group] That Time I Got Reincarnated as a Slime S04E20-E24 [1080p].mkv', length: 5000 },
        { name: 'Slime S04E25-E28.mkv', length: 2000 }
      ]
    };

    const match = findEpisodeFile(torrent, info);
    expect(match).toBeTruthy();
    expect(match?.index).toBe(1);
    expect(match?.name).toBe('[Group] That Time I Got Reincarnated as a Slime S04E20-E24 [1080p].mkv');
  });

  it('matches files with dot/underscore separated SxxEyy pattern', () => {
    const torrent = {
      files: [
        {
          name: 'That.Time.I.Got.Reincarnated.as.a.Slime.S04E23.Granvilles.Hope.1080p.mkv',
          length: 1500336817
        }
      ]
    };

    const match = findEpisodeFile(torrent, info);
    expect(match).toBeTruthy();
    expect(match?.index).toBe(0);
  });

  it('matches files with separated season and episode pattern', () => {
    const torrent = {
      files: [
        { name: 'That Time I Got Reincarnated as a Slime 4th Season - 23 [1080p].mkv', length: 1200 }
      ]
    };

    const match = findEpisodeFile(torrent, info);
    expect(match).toBeTruthy();
    expect(match?.index).toBe(0);
  });

  it('matches files using absolute episode pattern when SxxEyy is absent', () => {
    const torrent = {
      files: [
        { name: '[FrixySubs] Tensei Shitara Slime Datta Ken - 94 [1080p].mkv', length: 1000 },
        { name: '[FrixySubs] Tensei Shitara Slime Datta Ken - 95 [1080p].mkv', length: 1200 },
        { name: '[FrixySubs] Tensei Shitara Slime Datta Ken - 96 [1080p].mkv', length: 1000 }
      ]
    };

    const match = findEpisodeFile(torrent, info);
    expect(match).toBeTruthy();
    expect(match?.index).toBe(1);
    expect(match?.name).toBe('[FrixySubs] Tensei Shitara Slime Datta Ken - 95 [1080p].mkv');
  });

  it('matches files with EP / E prefix and leading zeros in absolute episode', () => {
    const torrent = {
      files: [
        { name: 'Show_EP095_[1080p].mkv', length: 500 }
      ]
    };

    const match = findEpisodeFile(torrent, info);
    expect(match).toBeTruthy();
    expect(match?.index).toBe(0);
  });

  it('matches files when info.season is null using info.episode.season', () => {
    const infoWithoutSeason: FitInfoResult = {
      ...info,
      season: null
    };

    const torrent = {
      files: [
        { name: 'Slime S04E23.mkv', length: 1000 }
      ]
    };

    const match = findEpisodeFile(torrent, infoWithoutSeason);
    expect(match).toBeTruthy();
    expect(match?.index).toBe(0);
  });

  it('returns null if torrent files array is empty', () => {
    expect(findEpisodeFile({ files: [] }, info)).toBeNull();
  });

  it('returns null if no files match the episode', () => {
    const torrent = {
      files: [
        { name: 'Slime S04E01.mkv', length: 1000 },
        { name: 'Slime S04E02.mkv', length: 1000 }
      ]
    };

    expect(findEpisodeFile(torrent, info)).toBeNull();
  });

  it('matches files by named season including synonyms', () => {
    const namedInfo: FitInfoResult = {
      ...info,
      season: {
        ...info.season!,
        media: {
          title: {
            romaji: 'Tensei Shitara Slime Datta Ken 4th Season',
            english: 'That Time I Got Reincarnated as a Slime Season 4',
            native: '転生したらスライムだった件',
            synonyms: ['Tensura 4']
          }
        }
      }
    };

    const torrent = {
      files: [
        { name: 'Tensura 4 - 23 [1080p].mkv', length: 1000 }
      ]
    };

    const match = findEpisodeFile(torrent, namedInfo);
    expect(match?.index).toBe(0);
  });

  it('matches files by named season when there are no synonyms', () => {
    const namedInfo: FitInfoResult = {
      ...info,
      season: {
        ...info.season!,
        media: {
          title: {
            romaji: 'Slime',
            english: 'Slime',
            native: 'スライム',
            synonyms: []
          }
        }
      }
    };

    const torrent = {
      files: [
        { name: 'Slime - 23 [1080p].mkv', length: 1000 }
      ]
    };

    const match = findEpisodeFile(torrent, namedInfo);
    expect(match?.index).toBe(0);
  });

  it('skips absolute matching when the absolute episode number is missing', () => {
    const zeroAbsoluteInfo: FitInfoResult = {
      ...info,
      episode: { ...info.episode!, absolute: 0 }
    };

    const torrent = {
      files: [
        { name: 'Random Show - 95.mkv', length: 1000 }
      ]
    };

    expect(findEpisodeFile(torrent, zeroAbsoluteInfo)).toBeNull();
  });
});
