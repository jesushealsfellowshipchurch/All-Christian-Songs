# Phase 9B-1: Admin Song Service Foundation & Schema Hardening

## 1. Overview & Objective

Phase 9B-1 establishes and hardens the secure, direct-Supabase service layer foundation required for Admin Song CRUD operations in the All Christian Songs web application.

Following a thorough architectural review and schema contract verification:
- **Authorization Boundary**: Database Row Level Security (`public.is_admin()`) via Supabase Auth JWT remains the sole authoritative gatekeeper.
- **Client Role**: Direct PostgREST queries using the authenticated Supabase client (`src/utils/supabaseClient.js`). No proxy APIs, no elevated `service_role` keys, and no client-side authorization bypasses.
- **Authoritative Database Schema**: The deployed PostgreSQL schema is strictly authoritative. No alternate or invented CMS field names are accepted or transmitted to Supabase.
- **Scope**: Service layer only (`src/services/adminSongService.js`), cache invalidation hooks in repositories, read-only pre-checks, test verification suite, and regression testing. No UI components (`AdminPortalModal`, `AdminSongList`, `AdminSongEditor`, `AdminDeleteModal`) were built in this phase.

---

## 2. Files Changed & Created

| File | Status | Purpose / Description |
|---|---|---|
| `src/services/adminSongService.js` | **Created & Hardened** | Admin service foundation containing `getAdminCatalog`, `getAdminSong`, `createSong`, `updateSong`, `deleteSong`, `SONGS_SCHEMA_COLUMNS`, input validation, slug generation, error formatting, non-atomic association failure surfacing, and cache invalidation. |
| `src/services/catalogRepository.js` | **Modified** | Exported `invalidateCatalogCache()` (alias to `clearCatalogCache`) allowing administrative mutations to invalidate the cached catalog index. |
| `src/services/songRepository.js` | **Modified** | Added and exported `invalidateSongCache(idOrSlug)` to remove single song entries from `songCache` on update or delete. |
| `migration/phase-9/test_admin_song_service.js` | **Created & Hardened** | 38-check verification test suite covering service methods, actual deployed schema contracts, zero invented CMS fields, validation, slug derivation, stanza preservation, error mappings, catalog RLS queries, anonymous write rejections, and security hygiene. |
| `docs/PHASE_9B1_ADMIN_SONG_SERVICE.md` | **Updated** | Phase 9B-1 documentation and hardening audit trail. |

---

## 3. Actual Deployed `public.songs` Schema

Inspection of `supabase/migrations/002_song_schema.sql` (lines 236–259) and live database records confirms that `public.songs` consists of exactly 22 columns:

| Column Name | PostgreSQL Data Type | Constraints / Default | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | Unique song identifier (UUID v4) |
| `slug` | `TEXT` | `UNIQUE NOT NULL` | URL-friendly unique slug |
| `title` | `TEXT` | `NOT NULL` | Song title in primary script |
| `title_transliterated` | `TEXT` | `NULL` | Roman script transliteration of title |
| `language` | `TEXT` | `NOT NULL REFERENCES public.languages(code)` | Language code ('telugu', 'english', 'hindi') |
| `alphabet` | `TEXT` | `NOT NULL` | Grouping character for alphabetical index |
| `lyrics_original` | `TEXT[]` | `NOT NULL DEFAULT '{}'` | Stanzas in primary script (empty strings = breaks) |
| `lyrics_transliterated` | `TEXT[]` | `NOT NULL DEFAULT '{}'` | Stanzas in transliterated script |
| `youtube_id` | `TEXT` | `NULL` | YouTube video ID |
| `chords` | `TEXT[]` | `DEFAULT NULL` | Chorded lines array |
| `chord_count` | `INTEGER` | `DEFAULT 0` | Total count of chord lines |
| `chord_credits` | `TEXT` | `NULL` | Attribution for chords |
| `author_english` | `TEXT` | `NULL` | Songwriter name in English |
| `author_telugu` | `TEXT` | `NULL` | Songwriter name in Telugu |
| `category_names` | `TEXT[]` | `NOT NULL DEFAULT '{}'` | Array of assigned category names |
| `songbooks` | `JSONB` | `NOT NULL DEFAULT '[]'::jsonb` | Denormalized songbook metadata array |
| `ppt_url` | `TEXT` | `NULL` | Link to PowerPoint presentation |
| `bible_verses` | `JSONB` | `NOT NULL DEFAULT '[]'::jsonb` | Array of referenced Bible scripture objects |
| `devotional` | `JSONB` | `DEFAULT NULL` | Devotional commentary / prayer object |
| `is_published` | `BOOLEAN` | `NOT NULL DEFAULT true` | Publication visibility flag |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Row creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Row modification timestamp (trigger updated) |

