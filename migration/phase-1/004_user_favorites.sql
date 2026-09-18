-- =============================================================================
-- Phase 1: Authenticated Personal Favorites
-- All Christian Songs — Database Migration
-- =============================================================================
-- Migration: 004_user_favorites.sql
-- Purpose: Create public.user_favorites table with composite primary key,
--          foreign keys to auth.users and public.songs, foreign key index,
--          and privacy-preserving Row Level Security (RLS) policies.
-- Safety: Non-destructive. Uses CREATE TABLE IF NOT EXISTS.
--         Does NOT drop any existing tables, alter columns, or modify catalog data.
-- =============================================================================

-- 1. Create public.user_favorites table
CREATE TABLE IF NOT EXISTS public.user_favorites (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, song_id)
);

-- 2. Performance Index for foreign key cascades on song deletions
CREATE INDEX IF NOT EXISTS idx_user_favorites_song_id
  ON public.user_favorites (song_id);

-- 3. Enable and enforce Row Level Security
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_favorites FORCE ROW LEVEL SECURITY;

-- 4. Clean up any existing policies (idempotent setup)
DROP POLICY IF EXISTS "user_favorites_select_own" ON public.user_favorites;
DROP POLICY IF EXISTS "user_favorites_insert_own" ON public.user_favorites;
DROP POLICY IF EXISTS "user_favorites_delete_own" ON public.user_favorites;

-- 5. RLS Policies: Authenticated users can ONLY SELECT, INSERT, and DELETE their own favorites.
-- Anonymous users have NO policies (denied by default).
-- Administrators have NO bypass policies (personal favorites remain strictly private).

CREATE POLICY "user_favorites_select_own"
  ON public.user_favorites FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_favorites_insert_own"
  ON public.user_favorites FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_favorites_delete_own"
  ON public.user_favorites FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
