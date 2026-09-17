-- =============================================================================
-- Phase 2.1: Security Hardening Before Song Migration
-- All Christian Songs — Database Security Hardening
-- =============================================================================
-- Date: 2026-09-17
-- Purpose:
--   1. Fix pinned_songs RLS: Purge legacy permissive policies so anonymous
--      and non-admin writes (INSERT, UPDATE, DELETE) are strictly blocked.
--   2. Implement safe SECURITY DEFINER helper function public.is_admin()
--      with empty search_path to prevent recursive RLS and escalation.
--   3. Prevent profile self-promotion: Lock down profiles table so users
--      cannot self-assign role = 'admin' or alter roles on update.
--   4. Update catalog RLS policies (songs, songbooks, categories, languages,
--      songbook_songs) to use public.is_admin().
--   5. Restrict public profile exposure: Profiles can only be viewed by the
--      owning user or administrators.
--
-- Safety: Non-destructive.
--   - Does NOT delete or modify existing pinned_songs row(s).
--   - Does NOT drop any tables or alter table column definitions.
--   - Does NOT import songs.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Helper Function: public.is_admin()
-- -----------------------------------------------------------------------------
-- Securely verifies whether the current auth.uid() has role = 'admin' in profiles.
-- - SECURITY DEFINER: Executes with definer privileges to avoid RLS recursion.
-- - SET search_path = '': Prevents search_path hijacking vulnerabilities.
-- - STABLE: Optimizes performance within a single query transaction.
-- - Returns FALSE for unauthenticated (anon) requests where auth.uid() IS NULL.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Hardening: public.pinned_songs RLS & Policy Purge
-- -----------------------------------------------------------------------------
-- Dynamically drops any legacy/permissive policies from initial table setup,
-- ensuring no OR-based permissive policy allows unauthorized anonymous writes.

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pinned_songs'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.pinned_songs', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.pinned_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pinned_songs FORCE ROW LEVEL SECURITY;

-- Anonymous and authenticated visitors can read pinned songs
CREATE POLICY "pinned_songs_select_public"
  ON public.pinned_songs FOR SELECT
  USING (true);

-- Only verified administrators can insert pinned songs
CREATE POLICY "pinned_songs_insert_admin"
  ON public.pinned_songs FOR INSERT
  WITH CHECK (public.is_admin());

-- Only verified administrators can update pinned songs
CREATE POLICY "pinned_songs_update_admin"
  ON public.pinned_songs FOR UPDATE
  USING (public.is_admin());

-- Only verified administrators can delete pinned songs
CREATE POLICY "pinned_songs_delete_admin"
  ON public.pinned_songs FOR DELETE
  USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- 3. Hardening: public.profiles Role Escalation Protection
-- -----------------------------------------------------------------------------
-- Guarantees users cannot promote themselves or others to 'admin'.

-- A. Trigger function to block non-admin role modification
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- If role is being changed, verify caller is an admin
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Permission denied: Cannot modify user roles.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_protect_profile_role ON public.profiles;
CREATE TRIGGER tr_protect_profile_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_role();

-- B. Ensure signup handler always assigns role = 'user'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    'user' -- Inviolable default
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- C. Replace profiles RLS policies
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

-- Profiles are private: only the profile owner or an administrator can view
CREATE POLICY "profiles_select_own_or_admin"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

-- Users can only insert their own profile with role = 'user'
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id AND role = 'user');

-- Users can update their own non-role fields; admins can update any profile
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND (role = 'user' OR public.is_admin()));

CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "profiles_delete_admin"
  ON public.profiles FOR DELETE
  USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- 4. Update Catalog Tables to use public.is_admin()
-- -----------------------------------------------------------------------------

-- A. Songs
DROP POLICY IF EXISTS "songs_select_public" ON public.songs;
CREATE POLICY "songs_select_public"
  ON public.songs FOR SELECT
  USING (is_published = true OR public.is_admin());

DROP POLICY IF EXISTS "songs_insert_admin" ON public.songs;
CREATE POLICY "songs_insert_admin"
  ON public.songs FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "songs_update_admin" ON public.songs;
CREATE POLICY "songs_update_admin"
  ON public.songs FOR UPDATE
  USING (public.is_admin());

DROP POLICY IF EXISTS "songs_delete_admin" ON public.songs;
CREATE POLICY "songs_delete_admin"
  ON public.songs FOR DELETE
  USING (public.is_admin());

-- B. Songbooks
DROP POLICY IF EXISTS "songbooks_write_admin" ON public.songbooks;
CREATE POLICY "songbooks_write_admin"
  ON public.songbooks FOR ALL
  USING (public.is_admin());

-- C. Songbook_Songs
DROP POLICY IF EXISTS "songbook_songs_write_admin" ON public.songbook_songs;
CREATE POLICY "songbook_songs_write_admin"
  ON public.songbook_songs FOR ALL
  USING (public.is_admin());

-- D. Languages
DROP POLICY IF EXISTS "languages_write_admin" ON public.languages;
CREATE POLICY "languages_write_admin"
  ON public.languages FOR ALL
  USING (public.is_admin());

-- E. Categories
DROP POLICY IF EXISTS "categories_write_admin" ON public.categories;
CREATE POLICY "categories_write_admin"
  ON public.categories FOR ALL
  USING (public.is_admin());
