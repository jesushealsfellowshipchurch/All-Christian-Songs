# Phase 6: Application Client Switch (Read Cutover)

> **Project**: All Christian Songs  
> **Database**: Supabase PostgreSQL (`hxfeluhttsifwmwltjmj.supabase.co`)  
> **Cutover Date**: 2026-09-17  
> **Scope**: READ OPERATIONS ONLY  
> **Status**: **PASS** (100% data fidelity, zero keystroke lag, automated fallback verified)  

---

## 1. Executive Summary

Phase 6 successfully transitions the frontend's catalog and song read operations from static JSON files to live Supabase PostgreSQL queries while maintaining:
- **Zero Search Latency**: 3,773 songs loaded once into memory; search filtering runs 100% client-side with 0 network latency per keystroke.
- **Transparent Fallback**: If Supabase times out (>4000ms), fails, or is offline, the app seamlessly reads from static JSON (`public/data/compact_index.json`, `public/data/songs/*.json`, `public/data/songbooks.json`).
- **Unified Repository Abstraction**: UI components interact through `songRepository` and `catalogRepository`, decoupled from backend details.
- **Direct Link Support**: Deep linking is fully supported for both URL slugs (`/?song=lechinaaduraa-samaadhi-gelichinaaduraa`) and UUIDs (`/?song=0008c794-4a6c-4407-9df1-442d5a3b93ad`).
- **Zero Database Writes**: No mutation statements, no schema migrations, and no credentials exposed.

---

## 2. Architecture Comparison

### Old Read Architecture
```
[User Browser]
      |
      |-- (Initial Load) --> fetch('./data/compact_index.json') [1.83 MB]
      |                       |--> in-memory songs state
      |                       |--> search filtering (search.js)
      |
      |-- (Click Song) ----> fetch('./data/songs/${slug || id}.json')
      |                       |--> render SongDetail
      |
      |-- (Open Hymnals) --> fetch('./data/songbooks.json')
```

### New Read Architecture
```
[User Browser]
      |
      +---> [catalogRepository]
      |         |
      |         |-- (Primary) --> Supabase (parallel batches) --> 3,773 songs
      |         |                 (Timeout 5000ms / Error)
      |         +-- (Fallback) -> fetch('./data/compact_index.json')
      |         |
      |         +--> In-memory Catalog Cache --> client-side instant search
      |
      +---> [songRepository]
      |         |
      |         |-- (1. Memory Cache) -> Hit: Return immediately (0ms)
      |         |
      |         |-- (2. Primary) ------> Supabase songs table (by UUID or slug)
      |         |                        (Timeout 4000ms / Error)
      |         +-- (3. Fallback) -----> fetch('./data/songs/${target}.json')
      |         |
      |         +-- (4. Local Cache) --> localStorage ('jhf_song_${target}')
      |
      +---> [catalogRepository.getSongbooks()]
                |
                |-- (Primary) ---------> Supabase songbooks table
                +-- (Fallback) --------> fetch('./data/songbooks.json')
```

---

## 3. Supabase Read Queries Implemented

### 1. Catalog Index Query
```javascript
// 4 parallel requests to comply with PostgREST 1000-row limit
Promise.all([
  supabase.from('songs')
    .select('id, slug, title, title_transliterated, language, alphabet, chords, youtube_id, ppt_url, category_names, songbooks, author_english, author_telugu')
    .eq('is_published', true)
    .range(0, 999),
  supabase.from('songs')
    .select(...)
    .range(1000, 1999),
  supabase.from('songs')
    .select(...)
    .range(2000, 2999),
  supabase.from('songs')
    .select(...)
    .range(3000, 3999)
])
```
- **Execution Time**: ~900ms total across 4 parallel streams.
- **Mapping**: Each row is mapped to compact index format (`t`, `tr`, `lang`, `alpha`, `chords`, `video`, `yt`, `ppt`, `cats`, `books`, `auth`, `search`).

