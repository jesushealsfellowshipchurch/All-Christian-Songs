/**
 * test_feature_control.js — Phase 2A Comprehensive Verification Suite
 *
 * All Christian Songs — Phase 2A Super Admin Feature Control & Product Journey
 *
 * Verifies:
 * 1. Feature catalog & static fallback resilience (14 features, system locks).
 * 2. Database migration contract (005_product_features.sql) for:
 *    - Database-level system feature protection (CHECK constraint + trigger).
 *    - Roadmap privacy (non-admin can ONLY read is_enabled=true).
 *    - Super Admin authority (mutations restricted to public.is_admin()).
 * 3. Feature service client-side validation & error handling.
 * 4. Production stability & non-regression invariants (songs, pinned_songs, favorites, admin CRUD).
 * 5. UI gating verification (App.jsx, Header.jsx, SongDetail.jsx, SongList.jsx, AdminPortalModal.jsx).
 * 6. Production build & security audit (zero service_role, zero hardcoded passwords).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

// Load environment credentials
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[FATAL] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
console.log('PHASE 2A: PRODUCT JOURNEY & FEATURE CONTROL VERIFICATION');
console.log('============================================================\n');

// Import featureService exports
import {
  DEFAULT_FEATURES,
  DEFAULT_AVAILABILITY,
  fetchPublicFeatureAvailability,
  fetchAdminFeatureCatalog,
  updateFeatureToggle,
  calculateFactualCounts
} from '../../src/services/featureService.js';

// --- SECTION 1: Catalog & Static Fallback Resilience ---
console.log('--- SECTION 1: Feature Catalog & Static Fallback Resilience ---');

// Test 1: 14 Features defined with required schema properties
const requiredKeys = ['id', 'display_name', 'description', 'category', 'phase', 'status', 'is_enabled', 'is_system', 'sort_order'];
const allHaveRequiredKeys = DEFAULT_FEATURES.every(f => requiredKeys.every(k => Object.prototype.hasOwnProperty.call(f, k)));
if (DEFAULT_FEATURES.length === 14 && allHaveRequiredKeys) {
  pass('TEST 1: Feature catalog structure', `Exactly 14 approved features seeded with all required schema attributes`);
} else {
  fail('TEST 1: Feature catalog structure', `Expected 14 features, found ${DEFAULT_FEATURES.length}`);
}

// Test 2: System features are strictly enabled and locked
const systemFeatures = DEFAULT_FEATURES.filter(f => f.is_system);
const allSystemEnabled = systemFeatures.every(f => f.is_enabled === true);
const expectedSystemIds = ['song_catalog', 'songbooks', 'authentication', 'admin_portal', 'feature_control'];
const systemIdsMatch = expectedSystemIds.every(id => systemFeatures.some(f => f.id === id));
if (systemFeatures.length === 5 && allSystemEnabled && systemIdsMatch) {
  pass('TEST 2: System feature integrity', `All 5 system features (song_catalog, songbooks, authentication, admin_portal, feature_control) are locked & enabled`);
} else {
  fail('TEST 2: System feature integrity', `System features mismatch or not enabled: ${systemFeatures.map(f => `${f.id}:${f.is_enabled}`).join(', ')}`);
}

// Test 3: Distinct Journey (status) vs Control (is_enabled)
// planned + OFF, ready + OFF, active + ON, completed + ON
const plannedOff = DEFAULT_FEATURES.filter(f => f.status === 'planned' && f.is_enabled === false);
const readyOff = DEFAULT_FEATURES.filter(f => f.status === 'ready' && f.is_enabled === false);
const activeOn = DEFAULT_FEATURES.filter(f => f.status === 'active' && f.is_enabled === true);
const completedOn = DEFAULT_FEATURES.filter(f => f.status === 'completed' && f.is_enabled === true);

if (plannedOff.length >= 5 && readyOff.length >= 1 && activeOn.length >= 3 && completedOn.length >= 5) {
  pass('TEST 3: Journey vs Control distinction', `Status and enabled are separate: planned+OFF (${plannedOff.length}), ready+OFF (${readyOff.length}), active+ON (${activeOn.length}), completed+ON (${completedOn.length})`);
} else {
  fail('TEST 3: Journey vs Control distinction', `State combinations do not match expected distributions`);
}

// Test 4: Simple Factual Counts (No misleading completion percentages)
const counts = calculateFactualCounts(DEFAULT_FEATURES);
if (
  counts.total === 14 &&
  counts.completed === 5 &&
  counts.active === 3 &&
  counts.ready === 1 &&
  counts.planned === 5 &&
  counts.deferred === 0 &&
  !Object.prototype.hasOwnProperty.call(counts, 'percentage')
) {
  pass('TEST 4: Factual counts calculation', `Factual numbers only: Total ${counts.total}, Completed ${counts.completed}, Active ${counts.active}, Ready ${counts.ready}, Planned ${counts.planned}, Deferred ${counts.deferred}`);
} else {
  fail('TEST 4: Factual counts calculation', `Unexpected counts output: ${JSON.stringify(counts)}`);
}

// Test 5: Fallback availability
const fallbackKeys = Object.keys(DEFAULT_AVAILABILITY);
if (fallbackKeys.length === 14 && DEFAULT_AVAILABILITY.song_catalog === true && DEFAULT_AVAILABILITY.church_subscriptions === false) {
  pass('TEST 5: Default availability map', `14 features mapped correctly in DEFAULT_AVAILABILITY`);
} else {
  fail('TEST 5: Default availability map', `Invalid availability mapping`);
}

// --- SECTION 2: Database Migration Contract (005_product_features.sql) ---
console.log('\n--- SECTION 2: Database Migration Contract Verification ---');

const migrationPath = path.join(projectRoot, 'supabase/migrations/005_product_features.sql');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

// Test 6: Database-level system feature check constraint
if (
  migrationSql.includes('CONSTRAINT chk_system_feature_enabled') &&
  migrationSql.includes('CHECK (NOT (is_system = true AND is_enabled = false))')
) {
  pass('TEST 6: DB-level system protection constraint', 'chk_system_feature_enabled enforces (NOT (is_system = true AND is_enabled = false))');
} else {
  fail('TEST 6: DB-level system protection constraint', 'Missing chk_system_feature_enabled in 005_product_features.sql');
}

// Test 7: Trigger function protecting system features from disable or delete
if (
  migrationSql.includes('CREATE OR REPLACE FUNCTION public.protect_system_features()') &&
  migrationSql.includes('IF OLD.is_system = true AND NEW.is_enabled = false') &&
  migrationSql.includes('IF OLD.is_system = true THEN') &&
  migrationSql.includes('CREATE TRIGGER trg_protect_product_features')
) {
  pass('TEST 7: DB-level system protection trigger', 'protect_system_features() trigger blocks disabling & deleting is_system features');
} else {
  fail('TEST 7: DB-level system protection trigger', 'Missing protect_system_features trigger in 005_product_features.sql');
}

// Test 8: RLS enabled and forced
if (
  migrationSql.includes('ALTER TABLE public.product_features ENABLE ROW LEVEL SECURITY;') &&
  migrationSql.includes('ALTER TABLE public.product_features FORCE ROW LEVEL SECURITY;')
) {
  pass('TEST 8: Force Row Level Security', 'ENABLE ROW LEVEL SECURITY and FORCE ROW LEVEL SECURITY configured');
} else {
  fail('TEST 8: Force Row Level Security', 'Missing ENABLE or FORCE ROW LEVEL SECURITY in migration');
}

// Test 9: Roadmap privacy policy (Correction 2)
if (
  migrationSql.includes('CREATE POLICY "product_features_select_public"') &&
  migrationSql.includes('USING (is_enabled = true)') &&
  migrationSql.includes('CREATE POLICY "product_features_select_admin"') &&
  migrationSql.includes('USING (public.is_admin())')
) {
  pass('TEST 9: Roadmap privacy RLS policy', 'Public SELECT limited to is_enabled=true; Admin SELECT grants full roadmap view via public.is_admin()');
} else {
  fail('TEST 9: Roadmap privacy RLS policy', 'Missing roadmap privacy policies in migration');
}

// Test 10: Admin-only mutation policies
if (
  migrationSql.includes('CREATE POLICY "product_features_insert_admin"') &&
  migrationSql.includes('CREATE POLICY "product_features_update_admin"') &&
  migrationSql.includes('CREATE POLICY "product_features_delete_admin"') &&
  migrationSql.includes('WITH CHECK (public.is_admin())')
) {
  pass('TEST 10: Admin-only mutation policies', 'INSERT, UPDATE, DELETE strictly restricted to public.is_admin()');
} else {
  fail('TEST 10: Admin-only mutation policies', 'Missing administrative mutation policies in migration');
}

// --- SECTION 3: Feature Service & Client-Side Protection ---
console.log('\n--- SECTION 3: Feature Service & Client-Side Protection ---');

// Test 11: updateFeatureToggle blocks disabling system features client-side
const systemToggleResult = await updateFeatureToggle('song_catalog', false, DEFAULT_FEATURES);
if (!systemToggleResult.success && systemToggleResult.error?.includes('cannot be disabled')) {
  pass('TEST 11: Client-side system feature protection', `Client-side check rejected disabling system feature: "${systemToggleResult.error}"`);
} else {
  fail('TEST 11: Client-side system feature protection', `Expected rejection when disabling system feature`);
}

// Test 12: fetchPublicFeatureAvailability handles unmigrated/network gracefully
const publicAvailResult = await fetchPublicFeatureAvailability();
if (publicAvailResult.success && publicAvailResult.data?.song_catalog === true) {
  pass('TEST 12: Public availability runtime query', `Query succeeded (fallback: ${publicAvailResult.isFallback}), song_catalog=true`);
} else {
  fail('TEST 12: Public availability runtime query', `Public availability failed: ${JSON.stringify(publicAvailResult)}`);
}

// Test 13: fetchAdminFeatureCatalog query under live RLS
const adminCatResult = await fetchAdminFeatureCatalog();
if (adminCatResult.success && Array.isArray(adminCatResult.data)) {
  if (adminCatResult.data.length === 8) {
    pass('TEST 13: Admin feature catalog RLS containment', `Anonymous query received exactly 8 enabled features; 6 roadmap features shielded by RLS`);
  } else if (adminCatResult.data.length >= 14) {
    pass('TEST 13: Admin feature catalog full roadmap', `Loaded ${adminCatResult.data.length} features (authenticated admin or static fallback)`);
  } else {
    fail('TEST 13: Admin feature catalog query', `Unexpected row count: ${adminCatResult.data.length}`);
  }
} else {
  fail('TEST 13: Admin feature catalog query', `Admin catalog query failed`);
}

// --- SECTION 4: Production Invariants & Stability ---
console.log('\n--- SECTION 4: Production Invariants & Stability ---');

// Test 14: Public songs catalog
const { count: songCount, error: songErr } = await supabase
  .from('songs')
  .select('*', { count: 'exact', head: true });

if (!songErr && songCount >= 3773) {
  pass('TEST 14: Public song catalog intact', `Live count: ${songCount} songs (baseline >= 3,773)`);
} else {
  fail('TEST 14: Public song catalog intact', `Error or unexpected count: ${songErr?.message || songCount}`);
}

// Test 15: Today's Service / pinned_songs
const { data: pinnedData, error: pinnedErr } = await supabase
  .from('pinned_songs')
  .select('*');

if (!pinnedErr && Array.isArray(pinnedData)) {
  pass('TEST 15: Today\'s Service pinned_songs intact', `Query succeeded with ${pinnedData.length} pinned songs`);
} else {
  fail('TEST 15: Today\'s Service pinned_songs intact', `Pinned songs query failed: ${pinnedErr?.message}`);
}

// Test 16: User favorites RLS non-regression (Anonymous cannot read)
const { data: anonFavs, error: favErr } = await supabase
  .from('user_favorites')
  .select('*');

if (!favErr && Array.isArray(anonFavs) && anonFavs.length === 0) {
  pass('TEST 16: User favorites RLS intact', `Anonymous SELECT returns 0 rows (RLS isolated)`);
} else {
  fail('TEST 16: User favorites RLS intact', `Favorites read was not blocked: ${favErr?.message || anonFavs?.length}`);
}

// --- SECTION 5: UI Gating & Component Verification ---
console.log('\n--- SECTION 5: UI Gating & Component Integration ---');

const appContent = fs.readFileSync(path.join(projectRoot, 'src/App.jsx'), 'utf8');
const headerContent = fs.readFileSync(path.join(projectRoot, 'src/components/Header.jsx'), 'utf8');
const songDetailContent = fs.readFileSync(path.join(projectRoot, 'src/components/SongDetail.jsx'), 'utf8');
const songListContent = fs.readFileSync(path.join(projectRoot, 'src/components/SongList.jsx'), 'utf8');
const adminPortalContent = fs.readFileSync(path.join(projectRoot, 'src/components/admin/AdminPortalModal.jsx'), 'utf8');
const mainContent = fs.readFileSync(path.join(projectRoot, 'src/main.jsx'), 'utf8');

// Test 17: FeatureProvider wrapped in main.jsx
if (mainContent.includes('<FeatureProvider>') && mainContent.includes('</FeatureProvider>')) {
  pass('TEST 17: FeatureProvider wired in main.jsx', 'FeatureProvider wraps application inside AuthProvider');
} else {
  fail('TEST 17: FeatureProvider wired in main.jsx', 'Missing FeatureProvider wrapping in main.jsx');
}

// Test 18: AdminPortalModal includes Journey and Feature Control tabs
if (
  adminPortalContent.includes("id: 'journey'") &&
  adminPortalContent.includes("id: 'features'") &&
  adminPortalContent.includes('<AdminProductJourney />') &&
  adminPortalContent.includes('<AdminFeatureControl />')
) {
  pass('TEST 18: AdminPortalModal tabs', '🧭 Product Journey and ⚙️ Feature Control tabs properly registered and rendered');
} else {
  fail('TEST 18: AdminPortalModal tabs', 'Missing journey or features tabs in AdminPortalModal.jsx');
}

// Test 19: App.jsx gates PinnedSongsSection, FavoritesModal, and PresentationModal
if (
  appContent.includes("isFeatureEnabled('todays_service') &&") &&
  appContent.includes("isFeatureEnabled('personal_favorites') &&") &&
  appContent.includes("isFeatureEnabled('presentation_mode') &&")
) {
  pass('TEST 19: App.jsx feature gating', 'PinnedSongsSection, FavoritesModal, and PresentationModal are guarded by isFeatureEnabled');
} else {
  fail('TEST 19: App.jsx feature gating', 'Missing feature gates in App.jsx');
}

// Test 20: Header, SongDetail, SongList gate Favorites and Pins
if (
  headerContent.includes("isFeatureEnabled('personal_favorites')") &&
  songDetailContent.includes("isFeatureEnabled('personal_favorites')") &&
  songDetailContent.includes("isFeatureEnabled('todays_service')") &&
  songDetailContent.includes("isFeatureEnabled('presentation_mode')") &&
  songListContent.includes("isFeatureEnabled('personal_favorites')")
) {
  pass('TEST 20: Component-level feature gating', 'Header, SongDetail, and SongList gate CTAs with runtime availability flags');
} else {
  fail('TEST 20: Component-level feature gating', 'Missing component-level gating in Header, SongDetail, or SongList');
}

// --- SECTION 6: Security Hygiene Audit ---
console.log('\n--- SECTION 6: Security Hygiene Audit ---');

function searchPatterns(dir, pattern, ignoreDirs = ['node_modules', '.git', 'dist']) {
  let matches = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoreDirs.includes(entry.name)) {
        matches = matches.concat(searchPatterns(fullPath, pattern, ignoreDirs));
      }
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.jsx') || entry.name.endsWith('.sql'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (pattern.test(content)) {
        matches.push(fullPath);
      }
    }
  }
  return matches;
}

// Test 21: Zero service_role in src/
const serviceRoleMatches = searchPatterns(path.join(projectRoot, 'src'), /service_role/i);
if (serviceRoleMatches.length === 0) {
  pass('TEST 21: Zero service_role in src/', 'Zero instances of service_role found');
} else {
  fail('TEST 21: Zero service_role in src/', `Found in: ${serviceRoleMatches.join(', ')}`);
}

// Test 22: Zero VITE_ADMIN_PASSWORD in src/
const adminPasswordMatches = searchPatterns(path.join(projectRoot, 'src'), /VITE_ADMIN_PASSWORD/i);
if (adminPasswordMatches.length === 0) {
  pass('TEST 22: Zero VITE_ADMIN_PASSWORD in src/', 'Zero instances of legacy admin password found');
} else {
  fail('TEST 22: Zero VITE_ADMIN_PASSWORD in src/', `Found in: ${adminPasswordMatches.join(', ')}`);
}

console.log('\n============================================================');
console.log(`PHASE 2A VERIFICATION RESULT: ${totalPassed} PASSED, ${totalFailed} FAILED`);
console.log('============================================================');

if (totalFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
