import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';


const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function loadFixture<T>(endpoint: string, id: string): T {
  const filepath = path.join(__dirname, '..', 'data', 'fixtures', endpoint, `${id}.json`);
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}
