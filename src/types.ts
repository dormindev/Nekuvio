export interface NuvioParsedRequest {
  provider: string;
  externalId: string;
  season: number | null;
  episode: number | null;
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
  isMovie: Boolean;
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

export type IndexedTorrentFile =
  TorrentFile & { index: number; };

export interface TorrentGroup {
  id: number;
  name: string;
  display_name: string;
  display_tag: string;
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
  level: number;
  otl: boolean;
  mtl: boolean;
  hardsub: boolean;
  video_type: number;
  video_codec: number;
  batch: boolean;
  files: TorrentFile[];
  groups: TorrentGroup[];
  [key: string]: any;
}

export interface FitInfoResult {
  media_id: string;
  media: NekoMediaData;
  season: NekoAnilistEntry | null;
  episode: NekoEpisodeEntry | null;
}

export interface EpisodeFileInfo {
  season: { season: number };
  episode: { episode: number; absolute: number };
}

export interface NuvioStream {
  url: string;
  fileIdx: number;
  infoHash: string;
  name: string;
  description: string;
  behaviorHints: {
    bingeGroup: string
  };
}

export type BitrateUnit = 'Mbps' | 'MB/s' | 'Both';
