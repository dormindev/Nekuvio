import { getTorrent } from '../api/nekobt.js';
import { findEpisodeFile, findMovieFile } from './matcher.js';
import { formatAverageBitrate, formatBytes, formatLanguageFlags, formatLanguages } from '../utils/format.js';
import { FitInfoResult, IndexedTorrentFile, NekoTorrentItem, NuvioParsedRequest, NuvioStream } from '../types.js';
import { logger } from '../utils/logger.js';
import { encodeNekobtMetadata, NekobtMetadata } from '../generated/nekobt-metadata.js';
import { TorrentSwarm } from '../api/tracker-scrapper.js';




function optional(
  value: unknown,
  template: string,
  defaultValue?: unknown,
): string {
  const resolvedValue =
    value === undefined || value === null || value === ''
      ? defaultValue
      : value;

  if (resolvedValue === undefined || resolvedValue === null || resolvedValue === '') {
    return '';
  }

  return template.replace('{}', String(resolvedValue));
}

export async function torrentToStream(
  swarm: TorrentSwarm,
  request: NuvioParsedRequest,
  info: FitInfoResult,
  getTorrentFn: (torrentId: string) => Promise<NekoTorrentItem | null> = getTorrent
): Promise<NuvioStream | null> {
  const torrentInfo = await getTorrentFn(swarm.torrent.id);
  if (!torrentInfo) return null;

  const matchedFile = request.isMovie
    ? findMovieFile(torrentInfo, info)
    : findEpisodeFile(torrentInfo, info);

  if (!matchedFile) {
    logger.warn(`Could not find episode file in torrent ${torrentInfo.id}`);
    logger.warn("torrentInfo.files:", torrentInfo.files);
    return null;
  }

  const languageText = formatLanguages(torrentInfo);

  logger.debug(`${swarm.torrent.id} magnet:`, torrentInfo.magnet);

  return {
    url: torrentInfo.magnet,
    infoHash: torrentInfo.infohash,
    fileIdx: matchedFile.index,

    name: buildName(matchedFile, torrentInfo, swarm, request, info),
    description: buildDescription(matchedFile, torrentInfo, swarm, request, info),

    sources: swarm.trackers.map(tracker => `tracker:${tracker}`),

    behaviorHints: {
      bingeGroup: buildBingeGroup(matchedFile, torrentInfo, request, info)
    }
  };
}


function buildName(
  file: IndexedTorrentFile,
  torrent: NekoTorrentItem,
  swarm: TorrentSwarm,
  request: NuvioParsedRequest,
  info: FitInfoResult,
): string {
  return (
    `NekoBT | ` +
    optional(torrent.groups[0]?.display_name, '[{}]') +
    encodeNekobtMetadata({
      subLevel: torrent.level,
      mtl: torrent.mtl,
      otl: torrent.otl,
      hardsubs: torrent.hardsubs,
      videoType: torrent.video_type,
      videoCodec: torrent.video_codec,
      batch: torrent.batch
    } as NekobtMetadata)
  );
}

function buildDescription(
  file: IndexedTorrentFile,
  torrent: NekoTorrentItem,
  swarm: TorrentSwarm,
  request: NuvioParsedRequest,
  info: FitInfoResult
): string {
  const duration = info.episode?.runtime ?? info.season?.duration ?? info.media?.runtime ?? null;
  const seeders = Math.max(0, torrent.seeders, swarm.seeders);
  const leechers = Math.max(0, torrent.leechers, swarm.leechers);

  return (
    `🟢↑ ${seeders}    🔴↓ ${leechers}` +
    `\n` +
    optional(formatLanguageFlags(torrent.audio_lang), '\n🔊     {}') +
    optional(formatLanguageFlags(torrent.fsub_lang), '\n💬✨ {}') +
    optional(formatLanguageFlags(torrent.sub_lang), '\n💬     {}') +
    '\n' +
    `\n🎬 ${optional(formatBytes(file.length), '{}', '?? MB')}` +
    optional(formatAverageBitrate(file.length, duration), '  ·  {}') +
    `\n${file.name}` +
    `\n` +
    `\n📦 ${optional(formatBytes(torrent.filesize), '{}', '?? GB')}` +
    `\n${torrent.title}`
  );
}


function buildBingeGroup(
  file: IndexedTorrentFile,
  torrent: NekoTorrentItem,
  request: NuvioParsedRequest,
  info: FitInfoResult
): string {

  return `Nekuvio-${torrent.infohash}`;
}

