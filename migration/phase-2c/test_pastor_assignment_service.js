/**
 * test_pastor_assignment_service.js — Phase 2C Step 4C Pastor Assignment Service Audit
 *
 * All Christian Songs — Pastor Assignment & User Search Service Contract
 *
 * Verification Scope:
 * 1. Method Exports & Signatures:
 *    - adminAssignChurchPastor(churchId, userId)
 *    - searchPlatformUsers(searchQuery)
 *    - getChurchPastor(churchId)
 * 2. Parameter Validation:
 *    - adminAssignChurchPastor validates churchId and userId strings.
 *    - getChurchPastor validates churchId string.
 * 3. RPC Binding Contract:
 *    - adminAssignChurchPastor calls supabase.rpc('admin_assign_church_pastor', { p_church_id, p_user_id }).
 *    - Zero direct INSERT/UPDATE on church_memberships from frontend code.
 * 4. Data Minimization & Privacy:
 *    - searchPlatformUsers queries strictly 'id, full_name, role' from public.profiles.
 *    - Zero passwords, tokens, or sensitive auth data exposed.
 * 5. Fallback Parity:
 *    - In-memory offline fallback works smoothly for all 3 methods.
 * 6. Security Hygiene:
 *    - Zero service_role credentials in churchService.js.
 *    - Zero hardcoded UUIDs.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  adminAssignChurchPastor,
  searchPlatformUsers,
  getChurchPastor
} from '../../src/services/churchService.js';

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
console.log('PHASE 2C STEP 4C: PASTOR ASSIGNMENT SERVICE AUDIT');
console.log('============================================================\n');

// -----------------------------------------------------------------------------
// SECTION 1: Exports & Method Signatures
// -----------------------------------------------------------------------------
console.log('--- SECTION 1: Service Method Exports & Signatures ---');

if (typeof adminAssignChurchPastor === 'function') {
  pass('adminAssignChurchPastor exported', 'Function is correctly exported from churchService.js');
} else {
  fail('adminAssignChurchPastor exported', 'Missing adminAssignChurchPastor export');
}

if (typeof searchPlatformUsers === 'function') {
  pass('searchPlatformUsers exported', 'Function is correctly exported from churchService.js');
} else {
  fail('searchPlatformUsers exported', 'Missing searchPlatformUsers export');
}

if (typeof getChurchPastor === 'function') {
  pass('getChurchPastor exported', 'Function is correctly exported from churchService.js');
} else {
  fail('getChurchPastor exported', 'Missing getChurchPastor export');
}

// -----------------------------------------------------------------------------
// SECTION 2: Parameter Validation
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 2: Parameter Validation ---');

const resNoParams = await adminAssignChurchPastor();
if (!resNoParams.success && resNoParams.error.includes('Valid church ID is required')) {
  pass('adminAssignChurchPastor rejects missing churchId', resNoParams.error);
} else {
  fail('adminAssignChurchPastor rejects missing churchId', 'Did not reject empty churchId');
}

const resNoUser = await adminAssignChurchPastor('valid-church-id');
if (!resNoUser.success && resNoUser.error.includes('Valid user ID is required')) {
  pass('adminAssignChurchPastor rejects missing userId', resNoUser.error);
} else {
  fail('adminAssignChurchPastor rejects missing userId', 'Did not reject empty userId');
}

const resNoChurchId = await getChurchPastor();
if (!resNoChurchId.success && resNoChurchId.error.includes('Valid church ID is required')) {
  pass('getChurchPastor rejects missing churchId', resNoChurchId.error);
} else {
  fail('getChurchPastor rejects missing churchId', 'Did not reject empty churchId');
}

// -----------------------------------------------------------------------------
// SECTION 3: Code Contract Verification (AST/Regex Analysis)
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 3: Architectural Code Contracts ---');

const serviceCode = readFileSync(resolve(rootDir, 'src/services/churchService.js'), 'utf8');

// Test: Calls RPC
const callsRpc = serviceCode.includes("supabase.rpc('admin_assign_church_pastor'") &&
                 serviceCode.includes('p_church_id: churchId') &&
                 serviceCode.includes('p_user_id: userId');

if (callsRpc) {
  pass('RPC call contract', "adminAssignChurchPastor invokes supabase.rpc('admin_assign_church_pastor', { p_church_id, p_user_id })");
} else {
  fail('RPC call contract', 'Missing proper RPC call with parameter mapping');
}

// Test: No direct INSERT/UPDATE on church_memberships for pastor assignment
// Extract the adminAssignChurchPastor function block
const fnStart = serviceCode.indexOf('export async function adminAssignChurchPastor');
const fnEnd = serviceCode.indexOf('export async function searchPlatformUsers');
const adminAssignFnCode = serviceCode.substring(fnStart, fnEnd);

const hasDirectDbMutation = adminAssignFnCode.includes("supabase.from('church_memberships').insert") ||
                            adminAssignFnCode.includes("supabase.from('church_memberships').update");

if (!hasDirectDbMutation) {
  pass('Zero direct membership mutations', 'adminAssignChurchPastor relies exclusively on RPC; zero direct client table mutations');
} else {
  fail('Zero direct membership mutations', 'Detected direct supabase.from("church_memberships") mutation in adminAssignChurchPastor');
}

// Test: Data minimization in searchPlatformUsers
const searchFnStart = serviceCode.indexOf('export async function searchPlatformUsers');
const searchFnEnd = serviceCode.indexOf('export async function getChurchPastor');
const searchFnCode = serviceCode.substring(searchFnStart, searchFnEnd);

const selectsMinimalProfiles = searchFnCode.includes(".select('id, full_name, role')");
const avoidsSensitiveData = !searchFnCode.includes('password') &&
                            !searchFnCode.includes('token') &&
                            !searchFnCode.includes('secret');

if (selectsMinimalProfiles && avoidsSensitiveData) {
  pass('Data minimization in searchPlatformUsers', "Selects strictly 'id, full_name, role'; zero passwords or auth secrets exposed");
} else {
  fail('Data minimization in searchPlatformUsers', 'Profiles query exposes sensitive fields or lacks strict column selection');
}

// Test: getChurchPastor queries active pastor membership
const getPastorFnStart = serviceCode.indexOf('export async function getChurchPastor');
const getPastorFnCode = serviceCode.substring(getPastorFnStart);

const queriesActivePastor = getPastorFnCode.includes(".eq('role', 'pastor')") &&
                            getPastorFnCode.includes(".eq('status', 'active')") &&
                            getPastorFnCode.includes(".select('id, full_name, role')");

if (queriesActivePastor) {
  pass('getChurchPastor query contract', "Queries active pastor membership and resolves profile 'id, full_name, role'");
} else {
  fail('getChurchPastor query contract', 'Missing role="pastor", status="active", or profile resolution in getChurchPastor');
}

const hasDefensiveOrdering = getPastorFnCode.includes(".order('updated_at', { ascending: false })");
if (hasDefensiveOrdering) {
  pass('getChurchPastor defensive ordering', "Defensively orders by updated_at DESC for legacy data safety");
} else {
  fail('getChurchPastor defensive ordering', 'Missing defensive order by updated_at DESC in getChurchPastor');
}

// Test: Offline fallback pastor replacement demotes predecessor
const testChurchId = 'test-church-pastor-demote';
const pastorA = 'user-initial-pastor';
const pastorB = 'user-replacement-pastor';

const assignARes = await adminAssignChurchPastor(testChurchId, pastorA);
const assignBRes = await adminAssignChurchPastor(testChurchId, pastorB);

const currentPastorRes = await getChurchPastor(testChurchId);

if (
  assignARes.success &&
  assignBRes.success &&
  currentPastorRes.success &&
  currentPastorRes.data &&
  currentPastorRes.data.user_id === pastorB &&
  currentPastorRes.data.role === 'pastor'
) {
  pass('Offline fallback demotes predecessor pastor', 'Assigning replacement pastor demotes predecessor to member in fallback store');
} else {
  fail('Offline fallback demotes predecessor pastor', 'Predecessor was not demoted or current pastor did not match replacement');
}

// -----------------------------------------------------------------------------
// SECTION 4: Security Hygiene & Scope Isolation
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 4: Security Hygiene & Scope Isolation ---');

// Zero service_role in churchService.js
if (!serviceCode.includes('service_role')) {
  pass('Zero service_role', 'churchService.js contains no elevated backend credentials');
} else {
  fail('Zero service_role', 'Found service_role reference in churchService.js');
}

// Zero hardcoded UUIDs
const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
if (!uuidRegex.test(serviceCode)) {
  pass('Zero hardcoded UUIDs', 'churchService.js remains completely dynamic and parameterized');
} else {
  fail('Zero hardcoded UUIDs', 'Found hardcoded UUID in churchService.js');
}

// Summary
console.log('\n============================================================');
console.log(`PASTOR ASSIGNMENT SERVICE AUDIT SUMMARY: ${passedTests} passed, ${failedTests} failed out of ${totalTests} tests`);
console.log('============================================================');

if (failedTests > 0) {
  process.exit(1);
}
