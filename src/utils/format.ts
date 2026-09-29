import { BitrateUnit, NekoTorrentItem } from '../types.js';
import { logger } from './logger.js';



function toFiniteBytes(
  bytes: number | string | null | undefined,
): number | null {
  if (bytes === null || bytes === undefined || bytes === '') {
    return null;
  }

  const value = Number(bytes);

  if (!Number.isFinite(value) || value < 0) {
    return null;
  }

  return value;
}

export function formatBytes(
  bytes: number | string | null | undefined,
): string | null {
  const value = toFiniteBytes(bytes);

  if (value === null) {
    return null;
  }

  if (value === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );

  const decimals = Math.max(0, index - 2);

  return `${(value / Math.pow(1024, index)).toFixed(decimals)} ${units[index]}`;
}

export function formatAverageBitrate(
  bytes: number | string | null | undefined,
  durationMinutes: number | null | undefined,
  unit: BitrateUnit = 'Both',
): string | null {
  const value = toFiniteBytes(bytes);

  if (
    value === null ||
    durationMinutes === null ||
    durationMinutes === undefined ||
    !Number.isFinite(durationMinutes) ||
    durationMinutes <= 0
  ) {
    return null;
  }

  const bitsPerSecond = (value * 8) / (durationMinutes * 60);

  const mbps = bitsPerSecond / 1_000_000
  const mb_s = bitsPerSecond / 8 / 1_000_000;

  switch (unit) {
    case 'Mbps': return `${mbps.toFixed(2)} Mbps`;
    case 'MB/s': return `${mb_s.toFixed(2)} MB/s`;
    case 'Both': return `${mbps.toFixed(2)} Mbps  ${mb_s.toFixed(2)} MB/s`;
  }
}


export function formatLanguages(torrent: Partial<NekoTorrentItem>): string {
  const audio = torrent.audio_lang || 'RAW';
  const fansub = torrent.fsub_lang || '';
  const sub = torrent.sub_lang || '';

  const languages = [
    ...new Set(
      [audio, fansub, sub]
        .filter(Boolean)
        .flatMap(lang =>
          lang.split(',')
            .map(v => v.trim())
            .filter(Boolean)
        )
    )
  ];

  return languages.length > 0 ? languages.join(', ').toUpperCase() : 'RAW';
}


const LANGUAGE_FLAGS: Record<string, string> = {
  'ja': '🇯🇵',
  'en': '🇬🇧',
  'enm': '｢:3｣',
  'af': '🇿🇦',
  'sq': '🇦🇱',
  'ar': '🇸🇦',
  'eu': '🇪🇸',
  'bn': '🇧🇩',
  'bs': '🇧🇦',
  'bg': '🇧🇬',
  'my': '🇲🇲',
  'yue': '🇭🇰',
  'ca': '🇪🇸',
  'zh-hans': '🇨🇳',
  'zh-hant': '🇹🇼',
  'hr': '🇭🇷',
  'cs': '🇨🇿',
  'da': '🇩🇰',
  'nl': '🇳🇱',
  'et': '🇪🇪',
  'fi': '🇫🇮',
  'fil': '🇵🇭',
  'fr-fr': '🇫🇷',
  'fr-ca': '🇨🇦',
  'gl': '🇪🇸',
  'ka': '🇬🇪',
  'de': '🇩🇪',
  'el': '🇬🇷',
  'gu': '🇮🇳',
  'he': '🇮🇱',
  'hi': '🇮🇳',
  'hu': '🇭🇺',
  'is': '🇮🇸',
  'id': '🇮🇩',
  'ga': '🇮🇪',
  'it': '🇮🇹',
  'jv': '🇮🇩',
  'kn': '🇮🇳',
  'kk': '🇰🇿',
  'ko': '🇰🇷',
  'la': '🇻🇦',
  'lv': '🇱🇻',
  'lt': '🇱🇹',
  'mk': '🇲🇰',
  'ms': '🇲🇾',
  'ml': '🇮🇳',
  'mt': '🇲🇹',
  'zh': '🇨🇳',
  'mr': '🇮🇳',
  'mn': '🇲🇳',
  'ne': '🇳🇵',
  'no': '🇳🇴',
  'fa': '🇮🇷',
  'pl': '🇵🇱',
  'pt-pt': '🇵🇹',
  'pt-br': '🇧🇷',
  'pa': '🇮🇳',
  'ro': '🇷🇴',
  'ru': '🇷🇺',
  'sr': '🇷🇸',
  'si': '🇱🇰',
  'sk': '🇸🇰',
  'sl': '🇸🇮',
  'es-es': '🇪🇸',
  'es-419': '🇲🇽',
  'sv': '🇸🇪',
  'ta': '🇮🇳',
  'te': '🇮🇳',
  'th': '🇹🇭',
  'tr': '🇹🇷',
  'uk': '🇺🇦',
  'ur': '🇵🇰',
  'vi': '🇻🇳',
};

export function formatLanguageFlags(
  languages: string | null | undefined,
  separator: string = '',
): string | null {
  if (!languages) {
    return null;
  }

  const flags = languages
    .split(',')
    .map((code) => LANGUAGE_FLAGS[code.trim()])
    .filter((flag): flag is string => flag !== undefined);

  return flags.length > 0 ? flags.join(separator) : null;
}
