# Phase 9B-5 — Admin Delete / Unpublish Song

## 1. Overview & Objective

Phase 9B-5 implements the authoritative administrative **Unpublish** and **Delete** workflows for the *All Christian Songs* hymnal platform. These are deliberately separate operations with distinct safety profiles:

- **Unpublish**: Non-destructive state change (`is_published = false`). All song data, relationships, and metadata are preserved.
- **Delete**: Permanent, irreversible removal of a song record from `public.songs`. Requires explicit typed confirmation and passes a fail-closed eligibility check.

Architecture:

```
Authenticated Browser
  ↓
AuthContext (Session & Role UX Gate)
  ↓
adminSongService.unpublishSong(id)  /  adminSongService.deleteSong(id)
  ↓
Supabase Auth JWT
  ↓
PostgREST
  ↓
PostgreSQL Row Level Security (public.is_admin() / 42501 Gate)
  ↓
public.songs Table
```

### Strict Phase Boundaries
- **In Scope (Phase 9B-5)**: Unpublishing published songs, fail-closed relationship checking before deletion, typed "DELETE" confirmation, permanent deletion with result verification, cache invalidation, and data integrity validation.
- **Explicitly Deferred Functions**:
  - **Songbook Association Management (`songbook_songs`)**: Deferred to **Phase 9B-6** (Rule 21 & 27 strictly enforced)
  - **Full Security & CRUD Regression**: Deferred to **Phase 9B-7**

---

## 2. Component Structure & Architecture

### Services

