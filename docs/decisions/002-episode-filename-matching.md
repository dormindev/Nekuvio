# Decision 002: Episode Filename Matching

**Status:** Accepted  
**Date:** 2026-09-17 (Updated: 2026-10-12)

## Context

The addon needs to identify which file in a NekoBT torrent corresponds to the requested episode.

The relevant NekoBT documentation is:

- [Technical Details](https://wiki.nekobt.to/technical-details/)
- [JSON API](https://wiki.nekobt.to/technical-details/json/)
- [Torrent API](https://wiki.nekobt.to/technical-details/json/torrents/)
- [Media API](https://wiki.nekobt.to/technical-details/json/media/)

The API documentation establishes that torrents can be associated with multiple `media_episode_ids`. This led us to inspect actual torrents rather than assuming that those IDs identify individual files.

An actual NekoBT torrent was inspected:

- [One Piece S00 Specials V2 — torrent 8291529900544](https://nekobt.to/torrents/8291529900544)

The torrent demonstrates that a batch can be associated with multiple episodes while still containing separate files for those episodes. Therefore, `media_episode_ids` identifies episodes represented by the **torrent**, not necessarily the episode represented by an individual file.

The actual file names in this torrent include formats such as:

```text
S00E001
S00E063
```

This establishes that episode numbers are not necessarily zero-padded to two digits.

## Decision

Episode matching is performed against individual torrent file names. Non-video files (files without recognized video extensions: `mkv`, `mp4`, `m4v`, `webm`, `avi`, `mov`, `mpg`, `mpeg`) are excluded prior to matching.

Matching evaluates candidate files using an ordered 6-strategy progression:

| Strategy | Pattern / Form | Example Match | Description |
| :--- | :--- | :--- | :--- |
| 1. Season + Episode | `S0*<season>(?:EP?)0*<episode>(?:v\d+)?` | `S01E01`, `S00E063v2` | Standard compact season and episode format. |
| 2. Episode Range | `S0*<season>(?:EP?)<start>-+(?:EP?)<end>` | `S01E01-E04`, `S02E05-08` | Batch or multi-episode file covering a range of episodes. |
| 3. Separated Season + Episode | `(?:S\|Season \|<N>th Season) <episode>` | `S4 - 23`, `4th Season - 23` | Formats where season and episode are separated by words or delimiters. |
| 4. Named Season + Episode | `(<romaji>\|<english>\|<native>\|<synonym>) <ep>` | `Attack on Titan - 05` | Matches against AniList season titles and synonyms. |
| 5. Absolute Episode | `(?:S01)?(?:EP?)0*<absolute>(?:v\d+)?` | `EP1050`, `0123` | Absolute series episode numbering (e.g. for long-running series). |
| 6. Episode Only | `(?:EP?)0*<episode>(?:v\d+)?` | `01`, `E12`, `EP03` | Fallback matching episode number without explicit season prefix. |

## Not Supported

The following cases are not currently supported:

- Non-standard multi-part notation without explicit ranges (e.g., `01a`, `01b`).
- Compressed archives inside torrents (`.rar`, `.zip`, `.7z`) requiring archive extraction.

## Rationale

The implementation follows the chain of evidence from the NekoBT documentation to actual torrents:

```text
NekoBT Technical Details
        ↓
JSON API documentation
        ↓
Torrent/media episode associations
        ↓
Actual torrent file list
        ↓
Observed naming diversity (compact, ranges, separated, absolute)
        ↓
Ordered multi-strategy fallback matcher
```

This avoids confusing torrent-level episode associations with file-level episode identification, filters out non-video clutter (e.g. `.nfo`, `.txt`, `.jpg`), and robustly handles standard anime release group naming variations.
