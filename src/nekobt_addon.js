import express from 'express';
import fetch from 'node-fetch';

const app = express();

const PORT = process.env.PORT || 7000;
const NEKOBT_BASE_URL = 'https://nekobt.to/api/v1';

// Optional. Most of the endpoints used by this addon are auth-optional.
// If you eventually want authenticated requests, set NEKOBT_SSID.
const NEKOBT_SSID = process.env.NEKOBT_SSID || null;

const SUPPORTED_PROVIDERS = new Set([
  'mal',
  'imdb',
  'kitsu'
]);

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  next();
});

/* -------------------------------------------------------------------------- */
/* Manifest                                                                  */
/* -------------------------------------------------------------------------- */

app.get('/manifest.json', (req, res) => {
  res.json({
    id: 'org.nekobt.nuvio.addon',
    version: '1.2.0',
    name: 'nekoBT Multi-Provider',
    description:
      'nekoBT streamer supporting AniList, MAL, AniDB, Kitsu, IMDb, TMDB, and TVDB',
    resources: ['stream'],
    types: ['anime','series','movie'],
    idPrefixes: [
      'tt',
      'kitsu',
      'anilist',
      'mal',
      'anidb',
      'tmdb',
      'tvdb'
    ]
  });
});

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function emptyStreams(res) {
  return res.json({ streams: [] });
}

function formatBytes(bytes) {
  const value = Number(bytes);

  if (!Number.isFinite(value) || value < 0) {
    return 'N/A';
  }

  if (value === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1
  );

  return `${(value / Math.pow(1024, index)).toFixed(2)} ${units[index]}`;
}

