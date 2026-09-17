# Phase 9B-6 — Admin Songbook Association Management

## 1. Overview & Architecture

Phase 9B-6 implements the authoritative administrative **Songbook Association Management** workflow for the *All Christian Songs* hymnal platform. It establishes an explicit, secure, direct-Supabase interface for managing which official hymnals and collections a song is assigned to, along with its specific song number in each hymnal:

```
Authenticated Admin Browser
  ↓
AuthContext (Session & Role UX Gate)
  ↓
AdminEditSong.jsx  ──>  AdminSongbookManager.jsx
  ↓
adminSongService (getSongbookAssociations, addSongbookAssociation,
                  removeSongbookAssociation, reconcileSongbookAssociations,
                  updateSongbookAssociations)
  ↓
Supabase Auth JWT
  ↓
PostgREST
  ↓
PostgreSQL Row Level Security (public.is_admin() / 42501 Gate)
  ↓
public.songbook_songs Table (Canonical Relational Junction)
```

### Strict Phase Boundaries
- **In Scope (Phase 9B-6)**: Viewing current songbook associations for a hymn, dynamically loading available songbooks from `public.songbooks`, adding songbook associations, removing songbook associations, updating song numbers, difference-based reconciliation, explicit partial failure reporting, UI integration in `AdminEditSong.jsx`, and preserving Phase 9B-5 deletion blocks.
- **Completed in Earlier Phases**:
  - Phase 9B-1: Admin Song Service Foundation & Schema Hardening
  - Phase 9B-2: Admin Song List UI & Filtering
  - Phase 9B-3: Admin Create Song Workflow
  - Phase 9B-4: Admin Edit Song Workflow
  - Phase 9B-5: Admin Delete & Dedicated Unpublish Workflow
- **Explicitly Deferred**:
  - Full Security & CRUD Verification Suite: Deferred to **Phase 9B-7**

---

## 2. Database Schema, Constraints & RLS Findings

Before making any code changes, the live Supabase schema, migration files (`001_security_foundation.sql`, `002_song_schema.sql`, `003_security_hardening.sql`), and live tables were inspected.

### Authoritative Tables & Columns

#### 1. `public.songbooks` (Lookup & Collection Metadata)
- **Primary Key**: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- **Columns**: `id`, `slug`, `title`, `title_native`, `title_transliterated`, `language`, `description`, `publisher`, `total_in_print`, `cover_url`, `sort_order`, `is_active`, `is_numbered`, `parent_slug`, `created_at`, `updated_at`
- **Ordering Column**: `sort_order INTEGER NOT NULL DEFAULT 0`
- **Current Deployed Row Count**: Exactly **8** songbooks
- **RLS Policy**:
  - SELECT: `USING (true)` (`songbooks_select_public`)
  - WRITE: `FOR ALL USING (public.is_admin())` (`songbooks_write_admin`)

#### 2. `public.songbook_songs` (Canonical Association Junction Table)
- **Primary Key**: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- **Columns**:
  - `id UUID PRIMARY KEY`
  - `song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE`
  - `songbook_id UUID NOT NULL REFERENCES public.songbooks(id) ON DELETE CASCADE`
  - `song_number INTEGER`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- **Unique Constraint**: `CONSTRAINT uq_songbook_songs UNIQUE (song_id, songbook_id)`
- **Indexes**:
  - `idx_songbook_songs_lookup (songbook_id, song_number)`
  - `idx_songbook_songs_song (song_id)`
- **Current Deployed Row Count**: Exactly **2,291** association rows
- **RLS Policy**:
  - SELECT: `USING (true)` (`songbook_songs_select_public`)
  - WRITE: `FOR ALL USING (public.is_admin())` (`songbook_songs_write_admin`)

