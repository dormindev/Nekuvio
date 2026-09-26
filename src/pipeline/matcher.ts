import {
  EpisodeFileInfo,
  FitInfoResult,
  NekoAnilistEntry,
  NekoEpisodeEntry,
  NekoMediaData,
  NekoMediaResolveData,
  StremioParsedRequest,
  TorrentFile
} from '../types.js';

function fitSeasonInfo(
  nekoId: NekoMediaResolveData,
  media: NekoMediaData,
  request: StremioParsedRequest
): NekoAnilistEntry {
  const seasonInfo = media.anilist.entries.find(x => x.anilist_id == nekoId.anilist_id);
  if (!seasonInfo) {
    throw new Error(`Season info with ID ${nekoId.anilist_id} not found`);
  }

  if (!request.isMovie && !request.isAnimeProvider &&
    seasonInfo.season != request.season
  ) {
    throw new Error(`Request season ${request.season} and anilist season ${seasonInfo.season} do not match`);
  }

  return seasonInfo;
}

function fitEpisodeInfo(
  media: NekoMediaData,
  request: StremioParsedRequest,
  seasonInfo: NekoAnilistEntry
): NekoEpisodeEntry {
  // Convert the request's episode number to nekoBT's numbering using the offset mapping.
  const req_episode = (request.isMovie ? 1 : request.episode);
  const episode = (req_episode - seasonInfo.dst_start) + seasonInfo.src_start;

  const episodeEntry = media.episodes.find(x =>
    x.season == seasonInfo.season && x.episode == episode
  );
  if (!episodeEntry) {
    throw new Error(`Episode entry with season ${seasonInfo.season} and episode ${episode} not found`);
  }

  return episodeEntry;
}

export function fitInfo(
  nekoId: NekoMediaResolveData,
  media: NekoMediaData,
  request: StremioParsedRequest
): FitInfoResult {
  const seasonInfo = fitSeasonInfo(nekoId, media, request);
  const episodeInfo = fitEpisodeInfo(media, request, seasonInfo);

  return {
    media_id: nekoId.media_id,
    season: seasonInfo,
    episode: episodeInfo
  };
}

function matchEpisode(files: TorrentFile[], pattern: RegExp): (TorrentFile & { index: number }) | null {
  for (let index = 0; index < files.length; index++) {
    if (pattern.test(files[index].name)) {
      return { ...files[index], index };
    }
  }

  return null;
}

/** SxxEyy pattern (e.g. S01E02) */
function matchSeasonEpisode(
  files: TorrentFile[],
  season: number,
  episode: number
): (TorrentFile & { index: number }) | null {
  const pattern = new RegExp(
    `(^|[\\s_.-])S0*${season}E0*${episode}[\\s_.-]`,
    'i'
  );

  return matchEpisode(files, pattern);
}

/** Absolute episode number pattern (e.g. - 05, E05, EP05) */
function matchAbsoluteEpisode(
  files: TorrentFile[],
  absoluteEpisode: number
): (TorrentFile & { index: number }) | null {
  const pattern = new RegExp(
    `(^|[\\s_.-])(S01)?(EP|E)?0*${absoluteEpisode}[\\s_.-]`,
    'i'
  );

  return matchEpisode(files, pattern);
}

/**
 * Identify the requested episode file inside a torrent's file list.
 * Tries SxxEyy first, then falls back to absolute episode number.
 */
export function findEpisodeFile(
  torrent: { files?: TorrentFile[] } | null,
  info: EpisodeFileInfo
): (TorrentFile & { index: number }) | null {
  if (!torrent?.files || torrent.files.length === 0) {
    return null;
  }

  return matchSeasonEpisode(torrent.files, info.season.season, info.episode.episode)
    ?? matchAbsoluteEpisode(torrent.files, info.episode.absolute)
    ?? null;
}

