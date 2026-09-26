import { NekoTorrentItem } from '../types.js';

export function formatBytes(bytes: number | string | null | undefined): string {
  if (bytes === null || bytes === undefined || bytes === '') {
    return 'N/A';
  }

  const value = Number(bytes);

  if (!Number.isFinite(value) || value < 0) {
    return 'N/A';
  }

  if (value === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1
  );

  return `${(value / Math.pow(1024, index)).toFixed(2)} ${units[index]}`;
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