1. **[`src/services/adminSongService.js`](file:///e:/WorkSpaceOne/Google/ChristianLyricsWeb/src/services/adminSongService.js)** *(EXTENDED)*

   Three new exported functions:

   - **`unpublishSong(id)`** (Line 682):
     - Requires valid UUID.
     - Executes a targeted `.update({ is_published: false })` against `public.songs`.
     - Alters **zero** other columns — title, slug, lyrics, categories, songbooks, timestamps, and all other metadata remain untouched.
     - Database trigger manages `updated_at`.
     - Invalidates in-memory caches (`invalidateCatalogCache()`, `invalidateSongCache(id)`, `invalidateSongCache(slug)`).
     - Returns `{ success, song, error }`.

   - **`checkSongDeleteEligibility(id, slug?)`** (Line 736):
     - **Fail-closed** read-only relationship inspector.
     - Fetches the song record to verify existence.
     - Queries `public.pinned_songs` — if the song is currently pinned for Today's Service, deletion is **blocked**.
     - Queries `public.songbook_songs` with `count: 'exact'` — if any songbook associations exist, deletion is **blocked**.
     - If any query errors, returns `canDelete: false` (fail-closed).
     - Returns `{ canDelete, isPinned, songbookCount, song, blockReason, error }`.

   - **`deleteSong(id)`** (Line 615):
     - Requires valid UUID.
     - Calls `checkSongDeleteEligibility(id)` before any destructive action.
     - If eligibility check fails or returns `canDelete: false`, deletion is blocked with a clear administrator message.
     - Executes `.delete().eq('id', id).select('id')` and **verifies the result** — if `deletedRows` is empty, the operation failed (likely RLS denial).
     - **Never** automatically deletes `pinned_songs` rows, `songbook_songs` rows, or mutates `songbooks` JSONB.
     - Invalidates in-memory caches only after confirmed database deletion.
     - Returns `{ success, error }`.

### UI Components

2. **[`src/components/admin/AdminSongList.jsx`](file:///e:/WorkSpaceOne/Google/ChristianLyricsWeb/src/components/admin/AdminSongList.jsx)** *(MODIFIED)*
   - **Unpublish Button**: Appears on published songs in both desktop table rows and mobile cards.
   - **Delete Button**: Appears on all songs in both desktop and mobile views.
   - **Unpublish Confirmation Modal**: Explains that song data is safely preserved, only visibility changes.
   - **Delete Confirmation Modal**: Displays relationship eligibility check results:
     - If pinned: shows clear "Remove the pin first" message.
     - If in songbooks: shows "Remove songbook associations first" message with count.
     - If eligible: requires typing **"DELETE"** to enable the permanent deletion button.
   - Both modals use distinct handlers (`handleOpenUnpublish`/`handleOpenDelete`, `handleCloseUnpublish`/`handleCloseDelete`, `handleConfirmUnpublish`/`handleConfirmDelete`).

---

## 3. Data Safety Architecture

### Unpublish vs. Delete: Distinct Operations

| Property | Unpublish | Delete |
| :--- | :--- | :--- |
| **Reversible** | ✅ Yes (re-publish via Edit) | ❌ No |
| **Data preserved** | ✅ All columns intact | ❌ Row removed |
| **Relationships preserved** | ✅ Pinned, songbooks untouched | ❌ Song record gone |
| **Confirmation required** | Simple modal confirmation | Typed "DELETE" confirmation |
| **Eligibility check** | None (always allowed) | Fail-closed relationship check |

### Fail-Closed Relationship Checking

Before any permanent deletion, the service performs two read-only queries:

1. **`public.pinned_songs`**: Checks if the song's UUID or slug appears in the pinned songs table.
   - If pinned → **BLOCKS DELETE** with message: *"This song is currently pinned for Today's Service. Remove the pin before deleting the song."*

2. **`public.songbook_songs`**: Counts associations by `song_id` using `{ count: 'exact', head: true }`.
   - If count > 0 → **BLOCKS DELETE** with message: *"This song is assigned to N songbook(s). Remove its songbook associations before deleting the song."*

3. **Query Errors**: Any error from either check returns `canDelete: false`. The system **never** assumes deletion is safe when relationship data is uncertain.

### Deletion Result Verification

After the `.delete()` call, the service checks `deletedRows`:
- If `deletedRows.length === 0`, the operation is treated as a failure (likely RLS denial or concurrent removal).
- The administrator receives a clear error instead of a false success.

### Live PostgreSQL Foreign Key Constraints

The following FK constraints exist in the live deployed database, verified against the authoritative migration DDL ([`002_song_schema.sql`](file:///e:/WorkSpaceOne/Google/ChristianLyricsWeb/supabase/migrations/002_song_schema.sql)):

#### `songbook_songs` → `songs`

| Property | Value |
| :--- | :--- |
| **Constraint Name** | `songbook_songs_song_id_fkey` (auto-generated) |
| **Child Table** | `public.songbook_songs` |
| **Child Column** | `song_id` |
| **Referenced Table** | `public.songs` |
| **Referenced Column** | `id` |
| **ON DELETE** | **CASCADE** |
| **DDL Source** | `002_song_schema.sql`, Line 321 |

> **⚠️ CRITICAL SAFETY IMPLICATION**: `ON DELETE CASCADE` means that if a song is deleted from `public.songs`, PostgreSQL will **automatically and silently delete all `songbook_songs` rows** referencing that `song_id`. This makes the `checkSongDeleteEligibility()` fail-closed check **essential** — without it, the CASCADE would silently destroy songbook association data when an admin deletes a song.

#### `pinned_songs` → `songs`

| Property | Value |
| :--- | :--- |
| **FK Constraint** | **NONE** |
| **Relationship Type** | Application-convention UUID match (denormalized snapshot) |
| **Child Table** | `public.pinned_songs` |
| **Child Column** | `id` (shares same UUID as `songs.id` by convention) |
| **ON DELETE** | **N/A** (no FK exists) |

`pinned_songs` is a pre-existing denormalized snapshot table with its own columns (`id`, `slug`, `title`, `title_transliterated`, `author`, `language`, `youtube_id`, `ppt_url`, `chords`, `pin_number`, `pinned_at`). No `CREATE TABLE` or `ALTER TABLE ... ADD CONSTRAINT` for this table exists in our migration files. If a song were deleted without the fail-closed check, the pinned row would become an **orphan** with stale denormalized data.

#### Delete Implementation Consistency

The current `deleteSong()` → `checkSongDeleteEligibility()` workflow is **consistent and safe** with the actual FK behavior:

1. **Songbook associations**: The fail-closed check blocks deletion when `songbook_songs` rows exist, preventing the `ON DELETE CASCADE` from silently destroying association data.
2. **Pinned songs**: The fail-closed check blocks deletion when the song appears in `pinned_songs`, preventing orphaned pin records.
3. **No workarounds**: The service never bypasses these checks. The administrator must manually remove relationships before deletion is permitted.

---

## 4. Zero-Mutation Safety Guarantees

The following mutations are **explicitly prohibited** in Phase 9B-5:

| Prohibited Mutation | Verification |
| :--- | :--- |
| Automatic `pinned_songs` deletion | No `.delete()` on `pinned_songs` in service or component |
| Automatic `songbook_songs` deletion | No `.delete()` on `songbook_songs` in service or component |
| `songbooks` JSONB column mutation | Column never referenced in unpublish or delete payloads |
| `songbook_songs` junction writes | Junction table is strictly read-only (count check only) |
| `pinned_songs` row writes | Pinned table is strictly read-only (existence check only) |

---

## 5. Cache Invalidation Architecture

Both `unpublishSong` and `deleteSong` invalidate in-memory caches upon successful operation:

1. `invalidateCatalogCache()`: Clears cached catalog index in `catalogRepository.js`.
2. `invalidateSongCache(id)`: Clears song cache by UUID in `songRepository.js`.
3. `invalidateSongCache(slug)`: Clears song cache by slug in `songRepository.js`.

---

## 6. Security & Authorization Audit

All Phase 8 and Phase 9 security constraints verified:

- **Zero Elevated Keys**: `service_role` has **0 matches** in `src/` and `dist/`.
- **Zero Passwords**: `VITE_ADMIN_PASSWORD` has **0 matches** in `src/` and `dist/`.
- **Zero Legacy Flags**: `jhf_is_admin` and `jhf_admin_changed` have **0 matches** in `src/` and `dist/`.
- **Zero Storage Bypasses**: No `localStorage` or `sessionStorage` role authorization.
- **Zero Legacy API Routes**: No `/api/admin`, `/api/publish`, `/api/pinned` references.
- **Zero Junction Writes**: No writes to `songbook_songs` (deferred to Phase 9B-6).
- **Zero Pinning Mutations**: No writes to `pinned_songs`.
- **Fail-Closed Verification**: Anonymous `deleteSong()` / `unpublishSong()` calls strictly reject under PostgreSQL Row Level Security (Error 42501).

---

## 7. Test Results

### Phase 9B-5 Dedicated Test Suite (`migration/phase-9/test_admin_delete_unpublish.js`)
```
============================================================
PHASE 9B-5: ADMIN DELETE / UNPUBLISH SONG VERIFICATION
============================================================
TOTAL CHECKS: 38
PASSED: 37
FAILED: 0
NOT EXECUTED: 1 (Authenticated runtime test skipped safely: no test admin account)
OVERALL STATUS: PASS
============================================================
```

### Test Coverage Summary

| Category | Tests | Status |
| :--- | :--- | :--- |
| A. Component Integration | 3 | ✅ PASS |
| B. Unpublish Service | 1 | ✅ PASS |
| C. Delete Service | 2 | ✅ PASS |
| D. Unpublish Payload Safety | 2 | ✅ PASS |
| E. Delete ID Validation | 3 | ✅ PASS |
| F–G. Relationship Checks | 1 | ✅ PASS |
| H. Pinned Song Blocking | 2 | ✅ PASS |
| I. Songbook Association Blocking | 2 | ✅ PASS |
| J–N. Zero-Mutation Safety | 5 | ✅ PASS |
| O. Confirmation UI | 1 | ✅ PASS |
| P. Typed DELETE Confirmation | 2 | ✅ PASS |
| Q. Unpublish Confirmation | 2 | ✅ PASS |
| R–V. Security & Containment | 5 | ✅ PASS |
| W. Cache Invalidation | 2 | ✅ PASS |
| X. Responsive UI | 1 | ✅ PASS |
| Database Data Integrity | 3 | ✅ PASS |
| Authenticated Runtime | 1 | ⏸️ NOT EXECUTED |

### Database Data Integrity (Post-Verification)
- Song count: **3,773** (zero songs accidentally deleted)
- Songbook associations: **2,291** (zero associations mutated)
- Pinned songs: **1** (zero pins mutated)

### Full Regression Suite Results
1. **Phase 9B-5 Admin Delete/Unpublish**: `37/37 PASS`, 1 skipped safely.
2. **Phase 9B-4 Admin Edit Song**: `34/34 PASS`, 1 skipped safely.
3. **Phase 9B-3 Admin Create Song**: `34/34 PASS`, 1 skipped safely.
4. **Phase 9B-2 Admin Song List**: `16/16 PASS`.
5. **Phase 9B-1 Admin Song Service**: `37/37 PASS`, 1 skipped safely.
6. **Phase 6 Read Cutover (Online)**: `24/24 PASS` (Catalog count: 3,773 songs).
7. **Phase 6 Read Cutover (Offline)**: `24/24 PASS` (Static fallback verified).
8. **Production Build (`npm run build`)**: `PASS`.
9. **Security Scans**: `0 matches` across `src/` and `dist/`.

---

## 8. Known Limitations & Deferred Work

- **Songbook Association Management (Phase 9B-6)**: Adding, removing, or re-ordering hymn associations in songbooks (`public.songbook_songs`) belongs exclusively to Phase 9B-6. Until then, songs with songbook associations cannot be deleted.
- **Concurrency Notice**: The relationship eligibility checks are client-side queries executed immediately before the DELETE statement. They do not provide atomic serializable isolation. PostgreSQL foreign key constraints and triggers remain the ultimate integrity boundary.
- **Static Fallback Regeneration**: Deletions and unpublishes persist immediately to the Supabase PostgreSQL database under RLS; offline static JSON fallback artifacts will reflect changes once static artifacts are regenerated in a deployment pipeline.
- **Authenticated Runtime Test**: Not executed due to absence of a dedicated test admin account. This is acceptable per project protocol.
