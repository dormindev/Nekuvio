# NekoBT API Reference

Base URL: https://nekobt.to/api/v1

The endpoints below are the only NekoBT API endpoints relevant to this
project.

Authentication is not required for these endpoints. Do not add
authentication logic unless the project explicitly requires it.

## GET /media/resolve

Resolve an external database ID to a NekoBT media ID.

Query:

- `id` — external identifier in the form `<provider>-<id>`

Supported providers include:

- `anilist`
- `mal`
- `anidb`
- `tvdb`
- `tmdb`
- `imdb`

Explicit forms such as `tvdb_show`, `tvdb_movie`, `tmdb_show`,
`tmdb_movie`, `imdb_show`, and `imdb_movie` can be used when the short
provider is ambiguous.

Response provides:

- `media_id`
- `anilist_id` where applicable

`anilist_id` may be null when the identifier refers to a whole series.

Prefer resolving IDs supplied by Nuvio rather than performing title
matching.

## GET /media/<media_id>

Retrieve detailed information about a NekoBT media item.

`?force=true` can be used to retrieve media even when there are currently
no torrents for it.

Important fields include:

- `title`
- `year`
- `genres`
- `overview`
- `status`
- `runtime`
- `tvdbId`
- `tmdbId`
- `imdbId`
- `alternate_titles`
- `series`
- `episodes`
- `groups`
- `anilist`

Each episode includes information such as:

- `id`
- `title`
- `season`
- `episode`
- `overview`
- `runtime`
- `airDateUtc`
- `tvdbId`

Episode IDs from this response correspond to the IDs used by torrent
search filters.

When the media is mapped to AniList, top-level title, overview, genres,
year, runtime, and status may come from the franchise's primary AniList
entry.

Use structured media/episode data rather than reconstructing it from
torrent filenames.

## GET /torrents/search

Search for multiple torrents.

This is the primary torrent discovery endpoint.

### Common parameters

- `query` — optional free-text search.
- `limit` — number of results, default 50, maximum 100.
- `offset` — pagination offset.
- `sort_by` — `best`, `latest`, `oldest`, `rss`, `seeders`,
  `seeders_asc`, `leechers`, `leechers_asc`, `downloads`,
  `downloads_asc`, `comments`, `comments_asc`, `filesize`,
  `filesize_asc`.
- `media_id` — comma-separated NekoBT or external media IDs.
- `episode_ids` — comma-separated NekoBT episode IDs.
- `episode_match_any` — when true, match any supplied episode ID;
  otherwise torrents must contain all supplied episode IDs.
- `levels` — subtitle-level filter.
- `video_codec` — comma-separated codec IDs.
- `video_type` — comma-separated video-type IDs.
- `audio_lang` — comma-separated audio languages.
- `fansub_lang` — comma-separated fansub languages.
- `sub_lang` — comma-separated subtitle languages.
- `hardsub` — filter hardsubbed torrents.
- `batch` — filter batch torrents.
- `otl` — filter original-translation torrents.
- `mtl` — filter machine-translation torrents.
- `upgraded` — filter upgraded torrents.
- `group_id` — comma-separated group IDs.
- `group_primary`
- `group_secondary`
- `group_childs`
- `group_parents`
- `uploader_id`
- `uploader_uploads`
- `uploader_contributions`
- `before` — upload date in Unix milliseconds.
- `after` — upload date in Unix milliseconds.

When a known media/episode ID is available, prefer the structured filters
over relying only on free-text search.

`media_id` can accept external IDs as well as NekoBT media IDs. An
AniList/MAL/AniDB ID narrows the search to that entry's episodes.

### Query hints

The `query` parameter is not purely literal text search. NekoBT attempts
to extract meaning from it.

For example:

- `HEVC` can add the HEVC codec filter.
- `s01` with a `media_id` can add a season-1 episode filter.
- A likely media title can produce `recommended_media` or `similar_media`.

Do not assume that the effective search is identical to the literal
query string.

### Response

Important result fields include:

- `id`
- `title`
- `infohash`
- `magnet`
- `media_id`
- `media_episode_ids`
- `description`
- `filesize`
- `level`
- `otl`
- `hardsub`
- `mtl`
- `audio_lang`
- `sub_lang`
- `fsub_lang`
- `video_codec`
- `video_type`
- `upgraded`
- `groups`
- `seeders`
- `leechers`
- `completed`
- `batch`

`more` indicates that additional results are available through
pagination.

Search returns multiple torrents. Do not reduce the result to a single
torrent unless the project's selection logic explicitly requires it.

## GET /torrents/<torrent_id>

Retrieve detailed information about a torrent.

This endpoint is used after torrent discovery when the addon needs to
inspect the torrent's files.

Important fields include:

- `id`
- `title`
- `description`
- `media_id`
- `media_episode_ids`
- `anilist_id`
- `anilist_ids`
- `audio_lang`
- `sub_lang`
- `fsub_lang`
- `video_codec`
- `video_type`
- `level`
- `mtl`
- `otl`
- `hardsub`
- `batch`
- `filesize`
- `files`
- `magnet`
- `infohash`
- `upgraded`
- `seeders`
- `leechers`
- `completed`
- `groups`

### Files

`files` is an array describing the files contained in the torrent.

Each file contains:

- `path`
- `name`
- `length`
- `offset`

The addon must inspect this array to identify the requested video file.

Do not assume:

- one torrent contains only one episode;
- the first file is the requested video;
- every torrent uses the same naming pattern.

NekoBT does not expose `fileidx` as a field on the torrent API object.
`fileidx` is part of the stream representation produced by this addon.
Preserve the existing project's convention for converting the selected
file into `fileidx`.

### Relevant torrent metadata

The structured fields on the torrent object are the authoritative
metadata available to the addon.

In particular:

- `video_type`
- `video_codec`
- `audio_lang`
- `fsub_lang`
- `sub_lang`
- `level`
- `mtl`
- `otl`
- `hardsub`
- `batch`

The torrent's `title` and `description` are also directly useful when
building the Nuvio stream.

## Rate limiting

NekoBT does not publish exact API rate limits.

A rate-limited API request returns HTTP 429 with a JSON `retry_after`
value. Use that value to determine when to retry.

Cloudflare can also return HTTP 429 with a `Retry-After` header.

Avoid unnecessary requests, especially when processing multiple torrents.

## Complete reference

https://wiki.nekobt.to/technical-details/json