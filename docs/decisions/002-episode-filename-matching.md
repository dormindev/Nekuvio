# Decision 002: Episode Filename Matching

**Status:** Accepted  
**Date:** 2026-09-17

## Context

The addon needs to identify which file in a nekoBT torrent corresponds to the requested episode.

The relevant nekoBT documentation is:

- [Technical Details](https://wiki.nekobt.to/technical-details/)
- [JSON API](https://wiki.nekobt.to/technical-details/json/)
- [Torrent API](https://wiki.nekobt.to/technical-details/json/torrents/)
- [Media API](https://wiki.nekobt.to/technical-details/json/media/)

The API documentation establishes that torrents can be associated with multiple `media_episode_ids`. This led us to inspect the actual torrent rather than assuming that those IDs identify individual files.

An actual nekoBT torrent was then inspected:

- [One Piece S00 Specials V2 — torrent 8291529900544](https://nekobt.to/torrents/8291529900544)

The torrent demonstrates that a batch can be associated with multiple episodes while still containing separate files for those episodes. Therefore, `media_episode_ids` identifies episodes represented by the **torrent**, not necessarily the episode represented by an individual file.

The actual file names in this torrent include formats such as:

```text
S00E001
S00E063
```

This establishes that episode numbers are not necessarily zero-padded to two digits.

## Decision

Episode matching will be performed against individual torrent file names.

The initial implementation recognizes:

```regex
S(\d+)E(\d+)
```

The captured season and episode values are converted to integers before comparison.

For example:

```text
S00E001 → season 0, episode 1
S00E01  → season 0, episode 1
S00E063 → season 0, episode 63
```

Example implementation:

```js
function fileMatchesEpisode(filename, targetSeason, targetEpisode) {
  const matches = [
    ...filename.matchAll(/S(\d+)E(\d+)/gi)
  ];

  return matches.some(match =>
    Number(match[1]) === Number(targetSeason) &&
    Number(match[2]) === Number(targetEpisode)
  );
}
```

## Not Supported

Multi-episode filename formats such as:

```text
S01E01-E02
S01E01E02
S01E01-02
```

are intentionally not interpreted as representing multiple episodes.

No verified nekoBT example using these formats was found during the investigation. If such a format is encountered in actual use, support can be added based on the observed nekoBT convention.

## Rationale

The implementation follows the chain of evidence from the nekoBT documentation to an actual torrent:

```text
nekoBT Technical Details
        ↓
JSON API documentation
        ↓
Torrent/media episode associations
        ↓
Actual torrent file list
        ↓
Observed S00E001 / S00E063 filenames
        ↓
Variable-width S<number>E<number> matching
```

This avoids confusing torrent-level episode associations with file-level episode identification and avoids importing undocumented naming conventions from other trackers or media-management software.

For the initial implementation, we therefore support the simplest episode filename format that is directly evidenced on nekoBT and leave unverified multi-episode filename conventions for future investigation.

