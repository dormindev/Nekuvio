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
export function parseStremioId(rawId) {
  if (!rawId || typeof rawId !== 'string') {
    return null;
  }

  // Remove .json in case the route parameter still contains it.
  const cleanId = rawId.replace(/\.json$/i, '');

  const parts = cleanId.split(':').filter(Boolean);

  if (!parts.length) {
    return null;
  }

  let provider;
  let externalId;
  let season = null;
  let episode = null;

  /*
   * IMDb is special because Stremio commonly uses:
   *
   *   tt1234567:1:2
   *
   * rather than:
   *
   *   imdb:tt1234567:1:2
   */
  if (/^tt\d+$/i.test(parts[0])) {
    provider = 'imdb';
    externalId = parts[0];
    season = parseInteger(parts[1]);
    episode = parseInteger(parts[2]);

  } else if (parts[0].toLowerCase() === 'kitsu') {
    // Kitsu doesn't have a season component.
    provider = 'kitsu';
    externalId = parts[1];
    season = null;
    episode = parseInteger(parts[2]);

  } else {
    // Everything else:
    // anilist:12345:1:7
    // mal:12345:1:7
    // anidb:12345:1:7
    // tmdb:12345:1:7
    // tvdb:12345:1:7
    provider = parts[0].toLowerCase();
    externalId = parts[1];
    season = parseInteger(parts[2]);
    episode = parseInteger(parts[3]);
  }

  if (!SUPPORTED_PROVIDERS.has(provider)) {
    return null;
  }

  if (!externalId) {
    return null;
  }

  /*
   * Do not require both season and episode.
   * We only consider this an episode request when an episode number
   * was actually supplied.
   */
  const hasEpisode = episode !== null;

  return {
    provider,
    externalId,
    season,
    episode,
    hasEpisode
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
