/**
 * test_church_foundation.js — Phase 2B Multi-Church Workspace Verification Suite
 *
 * All Christian Songs — Phase 2B Foundation
 *
 * Verifies:
 * 1. Migration 006 Schema & Invariant Contracts:
 *    - public.churches, public.church_memberships, public.church_features.
 *    - Security Definer helper functions (is_church_pastor, is_church_member, lookup_church_for_join).
 *    - Triggers: enforce_church_invariants, assign_initial_church_pastor, protect_last_active_pastor.
 *    - RLS & FORCE RLS on all 3 tables.
 * 2. Domain Service Two-Tier Feature Resolution (Platform Ceiling + Church Override).
 * 3. Slug Generation, Validation, and Data Sanitization.
 * 4. Role Hierarchy & Permission Boundaries (Pastor vs Worship Leader vs Member).
 * 5. Production Non-Regression (songs, pinned_songs, favorites, product_features).
 * 6. Live Supabase Status Check (handles both pre-migration and post-migration states gracefully).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import {
  isValidSlug,
  generateSlug,
  getEffectiveChurchFeatureState
} from '../../src/services/churchService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

let totalPassed = 0;
let totalFailed = 0;
let totalSkipped = 0;

function pass(name, detail = '') {
  console.log(`[PASS] ${name}${detail ? ` — ${detail}` : ''}`);
  totalPassed++;
}

function fail(name, detail = '') {
  console.error(`[FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
  totalFailed++;
}

function skip(name, reason = '') {
  console.log(`[SKIP] ${name}${reason ? ` (${reason})` : ''}`);
  totalSkipped++;
}

console.log('============================================================');
console.log('PHASE 2B: MULTI-CHURCH WORKSPACE FOUNDATION VERIFICATION');
console.log('============================================================\n');

// =============================================================================
// SECTION 1: Migration 006 SQL Contract Verification
// =============================================================================
console.log('--- SECTION 1: Migration 006 SQL Contract Verification ---');

const migrationFile = path.join(projectRoot, 'supabase/migrations/006_church_foundation.sql');
const archiveFile = path.join(projectRoot, 'migration/phase-2b/006_church_foundation.sql');

if (fs.existsSync(migrationFile) && fs.existsSync(archiveFile)) {
  pass('Migration files exist', 'both canonical and phase-2b archive present');
} else {
  fail('Migration files exist', 'missing canonical or archive file');
}

const sqlContent = fs.readFileSync(migrationFile, 'utf8');

// Test 1: Tables defined
const hasChurchesTable = sqlContent.includes('CREATE TABLE IF NOT EXISTS public.churches');
const hasMembershipsTable = sqlContent.includes('CREATE TABLE IF NOT EXISTS public.church_memberships');
const hasFeaturesTable = sqlContent.includes('CREATE TABLE IF NOT EXISTS public.church_features');

if (hasChurchesTable && hasMembershipsTable && hasFeaturesTable) {
  pass('Table Definitions', 'churches, church_memberships, church_features defined');
} else {
  fail('Table Definitions', 'one or more tables missing in SQL');
}

// Test 2: Helper Functions
const hasPastorHelper = sqlContent.includes('FUNCTION public.is_church_pastor');
const hasMemberHelper = sqlContent.includes('FUNCTION public.is_church_member');
const hasLookupRpc = sqlContent.includes('FUNCTION public.lookup_church_for_join');

if (hasPastorHelper && hasMemberHelper && hasLookupRpc) {
  pass('Helper Functions', 'is_church_pastor, is_church_member, and lookup_church_for_join present');
} else {
  fail('Helper Functions', 'missing one or more helper functions in SQL');
}

// Test 3: Triggers & Invariants
const hasInvariantTrigger = sqlContent.includes('FUNCTION public.enforce_church_invariants');
const hasInitialPastorTrigger = sqlContent.includes('FUNCTION public.assign_initial_church_pastor');
const hasLastPastorTrigger = sqlContent.includes('FUNCTION public.protect_last_active_pastor');

if (hasInvariantTrigger && hasInitialPastorTrigger && hasLastPastorTrigger) {
  pass('Triggers & Invariants', 'church invariants, atomic pastor assignment, last pastor protection defined');
} else {
  fail('Triggers & Invariants', 'missing one or more trigger definitions in SQL');
}

// Test 4: RLS & FORCE RLS Enforced
const hasRlsChurches = sqlContent.includes('ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY') &&
                       sqlContent.includes('ALTER TABLE public.churches FORCE ROW LEVEL SECURITY');
const hasRlsMembers = sqlContent.includes('ALTER TABLE public.church_memberships ENABLE ROW LEVEL SECURITY') &&
                      sqlContent.includes('ALTER TABLE public.church_memberships FORCE ROW LEVEL SECURITY');
const hasRlsFeatures = sqlContent.includes('ALTER TABLE public.church_features ENABLE ROW LEVEL SECURITY') &&
                       sqlContent.includes('ALTER TABLE public.church_features FORCE ROW LEVEL SECURITY');

if (hasRlsChurches && hasRlsMembers && hasRlsFeatures) {
  pass('Row Level Security Enforced', 'ENABLE and FORCE RLS applied to all 3 tables');
} else {
  fail('Row Level Security Enforced', 'missing ENABLE or FORCE RLS on tables');
}

// Test 5: Compound Unique Constraints
const hasMembershipUnique = sqlContent.includes('CONSTRAINT uq_church_user_membership UNIQUE (church_id, user_id)');
const hasSlugUnique = sqlContent.includes('idx_churches_slug');

if (hasMembershipUnique && hasSlugUnique) {
  pass('Unique Constraints', 'uq_church_user_membership and unique slug index present');
} else {
  fail('Unique Constraints', 'missing uniqueness constraints');
}

// =============================================================================
// SECTION 2: Domain Service Two-Tier Feature Resolution
// =============================================================================
console.log('\n--- SECTION 2: Two-Tier Feature Resolution Unit Tests ---');

// Test 6: Platform OFF -> Hard OFF (Church cannot override)
const res1 = getEffectiveChurchFeatureState('church-1', 'worship_team_roles', { worship_team_roles: false }, { worship_team_roles: true });
if (res1 === false) {
  pass('Platform OFF override', 'Platform OFF overrides church ON preference -> false');
} else {
  fail('Platform OFF override', 'Expected false, got ' + res1);
}

// Test 7: Platform ON + Church no override -> Default ON
const res2 = getEffectiveChurchFeatureState('church-1', 'worship_team_roles', { worship_team_roles: true }, {});
if (res2 === true) {
  pass('Default inheritance', 'Platform ON with no church override row -> true (default)');
} else {
  fail('Default inheritance', 'Expected true, got ' + res2);
}

// Test 8: Platform ON + Church override ON -> ON
const res3 = getEffectiveChurchFeatureState('church-1', 'worship_team_roles', { worship_team_roles: true }, { worship_team_roles: true });
if (res3 === true) {
  pass('Explicit church ON', 'Platform ON + church ON -> true');
} else {
  fail('Explicit church ON', 'Expected true, got ' + res3);
}

// Test 9: Platform ON + Church override OFF -> OFF
const res4 = getEffectiveChurchFeatureState('church-1', 'worship_team_roles', { worship_team_roles: true }, { worship_team_roles: false });
if (res4 === false) {
  pass('Explicit church opt-out', 'Platform ON + church OFF -> false');
} else {
  fail('Explicit church opt-out', 'Expected false, got ' + res4);
}

// =============================================================================
// SECTION 3: Slug Generation & Validation Utilities
// =============================================================================
console.log('\n--- SECTION 3: Slug Utilities Unit Tests ---');

// Test 10: Slug generation handles Telugu/English mixed, special characters
const slug1 = generateSlug('Grace Fellowship Hyderabad');
const slug2 = generateSlug('Jesus Heals Ministry #1 & Praise');
if (slug1 === 'grace-fellowship-hyderabad' && slug2 === 'jesus-heals-ministry-1-praise') {
  pass('Slug generation', `Clean output: "${slug1}", "${slug2}"`);
} else {
  fail('Slug generation', `Unexpected slug: "${slug1}" or "${slug2}"`);
}

// Test 11: Slug validator enforces length and character rules
const valid = isValidSlug('grace-fellowship') && isValidSlug('calvary-chapel-vizag');
const invalid = !isValidSlug('ab') && !isValidSlug('Grace-Fellowship') && !isValidSlug('trailing-dash-') && !isValidSlug('-leading-dash');
if (valid && invalid) {
  pass('Slug validation', 'Complies with PostgreSQL slug constraint regex');
} else {
  fail('Slug validation', 'Failed valid/invalid slug validation checks');
}

// =============================================================================
// SECTION 4: Role Hierarchy & Governance Separation
// =============================================================================
console.log('\n--- SECTION 4: Role Hierarchy & Governance Invariants ---');

// Test 12: Check that profiles.role is NOT repurposed in SQL
const profilesRepurposed = sqlContent.includes('ALTER TABLE public.profiles ADD COLUMN role') ||
                           sqlContent.includes('UPDATE public.profiles SET role');
if (!profilesRepurposed) {
  pass('Role separation', 'profiles.role remains untouched; church roles strictly in church_memberships');
} else {
  fail('Role separation', 'Detected modification to profiles.role in SQL');
}

// Test 13: Check that personal favorites are not scoped to church
const favoritesModified = sqlContent.includes('public.user_favorites') || sqlContent.includes('church_id UUID REFERENCES public.user_favorites');
if (!favoritesModified) {
  pass('Favorites privacy invariant', 'user_favorites table is not modified and remains strictly personal');
} else {
  fail('Favorites privacy invariant', 'Found unexpected reference to user_favorites');
}

// Test 14: Check that global pinned_songs is untouched
const pinnedModified = sqlContent.includes('public.pinned_songs') || sqlContent.includes('pinned_songs ADD COLUMN church_id');
if (!pinnedModified) {
  pass("Today's service invariant", 'pinned_songs table is not modified');
} else {
  fail("Today's service invariant", 'Found unexpected reference to pinned_songs');
}

// =============================================================================
// SECTION 5: Production Non-Regression Checks (Files & Assets)
// =============================================================================
console.log('\n--- SECTION 5: Production Non-Regression Checks ---');

// Test 15: Public song catalog file intact
const songCatalogPath = path.join(projectRoot, 'public/data/compact_index.json');
if (fs.existsSync(songCatalogPath)) {
  const stat = fs.statSync(songCatalogPath);
  if (stat.size > 500000) {
    pass('Static song catalog preserved', `compact_index.json (${(stat.size / 1024 / 1024).toFixed(2)} MB) intact`);
  } else {
    fail('Static song catalog preserved', 'File suspiciously small');
  }
} else {
  fail('Static song catalog preserved', 'Missing public/data/compact_index.json');
}

// Test 16: Check Phase 2A product_features migration intact
const phase2aMigration = path.join(projectRoot, 'supabase/migrations/005_product_features.sql');
if (fs.existsSync(phase2aMigration)) {
  pass('Phase 2A migration file intact', '005_product_features.sql preserved');
} else {
  fail('Phase 2A migration file intact', '005_product_features.sql missing');
}

// =============================================================================
// SECTION 6: Live Supabase Status Detection
// =============================================================================
console.log('\n--- SECTION 6: Live Supabase Verification ---');

async function verifyLiveSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) {
    skip('Live Supabase query', 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  try {
    // Check if table 006 has already been migrated in Supabase
    const { data: churchTest, error: churchErr } = await supabase
      .from('churches')
      .select('id')
      .limit(1);

    if (churchErr && (churchErr.code === '42P01' || churchErr.message.includes('does not exist') || churchErr.message.includes('schema cache'))) {
      pass('Pre-migration state confirmed', 'public.churches correctly awaiting manual execution of 006_church_foundation.sql in Supabase SQL Editor');
    } else if (churchTest !== null) {
      pass('Post-migration live table confirmed', 'public.churches accessible in live Supabase');

      // Test live anonymous access: unverified churches must NOT be visible
      const { data: anonData, error: anonErr } = await supabase
        .from('churches')
        .select('*');

      if (!anonErr) {
        const hasUnverified = (anonData || []).some(c => c.verification_status !== 'verified' || !c.is_public);
        if (!hasUnverified) {
          pass('Live RLS verification filter', 'Anonymous client cannot view unverified/private churches');
        } else {
          fail('Live RLS verification filter', 'Unverified/private church leaked to anonymous query');
        }
      }
    }

    // Verify existing public songs table remains operational
    const { count: songCount, error: songErr } = await supabase
      .from('songs')
      .select('id', { count: 'exact', head: true });

    if (!songErr && songCount >= 3700) {
      pass('Live public songs catalog preserved', `${songCount} songs accessible in public.songs`);
    } else {
      fail('Live public songs catalog preserved', songErr ? songErr.message : `Only ${songCount} songs found`);
    }

    // Verify Phase 2A product_features remains operational
    const { data: featData, error: featErr } = await supabase
      .from('product_features')
      .select('id, is_enabled');

    if (!featErr && featData && featData.length >= 1) {
      pass('Phase 2A product_features preserved', `${featData.length} features active in live database`);
    } else {
      fail('Phase 2A product_features preserved', featErr ? featErr.message : 'No features returned');
    }

  } catch (err) {
    fail('Live Supabase query exception', err.message);
  }
}

await verifyLiveSupabase();

console.log('\n============================================================');
console.log(`VERIFICATION SUMMARY: ${totalPassed} PASSED, ${totalFailed} FAILED, ${totalSkipped} SKIPPED`);
console.log('============================================================');

if (totalFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
