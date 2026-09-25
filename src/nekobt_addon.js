import express from 'express';
import { parseStremioId } from './utils/parser.js';
import { getNekoBTExternalId } from './api/kitsu.js';
import { resolveMediaId, getMedia, searchTorrents } from './api/nekobt.js';
import { fitInfo } from './pipeline/matcher.js';
import { torrentToStream } from './pipeline/streamBuilder.js';

const app = express();

const PORT = process.env.PORT || 7000;

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  next();
});

/* -------------------------------------------------------------------------- */
/* Manifest                                                                  */
/* -------------------------------------------------------------------------- */

const MANIFEST = {
  id: 'org.nekobt.nuvio.addon',
  version: '1.2.0',
  name: 'nekoBT Multi-Provider',
  description:
    'nekoBT streamer supporting AniList, MAL, AniDB, Kitsu, IMDb, TMDB, and TVDB',
  resources: ['stream'],
  types: ['anime', 'series', 'movie'],
  idPrefixes: [
    'tt',
    'kitsu',
    'anilist',
    'mal',
    'anidb',
    'tmdb',
    'tvdb'
  ]
};

app.get('/manifest.json', (req, res) => {
  res.json(MANIFEST);
});

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function emptyStreams(res) {
  return res.json({ streams: [] });
}

/* -------------------------------------------------------------------------- */
/* Stream endpoint                                                            */
/* -------------------------------------------------------------------------- */

app.get('/stream/:type/:id.json', async (req, res) => {
  console.log(`Stream request: ${req.params.type}/${req.params.id}`);

  try {
    const parsed = parseStremioId(req.params.type, req.params.id);

    if (!parsed) {
      console.warn('Could not parse Stremio ID:', req.params.id);
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

    if (parsed.isMovie) {
      /*
       * nekoBT's torrent search accepts external media IDs directly.
       *
       * Therefore:
       *   anilist-12345 -> /torrents/search?media_id=anilist-12345
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

      console.log('\nResult: ', { streams });

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
    const nekoId = await resolveMediaId(nekoExternalId);

    if (!nekoId) {
      console.warn(
        'Could not resolve media ID:',
        nekoExternalId
      );

      return emptyStreams(res);
    }

    console.log('Resolved neko ID:', nekoId);

    /*
     * Get the complete episode list.
     */
    const media = await getMedia(nekoId.media_id);

    if (!media) {
      console.warn(
        'Could not retrieve media:',
        nekoId
      );

      return emptyStreams(res);
    }

    const info = fitInfo(nekoId, media, parsed);

    console.log('Resolved info:', info);

    /*
     * Finally search for torrents belonging to this exact episode.
     */
    const torrents = await searchTorrents({
      mediaId: nekoId.media_id,
      episodeId: info.episode.id
    });

    const streams = (
      await Promise.all(
        torrents.map(torrent =>
          torrentToStream(torrent, info)
        )
      )
    ).filter(Boolean);

    console.log('\nResult: ', { streams });

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
