# Phase 9A — Admin Song CRUD Architecture & Authorization Design

**Date:** September 17, 2026  
**Status:** COMPLETED (Design Only)  
**Overall Result:** **PHASE 9A RESULT: PASS**

---

## 1. Objective

The objective of **Phase 9A** is to design a secure, minimal, robust, and maintainable architecture for **Admin Song CRUD** (Create, Read, Update, Delete) for *All Christian Songs*.

### Architectural Tenets:
1. **Design / Review Only**: Zero application code changes, zero database schema changes, zero RLS changes, and zero data mutations in this phase.
2. **PostgreSQL RLS as the Sole Authorization Authority**: Client-side UI states, React context, and storage keys must never serve as authorization boundaries. All write permissions originate from and are enforced by PostgreSQL Row Level Security (RLS) via `public.is_admin()`.
3. **Zero Secret Leakage**: The client remains strictly a public anonymous client with user JWTs. No `service_role` key shall ever be exposed to the browser or bundled in frontend assets.
4. **Preserve Public Website Stability**: Public catalog browsing, in-memory instant search, chord transposition, presentation generation, songbooks, and offline static fallbacks must remain completely uninterrupted.
5. **Simplicity Over Complexity**: Avoid over-engineering a heavy CMS. Provide a streamlined, focused management experience for hymns and their metadata.

---

## 2. Current Architecture Baseline

The database and application foundation established across Phases 0 through 8D is structured as follows:

```
┌────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                  │
├───────────────────┬────────────────────────────────────┤
│ Table             │ RLS Status & Access Policy         │
├───────────────────┼────────────────────────────────────┤
│ public.songs      │ ENABLED: Public SELECT (published) │
│                   │ Admin-only INSERT, UPDATE, DELETE  │
├───────────────────┼────────────────────────────────────┤
│ public.songbook_  │ ENABLED: Public SELECT             │
│ songs             │ Admin-only ALL writes (is_admin()) │
├───────────────────┼────────────────────────────────────┤
│ public.pinned_    │ ENABLED (FORCED): Public SELECT    │
│ songs             │ Admin-only INSERT, UPDATE, DELETE  │
├───────────────────┼────────────────────────────────────┤
│ public.languages  │ ENABLED: Public SELECT             │
│                   │ Admin-only ALL writes              │
├───────────────────┼────────────────────────────────────┤
│ public.categories │ ENABLED: Public SELECT             │
│                   │ Admin-only ALL writes              │
├───────────────────┼────────────────────────────────────┤
│ public.songbooks  │ ENABLED: Public SELECT             │
│                   │ Admin-only ALL writes              │
├───────────────────┼────────────────────────────────────┤
│ public.profiles   │ ENABLED (FORCED): Own or Admin     │
│                   │ Role escalation blocked by trigger │
└───────────────────┴────────────────────────────────────┘
```

### Authorization Function:
```sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;
```

---

## 3. End-to-End Authorization Flow

Every administrative write operation follows a strict, unidirectional cryptographic authorization flow:

```
[ Administrator in Browser ]
            │
            ▼
 1. React UI Action (e.g. "Save Song")
            │
            ▼
 2. Supabase Auth Session (Retrieves active user JWT access token)
            │
            ▼
 3. HTTPS REST Request to PostgREST with Header:
    Authorization: Bearer <JWT>
            │
            ▼
 4. Supabase PostgREST Gateway
    - Validates JWT signature cryptographically against Supabase Auth secret
    - Extracts 'sub' claim and sets PostgreSQL session context: auth.uid()
            │
            ▼
 5. PostgreSQL Query Execution (under role 'authenticated')
            │
            ▼
 6. PostgreSQL Row Level Security (RLS) Engine
    - Evaluates table policy: WITH CHECK (public.is_admin()) / USING (public.is_admin())
            │
            ▼
 7. public.is_admin() Execution
    - Executes with SECURITY DEFINER and empty search_path
    - Checks: public.profiles.id = auth.uid() AND public.profiles.role = 'admin'
            │
    ┌───────┴───────┐
    ▼               ▼
 [ ALLOW ]      [ DENY ]
 Commits        Rejects with PostgreSQL Error 42501
 Returns row    Rolls back transaction; 0 rows modified
```

