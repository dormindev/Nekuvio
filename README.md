# Nekuvio

Nekuvio is a [Nuvio](https://github.com/tapframe/Nuvio) addon to be a bridge to [NekoBT](https://www.nekobt.to/).


## Development

### Requirements

* Node.js `^26`
* npm `^11`

Clone the repository with its required submodules:

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

For development with automatic source reloading:

```bash
npm run dev:info
```

Debug logging is also available:

```bash
npm run dev:debug
```

## Docker

A Docker setup is provided for running Nekuvio as a container.

```bash
npm run docker:build
npm run docker:up
```

To view logs:

```bash
npm run docker:logs
```

Stop the container with:

```bash
npm run docker:down
```

## Documentation

Technical architecture and implementation decisions are documented in [`docs/`](docs/).

* [GitHub-hosted assets and build metadata](docs/architecture/github-assets.md)
