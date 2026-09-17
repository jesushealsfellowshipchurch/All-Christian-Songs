# Phase 9B-3 — Admin Create Song

## 1. Overview & Objective

Phase 9B-3 implements the authoritative administrative **Create Song** workflow for the *All Christian Songs* hymnal platform. It establishes a secure, direct-Supabase hymn creation experience adhering strictly to the live 22-column PostgreSQL database schema, while preserving all existing architectural constraints:

```
Authenticated Browser
  ↓
AuthContext (Session & Role UX Gate)
  ↓
adminSongService.createSong() (22-Column Payload Whitelist)
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
- **In Scope (Phase 9B-3)**: Hymn record creation in `public.songs`, client-side pre-validation, live slug availability UX assistance, live category selection, stanza and chord preservation, and creation feedback UI.
- **Explicitly Deferred Functions**:
  - **Edit Song**: Deferred to **Phase 9B-4**
  - **Delete & Unpublish**: Deferred to **Phase 9B-5**
  - **Songbook Associations (`songbook_songs`)**: Deferred to **Phase 9B-6** (Rule 18 strictly enforced)
  - **Full Security & CRUD Regression**: Deferred to **Phase 9B-7**

---

## 2. Architecture & Component Structure

### Components & Services Added/Modified

1. **`src/components/admin/AdminCreateSong.jsx`** *(NEW)*
   - Production-quality hymn authoring interface divided into 7 logical sections (A–G).
   - Styled using dark obsidian and warm amber/gold aesthetic with subtle glassmorphic card containers.
   - Dual-mode responsiveness across desktop multi-column grids and mobile single-column layouts.
   - UX authorization gating: renders loading spinner while auth resolves, access required prompt if unauthenticated, and permission denied notice if `profile?.role !== 'admin'`.

2. **`src/services/adminSongService.js`** *(MODIFIED)*
   - **`checkSlugAvailability(slug)`**: Performs live lookup against `public.songs.slug` to assist administrators with real-time uniqueness feedback.
   - **`fetchAvailableCategories()`**: Reads active category descriptors from `public.categories` ordered by `sort_order` for dynamic category selection.
   - **`createSong(songData)`**: Hardened creation pipeline:
     - Whitelists only the exact 22 `public.songs` database columns.
     - Strictly enforces Rule 18: zero writes to `songbook_songs`.
     - Strictly enforces Rule 17: zero writes to `pinned_songs`.
     - Preserves empty-string stanza boundaries in `lyrics_original` and `lyrics_transliterated`.
     - Automatically derives `chord_count` from chord input lines.
     - Invalidates in-memory public catalog caches upon successful insert.
     - Returns `{ success: true, song }` or structured `{ success: false, error }`.

3. **`src/components/admin/AdminSongList.jsx`** *(MODIFIED)*
   - Added **[+ Add New Song]** button in the administration header.
   - Supports seamless creation mode toggle via internal state (`isCreating`) and external prop callback (`onCreateSong`).
   - Automatically refreshes the catalog table and displays feedback banner upon creation completion.

---

## 3. Authoritative Schema Mapping (22 Columns)

`AdminCreateSong.jsx` and `adminSongService.createSong()` map 1-to-1 with the live PostgreSQL `public.songs` schema. No invented CMS or legacy fields (`english_title`, `category`, `video_url`, `powerpoint_url`, `lyrics`, `author`) exist in the payload or service whitelist:

| Column | PostgreSQL Type | Nullable / Default | UI Component Section | Description & Normalization |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | Default `gen_random_uuid()` | Generated | Server-side UUID generation |
| `slug` | `TEXT` | NOT NULL (UNIQUE) | A. Basic Information | URL-safe slug with live uniqueness checking and fallback generation from title |
| `title` | `TEXT` | NOT NULL | A. Basic Information | Primary language title (Telugu/English/Hindi script) |
| `title_transliterated`| `TEXT` | Nullable | A. Basic Information | Romanized / English phonetic title |
| `language` | `TEXT` | NOT NULL (FK) | A. Basic Information | Language selection (`telugu`, `english`, `hindi`) |
| `alphabet` | `TEXT` | NOT NULL | A. Basic Information | Primary indexing letter (auto-derived or manually overridden) |
| `lyrics_original` | `TEXT[]` | NOT NULL DEFAULT `'{}'` | B. Lyrics | Stanza-preserving array of lines with `""` separators |
| `lyrics_transliterated`| `TEXT[]` | NOT NULL DEFAULT `'{}'` | B. Lyrics | Transliterated lyrics array (optional) |
| `youtube_id` | `TEXT` | Nullable | E. Media | Clean 11-character YouTube video ID (auto-extracted from URLs) |
| `chords` | `TEXT[]` | Nullable | E. Media | Array of chords and lyric lead lines |
| `chord_count` | `INTEGER` | DEFAULT `0` | E. Media | Auto-calculated count of unique non-empty chord entries |
| `chord_credits` | `TEXT` | Nullable | E. Media | Arranger / Transcriber credit attribution |
| `author_english` | `TEXT` | Nullable | C. Authors | Author name in English script |
| `author_telugu` | `TEXT` | Nullable | C. Authors | Author name in Telugu script |
| `category_names` | `TEXT[]` | NOT NULL DEFAULT `'{}'` | D. Categories | Multi-select array loaded from `public.categories` |
| `songbooks` | `JSONB` | NOT NULL DEFAULT `'[]'` | Deferred | Defaulted to empty array `[]` (Rule 18 compliance) |
| `ppt_url` | `TEXT` | Nullable | E. Media | Presentation URL (must start with `http://` or `https://`) |
| `bible_verses` | `JSONB` | NOT NULL DEFAULT `'[]'` | F. Bible / Devotional | Array of `{ reference, english, telugu }` objects |
| `devotional` | `JSONB` | Nullable | F. Bible / Devotional | Object containing `{ reflection_english, reflection_telugu, prayer_english, prayer_telugu }` |
| `is_published` | `BOOLEAN` | NOT NULL DEFAULT `true` | G. Publication | Explicit radio card selection: Live (`true`) or Draft (`false`) |
| `created_at` | `TIMESTAMPTZ` | DEFAULT `now()` | Managed by DB | Database timestamp trigger |
| `updated_at` | `TIMESTAMPTZ` | DEFAULT `now()` | Managed by DB | Database timestamp trigger |

