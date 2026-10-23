import { describe, expect, it } from 'vitest';

import {
  findEpisodeFile,
  findMovieFile,
  fitInfo
} from '../src/pipeline/matcher.js';
import type {
  FitInfoResult,
  NekoMediaData,
  NekoMediaResolveData,
  NekoTorrentItem,
  NuvioParsedRequest
} from '../src/types.js';

import { loadExamples, loadFixtureData, loadSynthetic } from './helpers/test-data.js';


// The media below are real captures from the data catalog. The *request* is
// what varies — the media stays fixed, so every assertion is checked against
// a shape the API actually returns.
const s172 = loadFixtureData<NekoMediaData>('nekobt-media', 's172');
const m145 = loadFixtureData<NekoMediaData>('nekobt-media', 'm145');
const unmapped = loadFixtureData<NekoMediaData>('nekobt-media', 's11599');
const s1545 = loadFixtureData<NekoMediaData>('nekobt-media', 's1545');
const attackOnTitan = loadFixtureData<NekoMediaData>('nekobt-media', 's824');
const bakemonogatari = loadFixtureData<NekoMediaData>('nekobt-media', 's193');
const hunterXHunter = loadFixtureData<NekoMediaData>('nekobt-media', 's679');
const naruto = loadFixtureData<NekoMediaData>('nekobt-media', 's11509');
const spiritedAway = loadFixtureData<NekoMediaData>('nekobt-media', 'm517');

// The primary season of s172 carries the series title with its synonyms; one
// of s1545's entries carries a title without any.
const primarySeason = s172.anilist.entries.find(e => e.season === 1)!;
const season4 = s172.anilist.entries.find(e => e.season === 4)!;
const withoutSynonyms = s1545.anilist.entries.find(
  e => e.media?.title && (e.media.title.synonyms ?? []).length === 0
)!;

function request(overrides: Partial<NuvioParsedRequest>): NuvioParsedRequest {
  return {
    provider: 'imdb',
    externalId: 'tt1',
    isMovie: false,
    isAnimeProvider: false,
    season: null,
    episode: null,
    ...overrides
  };
}

