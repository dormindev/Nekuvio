#!/usr/bin/env bash
set -euo pipefail

: "${RELEASE_TAG:?RELEASE_TAG must be set}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY must be set}"
: "${GITHUB_OUTPUT:?GITHUB_OUTPUT must be set}"
: "${GH_TOKEN:?GH_TOKEN must be set}"

NOTES_DIR="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
NOTES_FILE="$NOTES_DIR/nekuvio-release-notes.md"
DIRECT_COMMITS_FILE="$(mktemp)"
trap 'rm -f "$DIRECT_COMMITS_FILE"' EXIT

# Custom notes are prepended to GitHub's generated pull-request notes.
printf '%s\n' \
    '## Docker image' \
    '' \
    "- Versioned image: \`ghcr.io/dormindev/nekuvio:${RELEASE_TAG}\`" \
    '- Latest alias: `ghcr.io/dormindev/nekuvio:latest`' \
    '' \
    'Pull this version with:' \
    '' \
    '```bash' \
    "docker pull ghcr.io/dormindev/nekuvio:${RELEASE_TAG}" \
    '```' \
    '' \
    'Supported platforms: `linux/amd64`, `linux/arm64`' \
    '' > "$NOTES_FILE"

# Use only commits since the previous stable release, or all mainline history
# for the first release.
if [[ -n "${PREVIOUS_TAG:-}" ]]; then
    COMMIT_RANGE="${PREVIOUS_TAG}..${RELEASE_TAG}"
else
    COMMIT_RANGE="$RELEASE_TAG"
fi

# Collect direct mainline commits, excluding commits already represented by PRs.
while IFS=$'\t' read -r COMMIT_SHA SUBJECT; do
    [[ -n "$COMMIT_SHA" ]] || continue

    HAS_MERGED_PR="$(
        gh api \
            "/repos/${GITHUB_REPOSITORY}/commits/${COMMIT_SHA}/pulls" \
            --jq 'any(.[]; .base.ref == "main" and .merged_at != null)'
    )"

    if [[ "$HAS_MERGED_PR" == "true" ]]; then
        continue
    fi

    COMMIT_JSON="$(gh api "/repos/${GITHUB_REPOSITORY}/commits/${COMMIT_SHA}")"
    AUTHOR_LOGIN="$(jq -r '.author.login // empty' <<< "$COMMIT_JSON")"
    AUTHOR_NAME="$(jq -r '.commit.author.name // "unknown author"' <<< "$COMMIT_JSON")"
    COMMIT_URL="$(jq -r '.html_url' <<< "$COMMIT_JSON")"
    SHORT_SHA="${COMMIT_SHA:0:7}"

    if [[ -n "$AUTHOR_LOGIN" ]]; then
        AUTHOR="[**@${AUTHOR_LOGIN}**](https://github.com/${AUTHOR_LOGIN})"
    else
        AUTHOR="**${AUTHOR_NAME}**"
    fi

    printf -- '- %s by %s in [`%s`](%s)\n' \
        "$SUBJECT" "$AUTHOR" "$SHORT_SHA" "$COMMIT_URL" \
        >> "$DIRECT_COMMITS_FILE"
done < <(
    git log \
        --first-parent \
        --no-merges \
        --format='%H%x09%s' \
        "$COMMIT_RANGE"
)

if [[ -s "$DIRECT_COMMITS_FILE" ]]; then
    printf '\n%s\n\n' '## Direct commits to `main`' >> "$NOTES_FILE"
    cat "$DIRECT_COMMITS_FILE" >> "$NOTES_FILE"
    printf '\n' >> "$NOTES_FILE"
fi

echo "notes_file=$NOTES_FILE" >> "$GITHUB_OUTPUT"
echo "Generated custom release notes at $NOTES_FILE"
