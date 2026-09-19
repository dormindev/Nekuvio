# Decision 001: ID Resolution

**Status:** Accepted  
**Date:** 2026-09-17

## Context

Stremio can provide anime IDs from several providers. The addon supports:

- AniList
- Kitsu
- AniDB
- MyAnimeList
- IMDb
- TMDB
- TVDB

The nekoBT API accepts provider-specific external IDs and can resolve them to its internal `media_id`.

The relevant nekoBT documentation is:

- [Technical Details](https://wiki.nekobt.to/technical-details/)
- [JSON API](https://wiki.nekobt.to/technical-details/json/)
- [Media API](https://wiki.nekobt.to/technical-details/json/media/)

## Decision

The addon will preserve the provider and external ID from the Stremio request and convert it to nekoBT's provider ID format.

For example:

```text
anilist:12345
→ anilist-12345

mal:12345
→ mal-12345

anidb:12345
→ anidb-12345

tmdb:12345
→ tmdb-12345

tvdb:12345
→ tvdb-12345

tt1234567
→ imdb-tt1234567
```

The resulting provider ID is resolved through nekoBT to obtain the internal `media_id`.

### Episode requests

When the Stremio request includes an episode reference, the addon must additionally resolve the requested episode to the corresponding nekoBT `episode_id`.

The general Stremio ID format is:

```text
provider:external_id:season:episode
```

with IMDb using its `tt...` identifier directly:

```text
tt1234567:season:episode
```

Kitsu is the exception because its identifier does not include a season component:

```text
kitsu:external_id:episode
```

For Kitsu requests, the addon therefore parses the episode as the third component rather than expecting a season.

## Kitsu Resolution

Kitsu IDs are not used directly for nekoBT resolution in the current implementation.

The addon queries the Kitsu API mappings endpoint and attempts to obtain an AniList or MyAnimeList mapping:

```text
Kitsu ID
   ↓
Kitsu mappings
   ↓
AniList / MAL ID
   ↓
nekoBT media resolution
   ↓
media_id
```

## Episode Resolution

Once the nekoBT `media_id` has been obtained, the addon uses the nekoBT media information to resolve the requested episode to the corresponding `episode_id`.

The resolved `media_id` and, when applicable, `episode_id` are then used for torrent searching.

The overall flow is:

```text
Stremio ID
    ↓
provider + external ID
    ↓
nekoBT provider ID
    ↓
nekoBT media resolution
    ↓
media_id
    ↓
episode resolution (when needed)
    ↓
episode_id
    ↓
torrent search
```

## Rationale

Keep external-ID resolution separate from torrent searching.

The addon should use nekoBT's own media and episode relationships rather than attempting to infer internal IDs from external provider IDs or torrent names.

The Kitsu exception is handled explicitly because its Stremio ID format does not contain a season component.

