#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_common.sh"

: "${RELEASE_TAG:?RELEASE_TAG must be set}"
: "${RELEASE_SHA:?RELEASE_SHA must be set}"


# 0. Cheap preliminary guard: reject commits not reachable from main.
if ! git merge-base --is-ancestor "$RELEASE_SHA" origin/main; then
    echo "Error: Tagged commit $RELEASE_SHA is not reachable from origin/main." >&2
    exit 1
fi


# 1. Validate the release tag's strict vX.Y.Z format.
if ! is_release_tag "$RELEASE_TAG"; then
    echo "Invalid release tag: $RELEASE_TAG" >&2
    exit 1
fi


# 2. Confirm that the tag resolves to the commit GitHub triggered this run for.
TAG_COMMIT="$(git rev-parse --verify "${RELEASE_TAG}^{commit}")"
if [[ "$TAG_COMMIT" != "$RELEASE_SHA" ]]; then
    echo "Tag $RELEASE_TAG resolves to $TAG_COMMIT, but this run references $RELEASE_SHA." >&2
    exit 1
fi


# 3. Ensure package.json version matches the tag.
TAG_VERSION="${RELEASE_TAG#v}"
PACKAGE_VERSION="$(node -p "JSON.parse(require('node:fs').readFileSync('package.json', 'utf8')).version")"

if [[ "$PACKAGE_VERSION" != "$TAG_VERSION" ]]; then
    echo "Tag version ($TAG_VERSION) does not match package.json version ($PACKAGE_VERSION)." >&2
    exit 1
fi


# 4. Require exactly one stable release tag on this commit
mapfile -t RELEASE_TAGS_ON_COMMIT < <(
    git tag --points-at "$RELEASE_SHA" --sort=-version:refname |
        while IFS= read -r tag; do
            if is_release_tag "$tag"; then
                printf '%s\n' "$tag"
            fi
        done
)

if [[ "${#RELEASE_TAGS_ON_COMMIT[@]}" -ne 1 ]]; then
    echo "Expected exactly one stable release tag on $RELEASE_SHA." >&2
    echo "Found: ${RELEASE_TAGS_ON_COMMIT[*]:-none}" >&2
    exit 1
fi


# 5. Require the tagged commit to be the absolute latest valid release 
#    on main's first-parent history.
if find_latest_valid_release "origin/main"; then
    :
else
    status=$?

    if [[ "$status" -ne 1 ]]; then
        echo "Error: Failed to search for the latest release tag." >&2
        exit "$status"
    fi

    echo "Error: Could not find any valid release tag in the first-parent history of origin/main." >&2
    exit 1
fi

if [[ "$RET_TAG" != "$RELEASE_TAG" ]]; then
    echo "Error: Tag $RELEASE_TAG is not the latest valid release on origin/main." >&2
    echo "The latest valid release is currently ${RET_TAG:-none} (at ${RET_COMMIT:-unknown})." >&2
    exit 1
fi


printf 'Verified release tag: %s\n' "$RELEASE_TAG"
printf 'Package version: %s\n' "$PACKAGE_VERSION"
printf 'Tagged commit: %s\n' "$RELEASE_SHA"
printf "Tagged commit is on main's first-parent history.\n"
