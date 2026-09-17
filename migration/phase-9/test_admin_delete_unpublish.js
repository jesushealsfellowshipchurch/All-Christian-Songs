/**
 * Phase 9B-5 — Admin Delete / Unpublish Song Verification Tests
 * 
 * Verifies:
 * A. Component integration exists (AdminSongList.jsx has unpublish & delete modals and handlers)
 * B. Unpublish service exists (unpublishSong exported)
 * C. Delete service exists (deleteSong exported)
 * D. Unpublish payload only changes is_published (explicit { is_published: false })
 * E. Delete requires song ID (validates UUID, fails closed on invalid ID)
 * F. Delete checks pinned_songs (fail-closed query for pinned reference)
 * G. Delete checks songbook_songs (fail-closed count check for songbook associations)
 * H. Delete blocks pinned songs (clear admin message, zero deletion)
 * I. Delete blocks songs assigned to songbooks (clear admin message, zero deletion)
 * J. No automatic pin deletion (pinned_songs never mutated)
 * K. No automatic songbook association deletion (songbook_songs never mutated)
 * L. No songbooks JSONB mutation (songbooks column never touched during unpublish/delete)
 * M. No songbook_songs mutation in service or component
 * N. No pinned_songs mutation in service or component
 * O. Confirmation UI exists (distinct modals for unpublish and delete)
 * P. Typed DELETE confirmation exists (requires typing "DELETE" to confirm)
 * Q. Unpublish confirmation exists (explains data preservation, offered only on published songs)
 * R. Zero service_role in code
 * S. Zero VITE_ADMIN_PASSWORD in code
 * T. Zero legacy admin flags (jhf_is_admin, jhf_admin_changed)
 * U. Zero localStorage/sessionStorage admin authorization
 * V. Zero legacy API routes (/api/admin, /api/publish, /api/pinned)
 * W. Cache invalidation exists (invalidates catalog and song caches)
 * X. Responsive UI remains intact (table on desktop, cards on mobile)
 * 
 * Run with: node --env-file=.env migration/phase-9/test_admin_delete_unpublish.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  unpublishSong,
  deleteSong,
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
  console.log('PHASE 9B-5: ADMIN DELETE / UNPUBLISH SONG VERIFICATION');
  console.log('============================================================\n');

  // --- ITEM A: Component Integration Exists ---
  console.log('--- A. Component Integration Exists ---');
  const componentPath = path.join(rootDir, 'src/components/admin/AdminSongList.jsx');
  if (fs.existsSync(componentPath)) {
    pass('AdminSongList.jsx exists at expected path', componentPath);
  } else {
    fail('AdminSongList.jsx exists at expected path', 'File not found');
    return;
  }

  const componentSource = fs.readFileSync(componentPath, 'utf8');

  if (
    componentSource.includes('unpublishSong') &&
    componentSource.includes('deleteSong') &&
    componentSource.includes('checkSongDeleteEligibility')
  ) {
    pass('AdminSongList.jsx imports delete & unpublish operations from adminSongService');
  } else {
    fail('AdminSongList.jsx imports delete & unpublish operations from adminSongService');
  }

  if (
    componentSource.includes('handleOpenUnpublish') &&
    componentSource.includes('handleOpenDelete')
  ) {
    pass('AdminSongList.jsx defines unpublish and delete action triggers');
  } else {
    fail('AdminSongList.jsx defines unpublish and delete action triggers');
  }

  // --- ITEM B: Unpublish Service Exists ---
  console.log('\n--- B. Unpublish Service Exists ---');
  if (typeof unpublishSong === 'function') {
    pass('unpublishSong is exported from adminSongService.js');
  } else {
    fail('unpublishSong is exported from adminSongService.js', typeof unpublishSong);
  }

  // --- ITEM C: Delete Service Exists ---
  console.log('\n--- C. Delete Service Exists ---');
  if (typeof deleteSong === 'function') {
    pass('deleteSong is exported from adminSongService.js');
  } else {
    fail('deleteSong is exported from adminSongService.js', typeof deleteSong);
  }

  if (typeof checkSongDeleteEligibility === 'function') {
    pass('checkSongDeleteEligibility is exported from adminSongService.js');
  } else {
    fail('checkSongDeleteEligibility is exported from adminSongService.js', typeof checkSongDeleteEligibility);
  }

  // --- ITEM D: Unpublish Payload Only Changes is_published ---
  console.log('\n--- D. Unpublish Payload Only Changes is_published ---');
  const servicePath = path.join(rootDir, 'src/services/adminSongService.js');
  const serviceSource = fs.readFileSync(servicePath, 'utf8');

  // Extract unpublishSong body
  const unpublishFnMatch = serviceSource.match(/export async function unpublishSong\s*\([\s\S]*?\n\}/);
  const unpublishFnBody = unpublishFnMatch ? unpublishFnMatch[0] : '';

  if (
    unpublishFnBody.includes('.update({ is_published: false })') ||
    unpublishFnBody.includes(".update({\n      is_published: false\n    })")
  ) {
    pass('unpublishSong sends explicit payload { is_published: false } only', 'Protected columns preserved');
  } else {
    fail('unpublishSong sends explicit payload { is_published: false } only', 'Unpublish payload did not match expected structure');
  }

  // Ensure unpublishSong doesn't alter title, slug, lyrics, songbooks, timestamps
  const forbiddenUnpublishFields = ['title', 'slug', 'lyrics_original', 'lyrics_transliterated', 'songbooks', 'updated_at', 'created_at'];
  let hasForbiddenInUnpublish = false;
  for (const field of forbiddenUnpublishFields) {
    const regex = new RegExp(`\\.update\\s*\\([\\s\\S]*?${field}:`, 'g');
    if (regex.test(unpublishFnBody)) {
      hasForbiddenInUnpublish = true;
      fail(`unpublishSong must not alter ${field}`);
    }
  }
  if (!hasForbiddenInUnpublish) {
    pass('unpublishSong alters zero other columns (title, slug, lyrics, songbooks, timestamps preserved)');
  }

  // --- ITEM E: Delete Requires Song ID ---
  console.log('\n--- E. Delete Requires Song ID ---');
  const deleteNoId = await deleteSong(null);
  if (!deleteNoId.success && deleteNoId.error?.toLowerCase().includes('uuid')) {
    pass('deleteSong rejects null/empty ID with clear UUID validation error', deleteNoId.error);
  } else {
    fail('deleteSong rejects null/empty ID with clear UUID validation error', JSON.stringify(deleteNoId));
  }

  const deleteInvalidId = await deleteSong('not-a-valid-uuid');
  if (!deleteInvalidId.success && deleteInvalidId.error?.toLowerCase().includes('uuid')) {
    pass('deleteSong rejects malformed non-UUID strings safely', deleteInvalidId.error);
  } else {
    fail('deleteSong rejects malformed non-UUID strings safely', JSON.stringify(deleteInvalidId));
  }

  const unpublishNoId = await unpublishSong(null);
  if (!unpublishNoId.success && unpublishNoId.error?.toLowerCase().includes('uuid')) {
    pass('unpublishSong rejects null/empty ID with clear UUID validation error', unpublishNoId.error);
  } else {
    fail('unpublishSong rejects null/empty ID with clear UUID validation error', JSON.stringify(unpublishNoId));
  }

  // --- ITEMS F & G: Delete Checks pinned_songs and songbook_songs ---
  console.log('\n--- F & G. Delete Checks pinned_songs and songbook_songs ---');
  if (
    serviceSource.includes(".from('pinned_songs')") &&
    serviceSource.includes(".from('songbook_songs')")
  ) {
    pass('adminSongService checks both pinned_songs and songbook_songs before deletion');
  } else {
    fail('adminSongService checks both pinned_songs and songbook_songs before deletion');
  }

  // --- ITEM H: Delete Blocks Pinned Songs ---
  console.log('\n--- H. Delete Blocks Pinned Songs ---');
  // Retrieve the known pinned song UUID from live pinned_songs
  let knownPinnedSongId = null;
  try {
    const { data: pinnedData } = await supabase.from('pinned_songs').select('id, slug, title').limit(1);
    if (pinnedData && pinnedData.length > 0) {
      knownPinnedSongId = pinnedData[0].id;
    }
  } catch (_) {}

  if (knownPinnedSongId) {
    const pinnedEligibility = await checkSongDeleteEligibility(knownPinnedSongId);
    if (!pinnedEligibility.canDelete && pinnedEligibility.isPinned) {
      pass('checkSongDeleteEligibility blocks pinned song', `isPinned: ${pinnedEligibility.isPinned}, blockReason: ${pinnedEligibility.blockReason}`);
    } else {
      fail('checkSongDeleteEligibility blocks pinned song', JSON.stringify(pinnedEligibility));
    }

    const deletePinnedResult = await deleteSong(knownPinnedSongId);
    if (!deletePinnedResult.success && deletePinnedResult.error?.toLowerCase().includes('pinned')) {
      pass('deleteSong blocks deletion of pinned song with clear message', deletePinnedResult.error);
    } else {
      fail('deleteSong blocks deletion of pinned song with clear message', JSON.stringify(deletePinnedResult));
    }
  } else {
    skip('Delete Blocks Pinned Songs', 'No pinned song found in live database to test against');
  }

  // --- ITEM I: Delete Blocks Songs Assigned to Songbooks ---
  console.log('\n--- I. Delete Blocks Songs Assigned to Songbooks ---');
  // Retrieve a known song with songbook associations
  let knownSongbookSongId = null;
  try {
    const { data: sbData } = await supabase.from('songbook_songs').select('song_id').limit(1);
    if (sbData && sbData.length > 0) {
      knownSongbookSongId = sbData[0].song_id;
    }
  } catch (_) {}

  if (knownSongbookSongId) {
    const sbEligibility = await checkSongDeleteEligibility(knownSongbookSongId);
    if (!sbEligibility.canDelete && sbEligibility.songbookCount > 0) {
      pass('checkSongDeleteEligibility blocks song with songbook associations', `songbookCount: ${sbEligibility.songbookCount}, blockReason: ${sbEligibility.blockReason}`);
    } else {
      fail('checkSongDeleteEligibility blocks song with songbook associations', JSON.stringify(sbEligibility));
    }

    const deleteSbResult = await deleteSong(knownSongbookSongId);
    if (!deleteSbResult.success && deleteSbResult.error?.toLowerCase().includes('songbook')) {
      pass('deleteSong blocks deletion of song assigned to songbooks with clear message', deleteSbResult.error);
    } else {
      fail('deleteSong blocks deletion of song assigned to songbooks with clear message', JSON.stringify(deleteSbResult));
    }
  } else {
    skip('Delete Blocks Songs Assigned to Songbooks', 'No songbook associations found in live database');
  }

  // --- ITEMS J, K, L, M, N: Relationship & Metadata Preservation (Zero Mutations) ---
  console.log('\n--- J, K, L, M, N. Zero Mutations to Relationships & Metadata ---');

  // Check deleteSong and unpublishSong for any mutation queries on pinned_songs or songbook_songs
  const deleteFnMatch = serviceSource.match(/export async function deleteSong\s*\([\s\S]*?\n\}/);
  const deleteFnBody = deleteFnMatch ? deleteFnMatch[0] : '';
  const eligibilityFnMatch = serviceSource.match(/export async function checkSongDeleteEligibility\s*\([\s\S]*?\n\}/);
  const eligibilityFnBody = eligibilityFnMatch ? eligibilityFnMatch[0] : '';

  // J. No automatic pin deletion
  if (
    !deleteFnBody.includes(".from('pinned_songs').delete") &&
    !eligibilityFnBody.includes(".from('pinned_songs').delete") &&
    !componentSource.includes(".from('pinned_songs').delete")
  ) {
    pass('No automatic pin deletion: pinned_songs is never deleted in delete workflow');
  } else {
    fail('No automatic pin deletion: detected delete query on pinned_songs');
  }

  // K. No automatic songbook association deletion
  if (
    !deleteFnBody.includes(".from('songbook_songs').delete") &&
    !eligibilityFnBody.includes(".from('songbook_songs').delete") &&
    !componentSource.includes(".from('songbook_songs').delete")
  ) {
    pass('No automatic songbook association deletion: songbook_songs is never deleted in delete workflow');
  } else {
    fail('No automatic songbook association deletion: detected delete query on songbook_songs');
  }

  // L. No songbooks JSONB mutation
  if (
    !deleteFnBody.includes('songbooks') &&
    !unpublishFnBody.includes('songbooks:')
  ) {
    pass('No songbooks mutation: songs.songbooks JSONB column is never mutated by unpublish or delete');
  } else {
    fail('No songbooks mutation: detected mutation of songbooks column');
  }

  // M. No songbook_songs mutation in delete/unpublish workflow
  const hasSbMutation =
    /from\(['"]songbook_songs['"]\)\s*\.(insert|update|upsert|delete)/.test(deleteFnBody) ||
    /from\(['"]songbook_songs['"]\)\s*\.(insert|update|upsert|delete)/.test(unpublishFnBody) ||
    /from\(['"]songbook_songs['"]\)\s*\.(insert|update|upsert|delete)/.test(eligibilityFnBody) ||
    /from\(['"]songbook_songs['"]\)\s*\.(insert|update|upsert|delete)/.test(componentSource);
  if (!hasSbMutation) {
    pass('No songbook_songs mutation: junction table is strictly read-only in delete/unpublish workflows');
  } else {
    fail('No songbook_songs mutation: detected write query on songbook_songs in delete/unpublish workflows');
  }

  // N. No pinned_songs mutation in delete/unpublish workflow
  const hasPinMutationInDelete =
    /from\(['"]pinned_songs['"]\)\s*\.(insert|update|upsert|delete)/.test(deleteFnBody) ||
    /from\(['"]pinned_songs['"]\)\s*\.(insert|update|upsert|delete)/.test(unpublishFnBody) ||
    /from\(['"]pinned_songs['"]\)\s*\.(insert|update|upsert|delete)/.test(eligibilityFnBody) ||
    /from\(['"]pinned_songs['"]\)\s*\.(insert|update|upsert|delete)/.test(componentSource);
  if (!hasPinMutationInDelete) {
    pass('No pinned_songs mutation: pinned_songs is strictly read-only in delete/unpublish workflows');
  } else {
    fail('No pinned_songs mutation: detected write query on pinned_songs');
  }

  // --- ITEM O: Confirmation UI Exists ---
  console.log('\n--- O. Confirmation UI Exists ---');
  if (
    componentSource.includes('unpublishTarget') &&
    componentSource.includes('deleteTarget') &&
    componentSource.includes('aria-modal="true"')
  ) {
    pass('Distinct confirmation dialog modals exist in AdminSongList.jsx');
  } else {
    fail('Distinct confirmation dialog modals exist in AdminSongList.jsx');
  }

  // --- ITEM P: Typed DELETE Confirmation Exists ---
  console.log('\n--- P. Typed DELETE Confirmation Exists ---');
  if (
    componentSource.includes("deleteConfirmInput !== 'DELETE'") ||
    componentSource.includes('deleteConfirmInput === "DELETE"') ||
    componentSource.includes("deleteConfirmInput === 'DELETE'")
  ) {
    pass('Typed "DELETE" confirmation is required before permanent deletion');
  } else {
    fail('Typed "DELETE" confirmation is required before permanent deletion', 'Missing typed DELETE guard');
  }

  if (componentSource.includes('placeholder="Type DELETE to confirm"')) {
    pass('Input field explicitly prompts administrator to type DELETE');
  } else {
    fail('Input field explicitly prompts administrator to type DELETE');
  }

  // --- ITEM Q: Unpublish Confirmation Exists ---
  console.log('\n--- Q. Unpublish Confirmation Exists ---');
  if (
    componentSource.includes('Unpublish this song?') &&
    componentSource.includes('The song will no longer appear in the public catalog, but all song data will be preserved.')
  ) {
    pass('Unpublish confirmation dialog explains that song data is safely preserved');
  } else {
    fail('Unpublish confirmation dialog explains that song data is safely preserved');
  }

  // Unpublish action offered only for published songs
  if (
    componentSource.includes('song.is_published ? (') &&
    componentSource.includes('handleOpenUnpublish(song)')
  ) {
    pass('Unpublish action button is offered exclusively for published songs (drafts cannot be unpublished)');
  } else {
    fail('Unpublish action button is offered exclusively for published songs');
  }

  // --- ITEMS R, S, T, U, V: Security & Containment ---
  console.log('\n--- R, S, T, U, V. Security & Containment ---');
  // R. No service_role
  if (!/service_role/i.test(componentSource) && !/service_role/i.test(serviceSource)) {
    pass('Zero service_role references in component or service');
  } else {
    fail('Zero service_role references in component or service');
  }

  // S. No VITE_ADMIN_PASSWORD
  if (!/VITE_ADMIN_PASSWORD/.test(componentSource) && !/VITE_ADMIN_PASSWORD/.test(serviceSource)) {
    pass('Zero VITE_ADMIN_PASSWORD references in component or service');
  } else {
    fail('Zero VITE_ADMIN_PASSWORD references in component or service');
  }

  // T. No legacy admin flags
  if (
    !/jhf_is_admin/.test(componentSource) &&
    !/jhf_admin_changed/.test(componentSource) &&
    !/jhf_is_admin/.test(serviceSource) &&
    !/jhf_admin_changed/.test(serviceSource)
  ) {
    pass('Zero legacy admin flags in component or service');
  } else {
    fail('Zero legacy admin flags in component or service');
  }

  // U. No localStorage/sessionStorage admin authorization
  if (
    !/localStorage\.setItem\(.*admin/i.test(componentSource) &&
    !/sessionStorage\.setItem\(.*admin/i.test(componentSource) &&
    !/localStorage\.setItem\(.*admin/i.test(serviceSource) &&
    !/sessionStorage\.setItem\(.*admin/i.test(serviceSource)
  ) {
    pass('Zero localStorage/sessionStorage admin authorization writes');
  } else {
    fail('Zero localStorage/sessionStorage admin authorization writes');
  }

  // V. No legacy API routes
  if (
    !/\/api\/admin/i.test(componentSource) &&
    !/\/api\/publish/i.test(componentSource) &&
    !/\/api\/pinned/i.test(componentSource) &&
    !/\/api\/admin/i.test(serviceSource) &&
    !/\/api\/publish/i.test(serviceSource) &&
    !/\/api\/pinned/i.test(serviceSource)
  ) {
    pass('Zero legacy API routes (/api/admin, /api/publish, /api/pinned) referenced');
  } else {
    fail('Zero legacy API routes referenced');
  }

  // --- ITEM W: Cache Invalidation Exists ---
  console.log('\n--- W. Cache Invalidation Exists ---');
  if (
    unpublishFnBody.includes('invalidateCatalogCache()') &&
    unpublishFnBody.includes('invalidateSongCache(')
  ) {
    pass('unpublishSong invalidates both catalog and song caches');
  } else {
    fail('unpublishSong invalidates both catalog and song caches');
  }

  if (
    deleteFnBody.includes('invalidateCatalogCache()') &&
    deleteFnBody.includes('invalidateSongCache(')
  ) {
    pass('deleteSong invalidates both catalog and song caches');
  } else {
    fail('deleteSong invalidates both catalog and song caches');
  }

  // --- ITEM X: Responsive UI Design ---
  console.log('\n--- X. Responsive UI Design ---');
  if (
    componentSource.includes('hidden md:block') && // Desktop Table
    componentSource.includes('md:hidden') // Mobile Cards
  ) {
    pass('Responsive UI layout intact with desktop table and mobile card views');
  } else {
    fail('Responsive UI layout intact with desktop table and mobile card views');
  }

  // --- DATABASE DATA INTEGRITY VERIFICATION ---
  console.log('\n--- Database Data Integrity Check ---');
  try {
    const { count: songCount } = await supabase.from('songs').select('*', { count: 'exact', head: true });
    const { count: sbCount } = await supabase.from('songbook_songs').select('*', { count: 'exact', head: true });
    const { count: pinCount } = await supabase.from('pinned_songs').select('*', { count: 'exact', head: true });

    if (songCount === 3773) {
      pass('Song count remains exactly 3773 (no songs accidentally deleted)');
    } else {
      fail('Song count remains exactly 3773', `Actual count: ${songCount}`);
    }

    if (sbCount === 2291) {
      pass('Songbook associations count remains exactly 2291');
    } else {
      fail('Songbook associations count remains exactly 2291', `Actual count: ${sbCount}`);
    }

    if (pinCount === 1) {
      pass('Pinned songs count remains exactly 1');
    } else {
      fail('Pinned songs count remains exactly 1', `Actual count: ${pinCount}`);
    }
  } catch (err) {
    fail('Database Data Integrity Check', err.message);
  }

  // --- AUTHENTICATED RUNTIME MUTATION TEST ---
  console.log('\n--- Authenticated Runtime Mutation Test ---');
  const testAdminEmail = process.env.TEST_ADMIN_EMAIL;
  const testAdminPassword = process.env.TEST_ADMIN_PASSWORD;

  if (testAdminEmail && testAdminPassword) {
    console.log(`Test admin credentials provided (${testAdminEmail}). Executing authenticated lifecycle...`);
    // Note: If implemented, this must ONLY operate on a freshly created temporary test song
    // and never delete or modify a production song record.
    skip('Authenticated Runtime Mutation Test', 'Controlled test song lifecycle not requested; avoiding production mutation');
  } else {
    skip('Authenticated Runtime Mutation Test', 'No dedicated test admin account provided in environment');
  }

  // Summary
  console.log('\n============================================================');
  console.log(`PHASE 9B-5 TEST RESULTS: ${failedTests === 0 ? 'ALL PASS' : 'FAILURES DETECTED'}`);
  console.log(`Passed: ${passedTests} | Failed: ${failedTests} | Not Executed: ${notExecutedTests} | Total: ${totalTests}`);
  console.log('============================================================');
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exitCode = 1;
});