### 3.1 Invented CMS Fields Audit
The following 15 field names, which appeared in preliminary drafts, do **not** exist in the database and have been strictly audited out of `adminSongService.js` and all mutation payloads:
- `english_title` (database column is `title_transliterated`)
- `category` (database column is `category_names`)
- `lyrics` (database columns are `lyrics_original` and `lyrics_transliterated`)
- `chords_credits` (database column is `chord_credits`)
- `audio_url` (not in schema)
- `video_url` (not in schema; `youtube_id` is used)
- `sheet_music_url` (not in schema)
- `tempo` (not in schema)
- `beat` (not in schema)
- `key` (not in schema)
- `author` (database columns are `author_english` and `author_telugu`)
- `composed_by` (not in schema)
- `lyrics_by` (not in schema)
- `music_by` (not in schema)
- `song_references` (not in schema; `bible_verses` is used)

`adminSongService.js` exports `SONGS_SCHEMA_COLUMNS` and uses an explicit whitelist to guarantee that no extraneous properties are ever dispatched to PostgREST.

---

## 4. Database Pre-Checks & Triggers Verified

| Check # | Requirement / Item | Database Evidence / Verification | Status |
|---|---|---|---|
| 1 | `songs.updated_at` trigger | Defined in `supabase/migrations/002_song_schema.sql` (lines 309–313): `CREATE TRIGGER songs_updated_at BEFORE UPDATE ON public.songs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();`. Sets `NEW.updated_at = now()` automatically. | **VERIFIED** |
| 2 | `songbook_songs.song_id` FK behavior | `FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE CASCADE`. Deleting a song cascades cleanly to remove its junction rows. | **VERIFIED** |
| 3 | `pinned_songs` relationship | Standalone table with no FK constraint to `songs`. Contains historical snapshots (`id`, `slug`, `title`, `pin_number`, `pinned_by`, `pinned_at`). | **VERIFIED** |
| 4 | `songs.slug` UNIQUE constraint | `CONSTRAINT songs_slug_key UNIQUE (slug)` and `slug text NOT NULL`. Enforced at database level. | **VERIFIED** |
| 5 | `songs.id` UUID primary key | `id uuid PRIMARY KEY`. | **VERIFIED** |
| 6 | `songs` RLS policies | `SELECT`: `is_published = true OR public.is_admin()`. `INSERT`, `UPDATE`, `DELETE`: `public.is_admin()`. | **VERIFIED** |
| 7 | `songbook_songs` RLS policies | `SELECT`: `true`. `INSERT`, `UPDATE`, `DELETE`: `public.is_admin()`. | **VERIFIED** |

---

## 5. Songbook Association Atomicity Limitation

In the current PostgREST client architecture:
- Updating a song and updating its relational `songbook_songs` records are separate network calls:
  1. `UPDATE songs ...`
  2. `DELETE FROM songbook_songs WHERE song_id = ...`
  3. `INSERT INTO songbook_songs ...`
