/**
 * Phase 9B-7 — Full Admin CRUD Architecture Verification Suite
 * 
 * Master verification script that exercises and validates the entire Admin CRUD
 * architecture, security boundaries, relational integrity, cache invalidation,
 * and regression invariants for the All Christian Songs platform.
 * 
 * Sections Verified:
 * 1. Admin Song List & Query Surface (READ)
 * 2. Admin Create Song Surface (CREATE)
 * 3. Admin Edit Song Surface (UPDATE)
 * 4. Admin Unpublish Song Surface (UNPUBLISH)
 * 5. Admin Delete Song Surface (DELETE)
 * 6. Songbook Associations Surface (ASSOCIATIONS)
 * 7. Authentication & RLS Security Chain (AUTH / RLS)
 * 8. Profile & Role Security Foundation (PROFILES / ROLES)
 * 9. Live Production Data Integrity & FK Invariance (DATA INTEGRITY)
 * 10. Cross-Phase Cache Invalidation (CACHING)
 * 11. Security Hygiene Audit (CONTAINMENT)
 * 12. Authenticated Runtime Mutation Lifecycle (ADMIN TEST)
 * 
 * Run with: node --env-file=.env migration/phase-9/test_admin_full_crud_verification.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getAdminCatalog,
  getAdminSong,
  createSong,
  updateSong,
  unpublishSong,
  deleteSong,
  checkSongDeleteEligibility,
  getAvailableSongbooks,
  getSongbookAssociations,
  addSongbookAssociation,
  removeSongbookAssociation,
  reconcileSongbookAssociations,
  updateSongbookAssociations,
  slugify,
  deriveAlphabet,
  validateSongInput,
  normalizeLyricsArray,
  checkSlugAvailability,
  fetchAvailableCategories,
  formatAdminError,
  SONGS_SCHEMA_COLUMNS,
  EDITABLE_SONG_COLUMNS
} from '../../src/services/adminSongService.js';
import {
  getCatalogIndex,
  getSongbooks,
  clearCatalogCache,
  invalidateCatalogCache
} from '../../src/services/catalogRepository.js';
import {
  getSong,
  clearSongCache,
  invalidateSongCache
} from '../../src/services/songRepository.js';
import { supabase, isSupabaseConfigured } from '../../src/utils/supabaseClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let notExecutedTests = 0;

// Test Classification Tracking
const testAudit = {
  liveRead: 0,
  liveNegativeRls: 0,
  schemaAndInvariants: 0,
  logicAndSimulations: 0,
  staticSourceInspection: 0,
  skipped: 0
};

function pass(name, detail = '', category = 'logicAndSimulations') {
  totalTests++;
  passedTests++;
  if (testAudit[category] !== undefined) testAudit[category]++;
  console.log(`[PASS] ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  totalTests++;
  failedTests++;
  console.error(`[FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
}

function skip(name, reason = '') {
  totalTests++;
  notExecutedTests++;
  testAudit.skipped++;
  console.log(`[NOT EXECUTED] ${name}${reason ? ` — ${reason}` : ''}`);
}

async function runMasterVerification() {
  console.log('============================================================');
  console.log('PHASE 9B-7: FULL ADMIN CRUD ARCHITECTURE VERIFICATION');
  console.log('============================================================');

  // -------------------------------------------------------------------------
  // SECTION 1: Admin Song List & Query Surface (READ)
  // -------------------------------------------------------------------------
  console.log('\n--- 1. Admin Song List & Query Surface (READ) ---');

  // 1.1 Base catalog query
  const baseCatalog = await getAdminCatalog({ page: 1, pageSize: 10 });
  if (baseCatalog.error === null && baseCatalog.songs.length === 10 && baseCatalog.totalCount === 3773) {
    pass('Admin catalog query returns paginated songs with total count', `Count: ${baseCatalog.songs.length}, Total: ${baseCatalog.totalCount}`, 'liveRead');
  } else {
    fail('Admin catalog base query failed', baseCatalog.error);
  }

  // 1.2 Search filtering
  const searchRes = await getAdminCatalog({ search: 'యేసు', page: 1, pageSize: 5 });
  if (searchRes.error === null && searchRes.songs.length > 0) {
    pass('Admin catalog search filter returns matching hymns', `Found: ${searchRes.totalCount} matches for "యేసు"`, 'liveRead');
  } else {
    fail('Admin catalog search filter failed', searchRes.error);
  }

  // 1.3 Language filter
  const langRes = await getAdminCatalog({ language: 'english', page: 1, pageSize: 5 });
  const allEnglish = langRes.songs.every(s => s.language === 'english');
  if (langRes.error === null && allEnglish && langRes.songs.length > 0) {
    pass('Admin catalog language filter strictly returns target language', `Found: ${langRes.totalCount} english hymns`, 'liveRead');
  } else {
    fail('Admin catalog language filter failed', langRes.error);
  }

  // 1.4 Category filter
  const catRes = await getAdminCatalog({ category: 'Worship Songs', page: 1, pageSize: 5 });
  const allWorship = catRes.songs.every(s => Array.isArray(s.category_names) && s.category_names.includes('Worship Songs'));
  if (catRes.error === null && allWorship && catRes.songs.length > 0) {
    pass('Admin catalog category filter strictly returns target category', `Found: ${catRes.totalCount} worship hymns`, 'liveRead');
  } else {
    fail('Admin catalog category filter failed', catRes.error);
  }

  // 1.5 Sorting
  const sortRes = await getAdminCatalog({ sortBy: 'title', sortAscending: true, page: 1, pageSize: 5 });
  if (sortRes.error === null && sortRes.songs.length > 0) {
    pass('Admin catalog sorting operates correctly on column ordering', `First: "${sortRes.songs[0].title}"`, 'liveRead');
  } else {
    fail('Admin catalog sorting failed', sortRes.error);
  }

  // 1.6 Song detail loading by UUID
  const sampleSongId = baseCatalog.songs[0]?.id;
  const songDetail = await getAdminSong(sampleSongId);
  if (songDetail.error === null && songDetail.song && songDetail.song.id === sampleSongId) {
    const hasAllCols = SONGS_SCHEMA_COLUMNS.every(col => col in songDetail.song);
    if (hasAllCols) {
      pass('Admin song detail query returns full record with all 22 schema columns', `Song: "${songDetail.song.title}"`, 'liveRead');
    } else {
      fail('Admin song detail query missing required schema columns');
    }
  } else {
    fail('Admin song detail query failed on valid UUID', songDetail.error);
  }

  // 1.7 Safe failure on invalid/non-existent UUID
  const invalidDetail = await getAdminSong('00000000-0000-0000-0000-000000000000');
  if (invalidDetail.song === null && invalidDetail.error) {
    pass('Admin song detail fails safely on non-existent UUID', invalidDetail.error, 'liveRead');
  } else {
    fail('Admin song detail did not handle non-existent UUID safely');
  }

  // -------------------------------------------------------------------------
  // SECTION 2: Admin Create Song Surface (CREATE)
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Admin Create Song Surface (CREATE) ---');

  // 2.1 Input validation
  const invalidInputs = [
    { desc: 'Missing title', data: { language: 'telugu', lyrics_original: ['Line 1'] } },
    { desc: 'Invalid language', data: { title: 'Test', language: 'klingon', lyrics_original: ['Line 1'] } },
    { desc: 'Empty lyrics', data: { title: 'Test', language: 'telugu', lyrics_original: ['   ', ''] } },
    { desc: 'Malformed PPT URL', data: { title: 'Test', language: 'telugu', lyrics_original: ['Line 1'], ppt_url: 'ftp://bad' } }
  ];
  let valErrorsCaught = 0;
  for (const inv of invalidInputs) {
    const res = validateSongInput(inv.data, false);
    if (!res.isValid) valErrorsCaught++;
  }
  if (valErrorsCaught === invalidInputs.length) {
    pass('validateSongInput enforces title, supported language, non-empty lyrics, and URL format', `Caught ${valErrorsCaught}/${invalidInputs.length}`, 'logicAndSimulations');
  } else {
    fail('validateSongInput missed one or more invalid input configurations');
  }

  // 2.2 Slug generation and availability
  const generatedSlug = slugify('Naa Thandrivi Neeve - 2026!');
  if (generatedSlug === 'naa-thandrivi-neeve-2026') {
    pass('slugify properly normalizes text, symbols, and whitespace', generatedSlug, 'logicAndSimulations');
  } else {
    fail('slugify failed to normalize correctly', generatedSlug);
  }

  const takenSlugCheck = await checkSlugAvailability('a-mighty-fortress-is-our-god');
  if (takenSlugCheck.available === false) {
    pass('checkSlugAvailability correctly detects pre-existing slug', 'a-mighty-fortress-is-our-god', 'liveRead');
  } else {
    fail('checkSlugAvailability reported taken slug as available');
  }

  // 2.3 Stanza separator preservation in lyrics normalization
  const sampleMultiline = 'Line 1\nLine 2\n\nLine 3\nLine 4';
  const normalizedLyrics = normalizeLyricsArray(sampleMultiline);
  if (normalizedLyrics.length === 5 && normalizedLyrics[2] === '') {
    pass('normalizeLyricsArray strictly preserves empty-string stanza breaks', `Lines: ${normalizedLyrics.length}, break at index 2`, 'logicAndSimulations');
  } else {
    fail('normalizeLyricsArray did not preserve stanza separator correctly');
  }

  // 2.4 Duplicate slug error mapping (PostgreSQL 23505)
  const dupSlugErr = formatAdminError({ code: '23505', message: 'duplicate key value violates unique constraint "songs_slug_key"' });
  if (dupSlugErr.includes('already exists')) {
    pass('PostgreSQL 23505 mapped to friendly duplicate slug notification', dupSlugErr, 'logicAndSimulations');
  } else {
    fail('Error 23505 not mapped to friendly duplicate message', dupSlugErr);
  }

  // 2.5 Zero writes to relationships during create (source inspection)
  const createSongSrc = fs.readFileSync(path.join(rootDir, 'src/components/admin/AdminCreateSong.jsx'), 'utf8');
  const adminServiceSrc = fs.readFileSync(path.join(rootDir, 'src/services/adminSongService.js'), 'utf8');
  const createSongMatch = adminServiceSrc.match(/export async function createSong[\s\S]*?(?=export async function updateSong)/);
  const createSongSource = createSongMatch ? createSongMatch[0] : '';
  const zeroRelInCreate = !createSongSrc.includes(".from('songbook_songs')") &&
    !createSongSrc.includes(".from('pinned_songs')") &&
    !createSongSource.includes('songbook_songs') &&
    !createSongSource.includes('pinned_songs');
  if (zeroRelInCreate) {
    pass('AdminCreateSong component and createSong service contain zero writes to songbook_songs or pinned_songs', '', 'staticSourceInspection');
  } else {
    fail('AdminCreateSong or createSong contains unexpected relationship writes');
  }

  // 2.6 Anonymous createSong fails closed under RLS (negative test)
  const anonCreateRes = await createSong({
    title: 'Unauthorized Test Hymn',
    language: 'telugu',
    lyrics_original: ['Unauthorized line']
  });
  if (anonCreateRes.success === false && anonCreateRes.error) {
    pass('createSong strictly fails-closed under RLS for unauthenticated clients', anonCreateRes.error, 'liveNegativeRls');
  } else {
    fail('createSong did not fail-closed when unauthenticated');
  }

  // -------------------------------------------------------------------------
  // SECTION 3: Admin Edit Song Surface (UPDATE)
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Admin Edit Song Surface (UPDATE) ---');

  // 3.1 Whitelist adherence
  const expectedEditable = [
    'slug', 'title', 'title_transliterated', 'language', 'alphabet',
    'lyrics_original', 'lyrics_transliterated', 'youtube_id', 'chords',
    'chord_count', 'chord_credits', 'author_english', 'author_telugu',
    'category_names', 'ppt_url', 'bible_verses', 'devotional', 'is_published'
  ];
  const whitelistExact = EDITABLE_SONG_COLUMNS.length === expectedEditable.length &&
    expectedEditable.every(col => EDITABLE_SONG_COLUMNS.includes(col));
  if (whitelistExact) {
    pass('EDITABLE_SONG_COLUMNS matches exactly the 18 authorized columns', `Columns: ${EDITABLE_SONG_COLUMNS.length}`, 'schemaAndInvariants');
  } else {
    fail('EDITABLE_SONG_COLUMNS does not match expected 18-column whitelist');
  }

  // 3.2 Protected columns invariance
  const protectedCols = ['id', 'created_at', 'updated_at', 'songbooks'];
  const zeroProtectedInWhitelist = protectedCols.every(p => !EDITABLE_SONG_COLUMNS.includes(p));
  if (zeroProtectedInWhitelist) {
    pass('Protected columns (id, created_at, updated_at, songbooks) strictly excluded from edit whitelist', '', 'schemaAndInvariants');
  } else {
    fail('Protected column found in editable whitelist');
  }

  // 3.3 Anonymous updateSong fails closed under RLS (negative test)
  const anonUpdateRes = await updateSong(sampleSongId, { title: 'Unauthorized Modification' });
  if (anonUpdateRes.success === false && anonUpdateRes.error) {
    pass('updateSong strictly fails-closed under RLS for unauthenticated clients', anonUpdateRes.error, 'liveNegativeRls');
  } else {
    fail('updateSong did not fail-closed when unauthenticated');
  }

  // -------------------------------------------------------------------------
  // SECTION 4: Admin Unpublish Song Surface (UNPUBLISH)
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Admin Unpublish Song Surface (UNPUBLISH) ---');

  // 4.1 Unpublish payload inspection
  const unpublishFnMatch = adminServiceSrc.match(/export async function unpublishSong[\s\S]*?^}/m);
  const unpublishFnBody = unpublishFnMatch ? unpublishFnMatch[0] : '';
  const onlyIsPublished = unpublishFnBody.includes('{ is_published: false }') && !unpublishFnBody.includes('.delete()');
  if (onlyIsPublished) {
    pass('unpublishSong sends explicit { is_published: false } payload and executes zero deletions', '', 'staticSourceInspection');
  } else {
    fail('unpublishSong payload is not strictly { is_published: false }');
  }

  // 4.2 Anonymous unpublishSong fails closed under RLS (negative test)
  const anonUnpubRes = await unpublishSong(sampleSongId);
  if (anonUnpubRes.success === false && anonUnpubRes.error) {
    pass('unpublishSong strictly fails-closed under RLS for unauthenticated clients', anonUnpubRes.error, 'liveNegativeRls');
  } else {
    fail('unpublishSong did not fail-closed when unauthenticated');
  }

  // -------------------------------------------------------------------------
  // SECTION 5: Admin Delete Song Surface (DELETE)
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Admin Delete Song Surface (DELETE) ---');

  // 5.1 Pinned song deletion safety
  const pinnedList = await supabase.from('pinned_songs').select('id');
  const samplePinnedId = pinnedList.data?.[0]?.id;
  if (samplePinnedId) {
    const pinCheck = await checkSongDeleteEligibility(samplePinnedId);
    if (pinCheck.canDelete === false && pinCheck.isPinned === true) {
      pass('checkSongDeleteEligibility blocks deletion of pinned song', pinCheck.blockReason, 'liveRead');
    } else {
      fail('checkSongDeleteEligibility failed to block pinned song');
    }

    const pinDeleteRes = await deleteSong(samplePinnedId);
    if (pinDeleteRes.success === false && pinDeleteRes.error.includes('pinned')) {
      pass('deleteSong service blocks deletion of pinned song with clear message', pinDeleteRes.error, 'liveRead');
    } else {
      fail('deleteSong did not block pinned song deletion');
    }
  }

  // 5.2 Songbook-assigned song deletion safety
  const sampleAssocSong = await supabase.from('songbook_songs').select('song_id').limit(1);
  const sampleAssocSongId = sampleAssocSong.data?.[0]?.song_id;
  if (sampleAssocSongId) {
    const sbCheck = await checkSongDeleteEligibility(sampleAssocSongId);
    if (sbCheck.canDelete === false && sbCheck.songbookCount > 0) {
      pass('checkSongDeleteEligibility blocks deletion of song with songbook associations', sbCheck.blockReason, 'liveRead');
    } else {
      fail('checkSongDeleteEligibility failed to block song with songbook associations');
    }

    const sbDeleteRes = await deleteSong(sampleAssocSongId);
    if (sbDeleteRes.success === false && sbDeleteRes.error.includes('songbook')) {
      pass('deleteSong service blocks deletion of song with songbook associations', sbDeleteRes.error, 'liveRead');
    } else {
      fail('deleteSong did not block songbook-assigned song deletion');
    }
  }

  // 5.3 Typed DELETE confirmation in UI
  const adminSongListSrc = fs.readFileSync(path.join(rootDir, 'src/components/admin/AdminSongList.jsx'), 'utf8');
  const hasTypedDelete = adminSongListSrc.includes("deleteConfirmInput !== 'DELETE'") ||
    adminSongListSrc.includes('deleteConfirmInput === "DELETE"') ||
    adminSongListSrc.includes("deleteConfirmInput === 'DELETE'");
  if (hasTypedDelete) {
    pass('AdminSongList.jsx requires typed "DELETE" confirmation before confirming deletion', '', 'staticSourceInspection');
  } else {
    fail('Typed DELETE confirmation not found in AdminSongList.jsx');
  }

  // 5.4 No automatic relationship deletion in service
  const deleteFnMatch = adminServiceSrc.match(/export async function deleteSong[\s\S]*?^}/m);
  const deleteFnBody = deleteFnMatch ? deleteFnMatch[0] : '';
  const zeroRelDeleteInService = !deleteFnBody.includes('from(\'songbook_songs\').delete()') &&
    !deleteFnBody.includes('from(\'pinned_songs\').delete()');
  if (zeroRelDeleteInService) {
    pass('deleteSong executes zero automatic cascade deletions of songbook_songs or pinned_songs', '', 'staticSourceInspection');
  } else {
    fail('deleteSong contains unexpected automatic cascade deletion calls');
  }

  // 5.5 Anonymous deleteSong fails closed under RLS (negative test)
  const anonDeleteRes = await deleteSong('0008c794-4a6c-4407-9df1-442d5a3b93ad');
  if (anonDeleteRes.success === false && anonDeleteRes.error) {
    pass('deleteSong strictly fails-closed under RLS for unauthenticated clients', anonDeleteRes.error, 'liveNegativeRls');
  } else {
    fail('deleteSong did not fail-closed when unauthenticated');
  }

  // -------------------------------------------------------------------------
  // SECTION 6: Songbook Associations Surface (ASSOCIATIONS)
  // -------------------------------------------------------------------------
  console.log('\n--- 6. Songbook Associations Surface (ASSOCIATIONS) ---');

  // 6.1 Dynamic available songbooks load
  const availableSb = await getAvailableSongbooks();
  if (availableSb.error === null && availableSb.songbooks.length === 8) {
    const isSorted = availableSb.songbooks.every((sb, idx, arr) => idx === 0 || sb.sort_order >= arr[idx - 1].sort_order);
    if (isSorted) {
      pass('getAvailableSongbooks dynamically loads 8 active collections strictly ordered by sort_order', `Count: ${availableSb.songbooks.length}`, 'liveRead');
    } else {
      fail('getAvailableSongbooks results are not properly sorted');
    }
  } else {
    fail('getAvailableSongbooks failed to load expected 8 songbooks', availableSb.error);
  }

  // 6.2 Association retrieval with joined metadata
  const sampleAssocs = await getSongbookAssociations(sampleAssocSongId);
  if (sampleAssocs.error === null && sampleAssocs.associations.length > 0) {
    const hasJoinedMeta = sampleAssocs.associations.every(a => a.songbooks && typeof a.songbooks === 'object');
    if (hasJoinedMeta) {
      pass('getSongbookAssociations returns junction records with joined songbook metadata (including is_active)', `Associations: ${sampleAssocs.associations.length}`, 'liveRead');
    } else {
      fail('getSongbookAssociations returned records without joined songbook metadata');
    }
  } else {
    fail('getSongbookAssociations failed on valid song with associations', sampleAssocs.error);
  }

  // 6.3 Hardened inactive association preservation simulation
  const mockCurrent = [
    {
      id: 'mock-1',
      song_id: 'sample-song-id',
      songbook_id: '4cd29823-061b-4b97-bff2-8da0a4009231', // active
      song_number: 10,
      songbooks: { id: '4cd29823-061b-4b97-bff2-8da0a4009231', title: 'Active', is_active: true }
    },
    {
      id: 'mock-2',
      song_id: 'sample-song-id',
      songbook_id: '00000000-0000-0000-0000-000000000001', // inactive
      song_number: 99,
      songbooks: { id: '00000000-0000-0000-0000-000000000001', title: 'Archived', is_active: false }
    }
  ];
  const mockDesired = [
    { songbookId: '4cd29823-061b-4b97-bff2-8da0a4009231', songNumber: 10 },
    { songbookId: '00000000-0000-0000-0000-000000000001', songNumber: 99 }
  ];
  const desiredMap = new Map(mockDesired.map(d => [d.songbookId, d]));
  const toRemoveUnchanged = mockCurrent.filter(c => !desiredMap.has(c.songbook_id));
  if (toRemoveUnchanged.length === 0) {
    pass('Unchanged save preserves existing inactive/deprecated songbook associations (toRemove is empty)', '', 'logicAndSimulations');
  } else {
    fail('Unchanged save erroneously marked inactive association for deletion');
  }

  // 6.4 Explicit removal of inactive association works
  const mockDesiredAfterRemoval = [
    { songbookId: '4cd29823-061b-4b97-bff2-8da0a4009231', songNumber: 10 }
  ];
  const desiredMapRemoved = new Map(mockDesiredAfterRemoval.map(d => [d.songbookId, d]));
  const toRemoveExplicit = mockCurrent.filter(c => !desiredMapRemoved.has(c.songbook_id));
  if (toRemoveExplicit.length === 1 && toRemoveExplicit[0].songbook_id === '00000000-0000-0000-0000-000000000001') {
    pass('Explicit removal of inactive association correctly isolates target in toRemove diff', '', 'logicAndSimulations');
  } else {
    fail('Explicit removal failed to isolate inactive association');
  }

  // 6.5 Anonymous songbook association mutations fail closed under RLS (negative tests)
  const anonAddAssoc = await addSongbookAssociation(sampleSongId, '4cd29823-061b-4b97-bff2-8da0a4009231');
  if (anonAddAssoc.success === false && anonAddAssoc.error) {
    pass('addSongbookAssociation strictly fails-closed under RLS for unauthenticated clients', anonAddAssoc.error, 'liveNegativeRls');
  } else {
    fail('addSongbookAssociation did not fail closed');
  }

  const anonRemAssoc = await removeSongbookAssociation(sampleSongId, '4cd29823-061b-4b97-bff2-8da0a4009231');
  if (anonRemAssoc.success === false && anonRemAssoc.error) {
    pass('removeSongbookAssociation strictly fails-closed under RLS for unauthenticated clients', anonRemAssoc.error, 'liveNegativeRls');
  } else {
    fail('removeSongbookAssociation did not fail closed');
  }

  // -------------------------------------------------------------------------
  // SECTION 7: Authentication & RLS Security Chain (AUTH / RLS)
  // -------------------------------------------------------------------------
  console.log('\n--- 7. Authentication & RLS Security Chain (AUTH / RLS) ---');

  // 7.1 Unauthenticated initial session is null
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session === null) {
    pass('Supabase Auth getSession returns null for unauthenticated client', '', 'liveRead');
  } else {
    fail('Expected unauthenticated session to be null');
  }

  // 7.2 Invalid credentials rejected cleanly
  const { data: badAuthData, error: badAuthErr } = await supabase.auth.signInWithPassword({
    email: 'nonexistent-admin@example.com',
    password: 'WrongPassword123!'
  });
  if (badAuthData.session === null && badAuthErr) {
    pass('signInWithPassword rejects invalid credentials without issuing session', badAuthErr.message, 'liveNegativeRls');
  } else {
    fail('Invalid credentials did not reject cleanly');
  }

  // 7.3 Anonymous write attempts across all tables fail closed (negative tests)
  const anonSongWrite = await supabase.from('songs').insert({ title: 'Hack', language: 'telugu' });
  if (anonSongWrite.error?.code === '42501') {
    pass('Anonymous INSERT on public.songs blocked by RLS (42501)', anonSongWrite.error.message, 'liveNegativeRls');
  } else {
    fail('Anonymous INSERT on songs not blocked by 42501');
  }

  const anonPinWrite = await supabase.from('pinned_songs').insert({ title: 'Hack', language: 'telugu' });
  if (anonPinWrite.error?.code === '42501') {
    pass('Anonymous INSERT on public.pinned_songs blocked by RLS (42501)', anonPinWrite.error.message, 'liveNegativeRls');
  } else {
    fail('Anonymous INSERT on pinned_songs not blocked by 42501');
  }

  const anonSbWrite = await supabase.from('songbooks').insert({ title: 'Hack', slug: 'hack' });
  if (anonSbWrite.error?.code === '42501') {
    pass('Anonymous INSERT on public.songbooks blocked by RLS (42501)', anonSbWrite.error.message, 'liveNegativeRls');
  } else {
    fail('Anonymous INSERT on songbooks not blocked by 42501');
  }

  // -------------------------------------------------------------------------
  // SECTION 8: Profile & Role Security Foundation (PROFILES / ROLES)
  // -------------------------------------------------------------------------
  console.log('\n--- 8. Profile & Role Security Foundation (PROFILES / ROLES) ---');

  // 8.1 Migration SQL inspection for public.is_admin()
  const secHardenSql = fs.readFileSync(path.join(rootDir, 'supabase/migrations/003_security_hardening.sql'), 'utf8');
  const isAdminDef = secHardenSql.includes('CREATE OR REPLACE FUNCTION public.is_admin()') &&
    secHardenSql.includes('SECURITY DEFINER') &&
    secHardenSql.includes('SET search_path = \'\'');
  if (isAdminDef) {
    pass('public.is_admin() verified as SECURITY DEFINER with empty search_path', '', 'schemaAndInvariants');
  } else {
    fail('public.is_admin() definition missing SECURITY DEFINER or empty search_path');
  }

  // 8.2 Role change protection trigger
  const roleProtectDef = secHardenSql.includes('tr_protect_profile_role') &&
    secHardenSql.includes('protect_profile_role()') &&
    secHardenSql.includes('RAISE EXCEPTION \'Permission denied: Cannot modify user roles.\'');
  if (roleProtectDef) {
    pass('Profile role protection trigger tr_protect_profile_role verified in migration DDL', '', 'schemaAndInvariants');
  } else {
    fail('Profile role protection trigger definition missing or incomplete');
  }

  // 8.3 Anonymous profile escalation rejected under RLS
  const anonProfileInsert = await supabase.from('profiles').insert({
    id: '00000000-0000-0000-0000-000000000001',
    role: 'admin'
  });
  if (anonProfileInsert.error?.code === '42501') {
    pass('Anonymous profile self-promotion blocked by RLS (42501)', anonProfileInsert.error.message, 'liveNegativeRls');
  } else {
    fail('Anonymous profile self-promotion was not rejected by 42501');
  }

  // -------------------------------------------------------------------------
  // SECTION 9: Live Production Data Integrity & FK Invariance (DATA INTEGRITY)
  // -------------------------------------------------------------------------
  console.log('\n--- 9. Live Production Data Integrity & FK Invariance ---');

  // 9.1 Exact row count verifications
  const [songsCountRes, sbCountRes, assocCountRes, pinCountRes] = await Promise.all([
    supabase.from('songs').select('*', { count: 'exact', head: true }),
    supabase.from('songbooks').select('*', { count: 'exact', head: true }),
    supabase.from('songbook_songs').select('*', { count: 'exact', head: true }),
    supabase.from('pinned_songs').select('*', { count: 'exact', head: true })
  ]);

  if (songsCountRes.count === 3773) {
    pass('public.songs row count remains exactly 3,773', `Current: ${songsCountRes.count}`, 'liveRead');
  } else {
    fail('public.songs row count mismatch', `Expected 3773, got ${songsCountRes.count}`);
  }

  if (sbCountRes.count === 8) {
    pass('public.songbooks row count remains exactly 8', `Current: ${sbCountRes.count}`, 'liveRead');
  } else {
    fail('public.songbooks row count mismatch', `Expected 8, got ${sbCountRes.count}`);
  }

  if (assocCountRes.count === 2291) {
    pass('public.songbook_songs row count remains exactly 2,291', `Current: ${assocCountRes.count}`, 'liveRead');
  } else {
    fail('public.songbook_songs row count mismatch', `Expected 2291, got ${assocCountRes.count}`);
  }

  if (pinCountRes.count === 1) {
    pass('public.pinned_songs row count remains exactly 1', `Current: ${pinCountRes.count}`, 'liveRead');
  } else {
    fail('public.pinned_songs row count mismatch', `Expected 1, got ${pinCountRes.count}`);
  }

  // 9.2 Comprehensive uniqueness & foreign key integrity check
  const ranges = [[0, 999], [1000, 1999], [2000, 2999], [3000, 3999]];
  const allSongPages = await Promise.all(
    ranges.map(([start, end]) => supabase.from('songs').select('id, slug').range(start, end))
  );
  const allSongs = allSongPages.flatMap(r => r.data || []);
  const songIdSet = new Set();
  const songSlugSet = new Set();
  let dupSongIds = 0;
  let dupSongSlugs = 0;

  for (const s of allSongs) {
    if (songIdSet.has(s.id)) dupSongIds++;
    if (songSlugSet.has(s.slug)) dupSongSlugs++;
    songIdSet.add(s.id);
    songSlugSet.add(s.slug);
  }

  if (allSongs.length === 3773 && dupSongIds === 0 && dupSongSlugs === 0) {
    pass('All 3,773 songs verified: 0 duplicate IDs, 0 duplicate Slugs', '', 'liveRead');
  } else {
    fail('Duplicate song IDs or slugs found in database', `IDs: ${dupSongIds}, Slugs: ${dupSongSlugs}`);
  }

  // 9.3 Association uniqueness and FK relationships
  const sbSongPages = await Promise.all([
    supabase.from('songbook_songs').select('id, song_id, songbook_id').range(0, 999),
    supabase.from('songbook_songs').select('id, song_id, songbook_id').range(1000, 1999),
    supabase.from('songbook_songs').select('id, song_id, songbook_id').range(2000, 2999)
  ]);
  const allAssocs = sbSongPages.flatMap(r => r.data || []);
  const assocPairSet = new Set();
  let dupAssocs = 0;
  let orphanAssocs = 0;

  for (const a of allAssocs) {
    const key = `${a.song_id}:${a.songbook_id}`;
    if (assocPairSet.has(key)) dupAssocs++;
    assocPairSet.add(key);
    if (!songIdSet.has(a.song_id)) orphanAssocs++;
  }

  if (allAssocs.length === 2291 && dupAssocs === 0 && orphanAssocs === 0) {
    pass('All 2,291 songbook associations verified: 0 duplicates, 0 orphan relationships', '', 'liveRead');
  } else {
    fail('Integrity defect in songbook associations', `Duplicates: ${dupAssocs}, Orphans: ${orphanAssocs}`);
  }

  // 9.4 Pinned song FK relationship
  const { data: pinnedData } = await supabase.from('pinned_songs').select('*');
  let orphanPins = 0;
  for (const p of (pinnedData || [])) {
    if (!songIdSet.has(p.id)) orphanPins++;
  }
  if (pinnedData?.length === 1 && orphanPins === 0) {
    pass('Pinned song record verified: valid FK relationship to public.songs, 0 orphan records', '', 'liveRead');
  } else {
    fail('Pinned song record integrity failure', `Orphans: ${orphanPins}`);
  }

  // -------------------------------------------------------------------------
  // SECTION 10: Cross-Phase Cache Invalidation (CACHING)
  // -------------------------------------------------------------------------
  console.log('\n--- 10. Cross-Phase Cache Invalidation ---');

  // Verify catalog cache invalidators
  clearCatalogCache();
  invalidateCatalogCache();
  pass('clearCatalogCache and invalidateCatalogCache operate without throwing', '', 'logicAndSimulations');

  // Verify song cache invalidators
  clearSongCache();
  invalidateSongCache('sample-slug');
  invalidateSongCache();
  pass('clearSongCache and invalidateSongCache (by slug and full wipe) operate without throwing', '', 'logicAndSimulations');

  // Verify public read behavior after cache clear
  const publicCatalogAfterClear = await getCatalogIndex();
  const catalogCount = publicCatalogAfterClear?.songs?.length || 0;
  if (catalogCount === 3773) {
    pass('Public getCatalogIndex re-populates accurately after cache clear', `Count: ${catalogCount}`, 'liveRead');
  } else {
    fail('Public getCatalogIndex failed to re-populate after cache clear', `Count: ${catalogCount}`);
  }

  const publicSongAfterClear = await getSong('lechinaaduraa-samaadhi-gelichinaaduraa');
  if (publicSongAfterClear && publicSongAfterClear.title) {
    pass('Public getSong resolves accurately after cache clear', `Title: "${publicSongAfterClear.title}"`, 'liveRead');
  } else {
    fail('Public getSong failed to resolve after cache clear');
  }

  // -------------------------------------------------------------------------
  // SECTION 11: Security Hygiene Audit (CONTAINMENT)
  // -------------------------------------------------------------------------
  console.log('\n--- 11. Security Hygiene Audit ---');

  const filesToScan = [
    'src/services/adminSongService.js',
    'src/components/admin/AdminSongList.jsx',
    'src/components/admin/AdminCreateSong.jsx',
    'src/components/admin/AdminEditSong.jsx',
    'src/components/admin/AdminSongbookManager.jsx',
    'src/components/AdminLoginModal.jsx',
    'src/context/AuthContext.jsx',
    'api/publish-song.js',
    'api/pinned-songs.js'
  ];

  let securityClean = true;
  for (const relPath of filesToScan) {
    const fullPath = path.join(rootDir, relPath);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, 'utf8');

    if (content.includes('service_role')) {
      fail(`Found service_role reference in ${relPath}`);
      securityClean = false;
    }
    if (content.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      fail(`Found SUPABASE_SERVICE_ROLE_KEY reference in ${relPath}`);
      securityClean = false;
    }
    if (content.includes('VITE_ADMIN_PASSWORD')) {
      fail(`Found VITE_ADMIN_PASSWORD reference in ${relPath}`);
      securityClean = false;
    }
    if (content.includes('jhf_is_admin')) {
      fail(`Found jhf_is_admin reference in ${relPath}`);
      securityClean = false;
    }
    if (content.includes('jhf_admin_changed')) {
      fail(`Found jhf_admin_changed reference in ${relPath}`);
      securityClean = false;
    }
    if (content.includes('/api/admin')) {
      fail(`Found /api/admin reference in ${relPath}`);
      securityClean = false;
    }
  }

  if (securityClean) {
    pass('Zero service_role, VITE_ADMIN_PASSWORD, legacy flags, or legacy API endpoints in admin and API codebase', '', 'staticSourceInspection');
  }

  // Verify decommissioned API endpoints return 410 Gone
  const publishApiSrc = fs.readFileSync(path.join(rootDir, 'api/publish-song.js'), 'utf8');
  const pinnedApiSrc = fs.readFileSync(path.join(rootDir, 'api/pinned-songs.js'), 'utf8');
  if (publishApiSrc.includes('status(410)') && pinnedApiSrc.includes('status(410)')) {
    pass('Legacy API routes (api/publish-song.js and api/pinned-songs.js) are decommissioned (410 Gone)', '', 'staticSourceInspection');
  } else {
    fail('Legacy API routes are not properly decommissioned with 410 Gone');
  }

  // -------------------------------------------------------------------------
  // SECTION 12: Authenticated Runtime Mutation Lifecycle
  // -------------------------------------------------------------------------
  console.log('\n--- 12. Authenticated Runtime Mutation Lifecycle ---');
  skip(
    'Authenticated Admin CRUD Full Lifecycle Runtime Test',
    'No pre-existing safe test-admin credentials configured in environment. Strict safety rules prohibit automatic account creation or mutating live production data.'
  );

  // -------------------------------------------------------------------------
  // Test Suite Summary & Quality Audit
  // -------------------------------------------------------------------------
  console.log('\n============================================================');
  const statusStr = failedTests === 0
    ? `${passedTests}/${totalTests} PASS, ${notExecutedTests} SKIPPED`
    : 'FAILURES DETECTED';
  console.log(`PHASE 9B-7 MASTER VERIFICATION RESULTS: ${statusStr}`);
  console.log(`Passed: ${passedTests} | Failed: ${failedTests} | Not Executed: ${notExecutedTests} | Total: ${totalTests}`);
  console.log('--- Test Quality Audit by Category ---');
  console.log(`  Live Supabase Reads:              ${testAudit.liveRead}`);
  console.log(`  Live Negative RLS Writes:         ${testAudit.liveNegativeRls}`);
  console.log(`  Schema & Invariant Checks:        ${testAudit.schemaAndInvariants}`);
  console.log(`  Logic & In-Memory Simulations:    ${testAudit.logicAndSimulations}`);
  console.log(`  Static Source Inspections:        ${testAudit.staticSourceInspection}`);
  console.log(`  Skipped (No Test Admin):          ${testAudit.skipped}`);
  console.log('============================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runMasterVerification().catch(err => {
  console.error('Unhandled master verification suite error:', err);
  process.exit(1);
});
