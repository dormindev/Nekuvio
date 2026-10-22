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

/**
 * Load one payload of a catalog folder, by endpoint and id.
 *
 * A data point lives in `fixtures/` (pointed at by a test) or `examples/`
 * (used as a whole), so both standings are searched.
 */
export function loadExample<T>(endpoint: string, id: string): T {
  for (const standing of ['fixtures', 'examples'] as const) {
    const filepath = path.join(
      __dirname, '..', 'data', standing, endpoint, `${id}.json`
    );
    if (fs.existsSync(filepath)) {
      return JSON.parse(fs.readFileSync(filepath, 'utf8')) as T;
    }
  }
  throw new Error(`no catalog payload for ${endpoint}/${id}`);
}

/**
 * The self-stream corpus: each record is a captured response of our own
 * `/stream` endpoint, and every catalog input it consumed points back at it
 * through the record's `used_by` list.
 */
export interface SelfStreamInput {
  standing: 'fixtures' | 'examples';
  endpoint: string;
  id: string;
}

/**
 * Collect the catalog inputs a self-stream record consumed, by scanning every
 * folder's records for a `used_by` entry naming it.
 */
export function loadSelfStreamInputs(
  recordId: string
): SelfStreamInput[] {
  const inputs: SelfStreamInput[] = [];
  const dataRoot = path.join(__dirname, '..', 'data');

  for (const standing of ['fixtures', 'examples'] as const) {
    const standingRoot = path.join(dataRoot, standing);
    for (const endpoint of fs.readdirSync(standingRoot, { withFileTypes: true })) {
      if (!endpoint.isDirectory()) continue;
      const metaPath = path.join(standingRoot, endpoint.name, 'meta.json');
      if (!fs.existsSync(metaPath)) continue;

      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as {
        records: Array<{ id: string; used_by?: string[] }>;
      };
      for (const rec of meta.records) {
        if (rec.used_by?.includes(recordId)) {
          inputs.push({ standing, endpoint: endpoint.name, id: rec.id });
        }
      }
    }
  }
  return inputs;
}

/**
 * Load every payload of an `examples/` folder, in record order.
 *
 * `examples/` is the broad, diverse gather of real cases — it is meant to be
 * consumed as a whole, so generic tests iterate over the folder rather than
 * picking one data point out of it. (A test that needs a *specific* example
 * promotes it to a fixture first.)
 */
export function loadExamples<T>(endpoint: string): T[] {
  const folder = path.join(__dirname, '..', 'data', 'examples', endpoint);
  const meta = JSON.parse(
    fs.readFileSync(path.join(folder, 'meta.json'), 'utf8')
  ) as { records: Array<{ id: string }> };

  return meta.records
    .map((rec) => {
      const filepath = path.join(folder, `${rec.id}.json`);
      if (!fs.existsSync(filepath)) return null;
      return JSON.parse(fs.readFileSync(filepath, 'utf8')) as T;
    })
    .filter((payload): payload is T => payload !== null);
}
