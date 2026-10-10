#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_common.sh"

: "${RELEASE_SHA:?RELEASE_SHA must be set}"
: "${GITHUB_OUTPUT:?GITHUB_OUTPUT must be set}"

# Default to empty
RET_TAG=""
RET_COMMIT=""

# Inspect the release commit and its parents.
COMMIT_LINE="$(git rev-list --parents -n 1 "$RELEASE_SHA")" || {
    echo "Error: Cannot inspect release commit $RELEASE_SHA." >&2
    exit 2
}

read -r -a COMMIT_FIELDS <<< "$COMMIT_LINE"

if [[ "${#COMMIT_FIELDS[@]}" -eq 1 ]]; then
    # The release commit is the root commit; there is no earlier history.
    echo "No previous stable release found; treating as the first release."
else
    # Search from the first parent to preserve mainline history.
    FIRST_PARENT="${COMMIT_FIELDS[1]}"

    if find_latest_valid_release "$FIRST_PARENT"; then
        echo "Previous release: $RET_TAG at $RET_COMMIT"
    else
        status=$?

        if [[ "$status" -eq 1 ]]; then
            echo "No previous stable release found; treating as the first release."
        else
            echo "Error: Failed to search for the previous stable release." >&2
            exit "$status"
        fi
    fi
fi

echo "previous_tag=$RET_TAG" >> "$GITHUB_OUTPUT"