function parseInteger(value) {
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
function parseStremioId(rawId) {
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
    // IMDb shorthand:
    // tt1234567:1:7
    provider = 'imdb';
    externalId = parts[0];
    season = parseInteger(parts[1]);
    episode = parseInteger(parts[2]);

  } else if (parts[0].toLowerCase() === 'kitsu') {
    // Kitsu:
    // kitsu:12345:7
    //
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
   *
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
function toNekoBTExternalId(parsed) {
  if (!parsed) {
    return null;
  }

  return `${parsed.provider}-${parsed.externalId}`;
}

/* -------------------------------------------------------------------------- */
/* HTTP client                                                                */
/* -------------------------------------------------------------------------- */

async function nekoFetch(url, options = {}, retry = true) {
  const headers = {
    Accept: 'application/json',
    'User-Agent': 'nekoBT-Stremio-Addon/1.2.0',
    ...(options.headers || {})
  };

  if (NEKOBT_SSID) {
    headers.Cookie = `ssid=${NEKOBT_SSID}`;
  }

  console.log('\n========== nekoFetch ==========');
  console.log('→ FETCH URL:', url);
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
   *
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

/* -------------------------------------------------------------------------- */
/* Kitsu                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * nekoBT doesn't natively list Kitsu as one of its external ID providers,
 * so translate Kitsu -> MAL/AniList first.
 *
 * We prefer AniList here because nekoBT has particularly rich AniList
 * mapping information.
 */
async function resolveKitsuToExternal(kitsuId) {
  try {
    const response = await fetch(
      `https://kitsu.io/api/edge/anime/${encodeURIComponent(kitsuId)}/mappings`,
      {
        headers: {
          Accept: 'application/vnd.api+json',
          'User-Agent': 'nekoBT-Stremio-Addon/1.2.0'
        }
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    const mappings = Array.isArray(data?.data)
      ? data.data
      : [];

    const anilist = mappings.find(
      mapping =>
        mapping?.attributes?.externalSite === 'anilist' &&
        mapping?.attributes?.externalId
    );

    if (anilist) {
      return `anilist-${anilist.attributes.externalId}`;
    }

    const mal = mappings.find(
      mapping =>
        mapping?.attributes?.externalSite === 'myanimelist/anime' &&
        mapping?.attributes?.externalId
    );

    if (mal) {
      return `mal-${mal.attributes.externalId}`;
    }

    return null;
  } catch (error) {
    console.error('Kitsu mapping failed:', error);
    return null;
  }
}

/**
 * Return the ID that should actually be sent to nekoBT.
 */
async function getNekoBTExternalId(parsed) {
  if (!parsed) {
    return null;
  }

  if (parsed.provider === 'kitsu') {
    return resolveKitsuToExternal(parsed.externalId);
  }

  return toNekoBTExternalId(parsed);
}

/* -------------------------------------------------------------------------- */
/* Media / episode resolution                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Resolve an external ID into nekoBT's internal media ID.
 *
 * Example:
 *
 *   anilist-20594 -> s168
 */
async function resolveMediaId(externalId) {
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
async function getMedia(mediaId) {
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
 * Find the nekoBT episode ID corresponding to Stremio's season/episode.
 *
 * Normal case:
 *
 *   Stremio S01E07
 *       ->
 *   nekoBT { season: 1, episode: 7, id: 12345 }
 *
 * We also check TVDB IDs when available because TVDB numbering is often
 * the most reliable bridge for externally sourced episode metadata.
 */
function findEpisode(media, season, episode) {
	
  console.log(`find_episode: S${season} E${episode}`);
  if (!media || !Array.isArray(media.episodes)) {
    return null;
  }

  if (episode === null) {
    return null;
  }

  /*
   * First attempt: exact season + episode.
   *
   * This handles the normal SxxExx case and specials (season 0).
   */
  const exact = media.episodes.find(ep => {
    return (
      Number(ep.season) === Number(season) &&
      Number(ep.episode) === Number(episode)
    );
  });

  if (exact) {
    return exact;
  }

  /*
   * If Stremio did not provide a season, try episode-only matching.
   *
   * This is intentionally only used when there is exactly one match,
   * otherwise we don't want to guess.
   */
  if (season === null) {
    const matches = media.episodes.filter(
      ep => Number(ep.episode) === Number(episode)
    );

    if (matches.length === 1) {
      return matches[0];
    }
  }

  /*
   * Some Stremio catalogs can represent absolute anime episode numbers.
   *
   * nekoBT's media episode objects may contain `absolute`, depending on
   * the endpoint/data involved. If available, use it as a fallback.
   */
  if (Array.isArray(media.episodes)) {
    const absoluteMatches = media.episodes.filter(
      ep => Number(ep.absolute) === Number(episode)
    );

    if (absoluteMatches.length === 1) {
      return absoluteMatches[0];
    }
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Torrent search                                                             */
/* -------------------------------------------------------------------------- */

async function searchTorrents({
  mediaId,
  episodeId = null
}) {
  const url = new URL(`${NEKOBT_BASE_URL}/torrents/search`);

  url.searchParams.set('media_id', mediaId);
  url.searchParams.set('limit', '10');

  if (episodeId !== null) {
    url.searchParams.set('episode_ids', String(episodeId));

    /*
     * For a single episode this doesn't materially change the result,
     * but makes our intention explicit and is useful if this grows to
     * support multiple episode IDs later.
     */
    url.searchParams.set('episode_match_any', 'true');
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

/* -------------------------------------------------------------------------- */
/* Stremio stream formatting                                                  */
/* -------------------------------------------------------------------------- */

async function getTorrent(torrentId) {
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

function findEpisodeFile(torrent, season, episode) {
  
  console.log('--- findEpisodeFile ---');
  console.log('Season:', season);
  console.log('Episode:', episode);
  console.log('Torrent files:', torrent?.files);
  
  if (!torrent?.files || !Array.isArray(torrent.files)) {
    console.log('No torrent files array');
    return null;
  }

  if (season === null || episode === null) {
    console.log('Missing season or episode');
    return null;
  }

  const seasonNumber = Number(season);
  const episodeNumber = Number(episode);
  
  console.log('Looking for:', `S${seasonNumber}E${episodeNumber}`);


  if (
    !Number.isInteger(seasonNumber) ||
    !Number.isInteger(episodeNumber)
  ) {
    return null;
  }

  const pattern = new RegExp(
    `\\bS0*${seasonNumber}E0*${episodeNumber}\\b`
  );
  
  console.log('Regex:', pattern);

  for (let index = 0; index < torrent.files.length; index++) {
    const file = torrent.files[index];
    const path = String(file?.path || file?.name || '');

    const match = path.match(pattern);

    console.log(
      `File ${index}:`,
      path,
      '→ match:',
      match
    );

    if (match) {
      const result = {
        index,
        size: Number(file.length) || 0,
        name: file.name || path
      };

      console.log('MATCH FOUND:', result);

      return result;
    }
  }

  return null;
}



async function torrentToStream(torrent,season = null, episode = null) {
  const torrentInfo = await getTorrent(torrent.id);

  if (!torrentInfo) {
    return null;
  }

  let fileIdx = null;
  let fileSize = Number(torrentInfo.filesize) || 0;

  /*
   * Batch torrents contain multiple episodes, so we need to
   * identify the specific file Stremio requested.
   *
   * Non-batch torrents don't need episode matching. If fileIdx
   * is omitted, Stremio will select the largest file.
   */
  console.log('Torrent:', torrent.id);
  console.log('Torrent batch:', torrentInfo.batch);
  console.log('Torrent files:', torrentInfo.files);

   
  //if (torrentInfo.batch) {
    const matchedFile = findEpisodeFile(
      torrentInfo,
      season,
      episode
    );

    if (!matchedFile) {
      console.warn(
        `Could not find S${season}E${episode} in batch torrent ${torrent.id}`
      );

      return null;
    }

    fileIdx = matchedFile.index;
    fileSize = matchedFile.size;
  //}
	
  const audio = torrent.audio_lang || 'RAW';
  const fansub = torrent.fsub_lang || '';
  const sub = torrent.sub_lang || '';
  
  console.log(torrent);

  const languages = [
    ...new Set(
      [audio, fansub, sub]
        .filter(Boolean)
        .flatMap(value =>
          String(value)
            .split(',')
            .map(v => v.trim())
            .filter(Boolean)
        )
    )
  ];

  const languageText =
    languages.length > 0
      ? languages.join(', ').toUpperCase()
      : 'RAW';

  const seeders = torrent.seeders ?? 0;
  const leechers = torrent.leechers ?? 0;

  return {
    name: `nekoBT\n[${languageText}]`,

    title:
      `${torrent.title || 'nekoBT torrent'}\n` +
      `👥 S: ${seeders} | L: ${leechers} | ` +
      `💾 Torrent: ${formatBytes(torrent.filesize)}\n` +
      `📄 File: ${formatBytes(fileSize)}`,

    infoHash: torrent.infohash,
    
    ...(fileIdx !== null ? { fileIdx } : {}),

    behaviorHints: {
      configurable: false,
      notResponseVideo: false
    }
  };
}

/* -------------------------------------------------------------------------- */
/* Stream endpoint                                                            */
/* -------------------------------------------------------------------------- */

app.get('/stream/:type/:id.json', async (req, res) => {
  const rawId = req.params.id;

  console.log(`Stream request: ${req.params.type}/${rawId}`);

  try {
    const parsed = parseStremioId(rawId);

    if (!parsed) {
      console.warn('Could not parse Stremio ID:', rawId);
      return emptyStreams(res);
    }

    console.log('Parsed ID:', parsed);

    /*
     * Kitsu is not a native nekoBT provider, so convert it first.
     */
    const nekoExternalId = await getNekoBTExternalId(parsed);

    if (!nekoExternalId) {
      console.warn(
        'Could not convert provider ID to nekoBT ID:',
        parsed
      );

      return emptyStreams(res);
    }

    console.log('nekoBT external ID:', nekoExternalId);

    /* -------------------------------------------------------------------- */
    /* Path 1: Movie / series request without an episode                    */
    /* -------------------------------------------------------------------- */

    if (!parsed.hasEpisode) {
      /*
       * nekoBT's torrent search accepts external media IDs directly.
       *
       * Therefore:
       *
       *   anilist-12345
       *        ↓
       *   /torrents/search?media_id=anilist-12345
       *
       * No /media/resolve call is necessary.
       */
      const torrents = await searchTorrents({
        mediaId: nekoExternalId
      });

      const streams = (
        await Promise.all(
          torrents.map(torrent =>
            torrentToStream(torrent)
          )
        )
      ).filter(Boolean);
      
      console.log('\nResult: ',  {streams});

      return res.json({
        streams
      });
    }

    /* -------------------------------------------------------------------- */
    /* Path 2: Episode request                                              */
    /* -------------------------------------------------------------------- */

    /*
     * We need the local media ID because the media endpoint gives us the
     * canonical nekoBT episode IDs.
     */
    const mediaId = await resolveMediaId(nekoExternalId);

    if (!mediaId) {
      console.warn(
        'Could not resolve media ID:',
        nekoExternalId
      );

      return emptyStreams(res);
    }

    console.log('Resolved media ID:', mediaId);

    /*
     * Get the complete episode list.
     */
    const media = await getMedia(mediaId);

    if (!media) {
      console.warn(
        'Could not retrieve media:',
        mediaId
      );

      return emptyStreams(res);
    }

    /*
     * Convert Stremio's SxxExx reference into nekoBT's episode ID.
     */
    const episode = findEpisode(
      media,
      parsed.season,
      parsed.episode
    );

    if (!episode) {
      console.warn(
        `Could not find nekoBT episode for S${parsed.season}E${parsed.episode}`,
        {
          mediaId,
          availableEpisodes: media.episodes?.length || 0
        }
      );

      return emptyStreams(res);
    }

    console.log('Resolved episode:', episode);

    /*
     * Finally search for torrents belonging to this exact episode.
     */
    const torrents = await searchTorrents({
      mediaId,
      episodeId: episode.id
    });


    const streams = (
      await Promise.all(
      torrents.map(torrent =>
        torrentToStream(
        torrent,
        parsed.season,
        parsed.episode
        )
      )
      )
    ).filter(Boolean);

    console.log('\nResult: ', {streams});
    
    return res.json({
      streams
    });

  } catch (error) {
    console.error('Stream processing error:', error);

    return emptyStreams(res);
  }
});

/* -------------------------------------------------------------------------- */
/* Start                                                                      */
/* -------------------------------------------------------------------------- */

app.listen(PORT, () => {
  console.log(
    `nekoBT Stremio addon listening on port ${PORT}`
  );
});
