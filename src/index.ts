import express, { Request, Response } from 'express';
import { parseNuvioId } from './utils/parser.js';
import { resolveKitsuToExternal } from './api/kitsu.js';
import { resolveMediaId, getMedia, searchTorrents } from './api/nekobt.js';
import { fitInfo } from './pipeline/matcher.js';
import { torrentToStream } from './pipeline/streamBuilder.js';
import { NuvioParsedRequest, NuvioStream } from './types.js';
import { logger } from './utils/logger.js';

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
  name: 'nekoBT',
  description:
    'nekoBT streamer',
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
 * Kitsu IDs must be translated to MAL first since nekoBT doesn't support Kitsu natively.
 */
async function getNekoBTExternalId(request: NuvioParsedRequest): Promise<string> {
  if (request.provider === 'kitsu') {
    const malId = await resolveKitsuToExternal(request.externalId);
    return `mal-${malId}`;
  }

  return `${request.provider}-${request.externalId}`;
}

/* -------------------------------------------------------------------------- */
/* Stream endpoint                                                            */
/* -------------------------------------------------------------------------- */

async function streamRequest(type: string, id: string): Promise<NuvioStream[]> {
  const request = parseNuvioId(type, id);
  logger.debug('Parsed ID:', request);

  const nekoExternalId = await getNekoBTExternalId(request);
  logger.debug('nekoBT external ID:', nekoExternalId);

  const nekoId = await resolveMediaId(nekoExternalId);
  logger.debug('Resolved neko ID:', nekoId);

  if (!nekoId) {
    return [];
  }

  const media = await getMedia(nekoId.media_id);
  const info = fitInfo(nekoId, media, request);
  const torrents = await searchTorrents(nekoId.media_id, info.episode?.id ?? null);

  logger.debug('#torrents: ', torrents.length);
  const streams = (
    await Promise.all(torrents.map(torrent => torrentToStream(torrent, request, info)))
  ).filter((s): s is NuvioStream => s !== null);

  //logger.debug('\nResult: ', { streams });

  return streams;
}

app.get('/stream/:type/:id.json', async (req: Request<{ type: string; id: string }>, res: Response) => {
  logger.debug(`Stream request: ${req.params.type}/${req.params.id}`);

  try {
    const streams = await streamRequest(req.params.type, req.params.id);
    return res.json({ streams });
  } catch (error) {
    logger.error('Stream processing error:', error);
    return emptyStreams(res);
  }
});

/* -------------------------------------------------------------------------- */
/* Start                                                                      */
/* -------------------------------------------------------------------------- */

app.listen(PORT, () => {
  logger.info(
    `nekoBT Nuvio addon listening on port ${PORT}`
  );
});
