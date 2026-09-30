import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { encodeNekobtMetadata } from '../src/generated/nekobt-metadata.js';

describe('encodeNekobtMetadata', () => {
  const START_MARKER = '\u2060';
  const END_MARKER = '\u034f';

  it('returns empty string for null, undefined, or empty metadata', () => {
    assert.equal(encodeNekobtMetadata(null), '');
    assert.equal(encodeNekobtMetadata(undefined), '');
    assert.equal(encodeNekobtMetadata({}), '');
  });

  it('skips subLevel when value is -1', () => {
    assert.equal(encodeNekobtMetadata({ subLevel: -1 }), '');
  });

  it('encodes subLevel when value is non-negative integer', () => {
    const encoded = encodeNekobtMetadata({ subLevel: 1 });
    assert.ok(encoded.length > 0);
    assert.ok(encoded.startsWith(START_MARKER));
    assert.ok(encoded.endsWith(END_MARKER));
  });

  it('encodes boolean flags (mtl, otl, hardsubs, batch) only when true', () => {
    assert.equal(encodeNekobtMetadata({ mtl: false }), '');
    assert.equal(encodeNekobtMetadata({ mtl: null }), '');

    const encodedMtl = encodeNekobtMetadata({ mtl: true });
    assert.ok(encodedMtl.length > 0);
    assert.ok(encodedMtl.startsWith(START_MARKER));
    assert.ok(encodedMtl.endsWith(END_MARKER));

    const encodedOtl = encodeNekobtMetadata({ otl: true });
    assert.ok(encodedOtl.length > 0);

    const encodedBatch = encodeNekobtMetadata({ batch: true });
    assert.ok(encodedBatch.length > 0);
  });

  it('encodes numeric fields (videoType, videoCodec)', () => {
    const encoded = encodeNekobtMetadata({
      videoType: 1,
      videoCodec: 2
    });
    assert.ok(encoded.length > 0);
    assert.ok(encoded.includes(START_MARKER));
    assert.ok(encoded.includes(END_MARKER));
  });

  it('combines multiple metadata fields into consecutive badge sequences', () => {
    const combined = encodeNekobtMetadata({
      subLevel: 2,
      mtl: true,
      batch: true,
      videoCodec: 1
    });

    assert.ok(combined.length > 0);
    // Should contain 4 badge sequences (4 start and 4 end markers)
    const startCount = combined.split(START_MARKER).length - 1;
    const endCount = combined.split(END_MARKER).length - 1;
    assert.equal(startCount, 4);
    assert.equal(endCount, 4);
  });
});
