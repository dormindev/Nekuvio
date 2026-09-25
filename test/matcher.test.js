import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fitInfo, findEpisodeFile } from '../src/pipeline/matcher.js';

describe('fitInfo', () => {
  const mockNekoId = {
    media_id: 's172',
    anilist_id: 182205
  };

  const mockMedia = {
    anilist: {
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
    const request = {
      isMovie: false,
      isAnimeProvider: false,
      season: 4,
      episode: 23
    };

    const info = fitInfo(mockNekoId, mockMedia, request);
    assert.equal(info.media_id, 's172');
    assert.equal(info.season.season, 4);
    assert.equal(info.episode.episode, 23);
    assert.equal(info.episode.absolute, 95);
    assert.equal(info.episode.id, 220939);
  });

  it('supports offset dst_start and src_start calculations', () => {
    const customMedia = {
      anilist: {
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

    const request = {
      isMovie: false,
      isAnimeProvider: true,
      season: null,
      episode: 14
    };

    const info = fitInfo({ media_id: 's99', anilist_id: 9999 }, customMedia, request);
    assert.equal(info.episode.episode, 2);
    assert.equal(info.episode.id, 555);
  });

  it('treats movie request as episode 1', () => {
    const movieMedia = {
      anilist: {
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
      episodes: [
        {
          id: 777,
          season: 1,
          episode: 1,
          absolute: 1
        }
      ]
    };

    const request = {
      isMovie: true,
      isAnimeProvider: false,
      season: null,
      episode: undefined
    };

    const info = fitInfo({ media_id: 'm1', anilist_id: 1111 }, movieMedia, request);
    assert.equal(info.episode.episode, 1);
    assert.equal(info.episode.id, 777);
  });

  it('throws error if season info is not found for nekoId.anilist_id', () => {
    assert.throws(() => {
      fitInfo({ media_id: 's1', anilist_id: 999999 }, mockMedia, { isMovie: false, isAnimeProvider: false });
    }, /Season info with ID 999999 not found/);
  });

  it('throws error if request season mismatches anilist entry season for non-anime provider series', () => {
    assert.throws(() => {
      fitInfo(mockNekoId, mockMedia, { isMovie: false, isAnimeProvider: false, season: 2, episode: 1 });
    }, /Request season 2 and anilist season 4 do not match/);
  });

  it('throws error if episode entry is not found in media.episodes', () => {
    assert.throws(() => {
      fitInfo(mockNekoId, mockMedia, { isMovie: false, isAnimeProvider: false, season: 4, episode: 99 });
    }, /Episode entry with season 4 and episode 99 not found/);
  });
});

describe('findEpisodeFile', () => {
  const info = {
    season: { season: 4 },
    episode: { season: 4, episode: 23, absolute: 95 }
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

  it('returns null if torrent files array is missing or empty', () => {
    assert.equal(findEpisodeFile(null, info), null);
    assert.equal(findEpisodeFile({}, info), null);
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
