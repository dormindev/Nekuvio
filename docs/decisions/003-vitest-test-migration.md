# Decision 003: Vitest Test Suite Migration and Coverage Analysis

**Status:** Accepted  
**Date:** 2026-10-12

## Context

Nekuvio previously relied on Node's native test runner (`node:test`) executed via `tsx` (`node --import tsx --test "test/**/*.test.ts"`).

As Nekuvio grew, two key engineering needs arose:
1. **Accurate code coverage metrics**: As an addon that deals with multiple external APIs (NekoBT REST, Kitsu mappings, BitTorrent tracker swarms), we needed visibility into which execution branches and fallback strategies were covered.
2. **Robust mocking capabilities**: Interacting with external tracker swarms and metadata endpoints requires clean module mocking (`vi.mock()`, `vi.spyOn()`, `vi.fn()`) and integration with authentic fixtures from `test/fixtures/`.

When evaluating how to introduce code coverage, the team considered adding `c8` / `@bcoe/v8-coverage` to the existing `node --test` + `tsx` harness. However, this introduced fragmented tooling, separate config layers, and brittle TypeScript path mapping.

## Decision

Migrate the test suite from `node:test` + `tsx` to **Vitest** with `@vitest/coverage-v8`.

### Core Implementations:
- **Test Runner**: Vitest (`vitest`) running directly on ESM and TypeScript.
- **Coverage Provider**: V8 coverage (`@vitest/coverage-v8`), configured to generate:
  - `text`: immediate summary in terminal output
  - `lcov`: lcov reports for CI/code quality tools
  - `json-summary`: machine-readable coverage metrics at `coverage/coverage-summary.json`
- **Mocking Strategy**: Use Vitest's built-in `vi` mocking capabilities (`vi.mock('node-fetch')`, `vi.mock('bittorrent-tracker')`, `vi.fn()`) alongside authentic local fixtures (`test/fixtures/*.json`).
- **NPM Scripts**:
  - `npm test`: runs `vitest`
  - `npm run test:coverage`: runs `vitest run --coverage` in single-pass mode.

## Rationale

1. **Integrated Tooling**: Vitest bundles fast TypeScript execution, snapshotting, assertion libraries (`expect`), and mock utilities (`vi`) without needing extra glue scripts.
2. **Native V8 Coverage**: Rather than retrofitting `c8`, Vitest's official `@vitest/coverage-v8` integrates directly into the test lifecycle and outputs required summaries (including `coverage/coverage-summary.json`).
3. **Symlink and Submodule Compatibility**: Vitest's `resolve.preserveSymlinks: true` seamlessly resolves submodules and symlinked generated code (e.g., `src/generated/nekobt-metadata.ts`).
4. **Speed and Developer Experience**: Instant feedback in watch mode and sub-second test execution across all units.
