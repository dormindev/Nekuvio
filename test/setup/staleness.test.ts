import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  warnOnStaleExamples,
  oldestFetchedDate,
  resolveThresholdDays,
} from './staleness.js';

describe('staleness', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'staleness-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function makeExamplesDir(fetched: string | null, endpoint = 'samples'): string {
    const endpointDir = path.join(tmp, endpoint);
    fs.mkdirSync(endpointDir, { recursive: true });
    fs.writeFileSync(
      path.join(endpointDir, 'meta.json'),
      JSON.stringify({
        records: [{ id: 'r1', params: {}, fetched, grounds: 'test' }],
      }),
    );
    return tmp;
  }

  it('oldestFetchedDate returns null when every fetched is null (behavior snapshot)', () => {
    makeExamplesDir(null);
    expect(oldestFetchedDate(tmp)).toBeNull();
  });

  it('oldestFetchedDate picks the OLDEST record, not the newest', () => {
    const old = path.join(tmp, 'old-endpoint');
    fs.mkdirSync(old, { recursive: true });
    fs.writeFileSync(
      path.join(old, 'meta.json'),
      JSON.stringify({ records: [{ id: 'old', fetched: '2020-01-01' }] }),
    );
    const fresh = path.join(tmp, 'fresh-endpoint');
    fs.mkdirSync(fresh, { recursive: true });
    fs.writeFileSync(
      path.join(fresh, 'meta.json'),
      JSON.stringify({ records: [{ id: 'new', fetched: new Date().toISOString().split('T')[0] }] }),
    );

    const hit = oldestFetchedDate(tmp);
    expect(hit?.endpoint).toBe('old-endpoint');
    expect(hit?.id).toBe('old');
  });

  it('warns when the fetched date exceeds the threshold', () => {
    makeExamplesDir('2020-01-01');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnOnStaleExamples(tmp, 1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[staleness]'));
  });

  it('does not warn when the fetched date is within the threshold', () => {
    const today = new Date().toISOString().split('T')[0];
    makeExamplesDir(today);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnOnStaleExamples(tmp, 14);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does not warn when examples dir does not exist', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => warnOnStaleExamples(path.join(tmp, 'nonexistent'), 1)).not.toThrow();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('never throws and never fails when the data is stale (warning-only contract)', () => {
    makeExamplesDir('2020-01-01');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => warnOnStaleExamples(tmp, 1)).not.toThrow();
    // Warning emitted, but no error is thrown that could fail a test run.
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('resolveThresholdDays falls back to the default for invalid values', () => {
    expect(resolveThresholdDays({})).toBe(14);
    expect(resolveThresholdDays({ STALENESS_DAYS: '' })).toBe(14);
    expect(resolveThresholdDays({ STALENESS_DAYS: 'abc' })).toBe(14);
    expect(resolveThresholdDays({ STALENESS_DAYS: '-5' })).toBe(14);
    expect(resolveThresholdDays({ STALENESS_DAYS: '30' })).toBe(30);
    expect(resolveThresholdDays({ STALENESS_DAYS: '0' })).toBe(0);
  });
});

