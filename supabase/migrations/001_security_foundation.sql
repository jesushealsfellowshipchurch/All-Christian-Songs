-- =============================================================================
-- Phase 1: Supabase Security Foundation
-- All Christian Songs — Database Migration
-- =============================================================================
-- Date: 2026-09-17
-- Purpose: Enable RLS on pinned_songs and create public read policy
-- Safety: Non-destructive. Does NOT drop table, delete rows, or alter columns.
-- =============================================================================

-- 1. Create profiles table for future auth integration
-- This table will link Supabase Auth users to application roles.
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Profiles RLS policies
-- Anyone can read profiles (needed for role checks in other policies)
DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
CREATE POLICY "profiles_select_public"
  ON public.profiles FOR SELECT
  USING (true);

-- Users can only update their own profile (not role)
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Only the user themselves can insert their profile (via trigger or signup)
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 4. Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    'user'
  );
  RETURN NEW;
END;
$$;

-- Drop trigger if it already exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5. Auto-update updated_at on profiles
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- =============================================================================
-- 6. Enable RLS on pinned_songs (CRITICAL SECURITY FIX)
-- =============================================================================
-- Currently pinned_songs has NO RLS — any anonymous client can INSERT/UPDATE/DELETE.
-- After this: anonymous users can only SELECT.

ALTER TABLE public.pinned_songs ENABLE ROW LEVEL SECURITY;

-- 7. Public read access for pinned songs (all visitors see today's service songs)
DROP POLICY IF EXISTS "pinned_songs_select_public" ON public.pinned_songs;
CREATE POLICY "pinned_songs_select_public"
  ON public.pinned_songs FOR SELECT
  USING (true);

-- 8. Admin-only write access for pinned songs
-- Only authenticated users with role='admin' in profiles can INSERT
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

-- Only authenticated users with role='admin' in profiles can UPDATE
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

-- Only authenticated users with role='admin' in profiles can DELETE
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
