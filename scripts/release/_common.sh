#!/usr/bin/env bash

is_release_tag() {
    local num="(0|[1-9][0-9]*)"
    local regex="^v${num}\\.${num}\\.${num}$"

    [[ "$1" =~ $regex ]]
}

# Finds the most recent valid release tag on the first-parent chain.
# Usage: find_latest_valid_release <start_ref>
# Returns 0 on success and sets $RET_TAG and $RET_COMMIT.
# Returns 1 when no valid release exists in the searched history.
# Returns 2 when a Git operation fails.
find_latest_valid_release() {
    local search_target="$1"
    local candidate_tag
    local candidate_commit

    # Clear return variables just in case
    RET_TAG=""
    RET_COMMIT=""

    while true; do
        candidate_tag="$(
            git describe --tags --abbrev=0 --first-parent --always \
                --match 'v[0-9]*.[0-9]*.[0-9]*' \
                --exclude 'v*[!0-9.]*' \
                "$search_target" 2>/dev/null
        )" || return 2

        # --always returns a commit ID when no matching tag exists.
        if [[ "$candidate_tag" != v* ]]; then
            return 1
        fi

        candidate_commit="$(
            git rev-parse --verify "${candidate_tag}^{commit}" 2>/dev/null
        )" || return 2

        tags_on_commit="$(
            git tag --points-at "$candidate_commit" --sort=-version:refname
        )" || return 2

        while IFS= read -r tag; do
            if is_release_tag "$tag"; then
                # Set the global return variables and exit successfully
                RET_TAG="$tag"
                RET_COMMIT="$candidate_commit"
                return 0
            fi
        done <<< "$tags_on_commit"
        
        # No valid stable release tag on this commit; shift target to its parent.
        parent_line="$(git rev-list --parents -n 1 "$candidate_commit")" || return 2
        read -r -a commit_fields <<< "$parent_line"

        # A root commit has no parent: no earlier release exists.
        if [[ "${#commit_fields[@]}" -eq 1 ]]; then
            return 1
        fi

        search_target="${commit_fields[1]}"
    done
}