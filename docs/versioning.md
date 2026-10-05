# Versioning

Nekuvio uses the version defined in `package.json` as the application's version.

## Application Version

The current version is defined by:

```json
{
  "version": "..."
}
```

in `package.json`.

Application code reads this value from the package metadata rather than maintaining a second application-version constant.

The package version therefore acts as the source of truth for the Nekuvio application version.

## Version Format

Nekuvio uses semantic versioning.

Release versions use the form:

```text
MAJOR.MINOR.PATCH
```

For example:

```text
0.1.0
```

The project is currently in the `0.x` development phase, so the public API and behavior may still change between minor releases.

## Git Tags

Released versions are represented by Git tags using the `v` prefix:

```text
v0.1.0
v0.2.0
v1.0.0
```

The Git tag identifies the exact repository revision from which the release is built.

This distinction is intentional:

```text
package.json version
        │
        ▼
     0.1.0
        │
        ▼
Git release tag
        │
        ▼
    v0.1.0
```

The package version does not contain the `v` prefix; the Git tag does.

## Build Metadata

The GitHub revision used by a build is separate from the application version.

During a tagged release build, the GitHub revision is expected to correspond to the release tag:

```text
package.json
version = 0.1.0

Git tag
v0.1.0

GitHub build reference
refs/tags/v0.1.0
```

This allows externally hosted assets to be resolved against the exact release revision.

See [GitHub-hosted assets and build metadata](architecture/github-assets.md).

## Docker Image Tags

Docker images use the Git tag's version without changing its meaning.

For example:

```text
Git tag:
v0.1.0

Docker image:
nekuvio:v0.1.0
```

The Compose configuration uses `IMAGE_TAG` to select the image tag:

```bash
IMAGE_TAG=v0.1.0 docker compose build
```

Local development defaults to:

```text
nekuvio:dev
```

The final registry name used when publishing an image is determined by the release/CI configuration.

## Release Artifacts

A release ties together:

* the application version in `package.json`;
* the corresponding Git tag;
* the source revision used for the build;
* the generated GitHub build metadata;
* the Docker image version.

The intended relationship is:

```text
package.json
version: 0.1.0
        │
        ▼
Git tag: v0.1.0
        │
        ├── build metadata
        │
        └── Docker image: nekuvio:v0.1.0
```

The exact GitHub Actions workflow for producing and publishing these artifacts is documented separately once the CI/CD process has been established.

## Development Builds

Development builds do not represent releases.

The local Docker configuration therefore uses:

```text
nekuvio:dev
```

unless `IMAGE_TAG` is explicitly supplied.

A development build should not be treated as an immutable release artifact.

## Version Changes

When preparing a release, the package version should be updated in `package.json` and the corresponding lockfile should remain consistent.

The release Git tag should then use the `v` prefix and exactly match the package version:

```text
package.json: 0.1.0
Git tag:       v0.1.0
```

Release automation should verify this relationship rather than relying solely on convention.