describe('fitInfo', () => {
  const nekoId: NekoMediaResolveData = {
    media_id: 's172',
    anilist_id: 182205,
    isMovie: false
  };

  it('correctly maps request season and episode to anime episode', () => {
    const info = fitInfo(nekoId, s172, request({ season: 4, episode: 23 }));

    expect(info.media_id).toBe('s172');
    expect(info.season).toBeTruthy();
    expect(info.season?.season).toBe(4);
    expect(info.episode).toBeTruthy();
    expect(info.episode?.episode).toBe(23);
    expect(info.episode?.absolute).toBe(95);
    expect(info.episode?.id).toBe(220939);
  });

  it('resolves the primary season when the request matches it', () => {
    // The primary entry of s172 is season 1 (src 1-24, dst 1-24).
    const info = fitInfo(
      { media_id: 's172', anilist_id: 101280, isMovie: false },
      s172,
      request({ season: 1, episode: 1 })
    );

    expect(info.season?.season).toBe(1);
    expect(info.season?.isPrimary).toBe(true);
    expect(info.episode?.season).toBe(1);
  });

  it('applies the src_start offset when the matched season is not primary', () => {
    // s172's second season-2 entry runs src 13-24 → dst 1-12, and it is not
    // the primary season, so the episode is renumbered into src space:
    // 5 + (src_start 13 - 1) = 17.
    const info = fitInfo(
      { media_id: 's172', anilist_id: 116742, isMovie: false },
      s172,
      request({ isAnimeProvider: true, episode: 5 })
    );

    expect(info.season?.season).toBe(2);
    expect(info.season?.isPrimary).toBe(false);
    expect(info.episode?.episode).toBe(17);
    expect(info.episode?.id).toBe(4269);
    expect(info.episode?.absolute).toBe(41);
  });

  it('handles movie request: returns null episode when nekoId.isMovie is true', () => {
    const info = fitInfo(
      { media_id: 'm145', anilist_id: 20954, isMovie: true },
      m145,
      request({ isMovie: true })
    );

    expect(info.episode).toBeNull();
    expect(info.season?.season).toBeNull();
  });

  it('handles media with null anilist (unmapped media like s11599 or m1305) without crashing', () => {
    const info = fitInfo(
      { media_id: 's11599', anilist_id: 1, isMovie: false },
      unmapped,
      request({ season: 1, episode: 1 })
    );

    expect(info.season).toBeNull();
    expect(info.episode?.id).toBe(524767);
  });

  it('resolves real fixture s172 (Slime S4) accurately', () => {
    const info = fitInfo(nekoId, s172, request({ season: 4, episode: 23 }));

    expect(info.media_id).toBe('s172');
    expect(info.episode?.id).toBe(220939);
    expect(info.episode?.title).toBe("Granville's Hope");
  });

  it('falls back to request season and episode in media.episodes when season info is null', () => {
    // Season 0 entries are skipped for non-anime providers, so no season is
    // found and the episode is looked up in media.episodes directly.
    const info = fitInfo(nekoId, s172, request({ season: 0, episode: 1 }));

    expect(info.season).toBeNull();
    expect(info.episode).toBeTruthy();
    expect(info.episode?.id).toBe(4215);
    expect(info.episode?.season).toBe(0);
    expect(info.episode?.episode).toBe(1);
  });

  it('throws error if episode entry is not found in media.episodes', () => {
    expect(() =>
      fitInfo(nekoId, s172, request({ season: 4, episode: 99 }))
    ).toThrow(/Episode entry with season 4 and episode 99 not found/);
  });

  it('handles the anime-provider season-with-episode-0 offset and skips season 0 entries', () => {
    // No real release has a season whose entry starts at dst 2 with ord 1, so
    // the shape is assumed (synthetic/nekobt-media/episode-zero).
    const media = loadSynthetic<{ data: NekoMediaData }>('nekobt-media', 'episode-zero').data;

    const info = fitInfo(
      { media_id: 's9001', anilist_id: 182205, isMovie: false },
      media,
      request({ isAnimeProvider: true, episode: 2 })
    );

    expect(info.season?.season).toBe(1);
    // isPrimary: episode 2 + (-dst_start + 1) = 2 + (-1) = 1
    expect(info.episode?.episode).toBe(1);
    expect(info.episode?.id).toBe(220900);
  });

  it('treats a media with no anilist primary as never primary', () => {
    // No real release comes back without its `anilist.primary` — assumed shape.
    const media = loadSynthetic<{ data: NekoMediaData }>('nekobt-media', 'primary-null').data;

    const info = fitInfo(
      { media_id: 's9002', anilist_id: 182205, isMovie: false },
      media,
      request({ season: 4, episode: 23 })
    );

    expect(info.season?.season).toBe(4);
    expect(info.season?.isPrimary).toBe(false);
    expect(info.episode?.id).toBe(220939);
  });

  it('resolves a season-0 special requested as `tt<id>:0:<ep>`', () => {
    // The real shape of a season-0 request: Nuvio sends an imdb id with
    // season 0 (observed empirically for every special/movie request from an
    // anime franchise), so the non-anime branch is the one that serves it.
    const ova = attackOnTitan.anilist.entries.find(e => e.season === 0 && e.src_start === 7)!;
    const episode = attackOnTitan.episodes.find(e => e.season === 0 && e.episode === 7)!;

    // The special's episode carries no absolute number at all.
    expect(episode.absolute).toBeUndefined();

    const info = fitInfo(
      { media_id: 's824', anilist_id: ova.anilist_id, isMovie: false },
      attackOnTitan,
      request({ season: 0, episode: 7 })
    );

    expect(info.season?.season).toBe(0);
    expect(info.episode?.id).toBe(23894);
    expect(info.episode?.absolute).toBeUndefined();
  });

  it('never matches a season-0 entry for an anime provider', () => {
    // A guard, not a scenario: an anime provider never asks for a special —
    // those arrive as `tt<id>:0:<ep>`. If one did, the season-0 entries are
    // skipped on purpose and the request is refused rather than silently
    // answered with a special.
    const ova = attackOnTitan.anilist.entries.find(e => e.season === 0)!;

    expect(() =>
      fitInfo(
        { media_id: 's824', anilist_id: ova.anilist_id, isMovie: false },
        attackOnTitan,
        request({ isAnimeProvider: true, episode: 1 })
      )
    ).toThrow(/Episode entry with season null and episode 1 not found/);
  });

  it('still resolves an anime-provider request for a regular season', () => {
    const season1 = attackOnTitan.anilist.entries.find(e => e.season === 1)!;

    const info = fitInfo(
      { media_id: 's824', anilist_id: season1.anilist_id, isMovie: false },
      attackOnTitan,
      request({ isAnimeProvider: true, episode: 1 })
    );

    expect(info.season?.season).toBe(1);
    expect(info.episode?.id).toBe(23930);
    expect(info.episode?.absolute).toBe(1);
  });

  it('keeps the absolute number when a season continues the previous one', () => {
    // Hunter x Hunter numbers its seasons continuously: season 3 covers the
    // absolute episodes 137-148, so its first episode is absolute 137.
    const season3 = hunterXHunter.anilist.entries.find(e => e.season === 3)!;
    const episode = hunterXHunter.episodes.find(e => e.season === 3 && e.episode === 1)!;

    expect(season3.src_start).toBe(1);
    expect(season3.dst_start).toBe(137);

    const info = fitInfo(
      { media_id: 's679', anilist_id: season3.anilist_id, isMovie: false },
      hunterXHunter,
      request({ season: 3, episode: 1 })
    );

    expect(info.episode?.id).toBe(18743);
    expect(info.episode?.absolute).toBe(137);
  });

  it('keeps the absolute number across a series whose seasons continue it', () => {
    // Naruto's seasons 2-5 all share one anilist id and continue the
    // absolute numbering: season 2 starts at absolute 36.
    const season2 = naruto.anilist.entries.find(e => e.season === 2)!;
    const episode = naruto.episodes.find(e => e.season === 2 && e.episode === 1)!;

    expect(season2.dst_start).toBe(36);
    expect(episode.absolute).toBe(36);

    const info = fitInfo(
      { media_id: 's11509', anilist_id: season2.anilist_id, isMovie: false },
      naruto,
      request({ season: 2, episode: 1 })
    );

    expect(info.episode?.id).toBe(522282);
    expect(info.episode?.absolute).toBe(36);
  });

  it('resolves a movie media by its null-season entry', () => {
    // A real movie: Spirited Away carries one anilist entry with no season.
    const entry = spiritedAway.anilist.entries[0];

    expect(entry.season).toBeNull();

    const info = fitInfo(
      { media_id: 'm517', anilist_id: entry.anilist_id, isMovie: true },
      spiritedAway,
      request({ isMovie: true })
    );

    expect(info.episode).toBeNull();
    expect(info.season?.season).toBeNull();
  });

  it('skips anilist entries whose season does not match a non-anime request', () => {
    // s172 has entries for seasons 0, 1, 2, 3 and 4 — season 3 is the only
    // one covering the requested episode range of season 2.
    const info = fitInfo(
      { media_id: 's172', anilist_id: 156822, isMovie: false },
      s172,
      request({ season: 3, episode: 5 })
    );

    expect(info.season?.season).toBe(3);
    expect(info.episode?.season).toBe(3);
  });

  it('uses the season src_start when a movie request resolves to series media', () => {
    const info = fitInfo(nekoId, s172, request({ isMovie: true }));

    expect(info.episode?.episode).toBe(1);
    expect(info.episode?.id).toBe(172749);
  });

  it('throws when movie-resolved media is requested as a series', () => {
    expect(() =>
      fitInfo(
        { media_id: 'm145', anilist_id: 20954, isMovie: true },
        m145,
        request({ season: 1, episode: 1 })
      )
    ).toThrow(/do not match/);
  });
});

