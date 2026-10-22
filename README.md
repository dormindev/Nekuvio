# Nekuvio

<div align="center">
<img src="assets/banner.png" alt="Nekuvio Banner" width="100%">
</div>

---

<div align="center">

[![CI](https://img.shields.io/github/actions/workflow/status/dormindev/Nekuvio/ci.yml?label=CI&logo=github&logoColor=959DA5&labelColor=333A41)](https://github.com/dormindev/Nekuvio/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/codecov/c/github/dormindev/Nekuvio?labelColor=333A41&label=Coverage&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmNjYxNTEiIHN0cm9rZS13aWR0aD0iMS43NSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBjbGFzcz0ibHVjaWRlIGx1Y2lkZS1jaGFydC1waWUgcHJldmlldy1pY29uIj48cGF0aCBkPSJNMjEgMTJjLjU1MiAwIDEuMDA1LS40NDkuOTUtLjk5OGExMCAxMCAwIDAgMC04Ljk1My04Ljk1MWMtLjU1LS4wNTUtLjk5OC4zOTgtLjk5OC45NXY4YTEgMSAwIDAgMCAxIDF6Ii8+PHBhdGggZD0iTTIxLjIxIDE1Ljg5QTEwIDEwIDAgMSAxIDggMi44MyIvPjwvc3ZnPg==)](https://codecov.io/gh/dormindev/Nekuvio)

[![Release](https://img.shields.io/github/actions/workflow/status/dormindev/Nekuvio/release.yml?logoColor=959DA5&labelColor=333A41&label=Release&logo=github)](https://github.com/dormindev/Nekuvio/actions/workflows/release.yml)
[![Docker Image](https://img.shields.io/badge/Docker-latest-41B851?labelColor=333A41&logo=docker)](https://github.com/dormindev/Nekuvio/pkgs/container/nekuvio)
[![Latest](https://img.shields.io/github/v/release/dormindev/Nekuvio?labelColor=333A41&label=Latest&color=41B851&logo=data:image%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM0MUI4NTEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTIuNTg2IDIuNTg2QTIgMiAwIDAgMCAxMS4xNzIgMkg0YTIgMiAwIDAgMC0yIDJ2Ny4xNzJhMiAyIDAgMCAwIC41ODYgMS40MTRsOC43MDQgOC43MDRhMi40MjYgMi40MjYgMCAwIDAgMy40MiAwbDYuNTgtNi41OGEyLjQyNiAyLjQyNiAwIDAgMCAwLTMuNDJ6Ii8+PGNpcmNsZSBjeD0iNy41IiBjeT0iNy41IiByPSIuNSIgZmlsbD0iIzQxQjg1MSIvPjwvc3ZnPg%3D%3D)](https://github.com/dormindev/Nekuvio/releases/latest)

</div>


## Description
Nekuvio is a [Nuvio](https://github.com/tapframe/Nuvio) addon that acts as a bridge to [NekoBT](https://www.nekobt.to/), resolving anime metadata requests to torrent streams.

### Pipeline Overview

```
Nuvio Request
  → Media Resolution (Kitsu / MAL / IMDb / TVDB / etc.)
  → Torrent Discovery (NekoBT API)
  → File Selection (multi-strategy episode matcher)
  → Stream Construction (metadata enrichment & tracker scrape)
  → Nuvio Response
```

## Usage

Nekuvio is distributed as a Docker container image via GitHub Packages.

### Quick Start with Docker Compose

This repository ships a `compose.yaml` that builds the image from source:

```bash
docker compose up -d
```

To run the published image instead, see [docs/docker.md](docs/docker.md).

Once running, configure the addon in your Nuvio client using your server URL (e.g. `http://<your-ip>:7000/manifest.json`).

For full configuration options and environment variable references, see [docs/docker.md](docs/docker.md).

## Development

### Prerequisites

[![node](https://img.shields.io/badge/dynamic/json?logo=nodedotjs&url=https://raw.githubusercontent.com/dormindev/Nekuvio/main/package.json&label=Node.js&query=$.engines.node&color=339933)](https://nodejs.org)
[![npm](https://img.shields.io/badge/dynamic/json?logo=npm&logocolor=CB3837&url=https://raw.githubusercontent.com/dormindev/Nekuvio/main/package.json&label=npm&query=$.engines.npm&color=CB3837&logoColor=CB3837)](https://www.npmjs.com)
[![TypeScript](https://img.shields.io/badge/dynamic/json?logo=typescript&url=https://raw.githubusercontent.com/dormindev/Nekuvio/main/package.json&label=TypeScript&query=$.devDependencies.typescript&color=3178C6)](https://www.typescriptlang.org)

### Quick Start

Clone the repository with submodules:

```bash
git clone --recurse-submodules https://github.com/dormindev/Nekuvio.git
cd Nekuvio
```

Install dependencies:

```bash
npm ci
```

Build and run:

```bash
npm run build
npm start
```

For complete development workflow, testing, and debugging commands, see [docs/development.md](docs/development.md).

## Documentation

* [Documentation Index](docs/README.md) - Guides, references, and architecture overview
