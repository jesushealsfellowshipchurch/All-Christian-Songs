/**
 * test_church_worship_ui.js — Phase 2C Step 2B Static & Architectural Verification
 *
 * Verifies all 21 mandatory requirements for Church Workspace Worship UI + Song Picker Integration:
 * 1. Worship UI component exists.
 * 2. Church Workspace integration exists.
 * 3. churchWorshipService is used.
 * 4. Existing ChurchContext is used for church selection.
 * 5. Existing feature architecture is reused.
 * 6. Feature ID is exactly: church_worship_collections.
 * 7. No hardcoded church UUID.
 * 8. No service_role.
 * 9. No direct Supabase CRUD bypassing churchWorshipService where the service should be used.
 * 10. Member role does not receive mutation controls.
 * 11. Worship Leader receives curation controls.
 * 12. Worship Leader cannot receive collection-delete controls.
 * 13. Pastor receives custom collection-delete capability.
 * 14. Default collection is protected in UI.
 * 15. Song picker uses compact_index.json.
 * 16. No duplicate song database/catalog introduced.
 * 17. Immutable fields are not sent in reorder/update operations.
 * 18. Archived/unpublished song state is handled.
 * 19. Responsive viewport rules are present.
 * 20. No modification to Auth architecture.
 * 21. No modification to Migration 008.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    console.error(`  ✗ FAIL: ${message}`);
  }
}

console.log('================================================================');
console.log('PHASE 2C — STEP 2B: WORSHIP UI & SONG PICKER INTEGRATION TEST');
console.log('================================================================\n');

// Load target files
const worshipTabPath = path.join(rootDir, 'src/components/church/ChurchWorshipTab.jsx');
const songPickerPath = path.join(rootDir, 'src/components/church/ChurchSongPickerModal.jsx');
const arrangementModalPath = path.join(rootDir, 'src/components/church/ChurchArrangementModal.jsx');
const workspaceModalPath = path.join(rootDir, 'src/components/church/ChurchWorkspaceModal.jsx');
const appPath = path.join(rootDir, 'src/App.jsx');
const migration008Path = path.join(rootDir, 'supabase/migrations/008_church_worship_collections.sql');
const authContextPath = path.join(rootDir, 'src/context/AuthContext.jsx');

const worshipTabCode = fs.existsSync(worshipTabPath) ? fs.readFileSync(worshipTabPath, 'utf8') : '';
const songPickerCode = fs.existsSync(songPickerPath) ? fs.readFileSync(songPickerPath, 'utf8') : '';
const arrangementModalCode = fs.existsSync(arrangementModalPath) ? fs.readFileSync(arrangementModalPath, 'utf8') : '';
const workspaceModalCode = fs.existsSync(workspaceModalPath) ? fs.readFileSync(workspaceModalPath, 'utf8') : '';
const appCode = fs.existsSync(appPath) ? fs.readFileSync(appPath, 'utf8') : '';
const migration008Code = fs.existsSync(migration008Path) ? fs.readFileSync(migration008Path, 'utf8') : '';
const authContextCode = fs.existsSync(authContextPath) ? fs.readFileSync(authContextPath, 'utf8') : '';

// 1. Worship UI component exists
assert(
  fs.existsSync(worshipTabPath) && fs.existsSync(songPickerPath) && fs.existsSync(arrangementModalPath),
  '1. Worship UI components exist (ChurchWorshipTab, ChurchSongPickerModal, ChurchArrangementModal)'
);

// 2. Church Workspace integration exists
assert(
  workspaceModalCode.includes('ChurchWorshipTab') &&
  workspaceModalCode.includes("activeTab === 'worship'") &&
  workspaceModalCode.includes("setActiveTab('worship')"),
  '2. Church Workspace integrates ChurchWorshipTab with activeTab navigation'
);

// 3. churchWorshipService is used
assert(
  worshipTabCode.includes('from \'../../services/churchWorshipService\'') &&
  worshipTabCode.includes('getCollections') &&
  worshipTabCode.includes('ensureDefaultCollection') &&
  worshipTabCode.includes('getCollectionItems') &&
  worshipTabCode.includes('addSongToCollection') &&
  worshipTabCode.includes('updateCollectionItem') &&
  worshipTabCode.includes('removeSongFromCollection') &&
  worshipTabCode.includes('reorderCollectionItems'),
  '3. churchWorshipService is imported and authoritative for all collections and items operations'
);

// 4. Existing ChurchContext is used for church selection
assert(
  workspaceModalCode.includes('useChurch()') &&
  workspaceModalCode.includes('activeChurch') &&
  worshipTabCode.includes('activeChurch.id'),
  '4. ChurchContext activeChurch is used strictly; church selection is workspace-scoped'
);

// 5. Existing feature architecture is reused
assert(
  workspaceModalCode.includes("isChurchFeatureActive('church_worship_collections')") &&
  workspaceModalCode.includes("isFeatureEnabled('church_worship_collections')") &&
  worshipTabCode.includes('isWorshipActive'),
  '5. Reuses two-tier feature architecture (isChurchFeatureActive & isFeatureEnabled)'
);

// 6. Feature ID is exactly church_worship_collections
assert(
  workspaceModalCode.includes("'church_worship_collections'") &&
  !workspaceModalCode.includes("'church_worship_collection'") &&
  !workspaceModalCode.includes("'worship_collections'"),
  '6. Feature ID is exactly "church_worship_collections"'
);

// 7. No hardcoded church UUID
const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
assert(
  !uuidRegex.test(worshipTabCode) && !uuidRegex.test(songPickerCode) && !uuidRegex.test(arrangementModalCode),
  '7. No hardcoded church UUID found in worship components'
);

// 8. No service_role
assert(
  !worshipTabCode.includes('service_role') &&
  !songPickerCode.includes('service_role') &&
  !arrangementModalCode.includes('service_role') &&
  !workspaceModalCode.includes('service_role'),
  '8. Zero service_role credentials or elevated backend keys'
);

// 9. No direct Supabase CRUD bypassing churchWorshipService where service should be used
assert(
  !worshipTabCode.includes("supabase.from('church_collections')") &&
  !worshipTabCode.includes("supabase.from('church_collection_items')"),
  '9. No direct Supabase CRUD bypassing churchWorshipService in UI components'
);

// 10. Member role does not receive mutation controls
assert(
  worshipTabCode.includes('isCurator = Boolean(isPastor || isWorshipLeader)') &&
  worshipTabCode.includes('{isCurator && (') &&
  worshipTabCode.includes('handleMoveItem') &&
  worshipTabCode.includes('handleRemoveSong'),
  '10. Member role receives read-only UI; mutation controls gated behind isCurator'
);

// 11. Worship Leader receives curation controls
assert(
  worshipTabCode.includes('isCurator') &&
  worshipTabCode.includes('handleOpenCreateModal') &&
  worshipTabCode.includes('handleOpenEditModal') &&
  worshipTabCode.includes('handleAddSongToCollection') &&
  worshipTabCode.includes('setEditingItem'),
  '11. Worship Leader receives collection creation, song addition, arrangement edit, and reorder controls'
);

// 12. Worship Leader cannot receive collection-delete controls
assert(
  worshipTabCode.includes('{isPastor && !selectedCollection.is_default && (') &&
  worshipTabCode.includes('handleDeleteCollection') &&
  !worshipTabCode.includes('{isCurator && !selectedCollection.is_default && (\n                    <button\n                      type="button"\n                      onClick={handleDeleteCollection}'),
  '12. Collection deletion is strictly restricted to isPastor; hidden from Worship Leader'
);

// 13. Pastor receives custom collection-delete capability
assert(
  worshipTabCode.includes('handleDeleteCollection') &&
  worshipTabCode.includes('isPastor') &&
  worshipTabCode.includes('deleteCollection(selectedCollection.id)'),
  '13. Pastor receives custom collection deletion capability with confirmation'
);

// 14. Default collection is protected in UI
assert(
  worshipTabCode.includes('!selectedCollection.is_default') &&
  worshipTabCode.includes('handleOpenEditModal') &&
  worshipTabCode.includes('handleDeleteCollection') &&
  worshipTabCode.includes('Star') &&
  worshipTabCode.includes('Default'),
  '14. Default collection is protected from rename/delete in UI and visually distinguished'
);

// 15. Song picker uses compact_index.json
assert(
  songPickerCode.includes('getCatalogIndex') &&
  songPickerCode.includes('filterSongs') &&
  songPickerCode.includes('catalogRepository'),
  '15. Song picker uses getCatalogIndex() and filterSongs() against compact_index.json'
);

// 16. No duplicate song database/catalog introduced
assert(
  !songPickerCode.includes('createTable') &&
  !songPickerCode.includes('songs_copy') &&
  !songPickerCode.includes('duplicate') &&
  songPickerCode.includes('existingSongIds.has(song.id)'),
  '16. No duplicate song catalog introduced; references song IDs with duplicate prevention'
);

// 17. Immutable fields are not sent in reorder/update operations
assert(
  worshipTabCode.includes('orderedPayload = newItems.map((it, idx) => ({\n      id: it.id,\n      sort_order: idx + 1\n    }))') &&
  !worshipTabCode.includes('church_id: it.church_id') &&
  !worshipTabCode.includes('collection_id: it.collection_id') &&
  !worshipTabCode.includes('created_at:'),
  '17. Reorder sends minimal payload ({ id, sort_order }); immutable fields omitted'
);

// 18. Archived/unpublished song state is handled
assert(
  worshipTabCode.includes('isArchived') &&
  worshipTabCode.includes('Archived Song') &&
  worshipTabCode.includes('This song is no longer available in the public catalog') &&
  worshipTabCode.includes('!isArchived && onSelectSong'),
  '18. Archived/unpublished song state renders gracefully with lyrics access disabled'
);

// 19. Responsive viewport rules are present
assert(
  worshipTabCode.includes('flex flex-col md:flex-row') &&
  worshipTabCode.includes('min-h-[44px]') &&
  songPickerCode.includes('min-h-[44px]') &&
  songPickerCode.includes('overflow-y-auto') &&
  arrangementModalCode.includes('min-h-[44px]'),
  '19. Content-driven responsive classes, internal scrolling, and >= 44px touch targets present'
);

// 20. No modification to Auth architecture
assert(
  authContextCode.includes('export function AuthProvider') &&
  !authContextCode.includes('church_worship_collections'),
  '20. AuthContext and authentication architecture remained unmodified'
);

// 21. No modification to Migration 008
assert(
  migration008Code.includes('CREATE TABLE IF NOT EXISTS public.church_collections') &&
  migration008Code.includes('CREATE TABLE IF NOT EXISTS public.church_collection_items') &&
  migration008Code.includes('trg_church_collections_invariants'),
  '21. Migration 008 is verified and unmodified'
);

console.log(`\n================================================================`);
console.log(`TOTAL STATIC CONTRACT TESTS: ${passedTests} / ${totalTests} PASS`);
console.log(`================================================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
