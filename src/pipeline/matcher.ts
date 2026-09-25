import {
  FitInfoResult,
  NekoAnilistEntry,
  NekoEpisodeEntry,
  NekoMediaData,
  NekoMediaResolveData,
  NekoTorrentItem,
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
  // convert episode number from request to nekoBT
  const req_episode = (request.isMovie ? 1 : request.episode);
  const episode = (req_episode - seasonInfo.dst_start) + seasonInfo.src_start;

  //console.log('media:', media);
  //console.log('media.episodes:', media?.episodes);

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

/**
 * Identify the requested episode file inside a torrent file list.
 */
function matchEpisode(files: TorrentFile[], pattern: RegExp): (TorrentFile & { index: number }) | null {
  for (let index = 0; index < files.length; index++) {
    if (!files[index]?.name) continue;
    const name = files[index].name;
    const match = pattern.test(name);
    if (match) return { ...files[index], index };
  }

  return null;
}

/**
 * Match heuristic 1: SxxEyy pattern (e.g. S01E02)
 */
function matchSeasonEpisode(
  files: TorrentFile[],
  season: number | null | undefined,
  episode: number | null | undefined
): (TorrentFile & { index: number }) | null {
  if (season === null || season === undefined || episode === null || episode === undefined) {
    return null;
  }

  const pattern = new RegExp(
    `(^|[\\s_.-])S0*${season}E0*${episode}[\\s_.-]`,
    'i'
  );
  console.log('Regex (SxxEyy):', pattern);

  return matchEpisode(files, pattern);
}

/**
 * Match heuristic 2: Absolute episode number pattern (e.g. - 05, E05, EP05, etc.)
 */
function matchAbsoluteEpisode(
  files: TorrentFile[],
  absoluteEpisode: number | null | undefined
): (TorrentFile & { index: number }) | null {
  if (absoluteEpisode === null || absoluteEpisode === undefined) return null;

  const pattern = new RegExp(
    `(^|[\\s_.-])(S01)?(EP|E)?0*${absoluteEpisode}[\\s_.-]`,
    'i'
  );
  console.log('Regex (Absolute):', pattern);

  return matchEpisode(files, pattern);
}

/**
 * Identify the requested episode file inside a torrent file list.
 */
export function findEpisodeFile(
  torrent: Partial<NekoTorrentItem> | null | undefined,
  info: FitInfoResult | { season: { season: number }; episode: { season?: number; episode?: number; absolute?: number } }
): (TorrentFile & { index: number }) | null {
  console.log('--- findEpisodeFile ---');
  console.log('Episode Info:', info);
  console.log('Torrent files:', torrent?.files);

  if (!torrent?.files || !Array.isArray(torrent.files)) {
    console.log('No torrent files array');
    return null;
  }

  // Heuristic 1: Look for SxxEyy
  const sxxEyyMatch = matchSeasonEpisode(torrent.files, info.season.season, info.episode.episode);
  if (sxxEyyMatch) {
    console.log('MATCH FOUND (SxxEyy):', sxxEyyMatch);
    return sxxEyyMatch;
  }

  // Heuristic 2: Look for absolute episode number
  const absoluteMatch = matchAbsoluteEpisode(torrent.files, info.episode.absolute);
  if (absoluteMatch) {
    console.log('MATCH FOUND (Absolute):', absoluteMatch);
    return absoluteMatch;
  }

  return null;
}
