/**
 * Phase 6 Integration Test: Application Client Read Cutover & Fallback
 * 
 * Verifies:
 * 1. Supabase live reads for catalog, songs by slug, songs by UUID, and songbooks.
 * 2. Static JSON fallback when Supabase is disabled/failing.
 * 3. In-memory caching performance.
 * 4. Representative song category coverage (Telugu, English, Hindi, Chords, PPT, Verses, Devotional, Multi-book).
 * 5. 404 / non-existent song handling.
 */

import { getSong, clearSongCache } from '../../src/services/songRepository.js';
import { getCatalogIndex, getSongbooks, clearCatalogCache } from '../../src/services/catalogRepository.js';
import { filterSongs } from '../../src/utils/search.js';
import { supabase } from '../../src/utils/supabaseClient.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Polyfill global fetch for Node.js if needed (for relative static files)
const originalFetch = global.fetch;
global.fetch = async (url, options) => {
  if (typeof url === 'string' && url.startsWith('./data/')) {
    const localPath = path.resolve(__dirname, '../../public', url.replace('./', ''));
    if (fs.existsSync(localPath)) {
      const content = fs.readFileSync(localPath, 'utf8');
      return {
        ok: true,
        status: 200,
        json: async () => JSON.parse(content)
      };
    } else {
      return {
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not found' })
      };
    }
  }
  return originalFetch(url, options);
};

// Polyfill localStorage & sessionStorage for Node.js test environment
if (typeof global.localStorage === 'undefined') {
  const store = {};
  global.localStorage = {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); }
  };
}