### Why Frontend Role Display is NOT Security
- Client memory (React state, variables, DOM nodes) is entirely under the visitor's local control via browser developer tools.
- An attacker can easily execute `isAdmin = true` in the React console or forge local storage values.
- However, when the client sends a request to Supabase, PostgREST and PostgreSQL do **not** inspect React state. They inspect the cryptographically signed JWT and query `public.profiles` in the database.
- If the caller's JWT does not map to an authentic `admin` record in `public.profiles`, the database aborts the transaction immediately with code `42501`.

### Behavior Under Attack Scenarios

| Attack / Tampering Attempt | Client State | Database Evaluation | Result |
|----------------------------|--------------|---------------------|--------|
| User tampers React state (`isAdmin = true`) | UI reveals admin buttons | PostgreSQL evaluates JWT; `is_admin() = false` | **DENIED** (42501 Unauthorized) |
| User tampers localStorage JWT | Invalid token string | Supabase gateway fails signature validation | **DENIED** (401 Unauthorized) |
| User executes direct PostgREST `fetch()` | Custom payload sent | PostgREST passes JWT to RLS; `is_admin() = false` | **DENIED** (42501 Unauthorized) |
| Non-admin attempts to edit another song | Custom song UUID in URL | RLS `USING (public.is_admin())` evaluates to false | **DENIED** (0 rows updated) |
| Tampered `is_published` parameter | Set to false or true | Evaluated under `songs_update_admin` policy | **DENIED** if not admin |
| Non-admin executes `DELETE /rest/v1/songs` | Delete request sent | RLS `USING (public.is_admin())` evaluates to false | **DENIED** (0 rows deleted) |

---

## 4. Role Model & Editor Role Decision

### 4.1 Schema Investigation
An inspection of the live PostgreSQL migration files (`001_security_foundation.sql` and `003_security_hardening.sql`) reveals:
1. `public.profiles` table constraint:
   ```sql
   role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin'))
   ```
2. Database helper function `public.is_admin()` strictly tests:
   ```sql
   role = 'admin'
   ```
3. Zero database policies or functions exist for an `'editor'` role.
4. Attempting to insert or assign `role = 'editor'` in the database will violate the `CHECK` constraint and fail immediately.

### 4.2 Architectural Decision
- **Phase 9 will strictly implement a two-role model**:
  - **`user`**: Default role for any registered or anonymous visitor. Read-only access to published songs, categories, songbooks, and pinned hymns. Zero write/mutation access to catalog data.
  - **`admin`**: Verified administrator. Full song CRUD, publishing control, and songbook association management.
- **The `'editor'` role will remain completely unused and unreferenced** in Phase 9. No database changes or policy alterations will be made. If editor semantics are required in the future, they will be introduced through a dedicated migration phase.

---

## 5. Scope of Admin Song CRUD

The Phase 9 CRUD scope is deliberately focused on the core operational needs of hymnal administration:

### Included in Scope (Phase 9):
1. **View Songs**: Paginated, sortable, and filterable administrative data view showing both published and unpublished hymns.
2. **Search & Filter**: Search by title, author, transliteration, language (`telugu`, `english`, `hindi`), category, chords presence, and publication status.
3. **Create Song**: Full form to enter a new hymn with auto-transliteration, category tags, chord lines, songbook associations, and media links.
4. **Edit Song**: Modification of existing song lyrics, chords, metadata, publication status, and songbook assignments.
5. **Delete / Unpublish Song**:
   - Soft unpublish toggle (`is_published = false`) to instantly remove from public catalog while preserving history.
   - Permanent hard delete with cascade awareness and explicit two-step confirmation.
