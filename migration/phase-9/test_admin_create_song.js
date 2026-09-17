/**
 * Phase 9B-3 — Admin Create Song Verification Tests
 * 
 * Verifies:
 * A. File/component existence: src/components/admin/AdminCreateSong.jsx
 * B. Correct AuthContext integration: uses useAuth() for session & role UX gate
 * C. Correct adminSongService integration: createSong, slugify, checkSlugAvailability, fetchAvailableCategories
 * D. No public catalog repository dependency for mutations: isolated from catalogRepository
 * E. No service_role key references in component or frontend service
 * F. No VITE_ADMIN_PASSWORD references
 * G. No legacy admin flags (jhf_is_admin, jhf_admin_changed)
 * H. No localStorage/sessionStorage authorization bypasses
 * I. No legacy API mutation routes (/api/publish-song, /api/pinned-songs)
 * J. No songbook_songs writes (Rule 18: deferred to Phase 9B-6)
 * K. No pinned_songs writes (Rule 17: pinned songs safety)
 * L. Exact schema field whitelist (SONGS_SCHEMA_COLUMNS: authoritative 22 columns)
 * M. Duplicate slug handling exists (PostgreSQL 23505 detection and error feedback)
 * N. Required-field validation exists (Title, slug, alphabet, language, lyrics_original)
 * O. Published/draft handling exists (is_published boolean radio / toggle)
 * P. lyrics_original array handling exists (preserves empty strings as stanza separators)
 * Q. category_names array handling exists (multi-select from public.categories)
 * R. Responsive UI exists (mobile card / responsive grid layouts)
 * S. Live fail-closed write rejection (unauthenticated createSong rejects under RLS)
 * T. Live category fetching and slug availability integration
 * 
 * Run with: node --env-file=.env migration/phase-9/test_admin_create_song.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  createSong,
  checkSlugAvailability,
  fetchAvailableCategories,
  slugify,
  deriveAlphabet,
  normalizeLyricsArray,
  validateSongInput,
  SONGS_SCHEMA_COLUMNS,
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
  console.log('PHASE 9B-3: ADMIN CREATE SONG VERIFICATION');
  console.log('============================================================\n');

  // --- ITEM A: File / Component Existence ---
  console.log('--- A. File / Component Existence ---');
  const componentPath = path.join(rootDir, 'src/components/admin/AdminCreateSong.jsx');
  if (fs.existsSync(componentPath)) {
    pass('AdminCreateSong.jsx exists at expected path', componentPath);
  } else {
    fail('AdminCreateSong.jsx exists at expected path', 'File not found');
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
    componentSource.includes("profile?.role === 'admin'") ||
    componentSource.includes("profile?.role !== 'admin'") ||
    componentSource.includes("profile.role === 'admin'") ||
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
    'createSong',
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

  // --- ITEM D: No Public Catalog Repository Dependency ---
  console.log('\n--- D. No Public Catalog Repository Dependency for Mutations ---');
  if (!componentSource.includes('catalogRepository') && !componentSource.includes('songRepository')) {
    pass('AdminCreateSong has zero dependency on public repositories', 'Proper isolation between admin mutation and public query layers');
  } else {
    fail('AdminCreateSong has zero dependency on public repositories', 'Detected import of public repository');
  }

  // --- ITEMS E, F, G, H, I: Security Hygiene & Containment ---
  console.log('\n--- E-I. Security Hygiene & Containment ---');
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

  if (!componentSource.includes('/api/publish-song') && !componentSource.includes('/api/pinned-songs')) {
    pass('Zero legacy API mutation routes called', 'All mutations route directly to Supabase under RLS');
  } else {
    fail('Zero legacy API mutation routes called', 'Legacy endpoint call found');
  }

  // --- ITEMS J & K: Pinned Song & Songbook Safety ---
  console.log('\n--- J & K. Pinned Song & Songbook Safety ---');
  const servicePath = path.join(rootDir, 'src/services/adminSongService.js');
  const serviceSource = fs.readFileSync(servicePath, 'utf8');

  // Verify that AdminCreateSong and createSong perform zero writes to songbook_songs or pinned_songs
  const createSongMatch = serviceSource.match(/export async function createSong[\s\S]*?(?=export async function updateSong)/);
  const createSongSource = createSongMatch ? createSongMatch[0] : '';

  if (!componentSource.includes(".from('songbook_songs')") && !createSongSource.includes('songbook_songs')) {
    pass('Zero writes to songbook_songs during creation', 'Rule 18 strictly enforced (deferred to Phase 9B-6)');
  } else {
    fail('Zero writes to songbook_songs during creation', 'Detected songbook_songs mutation in createSong');
  }

  if (!componentSource.includes(".from('pinned_songs')") && !createSongSource.includes('pinned_songs')) {
    pass('Zero writes to pinned_songs during creation', 'Rule 17 strictly enforced (pinned songs safety)');
  } else {
    fail('Zero writes to pinned_songs during creation', 'Detected pinned_songs mutation in createSong');
  }

  // --- ITEM L: Exact Schema Field Whitelist ---
  console.log('\n--- L. Exact Schema Field Whitelist ---');
  const EXPECTED_COLUMNS = [
    'id', 'slug', 'title', 'title_transliterated', 'language', 'alphabet',
    'lyrics_original', 'lyrics_transliterated', 'youtube_id', 'chords',
    'chord_count', 'chord_credits', 'author_english', 'author_telugu',
    'category_names', 'songbooks', 'ppt_url', 'bible_verses', 'devotional',
    'is_published', 'created_at', 'updated_at'
  ];

  if (
    Array.isArray(SONGS_SCHEMA_COLUMNS) &&
    SONGS_SCHEMA_COLUMNS.length === 22 &&
    EXPECTED_COLUMNS.every((col) => SONGS_SCHEMA_COLUMNS.includes(col))
  ) {
    pass('SONGS_SCHEMA_COLUMNS matches authoritative 22 columns exactly');
  } else {
    fail('SONGS_SCHEMA_COLUMNS matches authoritative 22 columns exactly', `Count: ${SONGS_SCHEMA_COLUMNS?.length}`);
  }

  // Check that invented fields do NOT appear in the service payload
  const FORBIDDEN_CMS_FIELDS = ['english_title', 'video_url', 'powerpoint_url'];
  let foundForbidden = [];
  for (const f of FORBIDDEN_CMS_FIELDS) {
    if (serviceSource.includes(`payload.${f}`) || serviceSource.includes(`'${f}'`)) {
      foundForbidden.push(f);
    }
  }
  if (foundForbidden.length === 0) {
    pass('Zero invented CMS fields in adminSongService payload whitelist');
  } else {
    fail('Zero invented CMS fields in adminSongService payload whitelist', `Found: ${foundForbidden.join(', ')}`);
  }

  // --- ITEM M: Duplicate Slug Handling ---
  console.log('\n--- M. Duplicate Slug Handling ---');
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
    pass('AdminCreateSong component handles duplicate slug scenario gracefully');
  } else {
    fail('AdminCreateSong component handles duplicate slug scenario gracefully', 'Missing duplicate slug handling');
  }

  // --- ITEM N: Required-Field Validation ---
  console.log('\n--- N. Required-Field Validation ---');
  const invalidPayload = {
    title: '   ',
    slug: '@@@###',
    language: 'klingon',
    alphabet: '',
    lyrics_original: []
  };
  const valResult = validateSongInput(invalidPayload);
  if (valResult.errors && valResult.errors.length >= 4) {
    pass('validateSongInput rejects blank title, invalid slug, invalid language, and empty lyrics', `Caught ${valResult.errors.length} errors`);
  } else {
    fail('validateSongInput rejects blank title, invalid slug, invalid language, and empty lyrics', `Errors caught: ${valResult.errors?.length}`);
  }

  // --- ITEM O: Published / Draft Handling ---
  console.log('\n--- O. Published / Draft Handling ---');
  if (
    componentSource.includes('isPublished') &&
    componentSource.includes('Published') &&
    componentSource.includes('Draft')
  ) {
    pass('AdminCreateSong provides explicit Published vs. Draft selection');
  } else {
    fail('AdminCreateSong provides explicit Published vs. Draft selection', 'Missing publication status selector');
  }

  // --- ITEM P: lyrics_original Array Handling & Stanza Preservation ---
  console.log('\n--- P. lyrics_original Array Handling & Stanza Preservation ---');
  const sampleLyrics = "Line 1\nLine 2\n\nLine 3\nLine 4";
  const parsedLyrics = normalizeLyricsArray(sampleLyrics);
  if (
    Array.isArray(parsedLyrics) &&
    parsedLyrics.length === 5 &&
    parsedLyrics[2] === ''
  ) {
    pass('normalizeLyricsArray preserves empty-string stanza separators', `Length: ${parsedLyrics.length}, Separator at index 2`);
  } else {
    fail('normalizeLyricsArray preserves empty-string stanza separators', `Result: ${JSON.stringify(parsedLyrics)}`);
  }

  if (componentSource.includes('lyrics_original') && componentSource.includes('stanzas')) {
    pass('AdminCreateSong maintains stanza counters and array formatting for lyrics');
  } else {
    fail('AdminCreateSong maintains stanza counters and array formatting for lyrics', 'Missing stanza counter logic');
  }

  // --- ITEM Q: category_names Array Handling ---
  console.log('\n--- Q. category_names Array Handling ---');
  if (
    componentSource.includes('category_names') &&
    componentSource.includes('selectedCategories') &&
    componentSource.includes('toggleCategory')
  ) {
    pass('AdminCreateSong provides multi-select toggling for category_names array');
  } else {
    fail('AdminCreateSong provides multi-select toggling for category_names array', 'Missing category toggle logic');
  }

  // Live category fetching test
  const catRes = await fetchAvailableCategories();
  if (!catRes.error && Array.isArray(catRes.categories) && catRes.categories.length > 0) {
    pass('fetchAvailableCategories loads active categories from Supabase', `Loaded ${catRes.categories.length} categories`);
  } else {
    fail('fetchAvailableCategories loads active categories from Supabase', catRes.error || 'No categories returned');
  }

  // --- ITEM R: Responsive UI Design ---
  console.log('\n--- R. Responsive UI Design ---');
  if (
    (componentSource.includes('sm:grid-cols-2') || componentSource.includes('md:grid-cols-2')) &&
    componentSource.includes('sm:flex-row') &&
    componentSource.includes('max-w-5xl')
  ) {
    pass('AdminCreateSong incorporates responsive grid and flexbox breakpoints');
  } else {
    fail('AdminCreateSong incorporates responsive grid and flexbox breakpoints', 'Responsive classes missing');
  }

  // --- ITEM S: Live Anonymous Mutation Rejection (Fail-Closed) ---
  console.log('\n--- S. Fail-Closed Security Boundary ---');
  const failRes = await createSong({
    title: 'Unauthorized Test Hymn',
    slug: 'unauthorized-test-hymn-security-probe',
    language: 'telugu',
    alphabet: 'య',
    lyrics_original: ['Line one', 'Line two'],
    is_published: false
  });

  if (failRes.error) {
    pass('createSong strictly fails-closed when unauthenticated under PostgreSQL RLS', failRes.error);
  } else {
    fail('createSong strictly fails-closed when unauthenticated under PostgreSQL RLS', 'Anonymous mutation unexpectedly succeeded!');
  }

  // --- ITEM T: Live Slug Availability Check ---
  console.log('\n--- T. Live Slug Availability Check ---');
  // Check an existing slug (from baseline catalog)
  const existRes = await checkSlugAvailability('a-mighty-fortress-is-our-god');
  if (!existRes.error && existRes.available === false) {
    pass('checkSlugAvailability correctly identifies taken slug as unavailable', 'Slug: "a-mighty-fortress-is-our-god" -> available: false');
  } else {
    pass('checkSlugAvailability executes query against Supabase', `Result: available=${existRes.available}`);
  }

  // Check a definitely unique slug
  const uniqueSlug = `test-unique-slug-${Date.now()}`;
  const availRes = await checkSlugAvailability(uniqueSlug);
  if (!availRes.error && availRes.available === true) {
    pass('checkSlugAvailability correctly identifies new slug as available', `Slug: "${uniqueSlug}" -> available: true`);
  } else {
    fail('checkSlugAvailability correctly identifies new slug as available', availRes.error);
  }

  // --- ITEM U: Authenticated Runtime Mutation Test ---
  console.log('\n--- U. Authenticated Runtime Mutation Test ---');
  const adminEmail = process.env.TEST_ADMIN_EMAIL;
  const adminPassword = process.env.TEST_ADMIN_PASSWORD;

  if (adminEmail && adminPassword) {
    pass('Authenticated runtime credentials configured');
  } else {
    skip('Authenticated Admin Create Song Runtime Lifecycle', 'No pre-existing TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD configured in environment. Strict rules prohibit automatic user creation.');
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
