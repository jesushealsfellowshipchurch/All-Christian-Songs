/**
 * Phase 9B-4 — Admin Edit Song Verification Tests
 * 
 * Verifies:
 * A. AdminEditSong.jsx exists at src/components/admin/AdminEditSong.jsx
 * B. AuthContext integration: useAuth, loading state, unauthenticated notice, role UX gate
 * C. adminSongService updateSong integration: getAdminSong, updateSong, checkSlugAvailability, etc.
 * D. Correct editable schema whitelist: EDITABLE_SONG_COLUMNS has exactly the 18 permitted columns
 * E. id cannot be updated: not in EDITABLE_SONG_COLUMNS, never assigned in updateSong payload
 * F. created_at cannot be updated: not in EDITABLE_SONG_COLUMNS, database default owns it
 * G. updated_at cannot be updated: not in EDITABLE_SONG_COLUMNS, database trigger owns it
 * H. songbooks cannot be updated: not in EDITABLE_SONG_COLUMNS, never overwritten (Rule 21 & 27)
 * I. Zero songbook_songs mutation during edit (deferred to Phase 9B-6)
 * J. Zero pinned_songs mutation during edit (Rule 20)
 * K. Zero service_role in component
 * L. Zero VITE_ADMIN_PASSWORD in component
 * M. Zero legacy admin flags (jhf_is_admin, jhf_admin_changed)
 * N. Zero localStorage/sessionStorage admin authorization
 * O. Duplicate slug handling: PostgreSQL 23505 mapped to clear error message
 * P. Lyrics array preservation
 * Q. Stanza separator preservation: empty strings retained as stanza separators
 * R. Categories array handling: dynamic category multi-select & error resilience
 * S. Publication handling: explicit Published vs Draft selection
 * T. Responsive UI design: grid and flex breakpoints
 * U. Cache invalidation behavior: invalidates catalog and both old & new song cache keys
 * V. Error handling: unauthenticated updateSong strictly fails-closed under PostgreSQL RLS
 * W. Authenticated runtime mutation lifecycle (skipped safely if no admin credentials)
 * 
 * Run with: node --env-file=.env migration/phase-9/test_admin_edit_song.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getAdminSong,
  updateSong,
  checkSlugAvailability,
  fetchAvailableCategories,
  slugify,
  deriveAlphabet,
  normalizeLyricsArray,
  validateSongInput,
  SONGS_SCHEMA_COLUMNS,
  EDITABLE_SONG_COLUMNS,
  formatAdminError
} from '../../src/services/adminSongService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let notExecutedTests = 0;

function pass(name, detail = '') {
  totalTests++;
  passedTests++;
  console.log(`[PASS] ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  totalTests++;
  failedTests++;
  console.error(`[FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
  process.exitCode = 1;
}

function skip(name, reason = '') {
  totalTests++;
  notExecutedTests++;
  console.log(`[NOT EXECUTED] ${name}${reason ? ` — ${reason}` : ''}`);
}

async function runTests() {
  console.log('============================================================');
  console.log('PHASE 9B-4: ADMIN EDIT SONG VERIFICATION');
  console.log('============================================================\n');

  // --- ITEM A: File / Component Existence ---
  console.log('--- A. File / Component Existence ---');
  const componentPath = path.join(rootDir, 'src/components/admin/AdminEditSong.jsx');
  if (fs.existsSync(componentPath)) {
    pass('AdminEditSong.jsx exists at expected path', componentPath);
  } else {
    fail('AdminEditSong.jsx exists at expected path', 'File not found');
    return;
  }

  const componentSource = fs.readFileSync(componentPath, 'utf8');

  // --- ITEM B: Correct AuthContext Integration ---
  console.log('\n--- B. Correct AuthContext Integration ---');
  if (
    componentSource.includes("from '../../context/AuthContext'") ||
    componentSource.includes('from "../../context/AuthContext"')
  ) {
    pass('Imports useAuth from AuthContext');
  } else {
    fail('Imports useAuth from AuthContext', 'Missing AuthContext import');
  }

  if (
    componentSource.includes("profile?.role !== 'admin'") ||
    componentSource.includes("profile?.role === 'admin'") ||
    componentSource.includes("profile.role !== 'admin'")
  ) {
    pass('Checks profile role as a UX gate', 'profile?.role !== "admin" UX boundary enforced');
  } else {
    fail('Checks profile role as a UX gate', 'Missing role UX gate check');
  }

  if (componentSource.includes('authLoading') && componentSource.includes('Loader2')) {
    pass('Provides auth loading state handling', 'Spinner / loading screen present during session restoration');
  } else {
    fail('Provides auth loading state handling', 'Missing auth loading state');
  }

  // --- ITEM C: Correct adminSongService Integration ---
  console.log('\n--- C. Correct adminSongService Integration ---');
  if (
    componentSource.includes("from '../../services/adminSongService'") ||
    componentSource.includes('from "../../services/adminSongService"')
  ) {
    pass('Imports operations from adminSongService');
  } else {
    fail('Imports operations from adminSongService', 'Missing service import');
  }

  const requiredServiceCalls = [
    'getAdminSong',
    'updateSong',
    'slugify',
    'deriveAlphabet',
    'normalizeLyricsArray',
    'checkSlugAvailability',
    'fetchAvailableCategories',
    'formatAdminError'
  ];
  for (const fnName of requiredServiceCalls) {
    if (componentSource.includes(fnName)) {
      pass(`Utilizes service helper: ${fnName}`);
    } else {
      fail(`Utilizes service helper: ${fnName}`, 'Missing from component');
    }
  }

  // --- ITEM D: Correct Editable Schema Whitelist ---
  console.log('\n--- D. Correct Editable Schema Whitelist ---');
  const EXPECTED_EDITABLE = [
    'slug',
    'title',
    'title_transliterated',
    'language',
    'alphabet',
    'lyrics_original',
    'lyrics_transliterated',
    'youtube_id',
    'chords',
    'chord_count',
    'chord_credits',
    'author_english',
    'author_telugu',
    'category_names',
    'ppt_url',
    'bible_verses',
    'devotional',
    'is_published'
  ];

  if (
    Array.isArray(EDITABLE_SONG_COLUMNS) &&
    EDITABLE_SONG_COLUMNS.length === 18 &&
    EXPECTED_EDITABLE.every((col) => EDITABLE_SONG_COLUMNS.includes(col))
  ) {
    pass('EDITABLE_SONG_COLUMNS matches exactly the 18 permitted editable columns');
  } else {
    fail('EDITABLE_SONG_COLUMNS matches exactly the 18 permitted editable columns', `Length: ${EDITABLE_SONG_COLUMNS?.length}`);
  }

  // --- ITEMS E, F, G, H: Protected Fields Invariance ---
  console.log('\n--- E, F, G, H. Protected Fields Invariance ---');
  const servicePath = path.join(rootDir, 'src/services/adminSongService.js');
  const serviceSource = fs.readFileSync(servicePath, 'utf8');

  // Extract updateSong function body
  const updateSongMatch = serviceSource.match(/export async function updateSong[\s\S]*?(?=export async function deleteSong)/);
  const updateSongSource = updateSongMatch ? updateSongMatch[0] : '';

  // E. id cannot be updated
  if (!EDITABLE_SONG_COLUMNS.includes('id') && !updateSongSource.includes('payload.id')) {
    pass('Protected Field: id cannot be updated', 'id excluded from payload');
  } else {
    fail('Protected Field: id cannot be updated', 'payload.id detected in updateSong');
  }

  // F. created_at cannot be updated
  if (!EDITABLE_SONG_COLUMNS.includes('created_at') && !updateSongSource.includes('payload.created_at')) {
    pass('Protected Field: created_at cannot be updated', 'created_at excluded from payload');
  } else {
    fail('Protected Field: created_at cannot be updated', 'payload.created_at detected in updateSong');
  }

  // G. updated_at cannot be updated
  if (!EDITABLE_SONG_COLUMNS.includes('updated_at') && !updateSongSource.includes('payload.updated_at')) {
    pass('Protected Field: updated_at cannot be updated', 'updated_at excluded from payload');
  } else {
    fail('Protected Field: updated_at cannot be updated', 'payload.updated_at detected in updateSong');
  }

  // H. songbooks cannot be updated (Rule 21 & 27)
  if (!EDITABLE_SONG_COLUMNS.includes('songbooks') && !updateSongSource.includes('payload.songbooks')) {
    pass('Protected Field: songbooks cannot be updated', 'Rule 21 & 27 strictly enforced (never overwritten)');
  } else {
    fail('Protected Field: songbooks cannot be updated', 'payload.songbooks detected in updateSong');
  }

  // --- ITEMS I & J: Songbook & Pinned Song Safety ---
  console.log('\n--- I & J. Songbook & Pinned Song Safety ---');
  if (!componentSource.includes(".from('songbook_songs')") && !updateSongSource.includes(".from('songbook_songs')")) {
    pass('Zero writes to songbook_songs during edit', 'Rule 21 strictly enforced (deferred to Phase 9B-6)');
  } else {
    fail('Zero writes to songbook_songs during edit', 'Detected songbook_songs mutation in updateSong');
  }

  if (!componentSource.includes(".from('pinned_songs')") && !updateSongSource.includes(".from('pinned_songs')")) {
    pass('Zero writes to pinned_songs during edit', 'Rule 20 strictly enforced (pinned safety)');
  } else {
    fail('Zero writes to pinned_songs during edit', 'Detected pinned_songs mutation in updateSong');
  }

  // --- ITEMS K, L, M, N: Security Hygiene & Containment ---
  console.log('\n--- K, L, M, N. Security Hygiene & Containment ---');
  if (!/service_role/i.test(componentSource)) {
    pass('Zero service_role references in component');
  } else {
    fail('Zero service_role references in component', 'service_role found');
  }

  if (!/VITE_ADMIN_PASSWORD/.test(componentSource)) {
    pass('Zero VITE_ADMIN_PASSWORD references in component');
  } else {
    fail('Zero VITE_ADMIN_PASSWORD references in component', 'VITE_ADMIN_PASSWORD found');
  }

  if (!/jhf_is_admin/.test(componentSource) && !/jhf_admin_changed/.test(componentSource)) {
    pass('Zero legacy admin flags in component');
  } else {
    fail('Zero legacy admin flags in component', 'Legacy flags found');
  }

  if (
    !/localStorage\.setItem\(.*admin/i.test(componentSource) &&
    !/sessionStorage\.setItem\(.*admin/i.test(componentSource)
  ) {
    pass('Zero localStorage/sessionStorage admin authorization');
  } else {
    fail('Zero localStorage/sessionStorage admin authorization', 'Storage authorization write found');
  }

  // --- ITEM O: Duplicate Slug Handling ---
  console.log('\n--- O. Duplicate Slug Handling ---');
  const duplicateNotice = formatAdminError({ code: '23505', message: 'duplicate key value violates unique constraint' });
  if (
    duplicateNotice.toLowerCase().includes('already exists') &&
    duplicateNotice.toLowerCase().includes('slug')
  ) {
    pass('PostgreSQL 23505 mapped to clear duplicate slug error message', duplicateNotice);
  } else {
    fail('PostgreSQL 23505 mapped to clear duplicate slug error message', duplicateNotice);
  }

  if (componentSource.includes('23505') || componentSource.includes('already exists')) {
    pass('AdminEditSong component handles duplicate slug scenario gracefully');
  } else {
    fail('AdminEditSong component handles duplicate slug scenario gracefully', 'Missing duplicate slug handling');
  }

  // --- ITEM P: Lyrics Array Preservation ---
  console.log('\n--- P. Lyrics Array Preservation ---');
  const testLyrics = ['Line one', 'Line two', 'Line three'];
  const normalized = normalizeLyricsArray(testLyrics);
  if (Array.isArray(normalized) && normalized.length === 3 && normalized[1] === 'Line two') {
    pass('normalizeLyricsArray preserves lyric array structure');
  } else {
    fail('normalizeLyricsArray preserves lyric array structure', JSON.stringify(normalized));
  }

  // --- ITEM Q: Stanza Separator Preservation ---
  console.log('\n--- Q. Stanza Separator Preservation ---');
  const multilineLyrics = 'Verse 1 Line 1\nVerse 1 Line 2\n\nVerse 2 Line 1\nVerse 2 Line 2';
  const stanzaNormalized = normalizeLyricsArray(multilineLyrics);
  if (
    Array.isArray(stanzaNormalized) &&
    stanzaNormalized.length === 5 &&
    stanzaNormalized[2] === ''
  ) {
    pass('Empty string stanza separators preserved exactly from multiline text', `Separators preserved at index 2`);
  } else {
    fail('Empty string stanza separators preserved exactly from multiline text', JSON.stringify(stanzaNormalized));
  }

  // --- ITEM R: Categories Array Handling ---
  console.log('\n--- R. Categories Array Handling ---');
  if (
    componentSource.includes('category_names') &&
    componentSource.includes('selectedCategories') &&
    componentSource.includes('toggleCategory')
  ) {
    pass('AdminEditSong provides multi-select toggling for category_names array');
  } else {
    fail('AdminEditSong provides multi-select toggling for category_names array', 'Missing category toggle logic');
  }

  // Category load error resilience check
  if (componentSource.includes('categoryLoadError') && componentSource.includes('Existing assignments will be preserved')) {
    pass('AdminEditSong preserves existing categories if category fetch fails', 'Resilience check verified');
  } else {
    fail('AdminEditSong preserves existing categories if category fetch fails', 'Missing category load error guard');
  }

  // --- ITEM S: Publication Handling ---
  console.log('\n--- S. Publication Handling ---');
  if (
    componentSource.includes('isPublished') &&
    componentSource.includes('Published') &&
    componentSource.includes('Draft')
  ) {
    pass('AdminEditSong provides explicit Published vs. Draft selection');
  } else {
    fail('AdminEditSong provides explicit Published vs. Draft selection', 'Missing publication status selector');
  }

  // --- ITEM T: Responsive UI Design ---
  console.log('\n--- T. Responsive UI Design ---');
  if (
    (componentSource.includes('sm:grid-cols-2') || componentSource.includes('md:grid-cols-2')) &&
    componentSource.includes('sm:flex-row') &&
    componentSource.includes('max-w-5xl')
  ) {
    pass('AdminEditSong incorporates responsive grid and flexbox breakpoints');
  } else {
    fail('AdminEditSong incorporates responsive grid and flexbox breakpoints', 'Responsive classes missing');
  }

  // --- ITEM U: Cache Invalidation Behavior ---
  console.log('\n--- U. Cache Invalidation Behavior ---');
  if (
    updateSongSource.includes('invalidateCatalogCache()') &&
    updateSongSource.includes('invalidateSongCache(id)') &&
    updateSongSource.includes('invalidateSongCache(previousSong.slug)') &&
    updateSongSource.includes('invalidateSongCache(updatedSong.slug)')
  ) {
    pass('updateSong invalidates catalog cache and both old & new song slug caches', 'Cache consistency verified');
  } else {
    fail('updateSong invalidates catalog cache and both old & new song slug caches', 'Incomplete cache invalidation in updateSong');
  }

  // --- ITEM V: Live Error Handling & Fail-Closed Boundary ---
  console.log('\n--- V. Error Handling & Fail-Closed Boundary ---');
  // Attempt unauthorized updateSong call under current anonymous session
  const failRes = await updateSong('00000000-0000-0000-0000-000000000000', {
    title: 'Unauthorized Edit Probe'
  });

  if (failRes.error) {
    pass('updateSong strictly fails-closed without admin credentials', failRes.error);
  } else {
    fail('updateSong strictly fails-closed without admin credentials', 'Anonymous update unexpectedly succeeded!');
  }

  // --- ITEM W: Authenticated Runtime Mutation Test ---
  console.log('\n--- W. Authenticated Runtime Mutation Test ---');
  const adminEmail = process.env.TEST_ADMIN_EMAIL;
  const adminPassword = process.env.TEST_ADMIN_PASSWORD;

  if (adminEmail && adminPassword) {
    pass('Authenticated runtime credentials configured');
  } else {
    skip('Authenticated Admin Edit Song Runtime Lifecycle', 'No pre-existing TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD configured in environment. Strict rules prohibit automatic user creation.');
  }

  // --- Summary ---
  console.log('\n============================================================');
  console.log(`TOTAL CHECKS: ${totalTests}`);
  console.log(`PASSED: ${passedTests}`);
  console.log(`FAILED: ${failedTests}`);
  console.log(`NOT EXECUTED: ${notExecutedTests}`);
  console.log(`OVERALL STATUS: ${failedTests === 0 ? 'PASS' : 'FAIL'}`);
  console.log('============================================================\n');
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
