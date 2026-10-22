/**
 * Shared registry helpers for test data scripts.
 */
import fs from 'node:fs';
import path from 'node:path';
import fetch from 'node-fetch';

export interface FetchSpec {
  endpoint?: string;
  key?: string;
  defaults?: Record<string, string>;
  external?: boolean;
  multi_site?: boolean;
  url?: string;
  apis?: Record<string, { endpoint?: string; key?: string; defaults?: Record<string, string> }>;
  sites?: unknown[];
}

export interface Registry {
  [service: string]: FetchSpec | string;
}

export interface RecordParams {
  path?: Record<string, string>;
  query?: Record<string, string>;
}

/** Parse the root registry at test/data/meta.json. Returns the raw parsed object. */
export function parseRegistry(dataDir: string): Registry {
  return JSON.parse(fs.readFileSync(path.join(dataDir, 'meta.json'), 'utf8')) as Registry;
}

/**
 * Resolve a registry FetchSpec for a folder named `<service>-<api>`
 * (e.g. `nekobt-resolve` → `reg.nekobt.apis.resolve`).
 */
export function resolveEndpointSpec(folder: string, reg: Registry): FetchSpec | undefined {
  const [service, ...rest] = folder.split('-');
  const svc = reg[service];
  if (typeof svc === 'object' && svc !== null) {
    const asService = svc as FetchSpec;
    if (rest.length === 0) return asService;
    const apiName = rest.join('-');
    if (asService.apis && asService.apis[apiName]) {
      return { url: asService.url, ...(asService.apis[apiName] as FetchSpec) };
    }
    return asService;
  }
  return undefined;
}

/**
 * True when the endpoint can be re-fetched over HTTP.
 * The tracker API speaks UDP announce (no HTTP surface) and the `self`
 * service is internal to the addon — neither is refreshable.
 */
export function isHttpFetchable(spec: FetchSpec | undefined): boolean {
  if (!spec) return false;
  if (!spec.url) return false;
  if (!spec.endpoint) return false;
  return true;
}

/**
 * Build a fetch URL from the registry spec + a record's params.
 * Returns null when the endpoint is not HTTP-fetchable.
 */
export function buildUrl(spec: FetchSpec, params: RecordParams): string | null {
  if (!isHttpFetchable(spec)) return null;

  // Endpoint field includes the HTTP method (e.g. "GET /media/<id>"); strip it.
  const endpoint = (spec.endpoint ?? '').replace(/^[A-Z]+\s*/, '');
  const urlPath = endpoint.replace(/<(\w+)>/g, (_, key) => params.path?.[key] ?? `<${key}>`);

  // Record query params take precedence over registry defaults.
  const query = { ...(spec.defaults ?? {}), ...(params.query ?? {}) };
  const qs = new URLSearchParams(query).toString();

  return qs ? `${spec.url}${urlPath}?${qs}` : `${spec.url}${urlPath}`;
}

/** Kitsu JSON:API requires this Accept header; otherwise it answers 406. */
const KITSU_ACCEPT = 'application/vnd.api+json';

/**
 * Fetch a URL and return its parsed JSON body.
 *
 * NekoBT answers errors with a JSON body alongside the error status
 * (e.g. 404 `{ error: true, message: "Media not found." }`). Those bodies are
 * real observations — a catalog may record them — so the body is returned
 * even for non-2xx, and only a body-less error is thrown.
 */
export async function fetchJson(url: string): Promise<unknown> {
  const accept = url.includes('kitsu.io') ? KITSU_ACCEPT : 'application/json';
  const res = await fetch(url, {
    headers: { Accept: accept, 'User-Agent': 'Nekuvio Test Tooling' },
  });

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    // Keep the body when the API sent a structured error; throw otherwise.
    if (isErrorBody(body)) {
      return body;
    }
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  return body;
}

/**
 * True when a response body is an API error envelope.
 * NekoBT can answer 200 with `{ error: true, message }` — such a body must
 * never be written over a good payload, nor be reported as a shape match.
 */
export function isErrorBody(data: unknown): boolean {
  if (data === null || typeof data !== 'object') return false;
  const body = data as Record<string, unknown>;
  return body.error === true || typeof body.error === 'string';
}

/**
 * One endpoint folder of the catalog: its records plus their payloads.
 */
export interface CatalogFolder {
  standing: 'fixtures' | 'examples' | 'synthetic';
  endpoint: string;
  records: CatalogRecord[];
}

export interface CatalogRecord {
  id: string;
  standing: 'fixtures' | 'examples' | 'synthetic';
  endpoint: string;
  params: { path?: Record<string, string>; query?: Record<string, string> };
  fetched: string | null;
  grounds?: string;
  verdict?: string;
  used_by?: string[];
  payload: unknown;
}

/**
 * Read every endpoint folder of the catalog, with its records and payloads.
 */
export function readCatalog(dataDir: string): CatalogFolder[] {
  const folders: CatalogFolder[] = [];

  for (const standing of ['fixtures', 'examples', 'synthetic'] as const) {
    const standingRoot = path.join(dataDir, standing);
    if (!fs.existsSync(standingRoot)) continue;

    for (const endpoint of fs.readdirSync(standingRoot, { withFileTypes: true })) {
      if (!endpoint.isDirectory()) continue;
      const metaPath = path.join(standingRoot, endpoint.name, 'meta.json');
      if (!fs.existsSync(metaPath)) continue;

      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as {
        records: CatalogRecord[];
      };
      const folder = path.join(standingRoot, endpoint.name);

      folders.push({
        standing,
        endpoint: endpoint.name,
        records: meta.records.map(rec => {
          const payloadPath = path.join(folder, `${rec.id}.json`);
          const payload = fs.existsSync(payloadPath)
            ? JSON.parse(fs.readFileSync(payloadPath, 'utf8'))
            : undefined;
          return { ...rec, standing, endpoint: endpoint.name, payload };
        })
      });
    }
  }

  return folders;
}
