# Documentation

This directory contains project decisions, technical assumptions, and rationale for Nekuvio.

## Decisions

Decisions are stored chronologically under `decisions/`.

- [001 — ID Resolution](decisions/001-id-resolution.md)
- [002 — Episode Filename Matching](decisions/002-episode-filename-matching.md)

Each decision documents the relevant nekoBT documentation, observed behavior, chosen implementation, and important limitations.

## Guiding Principle

Prefer behavior that is **verified on nekoBT** over assumptions based on conventions from other trackers, media-management software, or release groups.

When an unsupported edge case is encountered in real use, document the concrete example before expanding the implementation.

