import { describe, it, expect } from 'vitest';
import {
  formatBytes,
  formatAverageBitrate,
  formatLanguages,
  formatLanguageFlags,
  formatTimestamp
} from '../src/utils/format.js';

describe('formatBytes', () => {
  it('returns null for invalid or negative values', () => {
    expect(formatBytes(null)).toBeNull();
    expect(formatBytes(undefined)).toBeNull();
    expect(formatBytes('')).toBeNull();
    expect(formatBytes('not-a-number')).toBeNull();
    expect(formatBytes(-100)).toBeNull();
  });

  it('formats 0 bytes correctly', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes('0')).toBe('0 B');
  });

  it('formats bytes correctly with 0 decimals', () => {
    expect(formatBytes(500)).toBe('500 B');
  });

  it('formats kilobytes correctly with 0 decimals', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(2048)).toBe('2 KB');
  });

  it('formats megabytes correctly with 0 decimals', () => {
    expect(formatBytes(1024 * 1024 * 345)).toBe('345 MB');
    expect(formatBytes(292935189)).toBe('279 MB');
  });

  it('formats gigabytes correctly with 1 decimal', () => {
    expect(formatBytes(1024 * 1024 * 1024 * 1.5)).toBe('1.5 GB');
    expect(formatBytes(1500336817)).toBe('1.4 GB');
  });

  it('formats terabytes correctly with 2 decimals', () => {
    expect(formatBytes(1024 * 1024 * 1024 * 1024 * 2.5)).toBe('2.50 TB');
  });
});

describe('formatAverageBitrate', () => {
  const bytes = 292935189; // ~279 MB
  const duration = 24; // 24 minutes

  it('calculates and formats bitrate with Both units by default', () => {
    const formatted = formatAverageBitrate(bytes, duration);
    expect(formatted).toBe('1.63 Mbps  0.20 MB/s');
  });

  it('formats bitrate in Mbps only', () => {
    const formatted = formatAverageBitrate(bytes, duration, 'Mbps');
    expect(formatted).toBe('1.63 Mbps');
  });

  it('formats bitrate in MB/s only', () => {
    const formatted = formatAverageBitrate(bytes, duration, 'MB/s');
    expect(formatted).toBe('0.20 MB/s');
  });

  it('returns null for invalid bytes or duration', () => {
    expect(formatAverageBitrate(null, 24)).toBeNull();
    expect(formatAverageBitrate(undefined, 24)).toBeNull();
    expect(formatAverageBitrate(-100, 24)).toBeNull();
    expect(formatAverageBitrate(bytes, null)).toBeNull();
    expect(formatAverageBitrate(bytes, undefined)).toBeNull();
    expect(formatAverageBitrate(bytes, 0)).toBeNull();
    expect(formatAverageBitrate(bytes, -5)).toBeNull();
    expect(formatAverageBitrate(bytes, NaN)).toBeNull();
  });
});

describe('formatLanguages', () => {
  it('formats single audio language when no subtitles are present', () => {
    const torrent = { audio_lang: 'ja' };
    expect(formatLanguages(torrent)).toBe('JA');
  });

  it('formats multiple audio and subtitle languages and deduplicates them', () => {
    const torrent = {
      audio_lang: 'ja, en',
      fsub_lang: 'en, es-es',
      sub_lang: 'fr-fr, ja'
    };
    expect(formatLanguages(torrent)).toBe('JA, EN, ES-ES, FR-FR');
  });

  it('handles empty or missing language properties by returning RAW', () => {
    expect(formatLanguages({})).toBe('RAW');
    expect(formatLanguages({ audio_lang: '', sub_lang: '' })).toBe('RAW');
  });

  it('returns RAW when language strings contain only separators', () => {
    expect(formatLanguages({ audio_lang: ',' })).toBe('RAW');
    expect(formatLanguages({ audio_lang: ' , , ', sub_lang: ' , ' })).toBe('RAW');
  });

  it('handles spaces and trims tokens properly', () => {
    const torrent = {
      audio_lang: ' ja ,  en ',
      sub_lang: 'es-419 , it '
    };
    expect(formatLanguages(torrent)).toBe('JA, EN, ES-419, IT');
  });
});

describe('formatLanguageFlags', () => {
  it('formats single language flag', () => {
    expect(formatLanguageFlags('ja')).toBe('🇯🇵');
    expect(formatLanguageFlags('en')).toBe('🇬🇧');
  });

  it('formats multiple language flags with default separator', () => {
    expect(formatLanguageFlags('ja, en, fr-fr')).toBe('🇯🇵🇬🇧🇫🇷');
  });

  it('formats multiple language flags with custom separator', () => {
    expect(formatLanguageFlags('ja, en, es-es', ' ')).toBe('🇯🇵 🇬🇧 🇪🇸');
  });

  it('handles spaces and trims language tokens', () => {
    expect(formatLanguageFlags(' ja ,  es-419 ')).toBe('🇯🇵🇲🇽');
  });

  it('returns null for null, undefined, or empty string', () => {
    expect(formatLanguageFlags(null)).toBeNull();
    expect(formatLanguageFlags(undefined)).toBeNull();
    expect(formatLanguageFlags('')).toBeNull();
  });

  it('returns null if no recognized language flags are matched', () => {
    expect(formatLanguageFlags('xyz, unknown')).toBeNull();
  });

  it('filters out unknown language codes while retaining valid flags', () => {
    expect(formatLanguageFlags('ja, unknown_lang, en')).toBe('🇯🇵🇬🇧');
  });
});

describe('formatTimestamp', () => {
  it('appends the time for recent timestamps', () => {
    const formatted = formatTimestamp(Date.now());
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('omits the time for timestamps older than yesterday', () => {
    const formatted = formatTimestamp(0);
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('honours an explicit timezone', () => {
    const formatted = formatTimestamp(Date.now(), 'UTC');
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });
});
