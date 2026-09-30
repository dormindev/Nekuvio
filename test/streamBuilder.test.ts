import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { torrentToStream } from '../src/pipeline/streamBuilder.js';
import { FitInfoResult, NekoTorrentItem, StremioParsedRequest } from '../src/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadFixture<T>(filename: string): T {
  const filepath = path.join(__dirname, 'fixtures', filename);
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

describe('torrentToStream', () => {
  const mockRequest: StremioParsedRequest = {
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
      anilist_id: 182205
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

  it('builds a stream object when episode file is matched', async () => {
    const mockGetTorrent = async (torrentId: string): Promise<NekoTorrentItem | null> => {
      assert.equal(torrentId, 't12345');
      return {
        ...mockTorrentListItem,
        files: [
          {
            name: '[Delta] That Time I Got Reincarnated as a Slime S04E23 [1080p].mkv',
            length: 292935189,
            offset: 0
          }
        ]
      };
    };

    const stream = await torrentToStream(mockTorrentListItem, mockRequest, mockInfo, mockGetTorrent);

    assert.ok(stream);
    assert.equal(stream.url, mockTorrentListItem.magnet);
    assert.equal(stream.infoHash, '6a8456cf80660c40a8e87170c3454d79997e1c2c');
    assert.equal(stream.fileIdx, 0);
    assert.match(stream.name, /^NekoBT \| \[Delta\]/);
    assert.match(stream.description, /🟢↑ 15    🔴↓ 2/);
    assert.match(stream.description, /🔊 {5}🇯🇵/);
    assert.match(stream.description, /💬✨ 🇬🇧/);
    assert.match(stream.description, /🎬 279 MB/);
    assert.match(stream.description, /1\.63 Mbps/);
    assert.match(stream.description, /\[Delta\] That Time I Got Reincarnated as a Slime S04E23 \[1080p\]\.mkv/);
  });

  it('builds stream from real fixture torrent_s172.json', async () => {
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
        anilist_id: 182205
      },
      episode: {
        id: 220940,
        season: 4,
        episode: 24,
        absolute: 96,
        runtime: 24
      }
    };

    const realRequest: StremioParsedRequest = {
      provider: 'imdb',
      externalId: 'tt123',
      season: 4,
      episode: 24,
      isAnimeProvider: false,
      isMovie: false
    };

    const mockGetTorrent = async (): Promise<NekoTorrentItem | null> => realTorrent;

    const stream = await torrentToStream(realTorrent, realRequest, realEpisodeInfo, mockGetTorrent);

    assert.ok(stream);
    assert.equal(stream.infoHash, realTorrent.infohash);
    assert.equal(stream.fileIdx, 0);
    assert.match(stream.name, /FrixySubs/);
  });

  it('builds a movie stream object using findMovieFile when request.isMovie is true', async () => {
    const movieRequest: StremioParsedRequest = {
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

    const mockGetTorrent = async (): Promise<NekoTorrentItem | null> => movieTorrent;

    const stream = await torrentToStream(movieTorrent, movieRequest, movieInfo, mockGetTorrent);

    assert.ok(stream);
    assert.equal(stream.fileIdx, 1);
    assert.match(stream.description, /Spirited Away 2001 1080p\.mkv/);
  });

  it('returns null if torrent info cannot be retrieved', async () => {
    const mockGetTorrent = async () => null;

    const stream = await torrentToStream(mockTorrentListItem, mockRequest, mockInfo, mockGetTorrent);
    assert.equal(stream, null);
  });

  it('returns null if episode file is not found in torrent', async () => {
    const mockGetTorrent = async (torrentId: string): Promise<NekoTorrentItem | null> => ({
      ...mockTorrentListItem,
      id: torrentId,
      files: [
        { name: 'Slime S04E01.mkv', length: 100 }
      ]
    });

    const stream = await torrentToStream(mockTorrentListItem, mockRequest, mockInfo, mockGetTorrent);
    assert.equal(stream, null);
  });
});
