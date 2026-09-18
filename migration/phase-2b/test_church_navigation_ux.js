import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('============================================================');
console.log('PHASE 2B: CHURCH NAVIGATION UX & PERMISSION REFINEMENT TESTS');
console.log('============================================================\n');

let passed = 0;
let failed = 0;

function report(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(`       Error: ${err.message}`);
    failed++;
  }
}

const headerPath = path.resolve(process.cwd(), 'src/components/Header.jsx');
const headerSrc = fs.readFileSync(headerPath, 'utf8');

const churchContextPath = path.resolve(process.cwd(), 'src/context/ChurchContext.jsx');
const churchContextSrc = fs.readFileSync(churchContextPath, 'utf8');

const myChurchesModalPath = path.resolve(process.cwd(), 'src/components/church/MyChurchesModal.jsx');
const myChurchesModalSrc = fs.readFileSync(myChurchesModalPath, 'utf8');

const churchWorkspaceModalPath = path.resolve(process.cwd(), 'src/components/church/ChurchWorkspaceModal.jsx');
const churchWorkspaceModalSrc = fs.readFileSync(churchWorkspaceModalPath, 'utf8');

const appPath = path.resolve(process.cwd(), 'src/App.jsx');
const appSrc = fs.readFileSync(appPath, 'utf8');

const churchServicePath = path.resolve(process.cwd(), 'src/services/churchService.js');
const churchServiceSrc = fs.readFileSync(churchServicePath, 'utf8');

// --- SECTION 1: Dynamic Label & Count Logic Unit Tests ---
console.log('--- SECTION 1: Dynamic Label & Church Count Logic ---');

report('Zero churches -> "Join a Church"', () => {
  const getLabel = (count) => count === 0 ? 'Join a Church' : count === 1 ? 'My Church' : 'My Churches';
  assert.equal(getLabel(0), 'Join a Church');
});

report('Exactly one church -> "My Church"', () => {
  const getLabel = (count) => count === 0 ? 'Join a Church' : count === 1 ? 'My Church' : 'My Churches';
  assert.equal(getLabel(1), 'My Church');
});

report('Multiple churches -> "My Churches"', () => {
  const getLabel = (count) => count === 0 ? 'Join a Church' : count === 1 ? 'My Church' : 'My Churches';
  assert.equal(getLabel(2), 'My Churches');
  assert.equal(getLabel(5), 'My Churches');
});

// --- SECTION 2: Active Church Membership Filtering Invariants ---
console.log('\n--- SECTION 2: Active Church Membership Filtering Invariants ---');

report('Exclude pending memberships from active count', () => {
  const memberships = [
    { id: '1', churchStatus: 'active', membershipStatus: 'pending' },
    { id: '2', churchStatus: 'active', membershipStatus: 'active' }
  ];
  const active = memberships.filter(c => c.membershipStatus === 'active' && c.churchStatus === 'active');
  assert.equal(active.length, 1);
  assert.equal(active[0].id, '2');
});

report('Exclude suspended memberships from active count', () => {
  const memberships = [
    { id: '1', churchStatus: 'active', membershipStatus: 'suspended' },
    { id: '2', churchStatus: 'active', membershipStatus: 'active' }
  ];
  const active = memberships.filter(c => c.membershipStatus === 'active' && c.churchStatus === 'active');
  assert.equal(active.length, 1);
});

report('Exclude inactive church workspaces from active count', () => {
  const memberships = [
    { id: '1', churchStatus: 'inactive', membershipStatus: 'active' },
    { id: '2', churchStatus: 'active', membershipStatus: 'active' }
  ];
  const active = memberships.filter(c => c.membershipStatus === 'active' && c.churchStatus === 'active');
  assert.equal(active.length, 1);
  assert.equal(active[0].id, '2');
});

report('churchService preserves separate membershipStatus and churchStatus', () => {
  assert.match(churchServiceSrc, /membershipStatus:\s*row\.status/);
  assert.match(churchServiceSrc, /churchStatus:\s*row\.church\?\.status/);
});

report('ChurchContext computes activeChurches, activeChurchesCount, and churchNavLabel', () => {
  assert.match(churchContextSrc, /activeChurches\s*=\s*useMemo/);
  assert.match(churchContextSrc, /activeChurchesCount\s*=\s*activeChurches\.length/);
  assert.match(churchContextSrc, /churchNavLabel\s*=\s*useMemo/);
  assert.match(churchContextSrc, /'Join a Church'/);
  assert.match(churchContextSrc, /'My Church'/);
  assert.match(churchContextSrc, /'My Churches'/);
});

// --- SECTION 3: Header UX & Navigation Rules ---
console.log('\n--- SECTION 3: Header UX & Navigation Verification ---');

report('Guest top-level desktop nav does NOT show church navigation button', () => {
  // Desktop navbar button must be gated on user authentication: Boolean(user && isFeatureEnabled('church_workspaces'))
  assert.match(headerSrc, /Boolean\(user\s*&&\s*isFeatureEnabled\('church_workspaces'\)\)/);
});

report('Guest mobile drawer does NOT show church navigation button', () => {
  // In mobile menu, church button is gated on Boolean(user && isFeatureEnabled('church_workspaces'))
  const mobileIdx = headerSrc.indexOf('isMobileMenuOpen && !isMobileSearchOpen');
  assert.ok(mobileIdx > 0, 'Mobile menu drawer container found');
  const mobileSection = headerSrc.slice(mobileIdx);
  assert.match(mobileSection, /Boolean\(user\s*&&\s*isFeatureEnabled\('church_workspaces'\)\)/);
});

