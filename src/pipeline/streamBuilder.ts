import { findEpisodeFile, findMovieFile } from './matcher.js';
import { formatAverageBitrate, formatBytes, formatLanguageFlags, formatLanguages, formatTimestamp } from '../utils/format.js';
import { FitInfoResult, IndexedTorrentFile, NekoTorrentItem, NuvioParsedRequest, NuvioStream } from '../types.js';
import { logger } from '../utils/logger.js';
import { encodeNekobtMetadata, NekobtMetadata } from '../generated/nekobt-metadata.js';
import { TorrentSwarm } from '../api/tracker-scrapper.js';
import { env } from '../environment.js';


export interface TorrentDetailsAndSwarm {
  swarm: TorrentSwarm;
  details: NekoTorrentItem;
}


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


export function torrentToStream(
  swarm: TorrentSwarm,
  request: NuvioParsedRequest,
  info: FitInfoResult,
  torrentInfo: NekoTorrentItem
): NuvioStream | null {
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

    sources: swarm.trackers.map(tracker => `tracker:${tracker.tracker}`),

    behaviorHints: {
      bingeGroup: buildBingeGroup(matchedFile, torrentInfo, request, info)
    }
  };
}

export function torrentsToStreams(
  torrentsInfo: TorrentDetailsAndSwarm[],
  request: NuvioParsedRequest,
  info: FitInfoResult
): NuvioStream[] {
  return torrentsInfo
    .map(({ swarm, details }) => torrentToStream(swarm, request, info, details))
    .filter((s): s is NuvioStream => s !== null);
}


function buildName(
  file: IndexedTorrentFile,
  torrent: NekoTorrentItem,
  swarm: TorrentSwarm,
  request: NuvioParsedRequest,
  info: FitInfoResult,
): string {
  return (
    optional(torrent.groups[0]?.display_name, '[{}]') +
    ` | NekoBT` +

    encodeNekobtMetadata({
      subLevel: torrent.level,
      mtl: torrent.mtl,
      otl: torrent.otl,
      hardsubs: torrent.hardsub,
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
    `🟢↑ ${seeders} • 🔴↓ ${leechers}` +
    `  | 📤 ${formatTimestamp(torrent.uploaded_at)}` +
    '\n' +
    optional(formatLanguageFlags(torrent.fsub_lang), '\n💬✨ {}') +
    optional(formatLanguageFlags(torrent.sub_lang), '\n💬     {}') +
    optional(formatLanguageFlags(torrent.audio_lang), '\n🔊     {}') +
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

  return `${env.app.displayName}-${torrent.infohash}`;
}

