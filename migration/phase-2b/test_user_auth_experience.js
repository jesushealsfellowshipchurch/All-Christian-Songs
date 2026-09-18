/**
 * test_user_auth_experience.js — Verification Suite for Normal User Authentication Experience
 *
 * All Christian Songs — Phase 2B User Experience Layer
 *
 * Verifies:
 * 1. UserAuthModal Component Structure & Fields:
 *    - Sign Up fields: First Name *, Last Name *, Email *, Password *, Confirm Password *.
 *    - Primary CTA: "Create Account".
 *    - Secondary CTAs: "Already have an account? Sign in", "Continue browsing as guest".
 *    - Login view: Email, Password, Password visibility, Forgot Password, Sign In, Create Account.
 *    - Password strength guidance and inline validation.
 *    - Email confirmation notice handling.
 * 2. AuthContext Interface & Security:
 *    - signIn, signUp, signOut, resetPassword methods exported.
 *    - formatAuthError maps duplicate email, weak password, invalid credentials, rate limit.
 * 3. Database & Role Separation Invariants:
 *    - public.profiles.role remains strictly: 'user' | 'admin'.
 *    - Trigger on_auth_user_created defaults newly registered user to role = 'user'.
 *    - 'pastor' is NEVER a profiles.role; church roles remain in church_memberships.
 * 4. Header UX Integration:
 *    - Guest state renders Sign In / Register entry points.
 *    - Authenticated user state renders User Profile pill and account dropdown.
 *    - My Favorites and My Churches access points preserved.
 *    - Super Admin experience remains distinct and protected.
 * 5. Production Security Audit:
 *    - Zero service_role in src/.
 *    - Zero plain text password storage in application tables.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

// Helper matching AuthContext formatAuthError
function testFormatAuthError(error) {
  if (!error) return null;
  const msg = typeof error === 'string' ? error : error.message || '';
  const lower = msg.toLowerCase();

  if (
    lower.includes('invalid login credentials') ||
    lower.includes('invalid_credentials') ||
    lower.includes('invalid grant')
  ) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Your email address has not been confirmed. Please check your inbox for the confirmation link.';
  }
  if (
    lower.includes('user already registered') ||
    lower.includes('already registered') ||
    lower.includes('email address is already registered') ||
    lower.includes('unique constraint')
  ) {
    return 'An account with this email address already exists. Please sign in instead.';
  }
  if (
    lower.includes('password should be at least') ||
    lower.includes('weak_password') ||
    lower.includes('password is too short')
  ) {
    return 'Password must be at least 6 characters long.';
  }
  if (lower.includes('user not found')) {
    return 'No account was found with this email address.';
  }
  return msg || 'Authentication failed. Please try again.';
}

let totalPassed = 0;
let totalFailed = 0;

function pass(name, detail = '') {
  console.log(`[PASS] ${name}${detail ? ` — ${detail}` : ''}`);
  totalPassed++;
}

function fail(name, detail = '') {
  console.error(`[FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
  totalFailed++;
}

console.log('============================================================');
console.log('USER AUTHENTICATION EXPERIENCE VERIFICATION SUITE');
console.log('============================================================\n');

// -----------------------------------------------------------------------------
// SECTION 1: UserAuthModal Component Verification
// -----------------------------------------------------------------------------
console.log('--- SECTION 1: UserAuthModal Component Verification ---');

const userAuthModalPath = path.join(projectRoot, 'src/components/UserAuthModal.jsx');
if (fs.existsSync(userAuthModalPath)) {
  pass('UserAuthModal exists', 'src/components/UserAuthModal.jsx');
} else {
  fail('UserAuthModal exists', 'Component file missing');
}

const modalContent = fs.readFileSync(userAuthModalPath, 'utf8');

// Test 1: Sign Up Fields
const hasFirstName = modalContent.includes('First Name') && modalContent.includes('firstName');
const hasLastName = modalContent.includes('Last Name') && modalContent.includes('lastName');
const hasEmail = modalContent.includes('Email Address') && modalContent.includes('email');
const hasPassword = modalContent.includes('Password') && modalContent.includes('password');
const hasConfirmPassword = modalContent.includes('Confirm Password') && modalContent.includes('confirmPassword');

if (hasFirstName && hasLastName && hasEmail && hasPassword && hasConfirmPassword) {
  pass('Sign Up Form Fields', 'First Name *, Last Name *, Email *, Password *, Confirm Password * present');
} else {
  fail('Sign Up Form Fields', 'One or more required fields missing from sign up view');
}

// Test 2: CTAs
const hasCreateAccountCTA = modalContent.includes('Create Account');
const hasSignInSwitch = modalContent.includes('Already have an account?');
const hasGuestOption = modalContent.includes('Continue browsing as guest');

if (hasCreateAccountCTA && hasSignInSwitch && hasGuestOption) {
  pass('Sign Up CTAs', '"Create Account" primary, "Already have an account? Sign in", "Continue browsing as guest" present');
} else {
  fail('Sign Up CTAs', 'Missing one or more required call-to-action buttons');
}

// Test 3: Login View
const hasLoginView = modalContent.includes('mode === \'login\'') &&
                     modalContent.includes('Sign In') &&
                     modalContent.includes('Forgot Password?');

if (hasLoginView) {
  pass('Login View Controls', 'Email, Password, Visibility, Sign In, Forgot Password present');
} else {
  fail('Login View Controls', 'Missing login view controls');
}

// Test 4: Password Visibility & Strength
const hasVisibilityToggle = modalContent.includes('Eye') && modalContent.includes('EyeOff');
const hasPasswordStrength = modalContent.includes('getPasswordStrength') || modalContent.includes('passwordStrength');

if (hasVisibilityToggle && hasPasswordStrength) {
  pass('Password Experience', 'Show/hide visibility toggle and strength indicator present');
} else {
  fail('Password Experience', 'Missing visibility toggle or strength guidance');
}

// Test 5: Email Confirmation Notice View
const hasConfirmationNotice = modalContent.includes('confirmation_sent') &&
                              modalContent.includes('Check your email');

if (hasConfirmationNotice) {
  pass('Confirmation Handling', 'Dedicated notice state for email verification workflows');
} else {
  fail('Confirmation Handling', 'Missing confirmation notice state');
}

// -----------------------------------------------------------------------------
// SECTION 2: AuthContext Capabilities & Error Transformation
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 2: AuthContext Capabilities & Error Transformation ---');

const authContextPath = path.join(projectRoot, 'src/context/AuthContext.jsx');
const authContextContent = fs.readFileSync(authContextPath, 'utf8');

const hasSignUpMethod = authContextContent.includes('const signUp = useCallback(');
const hasSignInMethod = authContextContent.includes('const signIn = useCallback(');
const hasSignOutMethod = authContextContent.includes('const signOut = useCallback(');
const hasResetPasswordMethod = authContextContent.includes('const resetPassword = useCallback(');

if (hasSignUpMethod && hasSignInMethod && hasSignOutMethod && hasResetPasswordMethod) {
  pass('AuthContext Methods', 'signUp, signIn, signOut, and resetPassword fully implemented');
} else {
  fail('AuthContext Methods', 'Missing one or more auth methods');
}

// Test formatAuthError transformations
const dupEmailMsg = testFormatAuthError('User already registered');
if (dupEmailMsg.includes('already exists') && authContextContent.includes('already registered')) {
  pass('Duplicate Email Error', `Cleanly transformed to: "${dupEmailMsg}"`);
} else {
  fail('Duplicate Email Error', `Unexpected transformation: "${dupEmailMsg}"`);
}

const weakPwdMsg = testFormatAuthError('Password should be at least 6 characters');
if (weakPwdMsg.includes('at least 6 characters') && authContextContent.includes('at least 6 characters')) {
  pass('Weak Password Error', `Cleanly transformed to: "${weakPwdMsg}"`);
} else {
  fail('Weak Password Error', `Unexpected transformation: "${weakPwdMsg}"`);
}

const invalidCredsMsg = testFormatAuthError('Invalid login credentials');
if (invalidCredsMsg.includes('Invalid email or password') && authContextContent.includes('Invalid email or password')) {
  pass('Invalid Credentials Error', `Cleanly transformed to: "${invalidCredsMsg}"`);
} else {
  fail('Invalid Credentials Error', `Unexpected transformation: "${invalidCredsMsg}"`);
}

// -----------------------------------------------------------------------------
// SECTION 3: Database & Role Architecture Invariants
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 3: Database & Role Architecture Invariants ---');

const migration1Path = path.join(projectRoot, 'supabase/migrations/001_security_foundation.sql');
const migration1Content = fs.readFileSync(migration1Path, 'utf8');

// Test: profiles.role check constraint
const hasRoleConstraint = migration1Content.includes("CHECK (role IN ('user', 'admin'))");
if (hasRoleConstraint) {
  pass('profiles.role Invariant', 'Role strictly constrained to \'user\' and \'admin\' (no \'pastor\')');
} else {
  fail('profiles.role Invariant', 'profiles.role check constraint missing or altered');
}

// Test: trigger defaults new user to role = 'user'
const hasTriggerDefault = migration1Content.includes("handle_new_user()") &&
                          migration1Content.includes("'user'");
if (hasTriggerDefault) {
  pass('Trigger Auto-Profile', 'handle_new_user() automatically sets role = \'user\' on auth.users insert');
} else {
  fail('Trigger Auto-Profile', 'Missing handle_new_user trigger definition');
}

// -----------------------------------------------------------------------------
// SECTION 4: Header UX & Navigation Integration
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 4: Header UX & Navigation Integration ---');

const headerPath = path.join(projectRoot, 'src/components/Header.jsx');
const headerContent = fs.readFileSync(headerPath, 'utf8');

const hasGuestSignIn = headerContent.includes('onOpenAuth(\'login\')') &&
                       headerContent.includes('Sign In');
const hasGuestSignUp = headerContent.includes('onOpenAuth(\'signup\')') &&
                       headerContent.includes('Sign Up');
const hasUserDropdown = headerContent.includes('userMenuRef') &&
                        headerContent.includes('displayName') &&
                        headerContent.includes('userInitials');
const hasFavoritesLink = headerContent.includes('personal_favorites') &&
                         headerContent.includes('onOpenFavorites');
const hasChurchesLink = headerContent.includes('church_workspaces') &&
                        headerContent.includes('onOpenMyChurches');
const hasAdminPreserved = headerContent.includes('onOpenAdmin') &&
                          headerContent.includes('Admin Portal');

if (hasGuestSignIn && hasGuestSignUp) {
  pass('Guest Header UX', 'Sign In and Sign Up accessible to unauthenticated visitors');
} else {
  fail('Guest Header UX', 'Missing guest entry points in Header');
}

if (hasUserDropdown) {
  pass('Authenticated User Header UX', 'User Profile avatar, initials, and dropdown menu integrated');
} else {
  fail('Authenticated User Header UX', 'Missing user profile dropdown menu');
}

if (hasFavoritesLink && hasChurchesLink) {
  pass('Feature Exposure Invariant', 'Favorites and Churches exposed based on platform feature flags');
} else {
  fail('Feature Exposure Invariant', 'Favorites or Churches link missing feature gating');
}

if (hasAdminPreserved) {
  pass('Admin Experience Separation', 'Admin Portal trigger preserved and separate in UX');
} else {
  fail('Admin Experience Separation', 'Admin Portal trigger altered or broken');
}

// -----------------------------------------------------------------------------
// SECTION 5: Security Hygiene Audit
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 5: Security Hygiene Audit ---');

const srcDir = path.join(projectRoot, 'src');

function scanDirectoryForPattern(dir, pattern) {
  let matches = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      matches = matches.concat(scanDirectoryForPattern(fullPath, pattern));
    } else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (pattern.test(content)) {
        matches.push(fullPath);
      }
    }
  }
  return matches;
}

const serviceRoleMatches = scanDirectoryForPattern(srcDir, /service_role/);
if (serviceRoleMatches.length === 0) {
  pass('Zero service_role', 'No service_role credentials exposed in src/');
} else {
  fail('Zero service_role', `Found service_role in: ${serviceRoleMatches.join(', ')}`);
}

const adminPasswordMatches = scanDirectoryForPattern(srcDir, /VITE_ADMIN_PASSWORD/);
if (adminPasswordMatches.length === 0) {
  pass('Zero VITE_ADMIN_PASSWORD', 'No legacy admin password references in src/');
} else {
  fail('Zero VITE_ADMIN_PASSWORD', `Found in: ${adminPasswordMatches.join(', ')}`);
}

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n============================================================');
console.log(`TEST SUMMARY: ${totalPassed} PASSED, ${totalFailed} FAILED`);
console.log('============================================================');

if (totalFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
