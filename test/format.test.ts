import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatBytes,
  formatAverageBitrate,
  formatLanguages,
  formatLanguageFlags
} from '../src/utils/format.js';

describe('formatBytes', () => {
  it('returns null for invalid or negative values', () => {
    assert.equal(formatBytes(null), null);
    assert.equal(formatBytes(undefined), null);
    assert.equal(formatBytes(''), null);
    assert.equal(formatBytes('not-a-number'), null);
    assert.equal(formatBytes(-100), null);
  });

  it('formats 0 bytes correctly', () => {
    assert.equal(formatBytes(0), '0 B');
    assert.equal(formatBytes('0'), '0 B');
  });

  it('formats bytes correctly with 0 decimals', () => {
    assert.equal(formatBytes(500), '500 B');
  });

  it('formats kilobytes correctly with 0 decimals', () => {
    assert.equal(formatBytes(1024), '1 KB');
    assert.equal(formatBytes(2048), '2 KB');
  });

  it('formats megabytes correctly with 0 decimals', () => {
    assert.equal(formatBytes(1024 * 1024 * 345), '345 MB');
    assert.equal(formatBytes(292935189), '279 MB');
  });

  it('formats gigabytes correctly with 1 decimal', () => {
    assert.equal(formatBytes(1024 * 1024 * 1024 * 1.5), '1.5 GB');
    assert.equal(formatBytes(1500336817), '1.4 GB');
  });

  it('formats terabytes correctly with 2 decimals', () => {
    assert.equal(formatBytes(1024 * 1024 * 1024 * 1024 * 2.5), '2.50 TB');
  });
});

describe('formatAverageBitrate', () => {
  const bytes = 292935189; // ~279 MB
  const duration = 24; // 24 minutes

  it('calculates and formats bitrate with Both units by default', () => {
    const formatted = formatAverageBitrate(bytes, duration);
    assert.equal(formatted, '1.63 Mbps  0.20 MB/s');
  });

  it('formats bitrate in Mbps only', () => {
    const formatted = formatAverageBitrate(bytes, duration, 'Mbps');
    assert.equal(formatted, '1.63 Mbps');
  });

  it('formats bitrate in MB/s only', () => {
    const formatted = formatAverageBitrate(bytes, duration, 'MB/s');
    assert.equal(formatted, '0.20 MB/s');
  });

  it('returns null for invalid bytes or duration', () => {
    assert.equal(formatAverageBitrate(null, 24), null);
    assert.equal(formatAverageBitrate(undefined, 24), null);
    assert.equal(formatAverageBitrate(-100, 24), null);
    assert.equal(formatAverageBitrate(bytes, null), null);
    assert.equal(formatAverageBitrate(bytes, undefined), null);
    assert.equal(formatAverageBitrate(bytes, 0), null);
    assert.equal(formatAverageBitrate(bytes, -5), null);
    assert.equal(formatAverageBitrate(bytes, NaN), null);
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

describe('formatLanguageFlags', () => {
  it('formats single language flag', () => {
    assert.equal(formatLanguageFlags('ja'), '🇯🇵');
    assert.equal(formatLanguageFlags('en'), '🇬🇧');
  });

  it('formats multiple language flags with default separator', () => {
    assert.equal(formatLanguageFlags('ja, en, fr-fr'), '🇯🇵🇬🇧🇫🇷');
  });

  it('formats multiple language flags with custom separator', () => {
    assert.equal(formatLanguageFlags('ja, en, es-es', ' '), '🇯🇵 🇬🇧 🇪🇸');
  });

  it('handles spaces and trims language tokens', () => {
    assert.equal(formatLanguageFlags(' ja ,  es-419 '), '🇯🇵🇲🇽');
  });

  it('returns null for null, undefined, or empty string', () => {
    assert.equal(formatLanguageFlags(null), null);
    assert.equal(formatLanguageFlags(undefined), null);
    assert.equal(formatLanguageFlags(''), null);
  });

  it('returns null if no recognized language flags are matched', () => {
    assert.equal(formatLanguageFlags('xyz, unknown'), null);
  });

  it('filters out unknown language codes while retaining valid flags', () => {
    assert.equal(formatLanguageFlags('ja, unknown_lang, en'), '🇯🇵🇬🇧');
  });
});