describe('findMovieFile', () => {
  const dummyInfo: FitInfoResult = {
    media_id: 'm145',
    media: { anilist: { entries: [] }, episodes: [] },
    season: null,
    episode: null
  };

  it('selects the largest video file in a movie torrent', () => {
    // A real release that carries the movie among the episodes: the 2.4 GB
    // movie file is the largest one in the torrent.
    const torrent = loadFixtureData<{ files: Array<{ name: string; length: number }> }>(
      'nekobt-torrents', '7514276465159'
    );

    const match = findMovieFile(torrent, dummyInfo);

    expect(match).toBeTruthy();
    expect(match?.name).toContain('The Movie');
    expect(match?.length).toBe(2411031290);
  });

  it('returns null if files list is empty', () => {
    expect(findMovieFile({ files: [] }, dummyInfo)).toBeNull();
  });
});

describe('findEpisodeFile', () => {
  // The real Slime S4 release: 24 files named S04E01 … S04E24, so the file for
  // episode 23 sits at index 22.
  const sxxEyyTorrent = loadFixtureData<{ files: Array<{ name: string; length: number }> }>(
    'nekobt-torrents', '14474579778825'
  );

  const info: FitInfoResult = {
    media_id: 's172',
    media: { anilist: { entries: [] }, episodes: [] },
    season: {
      season: 4,
      src_start: 1,
      src_end: 24,
      dst_start: 1,
      dst_end: 24,
      anilist_id: 182205,
      media: season4.media
    },
    episode: {
      id: 220939,
      season: 4,
      episode: 23,
      absolute: 95
    }
  };

  it('matches files using SxxEyy pattern', () => {
    const match = findEpisodeFile(sxxEyyTorrent, info);

    expect(match).toBeTruthy();
    expect(match?.index).toBe(22);
    expect(match?.name).toContain('S04E23');
  });

  it('matches files with multi-episode range SxxEyy-Ezz pattern', () => {
    // No real release names a file as a range — assumed shape.
    const torrent = loadSynthetic<{ data: { files: Array<{ name: string; length: number }> } }>(
      'nekobt-torrents', 'episode-range'
    ).data;

    const match = findEpisodeFile(torrent, info);

    expect(match).toBeTruthy();
    expect(match?.index).toBe(0);
    expect(match?.name).toContain('S04E20-E24');
  });

  it('matches files with dot/underscore separated SxxEyy pattern', () => {
    // No real release separates the Sxx and Eyy tokens — assumed shape.
    const torrent = loadSynthetic<{ data: { files: Array<{ name: string; length: number }> } }>(
      'nekobt-torrents', 'underscore-separated'
    ).data;

    const match = findEpisodeFile(torrent, info);

    expect(match).toBeTruthy();
    expect(match?.index).toBe(0);
    expect(match?.name).toContain('S04_E23');
  });

  it('matches files with separated season and episode pattern', () => {
    // A real release naming the season in words: "4th Season - 24".
    const torrent = loadFixtureData<{ files: Array<{ name: string; length: number }> }>(
      'nekobt-torrents', '14414565343489'
    );

    const match = findEpisodeFile(
      torrent,
      { ...info, episode: { id: 1, season: 4, episode: 24, absolute: 96 } }
    );

    expect(match).toBeTruthy();
    expect(match?.index).toBe(0);
    expect(match?.name).toContain('4th Season - 24');
  });

  it('matches files using absolute episode pattern when SxxEyy is absent', () => {
    // A real release naming the file by its absolute number only.
    const torrent = loadFixtureData<{ files: Array<{ name: string; length: number }> }>(
      'nekobt-torrents', '14042604076552'
    );

    const match = findEpisodeFile(
      torrent,
      { ...info, episode: { id: 1, season: 1, episode: 1180, absolute: 1180 } }
    );

    expect(match).toBeTruthy();
    expect(match?.index).toBe(0);
    expect(match?.name).toContain('1180');
  });

  it('matches files with EP / E prefix and leading zeros in absolute episode', () => {
    // A real release using the EP prefix: "One Piece EP1180".
    const torrent = loadFixtureData<{ files: Array<{ name: string; length: number }> }>(
      'nekobt-torrents', '14060867155212'
    );

    const match = findEpisodeFile(
      torrent,
      { ...info, episode: { id: 1, season: 1, episode: 1180, absolute: 1180 } }
    );

    expect(match).toBeTruthy();
    expect(match?.index).toBe(0);
    expect(match?.name).toContain('EP1180');
  });

  it('matches files when info.season is null using info.episode.season', () => {
    const match = findEpisodeFile(
      sxxEyyTorrent,
      { ...info, season: null }
    );

    expect(match).toBeTruthy();
    expect(match?.index).toBe(22);
  });

  it('returns null if torrent files array is empty', () => {
    expect(findEpisodeFile({ files: [] }, info)).toBeNull();
  });

  it('returns null if no files match the episode', () => {
    const torrent = loadFixtureData<{ files: Array<{ name: string; length: number }> }>(
      'nekobt-torrents', '14474579778825'
    );

    const match = findEpisodeFile(
      torrent,
      { ...info, episode: { id: 1, season: 4, episode: 99, absolute: 99 } }
    );

    expect(match).toBeNull();
  });

  it('matches a file named by its absolute number with leading zeros', () => {
    // A real release: Hunter x Hunter's batch names its files "- 039".
    const torrent = loadFixtureData<{ files: Array<{ name: string; length: number }> }>(
      'nekobt-torrents', '13225791205644'
    );

    const match = findEpisodeFile(
      torrent,
      { ...info, episode: { id: 18645, season: 1, episode: 39, absolute: 39 } }
    );

    expect(match).toBeTruthy();
    expect(match?.index).toBe(0);
    expect(match?.name).toContain('- 039');
  });

  it('matches a season-0 file whose episode carries no absolute number', () => {
    // Attack on Titan's season-0 batch: the file is named S00E07 and its
    // episode has no absolute number at all.
    const torrent = loadFixtureData<{ files: Array<{ name: string; length: number }> }>(
      'nekobt-torrents', '14527792784141'
    );
    const ova = attackOnTitan.anilist.entries.find(e => e.season === 0)!;

    const ovaInfo: FitInfoResult = {
      ...info,
      season: { ...ova, isPrimary: false },
      episode: { id: 23894, season: 0, episode: 7, absolute: undefined as never }
    };

    const match = findEpisodeFile(torrent, ovaInfo);

    expect(match).toBeTruthy();
    expect(match?.index).toBe(0);
    expect(match?.name).toContain('S00E07');
  });

  it('skips absolute matching when the absolute episode number is missing', () => {
    // The real release names its file by its absolute number ("One Piece -
    // 1180"). With the absolute number missing from the fit info, the
    // absolute strategy is off and the episode-only strategy looks for the
    // episode number instead — which the file does not carry.
    const torrent = loadFixtureData<{ files: Array<{ name: string; length: number }> }>(
      'nekobt-torrents', '14042604076552'
    );

    const withoutAbsolute: FitInfoResult = {
      ...info,
      episode: { id: 1, season: 1, episode: 23, absolute: 0 }
    };

    expect(findEpisodeFile(torrent, withoutAbsolute)).toBeNull();
  });

  it('matches a file in a 35-file batch release', () => {
    // A real Naruto season-1 batch: the file for episode 1 is the first one.
    const torrent = loadFixtureData<{ files: Array<{ name: string; length: number }> }>(
      'nekobt-torrents', '13695484685327'
    );

    const match = findEpisodeFile(
      torrent,
      { ...info, episode: { id: 522247, season: 1, episode: 1, absolute: 1 } }
    );

    expect(match).toBeTruthy();
    expect(match?.index).toBe(0);
    expect(match?.name).toContain('S01E01');
  });

  it('matches a file in a 48-file batch release of a later season', () => {
    // Naruto's season 4 continues the absolute numbering (absolute 132).
    const torrent = loadFixtureData<{ files: Array<{ name: string; length: number }> }>(
      'nekobt-torrents', '13699910230794'
    );

    const match = findEpisodeFile(
      torrent,
      { ...info, episode: { id: 522378, season: 4, episode: 1, absolute: 132 } }
    );

    expect(match).toBeTruthy();
    expect(match?.index).toBe(0);
    expect(match?.name).toContain('S04E01');
  });

  it('needs the season title to pick the right series out of an integral', () => {
    // A real release: the 152-file Monogatari integral holds two series —
    // Bakemonogatari and Nisemonogatari — with the same episode numbers, so
    // the bare number matches both and only the season title tells them
    // apart. It is also the release that exposed the fileIdx contract
    // mismatch (the matcher picks the right file; the stream mislabels it).
    const torrent = loadFixtureData<{ files: Array<{ name: string; length: number }> }>(
      'nekobt-torrents', '9087447179017'
    );
    const nisemonogatari = bakemonogatari.anilist.entries.find(e => e.season === 2)!;
    const episode = bakemonogatari.episodes.find(e => e.season === 2 && e.episode === 1)!;

    const namedInfo: FitInfoResult = {
      media_id: 's193',
      media: { anilist: { entries: [] }, episodes: [] },
      season: { ...nisemonogatari, isPrimary: false },
      episode: {
        id: episode.id,
        season: episode.season,
        episode: episode.episode,
        absolute: episode.absolute
      }
    };

    // With the title, the Nisemonogatari file is chosen.
    const match = findEpisodeFile(torrent, namedInfo);
    expect(match?.name).toContain('Nisemonogatari');

    // Without a season to take the title from, the named-season strategy is
    // skipped and the bare absolute number (16) lands on a file of a third
    // series in the same integral.
    const untitled: FitInfoResult = { ...namedInfo, season: null };
    const fallback = findEpisodeFile(torrent, untitled);
    expect(fallback?.name).toContain('Owarimonogatari');
  });

  it('matches files by named season including synonyms', () => {
    // A real release: Attack on Titan's season 1 batch is named after the
    // series title ("[MiniMTBB] Shingeki no Kyojin - 01"), which is exactly
    // the title of its season-1 entry.
    const torrent = loadFixtureData<{ files: Array<{ name: string; length: number }> }>(
      'nekobt-torrents', '8960236499207'
    );
    const season1 = attackOnTitan.anilist.entries.find(e => e.season === 1)!;

    const namedInfo: FitInfoResult = {
      ...info,
      season: { ...info.season!, media: season1.media },
      episode: { id: 23930, season: 1, episode: 1, absolute: 1 }
    };

    const match = findEpisodeFile(torrent, namedInfo);

    expect(match).toBeTruthy();
    expect(match?.index).toBe(0);
    expect(match?.name).toContain('Shingeki no Kyojin - 01');
  });

  it('matches files by named season when there are no synonyms', () => {
    // No real release is named after a title that carries no synonyms, so
    // this half of the case stays an assumed shape.
    const torrent = loadSynthetic<{ data: { files: Array<{ name: string; length: number }> } }>(
      'nekobt-torrents', 'named-season'
    ).data;

    // A real media whose title carries no synonyms at all (s1545, an One Piece
    // film entry) — the matcher must still match on the title alone.
    const namedInfo: FitInfoResult = {
      ...info,
      season: { ...info.season!, media: withoutSynonyms.media },
      episode: { id: 1, season: 1, episode: 1, absolute: 1 }
    };

    const match = findEpisodeFile(torrent, namedInfo);

    expect(match?.index).toBe(1);
  });
});


