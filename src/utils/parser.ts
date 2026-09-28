import { StremioParsedRequest } from '../types.js';

const ANIME_PROVIDERS = new Set(['kitsu', 'mal', 'anilist']);

export function parseStremioId(type: string, id: string): StremioParsedRequest {
  const parts = id.split(':');
  const isMovie = type === 'movie';

  let provider: string;
  let externalId: string;
  let season: number | null;
  let episode: number | null;
  let isAnimeProvider = false;

  const toNumber = (v?: string) => {
    const n = Number(v);
    return isNaN(n) ? null : n;
  };

  if (/^tt\d+$/.test(parts[0])) {
    provider = 'imdb';
    externalId = parts[0];
    season = toNumber(parts[1]);
    episode = toNumber(parts[2]);
  } else if (ANIME_PROVIDERS.has(parts[0])) {
    provider = parts[0];
    externalId = parts[1];
    season = null;
    episode = toNumber(parts[2]);
    isAnimeProvider = true;
  } else {
    provider = parts[0];
    externalId = parts[1];
    season = toNumber(parts[2]);
    episode = toNumber(parts[3]);
  }

  if (!externalId) {
    throw new Error('External ID is empty');
  }

  if (!isMovie) {
    if (isAnimeProvider) {
      if (episode == null) {
        throw new Error(`Episode is not a number`);
      }
    } else {
      if (season == null || episode == null) {
        throw new Error(`Season or episode is not a number`);
      }
    }
  }

  return {
    provider,
    externalId,
    season,
    episode,
    isAnimeProvider,
    isMovie
  };
}
