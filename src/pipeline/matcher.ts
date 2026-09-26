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

function matchEpisode(
  files: TorrentFile[],
  pattern: RegExp
): (TorrentFile & { index: number }) | null {
  for (let index = 0; index < files.length; index++) {
    if (pattern.test(files[index].name)) {
      return { ...files[index], index };
    }
  }

  return null;
}

export function findEpisodeFile(
  torrent: { files: TorrentFile[] },
  info: EpisodeFileInfo
): (TorrentFile & { index: number }) | null {
  if (torrent.files.length === 0) {
    return null;
  }

  const files = torrent.files;
  const season = info.season.season;
  const episode = info.episode.episode;
  const absolute = info.episode.absolute;


  const SEP = `[\\s_.-]`; // Separator
  const EP_PRE = `(EP?)`; // Episode Prefix
  const EP_NUM = `(0*${episode}(?:v\\d+)?)`; // Episode Number (with optional version)

  /** SxxEyy */
  function matchSeasonEpisode(): (TorrentFile & { index: number }) | null {
    const pattern = new RegExp(
      `(^|${SEP})` +
      `S0*${season}${EP_PRE}${EP_NUM}` +
      `${SEP}`,
      'i'
    );

    return matchEpisode(files, pattern);
  }

  /** S4 - 23 ; 4th Season - 23 ; etc */
  function matchSeparatedSeasonEpisode(): (TorrentFile & { index: number }) | null {
    const seasonParts =
      `(` +
      `S0*${season}` +
      `|Season${SEP}+0*${season}` +
      `|0*${season}(?:st|nd|rd|th)${SEP}+Season` +
      `)`;

    const pattern = new RegExp(
      `(^|${SEP})` +
      `${seasonParts}${SEP}+${EP_PRE}?${EP_NUM}` +
      `${SEP}`,
      'i'
    );

    return matchEpisode(files, pattern);
  }

  /** Absolute episode */
  function matchAbsoluteEpisode(): (TorrentFile & { index: number }) | null {
    const pattern = new RegExp(
      `(^|${SEP})` +
      `(S01)?${EP_PRE}?0*${absolute}` +
      `${SEP}`,
      'i'
    );

    return matchEpisode(files, pattern);
  }

  return (
    matchSeasonEpisode() ??
    matchSeparatedSeasonEpisode() ??
    matchAbsoluteEpisode() ??
    null
  );
}

