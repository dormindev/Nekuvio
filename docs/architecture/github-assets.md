# GitHub-Hosted Assets

Nekuvio uses assets hosted in the GitHub repository, such as images and other externally accessible resources.

These assets need to be referenced using a GitHub revision that is known to exist remotely. The application therefore determines the appropriate GitHub revision during the build process and stores the result in generated source code.

## Why the Revision Is Generated During the Build

The production Docker image does not contain the Git repository.

This is intentional:

* the production image does not need Git;
* the `.git` directory is not required at runtime;
* the runtime application should not need to execute Git commands;
* the resulting image contains only the application and its runtime dependencies.

Because of this, Git-dependent information is resolved before the application is compiled.

The build flow is:

```text
Git repository
      │
      ▼
npm run build:prepare
      │
      ▼
src/generated/build-info.ts
      │
      ▼
npm run build:compile
      │
      ▼
dist/
      │
      ▼
Production Docker image
```

The generated file is:

```text
src/generated/build-info.ts
```

It is imported by `src/environment.ts`.

## Build Metadata

The generated build information currently contains:

```ts
{
    githubRef,
    assetsURL
}
```

The application exposes these through:

```ts
env.external.githubRef
env.external.assetsURL
```

This keeps external GitHub information separate from application identity and runtime configuration.

The environment structure is:

```text
env
├── app
│   ├── name
│   ├── displayName
│   ├── version
│   └── addonId
│
├── external
│   ├── githubRef
│   └── assetsURL
│
└── runtime
```

Application metadata comes from `package.json`, while the GitHub-specific values are generated during the build.

## Determining `githubRef`

The build script is:

```text
scripts/generate-build-info.ts
```

It behaves differently in CI and local development.

### CI

When the `CI` environment variable is present, the build uses:

```text
GITHUB_REF
```

directly.

For example, a release workflow triggered by a tag may provide:

```text
refs/tags/v0.1.0
```

That value becomes the GitHub revision used for the generated asset URL.

The script intentionally fails if `CI` is set but `GITHUB_REF` is unavailable.

### Local Development

Local development does not have `GITHUB_REF`, so the script determines a suitable revision from the Git repository.

It:

1. Reads the current `HEAD`.
2. Finds the available `origin` remote-tracking references.
3. Resolves those references to commits.
4. Keeps references whose commits are ancestors of the current `HEAD`.
5. Removes duplicate commit IDs.
6. Selects the closest matching candidate to the current `HEAD`.

The script does not perform a Git fetch.

This means local builds use information already available in the local repository. If the required remote-tracking information is stale or missing, the build can fail rather than silently inventing a revision.

## Asset URL

The repository URL is read from `package.json`.

The generated base URL has the form:

```text
https://raw.githubusercontent.com/<owner>/<repository>/<githubRef>
```

Application code can then construct asset URLs from this base:

```ts
`${env.external.assetsURL}/assets/logo-small.png`
```

This avoids hardcoding a development branch such as:

```text
refs/heads/development
```

into application code.

## Important Assumption

The selected GitHub revision must contain the assets being referenced.

For example, if the generated value is:

```text
refs/tags/v0.1.0
```

then an asset referenced through:

```text
https://raw.githubusercontent.com/dormindev/Nekuvio/refs/tags/v0.1.0/...
```

must exist in the repository at that tag.

This is particularly important for release builds. A release tag should therefore point to a repository state containing all assets required by that release.

## Docker Builds

A local Docker build is invoked through:

```bash
npm run docker:build
```

This first runs:

```bash
npm run build:prepare
```

on the host, where the Git repository is available.

Docker then builds the application using:

```bash
npm run build:compile
```

inside the builder stage.

The Docker builder therefore receives the already-generated:

```text
src/generated/build-info.ts
```

and does not need to execute Git.

The production image similarly contains the generated application output but does not contain the repository's Git metadata.

## Release Builds

The intended CI flow is:

```text
GitHub tag
    │
    ▼
GITHUB_REF
    │
    ▼
build:prepare
    │
    ▼
githubRef = release tag
    │
    ▼
build:compile
    │
    ▼
Docker image
    │
    ▼
nekuvio:<tag>
```

For example:

```text
v0.1.0
```

produces an image tagged:

```text
nekuvio:v0.1.0
```

The exact registry name used when publishing the image is handled by the CI workflow rather than being embedded into the application's build metadata.
