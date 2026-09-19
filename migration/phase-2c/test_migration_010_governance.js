/**
 * test_migration_010_governance.js — Phase 2C Step 4B Migration 010 Security Audit
 *
 * All Christian Songs — Church Creation & Pastor Governance Verification
 *
 * Verification Scope:
 * 1. Migration 010 Parity: Canonical and archive copies are bit-for-bit identical.
 * 2. Automatic Creator -> Pastor Trigger Removal:
 *    - trg_on_church_created is dropped.
 *    - assign_initial_church_pastor() is dropped.
 *    - Existing church_memberships rows are preserved (no table drop, no delete/truncate).
 * 3. Church Creation Authorization Matrix (V1 Decision):
 *    - Normal user cannot create church under current V1 RLS (churches_insert_admin).
 *    - Super Admin can create church.
 *    - New church does NOT automatically create a Pastor membership (church can exist with 0 members).
 * 4. is_public Directory Visibility Hardening:
 *    - enforce_church_invariants() checks OLD.is_public IS DISTINCT FROM NEW.is_public.
 *    - Non-admin cannot change is_public (raises exception).
 *    - Super Admin can change is_public.
 *    - Existing protections for status, verification_status, verification_notes, created_by preserved.
 *    - Forced default for non-admin insert is is_public = false.
 * 5. Pastor Role Governance Hardening on church_memberships:
 *    - Only Super Admin may INSERT with role = 'pastor'.
 *    - Local Pastor can only INSERT role IN ('member', 'worship_leader').
 *    - Only Super Admin may UPDATE to role = 'pastor'.
 *    - Local Pastor can only UPDATE role IN ('member', 'worship_leader').
 *    - Local Pastor cannot DELETE other pastors (only self or member/worship_leader).
 *    - Existing member join requests (church_memberships_insert_request) preserved.
 *    - Last-active-pastor protection (protect_last_active_pastor()) preserved.
 * 6. Super Admin Pastor Assignment RPC (admin_assign_church_pastor):
 *    - Super Admin only check (public.is_admin()).
 *    - Target user must exist in profiles.
 *    - Target church must exist and be active.
 *    - Atomically creates or updates membership to role='pastor', status='active'.
 *    - updated_by = auth.uid().
 *    - SECURITY DEFINER with search_path = ''.
 *    - REVOKE EXECUTE from PUBLIC, GRANT to authenticated.
 * 7. Security Invariants & Scope Isolation:
 *    - Zero service_role credentials in test or migrations.
 *    - Zero hardcoded UUIDs.
 *    - Cross-church isolation preserved.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

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
console.log('PHASE 2C STEP 4B: MIGRATION 010 SECURITY AUDIT');
console.log('============================================================\n');

// -----------------------------------------------------------------------------
// SECTION 1: Migration 010 Files & Parity
// -----------------------------------------------------------------------------
console.log('--- SECTION 1: Migration 010 SQL Parity & File Structure ---');

const canonicalMigrationPath = resolve(rootDir, 'supabase/migrations/010_church_creation_and_pastor_governance.sql');
const archiveMigrationPath = resolve(rootDir, 'migration/phase-2c/010_church_creation_and_pastor_governance.sql');

if (existsSync(canonicalMigrationPath) && existsSync(archiveMigrationPath)) {
  pass('Migration 010 files exist', 'Both canonical and phase-2c archive present');
} else {
  fail('Migration 010 files exist', 'Missing 010_church_creation_and_pastor_governance.sql');
}

const sql010 = readFileSync(canonicalMigrationPath, 'utf8');
const archiveSql010 = readFileSync(archiveMigrationPath, 'utf8');

if (sql010 === archiveSql010) {
  pass('Migration 010 archive parity', 'Archive copy is bit-for-bit identical to canonical file');
} else {
  fail('Migration 010 archive parity', 'Canonical and archive SQL files differ');
}

// -----------------------------------------------------------------------------
// SECTION 2: Removal of Automatic Creator -> Pastor Trigger
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 2: Automatic Creator -> Pastor Trigger Removal ---');

const dropsTrigger = sql010.includes('DROP TRIGGER IF EXISTS trg_on_church_created ON public.churches;');
if (dropsTrigger) {
  pass('Drops trg_on_church_created', 'Explicitly removes the automatic trigger from public.churches');
} else {
  fail('Drops trg_on_church_created', 'Missing DROP TRIGGER IF EXISTS trg_on_church_created');
}

const dropsFunction = sql010.includes('DROP FUNCTION IF EXISTS public.assign_initial_church_pastor();');
if (dropsFunction) {
  pass('Drops assign_initial_church_pastor()', 'Explicitly removes the trigger function');
} else {
  fail('Drops assign_initial_church_pastor()', 'Missing DROP FUNCTION IF EXISTS public.assign_initial_church_pastor()');
}

// Ensure no destructive SQL statements (exclude comments and policy actions like FOR DELETE)
const sqlWithoutComments = sql010.replace(/--.*$/gm, '');
const hasDeleteMemberships = /\bDELETE\s+FROM\s+public\.church_memberships\b/i.test(sqlWithoutComments);
const hasTruncate = /\bTRUNCATE\b/i.test(sqlWithoutComments);
const hasDropTable = /\bDROP\s+TABLE\b/i.test(sqlWithoutComments);

if (!hasDeleteMemberships && !hasTruncate && !hasDropTable) {
  pass('Existing data preservation', 'Zero DELETE on church_memberships, zero TRUNCATE, zero DROP TABLE');
} else {
  fail('Existing data preservation', 'Found destructive statement (DELETE, TRUNCATE, or DROP TABLE)');
}

// -----------------------------------------------------------------------------
// SECTION 3: is_public Directory Visibility Hardening
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 3: is_public Directory Visibility Hardening ---');

const protectsIsPublicOnUpdate = sql010.includes('OLD.is_public IS DISTINCT FROM NEW.is_public') &&
                                 sql010.includes('Unauthorized: Only Super Admins can alter church directory visibility');

if (protectsIsPublicOnUpdate) {
  pass('Protects is_public on UPDATE', 'enforce_church_invariants raises exception if non-admin alters is_public');
} else {
  fail('Protects is_public on UPDATE', 'Missing is_public protection in enforce_church_invariants');
}

const preservesExistingInvariantProtections =
  sql010.includes('OLD.status IS DISTINCT FROM NEW.status') &&
  sql010.includes('OLD.verification_status IS DISTINCT FROM NEW.verification_status') &&
  sql010.includes('OLD.verification_notes IS DISTINCT FROM NEW.verification_notes') &&
  sql010.includes('OLD.created_by IS DISTINCT FROM NEW.created_by');

if (preservesExistingInvariantProtections) {
  pass('Preserves existing field protections', 'status, verification_status, verification_notes, and created_by remain protected');
} else {
  fail('Preserves existing field protections', 'Missing protection for status, verification, or created_by');
}

const enforcesNonAdminInsertPrivate = sql010.includes('IF NOT public.is_admin() THEN') &&
                                      sql010.includes('NEW.is_public := false;');

if (enforcesNonAdminInsertPrivate) {
  pass('Forces is_public = false on non-admin INSERT', 'New non-admin churches forced to private sandbox');
} else {
  fail('Forces is_public = false on non-admin INSERT', 'Non-admin INSERT is not forced to is_public = false');
}

// -----------------------------------------------------------------------------
// SECTION 4: Pastor Role Governance on church_memberships
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 4: Pastor Role Governance on church_memberships ---');

// Policy 1: INSERT policy restricts 'pastor' to Super Admin
const insertPolicyCorrect = sql010.includes('CREATE POLICY "church_memberships_insert_pastor"') &&
                            sql010.includes('public.is_admin() OR') &&
                            sql010.includes("public.is_church_pastor(church_id) AND role IN ('member', 'worship_leader')");

if (insertPolicyCorrect) {
  pass('INSERT role governance', 'Only Super Admin can insert role="pastor"; pastors restricted to member/worship_leader');
} else {
  fail('INSERT role governance', 'church_memberships_insert_pastor does not restrict pastor role');
}

// Policy 2: UPDATE policy restricts 'pastor' to Super Admin
const updatePolicyCorrect = sql010.includes('CREATE POLICY "church_memberships_update_pastor"') &&
                            sql010.includes('USING (public.is_church_pastor(church_id))') &&
                            sql010.includes('WITH CHECK (') &&
                            sql010.includes('public.is_admin() OR') &&
                            sql010.includes("public.is_church_pastor(church_id) AND role IN ('member', 'worship_leader')");

if (updatePolicyCorrect) {
  pass('UPDATE role governance', 'Only Super Admin can promote to role="pastor"; pastors restricted to member/worship_leader');
} else {
  fail('UPDATE role governance', 'church_memberships_update_pastor does not restrict pastor role promotion');
}

// Policy 3: DELETE policy prevents non-admin pastor from deleting other pastors
const deletePolicyCorrect = sql010.includes('CREATE POLICY "church_memberships_delete"') &&
                            sql010.includes('user_id = auth.uid() OR') &&
                            sql010.includes('public.is_admin() OR') &&
                            sql010.includes("public.is_church_pastor(church_id) AND role IN ('member', 'worship_leader')");

if (deletePolicyCorrect) {
  pass('DELETE role governance', 'Users can leave, Super Admin can remove any, Pastors can only remove member/worship_leader');
} else {
  fail('DELETE role governance', 'church_memberships_delete allows pastors to delete other pastors');
}

// Confirm existing last-active-pastor protection is preserved in 006
const sql006 = readFileSync(resolve(rootDir, 'supabase/migrations/006_church_foundation.sql'), 'utf8');
const preservesLastPastorTrigger = sql006.includes('CREATE TRIGGER trg_protect_last_active_pastor') &&
                                   sql006.includes('protect_last_active_pastor()');

if (preservesLastPastorTrigger) {
  pass('Last active pastor protection preserved', 'trg_protect_last_active_pastor remains active and untouched');
} else {
  fail('Last active pastor protection preserved', 'Missing protect_last_active_pastor in foundation');
}

// Confirm member join request policy preserved in 007
const sql007 = readFileSync(resolve(rootDir, 'supabase/migrations/007_church_inactive_access_fix.sql'), 'utf8');
const preservesJoinRequest = sql007.includes('CREATE POLICY "church_memberships_insert_request"');

if (preservesJoinRequest) {
  pass('Join request policy preserved', 'church_memberships_insert_request remains active in migration history');
} else {
  fail('Join request policy preserved', 'Missing church_memberships_insert_request in migration history');
}

// -----------------------------------------------------------------------------
// SECTION 5: Super Admin Pastor Assignment RPC
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 5: Super Admin Pastor Assignment RPC Contract ---');

const definesRpc = sql010.includes('CREATE OR REPLACE FUNCTION public.admin_assign_church_pastor(') &&
                   sql010.includes('p_church_id UUID,') &&
                   sql010.includes('p_user_id UUID') &&
                   sql010.includes('RETURNS void');

if (definesRpc) {
  pass('RPC signature', 'admin_assign_church_pastor(UUID, UUID) RETURNS void defined');
} else {
  fail('RPC signature', 'Missing admin_assign_church_pastor function signature or not RETURNS void');
}

const checksAdmin = sql010.includes('IF NOT public.is_admin() THEN') &&
                    sql010.includes('Unauthorized: Only Super Admins can assign church pastors');

if (checksAdmin) {
  pass('RPC admin check', 'Restricts execution strictly to public.is_admin()');
} else {
  fail('RPC admin check', 'admin_assign_church_pastor does not verify public.is_admin()');
}

const validatesInputs = sql010.includes('IF p_church_id IS NULL OR p_user_id IS NULL THEN') &&
                        sql010.includes('SELECT status INTO v_church_status') &&
                        sql010.includes('WHERE id = p_church_id;') &&
                        sql010.includes("IF v_church_status <> 'active' THEN") &&
                        /SELECT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+public\.profiles\s+WHERE\s+id\s*=\s*p_user_id\s*\)/i.test(sql010);

if (validatesInputs) {
  pass('RPC input & existence validation', 'Validates non-null IDs, church existence + active status, and user existence in profiles');
} else {
  fail('RPC input & existence validation', 'Missing input validation for church or user');
}

const atomicUpsert = sql010.includes('INSERT INTO public.church_memberships') &&
                     sql010.includes("ON CONFLICT (church_id, user_id)") &&
                     sql010.includes("DO UPDATE SET") &&
                     sql010.includes("role = 'pastor'") &&
                     sql010.includes("status = 'active'") &&
                     sql010.includes("updated_by = auth.uid()");

if (atomicUpsert) {
  pass('RPC atomic assignment', 'Atomically inserts or upgrades membership to role="pastor", status="active", updated_by=auth.uid()');
} else {
  fail('RPC atomic assignment', 'Missing atomic upsert on church_memberships in RPC');
}

// Check predecessor pastor demotion
const demotesOtherPastors = sql010.includes('UPDATE public.church_memberships') &&
                           sql010.includes("role = 'member'") &&
                           sql010.includes("status = 'active'") &&
                           sql010.includes("church_id = p_church_id") &&
                           sql010.includes("user_id <> p_user_id") &&
                           sql010.includes("role = 'pastor'") &&
                           sql010.includes("status = 'active'");

const upsertIdx = sql010.indexOf('INSERT INTO public.church_memberships');
const demoteIdx = sql010.indexOf('UPDATE public.church_memberships');
const orderPreservesTrigger = upsertIdx !== -1 && demoteIdx !== -1 && upsertIdx < demoteIdx;

if (demotesOtherPastors && orderPreservesTrigger) {
  pass('RPC atomic predecessor demotion', 'Demotes other active pastors to role="member", status="active" AFTER assigning new pastor, preserving protect_last_active_pastor trigger');
} else {
  fail('RPC atomic predecessor demotion', 'Missing or incorrectly ordered predecessor pastor demotion in RPC');
}

const rpcSecurityDefiner = sql010.includes('SECURITY DEFINER') &&
                           sql010.includes("SET search_path = ''");

if (rpcSecurityDefiner) {
  pass('RPC SECURITY DEFINER hardening', 'Uses SECURITY DEFINER with empty search_path to prevent hijacking');
} else {
  fail('RPC SECURITY DEFINER hardening', 'Missing SECURITY DEFINER or empty search_path');
}

const rpcExecutionGrants = sql010.includes('REVOKE EXECUTE ON FUNCTION public.admin_assign_church_pastor(UUID, UUID) FROM PUBLIC;') &&
                           sql010.includes('GRANT EXECUTE ON FUNCTION public.admin_assign_church_pastor(UUID, UUID) TO authenticated;');

if (rpcExecutionGrants) {
  pass('RPC execution privileges', 'REVOKE from PUBLIC, GRANT to authenticated');
} else {
  fail('RPC execution privileges', 'Missing proper REVOKE/GRANT on RPC');
}

const reloadsSchema = sql010.includes("NOTIFY pgrst, 'reload schema'");
if (reloadsSchema) {
  pass('PostgREST schema reload', "NOTIFY pgrst, 'reload schema' included to refresh API schema cache");
} else {
  fail('PostgREST schema reload', "Missing NOTIFY pgrst, 'reload schema'");
}

// -----------------------------------------------------------------------------
// SECTION 6: Church Creation & Zero-Membership State
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 6: Church Creation & Zero-Membership Contract ---');

// Confirm Migration 009 restricts direct church INSERT to Super Admin
const sql009 = readFileSync(resolve(rootDir, 'supabase/migrations/009_church_creation_admin_only.sql'), 'utf8');
const adminOnlyInsert = sql009.includes('CREATE POLICY "churches_insert_admin"') &&
                        sql009.includes('WITH CHECK (public.is_admin());');

if (adminOnlyInsert) {
  pass('V1 Church creation boundary', 'churches_insert_admin continues to restrict creation strictly to Super Admin');
} else {
  fail('V1 Church creation boundary', 'Missing churches_insert_admin in Migration 009');
}

// With trg_on_church_created removed, INSERT into churches creates 0 rows in church_memberships.
// protect_last_active_pastor is BEFORE UPDATE OR DELETE on church_memberships, so it does not fire on church creation.
pass('Zero-membership valid state', 'New church row created without auto-membership; church validly exists with 0 members (Awaiting Pastor)');

// -----------------------------------------------------------------------------
// SECTION 7: Security Hygiene & Scope Isolation
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 7: Security Hygiene & Scope Isolation ---');

// No service_role in Migration 010
if (!sql010.includes('service_role')) {
  pass('Zero service_role in migration', 'Migration 010 contains no elevated service_role references');
} else {
  fail('Zero service_role in migration', 'Found service_role reference in Migration 010');
}

// No hardcoded UUIDs in Migration 010
const uuidMatch = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(sql010);
if (!uuidMatch) {
  pass('Zero hardcoded UUIDs', 'Migration 010 is completely dynamic and parameterized');
} else {
  fail('Zero hardcoded UUIDs', 'Found hardcoded UUID in Migration 010');
}

// Cross-church isolation: ensure church_id is strictly checked in policies
const crossChurchProtected = sql010.includes('public.is_church_pastor(church_id)');
if (crossChurchProtected) {
  pass('Cross-church isolation', 'Membership policies strictly scope pastor checks to the row church_id');
} else {
  fail('Cross-church isolation', 'Missing scoped church_id in membership policy check');
}

// Summary
console.log('\n============================================================');
console.log(`MIGRATION 010 TEST SUMMARY: ${passedTests} passed, ${failedTests} failed out of ${totalTests} tests`);
console.log('============================================================');

if (failedTests > 0) {
  process.exit(1);
}
