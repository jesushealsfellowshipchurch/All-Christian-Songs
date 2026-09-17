/**
 * Phase 5: Independent Database Integrity Verification Script
 * 
 * Performs 100% READ-ONLY verification of live Supabase PostgreSQL database
 * against original source artifacts in backup/pre-migration-snapshot/songs/.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = 'https://hxfeluhttsifwmwltjmj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_h4Dk7s9XLU81pczWZ0TZKA_ZiavZvj3';

const SNAPSHOT_DIR = path.resolve(__dirname, '../../backup/pre-migration-snapshot/songs');
const SONGBOOKS_FILE = path.resolve(__dirname, '../../public/data/songbooks.json');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

async function fetchAll(table, select = '*', orderCol = null) {
  const allRows = [];
  const PAGE_SIZE = 1000;
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from(table)
      .select(select);
    
    if (orderCol) {
      query = query.order(orderCol, { ascending: true });
    }
    
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`Error fetching from ${table}: ${error.message}`);
    allRows.push(...data);
    if (data.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      from += PAGE_SIZE;
    }
  }
  return allRows;
}

async function run() {
  console.log('Fetching live data from Supabase...');
  const [songs, songbookSongs, pinnedSongs, languages, categories, songbooks] = await Promise.all([
    fetchAll('songs', '*', 'id'),
    fetchAll('songbook_songs', '*', 'song_id'),
    fetchAll('pinned_songs', '*', null),
    fetchAll('languages', '*', 'code'),
    fetchAll('categories', '*', 'id'),
    fetchAll('songbooks', '*', 'id')
  ]);

  console.log(`Live DB counts:
  songs: ${songs.length}
  songbook_songs: ${songbookSongs.length}
  pinned_songs: ${pinnedSongs.length}
  languages: ${languages.length}
  categories: ${categories.length}
  songbooks: ${songbooks.length}
`);

  // Load source data
  const files = fs.readdirSync(SNAPSHOT_DIR);
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const songFiles = files.filter(f => uuidRegex.test(f.replace(/\.json$/, '')));
  console.log(`Source UUID songs count: ${songFiles.length}`);

  const sourceSongs = new Map();
  for (const file of songFiles) {
    const raw = JSON.parse(fs.readFileSync(path.join(SNAPSHOT_DIR, file), 'utf8'));
    sourceSongs.set(raw.id, raw);
  }

  const mismatches = [];

  // 1. ROW COUNTS
  const checks = {
    songsCount: songs.length === 3773,
    songbookSongsCount: songbookSongs.length === 2291,
    pinnedSongsCount: pinnedSongs.length === 1,
    languagesCount: languages.length === 3,
    categoriesCount: categories.length === 18,
    songbooksCount: songbooks.length === 8
  };
  console.log('1. Row Counts Check:', checks);

  // 2. SONG IDENTITY
  const dbSongMap = new Map();
  const dbSlugs = new Set();
  let duplicateSlugs = 0;
  for (const s of songs) {
    dbSongMap.set(s.id, s);
    if (dbSlugs.has(s.slug)) duplicateSlugs++;
    dbSlugs.add(s.slug);
  }

  let missingSourceUuids = 0;
  let slugMismatches = 0;
  for (const [id, src] of sourceSongs.entries()) {
    const dbSong = dbSongMap.get(id);
    if (!dbSong) {
      missingSourceUuids++;
      mismatches.push(`Missing UUID in DB: ${id} (${src.slug})`);
    } else if (dbSong.slug !== src.slug) {
      slugMismatches++;
      mismatches.push(`Slug mismatch for ${id}: src="${src.slug}" vs db="${dbSong.slug}"`);
    }
  }

  // 3. LANGUAGE DISTRIBUTION
  const langCounts = { telugu: 0, english: 0, hindi: 0, other: 0 };
  for (const s of songs) {
    if (langCounts[s.language] !== undefined) langCounts[s.language]++;
    else langCounts.other++;
  }
  console.log('3. Language Distribution:', langCounts);

  // 4. REQUIRED DATA & 5. ARRAY FIDELITY
  let missingRequired = 0;
  let emptySeparatorCount = 0;
  let lyricsOriginalArrayMismatches = 0;
  let lyricsTransliteratedArrayMismatches = 0;
  let categoryNamesArrayMismatches = 0;
  let chordsArrayMismatches = 0;

  // 6. OPTIONAL FIELD COUNTS
  let titleTransliteratedCount = 0;
  let youtubeIdCount = 0;
  let chordsCount = 0;
  let chordCreditsCount = 0;
  let pptUrlCount = 0;
  let bibleVersesCount = 0;
  let devotionalCount = 0;

  // 7. CATEGORIES
  let categorizedCount = 0;
  let emptyCategoryCount = 0;

  // 9. JSONB FIDELITY
  let songbooksJsonbMismatches = 0;
  let bibleVersesJsonbMismatches = 0;
  let devotionalJsonbMismatches = 0;

  // 10. PPT URL FIDELITY
  let legacyPptFound = false;

  for (const s of songs) {
    const src = sourceSongs.get(s.id);
    if (!src) continue;

    // Required fields check
    if (!s.title || !s.language || !s.alphabet || !s.lyrics_original || s.lyrics_original.length === 0) {
      missingRequired++;
      mismatches.push(`Missing required field on song ${s.id}`);
    }

    // Lyrics original array fidelity & empty string separator count
    const srcLyricsOrig = Array.isArray(src.lyrics_original) ? src.lyrics_original : [];
    if (JSON.stringify(s.lyrics_original) !== JSON.stringify(srcLyricsOrig)) {
      lyricsOriginalArrayMismatches++;
      mismatches.push(`lyrics_original array mismatch for ${s.id}`);
    }
    for (const line of s.lyrics_original) {
      if (line === '') emptySeparatorCount++;
    }

    // Lyrics transliterated fidelity
    const srcLyricsTrans = Array.isArray(src.lyrics_transliterated) ? src.lyrics_transliterated : [];
    if (JSON.stringify(s.lyrics_transliterated) !== JSON.stringify(srcLyricsTrans)) {
      lyricsTransliteratedArrayMismatches++;
      mismatches.push(`lyrics_transliterated array mismatch for ${s.id}`);
    }

    // Category names fidelity
    const srcCatNames = Array.isArray(src.category_names) ? src.category_names : [];
    if (JSON.stringify(s.category_names) !== JSON.stringify(srcCatNames)) {
      categoryNamesArrayMismatches++;
      mismatches.push(`category_names array mismatch for ${s.id}`);
    }

    // Chords array fidelity
    const srcChords = Array.isArray(src.chords) && src.chords.length > 0 ? src.chords : null;
    if (JSON.stringify(s.chords) !== JSON.stringify(srcChords)) {
      chordsArrayMismatches++;
      mismatches.push(`chords array mismatch for ${s.id}`);
    }

    // Optional fields counts
    if (s.title_transliterated !== null && s.title_transliterated !== '') titleTransliteratedCount++;
    if (s.youtube_id !== null && s.youtube_id !== '') youtubeIdCount++;
    if (s.chords !== null && s.chords.length > 0) chordsCount++;
    if (s.chord_credits !== null && s.chord_credits !== '') chordCreditsCount++;
    if (s.ppt_url !== null && s.ppt_url !== '') pptUrlCount++;
    if (s.bible_verses !== null && Array.isArray(s.bible_verses) && s.bible_verses.length > 0) bibleVersesCount++;
    if (s.devotional !== null && Object.keys(s.devotional).length > 0) devotionalCount++;

    // Categories
    if (s.category_names && s.category_names.length > 0) categorizedCount++;
    else emptyCategoryCount++;

    // JSONB fidelity
    const srcSongbooks = Array.isArray(src.songbooks) ? src.songbooks : [];
    if (JSON.stringify(s.songbooks) !== JSON.stringify(srcSongbooks)) {
      songbooksJsonbMismatches++;
      mismatches.push(`songbooks JSONB mismatch for ${s.id}`);
    }

    const srcVerses = Array.isArray(src.bible_verses) ? src.bible_verses : [];
    if (JSON.stringify(s.bible_verses) !== JSON.stringify(srcVerses)) {
      bibleVersesJsonbMismatches++;
      mismatches.push(`bible_verses JSONB mismatch for ${s.id}`);
    }

    const srcDevotional = src.devotional && Object.keys(src.devotional).length > 0 ? src.devotional : null;
    if (JSON.stringify(s.devotional) !== JSON.stringify(srcDevotional)) {
      devotionalJsonbMismatches++;
      mismatches.push(`devotional JSONB mismatch for ${s.id}`);
    }

    // PPT legacy check
    if (s.ppt_url && s.ppt_url.includes('christiansongslyrics4us.com')) {
      legacyPptFound = true;
      if (s.id !== '97aff3c1-3acc-4dd7-9e84-c7c1141b0f97') {
        mismatches.push(`Unexpected legacy PPT domain on song ${s.id}`);
      }
    }
  }

  // 8. SONGBOOKS JUNCTION TABLE
  const songsWithBooks = new Set();
  const bookDistribution = {};
  const songBookPairSet = new Set();
  let duplicateJunctionPairs = 0;
  let invalidSongRefs = 0;
  let invalidBookRefs = 0;

  const validSongbookIds = new Set(songbooks.map(b => b.id));

  for (const j of songbookSongs) {
    songsWithBooks.add(j.song_id);
    bookDistribution[j.song_id] = (bookDistribution[j.song_id] || 0) + 1;

    const pairKey = `${j.song_id}_${j.songbook_id}`;
    if (songBookPairSet.has(pairKey)) duplicateJunctionPairs++;
    songBookPairSet.add(pairKey);

    if (!dbSongMap.has(j.song_id)) invalidSongRefs++;
    if (!validSongbookIds.has(j.songbook_id)) invalidBookRefs++;
  }

  const songsInBooksCounts = { 1: 0, 2: 0, 3: 0, other: 0 };
  for (const count of Object.values(bookDistribution)) {
    if (count === 1) songsInBooksCounts[1]++;
    else if (count === 2) songsInBooksCounts[2]++;
    else if (count === 3) songsInBooksCounts[3]++;
    else songsInBooksCounts.other++;
  }

  // 11. PINNED SONG SAFETY
  const pinnedSong = pinnedSongs[0];
  console.log('Pinned song in DB:', pinnedSong);
  const pinnedId = pinnedSong?.id || pinnedSong?.song_id;
  const pinnedSafe = pinnedSongs.length === 1 &&
    pinnedId === '20f645d3-730c-40e0-9155-851f219c8acc' &&
    pinnedSong?.pin_number === 1;

  // 12. SPOT CHECKS
  const spotCheckIds = [
    { label: 'Telugu standard', id: '0008c794-4a6c-4407-9df1-442d5a3b93ad' },
    { label: 'English song', id: '0082d78b-b28c-4470-be36-d46806ed2223' },
    { label: 'Hindi song', id: '0291bf2e-d64a-4ece-a4d1-deb93832ab30' },
    { label: 'Song with chords', id: '032f8512-a2be-46ec-8e4c-22342a813726' },
    { label: 'Song with YouTube', id: '0008c794-4a6c-4407-9df1-442d5a3b93ad' },
    { label: 'Song with PPT', id: '0008c794-4a6c-4407-9df1-442d5a3b93ad' },
    { label: 'Song with Bible verses', id: '0008c794-4a6c-4407-9df1-442d5a3b93ad' },
    { label: 'Song with Devotional', id: '0008c794-4a6c-4407-9df1-442d5a3b93ad' },
    { label: 'Song with multiple books (3)', id: '09277925-e395-4f83-8d0c-1fca0a52586e' },
    { label: 'Legacy PPT domain', id: '97aff3c1-3acc-4dd7-9e84-c7c1141b0f97' }
  ];

  const spotCheckResults = spotCheckIds.map(sc => {
    const s = dbSongMap.get(sc.id);
    const src = sourceSongs.get(sc.id);
    return {
      label: sc.label,
      id: sc.id,
      slug: s?.slug,
      title: s?.title,
      language: s?.language,
      verified_in_db: !!s,
      perfect_match: !!s && !!src && JSON.stringify(s.lyrics_original) === JSON.stringify(src.lyrics_original)
    };
  });

  const summary = {
    checks,
    identity: {
      dbSongsCount: songs.length,
      uniqueUuids: dbSongMap.size,
      uniqueSlugs: dbSlugs.size,
      missingSourceUuids,
      slugMismatches
    },
    languageDistribution: langCounts,
    requiredData: { missingRequired },
    arrayFidelity: {
      emptySeparatorCount,
      lyricsOriginalArrayMismatches,
      lyricsTransliteratedArrayMismatches,
      categoryNamesArrayMismatches,
      chordsArrayMismatches
    },
    optionalFieldCounts: {
      titleTransliteratedCount,
      youtubeIdCount,
      chordsCount,
      chordCreditsCount,
      pptUrlCount,
      bibleVersesCount,
      devotionalCount
    },
    categories: {
      categorizedCount,
      emptyCategoryCount
    },
    songbooks: {
      uniqueSongsAssociated: songsWithBooks.size,
      totalJunctionRows: songbookSongs.length,
      duplicateJunctionPairs,
      invalidSongRefs,
      invalidBookRefs,
      distribution: songsInBooksCounts
    },
    jsonbFidelity: {
      songbooksJsonbMismatches,
      bibleVersesJsonbMismatches,
      devotionalJsonbMismatches
    },
    pptFidelity: {
      legacyPptFound,
      totalPptCount: pptUrlCount
    },
    pinnedSafe,
    spotCheckResults,
    mismatchesCount: mismatches.length,
    mismatches
  };

  console.log('=== VERIFICATION SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));

  return summary;
}

run().catch(console.error);