6. **Songbook Associations**: Assign or update song numbers within any of the 8 official hymnals.

### Explicitly Excluded from Scope (Non-Goals):
- **NO** Songbook CRUD (creating or deleting songbooks; the 8 hymnals are canonical).
- **NO** Category CRUD (categories table remains static).
- **NO** Language CRUD (languages table remains static).
- **NO** User management / user invitation UI.
- **NO** User song submission / review workflow.
- **NO** Direct binary file upload to storage buckets (PPT files continue using existing storage URLs).
- **NO** Bulk CSV/JSON import/export in the browser.

---

## 6. Song CRUD Operation Contract

### 6.1 CREATE Operation
- **Primary Key**: UUID v4 generated on the client via `crypto.randomUUID()` to preserve the existing catalog design where each song possesses a permanent UUID.
- **Slug Generation**:
  - Derived from `title_transliterated` (for Telugu/Hindi) or `title` (for English).
  - Cleaned to lowercase alphanumeric characters separated by hyphens (e.g., `lechinaaduraa-samaadhi-gelichinaaduraa`).
  - **Collision Prevention**: Before insert, verify slug uniqueness via `maybeSingle()`. If collision occurs, append a short numeric suffix (e.g., `-2`).
- **Required Fields**:
  - `id` (UUID v4)
  - `slug` (text, unique)
  - `title` (text, non-empty, trimmed)
  - `language` (text, must match `languages.code`: `'telugu'`, `'english'`, or `'hindi'`)
  - `alphabet` (character; automatically calculated from first character of title)
  - `lyrics_original` (array of text lines; must contain at least one non-empty stanza)
- **Optional Fields**:
  - `title_transliterated` (text; auto-populated via `TransliteratorService` if empty)
  - `lyrics_transliterated` (array of text lines; auto-transliterated if empty)
  - `youtube_id` (11-character YouTube video ID or null)
  - `chords` (array of chord lines or null)
  - `chord_count` (integer; calculated from chords array)
  - `chord_credits` (text attribution or null)
  - `author_english` (text or null)
  - `author_telugu` (text or null)
  - `category_names` (array of text category strings)
  - `songbooks` (denormalized JSONB array for read compatibility)
  - `ppt_url` (valid URL string or null)
  - `bible_verses` (JSONB array of `{ reference, text }`)
  - `devotional` (JSONB object `{ thought, prayer, author }` or null)
  - `is_published` (boolean, defaults to `true`)
- **Stanza Separators**:
  - Empty string array items `""` inside `lyrics_original` and `lyrics_transliterated` represent stanza separators and **must be preserved** during parsing and serialization.
- **Relational Integrity**:
  - Song row inserted into `public.songs`.
  - Concurrently or immediately sequentially, associated hymnal entries are inserted into `public.songbook_songs`.

### 6.2 UPDATE Operation
- **Immutable Fields**:
  - `id` (UUID primary key is strictly immutable).
  - `created_at` (original creation timestamp).
- **Mutable Fields**:
  - All content, metadata, media, chords, and categorization fields.
  - `is_published` publication status toggle.
- **Slug Mutability Guidelines**:
  - Slugs should be preserved whenever possible to avoid breaking public URLs, bookmarks, and search engine indexes.
  - If title is changed substantially, admin may optionally request a slug update with collision checking.
- **Timestamp Tracking**:
  - `updated_at` is automatically updated to `now()` by PostgreSQL trigger `songs_updated_at`.
- **Relational Reconciliation**:
  - Any modifications to songbook assignments synchronize `public.songbook_songs` (insert newly added, delete removed, update changed song numbers) and update the denormalized `songs.songbooks` JSONB array.

### 6.3 DELETE Operation
- **Two-Tier Deletion Strategy**:
  1. **Tier 1: Soft Unpublish (`is_published = false`) — Recommended Default**:
     - Song is immediately excluded from the public catalog (`songs_select_public` requires `is_published = true`).
     - Song record and songbook relationships remain intact in the database for easy restoration.
  2. **Tier 2: Permanent Hard Delete (`DELETE FROM public.songs WHERE id = ...`)**:
     - Reserved for erroneous entries or duplicate cleanups.
     - Protected by a high-friction confirmation modal requiring explicit typed confirmation or double-click.
