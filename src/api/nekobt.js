import fetch from 'node-fetch';

export const NEKOBT_BASE_URL = 'https://nekobt.to/api/v1';

// Optional. Most of the endpoints used by this addon are auth-optional.
// If you eventually want authenticated requests, set NEKOBT_SSID.
export const NEKOBT_SSID = process.env.NEKOBT_SSID || null;

export async function nekoFetch(url, options = {}, retry = true) {
  const headers = {
    Accept: 'application/json',
    'User-Agent': 'nekoBT-Stremio-Addon/1.2.0',
    ...(options.headers || {})
  };

  if (NEKOBT_SSID) {
    headers.Cookie = `ssid=${NEKOBT_SSID}`;
  }

  console.log('\n========== nekoFetch ==========');
  console.log('→ FETCH URL:', url.toString());
  console.log('→ FETCH OPTIONS:', {
    ...options,
    headers
  });
  console.log('→ RETRY ENABLED:', retry);

  let response;

  try {
    response = await fetch(url, {
      ...options,
      headers
    });
  } catch (error) {
    console.error('✗ FETCH ERROR:', error);
    throw error;
  }

  console.log('← FETCH STATUS:', response.status, response.statusText);

  /*
   * nekoBT documents two kinds of 429:
   *  - JSON API rate limiting, with retry_after in JSON
   *  - Cloudflare rate limiting, with Retry-After header
   *
   * Retry once so a temporary rate limit doesn't immediately result
   * in an empty Stremio result.
   */
  if (response.status === 429 && retry) {
    console.warn('⚠️ Rate limited (429)');

    let waitSeconds = Number(response.headers.get('retry-after'));

    console.log('→ Retry-After header:', waitSeconds);

    try {
      const cloned = response.clone();
      const data = await cloned.json();

      console.log('→ 429 JSON:', data);

      if (Number.isFinite(Number(data?.retry_after))) {
        waitSeconds = Number(data.retry_after);
      }
    } catch {
      console.log('→ 429 response is not JSON');
    }

    if (!Number.isFinite(waitSeconds)) {
      waitSeconds = 2;
    }

    // Don't make the addon sit around for an unreasonable amount of time.
    waitSeconds = Math.min(Math.max(waitSeconds, 0.25), 10);

    console.log(`→ Waiting ${waitSeconds}s before retry...`);

    await new Promise(resolve =>
      setTimeout(resolve, waitSeconds * 1000)
    );

    console.log('→ Retrying request...');

    return nekoFetch(url, options, false);
  }

  let data = null;

  try {
    data = await response.json();
    console.log('← PARSED JSON:', data);
  } catch {
    console.error('✗ Non-JSON response');
  }

  console.log('========== nekoFetch done ==========\n');

  return {
    response,
    data
  };
}

/**
 * Resolve an external ID into nekoBT's internal media ID.
 *
 * Example:
 *   anilist-20594 -> s168
 */
export async function resolveMediaId(externalId) {
  const url = new URL(`${NEKOBT_BASE_URL}/media/resolve`);
  url.searchParams.set('id', externalId);

  const result = await nekoFetch(url);

  if (!result.response.ok || result.data?.error) {
    console.error(
      'nekoBT media resolve failed:',
      result.response.status,
      result.data?.message
    );

    return null;
  }

  return result.data?.data?.media_id || null;
}

/**
 * Fetch full media information.
 *
 * force=true is useful here because we're using the media endpoint to
 * discover the episode mapping. We don't want "no torrents" on a media
 * entry to prevent us from getting its episode list.
 */
export async function getMedia(mediaId) {
  const url = new URL(
    `${NEKOBT_BASE_URL}/media/${encodeURIComponent(mediaId)}`
  );
  url.searchParams.set('force', 'true');

  const result = await nekoFetch(url);

  if (!result.response.ok || result.data?.error) {
    console.error(
      'nekoBT media lookup failed:',
      result.response.status,
      result.data?.message
    );

    return null;
  }

  return result.data?.data || null;
}

/**
 * Search torrents by media ID and optional episode ID.
 */
export async function searchTorrents({
  mediaId,
  episodeId = null
}) {
  const url = new URL(`${NEKOBT_BASE_URL}/torrents/search`);

  url.searchParams.set('media_id', mediaId);
  url.searchParams.set('limit', '10');

  if (episodeId !== null) {
    url.searchParams.set('episode_ids', String(episodeId));
  }

  const result = await nekoFetch(url);

  if (!result.response.ok || result.data?.error) {
    console.error(
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

/**
 * Get detailed torrent information by torrent ID.
 */
export async function getTorrent(torrentId) {
  const url = new URL(
    `${NEKOBT_BASE_URL}/torrents/${encodeURIComponent(torrentId)}`
  );

  const result = await nekoFetch(url);

  if (!result.response.ok || result.data?.error) {
    console.error(
      'nekoBT torrent lookup failed:',
      result.response.status,
      result.data?.message
    );

    return null;
  }

  return result.data?.data || null;
}
