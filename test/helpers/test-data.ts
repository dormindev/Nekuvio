import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';


const __dirname = path.dirname(fileURLToPath(import.meta.url));

function load<T>(standing: string, endpoint: string, id: string): T {
  const filepath = path.join(__dirname, '..', 'data', standing, endpoint, `${id}.json`);
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

/** Load a real (grounded) payload from test/data/fixtures/<endpoint>/<id>.json */
export function loadFixture<T>(endpoint: string, id: string): T {
  return load<T>('fixtures', endpoint, id);
}

/** Load an assumed, ungrounded payload from test/data/synthetic/<endpoint>/<id>.json */
export function loadSynthetic<T>(endpoint: string, id: string): T {
  return load<T>('synthetic', endpoint, id);
}

/**
 * Load a fixture and unwrap the API envelope.
 *
 * Every payload in the catalog is stored RAW — exactly what the endpoint
 * returned. NekoBT answers `{ error, data }`, so the payload lives under
 * `data`. This helper returns just that inner payload, which is what the
 * application code actually consumes.
 *
 * Use `loadFixture` when you need the raw body (e.g. to mock a fetch
 * response); use `loadFixtureData` when you need the payload itself.
 */
export function loadFixtureData<T>(endpoint: string, id: string): T {
  const body = load<{ error?: unknown; data?: T }>('fixtures', endpoint, id);
  if (body && typeof body === 'object' && 'data' in body) {
    return body.data as T;
  }
  return body as unknown as T;
}
