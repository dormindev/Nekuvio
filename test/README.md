# Test Suite & Real-World Case Studies

This directory contains automated unit tests and real API fixtures validating the NekoBT Nuvio addon pipeline:
Nuvio ID parsing → Media Resolution & Fitting → Torrent Discovery & Selection → Stream Construction.

---

## Real-World Cases That Inspired Tests & Verifications

The tests in this repository are based on real-world Nuvio requests (from `stream_examples`) and authentic API responses from NekoBT (`https://nekobt.to/api/v1`) and Kitsu (`https://kitsu.io/api/edge`).

### 1. `media.anilist` Can Be `null` for Unmapped Media
- **Discovery**: In the NekoBT catalog, anime titles are defined by having an AniDB, AniList, or MAL entry (Rule 6). While most popular anime have rich AniList metadata, certain titles (e.g. western animations, movies only indexed on TMDB/IMDb, or media mapped solely via TVDB) return `"anilist": null`.
- **Real Examples**:
  - `m1305` (*Delivery Kitten Unyan*): Resolved from TMDB; returned `data.anilist = null`.
  - `s11599` (*Tsukimonogatari*, tvdbId: 460809): Series resolved via TVDB; returned `data.anilist = null`.
- **Justification**: Accessing `media.anilist.primary.id` directly caused `TypeError: Cannot read properties of null (reading 'primary')`. `fitSeasonInfo` now safely checks `if (!media.anilist) return null;` so unmapped media falls back gracefully to `media.episodes` matching.
- **Curl Template**:
  ```bash
  curl -s "https://nekobt.to/api/v1/media/m1305?force=true" | jq '.data.anilist'
  curl -s "https://nekobt.to/api/v1/media/s11599?force=true" | jq '.data.anilist'
  ```
- **Verified In**: `test/matcher.test.ts` (`handles media with null anilist...`).

### 2. Multi-Group Releases and Uploading Groups
- **Discovery**: In a sample of 100 recent torrents from `/torrents/search`, 100% of torrents had at least one group (`groups.length >= 1`). Releases frequently list multiple groups (e.g. uploading fansub group, encoder, raw provider), with `uploading_group: true` marking the primary publisher.
- **Real Example**:
  - Torrent `14064189768715` (Slime S4) has group `FrixySubs`.
  - Torrent `14088879203086` has 3 groups: `Sonomama` (uploading group, "TL corrections"), `VARYG` ("WEB-DLs"), and `MTBB`.
- **Justification**: Stream names format group tags as `NekoBT | [GroupName]`. Test fixtures must supply `groups: [...]` reflecting the live API guarantee.
- **Verified In**: `test/streamBuilder.test.ts`.

### 3. Anime Provider Offset Mappings (`dst_start` / `src_start`)
- **Discovery**: Anime providers (e.g. Kitsu) often number episodes continuously across a whole series (e.g. Kitsu episode 14 for season 2), whereas NekoBT groups episodes into seasons where episode numbering restarts at 1. Furthermore, AniList often splits a multi-cour show into separate entries with offset indices (`src_start`, `src_end`, `dst_start`, `dst_end`).
- **Real Example**:
  - `s172` (*That Time I Got Reincarnated as a Slime*):
    - Season 4 maps to AniList ID `182205` with `src_start: 1, src_end: 24, dst_start: 1, dst_end: 24`.
    - If a show has a season offset (e.g. `dst_start: 13, src_start: 1`), requesting episode 14 translates to season episode `(14 - 13) + 1 = 2`.
- **Justification**: `fitEpisodeInfo` adjusts the requested episode based on `seasonInfo.isPrimary`:
  ```ts
  episode = episode + (seasonInfo.isPrimary ? -seasonInfo.dst_start + 1 : seasonInfo.src_start - 1);
  ```
- **Verified In**: `test/matcher.test.ts` (`supports offset dst_start and src_start calculations with isPrimary`).

### 4. Non-Fatal Season Mismatch & Special Episodes
- **Discovery**: OVA episodes, specials, or movies often use Season `0` (e.g. `tt0434665:0:99`). When `fitSeasonInfo` cannot match a season entry in `media.anilist.entries`, throwing an exception broke all specials and unlisted OVAs.
- **Justification**: In commit `05b8593`, `fitSeasonInfo` was updated to log a warning and return `null`. `fitEpisodeInfo` then attempts a direct lookup in `media.episodes` matching `season = request.season` and `episode = request.episode`.
- **Verified In**: `test/matcher.test.ts` (`falls back to request season and episode in media.episodes when season info is null`).

