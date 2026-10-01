import fetch, { Response } from 'node-fetch';
import { KitsuMappingsResponse, KitsuResolved } from '../types.js';
import { logger } from '../utils/logger.js';

/**
 * nekoBT doesn't natively list Kitsu as one of its external ID providers,
 * so translate Kitsu -> MAL first.
 */
export async function resolveKitsuToExternal(kitsuId: string | number): Promise<KitsuResolved> {
  const response: Response = await fetch(
    `https://kitsu.io/api/edge/anime/${encodeURIComponent(kitsuId)}/mappings`,
    {
      headers: {
        Accept: 'application/vnd.api+json',
        'User-Agent': 'Nuvio Addon Dev'
      }
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to resolve Kitsu ID ${kitsuId}: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as KitsuMappingsResponse;
  const mappings = Array.isArray(data?.data) ? data.data : [];

  logger.debug('Kitsu Mappings:', mappings);

  const providers = [
    { name: 'mal', ref: 'myanimelist/anime' },
    { name: 'anilist', ref: 'anilist/anime' },
  ];

  const result = providers
    .map(provider => ({
      ...provider,
      mapping: mappings.find(
        mapping =>
          mapping?.attributes?.externalSite === provider.ref &&
          mapping?.attributes?.externalId
      ),
    }))
    .find(({ mapping }) => mapping);

  if (!result?.mapping?.attributes?.externalId) {
    throw new Error(`No useful mapping found for Kitsu ID ${kitsuId}`);
  }

  return {
    name: result.name,
    id: result.mapping.attributes.externalId,
  };
}
