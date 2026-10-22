/**
 * Data-integrity checks for the test-data catalog.
 *
 * These validate the *catalog*, not the code: that every record has its
 * payload, that the folders refer to each other consistently, and that the
 * shapes we rely on are the shapes the API actually sends. They are useful
 * when a data point is added, when assumptions change, and after a refresh.
 *
 * Usage: npm run test:data:check
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readCatalog, CatalogFolder } from '../helpers/data-catalog.js';
import { loadSelfStreamInputs } from '../helpers/test-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');

const VIDEO_EXTENSIONS = ['mkv', 'mp4', 'm4v', 'webm', 'avi', 'mov', 'mpg', 'mpeg'];

/** The external sites the Kitsu mappings API is known to return. */
const KITSU_EXTERNAL_SITES = [
  'anilist/anime',
  'myanimelist/anime',
  'anidb',
  'aozora',
  'trakt',
  'thetvdb',
  'thetvdb/series',
  'thetvdb/season'
];

let failures = 0;

function check(ok: boolean, message: string): void {
  if (ok) return;
  failures++;
  console.error(`  x ${message}`);
}

/**
 * The catalog stores the raw response body. NekoBT wraps its payload in
 * `{ error, data }`; Kitsu answers JSON:API, where `data` is the collection.
 */
function unwrap(body: unknown): any {
  if (body && typeof body === 'object' && 'data' in body) return (body as any).data;
  return body;
}

function isVideoFile(name: string): boolean {
  return VIDEO_EXTENSIONS.includes((name.split('.').pop() ?? '').toLowerCase());
}

interface NekoMediaPayload {
  id?: string;
  anilist: { entries?: Array<{ season: number | null; media?: { title?: { romaji?: string } } }> } | null;
  episodes?: Array<{ id: number }>;
}

interface NekoTorrentPayload {
  id: string;
  media_id?: string;
  infohash?: string;
  magnet?: string;
  media_episode_ids?: string[];
  files?: Array<{ name: string; length: number }>;
}

const catalog = readCatalog(dataDir);
const mediaFolders = catalog.filter(f => f.endpoint === 'nekobt-media');
const torrentFolders = catalog.filter(f => f.endpoint === 'nekobt-torrents');

const mediaIds = new Set<string>();
for (const folder of mediaFolders) {
  for (const rec of folder.records) {
    const body = rec.payload as { error?: boolean } | undefined;
    const payload = unwrap(rec.payload) as NekoMediaPayload | undefined;
    // An error capture is the catalog's record of that id — it counts as known.
    if (body?.error === true) {
      const captured = rec.id;
      mediaIds.add(captured);
      continue;
    }
    if (payload?.id) mediaIds.add(payload.id);
  }
}

const torrentIds = new Set<string>();
for (const folder of torrentFolders) {
  for (const rec of folder.records) {
    const body = rec.payload as { error?: boolean } | undefined;
    if (body?.error === true) continue;
    const payload = unwrap(rec.payload) as NekoTorrentPayload | undefined;
    if (payload?.id) torrentIds.add(payload.id);
  }
}

console.log('Data catalog integrity\n');

console.log('· every record has its payload');
for (const folder of catalog) {
  for (const rec of folder.records) {
    check(rec.payload !== undefined, `${folder.standing}/${folder.endpoint}/${rec.id}: payload file missing`);
  }
}

console.log('· torrents refer to media the catalog holds');
for (const folder of torrentFolders) {
  for (const rec of folder.records) {
    const body = rec.payload as { error?: boolean } | undefined;
    if (!body || body.error === true) continue;
    const payload = unwrap(rec.payload) as NekoTorrentPayload | undefined;
    if (payload?.media_id) {
      check(mediaIds.has(payload.media_id), `${rec.id}: media_id ${payload.media_id} is not in the catalog`);
    }
    for (const id of payload?.media_episode_ids ?? []) {
      check(
        mediaFolders.some(m =>
          m.records.some(r => {
            const media = unwrap(r.payload) as NekoMediaPayload | undefined;
            return media?.episodes?.some(e => e.id === Number(id));
          })
        ),
        `${rec.id}: episode id ${id} does not belong to any media in the catalog`
      );
    }
  }
}

