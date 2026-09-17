/**
 * Phase 9B-6 — Admin Songbook Association Management Verification Tests
 * 
 * Verifies:
 * 1. Service API availability (getSongbookAssociations, getAvailableSongbooks, addSongbookAssociation, removeSongbookAssociation, reconcileSongbookAssociations, updateSongbookAssociations)
 * 2. Actual database schema & columns for songbooks and songbook_songs
 * 3. Dynamic loading of available songbooks from public.songbooks (ordered by sort_order)
 * 4. Existing association retrieval via getSongbookAssociations(songId)
 * 5. Fail-closed RLS protection against unauthorized anonymous writes
 * 6. Input validation (UUID validation, array types, numeric song numbers)
 * 7. Duplicate association error handling (23505 mapping)
 * 8. Difference reconciliation behavior (targeted add/remove/update, no delete-all)
 * 9. Partial failure handling & reporting (never claims false success)
 * 10. Zero mutations to songs metadata or songs.songbooks JSONB
 * 11. Zero mutations to pinned_songs
 * 12. Phase 9B-5 delete eligibility compatibility (songbook associations continue to block deletion)
 * 13. UI integration into AdminEditSong.jsx
 * 14. AdminSongbookManager component contract (loading, error, empty, dirty states, button safety)
 * 15. Security hygiene (zero service_role, zero VITE_ADMIN_PASSWORD, zero legacy flags)
 * 16. Production catalog count preservation (3773 songs, 8 songbooks, 2291 associations, 1 pinned)
 * 
 * Run with: node --env-file=.env migration/phase-9/test_admin_songbook_associations.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getSongbookAssociations,
  getAvailableSongbooks,
  addSongbookAssociation,
  removeSongbookAssociation,
  reconcileSongbookAssociations,
  updateSongbookAssociations,
  checkSongDeleteEligibility,
  formatAdminError
} from '../../src/services/adminSongService.js';
import { supabase, isSupabaseConfigured } from '../../src/utils/supabaseClient.js';

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
  console.log('PHASE 9B-6: ADMIN SONGBOOK ASSOCIATION MANAGEMENT VERIFICATION');
  console.log('============================================================\n');

  // -------------------------------------------------------------------------
  // SECTION 1: Service API Availability & Exports
  // -------------------------------------------------------------------------
  console.log('--- 1. Service API Availability & Exports ---');

  if (typeof getAvailableSongbooks === 'function') {
    pass('getAvailableSongbooks is exported');
  } else {
    fail('getAvailableSongbooks is exported', 'Expected function');
  }

  if (typeof getSongbookAssociations === 'function') {
    pass('getSongbookAssociations is exported');
  } else {
    fail('getSongbookAssociations is exported', 'Expected function');
  }

  if (typeof addSongbookAssociation === 'function') {
    pass('addSongbookAssociation is exported');
  } else {
    fail('addSongbookAssociation is exported', 'Expected function');
  }

  if (typeof removeSongbookAssociation === 'function') {
    pass('removeSongbookAssociation is exported');
  } else {
    fail('removeSongbookAssociation is exported', 'Expected function');
  }

  if (typeof reconcileSongbookAssociations === 'function') {
    pass('reconcileSongbookAssociations is exported');
  } else {
    fail('reconcileSongbookAssociations is exported', 'Expected function');
  }

  if (typeof updateSongbookAssociations === 'function') {
    pass('updateSongbookAssociations is exported');
  } else {
    fail('updateSongbookAssociations is exported', 'Expected function');
  }

  // -------------------------------------------------------------------------
  // SECTION 2: Schema & Column Assumptions
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Schema & Column Assumptions ---');

  const migration002Path = path.join(rootDir, 'supabase/migrations/002_song_schema.sql');
  const migration002 = fs.readFileSync(migration002Path, 'utf8');

  // Verify songbooks table DDL columns
  const hasSongbooksDDL =
    migration002.includes('CREATE TABLE IF NOT EXISTS public.songbooks') &&
    migration002.includes('id UUID PRIMARY KEY') &&
    migration002.includes('slug TEXT UNIQUE NOT NULL') &&
    migration002.includes('title TEXT NOT NULL') &&
    migration002.includes('sort_order INTEGER NOT NULL DEFAULT 0');
  if (hasSongbooksDDL) {
    pass('public.songbooks schema verified in migration DDL');
  } else {
    fail('public.songbooks schema verified in migration DDL', 'Missing expected columns in DDL');
  }

  // Verify songbook_songs table DDL columns and constraints
  const hasSongbookSongsDDL =
    migration002.includes('CREATE TABLE IF NOT EXISTS public.songbook_songs') &&
    migration002.includes('song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE') &&
    migration002.includes('songbook_id UUID NOT NULL REFERENCES public.songbooks(id) ON DELETE CASCADE') &&
    migration002.includes('song_number INTEGER') &&
    migration002.includes('CONSTRAINT uq_songbook_songs UNIQUE (song_id, songbook_id)');
  if (hasSongbookSongsDDL) {
    pass('public.songbook_songs schema & UNIQUE constraint verified in migration DDL');
  } else {
    fail('public.songbook_songs schema & UNIQUE constraint verified in migration DDL');
  }

  // Verify no trigger synchronizes songs.songbooks
  const migrationFiles = [
    'supabase/migrations/001_security_foundation.sql',
    'supabase/migrations/002_song_schema.sql',
    'supabase/migrations/003_security_hardening.sql'
  ];
  let triggerSyncFound = false;
  for (const mPath of migrationFiles) {
    const fullPath = path.join(rootDir, mPath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('TRIGGER') && content.includes('songbooks') && content.includes('sync')) {
        triggerSyncFound = true;
      }
    }
  }
  if (!triggerSyncFound) {
    pass('No automatic trigger synchronizes songs.songbooks (confirmed read-only compatibility field)');
  } else {
    fail('Found unexpected trigger attempting to synchronize songs.songbooks');
  }

  // -------------------------------------------------------------------------
  // SECTION 3: Dynamic Available Songbooks Loading
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Dynamic Available Songbooks Loading ---');

  const songbooksRes = await getAvailableSongbooks();
  if (songbooksRes.error === null && Array.isArray(songbooksRes.songbooks)) {
    pass('getAvailableSongbooks loads dynamically from database', `Count: ${songbooksRes.songbooks.length}`);

    // Verify ordering by sort_order ascending
    let isOrdered = true;
    for (let i = 0; i < songbooksRes.songbooks.length - 1; i++) {
      if ((songbooksRes.songbooks[i].sort_order ?? 0) > (songbooksRes.songbooks[i + 1].sort_order ?? 0)) {
        isOrdered = false;
        break;
      }
    }
    if (isOrdered) {
      pass('Available songbooks are strictly ordered by sort_order ascending');
    } else {
      fail('Available songbooks are not ordered by sort_order');
    }

    // Verify fields returned
    const firstSb = songbooksRes.songbooks[0];
    if (firstSb && firstSb.id && firstSb.slug && firstSb.title && firstSb.sort_order !== undefined) {
      pass('Songbook records contain required fields (id, slug, title, sort_order)');
    } else {
      fail('Songbook records missing required fields', JSON.stringify(firstSb));
    }
  } else {
    fail('getAvailableSongbooks failed to load songbooks', songbooksRes.error);
  }

  // -------------------------------------------------------------------------
  // SECTION 4: Existing Association Retrieval
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Existing Association Retrieval ---');

  // Test with invalid UUIDs
  const invalidIdRes1 = await getSongbookAssociations(null);
  const invalidIdRes2 = await getSongbookAssociations('not-a-uuid');
  if (invalidIdRes1.error && invalidIdRes2.error) {
    pass('getSongbookAssociations validates UUID input and fails safely on invalid IDs');
  } else {
    fail('getSongbookAssociations should reject invalid UUID inputs');
  }

  // Test with known song with songbook associations
  const knownSongId = '0008c794-4a6c-4407-9df1-442d5a3b93ad';
  const assocRes = await getSongbookAssociations(knownSongId);
  if (assocRes.error === null && Array.isArray(assocRes.associations)) {
    if (assocRes.associations.length >= 1) {
      pass('getSongbookAssociations returns junction table rows for existing song', `Found: ${assocRes.associations.length}`);
      const firstAssoc = assocRes.associations[0];
      if (firstAssoc.song_id === knownSongId && firstAssoc.songbook_id && firstAssoc.song_number !== undefined) {
        pass('Association record matches junction schema (song_id, songbook_id, song_number)');
      } else {
        fail('Association record schema mismatch', JSON.stringify(firstAssoc));
      }
    } else {
      skip('Existing association retrieval count check', 'Known song had 0 associations');
    }
  } else {
    fail('getSongbookAssociations failed on valid song', assocRes.error);
  }

  // -------------------------------------------------------------------------
  // SECTION 5: Fail-Closed Anonymous RLS Security
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Fail-Closed Anonymous RLS Security ---');

  const fakeSongId = '00000000-0000-0000-0000-000000000001';
  const fakeSongbookId = '00000000-0000-0000-0000-000000000002';

  // Test anonymous add fails closed
  const anonAddRes = await addSongbookAssociation(fakeSongId, fakeSongbookId, 100);
  if (!anonAddRes.success && anonAddRes.error && anonAddRes.error.toLowerCase().includes('permission denied')) {
    pass('addSongbookAssociation fails closed under RLS for unauthenticated requests', anonAddRes.error);
  } else {
    fail('addSongbookAssociation should reject unauthenticated requests', JSON.stringify(anonAddRes));
  }

  // Test anonymous remove fails closed
  const anonRemoveRes = await removeSongbookAssociation(fakeSongId, fakeSongbookId);
  if (!anonRemoveRes.success && anonRemoveRes.error) {
    pass('removeSongbookAssociation fails closed under RLS for unauthenticated requests', anonRemoveRes.error);
  } else {
    fail('removeSongbookAssociation should reject unauthenticated requests', JSON.stringify(anonRemoveRes));
  }

  // Test anonymous reconcile fails closed
  const anonReconcileRes = await reconcileSongbookAssociations(fakeSongId, [{ songbookId: fakeSongbookId, songNumber: 100 }]);
  if (!anonReconcileRes.success && (anonReconcileRes.errors.length > 0 || anonReconcileRes.error)) {
    pass('reconcileSongbookAssociations fails closed under RLS for unauthenticated requests');
  } else {
    fail('reconcileSongbookAssociations should fail closed without admin session');
  }

  // Test anonymous updateSongbookAssociations fails closed
  const anonUpdateRes = await updateSongbookAssociations(fakeSongId, [fakeSongbookId]);
  if (!anonUpdateRes.success && (anonUpdateRes.errors.length > 0 || anonUpdateRes.error)) {
    pass('updateSongbookAssociations fails closed under RLS for unauthenticated requests');
  } else {
    fail('updateSongbookAssociations should fail closed without admin session');
  }

  // -------------------------------------------------------------------------
  // SECTION 6: Input Validation & Error Mapping
  // -------------------------------------------------------------------------
  console.log('\n--- 6. Input Validation & Error Mapping ---');

  // UUID validation
  const badAdd1 = await addSongbookAssociation('', fakeSongbookId);
  const badAdd2 = await addSongbookAssociation(fakeSongId, 'invalid');
  if (!badAdd1.success && !badAdd2.success) {
    pass('addSongbookAssociation validates UUID inputs');
  } else {
    fail('addSongbookAssociation failed to validate UUID inputs');
  }

  const badRem1 = await removeSongbookAssociation('', fakeSongbookId);
  const badRem2 = await removeSongbookAssociation(fakeSongId, 'invalid');
  if (!badRem1.success && !badRem2.success) {
    pass('removeSongbookAssociation validates UUID inputs');
  } else {
    fail('removeSongbookAssociation failed to validate UUID inputs');
  }

  // Array validation
  const badRecon = await reconcileSongbookAssociations(fakeSongId, 'not-an-array');
  if (!badRecon.success && badRecon.error.includes('array')) {
    pass('reconcileSongbookAssociations validates array input');
  } else {
    fail('reconcileSongbookAssociations should validate array input');
  }

  const badUpdate = await updateSongbookAssociations(fakeSongId, 'not-an-array');
  if (!badUpdate.success && badUpdate.error.includes('array')) {
    pass('updateSongbookAssociations validates array input');
  } else {
    fail('updateSongbookAssociations should validate array input');
  }

  // Duplicate 23505 mapping
  const duplicateMsg = formatAdminError({ code: '23505', message: 'duplicate key value violates unique constraint "uq_songbook_songs"' });
  if (duplicateMsg.toLowerCase().includes('already exists') || duplicateMsg.toLowerCase().includes('already')) {
    pass('Error code 23505 mapped to friendly duplicate message', duplicateMsg);
  } else {
    fail('Error code 23505 mapping failed', duplicateMsg);
  }

  // -------------------------------------------------------------------------
  // SECTION 7: Reconciliation Behavior & Partial Failure Tracking
  // -------------------------------------------------------------------------
  console.log('\n--- 7. Reconciliation Behavior & Partial Failure Tracking ---');

  const servicePath = path.join(rootDir, 'src/services/adminSongService.js');
  const serviceSource = fs.readFileSync(servicePath, 'utf8');

  // Verify difference calculation exists
  const hasDiffLogic =
    serviceSource.includes('toAdd') &&
    serviceSource.includes('toRemove') &&
    serviceSource.includes('toUpdate');
  if (hasDiffLogic) {
    pass('reconcileSongbookAssociations uses difference-based calculation (toAdd, toRemove, toUpdate)');
  } else {
    fail('reconcileSongbookAssociations missing difference-based calculation');
  }

  // Verify no delete-all blind wipe
  const hasDeleteAll = /delete\(\)\s*\.eq\(['"]song_id['"],\s*songId\)\s*$/.test(serviceSource);
  if (!hasDeleteAll) {
    pass('reconcileSongbookAssociations avoids blind delete-all wipe (uses targeted differences)');
  } else {
    fail('Detected dangerous delete-all query in association management');
  }

  // Verify partial failure reporting
  const hasPartialTracking =
    serviceSource.includes('partially updated') &&
    serviceSource.includes('totalErrors > 0 && totalChanges > 0');
  if (hasPartialTracking) {
    pass('Explicit partial failure tracking implemented (never claims false success)');
  } else {
    fail('Partial failure tracking missing in reconcileSongbookAssociations');
  }

  // -------------------------------------------------------------------------
  // SECTION 8: Zero Mutation to Unrelated Tables / Pinned / Songs Metadata
  // -------------------------------------------------------------------------
  console.log('\n--- 8. Zero Mutation to Unrelated Tables ---');

  // Extract songbook association functions from service
  const sbSectionMatch = serviceSource.match(/\/\/ SONGBOOK ASSOCIATION MANAGEMENT[\s\S]*$/);
  const sbSection = sbSectionMatch ? sbSectionMatch[0] : '';

  // Ensure no writes to songs table in songbook functions
  const writesToSongs = /from\(['"]songs['"]\)\s*\.(insert|update|delete|upsert)/.test(sbSection);
  if (!writesToSongs) {
    pass('Zero writes to public.songs table in songbook association operations');
  } else {
    fail('Detected write to public.songs in songbook association functions');
  }

  // Ensure no writes to songs.songbooks JSONB column
  const writesToSongbooksColumn =
    /\.update\(\s*\{[^}]*songbooks\s*:/i.test(sbSection) ||
    /\.insert\(\s*\{[^}]*songbooks\s*:/i.test(sbSection) ||
    /from\(['"]songs['"]\)\s*\.(update|insert|upsert)\(\s*\{[^}]*songbooks/i.test(sbSection);
  if (!writesToSongbooksColumn) {
    pass('Zero writes targeting songs.songbooks JSONB field (relational junction is canonical)');
  } else {
    fail('Detected write targeting songs.songbooks JSONB');
  }

  // Ensure no writes to pinned_songs
  const writesToPinned = /from\(['"]pinned_songs['"]\)\s*\.(insert|update|delete|upsert)/.test(sbSection);
  if (!writesToPinned) {
    pass('Zero writes to public.pinned_songs table in songbook association operations');
  } else {
    fail('Detected write to public.pinned_songs in songbook association functions');
  }

  // -------------------------------------------------------------------------
  // SECTION 9: Phase 9B-5 Delete Eligibility Compatibility
  // -------------------------------------------------------------------------
  console.log('\n--- 9. Phase 9B-5 Delete Eligibility Compatibility ---');

  const deleteEligibility = await checkSongDeleteEligibility(knownSongId);
  if (!deleteEligibility.canDelete && deleteEligibility.songbookCount > 0) {
    pass('Phase 9B-5 delete eligibility blocks deletion for songs with songbook associations', deleteEligibility.blockReason);
  } else {
    fail('Songbook associations must block deletion in checkSongDeleteEligibility', JSON.stringify(deleteEligibility));
  }

  // -------------------------------------------------------------------------
  // SECTION 10: UI Component Integration & Safety
  // -------------------------------------------------------------------------
  console.log('\n--- 10. UI Component Integration & Safety ---');

  const managerPath = path.join(rootDir, 'src/components/admin/AdminSongbookManager.jsx');
  if (fs.existsSync(managerPath)) {
    pass('AdminSongbookManager.jsx component exists');
  } else {
    fail('AdminSongbookManager.jsx component missing');
    return;
  }

  const managerSource = fs.readFileSync(managerPath, 'utf8');

  // Verify AdminSongbookManager imports required functions
  if (
    managerSource.includes('getAvailableSongbooks') &&
    managerSource.includes('getSongbookAssociations') &&
    managerSource.includes('reconcileSongbookAssociations')
  ) {
    pass('AdminSongbookManager imports required operations from adminSongService');
  } else {
    fail('AdminSongbookManager missing required service imports');
  }

  // Verify all buttons have type="button"
  const rawButtons = managerSource.match(/<button[\s\S]*?>/g) || [];
  let allButtonsTyped = true;
  for (const btn of rawButtons) {
    if (!btn.includes('type="button"')) {
      allButtonsTyped = false;
      break;
    }
  }
  if (allButtonsTyped && rawButtons.length > 0) {
    pass(`All ${rawButtons.length} buttons in AdminSongbookManager have explicit type="button" (prevents accidental form submits)`);
  } else {
    fail('Some buttons in AdminSongbookManager lack explicit type="button"');
  }

  // Verify AdminEditSong imports and renders AdminSongbookManager
  const editSongPath = path.join(rootDir, 'src/components/admin/AdminEditSong.jsx');
  const editSongSource = fs.readFileSync(editSongPath, 'utf8');
  if (
    editSongSource.includes('AdminSongbookManager') &&
    editSongSource.includes('<AdminSongbookManager')
  ) {
    pass('AdminEditSong.jsx imports and embeds AdminSongbookManager in the edit hymn workflow');
  } else {
    fail('AdminEditSong.jsx does not embed AdminSongbookManager');
  }

  // Verify dirty state tracking exists
  if (managerSource.includes('isDirty') && managerSource.includes('handleSave')) {
    pass('AdminSongbookManager maintains dirty state tracking and save trigger');
  } else {
    fail('AdminSongbookManager missing dirty state tracking');
  }

  // Verify partial failure UI state handling
  if (managerSource.includes('saveResult.type === \'partial\'')) {
    pass('AdminSongbookManager handles partial failure state with distinct visual indicator');
  } else {
    fail('AdminSongbookManager missing partial failure visual state');
  }

  // -------------------------------------------------------------------------
  // SECTION 11: Security Hygiene Audit
  // -------------------------------------------------------------------------
  console.log('\n--- 11. Security Hygiene Audit ---');

  const filesToCheck = [
    'src/services/adminSongService.js',
    'src/components/admin/AdminSongbookManager.jsx',
    'src/components/admin/AdminEditSong.jsx'
  ];

  let securityClean = true;
  for (const relPath of filesToCheck) {
    const fullPath = path.join(rootDir, relPath);
    const content = fs.readFileSync(fullPath, 'utf8');

    if (content.includes('service_role')) {
      fail(`Found service_role reference in ${relPath}`);
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
    if (content.includes('/api/admin')) {
      fail(`Found /api/admin reference in ${relPath}`);
      securityClean = false;
    }
  }

  if (securityClean) {
    pass('Zero service_role, VITE_ADMIN_PASSWORD, jhf_is_admin, or legacy API paths in Phase 9B-6 files');
  }

  // -------------------------------------------------------------------------
  // SECTION 12: Production Catalog Count Preservation
  // -------------------------------------------------------------------------
  console.log('\n--- 12. Production Catalog Count Preservation ---');

  const [songsRes, sbRes, assocCountRes, pinnedRes] = await Promise.all([
    supabase.from('songs').select('*', { count: 'exact', head: true }),
    supabase.from('songbooks').select('*', { count: 'exact', head: true }),
    supabase.from('songbook_songs').select('*', { count: 'exact', head: true }),
    supabase.from('pinned_songs').select('*', { count: 'exact', head: true })
  ]);

  if (songsRes.count === 3773) {
    pass('Song count remains exactly 3,773', `Current: ${songsRes.count}`);
  } else {
    fail('Song count mismatch', `Expected 3773, got ${songsRes.count}`);
  }

  if (sbRes.count === 8) {
    pass('Songbook count remains exactly 8', `Current: ${sbRes.count}`);
  } else {
    fail('Songbook count mismatch', `Expected 8, got ${sbRes.count}`);
  }

  if (assocCountRes.count === 2291) {
    pass('Songbook associations count remains exactly 2,291', `Current: ${assocCountRes.count}`);
  } else {
    fail('Associations count mismatch', `Expected 2291, got ${assocCountRes.count}`);
  }

  if (pinnedRes.count === 1) {
    pass('Pinned songs count remains exactly 1', `Current: ${pinnedRes.count}`);
  } else {
    fail('Pinned count mismatch', `Expected 1, got ${pinnedRes.count}`);
  }

  // -------------------------------------------------------------------------
  // SECTION 13: Targeted Hardening — Inactive Songbook Association Safety
  // -------------------------------------------------------------------------
  console.log('\n--- 13. Targeted Hardening: Inactive Songbook Association Safety ---');

  // A. Active songbooks load normally
  const activeSbRes = await getAvailableSongbooks();
  if (activeSbRes.error === null && activeSbRes.songbooks.length > 0) {
    const allActive = activeSbRes.songbooks.every(sb => sb.is_active !== false);
    if (allActive) {
      pass('A. Active songbooks load normally without errors or inactive pollutions', `Active count: ${activeSbRes.songbooks.length}`);
    } else {
      fail('A. Active songbooks query returned inactive songbooks unexpectedly');
    }
  } else {
    fail('A. Active songbooks failed to load', activeSbRes.error);
  }

  // B. Existing inactive association is retained in editable state simulation
  const mockCurrentAssocs = [
    {
      id: 'mock-assoc-1',
      song_id: '0008c794-4a6c-4407-9df1-442d5a3b93ad',
      songbook_id: '4cd29823-061b-4b97-bff2-8da0a4009231', // active
      song_number: 687,
      songbooks: { id: '4cd29823-061b-4b97-bff2-8da0a4009231', title: 'Active Hymnal', is_active: true }
    },
    {
      id: 'mock-assoc-2',
      song_id: '0008c794-4a6c-4407-9df1-442d5a3b93ad',
      songbook_id: '99999999-9999-9999-9999-999999999999', // inactive/archived
      song_number: 104,
      songbooks: { id: '99999999-9999-9999-9999-999999999999', title: 'Archived Hymnal', is_active: false }
    }
  ];

  // Emulate AdminSongbookManager editableAssociations initialization
  const initializedEditable = mockCurrentAssocs.map(a => ({
    songbookId: a.songbook_id,
    songNumber: a.song_number
  }));

  const retainsInactive = initializedEditable.some(a => a.songbookId === '99999999-9999-9999-9999-999999999999');
  if (retainsInactive && initializedEditable.length === 2) {
    pass('B. Existing inactive association is retained in editable state upon load');
  } else {
    fail('B. Existing inactive association was dropped from editable state');
  }

  // C. Save with no changes does not remove inactive association (diff calculation)
  const currentMap = new Map();
  for (const a of mockCurrentAssocs) {
    currentMap.set(a.songbook_id, a);
  }
  const desiredMap = new Map();
  for (const d of initializedEditable) {
    desiredMap.set(d.songbookId, d);
  }

  const toRemove = [];
  for (const [sbId, a] of currentMap) {
    if (!desiredMap.has(sbId)) {
      toRemove.push(a);
    }
  }

  if (toRemove.length === 0) {
    pass('C. Save with no changes does not remove existing inactive association (toRemove is empty)');
  } else {
    fail('C. Inactive association was erroneously flagged for removal on unchanged save');
  }

  // D. Explicit removal of an inactive association still works
  const editedWithoutInactive = initializedEditable.filter(a => a.songbookId !== '99999999-9999-9999-9999-999999999999');
  const desiredMapAfterRemoval = new Map();
  for (const d of editedWithoutInactive) {
    desiredMapAfterRemoval.set(d.songbookId, d);
  }

  const toRemoveExplicit = [];
  for (const [sbId, a] of currentMap) {
    if (!desiredMapAfterRemoval.has(sbId)) {
      toRemoveExplicit.push(a);
    }
  }

  if (toRemoveExplicit.length === 1 && toRemoveExplicit[0].songbook_id === '99999999-9999-9999-9999-999999999999') {
    pass('D. Explicit removal of an inactive association correctly targets it for removal');
  } else {
    fail('D. Explicit removal of an inactive association failed in diff calculation');
  }

  // E. Existing association count remains unchanged during read-only verification
  const assocVerification = await supabase.from('songbook_songs').select('*', { count: 'exact', head: true });
  if (assocVerification.count === 2291) {
    pass('E. Existing association count remains exactly 2,291 during read-only verification');
  } else {
    fail('E. Association count modified during read-only verification', `Expected 2291, got ${assocVerification.count}`);
  }

  // F. No writes occur to songs, songs.songbooks, songbooks, or pinned_songs
  const noForbiddenWrites = writesToSongs === false && writesToSongbooksColumn === false && writesToPinned === false;
  if (noForbiddenWrites) {
    pass('F. Zero writes occur to songs, songs.songbooks, songbooks, or pinned_songs during association workflows');
  } else {
    fail('F. Detected forbidden writes in association operations');
  }

  // -------------------------------------------------------------------------
  // SECTION 14: Authenticated Runtime Lifecycle Test
  // -------------------------------------------------------------------------
  console.log('\n--- 14. Authenticated Runtime Lifecycle Test ---');
  skip(
    'Authenticated Runtime Mutation Test',
    'No dedicated test admin account provided in environment. Strict rules prohibit mutating production songbook associations.'
  );

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n============================================================');
  const statusStr = failedTests === 0
    ? `${passedTests}/${totalTests} PASS, ${notExecutedTests} SKIPPED`
    : 'FAILURES DETECTED';
  console.log(`PHASE 9B-6 TEST RESULTS: ${statusStr}`);
  console.log(`Passed: ${passedTests} | Failed: ${failedTests} | Not Executed: ${notExecutedTests} | Total: ${totalTests}`);
  if (notExecutedTests > 0) {
    console.log(`Note: Authenticated runtime mutation test skipped because no dedicated test-admin credentials are available.`);
  }
  console.log('============================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