### 5. Multi-Episode Torrent Bundles (`SxxEyy-Ezz`)
- **Discovery**: Upload groups often release batches spanning multiple episodes in a single video file (e.g. `Slime S04E20-E24 [1080p].mkv`).
- **Justification**: `findEpisodeFile` has a dedicated `matchSeasonEpisodeRange` pattern to verify that the requested episode is within `[start, end]`.
- **Verified In**: `test/matcher.test.ts` (`matches files with multi-episode range SxxEyy-Ezz pattern`).

### 6. Dynamic Decimal Formatting for Stream Badges
- **Discovery**: Displaying `500.00 B` or `1.00 KB` in mobile and TV UI took excessive screen space. Format logic dynamically scales decimals using `Math.max(0, index - 2)`:
  - Bytes, KB, MB: 0 decimals (`500 B`, `1 KB`, `279 MB`)
  - GB: 1 decimal (`1.4 GB`, `1.5 GB`)
  - TB: 2 decimals (`2.50 TB`)
  - Invalid / negative bytes return `null` so callers can display fallbacks like `'?? MB'`.
- **Verified In**: `test/format.test.ts`.

---

## Fixtures in `test/fixtures/`

| Fixture File | Source Endpoint | Description |
|---|---|---|
| `media_s172.json` | `GET /media/s172?force=true` | Full media entry for *Slime S4*, containing multi-season `anilist.entries`, `primary`, and `episodes`. |
| `media_s11599.json` | `GET /media/s11599?force=true` | Media entry for *Tsukimonogatari* showing `"anilist": null`. |
| `media_m145.json` | `GET /media/m145?force=true` | Movie entry for *Spirited Away* (`m145`) with movie episodes and anilist primary. |
| `media_m1305.json` | `GET /media/m1305?force=true` | Movie entry for *Delivery Kitten Unyan* (`m1305`) showing `"anilist": null`. |
| `torrent_s172.json` | `GET /torrents/14064189768715` | Real torrent payload for Slime S4 with file list, magnet, infohash, and publishing group `FrixySubs`. |
| `kitsu_49235_mappings.json` | `GET /api/edge/anime/49235/mappings` | Kitsu mapping payload resolving Kitsu ID `49235` to MAL ID `59970`. |

To re-fetch fixtures:
```bash
curl -s "https://nekobt.to/api/v1/media/s172?force=true" | jq '.data' > test/fixtures/media_s172.json
curl -s "https://nekobt.to/api/v1/media/s11599?force=true" | jq '.data' > test/fixtures/media_s11599.json
curl -s "https://nekobt.to/api/v1/media/m145?force=true" | jq '.data' > test/fixtures/media_m145.json
curl -s "https://nekobt.to/api/v1/media/m1305?force=true" | jq '.data' > test/fixtures/media_m1305.json
curl -s "https://nekobt.to/api/v1/torrents/14064189768715" | jq '.data' > test/fixtures/torrent_s172.json
curl -s "https://kitsu.io/api/edge/anime/49235/mappings" > test/fixtures/kitsu_49235_mappings.json
```

---

## Test Files Overview

- **`test/format.test.ts`**: Tests `formatBytes`, `formatAverageBitrate`, `formatLanguages`, and `formatLanguageFlags`.
- **`test/parser.test.ts`**: Tests `parseNuvioId` for movies, series, anime providers (Kitsu, MAL, AniList), and specials (Season 0).
- **`test/matcher.test.ts`**: Tests `fitInfo`, `findMovieFile`, and `findEpisodeFile` across all naming patterns and edge cases.
- **`test/streamBuilder.test.ts`**: Tests `torrentToStream` stream object construction, magnet resolution, badges, and file index mapping.
- **`test/metadata.test.ts`**: Tests `encodeNekobtMetadata` base-4 invisible unicode marker encoding for NekoBT badges.

---

## Running Tests

Run all unit tests with:
```bash
npm test
```