describe('the examples corpus', () => {
  // The corpus is used as a whole: the request is reconstructed from the data
  // itself, so no case is pointed at and nothing is hardcoded.
  const media = loadExamples<{ error: boolean; data: NekoMediaData }>('nekobt-media')
    .filter(b => b.error === false)
    .map(b => b.data);
  const torrents = loadExamples<{ error: boolean; data: NekoTorrentItem }>('nekobt-torrents')
    .filter(b => b.error === false)
    .map(b => b.data);

  it('matches a file for every torrent in the corpus', () => {
    for (const torrent of torrents) {
      const episodeIds = (torrent.media_episode_ids ?? []).map(Number);
      if (!episodeIds.length) continue;

      // The torrent names the episodes it covers; the media they belong to is
      // in the corpus, so the fit info can be rebuilt from it.
      const owner = media.find(m =>
        episodeIds.some((id: number) => (m.episodes ?? []).some(e => e.id === id))
      );
      if (!owner) continue;

      const matched = episodeIds.some((episodeId: number) => {
        const episode = owner.episodes?.find(e => e.id === episodeId);
        if (!episode) return false;
        const entry = owner.anilist?.entries?.find(e => e.season === episode.season);
        const info: FitInfoResult = {
          media_id: owner.id ?? 'm',
          media: { anilist: { entries: [] }, episodes: [] },
          season: entry
            ? { ...entry, isPrimary: owner.anilist?.primary?.id === entry.anilist_id }
            : null,
          episode: {
            id: episode.id,
            season: episode.season,
            episode: episode.episode,
            absolute: episode.absolute
          }
        };
        return findEpisodeFile(torrent, info) !== null;
      });

      expect(matched, `torrent ${torrent.id}`).toBe(true);
    }
  });
});
