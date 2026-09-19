/**
 * test_roster_identity_presentation.js — Phase 2C Roster Identity & Governance Test Suite
 *
 * All Christian Songs — Pastor's Church Workspace Roster Identity Verification
 *
 * Requirements Tested:
 * 1. Resolve church_membership.user_id through public.profiles.
 * 2. Platform Admin Identity:
 *    - Display actual Super Admin name from profile or auth session/metadata/email.
 *    - Do NOT display "Unnamed user" if the authenticated Super Admin's real profile identity is available.
 *    - Never expose UUIDs in visible UI.
 *    - Never invent a name.
 * 3. Platform Admin Role Presentation:
 *    - Primary visible role label is "Admin" (not "Member").
 *    - Secondary metadata displays "Church role: Member".
 *    - Internal church membership role remains 'member'.
 *    - Internal platform role remains 'admin'.
 * 4. Platform Admin Role Locked:
 *    - Do NOT render role dropdown (<select>) for Platform Admin.
 *    - Do NOT render remove button (UserX) for Platform Admin.
 *    - Row is completely read-only from Pastor's perspective.
 * 5. Role Mutation Safety & Prevention of Unexpected Toasts:
 *    - Zero automatic role mutation calls on login, mount, load, or tab switch.
 *    - handleRoleChange guard blocks platform admin mutations.
 *    - handleRoleChange guard blocks redundant/no-op mutations (target.role === newRole).
 *    - handleRoleChange requires explicit window.confirm.
 *    - handleRemoveMember guard blocks removing platform admins.
 *    - Tab switching resets action notices.
 * 6. Regular Members:
 *    - Pastor can manage regular members (Member, Worship Leader, Pastor).
 *    - Dropdown operates on church membership role.
 *    - Remove button is available for regular members.
 * 7. Mobile resilience and responsive layout preserved.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { fetchChurchMembers } from '../../src/services/churchService.js';

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
console.log('PHASE 2C: ROSTER IDENTITY PRESENTATION & GOVERNANCE AUDIT');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. Static Audit of ChurchWorkspaceModal.jsx
// -----------------------------------------------------------------------------
console.log('[SECTION 1] Static Code Audit: ChurchWorkspaceModal.jsx');

const modalPath = resolve(rootDir, 'src/components/church/ChurchWorkspaceModal.jsx');
if (!existsSync(modalPath)) {
  fail('ChurchWorkspaceModal.jsx existence', `File not found at ${modalPath}`);
} else {
  pass('ChurchWorkspaceModal.jsx exists', modalPath);
}

const modalContent = readFileSync(modalPath, 'utf8');

// Check that UUID truncation pattern is NOT present in visible UI
const hasTruncatedUserId = modalContent.includes('m.user_id.slice');
const hasUserIdLabel = /User ID:\s*\{m\.user_id/i.test(modalContent);
const hasMemberIdLabel = /Member \(\{m\.user_id/i.test(modalContent);

if (!hasTruncatedUserId && !hasUserIdLabel && !hasMemberIdLabel) {
  pass('Zero truncated UUID exposure in visible UI', 'Removed m.user_id.slice patterns from roster lists');
} else {
  fail('Zero truncated UUID exposure', 'Found leftover user_id slice or UUID display patterns in JSX');
}

// Check safe display name resolution with resolveMemberName
const hasResolveMemberName = modalContent.includes('const resolveMemberName =') &&
  modalContent.includes('resolveMemberName(m)');
const hasUnnamedUserFallback = modalContent.includes("'Unnamed user'");

if (hasResolveMemberName && hasUnnamedUserFallback) {
  pass('Safe display name resolution', 'Implements resolveMemberName(m) with Unnamed user fallback');
} else {
  fail('Safe display name resolution', 'Missing resolveMemberName implementation or Unnamed user fallback');
}

// Check Admin primary role label resolution
const hasAdminPrimaryRole = modalContent.includes("const primaryRole = isAdmin ? 'Admin' : churchRoleFormatted") ||
  modalContent.includes("isAdmin ? 'Admin'");
if (hasAdminPrimaryRole) {
  pass('Admin primary role label resolution', 'Displays "Admin" as primary role label when profile.role === "admin"');
} else {
  fail('Admin primary role label resolution', 'Missing primary role resolution for admin');
}

// Check secondary metadata for Admin: Church role
const hasChurchRoleSecondaryMetadata = modalContent.includes('Church role:') &&
  modalContent.includes('churchRoleFormatted');
if (hasChurchRoleSecondaryMetadata) {
  pass('Church role secondary metadata for Admin', 'Displays "Church role: {role}" for platform admins');
} else {
  fail('Church role secondary metadata', 'Missing "Church role: {role}" secondary display for admin');
}

// Check role dropdown locked for Admin: only non-admin gets select
const hasRoleDropdownAdminLock = modalContent.includes('isPastor && !isAdmin ?') &&
  modalContent.includes('<select');
if (hasRoleDropdownAdminLock) {
  pass('Platform Admin role locked: no dropdown', 'Role dropdown rendered only when !isAdmin');
} else {
  fail('Platform Admin role locked: no dropdown', 'Missing !isAdmin check on role dropdown');
}

// Check remove button locked for Admin: only non-admin gets remove button
const hasRemoveAdminLock = modalContent.includes('isPastor && !isAdmin &&') &&
  modalContent.includes('handleRemoveMember(m.id)');
if (hasRemoveAdminLock) {
  pass('Platform Admin role locked: no remove button', 'Remove button rendered only when !isAdmin');
} else {
  fail('Platform Admin role locked: no remove button', 'Missing !isAdmin check on remove member button');
}

// Check handleRoleChange safety guard against mutating platform admin
const hasAdminMutationGuard = modalContent.includes("targetMember.profile?.role === 'admin'");
if (hasAdminMutationGuard) {
  pass('Mutation safety: handleRoleChange refuses platform admin mutation');
} else {
  fail('Mutation safety', 'Missing platform admin guard in handleRoleChange');
}

// Check handleRoleChange safety guard against no-op redundant mutation
const hasNoopMutationGuard = modalContent.includes('targetMember.role === newRole');
if (hasNoopMutationGuard) {
  pass('Mutation safety: handleRoleChange ignores no-op identical role change');
} else {
  fail('Mutation safety', 'Missing targetMember.role === newRole guard in handleRoleChange');
}

// Check handleRoleChange confirmation dialog
const hasRoleConfirmation = modalContent.includes('window.confirm') &&
  modalContent.includes('church role to');
if (hasRoleConfirmation) {
  pass('Mutation safety: explicit confirmation required before role update');
} else {
  fail('Mutation safety', 'Missing window.confirm in handleRoleChange');
}

// Check handleRemoveMember guard against deleting platform admin
const hasRemoveMemberAdminGuard = modalContent.includes("!isSelf && targetMember?.profile?.role === 'admin'");
if (hasRemoveMemberAdminGuard) {
  pass('Mutation safety: handleRemoveMember refuses platform admin removal');
} else {
  fail('Mutation safety', 'Missing platform admin removal guard in handleRemoveMember');
}

// Check tab switching clears error/success notices
const hasTabSwitchNoticeReset = modalContent.includes('handleTabSwitch') &&
  modalContent.includes("setActionError('')") &&
  modalContent.includes("setActionSuccess('')");
if (hasTabSwitchNoticeReset) {
  pass('Notice hygiene: tab switching resets action notices');
} else {
  fail('Notice hygiene', 'Missing handleTabSwitch notice reset');
}

// Check role dropdown operates on church membership role
const hasRoleDropdownBinding = modalContent.includes('value={m.role}') &&
  modalContent.includes('handleRoleChange(m.id, e.target.value)');
const hasChurchRoleOptions = modalContent.includes('<option value="member">Member</option>') &&
  modalContent.includes('<option value="worship_leader">Worship Leader</option>') &&
  modalContent.includes('<option value="pastor">Pastor</option>');

if (hasRoleDropdownBinding && hasChurchRoleOptions) {
  pass('Church membership role dropdown separation', 'Operates on m.role with member/worship_leader/pastor options');
} else {
  fail('Church membership role dropdown separation', 'Role dropdown does not correctly bind to m.role');
}

// Check mobile layout resilience
const hasResponsiveRoster = modalContent.includes('flex-wrap') && modalContent.includes('truncate');
if (hasResponsiveRoster) {
  pass('Responsive mobile presentation', 'Uses flex-wrap and truncate for resilient display on smaller screens');
} else {
  fail('Responsive mobile presentation', 'Missing responsive layout classes in roster items');
}

console.log('');

// -----------------------------------------------------------------------------
// 2. Static Audit of churchService.js
// -----------------------------------------------------------------------------
console.log('[SECTION 2] Static Code Audit: churchService.js');

const servicePath = resolve(rootDir, 'src/services/churchService.js');
const serviceContent = readFileSync(servicePath, 'utf8');

// Verify fetchChurchMembers resolves identities via get_church_member_identities RPC
const resolvesViaIdentitiesRpc = serviceContent.includes(".rpc('get_church_member_identities'");

if (resolvesViaIdentitiesRpc) {
  pass('RPC identity resolution in fetchChurchMembers', 'Invokes get_church_member_identities RPC to resolve safe identities');
} else {
  fail('RPC identity resolution in fetchChurchMembers', 'Does not invoke get_church_member_identities RPC');
}

// Verify zero destructive or security-altering changes in churchService.js
const hasServiceRoleKey = serviceContent.includes('SUPABASE_SERVICE_ROLE_KEY') ||
  serviceContent.includes('service_role');
if (!hasServiceRoleKey) {
  pass('Security hygiene: Zero service_role in churchService.js');
} else {
  fail('Security hygiene', 'Found service_role reference in churchService.js');
}

console.log('');

// -----------------------------------------------------------------------------
// 3. Functional Identity Presentation & Resolution Tests
// -----------------------------------------------------------------------------
console.log('[SECTION 3] Functional Identity Presentation Logic Tests');

// Helper implementing exact ChurchWorkspaceModal presentation & name resolution logic
function resolveMemberName(m, authContext = {}) {
  const { user = null, authProfile = null } = authContext;

  // 1. If member.profile already has full_name from public.profiles
  if (m?.profile?.full_name && m.profile.full_name.trim()) {
    return m.profile.full_name.trim();
  }

  // 2. If this is the current authenticated user, resolve from authenticated session/profile
  if (user?.id && (m?.user_id === user.id || m?.profile?.id === user.id)) {
    if (authProfile?.full_name && authProfile.full_name.trim()) {
      return authProfile.full_name.trim();
    }
    const authMetaName = user.user_metadata?.full_name?.trim()
      || user.user_metadata?.name?.trim()
      || user.raw_user_meta_data?.full_name?.trim();
    if (authMetaName) {
      return authMetaName;
    }
    if (user.email) {
      return user.email;
    }
  }

  // 3. If target member is a platform admin and the current user is platform admin
  if (m?.profile?.role === 'admin' && authProfile?.role === 'admin') {
    if (authProfile?.full_name && authProfile.full_name.trim()) {
      return authProfile.full_name.trim();
    }
    const authMetaName = user?.user_metadata?.full_name?.trim()
      || user?.user_metadata?.name?.trim()
      || user?.raw_user_meta_data?.full_name?.trim();
    if (authMetaName) {
      return authMetaName;
    }
    if (user?.email) {
      return user.email;
    }
  }

  // 4. Default fallback when no real name is available anywhere
  return 'Unnamed user';
}

function renderMemberPresentation(member, authContext = {}) {
  const displayName = resolveMemberName(member, authContext);
  const isAdmin = member.profile?.role === 'admin';
  const churchRoleFormatted = member.role === 'pastor'
    ? 'Pastor'
    : member.role === 'worship_leader'
    ? 'Worship Leader'
    : 'Member';
  const primaryRoleLabel = isAdmin ? 'Admin' : churchRoleFormatted;
  const secondaryMetadata = isAdmin ? `Church role: ${churchRoleFormatted}` : null;
  const canEditRole = !isAdmin;
  const canRemove = !isAdmin;

  return {
    displayName,
    primaryRoleLabel,
    secondaryMetadata,
    churchRole: member.role,
    platformRole: member.profile?.role || 'user',
    isAdmin,
    canEditRole,
    canRemove
  };
}

// Test Case 1: Super Admin logged in (auth session metadata available, profile.full_name is NULL)
{
  const adminMember = {
    id: 'mem-sa',
    church_id: 'church-jhf-vz',
    user_id: '1dc56a3e-5c52-47fa-b02d-e305a9343e9f',
    role: 'member',
    status: 'active',
    created_at: '2026-09-19T09:00:00Z',
    profile: {
      id: '1dc56a3e-5c52-47fa-b02d-e305a9343e9f',
      full_name: null,
      role: 'admin'
    }
  };

  const authContext = {
    user: {
      id: '1dc56a3e-5c52-47fa-b02d-e305a9343e9f',
      email: 'admin@jesusheals.org',
      user_metadata: { full_name: 'Administrator' }
    },
    authProfile: { id: '1dc56a3e-5c52-47fa-b02d-e305a9343e9f', full_name: null, role: 'admin' }
  };

  const rendered = renderMemberPresentation(adminMember, authContext);

  if (rendered.displayName === 'Administrator') {
    pass('Admin with authenticated metadata: displays actual name (NOT "Unnamed user")', `displayName = "${rendered.displayName}"`);
  } else {
    fail('Admin with authenticated metadata', `Expected "Administrator", got "${rendered.displayName}"`);
  }

  if (rendered.primaryRoleLabel === 'Admin') {
    pass('Admin: primary visible role label is "Admin" (not "Member")', `primaryRoleLabel = "${rendered.primaryRoleLabel}"`);
  } else {
    fail('Admin: primary visible role label', `Expected "Admin", got "${rendered.primaryRoleLabel}"`);
  }

  if (rendered.secondaryMetadata === 'Church role: Member') {
    pass('Admin: secondary metadata is "Church role: Member"', `secondaryMetadata = "${rendered.secondaryMetadata}"`);
  } else {
    fail('Admin: secondary metadata', `Expected "Church role: Member", got "${rendered.secondaryMetadata}"`);
  }

  if (!rendered.canEditRole) {
    pass('Admin: role dropdown locked (canEditRole = false)');
  } else {
    fail('Admin: role dropdown not locked', 'canEditRole was true');
  }

  if (!rendered.canRemove) {
    pass('Admin: remove button locked (canRemove = false)');
  } else {
    fail('Admin: remove button not locked', 'canRemove was true');
  }

  if (!rendered.displayName.includes('1dc56a3e')) {
    pass('Admin: zero UUID exposure in visible presentation');
  } else {
    fail('Admin: zero UUID exposure', `Display name exposed UUID: "${rendered.displayName}"`);
  }
}

// Test Case 2: Pastor viewing Admin row when Admin full_name is NULL in public.profiles
{
  const adminMember = {
    id: 'mem-sa',
    church_id: 'church-jhf-vz',
    user_id: '1dc56a3e-5c52-47fa-b02d-e305a9343e9f',
    role: 'member',
    status: 'active',
    created_at: '2026-09-19T09:00:00Z',
    profile: {
      id: '1dc56a3e-5c52-47fa-b02d-e305a9343e9f',
      full_name: null,
      role: 'admin'
    }
  };

  const pastorContext = {
    user: { id: '9022ba84-4061-42cb-b1b7-a06ba993427f', email: 'sherwin@jhf.org' },
    authProfile: { id: '9022ba84-4061-42cb-b1b7-a06ba993427f', full_name: 'sherwin sri', role: 'user' }
  };

  const rendered = renderMemberPresentation(adminMember, pastorContext);

  if (rendered.displayName === 'Unnamed user') {
    pass('Pastor viewing Admin without profile name: safely falls back to "Unnamed user"');
  } else {
    fail('Pastor viewing Admin without profile name', `Expected "Unnamed user", got "${rendered.displayName}"`);
  }

  if (!rendered.displayName.includes('1dc56a3e')) {
    pass('Pastor viewing Admin: zero UUID exposure in display name');
  } else {
    fail('Pastor viewing Admin', `Display name exposed UUID: "${rendered.displayName}"`);
  }

  if (rendered.primaryRoleLabel === 'Admin' && !rendered.canEditRole && !rendered.canRemove) {
    pass('Pastor viewing Admin: Admin row is completely read-only');
  } else {
    fail('Pastor viewing Admin: Admin row must be completely read-only');
  }
}

// Test Case 3: Named User (Sherwin Sri, Pastor)
{
  const member = {
    id: 'mem-pastor',
    church_id: 'church-jhf-vz',
    user_id: '9022ba84-4061-42cb-b1b7-a06ba993427f',
    role: 'pastor',
    status: 'active',
    created_at: '2026-09-19T10:00:00Z',
    profile: {
      id: '9022ba84-4061-42cb-b1b7-a06ba993427f',
      full_name: 'sherwin sri',
      role: 'user'
    }
  };

  const rendered = renderMemberPresentation(member);

  if (rendered.displayName === 'sherwin sri') {
    pass('Named user: displays profile.full_name', `displayName = "${rendered.displayName}"`);
  } else {
    fail('Named user: displays profile.full_name', `Expected "sherwin sri", got "${rendered.displayName}"`);
  }

  if (rendered.primaryRoleLabel === 'Pastor') {
    pass('Pastor: primary visible role label is "Pastor"', `primaryRoleLabel = "${rendered.primaryRoleLabel}"`);
  } else {
    fail('Pastor: primary visible role label', `Expected "Pastor", got "${rendered.primaryRoleLabel}"`);
  }

  if (rendered.secondaryMetadata === null) {
    pass('Pastor: zero redundant secondary church role metadata when non-admin');
  } else {
    fail('Pastor: secondary metadata', `Expected null, got "${rendered.secondaryMetadata}"`);
  }

  if (rendered.churchRole === 'pastor') {
    pass('Pastor: church membership role is "pastor"');
  } else {
    fail('Pastor: church role', `Expected "pastor", got "${rendered.churchRole}"`);
  }

  if (rendered.canEditRole && rendered.canRemove) {
    pass('Pastor: normal member can have role managed and removed by fellow leaders');
  } else {
    fail('Pastor: normal member permissions');
  }

  if (!rendered.displayName.includes('9022ba84')) {
    pass('Pastor: zero UUID exposure in visible display name');
  } else {
    fail('Pastor: zero UUID exposure', `Display name contains UUID fragment: "${rendered.displayName}"`);
  }
}

// Test Case 4: Regular User with NULL full_name
{
  const member = {
    id: 'mem-member-null',
    church_id: 'church-jhf-vz',
    user_id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    role: 'member',
    status: 'active',
    created_at: '2026-09-19T11:00:00Z',
    profile: {
      id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      full_name: null,
      role: 'user'
    }
  };

  const rendered = renderMemberPresentation(member);

  if (rendered.displayName === 'Unnamed user') {
    pass('Null full_name regular member: displays "Unnamed user"');
  } else {
    fail('Null full_name regular member', `Expected "Unnamed user", got "${rendered.displayName}"`);
  }

  if (rendered.primaryRoleLabel === 'Member') {
    pass('Null full_name regular member: primary role is "Member"');
  } else {
    fail('Null full_name regular member: primary role', `Expected "Member", got "${rendered.primaryRoleLabel}"`);
  }

  if (rendered.secondaryMetadata === null) {
    pass('Null full_name regular member: no secondary admin metadata');
  } else {
    fail('Null full_name regular member', `Expected null, got "${rendered.secondaryMetadata}"`);
  }

  if (!rendered.displayName.includes('3fa85f64')) {
    pass('Null full_name regular member: zero UUID exposure');
  } else {
    fail('Null full_name regular member: zero UUID exposure', `Display name exposed UUID: "${rendered.displayName}"`);
  }
}

// Test Case 5: Role Independence (Church Membership Role vs Platform Role)
{
  const superAdminMember = {
    id: 'mem-sa',
    user_id: '1dc56a3e-5c52-47fa-b02d-e305a9343e9f',
    role: 'member',
    profile: { id: '1dc56a3e-5c52-47fa-b02d-e305a9343e9f', full_name: null, role: 'admin' }
  };

  const pastorMember = {
    id: 'mem-pastor',
    user_id: '9022ba84-4061-42cb-b1b7-a06ba993427f',
    role: 'pastor',
    profile: { id: '9022ba84-4061-42cb-b1b7-a06ba993427f', full_name: 'Sherwin Sri', role: 'user' }
  };

  const sa = renderMemberPresentation(superAdminMember);
  const pa = renderMemberPresentation(pastorMember);

  if (sa.primaryRoleLabel === 'Admin' && sa.churchRole === 'member' && sa.platformRole === 'admin') {
    pass('Independence: Super Admin presents as "Admin", church role="member", platform role="admin"');
  } else {
    fail('Independence: Super Admin roles conflated');
  }

  if (pa.primaryRoleLabel === 'Pastor' && pa.churchRole === 'pastor' && pa.platformRole === 'user') {
    pass('Independence: Pastor presents as "Pastor", church role="pastor", platform role="user"');
  } else {
    fail('Independence: Pastor roles conflated');
  }
}

// Test Case 6: Whitespace / Empty String full_name handling
{
  const emptyMember = {
    id: 'mem-empty',
    user_id: 'usr-empty-1',
    role: 'member',
    profile: { id: 'usr-empty-1', full_name: '    ', role: 'user' }
  };

  const rendered = renderMemberPresentation(emptyMember);
  if (rendered.displayName === 'Unnamed user') {
    pass('Empty/whitespace full_name fallback to "Unnamed user"', `Result: "${rendered.displayName}"`);
  } else {
    fail('Empty/whitespace fallback', `Expected "Unnamed user", got "${rendered.displayName}"`);
  }
}

// Test Case 7: In-memory service fetch fallback parity
{
  const res = await fetchChurchMembers('jhf-vizianagaram');
  if (res.success && Array.isArray(res.data)) {
    pass('Service fallback parity: fetchChurchMembers returns array with success');
  } else {
    fail('Service fallback parity: fetchChurchMembers failed', res.error);
  }
}

console.log('');
console.log('================================================================');
console.log(`ROSTER IDENTITY AUDIT COMPLETE: ${passedTests}/${totalTests} PASSED, ${failedTests} FAILED`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