---

## 4. Validation & Error Handling

### Client-Side Pre-Validation (`validateSongInput`)
- **Title**: Required, trimmed, reject empty/whitespace.
- **Slug**: Required, trimmed, normalized via `slugify()`, rejects invalid punctuation or non-URL-safe characters.
- **Language**: Must match one of `['telugu', 'english', 'hindi']`.
- **Alphabet**: Must not be empty; auto-derived via `deriveAlphabet(title, language)` when left blank.
- **Lyrics Original**: Must contain at least one non-empty stanza line; empty-string stanza breaks are preserved.
- **PowerPoint URL**: If provided, validated to begin with `http://` or `https://`.

### Live Slug Availability UX Check
- Debounced by 400ms on slug change.
- Invokes `checkSlugAvailability(slug)` to query `public.songs.slug`.
- Visual badges indicate:
  - 🟢 *Slug is available*
  - 🔴 *A song with this slug already exists in the catalog*
  - 🟡 *Checking slug...*
- Note displayed to user: *"Database UNIQUE constraint remains the authoritative boundary."*

### PostgreSQL Error Mapping (`formatAdminError`)
- **23505 (Unique Violation)**: *"A song with this URL slug already exists. Please choose a different title or slug."*
- **42501 (RLS Violation)**: *"Permission denied: Administrator privileges are required to perform this action."*
- **23503 (Foreign Key)**: *"Invalid reference: Selected language or record does not exist."*
- **401 (JWT Expired)**: *"Your session has expired. Please sign in again to continue."*
- **Network / Fetch Failure**: *"Unable to connect to the database. Please check your internet connection."*

---

## 5. Security & Containment Verification

All Phase 8 and Phase 9 security invariants were verified with zero violations:

1. **No Frontend Privileged Keys**:
   - `service_role` query in `src/` and `dist/`: **0 matches**.
2. **No Bundled Administrative Passwords**:
   - `VITE_ADMIN_PASSWORD` in `src/` and `dist/`: **0 matches**.
3. **No Legacy Client Admin Flags**:
   - `jhf_is_admin` and `jhf_admin_changed` in `src/` and `dist/`: **0 matches**.
4. **No Storage Authorization Bypass**:
   - Zero reads/writes to `localStorage` or `sessionStorage` for role authorization.
5. **No Legacy API Routes**:
   - Zero requests to `/api/publish-song`, `/api/pinned-songs`, or serverless functions.
6. **No Junction Writes (Rule 18)**:
   - `songbook_songs` mutations are strictly barred from the creation flow.
7. **No Pinning Mutations (Rule 17)**:
   - `pinned_songs` mutations are strictly barred from the creation flow.

---

## 6. Test Results

### Phase 9B-3 Dedicated Test Suite (`migration/phase-9/test_admin_create_song.js`)
```
============================================================
PHASE 9B-3: ADMIN CREATE SONG VERIFICATION
============================================================
TOTAL CHECKS: 35
PASSED: 34
FAILED: 0
NOT EXECUTED: 1 (Authenticated runtime test skipped safely: no test admin account)
OVERALL STATUS: PASS
============================================================
```

### Full Regression Test Summary
1. **Phase 9B-3 Create Song Suite**: `34/34 PASS`, 1 skipped safely.
2. **Phase 9B-2 Admin Song List Suite**: `16/16 PASS`.
3. **Phase 9B-1 Admin Song Service Suite**: `37/37 PASS`, 1 skipped safely.
4. **Phase 6 Online Read Cutover**: `24/24 PASS` (Count: 3773 songs).
5. **Phase 6 Offline Read Cutover**: `24/24 PASS` (Count: 3773 songs from static fallback).
6. **Production Build (`npm run build`)**: `PASS` (Clean build in 17.60s, zero errors).
7. **Security Scans**: `0 matches` across `src/` and `dist/`.

---

## 7. Known Limitations & Deferred Functionality

- **Edit Song (Phase 9B-4)**: The edit modal/form and `updateSong` UI flows are intentionally not implemented in this phase.
- **Delete / Unpublish (Phase 9B-5)**: Deletion confirmation dialogs and unpublishing mutations are intentionally not implemented in this phase.
- **Songbook Associations (Phase 9B-6)**: Hymn association management to songbooks (`public.songbook_songs`) is explicitly deferred to Phase 9B-6. New hymns are created with `songbooks: []`.
- **Static Fallback Delay**: Newly created songs are written immediately to PostgreSQL under RLS; they will not appear in the static `christian_songs_complete_catalog.json` fallback until static catalog artifacts are regenerated.