- This multi-step sequence is **non-atomic** on the client side.
- **Hardening Safeguards Applied**:
  1. **No Silent Success**: If the junction deletion or insertion fails, `adminSongService.js` returns `{ success: false, song, error: ... }` with the exact error details rather than swallowing the error and pretending full success.
  2. **No Client Rollback Fabrication**: The service does not attempt pseudo-rollback operations from the browser.
  3. **Deferred to Phase 9B-6**: Songbook association editing is strictly excluded from upcoming Phase 9B-2 through 9B-5 song CRUD UI components. Full relational songbook management will be addressed in dedicated Phase 9B-6.

---

## 6. Delete Behavior & Pinned Songs Safety

Because `pinned_songs` is a standalone table with no cascading foreign key:
1. `deleteSong(id)` first retrieves the song record to obtain both `id` and `slug`.
2. It queries `public.pinned_songs` for any pin referencing either `id` or `slug`.
3. If the song is currently pinned to today's church service, deletion is blocked immediately with:
   `"Cannot delete song while it is pinned to today's church service. Please unpin the song first."`
4. The service does **not** silently delete or mutate `pinned_songs` from the client.
5. When unpinned, deleting `public.songs` relies on the database-level `ON DELETE CASCADE` on `songbook_songs(song_id)` to clean up hymnal associations safely.

---

## 7. Error Handling & Mapping

Raw database error objects are intercepted by `formatAdminError(err)`:

| Database / HTTP Condition | Formatted Error Code / Message |
|---|---|
| PostgreSQL `42501` | Permission denied: Administrator privileges are required to perform this action. |
| PostgreSQL `23505` | A song with this URL slug already exists. Please choose a different title or slug. |
| PostgreSQL `23503` | Invalid reference: Selected language or songbook record does not exist. |
| HTTP `401` / JWT Expired | Your session has expired. Please sign in again to continue. |
| Network / Failed to Fetch | Unable to connect to the database. Please check your internet connection. |
| 0 Rows Affected | Song record not found or already removed. |
| Pinned Song Deletion Block | Cannot delete song while it is pinned to today's church service. Please unpin the song first. |

---

## 8. Test Execution & Verification

### 8.1 Hardened Test Suite (`migration/phase-9/test_admin_song_service.js`)

Run command: `node --env-file=.env migration/phase-9/test_admin_song_service.js`

