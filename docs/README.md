# Documentation

This directory contains guides, references, architecture decisions, and technical rationale for Nekuvio.

## Guides & Reference

- [Development Workflow](development.md) — Prerequisites, build stages, testing, and npm scripts
- [Docker & Configuration](docker.md) — Container usage, docker compose setup, and environment variables
- [Project Structure](project-structure.md) — Directory layout and component responsibilities
- [GitHub-Hosted Assets](github-assets.md) — Build-time asset URL generation and revision resolution
- [Versioning](versioning.md) — Relationship between Git tags, releases, and images

## Decisions

Architecture decisions are stored chronologically under `decisions/`:

- [001 — ID Resolution](decisions/001-id-resolution.md)
- [002 — Episode Filename Matching](decisions/002-episode-filename-matching.md)

Each decision documents the relevant NekoBT documentation, observed behavior, chosen implementation, and important limitations.

## Guiding Principle

Prefer behavior that is **verified on NekoBT** over assumptions based on conventions from other trackers, media-management software, or release groups.

When an unsupported edge case is encountered in real use, document the concrete example before expanding the implementation.
