# All Christian Songs — Database Migration Plan

> **Status**: Phase 0 — Safety / Backup / Git Checkpoint
> **Created**: 2026-09-17
> **Last Updated**: 2026-09-17

---

## 1. Current Architecture

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React 18 + Vite 5 | Single-page application (no React Router) |
| Styling | Tailwind CSS + custom CSS | `YouTubeSection.css`, `index.css` |
| Build & Deploy | Vite → GitHub Actions → Vercel | `deploy.yml` workflow |
| Static Data | JSON files under `public/data/` | Song catalog, songbooks |
| Serverless API | Vercel Functions (`api/`) | `pinned-songs.js`, `publish-song.js` |
| Database (partial) | Supabase (Free Tier) | Only `pinned_songs` table currently |
| State Management | React useState + localStorage | Favorites stored in localStorage |
| Search | Client-side in-memory (`utils/search.js`) | Full-text search over compact index |

### Key Files

```
├── src/
│   ├── App.jsx                          # Main SPA controller (no router)
│   ├── main.jsx                         # React entry point
│   ├── index.css                        # Global styles
│   ├── components/
│   │   ├── Header.jsx                   # Navigation, search, admin trigger
│   │   ├── HeroSection.jsx              # Landing hero
│   │   ├── SongList.jsx                 # Song listing/grid
│   │   ├── SongDetail.jsx               # Full song view with lyrics
│   │   ├── PinnedSongsSection.jsx       # Admin-pinned worship songs
│   │   ├── FavoritesModal.jsx           # User favorites (localStorage)
│   │   ├── AdminLoginModal.jsx          # Admin password gate
│   │   ├── AdminPublishModal.jsx        # Song publishing/editing
│   │   ├── SongbooksModal.jsx           # Songbook browser
│   │   ├── BrowseByCategory.jsx         # Category browsing
│   │   ├── BrowseByLetter.jsx           # Alphabetical browsing
│   │   ├── CategoryHeroCards.jsx        # Category cards
│   │   ├── PopularSongs.jsx             # Popular songs section
│   │   ├── AboutModal.jsx               # About page
│   │   ├── Footer.jsx                   # Footer
│   │   ├── InfoSection.jsx              # Info section
│   │   ├── MediaPlayer.jsx              # YouTube embed player
│   │   ├── PresentationModal.jsx        # PPT viewer modal
│   │   ├── YouTubeSection.jsx           # YouTube section
│   │   └── YouTubeSection.css           # YouTube section styles
│   └── utils/
│       ├── supabaseClient.js            # Supabase client init
│       ├── pinManager.js                # Pinned songs CRUD + Supabase sync
│       ├── search.js                    # Client-side search engine
│       ├── transliterator.js            # Telugu/English transliteration
│       ├── chordTransposer.js           # Chord transposition
│       └── pptGenerator.js              # PowerPoint auto-generation
├── api/
│   ├── pinned-songs.js                  # Vercel serverless: pin CRUD
│   └── publish-song.js                  # Vercel serverless: song publishing
├── scripts/
│   ├── add-song.js                      # CLI song addition tool
│   └── song-template.json              # Song JSON template
└── public/data/
    ├── compact_index.json               # Compact song catalog (3,773 songs)
    ├── songbooks.json                   # 8 songbook definitions
    ├── pinned_songs.json                # Static fallback for pinned songs
    └── songs/                           # 7,546 files (UUID + slug per song)
```

---

## 2. Current Song Storage

### compact_index.json (Compact Schema)

Each entry uses abbreviated field names for bandwidth efficiency:

| Field | Full Name | Type | Description |
|-------|-----------|------|-------------|
| `id` | UUID | string | Stable UUID v4 identifier |
| `slug` | slug | string | URL-safe unique slug |
| `t` | title | string | Song title |
| `tr` | title_transliterated | string | Transliterated title |
| `lang` | language | string | `telugu`, `english`, or `hindi` |
| `alpha` | alphabet | string | First letter for A-Z browsing |
| `chords` | has_chords | boolean | Whether chord data exists |
| `video` | has_video | boolean | Whether YouTube video exists |
| `yt` | youtube_id | string | YouTube video ID |
| `ppt` | has_ppt | boolean | Whether PPT exists |
| `cats` | categories | string[] | Category names |
| `books` | songbooks | string[] | Songbook names |
| `auth` | author | string | Author name |
| `search` | search_text | string | Pre-computed search string |

### Individual Song Files (Full Schema)

Each song has **two** JSON files in `public/data/songs/`:
- `{uuid}.json` — keyed by UUID
- `{encoded-slug}.json` — keyed by URL-encoded slug

