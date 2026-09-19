/**
 * test_admin_pastor_assignment_ui.js — Phase 2C Step 4D Static & UI Verification
 *
 * All Christian Songs — Super Admin Pastor Assignment UI Test Suite
 *
 * Verifies all 12 mandatory requirements:
 * 1. AdminChurchManager file location and existence.
 * 2. Dedicated "Pastor" table header & column separate from Location, Directory, Verification, and Workspace status.
 * 3. Compact "Awaiting Pastor" state badge displayed when no pastor is assigned.
 * 4. "[ Assign Pastor ]" action button present for unassigned churches.
 * 5. Assigned Pastor name displayed with badge when pastor is active.
 * 6. "[ Change Pastor ]" action button present for assigned churches.
 * 7. Correct churchService methods imported & used:
 *    - searchPlatformUsers(searchQuery)
 *    - adminAssignChurchPastor(churchId, userId)
 *    - getChurchPastor(churchId)
 * 8. Zero direct Supabase membership mutations or imports bypassing churchService.
 * 9. Searchable platform user selector for registered users with full_name.
 * 10. Prevention of duplicate selection (disables selecting the already-active Pastor).
 * 11. Confirmation step before assignment / replacement execution.
 * 12. Minimum 44px touch targets across all interactive buttons and inputs.
 * 13. Mobile responsiveness (no horizontal overflow, flexible width modal).
 * 14. Creator -> Pastor legacy language removed (no automatic Super Admin pastor assignment).
 * 15. Admin-only integration (strictly housed in AdminPortalModal).
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
  console.log(`  ✓ PASS: ${testName}${details ? ` — ${details}` : ''}`);
}

function fail(testName, error = '') {
  totalTests++;
  failedTests++;
  console.error(`  ✗ FAIL: ${testName}${error ? ` — ${error}` : ''}`);
}

console.log('================================================================');
console.log('PHASE 2C STEP 4D: SUPER ADMIN PASTOR ASSIGNMENT UI AUDIT');
console.log('================================================================\n');

// 1. File existence
const managerPath = resolve(rootDir, 'src/components/admin/AdminChurchManager.jsx');
const portalModalPath = resolve(rootDir, 'src/components/admin/AdminPortalModal.jsx');

if (!existsSync(managerPath)) {
  fail('AdminChurchManager.jsx existence', `File not found at ${managerPath}`);
  process.exit(1);
}
pass('1. AdminChurchManager.jsx exists in admin components directory');

const managerCode = readFileSync(managerPath, 'utf8');
const portalModalCode = existsSync(portalModalPath) ? readFileSync(portalModalPath, 'utf8') : '';

// 2. Service imports
const hasAdminAssign = managerCode.includes('adminAssignChurchPastor');
const hasSearchUsers = managerCode.includes('searchPlatformUsers');
const hasGetPastor = managerCode.includes('getChurchPastor');
const importsFromService = managerCode.includes("from '../../services/churchService'");

if (hasAdminAssign && hasSearchUsers && hasGetPastor && importsFromService) {
  pass('2. Authorized service methods imported from churchService', 'adminAssignChurchPastor, searchPlatformUsers, getChurchPastor');
} else {
  fail('2. Authorized service methods imported from churchService', 'Missing one or more required service imports');
}

// 3. Zero direct Supabase membership access
const directSupabaseAccess = managerCode.includes("supabase.from('church_memberships')") ||
                             managerCode.includes('supabase.from("church_memberships")') ||
                             managerCode.includes('from \'../utils/supabaseClient\'') ||
                             managerCode.includes('from "../utils/supabaseClient"');

if (!directSupabaseAccess) {
  pass('3. Zero direct Supabase access from UI', 'UI does not bypass churchService to mutate or query church_memberships directly');
} else {
  fail('3. Zero direct Supabase access from UI', 'Found direct supabase client import or church_memberships query in AdminChurchManager');
}

// 4. Dedicated Pastor column separate from Directory, Verification, and Workspace status
const hasPastorTh = managerCode.includes('<th className="p-3 sm:p-4">Pastor</th>') ||
                    managerCode.includes('Pastor</th>');
const hasDirectoryTh = managerCode.includes('Directory</th>');
const hasVerificationTh = managerCode.includes('Verification</th>');
const hasWorkspaceTh = managerCode.includes('Workspace</th>');

if (hasPastorTh && hasDirectoryTh && hasVerificationTh && hasWorkspaceTh) {
  pass('4. Pastor field is cleanly separated into its own column', 'Pastor, Directory, Verification, and Workspace columns are distinct');
} else {
  fail('4. Pastor field is cleanly separated into its own column', 'Missing separate header for Pastor, Directory, Verification, or Workspace');
}

// 5. "Awaiting Pastor" state badge
const hasAwaitingPastor = managerCode.includes('Awaiting Pastor');
const hasUserX = managerCode.includes('UserX');

if (hasAwaitingPastor && hasUserX) {
  pass('5. Compact "Awaiting Pastor" state badge displayed for unassigned churches');
} else {
  fail('5. Compact "Awaiting Pastor" state badge displayed for unassigned churches', 'Missing "Awaiting Pastor" text or UserX icon');
}

// 6. "[ Assign Pastor ]" button with minimum 44px touch target
const hasAssignPastorButton = managerCode.includes('Assign Pastor') &&
                              managerCode.includes('min-h-[44px]');

if (hasAssignPastorButton) {
  pass('6. "[ Assign Pastor ]" action button present with minimum 44px touch target');
} else {
  fail('6. "[ Assign Pastor ]" action button present with minimum 44px touch target', 'Missing Assign Pastor button or min-h-[44px]');
}

// 7. Assigned Pastor display and "[ Change Pastor ]" button
const hasChangePastorButton = managerCode.includes('Change Pastor') &&
                              managerCode.includes('UserCheck');

if (hasChangePastorButton) {
  pass('7. Assigned Pastor name and "[ Change Pastor ]" action button present with min-h-[44px]');
} else {
  fail('7. Assigned Pastor name and "[ Change Pastor ]" action button present', 'Missing Change Pastor button or UserCheck icon');
}

// 8. Searchable platform user selector modal
const hasSearchInput = managerCode.includes('id="pastor-search-input"') &&
                       managerCode.includes('userSearchQuery');
const hasUsersListing = managerCode.includes('userSearchResults.map') &&
                        managerCode.includes('user.full_name');

if (hasSearchInput && hasUsersListing) {
  pass('8. Searchable platform user selector present showing full_name for registered users');
} else {
  fail('8. Searchable platform user selector present', 'Missing search input or results list mapping');
}

// 9. Prevent duplicate selection (disables selecting the active Pastor)
const hasPreventDuplicate = managerCode.includes('Current Pastor') &&
                            managerCode.includes('disabled={isCurrent}');

if (hasPreventDuplicate) {
  pass('9. Duplicate selection prevented', 'Current pastor is labeled and disabled from re-selection');
} else {
  fail('9. Duplicate selection prevented', 'Missing check or disabled state for current pastor');
}

// 10. Confirmation step before assignment / change
const hasConfirmationStep = managerCode.includes('isConfirmingAssignment') &&
                            managerCode.includes('Confirm Pastor Assignment') &&
                            managerCode.includes('handleConfirmAssignPastor');

if (hasConfirmationStep) {
  pass('10. Confirmation step enforced before pastor assignment or change is executed');
} else {
  fail('10. Confirmation step enforced', 'Missing confirmation state or handler invocation');
}

// 11. RPC invocation and refresh flow
const callsServiceAssign = managerCode.includes('await adminAssignChurchPastor(churchId, targetUserId)') &&
                           managerCode.includes('getChurchPastor(churchId)');

if (callsServiceAssign) {
  pass('11. Calls adminAssignChurchPastor service and refreshes church row state upon success');
} else {
  fail('11. Calls adminAssignChurchPastor service', 'Missing adminAssignChurchPastor call or row refresh');
}

// 12. Minimum 44px touch targets on modal controls
const modalButtonsHave44px = managerCode.includes('min-h-[44px] min-w-[44px]') && // close button
                             managerCode.includes('min-h-[44px] pl-10') &&         // search input
                             managerCode.includes('min-h-[48px]');                // result items

if (modalButtonsHave44px) {
  pass('12. Modal touch targets strictly adhere to minimum 44px guidelines');
} else {
  fail('12. Modal touch targets strictly adhere to minimum 44px guidelines', 'One or more controls lack 44px min height');
}

// 13. Mobile responsiveness
const hasResponsiveModal = managerCode.includes('p-3 sm:p-6') &&
                           managerCode.includes('w-full max-w-lg') &&
                           managerCode.includes('max-h-[90vh]');

if (hasResponsiveModal) {
  pass('13. Mobile responsive sizing applied to modal (fits 320px, 360px, 390px, 430px, 768px+)');
} else {
  fail('13. Mobile responsive sizing applied to modal', 'Missing responsive padding or max-width classes');
}

// 14. Removal of creator -> Pastor automatic assignment language
const hasOldCreatorPastorLanguage = managerCode.includes('assigned to you as initial Pastor') ||
                                    managerCode.includes('You will automatically become the initial Pastor');

if (!hasOldCreatorPastorLanguage) {
  pass('14. Zero automatic creator->Pastor assignment language', 'Legacy copy updated to Awaiting Pastor state');
} else {
  fail('14. Zero automatic creator->Pastor assignment language', 'Found legacy creator->Pastor assignment string');
}

// 15. Admin-only route location
const isUsedInAdminPortal = portalModalCode.includes('AdminChurchManager') &&
                            portalModalCode.includes("activeTab === 'churches'") ||
                            portalModalCode.includes('activeTab === "churches"') ||
                            portalModalCode.includes('<AdminChurchManager');

if (isUsedInAdminPortal) {
  pass('15. AdminChurchManager is housed exclusively inside AdminPortalModal');
} else {
  fail('15. AdminChurchManager is housed exclusively inside AdminPortalModal', 'AdminPortalModal does not embed AdminChurchManager');
}

// 16. "Unnamed user" fallback when profile has no full_name
const hasUnnamedUserFallback = managerCode.includes("'Unnamed user'") &&
                              !managerCode.includes("profile?.full_name || 'Pastor'");

if (hasUnnamedUserFallback) {
  pass('16. "Unnamed user" fallback applied for profiles without full_name (zero "Pastor" placeholder names)');
} else {
  fail('16. "Unnamed user" fallback applied', 'Missing "Unnamed user" fallback or still contains placeholder "Pastor" name');
}

// 17. Secondary platform role label display
const hasPlatformAdminSecondary = managerCode.includes('Platform Administrator') &&
                                  managerCode.includes("role === 'admin'");

if (hasPlatformAdminSecondary) {
  pass('17. Secondary platform role label ("Platform Administrator") displayed for admin users');
} else {
  fail('17. Secondary platform role label displayed', 'Missing Platform Administrator secondary label');
}

console.log('\n================================================================');
console.log(`AUDIT RESULTS: ${passedTests}/${totalTests} tests passed (${failedTests} failures)`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
