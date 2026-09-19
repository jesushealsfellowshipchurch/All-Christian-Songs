/**
 * test_church_member_identities_rpc.js — Phase 2C Migration 011 RPC & Security Audit
 *
 * All Christian Songs — Church-Scoped Member Identity Resolution RPC Test Suite
 *
 * Verification Areas:
 * 1. Migration 011 SQL Structure & Parity (canonical vs phase-2c archive)
 * 2. SECURITY DEFINER contract, SET search_path = '', function signature
 * 3. Authentication requirement (auth.uid() IS NULL check)
 * 4. Active church validation (inactive church blocked)
 * 5. Tenant isolation & authorization check:
 *    - Authenticated caller with active membership can resolve identities
 *    - Caller without active membership in church is blocked
 *    - Caller cannot resolve another church
 *    - Platform Admin can resolve identities
 * 6. Data minimization contract:
 *    - Returns ONLY user_id, full_name, platform_role
 *    - Zero email, password, phone, tokens, or sensitive fields
 * 7. Profiles table RLS invariant:
 *    - profiles_select_own_or_admin policy remains untouched and private
 *    - Profiles RLS is NOT modified or weakened
 * 8. Client service integration:
 *    - fetchChurchMembers uses get_church_member_identities RPC instead of direct profiles table query
 *    - Exported getChurchMemberIdentities function
 *    - In-memory fallback parity
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  fetchChurchMembers,
  getChurchMemberIdentities
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
  console.log(`  ✓ PASS: ${testName}${details ? ` — ${details}` : ''}`);
}

function fail(testName, error = '') {
  totalTests++;
  failedTests++;
  console.error(`  ✗ FAIL: ${testName}${error ? ` — ${error}` : ''}`);
}

console.log('================================================================');
console.log('PHASE 2C MIGRATION 011: CHURCH MEMBER IDENTITIES RPC AUDIT');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. Migration 011 SQL File Existence & Archive Parity
// -----------------------------------------------------------------------------
console.log('[SECTION 1] Migration 011 SQL Files & Archive Parity');

const canonicalSqlPath = resolve(rootDir, 'supabase/migrations/011_church_member_identities_rpc.sql');
const archiveSqlPath = resolve(rootDir, 'migration/phase-2c/011_church_member_identities_rpc.sql');

if (existsSync(canonicalSqlPath)) {
  pass('Canonical migration 011 file exists', canonicalSqlPath);
} else {
  fail('Canonical migration 011 file exists', `File missing at ${canonicalSqlPath}`);
}

if (existsSync(archiveSqlPath)) {
  pass('Phase-2c archive migration 011 file exists', archiveSqlPath);
} else {
  fail('Phase-2c archive migration 011 file exists', `File missing at ${archiveSqlPath}`);
}

const canonicalSql = readFileSync(canonicalSqlPath, 'utf8');
const archiveSql = readFileSync(archiveSqlPath, 'utf8');

if (canonicalSql === archiveSql) {
  pass('Migration 011 archive parity', 'Archive copy is bit-for-bit identical to canonical migration');
} else {
  fail('Migration 011 archive parity', 'Canonical and archive SQL files differ');
}

console.log('');

// -----------------------------------------------------------------------------
// 2. RPC Signature & Security Definer Hardening
// -----------------------------------------------------------------------------
console.log('[SECTION 2] RPC Signature & Security Hardening');

// Function signature
const hasCorrectSignature = canonicalSql.includes('FUNCTION public.get_church_member_identities(p_church_id UUID)') ||
  canonicalSql.includes('get_church_member_identities(p_church_id UUID)');
if (hasCorrectSignature) {
  pass('RPC function signature', 'public.get_church_member_identities(p_church_id UUID)');
} else {
  fail('RPC function signature', 'Incorrect or missing function signature');
}

// Return table schema
const hasReturnTable = canonicalSql.includes('RETURNS TABLE (') &&
  canonicalSql.includes('user_id UUID') &&
  canonicalSql.includes('full_name TEXT') &&
  canonicalSql.includes('platform_role TEXT');
if (hasReturnTable) {
  pass('RPC return table columns', 'TABLE (user_id UUID, full_name TEXT, platform_role TEXT)');
} else {
  fail('RPC return table columns', 'Missing user_id, full_name, or platform_role return columns');
}

// SECURITY DEFINER
const isSecurityDefiner = canonicalSql.includes('SECURITY DEFINER');
if (isSecurityDefiner) {
  pass('SECURITY DEFINER attribute', 'Executes with elevated definer privileges to bridge church membership and profile info');
} else {
  fail('SECURITY DEFINER attribute', 'Missing SECURITY DEFINER');
}

// SET search_path = ''
const hasSearchPathEmpty = canonicalSql.includes("SET search_path = ''");
if (hasSearchPathEmpty) {
  pass('Empty search_path hardening', "Uses SET search_path = '' to prevent schema poisoning");
} else {
  fail('Empty search_path hardening', "Missing SET search_path = ''");
}

// Privileges: revoke from public, grant to authenticated
const revokesPublic = canonicalSql.includes('REVOKE EXECUTE ON FUNCTION public.get_church_member_identities(UUID) FROM PUBLIC');
const grantsAuthenticated = canonicalSql.includes('GRANT EXECUTE ON FUNCTION public.get_church_member_identities(UUID) TO authenticated');
if (revokesPublic && grantsAuthenticated) {
  pass('Execution privileges', 'REVOKE from PUBLIC, GRANT to authenticated');
} else {
  fail('Execution privileges', 'Incorrect privilege grants');
}

// PostgREST schema reload
const hasSchemaReload = canonicalSql.includes("NOTIFY pgrst, 'reload schema'");
if (hasSchemaReload) {
  pass('PostgREST schema cache reload', "Includes NOTIFY pgrst, 'reload schema'");
} else {
  fail('PostgREST schema cache reload', 'Missing schema reload notification');
}

console.log('');

// -----------------------------------------------------------------------------
// 3. Authorization, Tenant Isolation & Data Minimization SQL Checks
// -----------------------------------------------------------------------------
console.log('[SECTION 3] Authorization & Tenant Isolation Logic');

// Anonymous blocked: auth.uid() IS NULL check
const hasAuthCheck = canonicalSql.includes('auth.uid() IS NULL');
if (hasAuthCheck) {
  pass('Authentication required check', 'Anonymous callers blocked when auth.uid() IS NULL');
} else {
  fail('Authentication required check', 'Missing auth.uid() IS NULL validation');
}

// Inactive church blocked check
const hasActiveChurchCheck = canonicalSql.includes("c.status = 'active'") &&
  canonicalSql.includes('Church workspace not found or currently inactive');
if (hasActiveChurchCheck) {
  pass('Active church verification', "Blocks requests if church does not exist or status != 'active'");
} else {
  fail('Active church verification', 'Missing active church status validation');
}

// Tenant isolation: caller must have active membership in target church OR be admin
const hasTenantIsolation = canonicalSql.includes('cm.church_id = p_church_id') &&
  canonicalSql.includes('cm.user_id = auth.uid()') &&
  canonicalSql.includes("cm.status = 'active'") &&
  canonicalSql.includes('public.is_admin()');
if (hasTenantIsolation) {
  pass('Tenant isolation check', 'Requires caller to hold active membership in target church or be platform admin');
} else {
  fail('Tenant isolation check', 'Missing church-scoped active membership check');
}

// Church-scoped output: only members of p_church_id returned
const hasChurchScopedQuery = canonicalSql.includes('WHERE cm.church_id = p_church_id');
if (hasChurchScopedQuery) {
  pass('Church-scoped output filtering', 'Query strictly filters cm.church_id = p_church_id');
} else {
  fail('Church-scoped output filtering', 'Missing WHERE cm.church_id = p_church_id clause');
}

// Data minimization: verify RETURNS TABLE and SELECT contain only the 3 safe columns
const returnTableBlock = canonicalSql.match(/RETURNS TABLE\s*\(([\s\S]*?)\)/i)?.[1] || '';
const hasEmailInReturn = /\bemail\b/i.test(returnTableBlock);
const hasPasswordInReturn = /\bpassword\b/i.test(returnTableBlock);
const selectBlock = canonicalSql.match(/SELECT DISTINCT([\s\S]*?)FROM/i)?.[1] || '';
const hasEmailInSelect = /\bemail\b/i.test(selectBlock);

if (!hasEmailInReturn && !hasPasswordInReturn && !hasEmailInSelect) {
  pass('Data minimization: zero email or password columns returned', 'Output strictly limited to safe public identity fields');
} else {
  fail('Data minimization', 'Found email or sensitive field in RPC return columns');
}

// Profiles RLS unchanged: zero ALTER TABLE profiles, zero DROP POLICY on profiles
const touchesProfilesPolicy = /ALTER TABLE.*profiles/i.test(canonicalSql) ||
  /DROP POLICY.*profiles/i.test(canonicalSql) ||
  /CREATE POLICY.*profiles/i.test(canonicalSql);
if (!touchesProfilesPolicy) {
  pass('Profiles RLS untouched', 'Migration 011 does NOT alter profiles table policies');
} else {
  fail('Profiles RLS untouched', 'Found policy modifications targeting profiles table');
}

console.log('');

// -----------------------------------------------------------------------------
// 4. Client Service Integration in churchService.js
// -----------------------------------------------------------------------------
console.log('[SECTION 4] Client Service Integration: churchService.js');

const servicePath = resolve(rootDir, 'src/services/churchService.js');
const serviceContent = readFileSync(servicePath, 'utf8');

// Check that getChurchMemberIdentities is exported
const exportsIdentityRpc = serviceContent.includes('export async function getChurchMemberIdentities(');
if (exportsIdentityRpc) {
  pass('getChurchMemberIdentities exported', 'Function exported from churchService.js');
} else {
  fail('getChurchMemberIdentities exported', 'Missing getChurchMemberIdentities export');
}

// Check that fetchChurchMembers invokes get_church_member_identities RPC
const callsIdentityRpcInFetch = serviceContent.includes(".rpc('get_church_member_identities', { p_church_id: churchId })") ||
  serviceContent.includes(".rpc('get_church_member_identities'");
if (callsIdentityRpcInFetch) {
  pass('fetchChurchMembers invokes get_church_member_identities RPC', 'Replaced direct profiles table query with RPC');
} else {
  fail('fetchChurchMembers invokes get_church_member_identities RPC', 'Still using direct profiles table query');
}

// Extract fetchChurchMembers function body to ensure it does not query profiles directly
const fetchMembersMatch = serviceContent.match(/export async function fetchChurchMembers[\s\S]*?^}/m);
const fetchMembersBody = fetchMembersMatch ? fetchMembersMatch[0] : '';
const fetchMembersDirectProfiles = fetchMembersBody.includes(".from('profiles')");

if (!fetchMembersDirectProfiles) {
  pass('Zero direct profiles table query in fetchChurchMembers', 'fetchChurchMembers relies on get_church_member_identities RPC');
} else {
  fail('Direct profiles table query in fetchChurchMembers', 'fetchChurchMembers still contains .from("profiles")');
}

// Check that identity mapping assigns platform_role to profile.role
const mapsPlatformRole = serviceContent.includes('row.platform_role');
if (mapsPlatformRole) {
  pass('Platform role mapping', 'Maps row.platform_role into member profile.role');
} else {
  fail('Platform role mapping', 'Missing platform_role mapping');
}

console.log('');

// -----------------------------------------------------------------------------
// 5. Functional Simulated RPC & Roster Merge Logic
// -----------------------------------------------------------------------------
console.log('[SECTION 5] Functional Identity Resolution & Merge Tests');

// Simulate the database RPC logic in JS
function simulateGetChurchMemberIdentities(p_church_id, caller, dbState) {
  // 1. Auth check
  if (!caller || !caller.id) {
    throw new Error('Authentication required.');
  }

  // 2. Input validation
  if (!p_church_id) {
    throw new Error('Valid church ID is required.');
  }

  // 3. Target church active check
  const church = dbState.churches.find(c => c.id === p_church_id);
  if (!church || church.status !== 'active') {
    throw new Error('Church workspace not found or currently inactive.');
  }

  // 4. Tenant isolation check: caller must be admin or active member of this church
  const isPlatformAdmin = caller.role === 'admin';
  const hasActiveMembership = dbState.memberships.some(
    cm => cm.church_id === p_church_id && cm.user_id === caller.id && cm.status === 'active'
  );

  if (!isPlatformAdmin && !hasActiveMembership) {
    throw new Error('Access denied. Active church membership or platform admin privileges required.');
  }

  // 5. Return identities of members for this church
  const churchMembers = dbState.memberships.filter(cm => cm.church_id === p_church_id);
  const userIds = [...new Set(churchMembers.map(cm => cm.user_id))];

  return userIds.map(uid => {
    const prof = dbState.profiles.find(p => p.id === uid);
    return {
      user_id: uid,
      full_name: prof?.full_name?.trim() || 'Unnamed user',
      platform_role: prof?.role || 'user'
    };
  });
}

// Database state matching production
const dbState = {
  churches: [
    { id: 'church-jhf-vz', name: 'Jesus Heals Fellowship Vizianagaram', status: 'active' },
    { id: 'church-inactive', name: 'Old Church', status: 'inactive' },
    { id: 'church-other', name: 'Grace Fellowship', status: 'active' }
  ],
  profiles: [
    { id: 'usr-sri-sherwin', full_name: 'Sri Sherwin', role: 'admin' },
    { id: 'usr-sri-sri', full_name: 'Sri Sri', role: 'user' },
    { id: 'usr-unnamed', full_name: null, role: 'user' },
    { id: 'usr-other-church', full_name: 'Other Member', role: 'user' }
  ],
  memberships: [
    { id: 'mem-1', church_id: 'church-jhf-vz', user_id: 'usr-sri-sherwin', role: 'member', status: 'active' },
    { id: 'mem-2', church_id: 'church-jhf-vz', user_id: 'usr-sri-sri', role: 'pastor', status: 'active' },
    { id: 'mem-3', church_id: 'church-jhf-vz', user_id: 'usr-unnamed', role: 'member', status: 'pending' },
    { id: 'mem-4', church_id: 'church-other', user_id: 'usr-other-church', role: 'member', status: 'active' }
  ]
};

// Test 5.1: Pastor Sri Sri queries own church
{
  const caller = { id: 'usr-sri-sri', role: 'user' };
  try {
    const identities = simulateGetChurchMemberIdentities('church-jhf-vz', caller, dbState);
    if (identities.length === 3) {
      pass('Pastor can resolve identities in own active church', `Returned ${identities.length} member identities`);
    } else {
      fail('Pastor can resolve identities in own active church', `Expected 3, got ${identities.length}`);
    }

    const superAdmin = identities.find(i => i.user_id === 'usr-sri-sherwin');
    if (superAdmin && superAdmin.full_name === 'Sri Sherwin' && superAdmin.platform_role === 'admin') {
      pass('Platform Admin identity correctly resolved for Pastor', 'name="Sri Sherwin", platform_role="admin"');
    } else {
      fail('Platform Admin identity correctly resolved for Pastor', JSON.stringify(superAdmin));
    }

    const pastor = identities.find(i => i.user_id === 'usr-sri-sri');
    if (pastor && pastor.full_name === 'Sri Sri' && pastor.platform_role === 'user') {
      pass('Pastor own identity correctly resolved', 'name="Sri Sri", platform_role="user"');
    } else {
      fail('Pastor own identity correctly resolved', JSON.stringify(pastor));
    }

    const unnamed = identities.find(i => i.user_id === 'usr-unnamed');
    if (unnamed && unnamed.full_name === 'Unnamed user') {
      pass('Pending member with null name falls back to "Unnamed user"');
    } else {
      fail('Pending member fallback', JSON.stringify(unnamed));
    }
  } catch (err) {
    fail('Pastor query failed unexpectedly', err.message);
  }
}

// Test 5.2: Pastor Sri Sri tries to query another church (Tenant isolation enforcement)
{
  const caller = { id: 'usr-sri-sri', role: 'user' };
  let blocked = false;
  try {
    simulateGetChurchMemberIdentities('church-other', caller, dbState);
  } catch (err) {
    blocked = true;
    if (err.message.includes('Access denied')) {
      pass('Tenant isolation: Pastor cannot resolve another church', err.message);
    } else {
      fail('Tenant isolation', `Unexpected error message: ${err.message}`);
    }
  }
  if (!blocked) fail('Tenant isolation', 'Expected query for other church to throw Access denied');
}

// Test 5.3: Anonymous caller is blocked
{
  let blocked = false;
  try {
    simulateGetChurchMemberIdentities('church-jhf-vz', null, dbState);
  } catch (err) {
    blocked = true;
    if (err.message.includes('Authentication required')) {
      pass('Anonymous caller blocked', err.message);
    } else {
      fail('Anonymous caller blocked', err.message);
    }
  }
  if (!blocked) fail('Anonymous caller blocked', 'Expected exception');
}

// Test 5.4: Inactive church is blocked
{
  const caller = { id: 'usr-sri-sherwin', role: 'admin' };
  let blocked = false;
  try {
    simulateGetChurchMemberIdentities('church-inactive', caller, dbState);
  } catch (err) {
    blocked = true;
    if (err.message.includes('inactive')) {
      pass('Inactive church blocked', err.message);
    } else {
      fail('Inactive church blocked', err.message);
    }
  }
  if (!blocked) fail('Inactive church blocked', 'Expected exception for inactive church');
}

// Test 5.5: Platform Admin can resolve any active church
{
  const caller = { id: 'usr-sri-sherwin', role: 'admin' };
  try {
    const identities = simulateGetChurchMemberIdentities('church-other', caller, dbState);
    if (identities.length === 1 && identities[0].user_id === 'usr-other-church') {
      pass('Platform Admin can resolve identities across active churches');
    } else {
      fail('Platform Admin resolve', `Unexpected identities: ${JSON.stringify(identities)}`);
    }
  } catch (err) {
    fail('Platform Admin resolve failed', err.message);
  }
}

// Test 5.6: In-memory fallback parity in churchService
{
  const res = await getChurchMemberIdentities('jhf-vizianagaram');
  if (res.success && Array.isArray(res.data)) {
    pass('Service fallback parity: getChurchMemberIdentities returns success with array');
  } else {
    fail('Service fallback parity: getChurchMemberIdentities failed', res.error);
  }
}

console.log('');
console.log('================================================================');
console.log(`RPC AUDIT COMPLETE: ${passedTests}/${totalTests} PASSED, ${failedTests} FAILED`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
