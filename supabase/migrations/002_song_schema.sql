-- =============================================================================
-- Phase 2: Supabase Song Catalog Schema
-- All Christian Songs — Database Migration
-- =============================================================================
-- Date: 2026-09-17
-- Purpose: Create production schema for languages, songbooks, categories,
--          songs, and songbook_songs junction table with RLS & indexes.
-- Safety: Non-destructive. Uses CREATE TABLE IF NOT EXISTS.
--         Does NOT drop any tables, delete rows, or alter existing data.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Shared Utility Functions & Pinned Songs RLS Hardening
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Ensure pinned_songs RLS is locked down (idempotent safeguard)
ALTER TABLE IF EXISTS public.pinned_songs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pinned_songs_select_public" ON public.pinned_songs;
CREATE POLICY "pinned_songs_select_public"
  ON public.pinned_songs FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "pinned_songs_insert_admin" ON public.pinned_songs;
CREATE POLICY "pinned_songs_insert_admin"
  ON public.pinned_songs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "pinned_songs_update_admin" ON public.pinned_songs;
CREATE POLICY "pinned_songs_update_admin"
  ON public.pinned_songs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "pinned_songs_delete_admin" ON public.pinned_songs;
CREATE POLICY "pinned_songs_delete_admin"
  ON public.pinned_songs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- -----------------------------------------------------------------------------
