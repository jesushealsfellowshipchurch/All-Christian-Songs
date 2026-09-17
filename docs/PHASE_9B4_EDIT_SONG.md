# Phase 9B-4 — Admin Edit Song

## 1. Overview & Objective

Phase 9B-4 implements the authoritative administrative **Edit Song** workflow for the *All Christian Songs* hymnal platform. It establishes a secure, direct-Supabase hymn editing experience that strictly adheres to the live 22-column PostgreSQL database schema, while preserving all protected database fields and existing architectural boundaries:

```
Authenticated Browser
  ↓
AuthContext (Session & Role UX Gate)
  ↓
adminSongService.updateSong(songId, payload)
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
- **In Scope (Phase 9B-4)**: Opening an existing song by UUID/slug, loading its current database attributes, editing permitted fields, client-side pre-validation, live slug collision checking, stanza-preserving lyrics editing, category assignment, publication status toggle, unsaved changes detection, saving directly under RLS, and cache invalidation.
- **Explicitly Deferred Functions**:
  - **Create Song**: Completed in **Phase 9B-3**
  - **Edit Song**: Completed in **Phase 9B-4**
  - **Delete & Dedicated Unpublish**: Deferred to **Phase 9B-5**
  - **Songbook Association Management (`songbook_songs`)**: Deferred to **Phase 9B-6** (Rule 21 & 27 strictly enforced)
  - **Full Security & CRUD Regression**: Deferred to **Phase 9B-7**

---

## 2. Component Structure & Architecture

### Components & Services

1. **`src/components/admin/AdminEditSong.jsx`** *(NEW)*
   - Full 7-section administration workflow (A–G) mirroring the visual language of `AdminCreateSong.jsx`.
   - Styled using dark obsidian, warm amber/gold accents, and subtle glassmorphic styling.
   - Dual-mode responsiveness across desktop multi-column grids and mobile single-column layouts.
   - **UX Authorization Gating**: Displays auth loading spinner while session initializes, access required prompt if unauthenticated, and permission denied notice if `profile?.role !== 'admin'`.
   - **Load & Error Resilience**: Fetches full record via `getAdminSong(songId)` and categories via `fetchAvailableCategories()`. If load fails, renders clear error state with "Retry Loading" button rather than an unpopulated form.
   - **Unsaved Changes Guard**: Compares current form values against the initial record snapshot; prompts confirmation before navigating away if `isDirty` is true.

2. **`src/services/adminSongService.js`** *(HARDENED)*
   - **`EDITABLE_SONG_COLUMNS`**: Explicit whitelist of 18 permitted columns.
   - **`updateSong(id, songData)`**:
     - Requires valid UUID `id`.
     - Re-fetches previous song record to verify existence and capture previous slug.
     - Strips and ignores protected fields (`id`, `created_at`, `updated_at`, `songbooks`).
     - Never writes to `songbook_songs` or `pinned_songs`.
     - Executes update against `public.songs` under PostgreSQL RLS.
     - Invalidates in-memory public caches: `invalidateCatalogCache()`, `invalidateSongCache(id)`, `invalidateSongCache(oldSlug)`, and `invalidateSongCache(newSlug)`.
     - Returns `{ success: true, song: updatedSong, error: null }` or structured `{ success: false, song: null, error }`.

3. **`src/components/admin/AdminSongList.jsx`** *(MODIFIED)*
   - Wired Edit buttons on both desktop table rows and mobile cards to toggle into `AdminEditSong` via `editingSongId` state or external `onEditSong` prop.
   - Refreshes catalog and renders feedback notice upon successful song update.

---

## 3. Authoritative Schema & Field Whitelist

The live `public.songs` table has exactly 22 columns. The Edit workflow strictly partitions these into **18 Editable Columns** and **4 Protected/Immutable Columns**:

### 18 Editable Columns (`EDITABLE_SONG_COLUMNS`)
| Column | Type | Nullable / Default | Normalization & Validation |
| :--- | :--- | :--- | :--- |
| `slug` | `TEXT` | NOT NULL (UNIQUE) | Normalized via `slugify()`. Uniqueness enforced by PostgreSQL (23505 catch). |
| `title` | `TEXT` | NOT NULL | Required, whitespace trimmed. |
| `title_transliterated` | `TEXT` | Nullable | Trimmed or `null`. |
| `language` | `TEXT` | NOT NULL (FK) | Validated against `['telugu', 'english', 'hindi']`. |
| `alphabet` | `TEXT` | NOT NULL | Trimmed; auto-derived from title when requested. |
| `lyrics_original` | `TEXT[]` | NOT NULL | Stanza-preserving array with empty-string `""` boundaries. |
| `lyrics_transliterated` | `TEXT[]` | NOT NULL | Transliterated stanza-preserving array. |
| `youtube_id` | `TEXT` | Nullable | Clean 11-char video ID (extracted from URLs if pasted). |
| `chords` | `TEXT[]` | Nullable | Chord chart lines array. |
| `chord_count` | `INTEGER` | DEFAULT `0` | Calculated from non-empty chord lines. |
| `chord_credits` | `TEXT` | Nullable | Arranger / transcriber credit string. |
| `author_english` | `TEXT` | Nullable | English songwriter credit string. |
| `author_telugu` | `TEXT` | Nullable | Telugu songwriter credit string. |
| `category_names` | `TEXT[]` | NOT NULL DEFAULT `'{}'` | Thematic multi-select array from `public.categories`. |
| `ppt_url` | `TEXT` | Nullable | URL validated to begin with `http://` or `https://`. |
| `bible_verses` | `JSONB` | NOT NULL DEFAULT `'[]'` | Array of `{ reference, english, telugu }` objects. |
| `devotional` | `JSONB` | Nullable | Object of reflection & prayer strings, or `null`. |
| `is_published` | `BOOLEAN` | NOT NULL DEFAULT `true` | Explicit choice: Published (`true`) vs. Draft (`false`). |

