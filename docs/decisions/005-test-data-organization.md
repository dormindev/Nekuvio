# Decision 005: Test Data Organization

**Status:** Accepted  
**Date:** 2026-10-19

## Context

`test/data/` grew organically across four context folders with no durable record of which endpoint each payload exercises, which ids/params were used, or which code paths each case grounds. The step 03 audit surfaced three integrity problems:

1. **`fileIdx` contract mismatch:** `matcher.ts` `findEpisodeFile` returns an index over the **video-only filtered** file array, but `streamBuilder.ts:57` stores it as `NuvioStream.fileIdx` as though it indexes the **original** `torrent.files` array. Verified live mismatch: `series-kitsu_3919_1` → torrent `9087447179017` (`fileIdx=48` points at a non-video `.7z` in the original array but at `Bakemonogatari - 01.mkv` in the filtered array). Movies use `findMovieFile` over the original array and are unaffected.
2. **Three orphan payloads** with no matching record in their folder's `meta.json`: `examples/kitsu-mappings/452.json`, `examples/nekobt-search/s172-220939_220940.json`, `examples/nekobt-search/s193-5015_5016.json`.
3. **Empty unsupported self-stream fixture:** `test/data/unsupported/self-stream/meta.json` held `records: []` with no confirmed-broken self-stream case — until live re-verification during step 04 confirmed the `fileIdx` bug above (and two more unsupported cases: `series-kitsu_46598_11`, `series-kitsu_42279_1`).

`docs/data-catalog.md` is the evidence base: one entry per endpoint, each with `endpoint`, `ids observed`, `params`, `last verified`, `location`, `edge`, `grounds`, `motivated change`.

## Decision

Organize `test/data/` as follows and record it in the data catalog:

1. **Context folders stay.** `fixtures/` (canonical, immutable), `examples/` (observed, refreshable), `unsupported/` (known-broken), `synthetic/` (assumed-unverified). Standing is declared by folder placement, not a status field.
2. **`docs/data-catalog.md` is the source of truth** for payload-to-endpoint mapping, ids/params, edges, and groundedness. Every example entry carries `last verified` + exact `params` so drift is detectable by re-run, not guessing.
3. **The three orphan payloads are registered** — each got a `meta.json` record with its params and grounds.
4. **`fileIdx` is a known bug → unsupported** (no source patch in this step); `series-kitsu_3919_1` moved to `unsupported/self-stream/` with a record documenting the mismatch, plus two more confirmed-broken cases (`series-kitsu_46598_11`, `series-kitsu_42279_1`), each with a live-captured payload. Fix deferred to step 05.

## Rationale

- **No new abstractions** (project rule): reuse the `meta.json` registry + folder contexts, not a new manifest format.
- **Known-broken transparency:** the `fileIdx` mismatch and unsupported cases are recorded as open decisions, so step 05 can add regression coverage against real evidence.

## Limitations

- **Manual refresh cadence:** `last verified` dates and re-fetch params are recorded, but the refresh/compare tooling lands in step 05 — until then, drift detection is a manual re-run.
- **Unsupported-case xfail discipline:** the three `unsupported/` records document known-broken behavior with live-captured payloads; nothing yet enforces that tests treat them as expected failures rather than silently passing.