- **Foreign Key Cascade Behavior**:
  - `songbook_songs.song_id` defines `REFERENCES public.songs(id) ON DELETE CASCADE`.
  - Deleting a song automatically and cleanly removes all corresponding rows in `public.songbook_songs` without orphaned records or constraint errors.
- **Pinned Songs Awareness**:
  - If the song being deleted is currently in `public.pinned_songs`, the admin operation should delete the matching `pinned_songs` row to maintain a clean service dashboard.

---

## 7. Songbook Associations & Data Authority Model

### 7.1 The Dual Representation
In the existing catalog, songbook associations exist in two forms:
1. **Relational Junction Table (`public.songbook_songs`)**:
   - `id UUID PRIMARY KEY`
   - `song_id UUID REFERENCES songs(id) ON DELETE CASCADE`
   - `songbook_id UUID REFERENCES songbooks(id) ON DELETE CASCADE`
   - `song_number INTEGER`
   - `CONSTRAINT uq_songbook_songs UNIQUE (song_id, songbook_id)`
2. **Denormalized JSONB (`songs.songbooks`)**:
   - Array of objects: `[{"id": "...", "slug": "...", "title": "...", "song_number": 123}]`

### 7.2 Authority Recommendation
- **`public.songbook_songs` is the canonical, authoritative source of truth** for all relational queries, numbering, and hymnal lookups.
- **`songs.songbooks` is maintained as a denormalized read-performance cache** to ensure complete backward compatibility with existing components (`compact_index`, `SongList`, `SongDetail`, and `SongbooksModal`) without requiring multi-table joins on high-frequency public reads.
- **CRUD Sync Pattern**:
  When an admin saves songbook associations in the form:
  1. Perform reconciliation against `public.songbook_songs`:
     - Delete associations removed by the admin.
     - Upsert current associations (`song_id`, `songbook_id`, `song_number`).
  2. Populate `songs.songbooks` JSONB column with the corresponding array before saving the song row.

---

## 8. Legacy Static JSON & Fallback Strategy

The application currently retains static JSON files in `public/data/` (`compact_index.json`, `public/data/songs/*.json`, and `public/data/songbooks.json`) as an offline fallback asset.

### Operational Principles for Phase 9:
1. **Supabase is Primary**: All admin mutations (INSERT, UPDATE, DELETE) target the live PostgreSQL database exclusively.
2. **Zero Filesystem Writes**: The application will **never** attempt to write files to the local disk during Admin CRUD. The legacy Vite dev file-writing middleware has been permanently decommissioned.
3. **Zero GitHub Serverless Sync**: The application will **never** attempt to push commits to GitHub via serverless functions. The legacy publish endpoint has been permanently decommissioned.
4. **Static JSON Preservation**: Static JSON files remain in place untouched as the emergency fallback when Supabase is offline or unreachable.
5. **Client-Side Cache Invalidation**: When an admin publishes or modifies a song:
   - Invalidate in-memory `cachedCatalog` in `src/services/catalogRepository.js`.
   - Invalidate in-memory `songCache` in `src/services/songRepository.js`.
   - Ensure the updated song is instantly visible in the application without requiring a browser reload.

---

## 9. API Architecture Decision: Direct Supabase vs Server Middleware

### Option A: Direct Client-to-Supabase (Recommended)
```
Browser (React) ────[ HTTPS + User JWT ]────> Supabase PostgREST ────> PostgreSQL RLS
```
- **Pros**:
  - Leverages the already hardened, battle-tested PostgreSQL RLS policies (`public.is_admin()`).
  - Zero server maintenance, zero API proxy boilerplate, zero latency overhead.
  - Zero risk of exposing `service_role` keys (the client uses only the public anon key with user JWT).
  - Standard, idiomatic Supabase architecture.
