# Conventions

Project-wide coding conventions for Nekuvio. Each entry is recorded when adopted; entries apply from their merge commit onward.

> **Scope note (test/improve-foundations):** the import rule below currently applies to **test files only**. Source files normalize opportunistically when touched on the design-review branch — no repo-wide churn.

## Imports (test files)

One group per origin, top to bottom:

1. Test framework (`vitest`)
2. External packages
3. Project source (`../src/**`, `../../src/**`)
4. Test-local (`./…`)

- A single blank line separates groups; a double blank line separates the import block from code.
- Imports are wrapped to one member per line when their single-line form exceeds 80 chars. Within a group, single-line imports (≤80 chars) come first, sorted by module specifier; wrapped multi-line imports sink to the group end, sorted among themselves.
- Members inside a single import statement are sorted alphabetically.
- Type-only imports use `import type` and stay within their origin group.
- Always run tests with `npm test -- run` (bare `npm test` enters watch mode).

**Tooling (verified, to be adopted in design-review):** Prettier (`printWidth: 80`) for wrapping/member layout + `eslint-plugin-perfectionist@>=5.0.0` `sort-imports` with the `singleline`/`multiline` modifiers (added in commit `2c954d4`, released v5.0.0, closing issue #605) for the singleline-first placement, origin groups, and blank-line handling; member sorting via `sort-named-imports` (`type: alphabetical`).

Example:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Client from 'bittorrent-tracker';
import fetch, { type Response } from 'node-fetch';

import { resolveKitsuToExternal } from '../src/api/kitsu.js';
import { scrapeTorrents } from '../src/api/tracker-scrapper.js';
import type { NekoTorrentItem } from '../src/types.js';
import {
  getMedia,
  getTorrent,
  nekoFetch,
  resolveMediaId,
  searchTorrents
} from '../src/api/nekobt.js';

import { loadFixture } from './helpers/fixtures.js';


vi.mock('node-fetch', () => {
```
