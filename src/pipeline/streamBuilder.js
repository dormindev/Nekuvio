import { getTorrent } from '../api/nekobt.js';
import { findEpisodeFile } from './matcher.js';
import { formatBytes, formatLanguages } from '../utils/format.js';

/**
 * Construct a Stremio stream object from a nekoBT torrent item.
 */
export async function torrentToStream(torrent, season = null, episode = null) {
  const torrentInfo = await getTorrent(torrent.id);

  if (!torrentInfo) {
    return null;
  }

  let fileIdx = null;
  let fileSize = Number(torrentInfo.filesize) || 0;

  console.log('Torrent:', torrent.id);
  console.log('Torrent batch:', torrentInfo.batch);
  console.log('Torrent files:', torrentInfo.files);

  const matchedFile = findEpisodeFile(
    torrentInfo,
    season,
    episode
  );

  if (!matchedFile) {
    console.warn(
      `Could not find S${season}E${episode} in batch torrent ${torrent.id}`
    );

    return null;
  }

  fileIdx = matchedFile.index;
  fileSize = matchedFile.size;

  const languageText = formatLanguages(torrent);

  const seeders = torrent.seeders ?? 0;
  const leechers = torrent.leechers ?? 0;

  return {
    name: `nekoBT\n[${languageText}]`,

    title:
      `${torrent.title || 'nekoBT torrent'}\n` +
      `👥 S: ${seeders} | L: ${leechers} | ` +
      `💾 Torrent: ${formatBytes(torrent.filesize)}\n` +
      `📄 File: ${formatBytes(fileSize)}`,

    infoHash: torrent.infohash,

    ...(fileIdx !== null ? { fileIdx } : {}),

    behaviorHints: {
      configurable: false,
      notResponseVideo: false
    }
  };
}