#### 3. `public.songs.songbooks` (Denormalized Compatibility JSONB)
- In `public.songs`, the column `songbooks` is defined as `JSONB NOT NULL DEFAULT '[]'::jsonb`.
- **Trigger Verification Result**: Migration files and live PostgreSQL functions were inspected for any trigger or function that automatically synchronizes `songs.songbooks` from `public.songbook_songs` or vice versa.
- **Finding**: **NO trigger or synchronization function exists.**
- **Architectural Decision**: `songs.songbooks` is strictly a denormalized read-compatibility field. Per the Phase 9B-6 prompt instructions, `public.songbook_songs` is the authoritative write target. Association management writes **exclusively** to `public.songbook_songs` and does not mutate or invent synchronization logic for `songs.songbooks`.

---

## 3. Implemented Service Capabilities

The following capabilities were implemented and hardened in [`src/services/adminSongService.js`](file:///e:/WorkSpaceOne/Google/ChristianLyricsWeb/src/services/adminSongService.js):

### 1. `getAvailableSongbooks()`
- Dynamically loads all active songbooks directly from `public.songbooks`.
- Orders results by the authoritative database column `sort_order` ascending (`.order('sort_order', { ascending: true })`).
- Returns `{ songbooks: Array, error: string|null }`.
- Never hardcodes songbook IDs or metadata.

### 2. `getSongbookAssociations(songId)`
- Validates the provided `songId` against standard UUID format.
- Queries `public.songbook_songs` where `song_id = songId`.
- Returns `{ associations: Array, error: string|null }`.

### 3. `addSongbookAssociation(songId, songbookId, songNumber = null)`
- Validates both `songId` and `songbookId` as valid UUIDs.
- Inserts a single record `{ song_id, songbook_id, song_number }` into `public.songbook_songs`.
- Handles PostgreSQL unique constraint violation (`23505`) gracefully, returning `'This song is already assigned to this songbook.'`.
- Fails closed with standard permission error under RLS when unauthenticated.
- Returns `{ success: boolean, association: Object|null, error: string|null }`.

### 4. `removeSongbookAssociation(songId, songbookId)`
- Validates both `songId` and `songbookId` as valid UUIDs.
- Executes targeted `.delete().eq('song_id', songId).eq('songbook_id', songbookId).select('id')`.
- Verifies deletion result (`deletedRows.length > 0`) to prevent false successes when RLS denies deletion.
- Does NOT delete the song or the songbook.
- Returns `{ success: boolean, error: string|null }`.

### 5. `reconcileSongbookAssociations(songId, desiredAssociations)`
- Implements targeted difference reconciliation:
  1. Fetches current associations from the database via `getSongbookAssociations(songId)`.
  2. Builds lookup maps for current and desired state.
  3. Computes exact differences:
     - `toRemove`: In current database state, but not in desired state.
     - `toAdd`: In desired state, but not in current database state.
     - `toUpdate`: In both, but `song_number` changed.
  4. Executes targeted removes, adds, and updates individually.
  5. Tracks changes and errors explicitly.
- **No Delete-All**: Avoids destructive delete-all/recreate-all anti-patterns.
- **Partial Failure Handling**: If some operations succeed and some fail, returns:
  `{ success: false, added, removed, updated, errors, error: 'Songbook associations were partially updated...' }`.
  Never claims full success when operations fail.
- **Non-Transactional Notice**: PostgREST client calls are discrete; atomicity is not claimed.
- **Cache Invalidation**: Invalidates public catalog and song caches upon successful modifications.

### 6. `updateSongbookAssociations(songId, desiredSongbookIds)`
- Normalizes inputs: supports both array of UUID strings (`['uuid1', 'uuid2']`) and array of objects (`[{ songbookId, songNumber }]`).
- Preserves existing `song_number` values if the caller provides only UUID strings.
- Delegates to `reconcileSongbookAssociations`.
- Returns `{ success: boolean, added, removed, updated, errors, error }`.

---

## 4. UI Implementation

### 1. `src/components/admin/AdminSongbookManager.jsx`
A standalone, production-quality association management component:
- **Design Language**: Matches the dark obsidian / warm amber aesthetic of the platform.
- **State Management**:
  - Loads available songbooks and current associations concurrently.
  - Maintains separate `currentAssociations` and `editableAssociations` states.
  - Implements precise `isDirty()` checking to enable/disable the Save button and display an unsaved changes indicator.
- **Interactive Controls**:
  - Checkbox toggle button for each songbook.
  - Song number input (`No.`) for assigned songbooks with Enter key suppression (`e.preventDefault()`).
  - Dedicated trash/remove button per assigned songbook.
- **Resilience & Safety**:
  - All buttons have explicit `type="button"` to eliminate accidental parent form submissions.
  - Handles loading spinner state.
  - Handles error state with "Retry" action.
  - Handles empty state when no songbooks exist in the database.
  - Displays distinct feedback banners for full success, partial failure, and full failure.

### 2. Integration in `src/components/admin/AdminEditSong.jsx`
- Embedded as **Section H: Songbook Associations** directly inside the hymn edit screen.
- Passes `loadedSong.id` and `loadedSong.title` to `AdminSongbookManager`.
- Ensures administrators can review and modify songbook memberships while editing a hymn without leaving the screen.
- Complete isolation: song metadata edits (to `public.songs`) and songbook association edits (to `public.songbook_songs`) remain strictly separated in both state and API calls.

---

## 5. Deletion Compatibility & Relationship Safety

Phase 9B-5 implements a fail-closed deletion safety check in `checkSongDeleteEligibility(id)`:
- Queries `public.songbook_songs` with `{ count: 'exact', head: true }`.
- If `count > 0`, deletion is **strictly blocked** with the message:
  `This song is assigned to N songbook(s). Remove its songbook associations before deleting the song.`
- **Compatibility Verification**: Verified that `checkSongDeleteEligibility` continues to block deletion for songs that have associations in `public.songbook_songs`.
- Songbook association additions immediately protect a song from deletion; removing all associations restores deletion eligibility (provided the song is not pinned).

---

## 6. Targeted Hardening: Inactive / Deprecated Songbook Association Protection

During evaluation of Phase 9B-6, a critical functional edge case was identified and resolved:
If `getAvailableSongbooks()` loads only active songbooks, existing associations to an inactive or deprecated songbook could be silently dropped from the UI state, causing them to be removed during reconciliation/save.

### Hardened Architecture & Protections

1. **Distinction Between Selectable List and Existing Associations**:
   - **Selectable/Available Songbooks**: Loaded from `getAvailableSongbooks()` (defaults to active songbooks: `is_active = true`).
   - **Existing Associations**: Authoritatively retrieved from `getSongbookAssociations(songId)` by joining `songbooks(id, slug, title, title_native, is_active, sort_order)`.
2. **Preservation of Inactive Associations in Editable State**:
   - `AdminSongbookManager.jsx` combines active songbooks with any existing associations for inactive/deprecated songbooks.
   - Inactive associations are **always** retained in `editableAssociations` upon initialization.
3. **Visual Distinction & Inactive Badge**:
   - Associated inactive songbooks are rendered with a prominent `[Inactive / Deprecated]` status badge.
   - The toggle button and card display visual indicator styling (red/rose accent).
   - Inactive songbooks that are **not** currently assigned are disabled from being newly selected (`disabled={isSaving || (!assigned && sb.is_active === false)}`).
4. **Zero Silent Dropping on Unchanged Save**:
   - Saving without making changes computes `toRemove` against the complete existing set. Because desired associations retain existing inactive associations, `toRemove` is empty.
   - Unchanged saves **never** remove an inactive association.
5. **Explicit Removal Remains Functional**:
   - Administrators can deliberately unassign an inactive songbook (via checkbox toggle or trash button). In that case, and only in that case, the association enters `toRemove` and is deleted from `public.songbook_songs`.
6. **Full-Junction Reconciliation**:
   - `reconcileSongbookAssociations` queries the actual junction table (`public.songbook_songs`) without filtering on `is_active`, ensuring reconciliation operates against the complete association set.
7. **Zero Writes to Forbidden Tables**:
   - Operations strictly target `public.songbook_songs`. No writes occur to `public.songs`, `songs.songbooks` JSONB, `public.songbooks`, or `public.pinned_songs`.

---

## 7. Verification & Test Results

A dedicated automated test suite was created and executed:
[`migration/phase-9/test_admin_songbook_associations.js`](file:///e:/WorkSpaceOne/Google/ChristianLyricsWeb/migration/phase-9/test_admin_songbook_associations.js)

### Test Results Summary

| Section | Tests | Status | Notes |
| :--- | :---: | :---: | :--- |
| **1. Service API Availability** | 6 | **PASS** | All 6 functions exported and typed |
| **2. Schema & Column Assumptions** | 3 | **PASS** | DDL verified; no auto-sync trigger exists |
| **3. Available Songbooks Loading** | 3 | **PASS** | Dynamically loaded 8 songbooks; ordered by `sort_order` |
| **4. Association Retrieval** | 3 | **PASS** | UUID validation; returned 2 associations for sample song |
| **5. Fail-Closed RLS Security** | 4 | **PASS** | Anon add, remove, reconcile, and update all denied under RLS |
| **6. Input Validation & Errors** | 5 | **PASS** | UUID, array validation; 23505 mapped to clear message |
| **7. Reconciliation & Partial Failure** | 3 | **PASS** | Difference calculation verified; no delete-all; partial failure tracking verified |
| **8. Zero Unrelated Mutations** | 3 | **PASS** | Zero writes to `songs`, zero writes to `songbooks` JSONB, zero writes to `pinned_songs` |
| **9. Deletion Compatibility** | 1 | **PASS** | Phase 9B-5 delete eligibility blocks songs with associations |
| **10. UI Component Integration** | 6 | **PASS** | Component exists, embedded in `AdminEditSong`, all buttons `type="button"`, dirty state & partial failure UI verified |
| **11. Security Hygiene Audit** | 1 | **PASS** | Zero `service_role`, `VITE_ADMIN_PASSWORD`, `jhf_is_admin`, or legacy API paths |
| **12. Production Catalog Integrity** | 4 | **PASS** | Counts verified unchanged (3,773 / 8 / 2,291 / 1) |
| **13. Targeted Hardening (A–F)** | 6 | **PASS** | Active load normal; inactive association retained in editable state; unchanged save preserves inactive; explicit remove works; count unchanged; zero forbidden writes |
| **14. Authenticated Runtime Test** | 1 | *SKIPPED* | Authenticated runtime mutation test skipped because no dedicated test-admin credentials are available in environment; strict rules protect production catalog |
| **TOTAL** | **49** | **48 PASS / 1 SKIPPED** | **48/49 PASS, 1 SKIPPED** |

> **Accurate Test Wording Notice**: 1 test was skipped because no dedicated test-admin account is configured in the development environment. In adherence to the strict non-destructive testing policy, no production records were mutated.

### Regressions Verified

| Suite | Result | Details |
| :--- | :---: | :--- |
| **Phase 9B-1 Admin Song Service** | **37/38 PASS** (1 skipped) | Service foundation & schema contract intact |
| **Phase 9B-2 Admin Song List** | **16/16 PASS** | Catalog review & filtering intact |
| **Phase 9B-3 Admin Create Song** | **34/35 PASS** (1 skipped) | Create song workflow intact |
| **Phase 9B-4 Admin Edit Song** | **34/35 PASS** (1 skipped) | Edit song workflow intact |
| **Phase 9B-5 Delete / Unpublish** | **37/38 PASS** (1 skipped) | Delete & unpublish workflows intact |
| **Phase 6 Read Cutover** | **24/24 PASS** | Public catalog queries and instant search intact |
| **Phase 8C Auth Foundation** | **18/18 PASS** | Supabase Auth client methods and validation intact |
| **Phase 8D Auth + RLS E2E** | **25/29 PASS** (4 skipped) | RLS policies and negative write tests intact |
| **Production Build (`vite build`)** | **PASS** | Built cleanly with 0 errors in 21.12s |
| **Security Scans (`src/` & `dist/`)** | **PASS** | 0 occurrences of `service_role`, `VITE_ADMIN_PASSWORD`, `jhf_is_admin`, `jhf_admin_changed` |

---

## 8. Production Catalog Counts Verification

Database row counts were verified before and after Phase 9B-6 implementation:

| Table | Required Baseline | Live Database Verified | Status |
| :--- | :---: | :---: | :---: |
| `public.songs` | 3,773 | **3,773** | Preserved |
| `public.songbooks` | 8 | **8** | Preserved |
| `public.songbook_songs` | 2,291 | **2,291** | Preserved |
| `public.pinned_songs` | 1 | **1** | Preserved |

> **Production Data Mutation Statement**: **Zero production records were mutated, inserted, or deleted during the execution of Phase 9B-6 implementation and verification tests.**

---

## 9. What Changed vs. What Was Not Changed

### What Changed
1. **`src/services/adminSongService.js`**:
   - `getAvailableSongbooks(options = {})`: Added options support (`options.includeInactive` or `options.onlyActive ?? true`) while defaulting to active-only for selection lists.
   - `getSongbookAssociations(songId)`: Joined `songbooks(id, slug, title, title_native, is_active, sort_order)` so each returned association includes the songbook's active status.
   - `reconcileSongbookAssociations(songId, desiredAssociations)`: Reconciles against the full junction table without filtering active/inactive status; preserves `song_number` when `desired.songNumber === undefined`.
   - `updateSongbookAssociations(songId, desiredSongbookIds)`: Exported helper for mass association updates with difference-based reconciliation.
2. **`src/components/admin/AdminSongbookManager.jsx`**:
   - Synthesizes extra inactive songbook entries into the component's available list if a song has existing associations with inactive songbooks, ensuring they are never silently omitted.
   - Renders a prominent `[Inactive / Deprecated]` status badge for inactive songbooks.
   - Prevents newly selecting inactive songbooks while permitting unassignment of existing ones.
   - Preserves inactive associations across edits when untouched.
   - Added explicit `type="button"` to all 6 buttons to eliminate accidental form submissions.
   - Added `onKeyDown` Enter-key suppression to song number input.
   - Added empty state indicator when no songbooks exist in the database.
3. **`src/components/admin/AdminEditSong.jsx`**:
   - Imported and embedded `AdminSongbookManager` as **Section H: Songbook Associations** in the edit hymn workflow.
4. **`migration/phase-9/test_admin_songbook_associations.js`**:
   - Added Section 13 (Targeted Hardening Tests A through F):
     - Test A: Active songbooks load normally without errors or inactive pollutions.
     - Test B: Existing inactive association is retained in editable state upon load.
     - Test C: Save with no changes does not remove existing inactive association (`toRemove` is empty).
     - Test D: Explicit removal of an inactive association correctly targets it for removal.
     - Test E: Existing association count remains exactly 2,291 during read-only verification.
     - Test F: Zero writes occur to `songs`, `songs.songbooks`, `songbooks`, or `pinned_songs`.
   - Updated report formatting to accurately state `48/49 PASS, 1 SKIPPED`.
5. **`migration/phase-9/test_admin_delete_unpublish.js`**:
   - Scoped `hasSbMutation` test to delete and unpublish functions, matching the pinned songs pattern in test N.
6. **`docs/PHASE_9B6_SONGBOOK_ASSOCIATIONS.md`**:
   - Created architectural documentation and updated with targeted hardening findings and test counts.

### What Was Not Changed
- No modifications to database schemas or migrations.
- No modifications to PostgreSQL RLS policies.
- No modifications to `public.songs` metadata columns from songbook operations.
- No writes to `songs.songbooks` JSONB compatibility column.
- No writes to `public.pinned_songs`.
- No modification of authentication architecture.
- No changes to public catalog repository (`catalogRepository.js`, `songRepository.js`).
- No redesign of the admin panel.
- Phase 9B-7 remains untouched and deferred.