- **Cons**: Requires clean client-side error mapping (already built in Phase 8C).

### Option B: Custom Server API Route Proxy
```
Browser ──> Vercel/Node Serverless Route ──[ service_role ]──> Supabase Database
```
- **Pros**: Can execute multiple queries in a single serverless Node script.
- **Cons**:
  - Requires maintaining and securing backend serverless endpoints.
  - Bypasses PostgreSQL RLS if using `service_role`, shifting authorization responsibility back to application code (re-introducing the exact vulnerability class identified in Phase 8A).
  - High risk of `service_role` key leakage or misconfiguration.

### Decision:
**Option A (Direct Client-to-Supabase with RLS) is selected.**  
It enforces the strict principle that PostgreSQL RLS is the single source of security truth. No `service_role` key will be used or deployed.

---

## 10. User Interface Architecture

The Admin CRUD UI will be integrated cleanly into the existing application design system (obsidian/dark navy theme with warm amber/gold accents):

```
Admin Portal Modal
 ├── Header Bar (Admin identity, Role badge, "New Song", "Sign Out", Close)
 ├── View 1: Admin Song Catalog List
 │    ├── Filter / Search Bar (Search query, Language, Category, Status)
 │    ├── Summary Metrics (Total songs, Published count, Drafts count)
 │    └── Songs Data Table / Card Grid
 │         ├── Song Title & Transliterated Subtitle
 │         ├── Language & Category Badges
 │         ├── Indicators: Chords, Video, PPT
 │         ├── Published Status Toggle
 │         └── Actions: [Edit] [Delete]
 ├── View 2: Song Editor (Create / Edit Mode)
 │    ├── Tab 1: General Info (Title, Transliteration, Language, Category, Alphabet)
 │    ├── Tab 2: Lyrics (Original stanzas, Transliterated stanzas, Auto-transliterate tool)
 │    ├── Tab 3: Chords (Chords notation, Key, Chord credits)
 │    ├── Tab 4: Songbooks (Association checklist with song number inputs)
 │    ├── Tab 5: Media & Scripture (YouTube ID, PPT URL, Bible verses, Devotional)
 │    └── Footer Action Bar: [Cancel] [Save Song / Publish]
 └── View 3: Delete Confirmation Dialog
      ├── Warning prompt detailing cascade deletion
      └── Actions: [Cancel] [Permanently Delete Song]
```

### Visual Styling:
- Slate-950 and Slate-900 backgrounds with subtle ambient blur.
- Amber-500 / Gold-400 primary interactive highlights.
- Clear status badges: Emerald (Published), Slate (Draft), Blue (Language), Rose (Delete).
- High accessibility: 14px minimum form inputs, keyboard tab navigation, screen-reader labels.

---

## 11. Error & Failure Handling Specification

All database and network responses must be intercepted and translated into clean, human-readable notifications. Raw PostgREST error objects must never be displayed to users:

| Error Condition | PostgreSQL / PostgREST Code | Human-Readable Error Notification | Action Taken |
|-----------------|-----------------------------|-----------------------------------|--------------|
| Missing required fields | Client-side validation | *"Please provide a song title, select a language, and enter lyrics."* | Focus input; no network request |
| Unauthorized / Non-admin | `42501` | *"Permission denied: Administrator privileges are required to perform this action."* | Keep form data in memory; notify user |
| Expired Session | `401 / JWT expired` | *"Your session has expired. Please sign in again to save changes."* | Retain form inputs; prompt sign-in |
| Duplicate Slug | `23505 (unique_violation)` | *"A song with this URL slug already exists. Please modify the title or slug."* | Highlight slug field |
| Foreign Key Violation | `23503` | *"Invalid songbook or category reference. Please check selected values."* | Report field error |
| Network Timeout / Offline | Fetch exception | *"Unable to reach the database. Please check your internet connection and try again."* | Preserve form state; allow retry |
| Song Not Found on Edit/Delete | 0 rows affected | *"This song record could not be found. It may have been removed by another administrator."* | Refresh catalog list |

