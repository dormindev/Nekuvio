import express, { Request, Response } from 'express';
import { parseStremioId } from './utils/parser.js';
import { resolveKitsuToExternal } from './api/kitsu.js';
import { resolveMediaId, getMedia, searchTorrents } from './api/nekobt.js';
import { fitInfo } from './pipeline/matcher.js';
import { torrentToStream } from './pipeline/streamBuilder.js';
import { StremioParsedRequest, StremioStream } from './types.js';

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

app.get('/manifest.json', (req: Request, res: Response) => {
  res.json(MANIFEST);
});

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function emptyStreams(res: Response) {
  return res.json({ streams: [] });
}

/**
 * Return the ID that should actually be sent to nekoBT.
 */
async function getNekoBTExternalId(request: StremioParsedRequest): Promise<string> {
  let provider: string;
  let externalId: string;

  if (request.provider === 'kitsu') {
    provider = 'mal';
    externalId = await resolveKitsuToExternal(request.externalId);
  } else {
    provider = request.provider;
    externalId = request.externalId;
  }

  return `${provider}-${externalId}`;
}

/* -------------------------------------------------------------------------- */
/* Stream endpoint                                                            */
/* -------------------------------------------------------------------------- */

async function streamRequest(type: string, id: string): Promise<StremioStream[]> {
  const request = parseStremioId(type, id);
  console.log('Parsed ID:', request);

  const nekoExternalId = await getNekoBTExternalId(request);
  console.log('nekoBT external ID:', nekoExternalId);

  const nekoId = await resolveMediaId(nekoExternalId);
  console.log('Resolved neko ID:', nekoId);

  if (!nekoId) {
    return [];
  }

  const media = await getMedia(nekoId.media_id);
  const info = fitInfo(nekoId, media, request);
  const torrents = await searchTorrents(nekoId.media_id, info.episode.id);

  const streams = (
    await Promise.all(torrents.map(torrent => torrentToStream(torrent, info)))
  ).filter((s): s is StremioStream => s !== null);

  console.log('\nResult: ', { streams });

  return streams;
}

app.get('/stream/:type/:id.json', async (req: Request<{ type: string; id: string }>, res: Response) => {
  console.log(`Stream request: ${req.params.type}/${req.params.id}`);

  try {
    const streams = await streamRequest(req.params.type, req.params.id);
    return res.json({ streams });
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
