import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fitInfo, findEpisodeFile, findMovieFile } from '../src/pipeline/matcher.js';
import { NekoMediaData, NekoMediaResolveData, StremioParsedRequest, FitInfoResult } from '../src/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadFixture<T>(filename: string): T {
  const filepath = path.join(__dirname, 'fixtures', filename);
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

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
    const request: StremioParsedRequest = {
      provider: 'imdb',
      externalId: 'tt123',
      isMovie: false,
      isAnimeProvider: false,
      season: 4,
      episode: 23
    };

    const info = fitInfo(mockNekoId, mockMedia, request);
    assert.equal(info.media_id, 's172');
    assert.ok(info.season);
    assert.equal(info.season.season, 4);
    assert.ok(info.episode);
    assert.equal(info.episode.episode, 23);
    assert.equal(info.episode.absolute, 95);
    assert.equal(info.episode.id, 220939);
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

    const request: StremioParsedRequest = {
      provider: 'kitsu',
      externalId: '123',
      isMovie: false,
      isAnimeProvider: true,
      season: null,
      episode: 14
    };

    const info = fitInfo({ media_id: 's99', anilist_id: 9999, isMovie: false }, customMedia, request);
    assert.ok(info.episode);
    assert.equal(info.episode.episode, 2);
    assert.equal(info.episode.id, 555);
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

    const request: StremioParsedRequest = {
      provider: 'imdb',
      externalId: 'tt555',
      isMovie: true,
      isAnimeProvider: false,
      season: null,
      episode: null
    };

    const info = fitInfo({ media_id: 'm1', anilist_id: 1111, isMovie: true }, movieMedia, request);
    assert.equal(info.media_id, 'm1');
    assert.equal(info.episode, null);
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

    const request: StremioParsedRequest = {
      provider: 'tvdb',
      externalId: '460809',
      isMovie: false,
      isAnimeProvider: false,
      season: 1,
      episode: 1
    };

    const info = fitInfo({ media_id: 's11599', isMovie: false }, mediaWithoutAnilist, request);
    assert.equal(info.media_id, 's11599');
    assert.equal(info.season, null);
    assert.ok(info.episode);
    assert.equal(info.episode.id, 101);
  });

  it('resolves real fixture s172 (Slime S4) accurately', () => {
    const realMedia = loadFixture<NekoMediaData>('media_s172.json');
    const request: StremioParsedRequest = {
      provider: 'imdb',
      externalId: 'tt123',
      isMovie: false,
      isAnimeProvider: false,
      season: 4,
      episode: 23
    };

    const info = fitInfo({ media_id: 's172', anilist_id: 182205, isMovie: false }, realMedia, request);
    assert.ok(info.season);
    assert.equal(info.season.season, 4);
    assert.ok(info.episode);
    assert.equal(info.episode.episode, 23);
    assert.equal(info.episode.absolute, 95);
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

    const request: StremioParsedRequest = {
      provider: 'imdb',
      externalId: 'tt1',
      isMovie: false,
      isAnimeProvider: false,
      season: 0,
      episode: 1
    };

    const info = fitInfo({ media_id: 's1', anilist_id: 999999, isMovie: false }, mediaWithSpecialEpisode, request);
    assert.equal(info.season, null);
    assert.ok(info.episode);
    assert.equal(info.episode.id, 9991);
    assert.equal(info.episode.season, 0);
    assert.equal(info.episode.episode, 1);
  });

  it('throws error if episode entry is not found in media.episodes', () => {
    assert.throws(() => {
      fitInfo(mockNekoId, mockMedia, {
        provider: 'imdb',
        externalId: 'tt1',
        isMovie: false,
        isAnimeProvider: false,
        season: 4,
        episode: 99
      });
    }, /Episode entry with season 4 and episode 99 not found/);
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
    assert.ok(match);
    assert.equal(match.index, 1);
    assert.equal(match.name, 'Spirited.Away.2001.1080p.BluRay.x265.mkv');
    assert.equal(match.length, 4_500_000_000);
  });

  it('returns null if files list is empty', () => {
    assert.equal(findMovieFile({ files: [] }, dummyInfo), null);
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
    assert.ok(match);
    assert.equal(match.index, 1);
    assert.equal(match.name, '[Delta] That Time I Got Reincarnated as a Slime S04E23 [1080p].mkv');
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
    assert.ok(match);
    assert.equal(match.index, 1);
    assert.equal(match.name, '[Group] That Time I Got Reincarnated as a Slime S04E20-E24 [1080p].mkv');
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
    assert.ok(match);
    assert.equal(match.index, 0);
  });

  it('matches files with separated season and episode pattern', () => {
    const torrent = {
      files: [
        { name: 'That Time I Got Reincarnated as a Slime 4th Season - 23 [1080p].mkv', length: 1200 }
      ]
    };

    const match = findEpisodeFile(torrent, info);
    assert.ok(match);
    assert.equal(match.index, 0);
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
    assert.ok(match);
    assert.equal(match.index, 1);
    assert.equal(match.name, '[FrixySubs] Tensei Shitara Slime Datta Ken - 95 [1080p].mkv');
  });

  it('matches files with EP / E prefix and leading zeros in absolute episode', () => {
    const torrent = {
      files: [
        { name: 'Show_EP095_[1080p].mkv', length: 500 }
      ]
    };

    const match = findEpisodeFile(torrent, info);
    assert.ok(match);
    assert.equal(match.index, 0);
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
    assert.ok(match);
    assert.equal(match.index, 0);
  });

  it('returns null if torrent files array is empty', () => {
    assert.equal(findEpisodeFile({ files: [] }, info), null);
  });

  it('returns null if no files match the episode', () => {
    const torrent = {
      files: [
        { name: 'Slime S04E01.mkv', length: 1000 },
        { name: 'Slime S04E02.mkv', length: 1000 }
      ]
    };

    assert.equal(findEpisodeFile(torrent, info), null);
  });
});
