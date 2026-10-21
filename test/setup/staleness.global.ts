// Vitest globalSetup — runs exactly once per test run (not per test file).
// Prints the examples/ staleness warning if the data has gone stale.
// Warning-only: never fails the run.
import { warnOnStaleExamples } from './staleness.js';

export default function setup(): void {
  warnOnStaleExamples();
}