-- 1. Languages Table
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.languages (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  native_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.languages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "languages_select_public" ON public.languages;
CREATE POLICY "languages_select_public"
  ON public.languages FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "languages_write_admin" ON public.languages;
CREATE POLICY "languages_write_admin"
  ON public.languages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Pre-seed canonical languages
INSERT INTO public.languages (code, name, native_name, sort_order) VALUES
  ('telugu', 'Telugu', 'తెలుగు', 1),
  ('english', 'English', 'English', 2),
  ('hindi', 'Hindi', 'हिन्दी', 3)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  native_name = EXCLUDED.native_name,
  sort_order = EXCLUDED.sort_order;

-- -----------------------------------------------------------------------------
-- 2. Categories Table (Lookup & Metadata)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT UNIQUE NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_select_public" ON public.categories;
CREATE POLICY "categories_select_public"
  ON public.categories FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "categories_write_admin" ON public.categories;
CREATE POLICY "categories_write_admin"
  ON public.categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Pre-seed 18 catalog categories
INSERT INTO public.categories (slug, name, sort_order) VALUES
  ('christmas-songs', 'Christmas Songs', 1),
  ('comfort-songs', 'Comfort Songs', 2),
  ('commitment-songs', 'Commitment Songs', 3),
  ('correction-songs', 'Correction Songs', 4),
  ('easter-songs', 'Easter Songs', 5),
  ('encouraging-songs', 'Encouraging Songs', 6),
  ('good-friday-songs', 'Good Friday Songs', 7),
  ('gospel-songs', 'Gospel Songs', 8),
  ('hope-songs', 'Hope Songs', 9),
  ('marriage-songs', 'Marriage Songs', 10),
  ('offering-songs', 'Offering Songs', 11),
  ('praise-songs', 'Praise Songs', 12),
  ('prayer-songs', 'Prayer Songs', 13),
  ('repentance-songs', 'Repentance Songs', 14),
  ('second-coming-songs', 'Second Coming Songs', 15),
  ('sunday-school-songs', 'Sunday School Songs', 16),
  ('thanksgiving-songs', 'Thanksgiving Songs', 17),
  ('worship-songs', 'Worship Songs', 18)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order;

-- -----------------------------------------------------------------------------
-- 3. Songbooks Table
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.songbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  title_native TEXT,
  title_transliterated TEXT,
  language TEXT NOT NULL REFERENCES public.languages(code) ON UPDATE CASCADE,
  description TEXT,
  publisher TEXT,
  total_in_print INTEGER,
  cover_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_numbered BOOLEAN NOT NULL DEFAULT true,
  parent_slug TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.songbooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "songbooks_select_public" ON public.songbooks;
CREATE POLICY "songbooks_select_public"
  ON public.songbooks FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "songbooks_write_admin" ON public.songbooks;
CREATE POLICY "songbooks_write_admin"
  ON public.songbooks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP TRIGGER IF EXISTS songbooks_updated_at ON public.songbooks;
CREATE TRIGGER songbooks_updated_at
  BEFORE UPDATE ON public.songbooks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Pre-seed 8 official songbooks preserving canonical UUIDs from public/data/songbooks.json
INSERT INTO public.songbooks (id, slug, title, title_native, title_transliterated, language, description, publisher, sort_order, is_active, is_numbered) VALUES
  ('4cd29823-061b-4b97-bff2-8da0a4009231', 'andhra-kraisthava-keerthanalu', 'Andhra Kraisthava Keerthanalu', 'ఆంధ్ర క్రైస్తవ కీర్తనలు', 'Andhra Kraisthava Keerthanalu', 'telugu', 'A classic Telugu Christian hymnal. Songs are numbered as they appear in the book, so you can look one up the way it is announced in church.', NULL, 10, true, true),
  ('b93b9357-4685-406b-bb61-89985702fb0a', 'hosanna-ministries', 'Hosanna Ministries', 'హోసన్నా మినిస్ట్రీస్', 'Hosanna Ministries', 'telugu', 'Telugu worship songs from Hosanna Ministries, as numbered in Hosanna Aananda Keerthanalu. Look a song up by its number the way it is announced.', 'Hosanna Ministries', 30, true, true),
  ('c413c35a-3a51-4037-b574-22b8df8be5ea', 'vidhyaarthi-geethaavali', 'Vidhyaarthi Geethaavali', 'విద్యార్థి గీతావళి', 'Vidhyaarthi Geethaavali', 'telugu', 'A popular youth hymnal, as numbered in Vidhyaarthi Geethaavali. Look a song up by its number.', NULL, 40, true, true),
  ('867aab57-325d-4930-82be-63ced95d28cf', 'songs-of-zion', 'Songs of Zion', 'సీయోను పాటలు', 'Songs of Zion', 'telugu', 'Songs of Zion, as numbered in the hymnal. Look a song up by its number.', 'Hebron Church', 20, true, true),
  ('9d471f55-2636-4229-9727-02ab632b0bb5', 'joyful-journey', 'Joyful Journey', 'జాయ్‌ఫుల్ జర్నీ', 'Joyful Journey', 'telugu', 'Joyful Journey songbook collection. Look up songs by their number in the collection.', NULL, 50, true, true),
  ('102087d1-4047-47f2-b2f8-950940dff338', 'joyful-journey-sunday-school', 'Sunday School', 'సండే స్కూల్', 'Sunday School', 'telugu', 'Joyful Journey Sunday School songs for children, with song numbers.', NULL, 51, true, true),
  ('f4475f55-c6a9-4383-85ce-fe4a0bc919c0', 'joyful-journey-pallavulu', 'Pallavulu', 'పల్లవులు', 'Pallavulu', 'telugu', 'Joyful Journey Pallavulu (choruses and refrains), with song numbers.', NULL, 52, true, true),
  ('2d423415-cb9c-41ac-8dfa-1febe280e85b', 'joyful-journey-choruses', 'Choruses', 'Choruses', 'Choruses', 'english', 'Joyful Journey English choruses, with song numbers.', NULL, 53, true, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  title = EXCLUDED.title,
  title_native = EXCLUDED.title_native,
  title_transliterated = EXCLUDED.title_transliterated,
  language = EXCLUDED.language,
  description = EXCLUDED.description,
  publisher = EXCLUDED.publisher,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  is_numbered = EXCLUDED.is_numbered;

-- -----------------------------------------------------------------------------
-- 4. Songs Table (Main Catalog)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.songs (
  id UUID PRIMARY KEY, -- CRITICAL: Retains exact existing UUID from catalog
  slug TEXT UNIQUE NOT NULL, -- CRITICAL: Retains exact existing slug from catalog
  title TEXT NOT NULL,
  title_transliterated TEXT,
  language TEXT NOT NULL REFERENCES public.languages(code) ON UPDATE CASCADE,
  alphabet TEXT NOT NULL,
  lyrics_original TEXT[] NOT NULL DEFAULT '{}',
  lyrics_transliterated TEXT[] NOT NULL DEFAULT '{}',
  youtube_id TEXT,
  chords TEXT[] DEFAULT NULL,
  chord_count INTEGER DEFAULT 0,
  chord_credits TEXT,
  author_english TEXT,
  author_telugu TEXT,
  category_names TEXT[] NOT NULL DEFAULT '{}',
  songbooks JSONB NOT NULL DEFAULT '[]'::jsonb,
  ppt_url TEXT,
  bible_verses JSONB NOT NULL DEFAULT '[]'::jsonb,
  devotional JSONB DEFAULT NULL,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "songs_select_public" ON public.songs;
CREATE POLICY "songs_select_public"
  ON public.songs FOR SELECT
  USING (
    is_published = true OR (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
      )
    )
  );

DROP POLICY IF EXISTS "songs_insert_admin" ON public.songs;
CREATE POLICY "songs_insert_admin"
  ON public.songs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "songs_update_admin" ON public.songs;
CREATE POLICY "songs_update_admin"
  ON public.songs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "songs_delete_admin" ON public.songs;
CREATE POLICY "songs_delete_admin"
  ON public.songs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP TRIGGER IF EXISTS songs_updated_at ON public.songs;
CREATE TRIGGER songs_updated_at
  BEFORE UPDATE ON public.songs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- -----------------------------------------------------------------------------
-- 5. Songbook-Songs Junction Table (Relational Association & Numbering)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.songbook_songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  songbook_id UUID NOT NULL REFERENCES public.songbooks(id) ON DELETE CASCADE,
  song_number INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_songbook_songs UNIQUE (song_id, songbook_id)
);

ALTER TABLE public.songbook_songs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "songbook_songs_select_public" ON public.songbook_songs;
CREATE POLICY "songbook_songs_select_public"
  ON public.songbook_songs FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "songbook_songs_write_admin" ON public.songbook_songs;
CREATE POLICY "songbook_songs_write_admin"
  ON public.songbook_songs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- -----------------------------------------------------------------------------
-- 6. Indexes for Performance & Filtering
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_songs_language ON public.songs (language);
CREATE INDEX IF NOT EXISTS idx_songs_alphabet ON public.songs (language, alphabet);
CREATE INDEX IF NOT EXISTS idx_songs_title_transliterated ON public.songs (title_transliterated);
CREATE INDEX IF NOT EXISTS idx_songs_categories ON public.songs USING GIN (category_names);
CREATE INDEX IF NOT EXISTS idx_songs_published ON public.songs (is_published);
CREATE INDEX IF NOT EXISTS idx_songbook_songs_lookup ON public.songbook_songs (songbook_id, song_number);
CREATE INDEX IF NOT EXISTS idx_songbook_songs_song ON public.songbook_songs (song_id);