console.log('· resolves and searches refer to payloads the catalog holds');
for (const folder of catalog.filter(f => f.endpoint === 'nekobt-resolve')) {
  for (const rec of folder.records) {
    const body = rec.payload as { error?: boolean } | undefined;
    if (!body || body.error === true) continue;
    const payload = unwrap(rec.payload) as { media_id?: string };
    if (payload?.media_id) {
      check(mediaIds.has(payload.media_id), `${rec.id}: resolves to unknown media ${payload.media_id}`);
    } else {
      check(false, `${rec.id}: a resolve payload without an error carries no media_id`);
    }
  }
}
for (const folder of catalog.filter(f => f.endpoint === 'nekobt-search')) {
  for (const rec of folder.records) {
    const body = rec.payload as { error?: boolean } | undefined;
    if (!body || body.error === true) continue;
    const payload = unwrap(rec.payload) as { results?: Array<{ id: string }> };
    for (const result of payload?.results ?? []) {
      check(torrentIds.has(result.id), `${rec.id}: search result ${result.id} is not in the catalog`);
    }
  }
}

console.log('· torrent payloads carry the fields the code reads');
for (const folder of torrentFolders) {
  for (const rec of folder.records) {
    const body = rec.payload as { error?: boolean } | undefined;
    if (!body || body.error === true) continue;
    const payload = unwrap(rec.payload) as NekoTorrentPayload | undefined;
    check((payload?.magnet ?? '').includes(payload?.infohash ?? ' '), `${rec.id}: the magnet does not carry its own infohash`);
    check((payload?.files ?? []).some(f => isVideoFile(f.name)), `${rec.id}: no video file in the torrent`);
  }
}

console.log('· media payloads carry the fields the matcher reads');
for (const folder of mediaFolders) {
  for (const rec of folder.records) {
    const body = rec.payload as { error?: boolean } | undefined;
    if (!body || body.error === true) continue;
    const payload = unwrap(rec.payload) as NekoMediaPayload | undefined;
    for (const entry of payload?.anilist?.entries ?? []) {
      check(!!entry.media?.title?.romaji, `${rec.id}: an anilist entry has no media.title (the type declares it required)`);
    }
  }
}

console.log('· kitsu mappings are well-formed JSON:API documents');
for (const folder of catalog.filter(f => f.endpoint === 'kitsu-mappings')) {
  for (const rec of folder.records) {
    const body = rec.payload as {
      data?: Array<{ id: string; links?: { self?: string }; attributes?: { externalSite?: string } }>;
    } | undefined;
    if (!body) continue;

    for (const mapping of body.data ?? []) {
      check((mapping.links?.self ?? '').endsWith(`/mappings/${mapping.id}`), `${rec.id}: mapping ${mapping.id} has a self link that does not point at itself`);
      check(KITSU_EXTERNAL_SITES.includes(mapping.attributes?.externalSite ?? ''), `${rec.id}: unknown externalSite "${mapping.attributes?.externalSite}"`);
    }
  }
}

console.log('· every self-stream record is closed');
const selfStreamFolder = path.join(dataDir, 'examples', 'self-stream');
if (fs.existsSync(selfStreamFolder)) {
  const meta = JSON.parse(
    fs.readFileSync(path.join(selfStreamFolder, 'meta.json'), 'utf8')
  ) as { records: Array<{ id: string; grounds: string }> };

  for (const rec of meta.records) {
    const inputs = loadSelfStreamInputs(rec.id);
    const count = (endpoint: string) => inputs.filter(i => i.endpoint === endpoint).length;
    const body = JSON.parse(
      fs.readFileSync(path.join(selfStreamFolder, `${rec.id}.json`), 'utf8')
    ) as { streams?: unknown[] };
    const streams = body.streams?.length ?? 0;
    const torrents = count('nekobt-torrents');
    const media = count('nekobt-media');
    const search = count('nekobt-search');

    // The resolve is the first call of the pipeline — it always happened.
    check(count('nekobt-resolve') > 0, `${rec.id}: no resolve input`);

    if (torrents > 0) {
      // One stream per torrent, so the catalog must hold at least as many.
      check(streams <= torrents, `${rec.id}: ${streams} streams but only ${torrents} torrents`);
    } else if (media === 0 || search === 0) {
      // The pipeline stopped before it could search.
      check(/closed by design/.test(rec.grounds), `${rec.id}: no torrents, but the grounds does not say it is closed by design`);
    } else {
      // The search ran and no torrent matched.
      check(/no torrent matched/.test(rec.grounds), `${rec.id}: no torrents, but the grounds does not say no torrent matched`);
    }

    if (streams > 0) {
      check(media > 0, `${rec.id}: has ${streams} streams but no media input`);
    }
  }
}

console.log(failures === 0 ? `\nAll checks passed (${catalog.length} folders).` : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
