import { StremioParsedRequest } from '../types.js';

const ANIME_PROVIDERS = new Set(['kitsu', 'mal', 'anilist']);

export function parseStremioId(type: string, id: string): StremioParsedRequest {
  const parts = id.split(':');
  const isMovie = type === 'movie';

  let provider: string;
  let externalId: string;
  let season: number;
  let episode: number;
  let isAnimeProvider = false;

  if (/^tt\d+$/.test(parts[0])) {
    provider = 'imdb';
    externalId = parts[0];
    season = Number(parts[1]);
    episode = Number(parts[2]);
  } else if (ANIME_PROVIDERS.has(parts[0])) {
    provider = parts[0];
    externalId = parts[1];
    season = NaN;
    episode = Number(parts[2]);
    isAnimeProvider = true;
  } else {
    provider = parts[0];
    externalId = parts[1];
    season = Number(parts[2]);
    episode = Number(parts[3]);
  }

  if (!externalId) {
    throw new Error('External ID is empty');
  }

  if (!isMovie) {
    if (isAnimeProvider) {
      if (Number.isNaN(episode)) {
        throw new Error('Episode is not a number');
      }
    } else {
      if (Number.isNaN(season) || Number.isNaN(episode)) {
        throw new Error('Season or episode is not a number');
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
