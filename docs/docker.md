# Docker & Configuration Reference

This document covers running Nekuvio with Docker, configuration options, and environment variables.

## Container Image

Official container images are published on GitHub Packages (GHCR):

```text
ghcr.io/dormindev/nekuvio:latest
```

The image runs the pre-compiled Node.js application (`node dist/index.js`) listening on internal port `7000`.

## Docker Compose Setup

This repository ships a `compose.yaml` that builds the image from source:

```bash
docker compose up -d
```

To run the **published** image instead, use a `compose.yaml` of your own:

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

Then:

```bash
docker compose up -d
```

Check container status and logs:

```bash
docker compose logs -f
```

## Environment Variables

| Variable | Default | Allowed Values | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | `7000` | Any valid port number | HTTP port where the addon server listens. |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` | Minimum logging level output to stdout. |
| `NODE_ENV` | `production` (in container) | `production`, `development` | Node execution environment. |

## Local Docker Testing (Contributors)

When testing local container builds from source:

```bash
# Validate compose configuration
npm run docker:build:check

# Build image locally (includes build info generation)
npm run docker:build

# Launch local image
npm run docker:run:up

# Inspect logs
npm run docker:run:logs

# Stop container
npm run docker:run:down
```