**Zero Fake Persistence Policy:** If Supabase rejects a mutation, the UI must report failure immediately and **must never** update local storage or fake successful completion.

---

## 12. Concurrency & Data Consistency Strategy

Given a small church hymnal administration team (1 to 3 concurrent admins):

1. **Fresh Read on Edit**: When the admin clicks "Edit", the editor fetches the latest record directly from Supabase by UUID, bypassing any stale in-memory catalog cache.
2. **Updated-At Verification**: The database trigger automatically updates `updated_at = now()`.
3. **Optimistic Cache Invalidation**: Upon successful save or deletion:
   - The specific song record in `songCache` is purged or updated.
   - `cachedCatalog` in `catalogRepository` is invalidated.
   - A background refresh updates the in-memory catalog for immediate UI responsiveness.
4. **Deleted Song Concurrency**: If Admin A deletes a song while Admin B is editing it, Admin B's subsequent UPDATE will return 0 affected rows. The client detects this and alerts Admin B that the record was removed.

---

## 13. Security Threat Model

| Threat | Attack Vector | Expected Defense | Enforcement Layer |
|--------|---------------|------------------|-------------------|
| **Forged Admin UI** | User alters React state in DevTools | Requests evaluated via JWT; `is_admin() = false` | PostgreSQL RLS Engine |
| **Direct API Tampering** | User issues `curl` or PostgREST write | PostgREST enforces `auth.uid()` and RLS | PostgreSQL RLS Engine |
| **Modified JWT Token** | User edits payload in token | Signature mismatch causes immediate 401 | Supabase Auth Gateway |
| **Privilege Escalation** | User updates own profile to `admin` | Trigger `tr_protect_profile_role` aborts | PostgreSQL Trigger |
| **Unauthorized INSERT** | Anonymous/user inserts song | `songs_insert_admin` policy evaluates false | PostgreSQL RLS |
| **Unauthorized UPDATE** | Anonymous/user updates song | `songs_update_admin` policy evaluates false | PostgreSQL RLS |
| **Unauthorized DELETE** | Anonymous/user deletes song | `songs_delete_admin` policy evaluates false | PostgreSQL RLS |
| **IDOR Attack** | User attempts to modify other songs | Only admins can write; all songs protected | PostgreSQL RLS |
| **Credential Leakage** | Stored passwords in browser | Passwords never stored; tokens handled by SDK | Supabase Client SDK |
| **Service Role Exposure**| Bundling admin key in frontend | `service_role` strictly excluded from build | Vite Build & Codebase |
| **Stale Fake Persistence**| Masking failed write in storage | Local fallback writes completely eliminated | Application Service Layer |
| **Accidental Deletion** | Accidental click on Delete | High-friction two-step modal confirmation | Application UI Layer |
| **XSS / Content Injection**| Malicious HTML in lyrics | React default JSX string escaping; no `dangerouslySetInnerHTML` | React View Layer |

---

## 14. Testing Strategy (Pre-Implementation Plan)

Before Phase 9 implementation begins, the test suite must be outlined:

### 14.1 Automated Test Plan:
1. **Form Validation Unit Tests**:
   - Slug generation and slug sanitization.
   - Required fields validation (title, language, lyrics).
   - Stanza separator preservation in lyrics arrays.
2. **RLS Negative Verification**:
   - Re-verify that anonymous and non-admin clients receive `42501` on songs INSERT/UPDATE/DELETE.
3. **Admin CRUD Lifecycle Test (Run with dedicated test credentials)**:
   - When `TEST_ADMIN_EMAIL` and `TEST_ADMIN_PASSWORD` are provided:
     1. Authenticate as admin.
     2. Create a test song with unique slug and songbook associations.
     3. Verify song exists in `public.songs` and `public.songbook_songs`.
     4. Update song lyrics and toggle `is_published = false`.
     5. Verify anonymous client cannot see unpublished song.
     6. Delete test song.
     7. Verify song and junction associations are completely purged.
