# Development

This document describes how to build, test, run, and containerize Nekuvio during development.

## Requirements

Nekuvio currently targets:

* Node.js `^26`
* npm `^11`

The versions are defined in `package.json` through the `engines` field.

Docker development additionally requires Docker and Docker Compose.

## Repository Setup

Nekuvio includes the `nekuvio-badges` repository as a Git submodule.

The recommended clone command is:

```bash
git clone --recurse-submodules https://github.com/dormindev/Nekuvio.git
cd Nekuvio
```

If the repository has already been cloned without its submodules:

```bash
git submodule update --init --recursive
```

Install dependencies with:

```bash
npm ci
```

`npm ci` uses the committed `package-lock.json` and is therefore the preferred installation command for reproducible development and CI environments.

## Development Server

Nekuvio provides two development server commands.

### Informational logging

```bash
npm run start:dev:info
```

This runs the application directly from the TypeScript source with `tsx` watch mode and informational logging.

### Debug logging

```bash
npm run start:dev:debug
```

This uses the same watch-based development setup with debug logging enabled.

The development commands do not require a prior TypeScript compilation.

## Building

The complete build is:

```bash
npm run build
```

It consists of two explicit stages:

```text
build
 ├── build:prepare
 └── build:compile
```

### Build preparation

```bash
npm run build:prepare
```

This runs `scripts/generate-build-info.ts`.

The script determines the GitHub revision associated with the build and generates:

```text
src/generated/build-info.ts
```

The generated information is consumed by the application through `src/environment.ts`.

This stage requires access to the Git information needed by the generator. In CI, the GitHub Actions environment provides the relevant revision information.

See [GitHub-hosted assets and build metadata](github-assets.md) for the complete design.

### TypeScript compilation

```bash
npm run build:compile
```

This invokes TypeScript and writes the compiled application to:

```text
dist/
```

The compilation stage itself does not need to execute Git.

### Running the compiled application

After building:

```bash
npm start
```

This runs:

```text
dist/index.js
```

## Type Checking

Type checking without producing compiled output:

```bash
npm run build:check
```

This runs TypeScript with `--noEmit` over **the sources and the test suite** — the tests are type-checked by `test/tsconfig.json`, so a test that drifts from the types it exercises fails the check.

This is useful for development and CI checks where compilation output is not required.

## Tests

```bash
npm test              # watch/interactive (Vitest)
npm run test:coverage # single pass + V8 coverage → coverage/coverage-summary.json
npm run test:examples:refresh [-- --dry-run]   # re-fetch example payloads + fetched-dates
npm run test:fixtures:compare                  # always-live fixture comparison vs registry
npm run test:data:check                         # data-integrity checks over the catalog
```

The suite runs committed `test/data/` files only. The `npm run test:*` scripts keep that data honest — `test:data:check` validates the catalog itself (references, the shapes the code reads, the Kitsu vocabulary, the self-stream closure): `test:examples:refresh` re-fetches live example payloads (skips `self-stream` snapshots and `tracker-scrape`, which speaks UDP), `test:fixtures:compare` always fetches live and reports shape diffs for human triage without overwriting fixtures. A staleness warning (`test/setup/staleness.ts`, wired via vitest `globalSetup` so it prints once per run) fires at startup if the *oldest* example `fetched` date exceeds `STALENESS_DAYS` (default 14). `test:data:check` validates the catalog itself — every record has its payload and a reason, the folders refer to each other consistently, and the shapes the code reads are the shapes the API sends.

Layout, layers (UNIT vs INTEGRATION), and case studies: [`test/README.md`](../test/README.md). Evidence base: [`data-catalog.md`](data-catalog.md).

## Docker

The Docker setup uses a multi-stage build.

The builder stage compiles the TypeScript application, while the final image contains only what is required to run the application.

The normal local entry point is:

```bash
npm run docker:build
```

This first runs build preparation on the host:

```text
npm run build:prepare
```

and then invokes Docker Compose to build the image.

The separation is intentional. The build-preparation stage needs Git information, while the Docker build itself only needs the generated build metadata and TypeScript source.

### Starting the container

```bash
npm run docker:run:up
```

### Viewing logs

```bash
npm run docker:run:logs
```

### Stopping the container

```bash
npm run docker:run:down
```

## Docker Image Tags

The Compose configuration uses:

```text
nekuvio:${IMAGE_TAG:-dev}
```

Therefore, the default local image is:

```text
nekuvio:dev
```

A different tag can be supplied through `IMAGE_TAG`:

```bash
IMAGE_TAG=v0.1.0 docker compose build
```

which produces:

```text
nekuvio:v0.1.0
```

This allows local development and release builds to use the same Compose configuration while selecting different image tags.

The registry-specific image name is a CI/release concern and is not hardcoded into the Compose configuration.

## Build Targets

The npm scripts are the primary interface for common development operations.

| Command                         | Purpose                                                                 |
| ------------------------------- | ----------------------------------------------------------------------- |
| `npm run postinstall`           | Apply the patch-package patches after install                           |
| `npm run build`                 | Generate build metadata and compile the application                     |
| `npm run build:prepare`         | Generate GitHub-related build metadata                                  |
| `npm run build:compile`         | Compile TypeScript                                                      |
| `npm run build:check`           | Type-check the sources and the tests without emitting files             |
| `npm run test`                  | Run the test suite with Vitest                                          |
| `npm run test:coverage`         | Run the test suite once with V8 code coverage analysis                  |
| `npm run test:examples:refresh` | Re-fetch the example payloads and their fetched-dates                   |
| `npm run test:fixtures:compare` | Compare the fixtures against the live API (never writes)                |
| `npm run test:data:check`       | Check the catalog's internal consistency                                |
| `npm run benchmark`             | Run the pipeline benchmark                                              |
| `npm run start`                 | Run the compiled application                                            |
| `npm run start:dev:info`        | Run the TypeScript application in watch mode with informational logging |
| `npm run start:dev:debug`       | Run the TypeScript application in watch mode with debug logging         |
| `npm run docker:build`          | Prepare build metadata and build the Docker image                       |
| `npm run docker:build:check`    | Validate docker compose configuration                                   |
| `npm run docker:run:up`         | Start the Docker Compose service in background                          |
| `npm run docker:run:down`       | Stop the Docker Compose service                                         |
| `npm run docker:run:logs`       | Follow the Docker Compose logs                                          |

Keeping these operations behind npm scripts provides a consistent interface for developers and, later, for CI workflows.

## Generated Files

Some files are generated rather than edited directly.

In particular:

```text
src/generated/build-info.ts
```

is produced by `npm run build:prepare`.

The Nekobt metadata under `src/generated/` is maintained by the `nekuvio-badges` submodule and exposed through a symlink.

Generated files should therefore not be treated as ordinary hand-maintained application source.

See [Project Structure](project-structure.md) and [GitHub-hosted assets and build metadata](github-assets.md) for more detail.