Both files are identical in content. Full song fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | UUID v4 |
| `slug` | string | URL-safe slug |
| `title` | string | Song title |
| `title_transliterated` | string | Transliterated title |
| `language` | string | Language code |
| `alphabet` | string | First letter |
| `lyrics_original` | string[] | Lyrics lines (stanzas separated by `""`) |
| `lyrics_transliterated` | string[] | Transliterated lyrics lines |
| `youtube_id` | string | YouTube video ID |
| `chords` | object\|null | Chord data |
| `chord_count` | number | Number of chord sets |
| `chord_credits` | string\|null | Chord contributor |
| `author_english` | string | Author (English) |
| `author_telugu` | string\|null | Author (Telugu) |
| `category_names` | string[] | Category names |
| `songbooks` | array | Songbook membership entries |
| `ppt_url` | string | Full Supabase Storage URL to .pptx file |
| `bible_verses` | object[] | `{ english, reference }` |
| `devotional` | object | `{ generated_at, prayer_english, prayer_telugu, reflection_english, reflection_telugu, summary_english, summary_telugu }` |

---

## 3. Current Supabase Usage

### Project
- **URL**: `https://hxfeluhttsifwmwltjmj.supabase.co`
- **Tier**: Free

### Tables in Use
- **`pinned_songs`** — Admin-pinned worship songs for Sunday service display

### Storage in Use
- **`song-ppts`** bucket — Stores auto-generated PowerPoint files
  - URL pattern: `https://zeabwyivgsfexgvsnipf.supabase.co/storage/v1/object/public/song-ppts/{uuid}/{filename}.pptx`
  - Note: The storage subdomain (`zeabwyivgsfexgvsnipf`) differs from the project subdomain (`hxfeluhttsifwmwltjmj`), suggesting a separate Supabase project may host the PPTs

### Auth
- **Not currently used** — Admin access via hardcoded `VITE_ADMIN_PASSWORD` env variable
- Client-side password check only (no server-side auth)

### Realtime
- Subscribed on `pinned_songs` table for live updates across church members' browsers

---

## 4. Migration Phases

| Phase | Name | Status |
|-------|------|--------|
| **0** | Safety / Backup / Git Checkpoint | **IN PROGRESS** |
| 1 | Supabase Security Foundation | Pending |
| 2 | Database Schema | Pending |
| 3 | Song Migration Validation / Preparation | Pending |
| 4 | Import 3,773 Songs | Pending |
| 5 | Independent Database Integrity Verification | Pending |
| 6 | Connect Website READ operations to Supabase | Pending |
| 7 | Preserve Search / Cache Performance | Pending |
| 8 | Supabase Auth + Admin | Pending |
| 9 | Admin Song CRUD | Pending |
| 10 | Cloud Favorites | Pending |
| 11 | User Song Submission + Admin Review | Pending |
| 12 | Production Hardening | Pending |

---

## 5. Known Migration Risks

### Critical
1. **PPT URL Inconsistency**: PPT files are stored on a different Supabase project (`zeabwyivgsfexgvsnipf`) than the main project (`hxfeluhttsifwmwltjmj`). These URLs must be preserved as-is during migration — do NOT attempt to re-upload or change storage paths.
2. **Hardcoded Admin Password**: `sherwin1990` is exposed in client-side code (`pinManager.js` line 268, `.env`, `.env.local`). Must be replaced with Supabase Auth in Phase 8.
3. **No RLS Policies**: The existing `pinned_songs` table likely has no Row Level Security. Any client with the anon key can read/write.
4. **Supabase Free Tier Limits**: 500MB database, 1GB storage, 2GB bandwidth/month, 50,000 monthly active users.

### Important
5. **14,192 Empty-String Stanza Separators**: Lyrics arrays use `""` to separate stanzas. This is intentional formatting, NOT missing data. Must be preserved exactly.
6. **Devotional is an Object**: The `devotional` field is a structured object (with `prayer_english`, `reflection_english`, etc.), not a plain string. Schema must accommodate this.
7. **Dual-File Song Storage**: Each song exists as both `{uuid}.json` and `{encoded-slug}.json`. During migration, only one copy needs to be imported — verify they are identical.
8. **Telugu Content Dominance**: 88.6% of songs (3,344/3,773) are in Telugu. Search, transliteration, and display must handle Telugu Unicode properly.

### Moderate
9. **Client-Side SPA**: No React Router — all navigation is state-driven. URL handling during migration must not break bookmark/share URLs.
10. **localStorage Favorites**: User favorites are browser-local. Migration to cloud (Phase 10) requires a data migration strategy per user.

---

## 6. Files That Must NOT Be Changed Yet

The following files must remain untouched until their designated migration phase:

### React Components (Not until Phase 6+)
- `src/App.jsx`
- All files in `src/components/`

### Styling (Not changed at all during migration)
- `src/index.css`
- `src/components/YouTubeSection.css`
- `tailwind.config.js`

### Current Song Data (Not until Phase 4 verification)
- `public/data/compact_index.json`
- `public/data/songbooks.json`
- `public/data/songs/*.json`

### Supabase Configuration (Not until Phase 1)
- `src/utils/supabaseClient.js`
- `.env` / `.env.local`

### Existing Functionality (Not until designated phase)
- `src/utils/pinManager.js` — Phase 8
- `src/utils/search.js` — Phase 7
- `src/utils/transliterator.js` — Not planned
- `src/utils/chordTransposer.js` — Not planned
- `src/utils/pptGenerator.js` — Not planned
- `api/pinned-songs.js` — Phase 8
- `api/publish-song.js` — Phase 9
