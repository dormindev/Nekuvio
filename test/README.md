# Test Suite & Real-World Case Studies

Tests validate the pipeline: Nuvio ID parsing → Media Resolution & Fitting → Torrent Discovery & Selection → Stream Construction. Evidence lives in [`docs/data-catalog.md`](../docs/data-catalog.md); payloads under `test/data/{fixtures,examples,unsupported,synthetic}/` (observed requests are a sample, not an exhaustive spec).

---

## Real-World Cases → Tests

| # | Case | What it grounds | Catalog | Verified in |
|---|------|-----------------|---------|-------------|
| 1 | `media.anilist` is `null` (`m1305`, `s11599`) | `fitSeasonInfo` null-guard → `media.episodes` fallback | §NekoBT media (fixtures `m1305`, `s11599`; example `m1199`) | `matcher.test.ts` (`handles media with null anilist…`) |

| 2 | Multi-group releases, `uploading_group` (`14064189768715`, `14088879203086`) | `NekoBT \| [Group]` name tags; fixtures carry `groups: […]` | §NekoBT torrents (fixture `14064189768715`; examples `10668245437700`, `11409754265088`) | `streamBuilder.test.ts` |

| 3 | Offset mappings (`dst_start`/`src_start`; real `≠1` in `s1545` S2–5 → dst 9/31/48/61) | `episode + (isPrimary ? -dst_start+1 : src_start-1)` | §NekoBT media (fixture `s172`; example `s1545`) | `matcher.test.ts` (`supports offset dst_start…`) |
| 4 | Season-0 specials (`tt0434665:0:99`); `fitSeasonInfo` → `null`, episode-only lookup | Unlisted OVAs/specials don't throw | §Self stream (`series-tt0434665_0_6`, `_0_99`); §NekoBT media (`s11629`) | `matcher.test.ts` (`falls back to request season…`) |
| 5 | Multi-episode bundles (`S04E20-E24` in one file) | `matchSeasonEpisodeRange` ∈ `[start, end]` | §Self stream (`series-kitsu_12_1180`, `fileIdx=11`); §NekoBT torrents (`14351917616136`) | `matcher.test.ts` (`multi-episode range…`) |
| 6 | Badge decimals scale by unit (`279 MB`, `1.4 GB`, `2.50 TB`; invalid → `null`) | `Math.max(0, index-2)` saves mobile/TV space | — (pure unit) | `format.test.ts` |

Re-fetch templates live in the catalog per-entry `params`.

---

## Test Data Layout (`test/data/`)

Root registry: `test/data/meta.json`. Each endpoint folder pairs `<id>.json` payloads with a records-only `meta.json` (`params` = how to re-fetch, `grounds` = why it exists, `fetched: null` = n/a). Standing = folder:

- `fixtures/` + `examples/` — **real** data (immutable justification evidence / refreshable observed responses)
- `unsupported/` — known-broken cases (quarantined)
- `synthetic/` — assumed, ungrounded shapes (migrated from hand-written test mocks; `verdict: ungrounded`)

**The three standings have three roles.** A **fixture** is a specific real case, pointed at by at least one test. A **synthetic** is a specific assumed shape, pointed at by one test as a rule of thumb. **`examples/` are used as a whole** — a generic test over a whole folder, never one data point picked out; a test that needs a specific example promotes it to a fixture first.

**Every payload is stored raw** — exactly what the endpoint returned. NekoBT answers `{ error, data }`, Kitsu answers `{ data, meta, links }`. No folder flattens the envelope, so the same endpoint has the same shape in `fixtures/`, `examples/` and `synthetic/`.

| Loader | Returns | Use for |
| :--- | :--- | :--- |
| `loadFixture(endpoint, id)` | the raw body | mocking a `fetch` response |
| `loadFixtureData(endpoint, id)` | the unwrapped payload | feeding the application code |
| `loadSynthetic(endpoint, id)` | the raw body | mocking an assumed response |
| `loadExamples(endpoint)` | every payload of a folder | the corpus test in `matcher.test.ts` |
| `loadSelfStreamInputs(recordId)` | the catalog inputs a self-stream record consumed | the self-stream closure check in `test:data:check` |

