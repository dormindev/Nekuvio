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

- Real API test fixtures reside in `test/fixtures/`.
- Sample real-world Nuvio requests are stored in `test/examples`. Note that these represent observed live requests and are not an exhaustive catalog.

## NekoBT Domain Knowledge

For NekoBT-specific details, refer to the NekoBT skill located at `.agent/skills/nekobt/SKILL.md`.