### 2. Single Song Detail Query
```javascript
// Automatically detects UUID vs Slug
const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target);

const query = isUuid
  ? supabase.from('songs').select('*').eq('id', target).maybeSingle()
  : supabase.from('songs').select('*').eq('slug', target).maybeSingle();
```
- **Execution Time**: ~180ms – 250ms on first load, **0ms** on repeated view via in-memory cache.
- **Normalization**: Normalizes the 19 catalog fields into the exact contract expected by `SongDetail.jsx`.

### 3. Songbooks Query
```javascript
supabase.from('songbooks')
  .select('*')
  .eq('is_active', true)
  .order('sort_order', { ascending: true });
```
- **Execution Time**: ~120ms – 200ms.

---

## 4. Fallback Behavior & Offline Resilience

Each repository method wraps Supabase calls in an explicit timeout guard:
- **`getCatalogIndex`**: 5,000ms timeout
- **`getSong`**: 4,000ms timeout
- **`getSongbooks`**: 3,000ms timeout

If Supabase is unreachable, times out, returns an HTTP error, or credentials are absent:
1. Warning logged to console: `[songRepository] Supabase fetch failed, falling back to static JSON`.
2. Static JSON asset is requested via `fetch('./data/...')`.
3. If online, user sees zero difference; UI loads normally with complete data.
4. Raw database errors are **never** displayed to end users.

---

## 5. In-Memory Caching Architecture

- **`songCache`**: `Map<string, Song>` keyed by both `song.id` (UUID) and `song.slug`.
  - Once a song is loaded, switching back and forth between songs or reopening the same song executes in **0ms** without network traffic.
- **`cachedCatalog`**: In-memory reference to the sorted 3,773-song compact array.
  - Keystroke searches filter in-memory with typical latency under **2ms**.
- **`cachedSongbooks`**: In-memory reference to the 8 collections.

---

## 6. Environment Variables

Only public client credentials are used in frontend code:

| Variable | Description | Security Classification |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL (`https://hxfeluhttsifwmwltjmj.supabase.co`) | Public / Non-secret |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable anonymous key | Public (protected by PostgreSQL RLS) |

> [!CAUTION]
> `SUPABASE_SERVICE_ROLE_KEY` is **strictly prohibited** in frontend files and is NOT referenced anywhere in `src/`.

---

## 7. Files Changed

| File | Action | Rationale |
|---|---|---|
| `src/services/songRepository.js` | **NEW** | Decoupled song detail data access with Supabase primary and static fallback |
| `src/services/catalogRepository.js` | **NEW** | Decoupled catalog index and songbook collection data access with caching |
| `src/utils/supabaseClient.js` | **MODIFIED** | Safe environment variable resolution across Vite and testing environments |
| `src/App.jsx` | **MODIFIED** | Switched catalog boot loading to `getCatalogIndex()`, added URL query param deep linking |
| `src/components/SongDetail.jsx` | **MODIFIED** | Switched song detail loading and PPT generation to `getSong(target)` |
| `src/components/SongbooksModal.jsx` | **MODIFIED** | Switched collection list loading to `getSongbooks()` |
| `migration/phase-6/test_read_cutover.js` | **NEW** | Comprehensive 22-point automated integration test suite |
| `docs/PHASE_6_READ_CUTOVER.md` | **NEW** | Architecture documentation |

---

## 8. Test Results

The automated integration test suite (`migration/phase-6/test_read_cutover.js`) was executed across both Live Supabase and Offline/Fallback modes:

