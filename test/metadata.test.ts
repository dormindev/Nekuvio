import { describe, expect, it } from 'vitest';

import { encodeNekobtMetadata } from '../src/generated/nekobt-metadata.js';


describe('encodeNekobtMetadata', () => {
  const START_MARKER = '\u2060';
  const END_MARKER = '\u034f';

  it('returns empty string for null, undefined, or empty metadata', () => {
    expect(encodeNekobtMetadata(null)).toBe('');
    expect(encodeNekobtMetadata(undefined)).toBe('');
    expect(encodeNekobtMetadata({})).toBe('');
  });

  it('skips subLevel when value is -1', () => {
    expect(encodeNekobtMetadata({ subLevel: -1 })).toBe('');
  });

  it('encodes subLevel when value is non-negative integer', () => {
    const encoded = encodeNekobtMetadata({ subLevel: 1 });
    expect(encoded.length).toBeGreaterThan(0);
    expect(encoded.startsWith(START_MARKER)).toBe(true);
    expect(encoded.endsWith(END_MARKER)).toBe(true);
  });

  it('encodes boolean flags (mtl, otl, hardsubs, batch) only when true', () => {
    expect(encodeNekobtMetadata({ mtl: false })).toBe('');
    expect(encodeNekobtMetadata({ mtl: null })).toBe('');

    const encodedMtl = encodeNekobtMetadata({ mtl: true });
    expect(encodedMtl.length).toBeGreaterThan(0);
    expect(encodedMtl.startsWith(START_MARKER)).toBe(true);
    expect(encodedMtl.endsWith(END_MARKER)).toBe(true);

    const encodedOtl = encodeNekobtMetadata({ otl: true });
    expect(encodedOtl.length).toBeGreaterThan(0);

    const encodedBatch = encodeNekobtMetadata({ batch: true });
    expect(encodedBatch.length).toBeGreaterThan(0);
  });

  it('encodes numeric fields (videoType, videoCodec)', () => {
    const encoded = encodeNekobtMetadata({
      videoType: 1,
      videoCodec: 2
    });
    expect(encoded.length).toBeGreaterThan(0);
    expect(encoded.includes(START_MARKER)).toBe(true);
    expect(encoded.includes(END_MARKER)).toBe(true);
  });

  it('combines multiple metadata fields into consecutive badge sequences', () => {
    const combined = encodeNekobtMetadata({
      subLevel: 2,
      mtl: true,
      batch: true,
      videoCodec: 1
    });

    expect(combined.length).toBeGreaterThan(0);
    // Should contain 4 badge sequences (4 start and 4 end markers)
    const startCount = combined.split(START_MARKER).length - 1;
    const endCount = combined.split(END_MARKER).length - 1;
    expect(startCount).toBe(4);
    expect(endCount).toBe(4);
  });

  it('skips numeric fields whose value exceeds the field width', () => {
    // videoType has width 3 (max 4^3 - 1 = 63), so 100 cannot be encoded.
    expect(encodeNekobtMetadata({ videoType: 100 })).toBe('');
  });

  it('skips numeric fields with negative or non-integer values', () => {
    expect(encodeNekobtMetadata({ videoCodec: -1 })).toBe('');
    expect(encodeNekobtMetadata({ videoCodec: 1.5 })).toBe('');
    expect(encodeNekobtMetadata({ subLevel: 2.5 })).toBe('');
  });

  it('ignores unknown field keys', () => {
    expect(encodeNekobtMetadata({ notARealField: 5 } as any)).toBe('');
  });
});
