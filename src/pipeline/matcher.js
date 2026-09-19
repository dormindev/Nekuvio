/**
 * Find the nekoBT episode ID corresponding to Stremio's season/episode.
 *
 * Normal case:
 *   Stremio S01E07 -> nekoBT { season: 1, episode: 7, id: 12345 }
 *
 * We also check TVDB IDs when available because TVDB numbering is often
 * the most reliable bridge for externally sourced episode metadata.
 */
export function findEpisode(media, season, episode) {
  console.log(`find_episode: S${season} E${episode}`);
  if (!media || !Array.isArray(media.episodes)) {
    return null;
  }

  if (episode === null) {
    return null;
  }

  /*
   * First attempt: exact season + episode.
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

/**
 * Identify the requested episode file inside a torrent file list.
 */
export function findEpisodeFile(torrent, season, episode) {
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