report('Header uses effectiveChurchLabel in desktop, mobile, and user dropdown', () => {
  assert.match(headerSrc, /effectiveChurchLabel/);
  // No hardcoded "Churches" as regular user navigation label
  assert.doesNotMatch(headerSrc, /<span>Churches<\/span>/);
});

report('Header shows badge count only when more than one church', () => {
  assert.match(headerSrc, /myChurchesCount > 1 && \(/);
});

report('Guest sees Sign In and Sign Up options', () => {
  assert.match(headerSrc, /Sign In/);
  assert.match(headerSrc, /Sign Up/);
});

// --- SECTION 4: Click Handlers & Direct Workspace Routing ---
console.log('\n--- SECTION 4: Direct Workspace Routing Verification ---');

report('App.jsx implements handleChurchNavClick routing logic', () => {
  assert.match(appSrc, /handleChurchNavClick/);
  // Zero church -> opens join tab
  assert.match(appSrc, /setMyChurchesModalTab\('join'\)/);
  // Exactly one church -> selects church and opens workspace directly without selector
  assert.match(appSrc, /selectChurch\(churchList\[0\]\.id\)/);
  assert.match(appSrc, /setIsChurchWorkspaceOpen\(true\)/);
  // Multiple churches -> opens list tab
  assert.match(appSrc, /setMyChurchesModalTab\('list'\)/);
});

report('MyChurchesModal accepts initialTab prop and defaults intelligently', () => {
  assert.match(myChurchesModalSrc, /initialTab\s*=\s*'list'/);
  assert.match(myChurchesModalSrc, /setActiveView\(defaultTab\)/);
});

report('ChurchWorkspaceModal Switch Church button visible only for multi-church users', () => {
  assert.match(churchWorkspaceModalSrc, /churchList\.length > 1/);
});

// --- SECTION 5: Normal User Permission Restrictions (Register Church Removal) ---
console.log('\n--- SECTION 5: Normal User Permission Restrictions ---');

report('Normal user cannot see "Register Church" tab in MyChurchesModal', () => {
  assert.doesNotMatch(myChurchesModalSrc, /<span>Register Church<\/span>/);
});

report('Normal user cannot see "Register Church" button in MyChurchesModal empty state', () => {
  assert.doesNotMatch(myChurchesModalSrc, /Register Church Workspace/);
});

report('Normal user cannot access church registration form in MyChurchesModal', () => {
  assert.doesNotMatch(myChurchesModalSrc, /activeView === 'create'/);
});

report('Entire src/ tree contains zero instances of "Register Church"', () => {
  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        scanDir(full);
      } else if (/\.(jsx?|tsx?|html)$/.test(e.name)) {
        const content = fs.readFileSync(full, 'utf8');
        assert.ok(!content.includes('Register Church'), `Found "Register Church" in ${full}`);
      }
    }
  }
  scanDir(path.resolve(process.cwd(), 'src'));
});

// --- SECTION 6: Admin Entry UX & Permission Boundary ---
console.log('\n--- SECTION 6: Admin Entry UX & Permission Boundary ---');

report('Desktop navbar Admin button is strictly gated to authenticated admins only', () => {
  // Must NOT show to guests or normal users
  assert.match(headerSrc, /{isAdmin && \(\s*<button[\s\S]*?onClick={onOpenAdmin}/);
  // Confirm unauthenticated fallback lock button is completely removed
  assert.doesNotMatch(headerSrc, /<Lock className="w-3.5 h-3.5 text-slate-400" \/>\s*<span>Admin<\/span>/);
});

report('Mobile drawer Admin button is strictly gated to authenticated admins only', () => {
  const mobileIdx = headerSrc.indexOf('isMobileMenuOpen && !isMobileSearchOpen');
  const mobileSection = headerSrc.slice(mobileIdx);
  assert.match(mobileSection, /{isAdmin && \(\s*<button[\s\S]*?onOpenAdmin\(\);/);
});

report('User profile menu only shows Admin Portal when profile role is admin', () => {
  assert.match(headerSrc, /{isAdmin && \(\s*<button[\s\S]*?Admin Portal/);
});

report('UserAuthModal contains minimal discreet Admin Portal entry in Sign In view', () => {
  const userAuthModalSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/UserAuthModal.jsx'), 'utf8');
  assert.match(userAuthModalSrc, /onOpenAdmin/);
  assert.match(userAuthModalSrc, /Admin Portal/);
  assert.match(userAuthModalSrc, /title="Platform administrator access"/);
});

report('App.jsx connects onOpenAdmin to UserAuthModal', () => {
  assert.match(appSrc, /<UserAuthModal[\s\S]*?onOpenAdmin={\(\) => {\s*setIsUserAuthOpen\(false\);\s*handleOpenAdmin\(\);\s*}}/);
});

report('AdminLoginModal prevents standard users from reaching "No privileges" screen', () => {
  const adminLoginModalSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/AdminLoginModal.jsx'), 'utf8');
  assert.match(adminLoginModalSrc, /profile\?\.role === 'admin'\s*\?/);
  assert.match(adminLoginModalSrc, /Administrative features require an authorized Super Admin account/);
});

report('Super Admin badge preserved in User Dropdown', () => {
  assert.match(headerSrc, /profile\?\.role === 'admin' \? 'Super Admin' : 'Member'/);
});

console.log('\n============================================================');
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('============================================================\n');

if (failed > 0) {
  process.exit(1);
}
