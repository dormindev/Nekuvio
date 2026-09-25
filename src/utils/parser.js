export const SUPPORTED_PROVIDERS = new Set([
  'mal',
  'imdb',
  'kitsu'
]);

export function parseInteger(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) ? parsed : null;
}

/**
 * Parse Stremio's ID.
 *
 * Examples:
 *
 *   anilist:12345
 *   anilist:12345:1:7
 *   mal:54321:1:3
 *   anidb:1234:1:2
 *   tvdb:123456:1:5
 *   tmdb:98765
 *   imdb:tt1234567:1:4
 *   tt1234567:1:4
 *   kitsu:12345:1:2
 *
 * Returns:
 *
 * {
 *   provider: 'anilist',
 *   externalId: '12345',
 *   season: 1,
 *   episode: 7
 * }
 */
export function parseStremioId(type, id) {
  const parts = id.split(':');

  console.log('id parts:', parts);

  let provider;
  let externalId;
  let season;
  let episode;
  let isAnimeProvider = false;

  const isMovie = type === 'movie';

  if (/^tt\d+$/.test(parts[0])) {
    provider = 'imdb';
    externalId = parts[0];
    season = Number(parts[1]);
    episode = Number(parts[2]);
  } else if (['kitsu', 'mal', 'anilist'].includes(parts[0])) {
    // Anime providers don't have a season component.
    provider = parts[0];
    externalId = parts[1];
    season = null;
    episode = Number(parts[2]);
    isAnimeProvider = true;
  } else {
    provider = parts[0];
    externalId = parts[1];
    season = Number(parts[2]);
    episode = Number(parts[3]);
  }

  if (!externalId)
    throw new Error("External ID is empty");

  if (!isMovie) {
    if (isAnimeProvider) {
      if (episode == NaN) {
        throw new Error("Episode is not a number");
      }
    } else {
      if (season == NaN || episode == NaN) {
        throw new Error("Season or episode is not a number");
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

/**
 * Convert our parsed provider ID into nekoBT's external-ID format.
 */
export function toNekoBTExternalId(parsed) {
  if (!parsed) {
    return null;
  }

  return `${parsed.provider}-${parsed.externalId}`;
}
