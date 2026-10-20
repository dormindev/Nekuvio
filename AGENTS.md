# Project Context

This is a Nuvio addon that uses the NekoBT API to find anime torrents
matching Nuvio requests.

Core pipeline:

```text
Nuvio input
  → media resolution
  → torrent discovery (multiple torrents)
  → file selection (per torrent)
  → stream construction
  → Nuvio response
```

Torrent selection and file selection are separate operations: a torrent may
contain multiple episodes, seasons, or a complete series — identify the
requested video from the torrent's file list rather than assuming
one torrent = one episode (see `test/data/unsupported/self-stream/meta.json`).

Prefer existing project architecture and conventions over introducing
new abstractions. Do not make unrelated changes.

## Module Map

```mermaid
flowchart TB
    REQ[Nuvio request\ntype + id] --> PARSE[utils/parser.ts\nparseNuvioId]
    PARSE --> KITSU{kitsu provider?}
    KITSU -- yes --> EXT[api/kitsu.ts\nresolveKitsuToExternal\nMAL / AniList]
    KITSU -- no --> DIR[provider-externalId\npassthrough]
    EXT --> RESOLVE
    DIR --> RESOLVE[api/nekobt.ts\nresolveMediaId]
    RESOLVE -- null --> EMPTY([empty streams])
    RESOLVE -- media_id --> MEDIA[api/nekobt.ts\ngetMedia\nthrows on error]
    MEDIA --> FIT[pipeline/matcher.ts\nfitInfo]
    FIT --> SEARCH[api/nekobt.ts\nsearchTorrents\nlimit 20, episode_ids?]
    SEARCH --> FAN{per torrent\nin parallel}
    FAN --> SCRAPE[api/tracker-scrapper.ts\nscrapeTorrents]
    FAN --> DETAIL[api/nekobt.ts\ngetTorrent\nnull dropped]
    SCRAPE & DETAIL --> PAIR[pair swarm + details\nby index]
    PAIR --> FILE{pipeline/matcher.ts\nmovie?}
    FILE -- yes --> MOV[findMovieFile]
    FILE -- no --> EPI[findEpisodeFile\n6 strategies]
    MOV & EPI --> STREAM[pipeline/streamBuilder.ts\ntorrentToStream\nnull filtered]
    STREAM --> RESP([streams])
```

| Path | Purpose |
| :--- | :--- |
| `src/app.ts` | Express app + route handlers (supertest seam); thin `src/index.ts` only calls `startServer()` |
| `src/api/kitsu.ts` | Kitsu mappings → MAL/AniList external ID |
| `src/api/nekobt.ts` | Typed NekoBT client (`resolveMediaId`, `getMedia`, `searchTorrents`, `getTorrent`) |
| `src/api/tracker-scrapper.ts` | BitTorrent tracker scrape → live seed/peer counts |
| `src/pipeline/matcher.ts` | `fitInfo` + file matching via 6 ordered strategies |
| `src/pipeline/streamBuilder.ts` | Stream objects with metadata badges + swarm info |
| `src/utils/parser.ts` | Nuvio stream request parsing |
| `src/utils/format.ts` | File sizes, bitrates, language tags |
| `src/utils/logger.ts` | Level-filtered logger (`LOG_LEVEL`) |
| `src/environment.ts` | Runtime config (port, build info) |
| `src/types.ts` | Shared interfaces (owns nothing; distribution planned in design-review) |

## Environment Variables

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PORT` | `7000` | Port for the HTTP server |
| `LOG_LEVEL` | `info` | Logging verbosity (`debug`, `info`, `warn`, `error`, `off`) |

## Test Fixtures & Samples

Test data lives under `test/data/` — the first three folders hold **real** data:

- `fixtures/` — immutable justification evidence (payload `<id>.json` + records-only `meta.json`)
- `examples/` — refreshable portrait of observed requests; `self-stream/` holds the observed Nuvio stream requests — not an exhaustive catalog
- `unsupported/` — quarantine for known-broken cases (excluded from vitest collection)
- `synthetic/` — assumed, ungrounded shapes — never passed off as real

Folders are named `<service>-<api>`; endpoint declarations (`endpoint`/`key`/`defaults`) live in the root registry `test/data/meta.json`.

| Layer | Files | Runs |
|-------|-------|------|
| UNIT | `api/format/logger/matcher/metadata/parser/streamBuilder.test.ts` | mocked `fetch`/`tracker`; `loadFixture`+`loadSynthetic` |
| INTEGRATION | `app.test.ts` | supertest; mocked `api/*`, real pipeline |

## NekoBT Domain Knowledge

For NekoBT-specific details, refer to the NekoBT skill located at `.agents/skills/nekobt/SKILL.md`.
