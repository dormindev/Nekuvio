# Nekuvio

<div align="center">
<img src="assets/banner.png" alt="Nekuvio Banner" width="100%">
</div>

## Description
<div align="center">

[![CI](https://github.com/dormindev/Nekuvio/actions/workflows/ci.yml/badge.svg)](https://github.com/dormindev/Nekuvio/actions/workflows/ci.yml)
[![Release](https://github.com/dormindev/Nekuvio/actions/workflows/release.yml/badge.svg)](https://github.com/dormindev/Nekuvio/actions/workflows/release.yml)
[![Coverage](https://codecov.io/gh/dormindev/Nekuvio/graph/badge.svg)](https://codecov.io/gh/dormindev/Nekuvio)

</div>

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

Create a `docker-compose.yml` file:

```yaml
services:
  nekuvio:
    image: ghcr.io/dormindev/nekuvio:latest
    container_name: nekuvio
    restart: unless-stopped
    ports:
      - "7000:7000"
    environment:
      - PORT=7000
      - LOG_LEVEL=info
```

Run the container:

```bash
docker compose up -d
```

Once running, configure the addon in your Nuvio client using your server URL (e.g. `http://<your-ip>:7000/manifest.json`).

For full configuration options and environment variable references, see [docs/docker.md](docs/docker.md).

## Development

### Prerequisites

* Node.js `^26`
* npm `^11`

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