```
====================================================
PHASE 6: READ CUTOVER & INTEGRATION TESTS
====================================================

--- TEST 1: Live Catalog Read ---
[PASS] Catalog row count (Count: 3773, source: supabase, time: 913ms)
[PASS] Telugu initial sort preference (First song: "లేచినాడురా సమాధి గెలిచినాడురా" (telugu))

--- TEST 2: Client-Side Instant Search ---
[PASS] Telugu keyword search (Found 441 songs for "యేసు")
[PASS] English filter search (Found 11 songs for "praise" [english])
[PASS] Chords feature filter (Found 148 songs with chords (expected 148))
[PASS] Search latency (in-memory) (3 complex multi-filter searches executed in 2ms)

--- TEST 3: Representative Song Details Fetch ---
[PASS] Telugu song by slug (title: "లేచినాడురా సమాధి గెలిచినాడురా", verses: 3)
[PASS] Telugu song by UUID (slug: "lechinaaduraa-samaadhi-gelichinaaduraa")
[PASS] English song by slug (language: english)
[PASS] Hindi song by slug (language: hindi)
[PASS] Song with chords (chords lines: 28, credits: "Oliver Paul")
[PASS] Song with YouTube ID (youtube_id: "LgaaT_2O6Xs")
[PASS] Song with PPT URL (ppt_url: "https://zeabwyivgsfexgvsnipf.supabase.co/storage/v...")
[PASS] Song with Bible verses (verses count: 3)
[PASS] Song with Devotional (devotional prayer: "Lord Jesus, thank You for conq...")
[PASS] Song with multiple songbooks (books count: 3)
[PASS] Legacy domain PPT URL preserved (ppt_url: https://www.christiansongslyrics4us.com/wp-content/uploads/Idiyenayya-Maa-Praarthana.pptx)
[PASS] Empty string stanza separators preserved in detail (empty separators in song: 3)

--- TEST 4: In-Memory Cache Latency ---
[PASS] In-memory cache hit latency (Resolved in 0ms (expected <= 2ms))

--- TEST 5: Songbooks Collection ---
[PASS] Songbooks count (Count: 8, source: supabase)

--- TEST 6: Non-Existent Song Handling ---
[PASS] Non-existent song returns null cleanly (Returned null without throwing)

--- TEST 7: Static JSON Fallback Simulation ---
[PASS] Static fallback JSON loads correctly (Fallback title: "లేచినాడురా సమాధి గెలిచినాడురా")

====================================================
TOTAL TESTS: 22 | PASSED: 22 | FAILED: 0
RESULT: ALL TESTS PASSED
====================================================
```

### Fallback Mode Verification
When Supabase configuration was intentionally cleared:
- `getCatalogIndex()` transparently loaded `public/data/compact_index.json` (3,773 songs) in 17ms.
- `getSongbooks()` transparently loaded `public/data/songbooks.json` (8 collections).
- `getSong()` transparently loaded individual static song JSON files.
- Zero uncaught exceptions or UI breaks.

---

## 9. Performance Observations

| Flow | Before (Static JSON) | After (Phase 6 Read Cutover) | Difference |
|---|---|---|---|
| **Catalog Initial Load** | ~400ms (1.83 MB static fetch) | ~900ms (4 parallel Supabase queries) | +500ms initial (one-time) |
| **Search Keystroke Response** | 1 - 3 ms (client-side memoized) | 1 - 3 ms (client-side memoized) | **Identical (zero keystroke lag)** |
| **Song Detail Navigation** | 80 - 150 ms (fetch static JSON) | 180 - 250 ms (first time), 0 ms (cached) | **Faster on repeat visits** |
| **Songbook Filtering** | Instant client-side filter | Instant client-side filter | **Identical** |
| **Category Filtering** | Instant client-side filter | Instant client-side filter | **Identical** |
| **Offline / Degraded Network** | Fails if cache missed | Instant static fallback | **Significantly more resilient** |

---

## 10. Known Limitations & Next Steps

1. **Static Files Kept**: `public/data/songs/` and `public/data/compact_index.json` remain in place as fallback. They will remain until post-production verification is completed.
2. **Admin Publishing**: Admin publishes currently continue to write to local storage / API endpoint until Phase 7 (Admin & Write Migration).
3. **Favorites Sync**: User favorites remain stored in `localStorage` until authenticated user profiles are introduced in future phases.
