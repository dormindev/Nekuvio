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