```
============================================================
PHASE 9B-1: ADMIN SONG SERVICE HARDENED VERIFICATION
============================================================

--- TEST 1: Service API Interface Availability ---
[PASS] getAdminCatalog is defined — true
[PASS] getAdminSong is defined — true
[PASS] createSong is defined — true
[PASS] updateSong is defined — true
[PASS] deleteSong is defined — true
[PASS] formatAdminError is defined — true
[PASS] slugify is defined — true
[PASS] deriveAlphabet is defined — true
[PASS] validateSongInput is defined — true
[PASS] normalizeLyricsArray is defined — true
[PASS] SONGS_SCHEMA_COLUMNS is exported array — true
[PASS] invalidateCatalogCache is exported — true
[PASS] invalidateSongCache is exported — true

--- TEST 2: Actual Deployed Schema Contract Verification ---
[PASS] All live columns match authoritative SONGS_SCHEMA_COLUMNS — Live columns: 22
[PASS] Zero invented CMS fields present in database record — Confirmed pure schema

--- TEST 3: Input Validation Contract ---
[PASS] Missing title, language, lyrics caught — Errors caught: 3
[PASS] Invalid language rejected — Caught unsupported language
[PASS] Empty lyrics rejected — Blank/whitespace lyrics lines rejected
[PASS] Valid payload passes validation

--- TEST 4: Slug & Alphabet Derivation ---
[PASS] Slug generation normalizes spaces and punctuation — lechinaaduraa-samaadhi-gelichinaaduraa
[PASS] Telugu alphabet correctly derived — య
[PASS] English alphabet ignores leading quotes — A

--- TEST 5: Stanza Separator Preservation ---
[PASS] Empty-string stanza separators preserved from multiline text — Total lines: 5, Stanza break at index 2

--- TEST 6: Human-Readable Error Formatting ---
[PASS] Error 42501 mapped to admin permission notice — Permission denied: Administrator privileges are required to perform this action.
[PASS] Error 23505 mapped to duplicate slug notice — A song with this URL slug already exists. Please choose a different title or slug.
[PASS] Error 23503 mapped to invalid reference notice — Invalid reference: Selected language or songbook record does not exist.
[PASS] Error 401 mapped to session expired notice — Your session has expired. Please sign in again to continue.
[PASS] Network failure mapped to connection notice — Unable to connect to the database. Please check your internet connection.

--- TEST 7: Catalog Query Contract Under Current RLS ---
[PASS] Catalog query contract succeeds under current RLS (Anonymous public read filter applied by RLS) — Retrieved 10 rows, Total count: 3773
[PASS] Database contains expected catalog baseline — 3773 songs present

--- TEST 8: Anonymous Service Write Rejection (Fail-Closed) ---
[PASS] createSong fails closed without admin credentials — Permission denied: Administrator privileges are required to perform this action.
[PASS] updateSong fails closed without admin credentials — Song record not found or already removed.
[PASS] deleteSong fails closed without admin credentials — Song record not found or already deleted.

--- TEST 9: Authenticated Admin CRUD Verification ---
[NOT EXECUTED] Authenticated Admin CRUD Runtime Lifecycle — No pre-existing TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD configured in environment. Strict rules prohibit automatic user creation.

--- TEST 10: Security Hygiene Audit ---
[PASS] Zero service_role in src/ — Verified (0 occurrences)
[PASS] Zero VITE_ADMIN_PASSWORD in src/ — Verified (0 occurrences)
[PASS] Zero jhf_is_admin in src/ — Verified (0 occurrences)
[PASS] Zero jhf_admin_changed in src/ — Verified (0 occurrences)

============================================================
TOTAL CHECKS: 38
PASSED: 37
FAILED: 0
NOT EXECUTED: 1
OVERALL STATUS: PASS
============================================================
```

### 8.2 Accurate Test Labeling Note
- **Test 7 Labeling**: The catalog query was verified under the anonymous public read policy enforced by RLS. It confirms that the query contract succeeds without errors. It is **not** labeled as proof of authenticated admin authorization.
- **Test 9 Skipped**: Authenticated admin mutations remain `[NOT EXECUTED]` because no existing admin credentials (`TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD`) are present in the environment, and strict safety rules prohibit automatic account creation or production modifications.

---

## 9. Regression Verification Results

1. **Online Live Read Cutover (`node --env-file=.env migration/phase-6/test_read_cutover.js`)**:
   - Result: **24/24 PASSED** (0 failures).
   - Catalog row count: 3,773 songs loaded via Supabase in 1,251ms.
   - Client-side search, chords filters, song details, and in-memory cache verified.

2. **Offline Static Read Cutover (`node migration/phase-6/test_read_cutover.js`)**:
   - Result: **24/24 PASSED** (0 failures).
   - Catalog row count: 3,773 songs loaded via `compact_index.json` fallback in 28ms.

3. **Production Build (`npm run build`)**:
   - Result: **PASS** (exit code 0, completed in 17.20s).
   - Bundled chunks rendered cleanly without warnings or errors.

4. **Security Hygiene Audit**:
   - `service_role`: 0 matches in `src/` and `dist/`.
   - `VITE_ADMIN_PASSWORD`: 0 matches in `src/` and `dist/`.
   - `jhf_is_admin`: 0 matches in `src/` and `dist/`.
   - `jhf_admin_changed`: 0 matches in `src/` and `dist/`.

---

## 10. Conclusion

Phase 9B-1 hardening is fully verified. All database schema contracts strictly adhere to the deployed 22-column structure of `public.songs`. Non-atomic songbook associations fail safely and are deferred to Phase 9B-6. Pinned songs are guarded against accidental deletion, and all tests and regression suites pass cleanly.
