import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { torrentToStream } from '../src/pipeline/streamBuilder.js';

describe('torrentToStream', () => {
  const mockInfo = {
    season: { season: 4 },
    episode: { season: 4, episode: 23, absolute: 95 }
  };

  const mockTorrentListItem = {
    id: 't12345',
    title: '[Delta] That Time I Got Reincarnated as a Slime S04E23 [1080p]',
    magnet: 'magnet:?xt=urn:btih:6a8456cf80660c40a8e87170c3454d79997e1c2c',
    infohash: '6a8456cf80660c40a8e87170c3454d79997e1c2c',
    seeders: 15,
    leechers: 2,
    filesize: 292935189,
    audio_lang: 'ja',
    sub_lang: 'en'
  };

  it('builds a stream object when episode file is matched', async () => {
    const mockGetTorrent = async (torrentId) => {
      assert.equal(torrentId, 't12345');
      return {
        id: torrentId,
        filesize: 292935189,
        files: [
          {
            name: '[Delta] That Time I Got Reincarnated as a Slime S04E23 [1080p].mkv',
            length: 292935189,
            offset: 0
          }
        ]
      };
    };

    const stream = await torrentToStream(mockTorrentListItem, mockInfo, mockGetTorrent);

    assert.ok(stream);
    assert.equal(stream.url, mockTorrentListItem.magnet);
    assert.equal(stream.infoHash, '6a8456cf80660c40a8e87170c3454d79997e1c2c');
    assert.equal(stream.fileIdx, 0);
  });

  it('returns null if torrent info cannot be retrieved', async () => {
    const mockGetTorrent = async () => null;

    const stream = await torrentToStream(mockTorrentListItem, mockInfo, mockGetTorrent);
    assert.equal(stream, null);
  });

  it('returns null if episode file is not found in torrent', async () => {
    const mockGetTorrent = async () => ({
      id: 't12345',
      files: [
        { name: 'Slime S04E01.mkv', length: 100 }
      ]
    });

    const stream = await torrentToStream(mockTorrentListItem, mockInfo, mockGetTorrent);
    assert.equal(stream, null);
  });
});
