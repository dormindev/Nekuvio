import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';


const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function loadFixture<T>(filename: string): T {
  const filepath = path.join(__dirname, '..', 'fixtures', filename);
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}