### 4 Protected / Immutable Columns (Never Altered by Update)
| Protected Column | Protection Rationale & Guarantee |
| :--- | :--- |
| `id` | Immutable primary key. Never accepted in update payload. |
| `created_at` | Record creation timestamp. Owned by database default. |
| `updated_at` | Record modification timestamp. Owned exclusively by PostgreSQL trigger. |
| `songbooks` | **Rule 21 & 27 Safety Guarantee**: Relational songbook data is protected. `updateSong` never accepts or overwrites `songbooks` (e.g. with `[]`). Association management belongs to Phase 9B-6. |

---

## 4. Slug Uniqueness & Stanza Handling

### Slug Uniqueness Handling
- If the administrator modifies the song slug, a debounced check runs `checkSlugAvailability(slug)` to provide non-blocking UX feedback.
- If unchanged, the UI notes *"Current song slug"*.
- The PostgreSQL `UNIQUE` constraint is the final authority. On collision, PostgreSQL returns error code `23505`, which `formatAdminError` maps to:
  *"A song with this URL slug already exists. Please choose a different title or slug."*

### Lyrics & Stanza Separation
- The catalog convention of using empty strings `""` to separate stanzas is preserved.
- `normalizeLyricsArray()` preserves empty-string stanza boundaries when converting between multiline textarea strings and `TEXT[]` database arrays.

---

## 5. Cache Invalidation Architecture

To ensure congregants and administrators do not see stale song data after an update, `updateSong` invalidates in-memory caches across both repositories:
1. `invalidateCatalogCache()`: Clears cached catalog searches in `catalogRepository.js`.
2. `invalidateSongCache(id)`: Clears song cache by UUID in `songRepository.js`.
3. `invalidateSongCache(previousSong.slug)`: Clears old slug key if slug was modified.
4. `invalidateSongCache(updatedSong.slug)`: Clears new slug key.

---

## 6. Security & Authorization Audit

All Phase 8 and Phase 9 security constraints verified:
- **Zero Elevated Keys**: `service_role` has **0 matches** in `src/` and `dist/`.
- **Zero Passwords**: `VITE_ADMIN_PASSWORD` has **0 matches** in `src/` and `dist/`.
- **Zero Legacy Flags**: `jhf_is_admin` and `jhf_admin_changed` have **0 matches** in `src/` and `dist/`.
- **Zero Storage Bypasses**: No `localStorage` or `sessionStorage` role checks.
- **Zero Junction Writes**: No writes to `songbook_songs` (deferred to Phase 9B-6).
- **Zero Pinning Mutations**: No writes to `pinned_songs` (Rule 20).
- **Fail-Closed Verification**: Anonymous `updateSong()` call strictly rejects under PostgreSQL Row Level Security (Error 42501).

---

## 7. Test Results

### Phase 9B-4 Dedicated Test Suite (`migration/phase-9/test_admin_edit_song.js`)
```
============================================================
PHASE 9B-4: ADMIN EDIT SONG VERIFICATION
============================================================
TOTAL CHECKS: 35
PASSED: 34
FAILED: 0
NOT EXECUTED: 1 (Authenticated runtime test skipped safely: no test admin account)
OVERALL STATUS: PASS
============================================================
```

### Full Regression Suite Results
1. **Phase 9B-4 Admin Edit Song**: `34/34 PASS`, 1 skipped safely.
2. **Phase 9B-3 Admin Create Song**: `34/34 PASS`, 1 skipped safely.
3. **Phase 9B-2 Admin Song List**: `16/16 PASS`.
4. **Phase 9B-1 Admin Song Service**: `37/37 PASS`, 1 skipped safely.
5. **Phase 6 Online Read Cutover**: `24/24 PASS` (Catalog count: 3,773 songs).
6. **Phase 6 Offline Read Cutover**: `24/24 PASS` (Catalog count: 3,773 songs from static fallback).
7. **Production Build (`npm run build`)**: `PASS` (Clean build in 17.25s, zero errors).
8. **Security Scans**: `0 matches` across `src/` and `dist/`.

---

## 8. Known Limitations & Deferred Work

- **Delete & Dedicated Unpublish (Phase 9B-5)**: Deletion confirmation dialogs, cascade checks, and dedicated unpublish workflows belong to Phase 9B-5.
- **Songbook Association Management (Phase 9B-6)**: Adding, removing, or re-ordering hymn associations in songbooks (`public.songbook_songs`) belongs exclusively to Phase 9B-6.
- **Static Fallback Regeneration**: Edits persist immediately to the Supabase PostgreSQL database under RLS; offline static JSON fallback artifacts will reflect edits once static artifacts are regenerated in a deployment pipeline.