4. **Public Regression Test**:
   - Run `node --env-file=.env migration/phase-6/test_read_cutover.js` (24/24 PASS).
   - Run `node migration/phase-6/test_read_cutover.js` (24/24 PASS).
5. **Production Build Test**:
   - Run `npm run build` (0 errors).

---

## 15. Proposed Implementation Files (Phase 9B Preview)

Phase 9 implementation will create or update the following modular files:

| File | Type | Proposed Responsibility |
|------|------|-------------------------|
| `src/services/adminSongService.js` | **NEW** | Direct Supabase CRUD service containing `createSong()`, `updateSong()`, `deleteSong()`, `getAdminCatalog()`, and `reconcileSongbooks()`. |
| `src/components/admin/AdminPortalModal.jsx` | **NEW** | Top-level admin modal container managing navigation between Song List, Song Editor, and Account Views. |
| `src/components/admin/AdminSongList.jsx` | **NEW** | Administrative data table with filtering, search, published status toggles, and action buttons. |
| `src/components/admin/AdminSongEditor.jsx` | **NEW** | Tabbed form for hymn creation and editing, lyrics transliteration, chord formatting, and songbook linking. |
| `src/components/admin/AdminDeleteConfirmModal.jsx` | **NEW** | High-friction confirmation dialog for permanent song deletions. |
| `src/services/catalogRepository.js` | **MODIFY** | Add `invalidateCatalogCache()` helper to allow admin mutations to trigger immediate cache refresh. |
| `src/services/songRepository.js` | **MODIFY** | Add `invalidateSongCache(idOrSlug)` helper to purge stale details upon update/delete. |

---

## 16. Backward Compatibility Assurance

The implementation of Phase 9 will guarantee 100% backward compatibility:
- **Public Routes & Parameters**: `?song=slug`, `?song=uuid`, `#slug` resolution remains identical.
- **Search Engine**: In-memory search indexing via `filterSongs` and `getCatalogIndex` continues without disruption.
- **Transposition & Media**: Interactive chords transposer, media player, and PowerPoint generator continue operating with zero changes to their data contracts.
- **Static Fallback**: The offline static JSON fallback remains functional should Supabase experience network interruptions.

---

## 17. Risks & Mitigations

1. **Risk:** Admin accidentally deletes a widely used hymn.
   - **Mitigation:** Promote "Unpublish" (`is_published = false`) as the primary administrative action; require high-friction typed confirmation for hard deletion.
2. **Risk:** Transliteration service throws error on complex Telugu characters.
   - **Mitigation:** Wrap transliteration in try/catch fallback; allow manual editing of transliterated fields.
3. **Risk:** Cache inconsistency where public visitors see stale song details after an admin update.
   - **Mitigation:** Ensure `songCache.delete()` is invoked on both the song's UUID and slug upon successful save.

---

## 18. Explicit Non-Goals Summary

To keep Phase 9 strictly focused and prevent architectural bloat:
- Do NOT build a user registration / signup system.
- Do NOT build a user management or permissions assignment dashboard.
- Do NOT modify the `songbooks`, `categories`, or `languages` schemas.
- Do NOT implement songbook CRUD (the 8 hymnals are fixed).
- Do NOT integrate audio/video file storage buckets.
- Do NOT implement user favorite synchronization across devices.
- Do NOT rewrite or refactor public catalog components.

---

## 19. Final Architectural Assessment

```
============================================================
PHASE 9A RESULT: PASS
============================================================
```

The Phase 9A Admin CRUD architecture is fully designed, strictly adheres to PostgreSQL RLS authorization principles, maintains complete separation of concerns, and protects the stability and performance of the public website.

**STOPPING HERE AS INSTRUCTED.** Phase 9B implementation has not been started. Awaiting user review and authorization.
