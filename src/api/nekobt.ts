import fetch, { RequestInit, Response } from 'node-fetch';
import {
  NekoMediaData,
  NekoMediaResolveData,
  NekoTorrentItem
} from '../types.js';
import { logger } from '../utils/logger.js';

export const NEKOBT_BASE_URL = 'https://nekobt.to/api/v1';

export interface NekoFetchResult {
  response: Response;
  data: any;
}

export async function nekoFetch(
  url: string | URL,
  options: RequestInit = {},
  retry: boolean = true
): Promise<NekoFetchResult> {
  const headers = {
    Accept: 'application/json',
    'User-Agent': 'nekoBT-Stremio-Addon/1.2.0',
    ...((options.headers as Record<string, string>) || {})
  };

  logger.debug('nekoFetch:', url.toString());

  let response: Response;

  try {
    response = await fetch(url, {
      ...options,
      headers
    });
  } catch (error) {
    logger.error('nekoFetch error:', error);
    throw error;
  }

  logger.debug('nekoFetch status:', response.status, response.statusText);

  /*
   * nekoBT documents two kinds of 429:
   *  - JSON API rate limiting, with retry_after in JSON
   *  - Cloudflare rate limiting, with Retry-After header
   *
   * Retry once so a temporary rate limit doesn't immediately result
   * in an empty Stremio result.
   */
  if (response.status === 429 && retry) {
    logger.warn('Rate limited (429)');

    let waitSeconds = Number(response.headers.get('retry-after'));

    try {
      const cloned = response.clone();
      const data: any = await cloned.json();

      if (Number.isFinite(Number(data?.retry_after))) {
        waitSeconds = Number(data.retry_after);
      }
    } catch {
      // 429 response is not JSON — use header value or default
    }

    if (!Number.isFinite(waitSeconds)) {
      waitSeconds = 2;
    }

    // Don't make the addon sit around for an unreasonable amount of time.
    waitSeconds = Math.min(Math.max(waitSeconds, 0.25), 10);

    logger.info(`Retrying in ${waitSeconds}s...`);

    await new Promise(resolve =>
      setTimeout(resolve, waitSeconds * 1000)
    );

    return nekoFetch(url, options, false);
  }

  let data: any = null;

  try {
    data = await response.json();
  } catch {
    logger.error('Non-JSON response from', url.toString());
  }

  return {
    response,
    data
  };
}

/**
 * Resolve an external ID (e.g. anilist-20594) into nekoBT's internal media ID (e.g. s168).
 */
export async function resolveMediaId(externalId: string): Promise<NekoMediaResolveData | null> {
  const url = new URL(`${NEKOBT_BASE_URL}/media/resolve`);
  url.searchParams.set('id', externalId);

  const result = await nekoFetch(url);

  if (!result.response.ok || result.data?.error) {
    logger.error(
      'nekoBT media resolve failed:',
      result.response.status,
      result.data?.message
    );

    return null;
  }

  if (!result.data)
    return null;

  const isMovie = result.data.data.media_id.startsWith('m');

  return { ...result.data.data, isMovie };
}

/**
 * force=true ensures we get the episode list even if no torrents
 * are currently indexed for this media entry.
 */
export async function getMedia(mediaId: string): Promise<NekoMediaData> {
  const url = new URL(
    `${NEKOBT_BASE_URL}/media/${encodeURIComponent(mediaId)}`
  );
  url.searchParams.set('force', 'true');

  const result = await nekoFetch(url);
  if (!result.response.ok || result.data?.error) {
    throw new Error(`nekoBT media lookup failed: ${result.response.status} ${result.data?.message}`);
  }

  return result.data?.data || null;
}

export async function searchTorrents(
  mediaId: string,
  episodeId: number | string | null
): Promise<NekoTorrentItem[]> {
  const url = new URL(`${NEKOBT_BASE_URL}/torrents/search`);

  url.searchParams.set('media_id', mediaId);
  url.searchParams.set('limit', '10');

  if (episodeId !== null)
    url.searchParams.set('episode_ids', String(episodeId));

  const result = await nekoFetch(url);

  if (!result.response.ok || result.data?.error) {
    logger.error(
      'nekoBT torrent search failed:',
      result.response.status,
      result.data?.message
    );

    return [];
  }

  return Array.isArray(result.data?.data?.results)
    ? result.data.data.results
    : [];
}

export async function getTorrent(torrentId: string): Promise<NekoTorrentItem | null> {
  const url = new URL(
    `${NEKOBT_BASE_URL}/torrents/${encodeURIComponent(torrentId)}`
  );

  const result = await nekoFetch(url);

  if (!result.response.ok || result.data?.error) {
    logger.error(
      'nekoBT torrent lookup failed:',
      result.response.status,
      result.data?.message
    );

    return null;
  }

  return result.data?.data || null;
}
