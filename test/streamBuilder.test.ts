import { describe, expect, it, vi } from 'vitest';

import type { TorrentSwarm } from '../src/api/tracker-scrapper.js';
import {
  torrentToStream,
  torrentsToStreams
} from '../src/pipeline/streamBuilder.js';
import type {
  FitInfoResult,
  NekoMediaData,
  NekoTorrentItem,
  NuvioParsedRequest
} from '../src/types.js';

import { loadFixtureData } from './helpers/test-data.js';


describe('torrentToStream', () => {
  // The request and the fit info are internal structures the matcher
  // produces, so they stay inline — but the media title they carry comes from
  // the real s172 fixture, and the torrents are real releases.
  const s172 = loadFixtureData<NekoMediaData>('nekobt-media', 's172');
  const season4 = s172.anilist.entries.find(e => e.season === 4)!;

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
      media: { title: season4.media.title }
    },
    episode: {
      id: 220939,
      season: 4,
      episode: 23,
      absolute: 95,
      runtime: 24
    }
  };

  // A real 24-file release: the file for episode 23 sits at index 22.
  const mockTorrentListItem = loadFixtureData<NekoTorrentItem>(
    'nekobt-torrents', '14474579778825'
  );

  const mockSwarm: TorrentSwarm = {
    torrent: mockTorrentListItem,
    trackers: [
      { tracker: 'https://tracker.nekobt.to/announce', seeders: 31, leechers: 3 }
    ],
    seeders: 31,
    leechers: 3
  };

  it('builds a stream object when episode file is matched', () => {
    const stream = torrentToStream(
      mockSwarm, mockRequest, mockInfo, mockTorrentListItem
    );

    expect(stream).toBeTruthy();
    expect(stream?.url).toBe(mockTorrentListItem.magnet);
    expect(stream?.infoHash).toBe('5488fb62de8d5a7ba15213ea325de485174b9c51');
    expect(stream?.fileIdx).toBe(22);
    expect(stream?.name).toMatch(/^\[Ironclad\] \| NekoBT/);
    expect(stream?.description).toMatch(/🟢↑ 31 • 🔴↓ 3/);
    // The real release is multi-audio: the audio line lists every language.
    expect(stream?.description).toMatch(/🔊 {5}🇬🇧/);
    expect(stream?.description).toMatch(/🇯🇵/);
    expect(stream?.description).toMatch(/💬✨ 🇬🇧/);
    expect(stream?.description).toMatch(/🎬 618 MB/);
    expect(stream?.description).toMatch(/3\.60 Mbps/);
    expect(stream?.description).toMatch(
      /\[Ironclad\] Tensei Shitara Slime Datta Ken - S04E23 \[WEB\.1080p\.AV1\]\.mkv/
    );
    expect(stream?.sources).toEqual(['tracker:https://tracker.nekobt.to/announce']);
  });

  it('builds stream from real fixture nekobt-torrents/14064189768715', () => {
    const realTorrent = loadFixtureData<NekoTorrentItem>('nekobt-torrents', '14064189768715');

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

    // A real release that carries the movie among the episodes — the movie
    // file is the largest one in the torrent.
    const movieTorrent = loadFixtureData<NekoTorrentItem>('nekobt-torrents', '7514276465159');

    const movieSwarm: TorrentSwarm = {
      torrent: movieTorrent,
      trackers: [],
      seeders: movieTorrent.seeders,
      leechers: movieTorrent.leechers
    };

    const stream = torrentToStream(movieSwarm, movieRequest, movieInfo, movieTorrent);

    expect(stream).toBeTruthy();
    expect(stream?.fileIdx).toBe(14);
    expect(stream?.description).toMatch(
      /Saga Of Tanya The Evil - S00E15 - Saga Of Tanya The Evil The Movie\.mkv/
    );
    expect(stream?.description).toMatch(/🎬 2\.2 GB/);
  });

  it('returns null if episode file is not found in torrent', () => {
    const stream = torrentToStream(
      mockSwarm,
      mockRequest,
      { ...mockInfo, episode: { ...mockInfo.episode!, episode: 99, absolute: 99 } },
      mockTorrentListItem
    );

    expect(stream).toBeNull();
  });

  it('torrentsToStreams maps multiple items and filters out null details or unmatched files', () => {
    const streams = torrentsToStreams(
      [
        { swarm: mockSwarm, details: mockTorrentListItem },
        { swarm: mockSwarm, details: { ...mockTorrentListItem, files: [] } }
      ],
      mockRequest,
      mockInfo
    );

    expect(streams).toHaveLength(1);
    expect(streams[0].fileIdx).toBe(22);
  });
});
