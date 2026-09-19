# NekoBT

Use this skill when working with the NekoBT API or interpreting NekoBT
media, torrent, file, language, or release metadata.

## Relevant API

- GET /media/resolve
- GET /media/<media_id>
- GET /torrents/search
- GET /torrents/<torrent_id>

Prefer structured IDs and metadata over title/filename inference.

The torrent details endpoint provides the torrent's file list.

See `references/api.md` for endpoint details.

## Rules

Relevant NekoBT rules:

- 6 — anime is defined by having an AniDB, AniList, or MAL entry.
- 7 — torrents are not zipped/compressed.
- 9 — torrent metadata should accurately describe its content.
- 10 — titles are English or Romaji.
- 15 — complete/multi-season packs are allowed.

## Naming

- Each episode file name should contain "SxxExx" and/or the episode absolute number.
- Special episodes and movies commonly use season `0`.

## Principles

- Do not invent undocumented NekoBT API behavior.
- Prefer structured metadata over inference.
- Treat real-world data defensively.
- Avoid unnecessary API requests.
- Consult the references when exact API or metadata details are needed.
