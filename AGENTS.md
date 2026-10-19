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

Each returned stream contains:
- torrent
- fileidx
- title
- description
- optional enrichment in title/description

Torrent selection and file selection are separate operations.

A torrent may contain multiple episodes, seasons, or a complete series.
Identify the requested video from the torrent's file list rather than
assuming one torrent = one episode.

Prefer existing project architecture and conventions over introducing
new abstractions. Do not make unrelated changes.

## Module Map

| Path | Purpose |
| :--- | :--- |
| `src/index.ts` | Express server, route handlers, addon manifest |
| `src/pipeline/resolver.ts` | Resolves Nuvio IDs (IMDb, TMDb, TVDB, MAL, AniList, Kitsu) to NekoBT media IDs |
| `src/pipeline/matcher.ts` | Fits season/episode info and matches torrent files via 6 ordered strategies |
| `src/pipeline/streamBuilder.ts` | Builds Nuvio stream objects with metadata badges and tracker scrape info |
| `src/api/nekobt.ts` | Typed client for the NekoBT REST API |
| `src/api/tracker.ts` | Scrapes BitTorrent trackers for live seed/peer counts |
| `src/utils/parser.ts` | Parses Nuvio stream request parameters |
| `src/utils/format.ts` | Formats file sizes, bitrates, and language tags |
| `src/types.ts` | Shared TypeScript interfaces and types |

## Environment Variables

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PORT` | `7000` | Port for the HTTP server |
| `LOG_LEVEL` | `info` | Logging verbosity (`debug`, `info`, `warn`, `error`) |
| `NODE_ENV` | `development` | Node execution mode (`development`, `production`) |

## Test Fixtures & Samples

Test data lives under `test/data/` — the first three folders hold **real** data:

- `fixtures/` — immutable justification evidence: payload `<id>.json` + records-only `meta.json`.
- `examples/` — refreshable portrait of observed requests; `self-stream/` holds the observed Nuvio stream requests (formerly `test/examples`) — not an exhaustive catalog.
- `unsupported/` — quarantine for known-broken cases (excluded from vitest collection); standing example: `series-kitsu_3919_1` (empty streams for torrent `7509405969932`).
- `synthetic/` — assumed, ungrounded shapes — never passed off as real.

Folders are named `<service>-<api>`; endpoint declarations (`endpoint`/`key`/`defaults`) live in the root registry `test/data/meta.json`.

## NekoBT Domain Knowledge

For NekoBT-specific details, refer to the NekoBT skill located at `.agent/skills/nekobt/SKILL.md`.
