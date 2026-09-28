import { getTorrent } from '../api/nekobt.js';
import { findEpisodeFile, findMovieFile } from './matcher.js';
import { formatBytes, formatLanguages } from '../utils/format.js';
import { FitInfoResult, NekoTorrentItem, StremioParsedRequest, StremioStream } from '../types.js';
import { logger } from '../utils/logger.js';

export async function torrentToStream(
  torrent: NekoTorrentItem,
  request: StremioParsedRequest,
  info: FitInfoResult,
  getTorrentFn: (torrentId: string) => Promise<NekoTorrentItem | null> = getTorrent
): Promise<StremioStream | null> {
  const torrentInfo = await getTorrentFn(torrent.id);

  if (!torrentInfo) return null;

  const matchedFile = request.isMovie
    ? findMovieFile(torrentInfo, info)
    : findEpisodeFile(torrentInfo, info);

  if (!matchedFile) {
    logger.warn(`Could not find episode file in torrent ${torrent.id}`);
    logger.warn("torrentInfo.files:", torrentInfo.files);
    return null;
  }

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
      `📄 File: ${formatBytes(matchedFile.length)} ` +
      `💾 Torrent: ${formatBytes(torrent.filesize)}\n`,

    infoHash: torrent.infohash,

    fileIdx: matchedFile.index,

    behaviorHints: {
      configurable: false,
      notResponseVideo: false
    }
  };
}
