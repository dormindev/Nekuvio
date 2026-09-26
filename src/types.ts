export interface StremioParsedRequest {
  provider: string;
  externalId: string;
  season: number;
  episode: number;
  isAnimeProvider: boolean;
  isMovie: boolean;
}

export interface KitsuMappingAttributes {
  externalSite: string;
  externalId: string;
}

export interface KitsuMappingItem {
  id?: string;
  type?: string;
  attributes?: KitsuMappingAttributes;
}

export interface KitsuMappingsResponse {
  data?: KitsuMappingItem[];
}

export interface NekoMediaResolveData {
  media_id: string;
  anilist_id?: number;
  mal_id?: number;
  [key: string]: any;
}

export interface NekoAnilistEntry {
  season: number;
  src_start: number;
  src_end: number;
  dst_start: number;
  dst_end: number;
  anilist_id: number;
  [key: string]: any;
}

export interface NekoEpisodeEntry {
  id: number;
  season: number;
  episode: number;
  absolute: number;
  title?: string;
  [key: string]: any;
}

export interface NekoMediaData {
  id?: string;
  media_id?: string;
  anilist: {
    entries: NekoAnilistEntry[];
    [key: string]: any;
  };
  episodes: NekoEpisodeEntry[];
  [key: string]: any;
}

export interface TorrentFile {
  name: string;
  length: number;
  offset?: number;
  index?: number;
  [key: string]: any;
}

export interface NekoTorrentItem {
  id: string;
  title: string;
  magnet: string;
  infohash: string;
  filesize: number;
  seeders: number;
  leechers: number;
  audio_lang: string;
  fsub_lang: string;
  sub_lang: string;
  files: TorrentFile[];
  [key: string]: any;
}

export interface FitInfoResult {
  media_id: string;
  season: NekoAnilistEntry;
  episode: NekoEpisodeEntry;
}

/**
 * Minimal episode-matching shape used by findEpisodeFile / torrentToStream.
 * FitInfoResult satisfies this structurally.
 */
export interface EpisodeFileInfo {
  season: { season: number };
  episode: { episode: number; absolute: number };
}

export interface StremioStream {
  url: string;
  name: string;
  title: string;
  description: string;
  infoHash: string;
  fileIdx?: number;
  behaviorHints?: {
    configurable?: boolean;
    notResponseVideo?: boolean;
    [key: string]: any;
  };
}