```text
test/
├── helpers/test-data.ts         # loadFixture / loadFixtureData / loadSynthetic / loadExamples
├── data/
│   ├── meta.json                # root registry: endpoint/key/defaults per service
│   ├── fixtures/                # REAL — immutable justification evidence
│   │   ├── kitsu-mappings/      #   49235, 51128
│   │   ├── nekobt-media/        #   m145, m517, s11509, s11599, s1545, s172,
│   │   │                        #   s193, s679, s824
│   │   └── nekobt-torrents/     #   13 torrents — SxxEyy · separated season ·
│   │                            #   absolute · EP prefix · named season, plus
│   │                            #   35- and 48-file batch releases
│   ├── examples/                # REAL — refreshable observed responses
│   │   ├── kitsu-mappings/      #   6 payloads (12, 3919, 452, 49235, …)
│   │   ├── nekobt-media/        #   10 payloads (s1008, s1545, m884, …)
│   │   ├── nekobt-resolve/      #   15 payloads (mal-*, imdb-*)
│   │   ├── nekobt-search/       #   16 payloads (s172-220940, s193-5015_5016, …)
│   │   ├── nekobt-torrents/     #   55 payloads (multi-file batches, groups, …)
│   │   ├── tracker-scrape/      #   11 payloads (per-tracker single + batch)
│   │   └── self-stream/         #   15 payloads (observed Nuvio stream requests)
│   ├── unsupported/             # KNOWN-BROKEN — quarantined
│   │   └── self-stream/         #   3 payloads (fileIdx bug, no-torrents, no-mappings)
│   └── synthetic/               # ASSUMED — ungrounded shapes (from test mocks)
│       ├── kitsu-mappings/      #   empty-mappings, null-data
│       ├── nekobt-media/        #   episode-zero, null-data, primary-null
│       ├── nekobt-resolve/      #   series, movie
│       ├── nekobt-search/       #   non-array-results
│       └── nekobt-torrents/     #   episode-range, named-season, underscore-separated
├── scripts/                     # data-maintenance tools (tsx-run, not in the suite)
│   ├── check-data.ts            #   catalog integrity checks
│   ├── compare-fixtures.ts      #   always-live fixture comparison
│   └── refresh-examples.ts      #   re-fetch the examples
├── setup/                       # vitest globalSetup + its tests
│   ├── staleness.ts             #   oldest example fetched-date vs STALENESS_DAYS
│   ├── staleness.global.ts      #   globalSetup entry (prints the warning once)
│   └── staleness.test.ts        #   staleness warning path coverage
├── perf/                        # benchmarks
├── api.test.ts                  # UNIT — external API clients (mocked fetch/tracker)
├── app.test.ts                  # INTEGRATION — Express app via supertest
├── format.test.ts               # UNIT — byte/bitrate/language formatting
├── logger.test.ts               # UNIT — log-level filtering
├── matcher.test.ts              # UNIT — fitInfo / findEpisodeFile / findMovieFile
│                                #   + the whole examples/ corpus
├── metadata.test.ts             # UNIT — invisible-unicode badge encoding
├── parser.test.ts               # UNIT — Nuvio ID parsing
└── streamBuilder.test.ts        # UNIT — stream object construction
```

The catalog is the evidence base (ids, params, edges, grounds); this tree is the orientation map. To re-fetch: `params` from the folder's `meta.json` + endpoint (URL, defaults) from the root registry; each record carries the `fetched` date of its capture. Refresh tooling: `npm run test:examples:refresh [-- --dry-run]` / `npm run test:fixtures:compare`.

---

## Test Files Overview

| File | Layer | Covers |
|------|-------|--------|
| `api.test.ts` | UNIT | External clients (mocked fetch/tracker); `loadFixture` + `loadSynthetic` payloads |
| `app.test.ts` | INTEGRATION | Express via supertest (mocked `api/*`, real pipeline); manifest, `/stream`, `startServer` |
| `matcher.test.ts` | UNIT | `fitInfo` / `findEpisodeFile` / `findMovieFile` |
| `streamBuilder.test.ts` | UNIT | `torrentToStream` construction, badges, `fileIdx` |
| `parser.test.ts` | UNIT | `parseNuvioId` (movies, series, anime providers, season-0) |
| `format.test.ts` | UNIT | Bytes, bitrate, languages, timestamps |
| `metadata.test.ts` | UNIT | Invisible-unicode badge encoding |
| `logger.test.ts` | UNIT | `LOG_LEVEL` filtering |

### App vs. entrypoint

`src/app.ts` holds the Express config (side-effect-free, so supertest can wrap it). `src/index.ts` only calls `startServer()`; excluded from coverage.

---

## Running Tests

```bash
npm test              # watch/interactive (Vitest)
npm run test:coverage # single pass + V8 coverage → coverage/coverage-summary.json
```

The suite runs committed `test/data/` files only. The `npm run test:*` scripts keep that data honest:

```bash
npm run test:examples:refresh [-- --dry-run]  # re-fetch example payloads + fetched-dates
npm run test:fixtures:compare                 # always-live fixture comparison, never writes
npm run test:data:check                        # data-integrity checks over the catalog
```

- `test:examples:refresh` skips `self-stream/` (behavior snapshots) and `tracker-scrape/` (UDP announce — not HTTP-fetchable).
- `test:fixtures:compare` always fetches live and reports shape diffs for human triage — it never overwrites fixtures.
- `test:data:check` validates the *catalog*, not the code: every record has its payload and a reason, the folders refer to each other consistently, and the shapes the code reads are the shapes the API sends. Run it when a data point is added or after a refresh.
- The `examples/` corpus is used **as a whole**: `matcher.test.ts` drives every torrent in the corpus through the real matcher, rebuilding the fit info from the torrent's own `media_episode_ids` and the media they belong to.
- A staleness warning (`test/setup/staleness.ts`, wired via vitest `globalSetup` so it prints once per run) fires at startup if the *oldest* example `fetched` date exceeds `STALENESS_DAYS` (default 14). Warning-only — never fails the suite. Covered by `test/setup/staleness.test.ts`.
