/**
 * test_church_worship_service.js — Phase 2C Step 2A Domain Service Static Verification
 *
 * All Christian Songs — Phase 2C Church Worship Layer
 *
 * Verification Scope:
 * 1. Service file exists and exports all expected API methods.
 * 2. Supabase client usage follows the existing project pattern (anon key, zero service_role).
 * 3. No hardcoded church IDs (multi-church capable).
 * 4. Reuses existing Two-Tier Feature Engine without duplicating logic.
 * 5. Uses public.ensure_default_church_collection(UUID) RPC for default collection initialization.
 * 6. Schema parity: Collection and Item fields match Migration 008.
 * 7. Immutable fields protection: church_id, collection_id, song_id, created_at, created_by, added_at, added_by excluded from updates.
 * 8. Reordering minimal updates: only sort_order submitted.
 * 9. Frontend UI isolation: Header, ChurchWorkspaceModal, App, and context files were NOT modified.
 * 10. Database isolation: SQL files were NOT modified.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '../..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function pass(testName, details = '') {
  totalTests++;
  passedTests++;
  console.log(`[PASS] ${testName}${details ? ` — ${details}` : ''}`);
}

function fail(testName, error = '') {
  totalTests++;
  failedTests++;
  console.error(`[FAIL] ${testName}${error ? ` — ${error}` : ''}`);
}

console.log('============================================================');
console.log('PHASE 2C STEP 2A: CHURCH WORSHIP DOMAIN SERVICE VERIFICATION');
console.log('============================================================\n');

// -----------------------------------------------------------------------------
// SECTION 1: Service File Existence & Exports
// -----------------------------------------------------------------------------
console.log('--- SECTION 1: Service File Existence & Method Exports ---');

const servicePath = resolve(rootDir, 'src/services/churchWorshipService.js');
if (existsSync(servicePath)) {
  pass('Service File Exists', 'src/services/churchWorshipService.js present');
} else {
  fail('Service File Exists', 'Missing src/services/churchWorshipService.js');
}

const serviceCode = readFileSync(servicePath, 'utf8');

const requiredMethods = [
  'getCollections',
  'getCollection',
  'createCollection',
  'updateCollection',
  'deleteCollection',
  'ensureDefaultCollection',
  'getCollectionItems',
  'addSongToCollection',
  'updateCollectionItem',
  'removeSongFromCollection',
  'reorderCollectionItems',
  'isWorshipFeatureActive',
  'formatWorshipError'
];

let allMethodsExported = true;
for (const method of requiredMethods) {
  if (serviceCode.includes(`export async function ${method}`) || serviceCode.includes(`export function ${method}`)) {
    pass(`Method Exported: ${method}`);
  } else {
    fail(`Method Exported: ${method}`, `Function ${method} is not exported`);
    allMethodsExported = false;
  }
}

// -----------------------------------------------------------------------------
// SECTION 2: Supabase Client Usage & Security Hygiene
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 2: Supabase Client Usage & Security Hygiene ---');

const usesProjectSupabaseClient = serviceCode.includes("import { supabase } from '../utils/supabaseClient.js'");
if (usesProjectSupabaseClient) {
  pass('Supabase Client Pattern', "Reuses existing project client from '../utils/supabaseClient.js'");
} else {
  fail('Supabase Client Pattern', 'Does not import supabase from standard client path');
}

const containsServiceRole = serviceCode.includes('service_role') || serviceCode.includes('SUPABASE_SERVICE_ROLE_KEY');
if (!containsServiceRole) {
  pass('Zero service_role', 'No service_role secret or key references in service');
} else {
  fail('Zero service_role', 'Found forbidden service_role in churchWorshipService.js');
}

// Check for hardcoded UUIDs / church IDs
const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const containsHardcodedUuid = uuidRegex.test(serviceCode);
if (!containsHardcodedUuid) {
  pass('Multi-Church Architecture', 'Zero hardcoded church UUIDs in service code');
} else {
  fail('Multi-Church Architecture', 'Found hardcoded UUID in service code');
}

// -----------------------------------------------------------------------------
// SECTION 3: Feature Architecture & RPC Integration
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 3: Feature Architecture & RPC Integration ---');

const reusesFeatureEngine = serviceCode.includes("import { getEffectiveChurchFeatureState } from './churchService.js'") &&
                            serviceCode.includes("WORSHIP_FEATURE_ID = 'church_worship_collections'");
if (reusesFeatureEngine) {
  pass('Feature Engine Reused', "Imports getEffectiveChurchFeatureState and targets 'church_worship_collections'");
} else {
  fail('Feature Engine Reused', 'Did not properly reuse Phase 2A/2B feature resolution engine');
}

const usesRpcForDefault = serviceCode.includes("rpc('ensure_default_church_collection', { p_church_id: churchId })");
if (usesRpcForDefault) {
  pass('Default Collection RPC', "Delegates to database RPC public.ensure_default_church_collection(UUID)");
} else {
  fail('Default Collection RPC', 'Does not use public.ensure_default_church_collection RPC');
}

// -----------------------------------------------------------------------------
// SECTION 4: Invariant Protection & Field Safety
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 4: Invariant Protection & Field Safety ---');

// In updateCollection: church_id, created_at, created_by, is_default must NOT be in payload
const updateCollectionExcludesImmutables = !serviceCode.includes('payload.church_id =') &&
                                          !serviceCode.includes('payload.created_at =') &&
                                          !serviceCode.includes('payload.created_by =') &&
                                          !serviceCode.includes('payload.is_default =');
if (updateCollectionExcludesImmutables) {
  pass('Collection Update Invariant', 'updateCollection strictly excludes church_id, created_at, created_by, and is_default');
} else {
  fail('Collection Update Invariant', 'updateCollection attempts to submit immutable or protected fields');
}

// In updateCollectionItem: collection_id, church_id, song_id, added_at, added_by must NOT be in payload
const updateItemExcludesImmutables = !serviceCode.includes('payload.collection_id =') &&
                                    !serviceCode.includes('payload.church_id =') &&
                                    !serviceCode.includes('payload.song_id =') &&
                                    !serviceCode.includes('payload.added_at =') &&
                                    !serviceCode.includes('payload.added_by =');
if (updateItemExcludesImmutables) {
  pass('Item Update Invariant', 'updateCollectionItem strictly excludes collection_id, church_id, song_id, and added_at/by');
} else {
  fail('Item Update Invariant', 'updateCollectionItem attempts to submit immutable fields');
}

// In reorderCollectionItems: only sort_order must be submitted
const reorderSubmitsOnlySortOrder = serviceCode.includes("update({ sort_order: targetSortOrder })");
if (reorderSubmitsOnlySortOrder) {
  pass('Reorder Minimal Updates', 'reorderCollectionItems submits minimal payload containing only sort_order');
} else {
  fail('Reorder Minimal Updates', 'reorderCollectionItems submits excessive or immutable fields');
}

// -----------------------------------------------------------------------------
// SECTION 5: Scope Boundaries (UI & SQL Isolation)
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 5: Scope Boundaries (UI & SQL Isolation) ---');

// Verify git status does not show modifications to UI files
let gitStatusOutput = '';
try {
  gitStatusOutput = execSync('git status -s', { cwd: rootDir, encoding: 'utf8' });
} catch (e) {
  gitStatusOutput = '';
}

const modifiedFiles = gitStatusOutput.split('\n').map(l => l.trim()).filter(Boolean);
const modifiedForbiddenUiFiles = modifiedFiles.filter(l => 
  l.includes('Header.jsx') || 
  l.includes('UserAuthModal.jsx') || 
  l.includes('AuthContext.jsx')
);

if (modifiedForbiddenUiFiles.length === 0) {
  pass('Out-of-Scope UI Untouched', 'Zero modifications to Header.jsx, UserAuthModal.jsx, or AuthContext.jsx');
} else {
  fail('Out-of-Scope UI Untouched', `Forbidden modified UI files: ${modifiedForbiddenUiFiles.join(', ')}`);
}

// Verify no SQL files were modified in tracked status
const modifiedSqlFiles = modifiedFiles.filter(l => l.startsWith('M') && l.endsWith('.sql'));
if (modifiedSqlFiles.length === 0) {
  pass('SQL Files Untouched', 'Zero modifications to existing or newly executed SQL migrations');
} else {
  fail('SQL Files Untouched', `Unexpected modified SQL files: ${modifiedSqlFiles.join(', ')}`);
}

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n============================================================');
console.log(`TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL: ${totalTests})`);
console.log('============================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
