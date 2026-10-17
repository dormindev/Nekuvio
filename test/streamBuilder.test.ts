import { describe, expect, it, vi } from 'vitest';

import type { TorrentSwarm } from '../src/api/tracker-scrapper.js';
import {
  torrentToStream,
  torrentsToStreams
} from '../src/pipeline/streamBuilder.js';
import type {
  FitInfoResult,
  NekoTorrentItem,
  NuvioParsedRequest
} from '../src/types.js';

import { loadFixture } from './helpers/fixtures.js';


describe('torrentToStream', () => {
  const mockRequest: NuvioParsedRequest = {
    provider: 'imdb',
    externalId: 'tt123',
    season: 4,
    episode: 23,
    isAnimeProvider: false,
    isMovie: false
  };

  const mockInfo: FitInfoResult = {
    media_id: 's172',
    media: { anilist: { entries: [] }, episodes: [] },
    season: {
      season: 4,
      src_start: 1,
      src_end: 24,
      dst_start: 1,
      dst_end: 24,
      anilist_id: 182205,
      media: {
        title: {
          romaji: 'Tensei Shitara Slime Datta Ken 4th Season Part 1 & 2',
          english: 'That Time I Got Reincarnated as a Slime Season 4',
          native: '転生したらスライムだった件 第4期 第1&2クール',
          synonyms: [
            'Tensura 4',
            '転スラ 4',
            'เกิดใหม่ทั้งทีก็เป็นสไลม์ไปซะแล้ว ซีซั่น 4',
            'О моём перерождении в слизь 4',
            'Aquella vez que me convertí en slime - Temporada 4',
            'Moi, quand je me réincarne en Slime Saison 4',
          ]
        }
      }
    },
    episode: {
      id: 220939,
      season: 4,
      episode: 23,
      absolute: 95,
      runtime: 24
    }
  };

  const mockTorrentListItem: NekoTorrentItem = {
    id: 't12345',
    uploaded_at: 1790627841284,
    title: '[Delta] That Time I Got Reincarnated as a Slime S04E23 [1080p]',
    magnet: 'magnet:?xt=urn:btih:6a8456cf80660c40a8e87170c3454d79997e1c2c',
    infohash: '6a8456cf80660c40a8e87170c3454d79997e1c2c',
    seeders: 15,
    leechers: 2,
    filesize: 292935189,
    audio_lang: 'ja',
    fsub_lang: 'en',
    sub_lang: '',
    level: 1,
    otl: false,
    mtl: false,
    hardsub: false,
    video_type: 1,
    video_codec: 1,
    batch: false,
    files: [],
    groups: [
      {
        id: 101,
        name: 'Delta',
        display_name: 'Delta',
        display_tag: 'Delta'
      }
    ]
  };

  const mockSwarm: TorrentSwarm = {
    torrent: mockTorrentListItem,
    trackers: [
      { tracker: 'https://tracker.nekobt.to/announce', seeders: 15, leechers: 2 }
    ],
    seeders: 15,
    leechers: 2
  };

  it('builds a stream object when episode file is matched', () => {
    const torrentDetails: NekoTorrentItem = {
      ...mockTorrentListItem,
      files: [
        {
          name: '[Delta] That Time I Got Reincarnated as a Slime S04E23 [1080p].mkv',
          length: 292935189,
          offset: 0
        }
      ]
    };

    const stream = torrentToStream(mockSwarm, mockRequest, mockInfo, torrentDetails);

    expect(stream).toBeTruthy();
    expect(stream?.url).toBe(mockTorrentListItem.magnet);
    expect(stream?.infoHash).toBe('6a8456cf80660c40a8e87170c3454d79997e1c2c');
    expect(stream?.fileIdx).toBe(0);
    expect(stream?.name).toMatch(/^\[Delta\] \| NekoBT/);
    expect(stream?.description).toMatch(/🟢↑ 15 • 🔴↓ 2/);
    expect(stream?.description).toMatch(/🔊 {5}🇯🇵/);
    expect(stream?.description).toMatch(/💬✨ 🇬🇧/);
    expect(stream?.description).toMatch(/🎬 279 MB/);
    expect(stream?.description).toMatch(/1\.63 Mbps/);
    expect(stream?.description).toMatch(/\[Delta\] That Time I Got Reincarnated as a Slime S04E23 \[1080p\]\.mkv/);
    expect(stream?.sources).toEqual(['tracker:https://tracker.nekobt.to/announce']);
  });

  it('builds stream from real fixture torrent_s172.json', () => {
    const realTorrent = loadFixture<NekoTorrentItem>('torrent_s172.json');

    const realEpisodeInfo: FitInfoResult = {
      media_id: 's172',
      media: { anilist: { entries: [] }, episodes: [] },
      season: {
        season: 4,
        src_start: 1,
        src_end: 24,
        dst_start: 1,
        dst_end: 24,
        anilist_id: 182205,
        media: {
          title: {
            romaji: 'Tensei Shitara Slime Datta Ken 4th Season Part 1 & 2',
            english: 'That Time I Got Reincarnated as a Slime Season 4',
            native: '転生したらスライムだった件 第4期 第1&2クール',
            synonyms: []
          }
        }
      },
      episode: {
        id: 220940,
        season: 4,
        episode: 24,
        absolute: 96,
        runtime: 24
      }
    };

    const realRequest: NuvioParsedRequest = {
      provider: 'imdb',
      externalId: 'tt123',
      season: 4,
      episode: 24,
      isAnimeProvider: false,
      isMovie: false
    };

    const realSwarm: TorrentSwarm = {
      torrent: realTorrent,
      trackers: [],
      seeders: realTorrent.seeders,
      leechers: realTorrent.leechers
    };

    const stream = torrentToStream(realSwarm, realRequest, realEpisodeInfo, realTorrent);

    expect(stream).toBeTruthy();
    expect(stream?.infoHash).toBe(realTorrent.infohash);
    expect(stream?.fileIdx).toBe(0);
    expect(stream?.name).toMatch(/FrixySubs/);
  });

  it('builds a movie stream object using findMovieFile when request.isMovie is true', () => {
    const movieRequest: NuvioParsedRequest = {
      provider: 'imdb',
      externalId: 'tt5323662',
      season: null,
      episode: null,
      isAnimeProvider: false,
      isMovie: true
    };

    const movieInfo: FitInfoResult = {
      media_id: 'm145',
      media: { anilist: { entries: [] }, episodes: [] },
      season: null,
      episode: null
    };

    const movieTorrent: NekoTorrentItem = {
      ...mockTorrentListItem,
      id: 'm_torrent_1',
      title: 'Spirited Away 2001 1080p BluRay',
      files: [
        { name: 'Sample.mkv', length: 50_000_000 },
        { name: 'Spirited Away 2001 1080p.mkv', length: 8_500_000_000 }
      ]
    };

    const movieSwarm: TorrentSwarm = {
      torrent: movieTorrent,
      trackers: [],
      seeders: movieTorrent.seeders,
      leechers: movieTorrent.leechers
    };

    const stream = torrentToStream(movieSwarm, movieRequest, movieInfo, movieTorrent);

    expect(stream).toBeTruthy();
    expect(stream?.fileIdx).toBe(1);
    expect(stream?.description).toMatch(/Spirited Away 2001 1080p\.mkv/);
  });

  it('returns null if episode file is not found in torrent', () => {
    const torrentDetails: NekoTorrentItem = {
      ...mockTorrentListItem,
      id: 't12345',
      files: [
        { name: 'Slime S04E01.mkv', length: 100 }
      ]
    };

    const stream = torrentToStream(mockSwarm, mockRequest, mockInfo, torrentDetails);
    expect(stream).toBeNull();
  });

  it('torrentsToStreams maps multiple items and filters out null details or unmatched files', () => {
    const matchedTorrent: NekoTorrentItem = {
      ...mockTorrentListItem,
      files: [
        { name: '[Delta] That Time I Got Reincarnated as a Slime S04E23 [1080p].mkv', length: 100 }
      ]
    };

    const streams = torrentsToStreams(
      [
        { swarm: mockSwarm, details: matchedTorrent },
        { swarm: mockSwarm, details: { ...mockTorrentListItem, files: [] } }
      ],
      mockRequest,
      mockInfo
    );

    expect(streams).toHaveLength(1);
    expect(streams[0].fileIdx).toBe(0);
  });
});
