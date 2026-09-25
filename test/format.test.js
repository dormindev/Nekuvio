import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatBytes, formatLanguages } from '../src/utils/format.js';

describe('formatBytes', () => {
  it('returns N/A for invalid or negative values', () => {
    assert.equal(formatBytes(null), '0 B'); // Number(null) is 0
    assert.equal(formatBytes(undefined), 'N/A');
    assert.equal(formatBytes('not-a-number'), 'N/A');
    assert.equal(formatBytes(-100), 'N/A');
  });

  it('formats 0 bytes correctly', () => {
    assert.equal(formatBytes(0), '0 B');
    assert.equal(formatBytes('0'), '0 B');
  });

  it('formats bytes correctly', () => {
    assert.equal(formatBytes(500), '500.00 B');
  });

  it('formats kilobytes correctly', () => {
    assert.equal(formatBytes(1024), '1.00 KB');
    assert.equal(formatBytes(2048), '2.00 KB');
  });

  it('formats megabytes correctly', () => {
    assert.equal(formatBytes(1024 * 1024 * 345), '345.00 MB');
    assert.equal(formatBytes(292935189), '279.36 MB');
  });

  it('formats gigabytes correctly', () => {
    assert.equal(formatBytes(1024 * 1024 * 1024 * 1.5), '1.50 GB');
    assert.equal(formatBytes(1500336817), '1.40 GB');
  });

  it('formats terabytes correctly', () => {
    assert.equal(formatBytes(1024 * 1024 * 1024 * 1024 * 2.5), '2.50 TB');
  });
});

describe('formatLanguages', () => {
  it('formats single audio language when no subtitles are present', () => {
    const torrent = { audio_lang: 'ja' };
    assert.equal(formatLanguages(torrent), 'JA');
  });

  it('formats multiple audio and subtitle languages and deduplicates them', () => {
    const torrent = {
      audio_lang: 'ja, en',
      fsub_lang: 'en, es-es',
      sub_lang: 'fr-fr, ja'
    };
    assert.equal(formatLanguages(torrent), 'JA, EN, ES-ES, FR-FR');
  });

  it('handles empty or missing language properties by returning RAW', () => {
    assert.equal(formatLanguages({}), 'RAW');
    assert.equal(formatLanguages({ audio_lang: '', sub_lang: '' }), 'RAW');
  });

  it('handles spaces and trims tokens properly', () => {
    const torrent = {
      audio_lang: ' ja ,  en ',
      sub_lang: 'es-419 , it '
    };
    assert.equal(formatLanguages(torrent), 'JA, EN, ES-419, IT');
  });
});
