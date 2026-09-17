# Phase 3: Field-by-Field Migration Mapping Specification

> **Project**: All Christian Songs  
> **Source Catalog**: `public/data/songs/` (3,773 JSON objects)  
> **Target Database**: Supabase PostgreSQL (`public.songs`, `public.songbook_songs`)  
> **Date**: 2026-09-17  

---

## 1. Main Song Table Mapping (`public.songs`)

| Source Property (JSON) | Target Column (`public.songs`) | PostgreSQL Type | Nullable | Transformation / Preservation Rule |
|---|---|---|---|---|
| `id` | `id` | `UUID` | No (PK) | Exact copy. Canonical UUID preserved 1:1. |
| `slug` | `slug` | `TEXT` | No (Unique) | Exact copy. URL slug preserved 1:1. |
| `title` | `title` | `TEXT` | No | Exact copy. Native script song title. |
| `title_transliterated` | `title_transliterated` | `TEXT` | Yes | Exact copy. Latin script title (null for some songs). |
| `language` | `language` | `TEXT` | No (FK) | Exact copy. Maps to `languages.code` (`telugu`, `english`, `hindi`). |
| `alphabet` | `alphabet` | `TEXT` | No | Exact copy. Initial character grouping. |
| `lyrics_original` | `lyrics_original` | `TEXT[]` | No | Exact array preservation including empty string `""` stanza separators. |
| `lyrics_transliterated` | `lyrics_transliterated` | `TEXT[]` | No | Exact array preservation including empty string `""` stanza separators. Defaults to `{}` if empty. |
| `youtube_id` | `youtube_id` | `TEXT` | Yes | Exact copy or `NULL` if missing. |
| `chords` | `chords` | `TEXT[]` | Yes | Exact array of chord/lyric lines or `NULL`. |
| `chord_count` | `chord_count` | `INTEGER` | No | Number of chords or `0`. |
| `chord_credits` | `chord_credits` | `TEXT` | Yes | Chord contributor credit string or `NULL`. |
| `author_english` | `author_english` | `TEXT` | Yes | Exact string or `NULL`. |
| `author_telugu` | `author_telugu` | `TEXT` | Yes | Exact string or `NULL`. |
| `category_names` | `category_names` | `TEXT[]` | No | Array of strings from the 18 canonical categories, or `{}` if uncategorized. |
| `songbooks` | `songbooks` | `JSONB` | No | Preserved as JSONB array for backward-compatible frontend reads. |
| `ppt_url` | `ppt_url` | `TEXT` | Yes | Full presentation download URL preserved unchanged. |
| `bible_verses` | `bible_verses` | `JSONB` | No | Preserved as structured JSONB array with language-specific verse fields. |
| `devotional` | `devotional` | `JSONB` | Yes | Preserved as structured JSONB object (5 fields) or `NULL`. |
| *(computed)* | `is_published` | `BOOLEAN` | No | Default `true`. |
| *(system)* | `created_at` | `TIMESTAMPTZ` | No | Set to `now()` if new, preserved on conflict. |
| *(system)* | `updated_at` | `TIMESTAMPTZ` | No | Triggered to `now()`. |

---

## 2. Songbook Association Junction Table (`public.songbook_songs`)

| Source Property (`song.songbooks[i]`) | Target Column (`public.songbook_songs`) | Target Type | Resolution Logic |
|---|---|---|---|
| `song.id` | `song_id` | `UUID` | Foreign key referencing `songs.id` |
| `b.book` (slug) | `songbook_id` | `UUID` | Resolved against `public.songbooks.id` via `public.songbooks.slug` |
| `b.number` | `song_number` | `INTEGER` | Preserved hymn number (nullable for unnumbered hymns) |
| *(system)* | `created_at` | `TIMESTAMPTZ` | Default `now()` |

### Songbook Slug to UUID Mapping
- `andhra-kraisthava-keerthanalu` &rarr; `4cd29823-061b-4b97-bff2-8da0a4009231`
- `hosanna-ministries` &rarr; `b93b9357-4685-406b-bb61-89985702fb0a`
- `vidhyaarthi-geethaavali` &rarr; `c413c35a-3a51-4037-b574-22b8df8be5ea`
- `songs-of-zion` &rarr; `867aab57-325d-4930-82be-63ced95d28cf`
- `joyful-journey` &rarr; `9d471f55-2636-4229-9727-02ab632b0bb5`
- `joyful-journey-sunday-school` &rarr; `102087d1-4047-47f2-b2f8-950940dff338`
- `joyful-journey-pallavulu` &rarr; `f4475f55-c6a9-4383-85ce-fe4a0bc919c0`
- `joyful-journey-choruses` &rarr; `2d423415-cb9c-41ac-8dfa-1febe280e85b`

---

## 3. Empty String Stanza Separator Preservation Policy
- Stanza breaks in `lyrics_original` and `lyrics_transliterated` are stored as empty strings (`""`).
- Total verified empty string count across catalog: **14,192**.
- All import transformations explicitly preserve empty string elements in PostgreSQL arrays. No `.filter(Boolean)` or `.trim()` on the array itself.