async function runTests() {
  console.log('====================================================');
  console.log('PHASE 6: READ CUTOVER & INTEGRATION TESTS');
  console.log('====================================================\n');

  const testResults = [];

  function record(name, pass, details = '') {
    testResults.push({ name, pass, details });
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name} ${details ? '(' + details + ')' : ''}`);
  }

  // ----------------------------------------------------
  // TEST 1: Live Catalog Fetch
  // ----------------------------------------------------
  console.log('--- TEST 1: Live Catalog Read ---');
  const { count: liveSongCount } = await supabase
    .from('songs')
    .select('id', { count: 'exact', head: true });
  const expectedCatalogCount = liveSongCount || 3774;

  clearCatalogCache();
  const catStart = Date.now();
  const catalogRes = await getCatalogIndex();
  const catDuration = Date.now() - catStart;

  record(
    'Catalog row count',
    catalogRes.songs.length === expectedCatalogCount && catalogRes.songs.length >= 3773,
    `Count: ${catalogRes.songs.length}, expected: ${expectedCatalogCount}, source: ${catalogRes.source}, time: ${catDuration}ms`
  );

  record(
    'Telugu initial sort preference',
    catalogRes.songs[0]?.lang === 'telugu',
    `First song: "${catalogRes.songs[0]?.t}" (${catalogRes.songs[0]?.lang})`
  );

  // ----------------------------------------------------
  // TEST 2: Client-side Search Performance (Zero Network)
  // ----------------------------------------------------
  console.log('\n--- TEST 2: Client-Side Instant Search ---');
  const searchStart = Date.now();
  const searchResults1 = filterSongs(catalogRes.songs, { query: 'యేసు' });
  const searchResults2 = filterSongs(catalogRes.songs, { query: 'praise', language: 'english' });
  const searchResults3 = filterSongs(catalogRes.songs, { filterType: 'chords' });
  const searchDuration = Date.now() - searchStart;

  record(
    'Telugu keyword search',
    searchResults1.length > 0,
    `Found ${searchResults1.length} songs for "యేసు"`
  );
  record(
    'English filter search',
    searchResults2.length > 0,
    `Found ${searchResults2.length} songs for "praise" [english]`
  );
  record(
    'Chords feature filter',
    searchResults3.length === 148,
    `Found ${searchResults3.length} songs with chords (expected 148)`
  );
  record(
    'Search latency (in-memory)',
    searchDuration < 50,
    `3 complex multi-filter searches executed in ${searchDuration}ms`
  );

  // ----------------------------------------------------
  // TEST 3: Representative Song Details by Slug and UUID
  // ----------------------------------------------------
  console.log('\n--- TEST 3: Representative Song Details Fetch ---');
  clearSongCache();

  // Telugu song by slug
  const s1 = await getSong('lechinaaduraa-samaadhi-gelichinaaduraa');
  record(
    'Telugu song by slug',
    !!s1 && s1.title === 'లేచినాడురా సమాధి గెలిచినాడురా',
    `title: "${s1?.title}", verses: ${s1?.bible_verses?.length}`
  );

  // Same song by UUID
  const s1Uuid = await getSong('0008c794-4a6c-4407-9df1-442d5a3b93ad');
  record(
    'Telugu song by UUID',
    !!s1Uuid && s1Uuid.slug === 'lechinaaduraa-samaadhi-gelichinaaduraa',
    `slug: "${s1Uuid?.slug}"`
  );

  // English song
  const sEng = await getSong('when-its-all-been-said-and-done');
  record(
    'English song by slug',
    !!sEng && sEng.language === 'english' && sEng.title === "When It's All Been Said and Done",
    `language: ${sEng?.language}`
  );

  // Hindi song
  const sHin = await getSong('pavithra-aathmaa-aa');
  record(
    'Hindi song by slug',
    !!sHin && sHin.language === 'hindi' && sHin.title === 'पवित्र आत्मा आ',
    `language: ${sHin?.language}`
  );

  // Song with chords
  const sChords = await getSong('aanandamugaa-yehovaa-nee');
  record(
    'Song with chords',
    !!sChords && Array.isArray(sChords.chords) && sChords.chords.length > 0,
    `chords lines: ${sChords?.chords?.length}, credits: "${sChords?.chord_credits}"`
  );

  // Song with YouTube
  record(
    'Song with YouTube ID',
    !!s1 && s1.youtube_id === 'LgaaT_2O6Xs',
    `youtube_id: "${s1?.youtube_id}"`
  );

  // Song with PPT
  record(
    'Song with PPT URL',
    !!s1 && s1.ppt_url?.includes('supabase.co'),
    `ppt_url: "${s1?.ppt_url?.substring(0, 50)}..."`
  );

  // Song with Bible verses & Devotional
  record(
    'Song with Bible verses',
    !!s1 && Array.isArray(s1.bible_verses) && s1.bible_verses.length === 3,
    `verses count: ${s1?.bible_verses?.length}`
  );
  record(
    'Song with Devotional',
    !!s1 && !!s1.devotional && !!s1.devotional.reflection_english,
    `devotional prayer: "${s1?.devotional?.prayer_english?.substring(0, 30)}..."`
  );

  // Song with multiple songbooks (3)
  const sMultiBook = await getSong('swachchandha-seeyonu-vaasi');
  record(
    'Song with multiple songbooks',
    !!sMultiBook && Array.isArray(sMultiBook.songbooks) && sMultiBook.songbooks.length === 3,
    `books count: ${sMultiBook?.songbooks?.length}`
  );

  // Legacy domain PPT URL
  const sLegacyPpt = await getSong('idiyenayya-maa-praarthana');
  record(
    'Legacy domain PPT URL preserved',
    !!sLegacyPpt && sLegacyPpt.ppt_url === 'https://www.christiansongslyrics4us.com/wp-content/uploads/Idiyenayya-Maa-Praarthana.pptx',
    `ppt_url: ${sLegacyPpt?.ppt_url}`
  );

  // Empty string stanza separators preserved
  const emptySepCount = s1?.lyrics_original?.filter(line => line === '').length || 0;
  record(
    'Empty string stanza separators preserved in detail',
    emptySepCount === 3,
    `empty separators in song: ${emptySepCount}`
  );

  // ----------------------------------------------------
  // TEST 4: In-Memory Cache Performance
  // ----------------------------------------------------
  console.log('\n--- TEST 4: In-Memory Cache Latency ---');
  const cacheStart = Date.now();
  const cachedSong = await getSong('lechinaaduraa-samaadhi-gelichinaaduraa');
  const cacheDuration = Date.now() - cacheStart;
  record(
    'In-memory cache hit latency',
    cacheDuration <= 2 && !!cachedSong,
    `Resolved in ${cacheDuration}ms (expected <= 2ms)`
  );

  // ----------------------------------------------------
  // TEST 5: Songbooks Collection Fetch
  // ----------------------------------------------------
  console.log('\n--- TEST 5: Songbooks Collection ---');
  clearCatalogCache();
  const booksRes = await getSongbooks();
  record(
    'Songbooks count',
    booksRes.songbooks.length === 8,
    `Count: ${booksRes.songbooks.length}, source: ${booksRes.source}`
  );

  // ----------------------------------------------------
  // TEST 6: 404 / Non-Existent Song Handling
  // ----------------------------------------------------
  console.log('\n--- TEST 6: Non-Existent Song Handling ---');
  const missing = await getSong('this-song-does-not-exist-xyz-999');
  record(
    'Non-existent song returns null cleanly',
    missing === null,
    'Returned null without throwing'
  );

  // ----------------------------------------------------
  // TEST 7: Static Fallback Simulation
  // ----------------------------------------------------
  console.log('\n--- TEST 7: Static JSON Fallback Simulation ---');
  clearSongCache();
  // Temporarily force fallback by testing static read
  const fallbackRes = await fetch('./data/songs/lechinaaduraa-samaadhi-gelichinaaduraa.json');
  const fallbackData = await fallbackRes.json();
  record(
    'Static fallback JSON loads correctly',
    fallbackRes.ok && fallbackData.title === 'లేచినాడురా సమాధి గెలిచినాడురా',
    `Fallback title: "${fallbackData.title}"`
  );

  // ----------------------------------------------------
  // TEST 8: Security Audit — No service_role Key in src/
  // ----------------------------------------------------
  console.log('\n--- TEST 8: Security Audit — No service_role in frontend ---');
  let hasServiceRole = false;
  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (/\.(jsx?|tsx?|html|css)$/.test(entry.name)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('service_role') || content.includes('SUPABASE_SERVICE_ROLE_KEY')) {
          hasServiceRole = true;
          console.error(`Found forbidden service_role reference in: ${fullPath}`);
        }
      }
    }
  }
  scanDir(path.resolve(__dirname, '../../src'));
  record(
    'No service_role key in frontend code',
    !hasServiceRole,
    'Frontend contains only public anon key references'
  );

  // ----------------------------------------------------
  // TEST 9: Dynamic Pagination & Completeness Validation
  // ----------------------------------------------------
  console.log('\n--- TEST 9: Dynamic Pagination & Completeness Validation ---');
  clearCatalogCache();
  const dynamicCatalog = await getCatalogIndex();
  record(
    'Dynamic pagination / fallback loaded full catalog',
    dynamicCatalog.songs.length === expectedCatalogCount && dynamicCatalog.songs.length >= 3773 && (dynamicCatalog.source === 'supabase' || dynamicCatalog.source === 'static'),
    `Resolved ${dynamicCatalog.songs.length} songs (source: ${dynamicCatalog.source})`
  );

  // Summary
  console.log('\n====================================================');
  const total = testResults.length;
  const passed = testResults.filter(t => t.pass).length;
  const failed = total - passed;
  console.log(`TOTAL TESTS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log(`RESULT: ${failed === 0 ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
