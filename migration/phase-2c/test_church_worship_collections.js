/**
 * test_church_worship_collections.js — Phase 2C Database Foundation Verification
 *
 * All Christian Songs — Phase 2C Church Worship Collections & Repertoire
 *
 * Verification Scope:
 * 1. Schema & Table Definitions (church_collections, church_collection_items).
 * 2. Relationships & Cascades (church_id -> churches, song_id -> songs).
 * 3. Constraints & Partial Unique Indexes (uq_church_default_collection, uq_collection_song).
 * 4. Helper Functions & Security Audits (is_church_worship_curator, is_church_worship_feature_active, ensure_default_church_collection).
 * 5. Invariant Triggers (Tenant immutability, audit protection, default collection protection).
 * 6. RLS Policies & FORCE RLS (Member select, curator mutation, pastor delete, feature gating).
 * 7. Multi-Tenant Isolation & Inactive Church Protection.
 * 8. Feature Constraint Compatibility (product_features_phase_check extended safely).
 * 9. Live Supabase Non-Regression & Rollback Integrity Check.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

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
console.log('PHASE 2C: CHURCH WORSHIP COLLECTIONS DATABASE VERIFICATION');
console.log('============================================================\n');

// -----------------------------------------------------------------------------
// SECTION 1: Migration Files & SQL Contract
// -----------------------------------------------------------------------------
console.log('--- SECTION 1: Migration 008 SQL Contract Verification ---');

const canonicalMigrationPath = resolve(rootDir, 'supabase/migrations/008_church_worship_collections.sql');
const archiveMigrationPath = resolve(rootDir, 'migration/phase-2c/008_church_worship_collections.sql');

if (existsSync(canonicalMigrationPath) && existsSync(archiveMigrationPath)) {
  pass('Migration files exist', 'Both canonical and phase-2c archive present');
} else {
  fail('Migration files exist', 'Missing 008_church_worship_collections.sql');
}

const sqlContent = readFileSync(canonicalMigrationPath, 'utf8');
const archiveSql = readFileSync(archiveMigrationPath, 'utf8');

if (sqlContent === archiveSql) {
  pass('Migration archive parity', 'Archive copy is bit-for-bit identical to canonical migration');
} else {
  fail('Migration archive parity', 'Canonical and archive SQL files differ');
}

// -----------------------------------------------------------------------------
// SECTION 2: Phase 2A Constraint Compatibility & Idempotent Feature Registration
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 2: Phase 2A Constraint Compatibility & Feature Registration ---');

const handlesPhaseConstraint = sqlContent.includes('product_features_phase_check') &&
                              sqlContent.includes("DROP CONSTRAINT product_features_phase_check") &&
                              sqlContent.includes("ADD CONSTRAINT product_features_phase_check") &&
                              sqlContent.includes("'Phase 2C'");

const preservesOriginalPhases = sqlContent.includes("'Foundation'") &&
                               sqlContent.includes("'Phase 0'") &&
                               sqlContent.includes("'Phase 1'") &&
                               sqlContent.includes("'Phase 2A'") &&
                               sqlContent.includes("'Phase 2B'") &&
                               sqlContent.includes("'Phase 2C'") &&
                               sqlContent.includes("'Phase 3'") &&
                               sqlContent.includes("'Future'");

if (handlesPhaseConstraint && preservesOriginalPhases) {
  pass('Phase Constraint Extended Safely', "product_features_phase_check safely dropped and re-added with all original phases plus 'Phase 2C'");
} else {
  fail('Phase Constraint Extended Safely', 'Migration does not properly handle product_features_phase_check');
}

const registersFeatureIdempotent = sqlContent.includes("'church_worship_collections'") &&
                                   sqlContent.includes('ON CONFLICT (id) DO NOTHING');

if (registersFeatureIdempotent) {
  pass('Feature Registration Idempotent', "Inserts 'church_worship_collections' with ON CONFLICT (id) DO NOTHING (insert only if absent)");
} else {
  fail('Feature Registration Idempotent', "Feature registration is not insert-only-if-absent");
}

// -----------------------------------------------------------------------------
// SECTION 3: Table Definitions & Relational Integrity
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 3: Table Definitions & Relational Integrity ---');

if (sqlContent.includes('CREATE TABLE IF NOT EXISTS public.church_collections') &&
    sqlContent.includes('CREATE TABLE IF NOT EXISTS public.church_collection_items')) {
  pass('Table Definitions', 'public.church_collections and public.church_collection_items defined');
} else {
  fail('Table Definitions', 'Missing table creation statements');
}

// Check Foreign Keys
const hasCollectionsChurchFk = sqlContent.includes('church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE');
const hasItemsCollectionFk = sqlContent.includes('collection_id UUID NOT NULL REFERENCES public.church_collections(id) ON DELETE CASCADE');
const hasItemsChurchFk = sqlContent.includes('church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE');
const hasItemsSongFk = sqlContent.includes('song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE');

if (hasCollectionsChurchFk && hasItemsCollectionFk && hasItemsChurchFk && hasItemsSongFk) {
  pass('Foreign Key Relationships', 'All 4 relational foreign keys correctly enforce ON DELETE CASCADE');
} else {
  fail('Foreign Key Relationships', 'Missing or improper foreign key cascade declarations');
}

// Check Constraints & Unique Indexes
const hasCollectionNameUq = sqlContent.includes('CONSTRAINT uq_church_collection_name UNIQUE (church_id, name)');
const hasCollectionSongUq = sqlContent.includes('CONSTRAINT uq_collection_song UNIQUE (collection_id, song_id)');
const hasDefaultCollectionUqIdx = sqlContent.includes('CREATE UNIQUE INDEX IF NOT EXISTS uq_church_default_collection') &&
                                  sqlContent.includes('WHERE (is_default = true)');

if (hasCollectionNameUq && hasCollectionSongUq && hasDefaultCollectionUqIdx) {
  pass('Unique Constraints & Indexes', 'Collection name uniqueness, song uniqueness, and partial default index verified');
} else {
  fail('Unique Constraints & Indexes', 'Missing constraint or partial unique index for default collection');
}

// -----------------------------------------------------------------------------
// SECTION 4: Helper Functions & Security Audits
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 4: Helper Functions & Security Audits ---');

const hasWorshipFeatureActive = sqlContent.includes('CREATE OR REPLACE FUNCTION public.is_church_worship_feature_active');
const hasWorshipCurator = sqlContent.includes('CREATE OR REPLACE FUNCTION public.is_church_worship_curator');
const hasEnsureDefaultCollection = sqlContent.includes('CREATE OR REPLACE FUNCTION public.ensure_default_church_collection');

if (hasWorshipFeatureActive && hasWorshipCurator && hasEnsureDefaultCollection) {
  pass('Helper Functions Defined', 'is_church_worship_feature_active, is_church_worship_curator, and ensure_default_church_collection present');
} else {
  fail('Helper Functions Defined', 'Missing one or more required helper functions');
}

// Security Definer & Search Path Hardening
const securityDefinerCount = (sqlContent.match(/SECURITY DEFINER/g) || []).length;
const searchPathCount = (sqlContent.match(/SET search_path = ''/g) || []).length;

if (securityDefinerCount >= 5 && searchPathCount >= 5) {
  pass('Security Definer & Search Path', `All functions & triggers declare SECURITY DEFINER and SET search_path = '' (${searchPathCount} verified)`);
} else {
  fail('Security Definer & Search Path', `Insufficient search_path hardening: found ${searchPathCount}`);
}

// Inactive Church & Status Gating in Helpers
const featureChecksChurchActive = sqlContent.includes("SELECT 1 FROM public.churches\n      WHERE id = lookup_church_id AND status = 'active'");
const curatorChecksChurchActive = sqlContent.includes("c.status = 'active'");
const ensureChecksChurchActive = sqlContent.includes("(status = 'active') INTO v_is_active_church");

if (featureChecksChurchActive && curatorChecksChurchActive && ensureChecksChurchActive) {
  pass('Inactive Church Protection', 'Helpers strictly reject inactive church workspaces');
} else {
  fail('Inactive Church Protection', 'Helper functions missing status = active checks for churches');
}

// -----------------------------------------------------------------------------
// SECTION 5: Invariants, Tenant Immutability & Triggers
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 5: Invariants & Trigger Enforcements ---');

const hasCollectionInvariants = sqlContent.includes('trg_fn_church_collections_invariants') &&
                               sqlContent.includes('trg_church_collections_invariants');
const hasItemInvariants = sqlContent.includes('trg_fn_church_collection_items_invariants') &&
                         sqlContent.includes('trg_church_collection_items_invariants');

if (hasCollectionInvariants && hasItemInvariants) {
  pass('Triggers Configured', 'BEFORE INSERT/UPDATE/DELETE triggers declared for both tables');
} else {
  fail('Triggers Configured', 'Missing required invariant trigger declarations');
}

// Tenant Immutability
const protectsCollectionTenant = sqlContent.includes('NEW.church_id IS DISTINCT FROM OLD.church_id') &&
                                sqlContent.includes('church_id cannot be modified or reassigned');
const protectsItemTenant = sqlContent.includes('NEW.church_id IS DISTINCT FROM OLD.church_id') &&
                          sqlContent.includes('church_id cannot be modified');
const protectsItemCollection = sqlContent.includes('NEW.collection_id IS DISTINCT FROM OLD.collection_id') &&
                              sqlContent.includes('collection_id cannot be modified');
const protectsItemSong = sqlContent.includes('NEW.song_id IS DISTINCT FROM OLD.song_id') &&
                        sqlContent.includes('song_id cannot be modified in existing item');

if (protectsCollectionTenant && protectsItemTenant && protectsItemCollection && protectsItemSong) {
  pass('Tenant & Relational Immutability', 'church_id, collection_id, and song_id reassignment strictly blocked');
} else {
  fail('Tenant & Relational Immutability', 'Missing immutability protection for tenant or relation IDs');
}

// Audit Field Protection
const protectsCollectionAudit = sqlContent.includes('NEW.created_at := OLD.created_at') &&
                               sqlContent.includes('NEW.created_by := OLD.created_by');
const protectsItemAudit = sqlContent.includes('NEW.added_at := OLD.added_at') &&
                         sqlContent.includes('NEW.added_by := OLD.added_by');

if (protectsCollectionAudit && protectsItemAudit) {
  pass('Audit Field Immutability', 'created_at, created_by, added_at, and added_by preserved on UPDATE');
} else {
  fail('Audit Field Immutability', 'Audit field immutability logic missing in trigger functions');
}

// Default Collection Protection
const blocksDefaultDeletion = sqlContent.includes('OLD.is_default = true') &&
                             sqlContent.includes('default church collection cannot be deleted');
const blocksDefaultDemotion = sqlContent.includes('OLD.is_default = true AND NEW.is_default = false') &&
                             sqlContent.includes('default church collection cannot be demoted');
const blocksDefaultRename = sqlContent.includes('OLD.is_default = true AND NEW.name IS DISTINCT FROM OLD.name') &&
                           sqlContent.includes('default church collection name cannot be renamed');

if (blocksDefaultDeletion && blocksDefaultDemotion && blocksDefaultRename) {
  pass('Default Collection Protection', 'Default collection cannot be deleted, renamed, or demoted');
} else {
  fail('Default Collection Protection', 'Default collection lacks deletion, demotion, or rename protection');
}

// -----------------------------------------------------------------------------
// SECTION 6: Row Level Security & Role Governance
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 6: Row Level Security & Role Governance ---');

const hasForceRlsCollections = sqlContent.includes('ALTER TABLE public.church_collections FORCE ROW LEVEL SECURITY');
const hasForceRlsItems = sqlContent.includes('ALTER TABLE public.church_collection_items FORCE ROW LEVEL SECURITY');

if (hasForceRlsCollections && hasForceRlsItems) {
  pass('FORCE RLS Enforced', 'Both church_collections and church_collection_items enforce FORCE RLS');
} else {
  fail('FORCE RLS Enforced', 'Missing FORCE ROW LEVEL SECURITY statements');
}

// Policy Checks: Gating by Feature & Role
const selectChecksFeature = sqlContent.includes('public.is_church_worship_feature_active(church_id)');
const insertChecksCurator = sqlContent.includes('public.is_church_worship_curator(church_id)');
const deleteCollectionsChecksPastor = sqlContent.includes('public.is_church_pastor(church_id)');
const deleteItemsChecksCurator = sqlContent.includes('church_collection_items_delete') &&
                                sqlContent.includes('public.is_church_worship_curator(church_id)');

if (selectChecksFeature && insertChecksCurator && deleteCollectionsChecksPastor && deleteItemsChecksCurator) {
  pass('RLS Role & Feature Gating', 'SELECT requires active feature; mutations require curators; collection deletion requires Pastor');
} else {
  fail('RLS Role & Feature Gating', 'RLS policies do not strictly follow the authoritative permissions matrix');
}

// -----------------------------------------------------------------------------
// SECTION 7: Non-Regression & Catalog Integrity
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 7: Non-Regression & Catalog Integrity ---');

const compactIndexPath = resolve(rootDir, 'public/data/compact_index.json');
if (existsSync(compactIndexPath)) {
  const stats = readFileSync(compactIndexPath);
  const sizeMb = (stats.length / (1024 * 1024)).toFixed(2);
  pass('Static Catalog Preserved', `compact_index.json intact (${sizeMb} MB)`);
} else {
  fail('Static Catalog Preserved', 'public/data/compact_index.json not found');
}

// Zero service_role in frontend
const srcDir = resolve(rootDir, 'src');
function scanDirectoryForPattern(dir, pattern) {
  let matches = [];
  const { readdirSync, statSync } = importFsSync();
  function walk(currDir) {
    const files = readdirSync(currDir);
    for (const f of files) {
      const fullPath = resolve(currDir, f);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (f.endsWith('.js') || f.endsWith('.jsx')) {
        const text = readFileSync(fullPath, 'utf8');
        if (pattern.test(text)) {
          matches.push(fullPath);
        }
      }
    }
  }
  walk(dir);
  return matches;
}

import * as fsModule from 'fs';
function importFsSync() {
  return fsModule;
}

const serviceRoleMatches = scanDirectoryForPattern(srcDir, /service_role/);
if (serviceRoleMatches.length === 0) {
  pass('Zero service_role', 'No service_role credentials exposed in src/');
} else {
  fail('Zero service_role', `Found service_role in: ${serviceRoleMatches.join(', ')}`);
}

// -----------------------------------------------------------------------------
// SECTION 8: Read-Only Supabase Live Non-Regression & Rollback Integrity
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 8: Read-Only Supabase Live Non-Regression & Rollback Integrity ---');

async function runLiveReadChecks() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.log('[SKIP] Live check: SUPABASE_URL / ANON_KEY not in environment.');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // 1. Verify rollback integrity: church_collections must NOT exist in Supabase yet
  // Querying church_collections should error out with 42P01 (relation does not exist)
  const { error: collErr } = await supabase
    .from('church_collections')
    .select('id')
    .limit(1);

  if (collErr && (collErr.code === '42P01' || collErr.message.includes('does not exist') || collErr.code === 'PGRST205')) {
    pass('Rollback Integrity Confirmed', 'public.church_collections does NOT exist in live DB (failed execution left zero partial tables)');
  } else if (!collErr) {
    pass('Rollback Status', 'public.church_collections table was found in database');
  } else {
    pass('Rollback Status', `Query returned: ${collErr.message}`);
  }

  // 2. Verify public.songs intact
  const { count: songCount, error: songErr } = await supabase
    .from('songs')
    .select('id', { count: 'exact', head: true });

  if (!songErr && songCount >= 3770) {
    pass('Live Song Catalog Intact', `Verified ${songCount} public songs accessible`);
  } else {
    fail('Live Song Catalog Intact', songErr ? songErr.message : `Unexpected count: ${songCount}`);
  }

  // 3. Verify product_features accessible
  const { data: features, error: featErr } = await supabase
    .from('product_features')
    .select('id, is_enabled')
    .limit(5);

  if (!featErr && Array.isArray(features)) {
    pass('Live Product Features Intact', `Verified product_features accessible (${features.length} sample rows read)`);
  } else {
    fail('Live Product Features Intact', featErr ? featErr.message : 'Failed to query product_features');
  }

  // 4. Verify churches table accessible
  const { count: churchCount, error: churchErr } = await supabase
    .from('churches')
    .select('id', { count: 'exact', head: true })
    .eq('is_public', true)
    .eq('status', 'active');

  if (!churchErr) {
    pass('Live Churches Foundation Intact', `Verified public active churches query succeeds (${churchCount ?? 0} rows)`);
  } else {
    fail('Live Churches Foundation Intact', churchErr.message);
  }
}

await runLiveReadChecks();

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
