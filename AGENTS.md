# Project Context

This is a Nuvio addon that uses the NekoBT API to find anime torrents
matching Nuvio requests.

Core pipeline:

Nuvio input
  → media resolution
  → torrent discovery (multiple torrents)
  → file selection (per torrent)
  → stream construction
  → Nuvio response

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

For NekoBT-specific knowledge, use the NekoBT skill.
