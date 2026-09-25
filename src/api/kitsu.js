import fetch from 'node-fetch';
import { toNekoBTExternalId } from '../utils/parser.js';

/**
 * nekoBT doesn't natively list Kitsu as one of its external ID providers,
 * so translate Kitsu -> MAL/AniList first.
 *
 * We prefer AniList here because nekoBT has particularly rich AniList
 * mapping information.
 */
export async function resolveKitsuToExternal(kitsuId) {
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


    console.log("MAL Mappings:", mappings);

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
export async function getNekoBTExternalId(parsed) {
  if (!parsed) {
    return null;
  }

  if (parsed.provider === 'kitsu') {
    return resolveKitsuToExternal(parsed.externalId);
  }

  return toNekoBTExternalId(parsed);
}
