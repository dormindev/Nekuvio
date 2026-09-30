import {
  EpisodeFileInfo,
  FitInfoResult,
  NekoAnilistEntry,
  NekoEpisodeEntry,
  NekoMediaData,
  NekoMediaResolveData,
  StremioParsedRequest,
  TorrentFile,
  IndexedTorrentFile
} from '../types.js';
import { logger } from '../utils/logger.js';

type SeasonInfo = NekoAnilistEntry & {
  isPrimary: boolean;
};

import { inspect } from "node:util";

function fitSeasonInfo(
  nekoId: NekoMediaResolveData,
  media: NekoMediaData,
  request: StremioParsedRequest
): SeasonInfo | null {
  if (!media.anilist) {
    return null;
  }

  const isPrimary = media.anilist.primary?.id == nekoId.anilist_id;

  //logger.debug("Request: ", request);
  //logger.debug("media.anilist.entries: ", inspect(media.anilist.entries, { depth: 1 }));

  const seasonInfo = media.anilist.entries?.find(x => {
    //logger.debug("x: ", x.season, x.episode, x.anilist_id);

    if (nekoId.isMovie)
      return x.season == null;

    // Series from here onwards
    if (nekoId.anilist_id != null && x.anilist_id != nekoId.anilist_id)
      return false;
    //logger.debug("Season loop Request: ", request);

    if (request.isMovie) return true; // assuming movies only have 1 episode and entry

    if (request.isAnimeProvider) { // it doesn't have season, only episode
      // not movie from here onwards
      if (x.season == 0) return false; // most specials & movies aren't from an anime provider NEEDS VALIDATION

      if (x.dst_start == 2 && x.ord == 1) // probable season with an episode 0 detected
        return x.dst_start <= request.episode! + 1 && (x.dst_end == null || request.episode! + 1 <= x.dst_end);
      else // need to rework this code
        return x.dst_start <= request.episode! && (x.dst_end == null || request.episode! <= x.dst_end);
    } else { // request.season != null here; assume that #season is coincident
      if (x.season != request.season) return false;

      return x.src_start <= request.episode! && (x.src_end == null || request.episode! <= x.src_end);
    }
  });

  logger.debug("Season info: ", seasonInfo);

  if (!seasonInfo) {
    logger.warn(`Season info with ID ${nekoId.anilist_id} not found`);
    return null;
  }

  if (!request.isMovie && !request.isAnimeProvider && seasonInfo.season != request.season)
    throw new Error(`Request season ${request.season} and anilist season ${seasonInfo.season} do not match`);

  return { ...seasonInfo, isPrimary };
}

function fitEpisodeInfo(
  nekoId: NekoMediaResolveData,
  media: NekoMediaData,
  request: StremioParsedRequest,
  seasonInfo: SeasonInfo | null
): NekoEpisodeEntry | null {

  if (nekoId.isMovie)
    return null;

  let season = request.season;
  let episode = request.episode;

  if (seasonInfo != null) { // probably an "other episode" in season 0
    season = seasonInfo.season;
    if (request.isMovie) {
      episode = seasonInfo.src_start;
    } else if (request.isAnimeProvider) {
      episode = episode! + (seasonInfo.isPrimary ? -seasonInfo.dst_start + 1 : seasonInfo.src_start - 1);
    }
  }

  //logger.debug("Request: ", request);
  //logger.debug("SeasonInfo: ", seasonInfo);
  logger.debug("Episode Entry: season ", season, "episode ", episode);

  const episodeEntry = media.episodes.find(x =>
    x.season == season && x.episode == episode
  );

  if (!episodeEntry) {
    throw new Error(`Episode entry with season ${season} and episode ${episode} not found`);
  }

  logger.debug("episodeEntry: ", episodeEntry);
  return episodeEntry;
}

export function fitInfo(
  nekoId: NekoMediaResolveData,
  media: NekoMediaData,
  request: StremioParsedRequest
): FitInfoResult {
  const seasonInfo = fitSeasonInfo(nekoId, media, request);
  const episodeInfo = fitEpisodeInfo(nekoId, media, request, seasonInfo);

  return {
    media_id: nekoId.media_id,
    media: media,
    season: seasonInfo,
    episode: episodeInfo
  };
}

function matchEpisode(
  files: TorrentFile[],
  pattern: RegExp,
  predicate?: (match: RegExpMatchArray) => boolean
): (TorrentFile & { index: number }) | null {
  for (let index = 0; index < files.length; index++) {
    const result = files[index].name.match(pattern);

    if (result && (!predicate || predicate(result))) {
      return { ...files[index], index };
    }
  }

  return null;
}

export function findMovieFile(
  torrent: { files: TorrentFile[] },
  info: FitInfoResult
): IndexedTorrentFile | null {
  if (torrent.files.length === 0) return null;

  const index = torrent.files.reduce(
    (biggest, file, i, files) =>
      file.length > files[biggest].length ? i : biggest,
    0
  );

  return { ...torrent.files[index], index };
}

export function findEpisodeFile(
  torrent: { files: TorrentFile[] },
  info: FitInfoResult
): IndexedTorrentFile | null {
  if (torrent.files.length === 0) {
    return null;
  }

  //  logger.debug("findEpisodeFile info: ", info);

  const files = torrent.files;
  const season = info.season?.season ?? info.episode!.season;
  const episode = info.episode!.episode;
  const absolute = info.episode!.absolute;

  const SEP = `[\\s_.-]`; // Separator
  const EP_PRE = `(?:EP?)`; // Episode Prefix
  const EP_NUM = `(?:0*${episode}(?:v\\d+)?)`; // Episode Number (with optional version)

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

  /** SxxEyy-Ezz */
  function matchSeasonEpisodeRange(): (TorrentFile & { index: number }) | null {
    const RANGE_SEP = `-`;

    const pattern = new RegExp(
      `(?:^|${SEP})` +
      `S0*${season}${EP_PRE}(\\d+)${RANGE_SEP}+${EP_PRE}(\\d+)` +
      `${SEP}`,
      'i'
    );

    return matchEpisode(files, pattern, match => {
      const start = Number(match[1]);
      const end = Number(match[2]);

      return episode >= start && episode <= end;
    });
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
    matchSeasonEpisodeRange() ??
    matchSeparatedSeasonEpisode() ??
    matchAbsoluteEpisode() ??
    null
  );
}

