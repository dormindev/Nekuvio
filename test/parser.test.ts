import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseStremioId } from '../src/utils/parser.js';

describe('parseStremioId', () => {
  it('parses IMDB series ID with season and episode', () => {
    const parsed = parseStremioId('series', 'tt6455986:1:5');
    assert.deepEqual(parsed, {
      provider: 'imdb',
      externalId: 'tt6455986',
      season: 1,
      episode: 5,
      isAnimeProvider: false,
      isMovie: false
    });
  });

  it('parses IMDB series ID with season 0 (specials)', () => {
    const parsed = parseStremioId('series', 'tt0434665:0:99');
    assert.deepEqual(parsed, {
      provider: 'imdb',
      externalId: 'tt0434665',
      season: 0,
      episode: 99,
      isAnimeProvider: false,
      isMovie: false
    });
  });

  it('parses IMDB movie ID with null season and episode', () => {
    const parsed = parseStremioId('movie', 'tt5323662');
    assert.deepEqual(parsed, {
      provider: 'imdb',
      externalId: 'tt5323662',
      season: null,
      episode: null,
      isAnimeProvider: false,
      isMovie: true
    });
  });

  it('parses Kitsu anime series ID (no season component, high episode number)', () => {
    const parsed = parseStremioId('series', 'kitsu:49235:24');
    assert.deepEqual(parsed, {
      provider: 'kitsu',
      externalId: '49235',
      season: null,
      episode: 24,
      isAnimeProvider: true,
      isMovie: false
    });

    const longRunning = parseStremioId('series', 'kitsu:12:1180');
    assert.deepEqual(longRunning, {
      provider: 'kitsu',
      externalId: '12',
      season: null,
      episode: 1180,
      isAnimeProvider: true,
      isMovie: false
    });
  });

  it('parses MAL anime series ID', () => {
    const parsed = parseStremioId('series', 'mal:12345:12');
    assert.deepEqual(parsed, {
      provider: 'mal',
      externalId: '12345',
      season: null,
      episode: 12,
      isAnimeProvider: true,
      isMovie: false
    });
  });

  it('parses AniList anime series ID', () => {
    const parsed = parseStremioId('series', 'anilist:182205:23');
    assert.deepEqual(parsed, {
      provider: 'anilist',
      externalId: '182205',
      season: null,
      episode: 23,
      isAnimeProvider: true,
      isMovie: false
    });
  });

  it('parses generic provider with season and episode (e.g. tmdb/tvdb)', () => {
    const parsed = parseStremioId('series', 'tmdb:1234:2:8');
    assert.deepEqual(parsed, {
      provider: 'tmdb',
      externalId: '1234',
      season: 2,
      episode: 8,
      isAnimeProvider: false,
      isMovie: false
    });

    const parsedTvdb = parseStremioId('series', 'tvdb:5678:3:15');
    assert.deepEqual(parsedTvdb, {
      provider: 'tvdb',
      externalId: '5678',
      season: 3,
      episode: 15,
      isAnimeProvider: false,
      isMovie: false
    });
  });

  it('parses movie from anime provider', () => {
    const parsed = parseStremioId('movie', 'mal:64012');
    assert.deepEqual(parsed, {
      provider: 'mal',
      externalId: '64012',
      season: null,
      episode: null,
      isAnimeProvider: true,
      isMovie: true
    });
  });

  it('throws an error if externalId is missing', () => {
    assert.throws(() => {
      parseStremioId('series', '');
    }, /External ID is empty/);
  });

  it('throws an error if anime series episode is not a number', () => {
    assert.throws(() => {
      parseStremioId('series', 'kitsu:1234:abc');
    }, /Episode is not a number/);

    assert.throws(() => {
      parseStremioId('series', 'kitsu:1234');
    }, /Episode is not a number/);
  });

  it('throws an error if regular series season or episode is not a number', () => {
    assert.throws(() => {
      parseStremioId('series', 'tt1234567:x:1');
    }, /Season or episode is not a number/);

    assert.throws(() => {
      parseStremioId('series', 'tt1234567:1');
    }, /Season or episode is not a number/);

    assert.throws(() => {
      parseStremioId('series', 'tmdb:1234:1:y');
    }, /Season or episode is not a number/);
  });
});
