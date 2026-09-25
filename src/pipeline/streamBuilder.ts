import { getTorrent } from '../api/nekobt.js';
import { findEpisodeFile } from './matcher.js';
import { formatBytes, formatLanguages } from '../utils/format.js';
import { FitInfoResult, NekoTorrentItem, StremioStream } from '../types.js';

/**
 * Construct a Stremio stream object from a nekoBT torrent item.
 */
export async function torrentToStream(
  torrent: NekoTorrentItem,
  info: FitInfoResult | { season: { season: number }; episode: { season?: number; episode?: number; absolute?: number } },
  getTorrentFn: (torrentId: string) => Promise<NekoTorrentItem | null> = getTorrent
): Promise<StremioStream | null> {
  const torrentInfo = await getTorrentFn(torrent.id);

  if (!torrentInfo) return null;

  let fileIdx: number | null = null;
  let fileSize = Number(torrentInfo.filesize) || 0;

  console.log('Torrent:', torrent.id);
  //console.log('Torrent files:', torrentInfo.files);

  const matchedFile = findEpisodeFile(torrentInfo, info);

  if (!matchedFile) {
    console.warn(
      `Could not find episode file in torrent ${torrent.id}`
    );

    return null;
  }

  fileIdx = matchedFile.index;
  fileSize = matchedFile.length;

  const languageText = formatLanguages(torrent);

  const seeders = torrent.seeders ?? 0;
  const leechers = torrent.leechers ?? 0;

  return {
    url: torrent.magnet,
    name: `nekoBT\n[${languageText}]`,

    title:
      `${torrent.title || 'nekoBT torrent'}\n`,

    description:
      `${matchedFile.name}\n` +
      `👥 S: ${seeders} | L: ${leechers} | ` +
      `📄 File: ${formatBytes(fileSize)}` +
      `💾 Torrent: ${formatBytes(torrent.filesize)}\n`,

    infoHash: torrent.infohash,

    ...(fileIdx !== null ? { fileIdx } : {}),

    behaviorHints: {
      configurable: false,
      notResponseVideo: false
    }
  };
}
