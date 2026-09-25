import fetch from 'node-fetch';

/**
 * nekoBT doesn't natively list Kitsu as one of its external ID providers,
 * so translate Kitsu -> MAL first.
 */
export async function resolveKitsuToExternal(kitsuId) {
  const response = await fetch(
    `https://kitsu.io/api/edge/anime/${encodeURIComponent(kitsuId)}/mappings`,
    {
      headers: {
        Accept: 'application/vnd.api+json',
        'User-Agent': 'nekoBT-Stremio-Addon/1.2.0'
      }
    }
  );

  if (!response.ok)
    throw new Error(
      `Failed to resolve Kitsu ID ${kitsuId}: ${response.status} ${response.statusText}`
    );

  const data = await response.json();
  const mappings = Array.isArray(data?.data) ? data.data : [];

  console.log("MAL Mappings:", mappings);

  const mal = mappings.find(
    mapping =>
      mapping?.attributes?.externalSite === 'myanimelist/anime' &&
      mapping?.attributes?.externalId
  );

  if (!mal)
    throw new Error(`MAL mapping not found for Kitsu ID ${kitsuId}`);

  return mal.attributes.externalId;
}
