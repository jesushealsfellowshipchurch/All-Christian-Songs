-- =============================================================================
-- Phase 2B: Multi-Church Workspace Foundation
-- All Christian Songs — Database Migration
-- =============================================================================
-- Migration: 006_church_foundation.sql
-- Purpose:
--   1. Create public.churches to store congregation workspaces, profiles,
--      operational status ('active' | 'inactive'), and verification state
--      ('unverified' | 'verified' | 'rejected').
--   2. Create public.church_memberships to store multi-church affiliations,
--      church-scoped roles ('pastor' | 'worship_leader' | 'member'), and
--      membership statuses ('pending' | 'active' | 'suspended').
--   3. Create public.church_features to store church-level feature overrides
--      inheriting from platform product_features.
--   4. Implement database triggers enforcing invariants:
--      - New church workspaces always begin as status = 'active',
--        verification_status = 'unverified', and created_by = auth.uid().
--      - Atomic creator -> initial active pastor assignment in church_memberships.
--      - Status and verification fields can ONLY be mutated by Super Admins.
--      - The last active pastor of an active church cannot be removed, demoted,
--        or suspended.
--   5. Implement non-recursive SECURITY DEFINER helper functions:
--      - public.is_church_pastor(church_id)
--      - public.is_church_member(church_id)
--      - public.lookup_church_for_join(p_slug)
--   6. Enforce strict Row Level Security (RLS) and FORCE RLS on all 3 tables.
--
-- Safety: Non-destructive. Uses CREATE TABLE IF NOT EXISTS.
--         Does NOT modify existing profiles, songs, songbooks, pinned_songs,
--         user_favorites, or product_features tables.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Create public.churches Table
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.churches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) >= 2),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) BETWEEN 3 AND 60),
  description TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state_province TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'India',
  website_url TEXT,
  logo_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'verified', 'rejected')),
  verification_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes for churches
CREATE UNIQUE INDEX IF NOT EXISTS idx_churches_slug
  ON public.churches (slug);

CREATE INDEX IF NOT EXISTS idx_churches_directory_filter
  ON public.churches (is_public, status, verification_status);

CREATE INDEX IF NOT EXISTS idx_churches_created_by
  ON public.churches (created_by);

-- -----------------------------------------------------------------------------
-- 2. Create public.church_memberships Table
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.church_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('pastor', 'worship_leader', 'member')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Multi-church membership: Unique compound constraint prevents duplicate requests
  CONSTRAINT uq_church_user_membership UNIQUE (church_id, user_id)
);

-- Indexes for church_memberships
CREATE INDEX IF NOT EXISTS idx_church_memberships_church_id
  ON public.church_memberships (church_id);

CREATE INDEX IF NOT EXISTS idx_church_memberships_user_id
  ON public.church_memberships (user_id);

CREATE INDEX IF NOT EXISTS idx_church_memberships_lookup
  ON public.church_memberships (church_id, user_id, status);

-- -----------------------------------------------------------------------------
-- 3. Create public.church_features Table
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.church_features (
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  feature_id TEXT NOT NULL REFERENCES public.product_features(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  PRIMARY KEY (church_id, feature_id)
);

CREATE INDEX IF NOT EXISTS idx_church_features_church_id
  ON public.church_features (church_id);

-- -----------------------------------------------------------------------------
-- 4. Helper Functions (Non-Recursive & Hardened)
-- -----------------------------------------------------------------------------

-- Helper 1: Is user an active pastor of this church (or Super Admin)?
CREATE OR REPLACE FUNCTION public.is_church_pastor(lookup_church_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN public.is_admin() THEN true
    ELSE EXISTS (
      SELECT 1
      FROM public.church_memberships
      WHERE church_id = lookup_church_id
        AND user_id = auth.uid()
        AND role = 'pastor'
        AND status = 'active'
    )
  END;
$$;

-- Helper 2: Is user an active member of this church (any role, or Super Admin)?
CREATE OR REPLACE FUNCTION public.is_church_member(lookup_church_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN public.is_admin() THEN true
    ELSE EXISTS (
      SELECT 1
      FROM public.church_memberships
      WHERE church_id = lookup_church_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  END;
$$;

-- Helper 3: Hardened Slug Lookup for Join Request (Minimal public/authenticated metadata)
CREATE OR REPLACE FUNCTION public.lookup_church_for_join(p_slug TEXT)
RETURNS TABLE (
  church_id UUID,
  name TEXT,
  city TEXT,
  logo_url TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.id, c.name, c.city, c.logo_url
  FROM public.churches c
  WHERE c.slug = p_slug
    AND c.status = 'active';
$$;

REVOKE EXECUTE ON FUNCTION public.is_church_pastor(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_church_pastor(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_church_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_church_member(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.lookup_church_for_join(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_church_for_join(TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. Database Triggers & Invariants
-- -----------------------------------------------------------------------------

-- Trigger 1: Enforce creation invariants and protect verification & operational status
CREATE OR REPLACE FUNCTION public.enforce_church_invariants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- INSERT INVARIANTS: Forced secure defaults
  IF TG_OP = 'INSERT' THEN
    NEW.created_by          := auth.uid();
    NEW.status              := 'active';
    NEW.verification_status := 'unverified';
    NEW.verification_notes  := NULL;
    NEW.created_at          := now();
    NEW.updated_at          := now();
    RETURN NEW;
  END IF;

  -- UPDATE INVARIANTS: Role & Status Column Protection
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();

    -- Protected fields: status, verification_status, verification_notes, created_by
    -- Only Super Admins (public.is_admin() = true) are permitted to alter these columns.
    IF NOT public.is_admin() THEN
      -- 1. Operational status protection
      IF OLD.status IS DISTINCT FROM NEW.status THEN
        RAISE EXCEPTION 'Unauthorized: Only Super Admins can alter church operational status.';
      END IF;

      -- 2. Verification status & notes protection
      IF OLD.verification_status IS DISTINCT FROM NEW.verification_status OR
         OLD.verification_notes IS DISTINCT FROM NEW.verification_notes THEN
        RAISE EXCEPTION 'Unauthorized: Only Super Admins can alter church verification status or notes.';
      END IF;

      -- 3. Created_by immutability
      IF OLD.created_by IS DISTINCT FROM NEW.created_by THEN
        RAISE EXCEPTION 'Immutable: The created_by audit field cannot be altered.';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_church_invariants ON public.churches;

CREATE TRIGGER trg_church_invariants
  BEFORE INSERT OR UPDATE ON public.churches
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_church_invariants();

-- Trigger 2: Atomically assign church creator as initial active Pastor
CREATE OR REPLACE FUNCTION public.assign_initial_church_pastor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.church_memberships (
      church_id,
      user_id,
      role,
      status,
      updated_by
    ) VALUES (
      NEW.id,
      NEW.created_by,
      'pastor',
      'active',
      NEW.created_by
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_church_created ON public.churches;

CREATE TRIGGER trg_on_church_created
  AFTER INSERT ON public.churches
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_initial_church_pastor();

-- Trigger 3: Protect the last active pastor of an active church
CREATE OR REPLACE FUNCTION public.protect_last_active_pastor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_church_status TEXT;
  v_remaining_pastors INTEGER;
BEGIN
  -- Target only operations that strip active pastor privileges
  IF (TG_OP = 'DELETE' AND OLD.role = 'pastor' AND OLD.status = 'active') OR
     (TG_OP = 'UPDATE' AND OLD.role = 'pastor' AND OLD.status = 'active' AND
      (NEW.role <> 'pastor' OR NEW.status <> 'active')) THEN

    -- Retrieve current operational status of the church
    SELECT status INTO v_church_status
    FROM public.churches
    WHERE id = OLD.church_id;

    -- If the church is currently active, enforce at least 1 active pastor
    IF v_church_status = 'active' THEN
      SELECT COUNT(*) INTO v_remaining_pastors
      FROM public.church_memberships
      WHERE church_id = OLD.church_id
        AND role = 'pastor'
        AND status = 'active'
        AND id <> OLD.id;

      IF v_remaining_pastors = 0 THEN
        RAISE EXCEPTION 'Invariant Violation: Cannot remove, demote, or suspend the sole active pastor of an active church. Transfer the pastor role to another member first.';
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_last_active_pastor ON public.church_memberships;

CREATE TRIGGER trg_protect_last_active_pastor
  BEFORE UPDATE OR DELETE ON public.church_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_last_active_pastor();

-- -----------------------------------------------------------------------------
-- 6. Row Level Security (RLS) Policies
-- -----------------------------------------------------------------------------

-- 6.1 public.churches RLS
ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.churches FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "churches_select_public" ON public.churches;
DROP POLICY IF EXISTS "churches_select_members" ON public.churches;
DROP POLICY IF EXISTS "churches_select_admin" ON public.churches;
DROP POLICY IF EXISTS "churches_insert_authenticated" ON public.churches;
DROP POLICY IF EXISTS "churches_update_pastor" ON public.churches;
DROP POLICY IF EXISTS "churches_delete_admin" ON public.churches;

-- Public directory: Only verified + public + active churches are publicly discoverable
CREATE POLICY "churches_select_public"
  ON public.churches FOR SELECT
  TO anon, authenticated
  USING (is_public = true AND status = 'active' AND verification_status = 'verified');

-- Fellowship members: Can read their own church workspace record
CREATE POLICY "churches_select_members"
  ON public.churches FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.church_memberships cm
      WHERE cm.church_id = public.churches.id
        AND cm.user_id = auth.uid()
    )
  );

-- Super Admin: Full SELECT access across all churches
CREATE POLICY "churches_select_admin"
  ON public.churches FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Authenticated users: Can create a church workspace
CREATE POLICY "churches_insert_authenticated"
  ON public.churches FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Pastors or Super Admins: Can update church profile settings
CREATE POLICY "churches_update_pastor"
  ON public.churches FOR UPDATE
  TO authenticated
  USING (public.is_church_pastor(id))
  WITH CHECK (public.is_church_pastor(id));

-- Super Admin: Delete access
CREATE POLICY "churches_delete_admin"
  ON public.churches FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- 6.2 public.church_memberships RLS
ALTER TABLE public.church_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.church_memberships FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "church_memberships_select_own" ON public.church_memberships;
DROP POLICY IF EXISTS "church_memberships_select_roster" ON public.church_memberships;
DROP POLICY IF EXISTS "church_memberships_select_admin" ON public.church_memberships;
DROP POLICY IF EXISTS "church_memberships_insert_request" ON public.church_memberships;
DROP POLICY IF EXISTS "church_memberships_insert_pastor" ON public.church_memberships;
DROP POLICY IF EXISTS "church_memberships_update_pastor" ON public.church_memberships;
DROP POLICY IF EXISTS "church_memberships_delete" ON public.church_memberships;

-- Users can view their own memberships across all churches
CREATE POLICY "church_memberships_select_own"
  ON public.church_memberships FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Active members can view fellow members in the roster of their own church
CREATE POLICY "church_memberships_select_roster"
  ON public.church_memberships FOR SELECT
  TO authenticated
  USING (public.is_church_member(church_id));

-- Super Admin: View all memberships platform-wide
CREATE POLICY "church_memberships_select_admin"
  ON public.church_memberships FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Authenticated user requests to join as pending member
CREATE POLICY "church_memberships_insert_request"
  ON public.church_memberships FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND role = 'member' AND status = 'pending');

-- Pastor directly adds member (invite/manual add)
CREATE POLICY "church_memberships_insert_pastor"
  ON public.church_memberships FOR INSERT
  TO authenticated
  WITH CHECK (public.is_church_pastor(church_id));

-- Only Pastor or Super Admin can approve members or alter roles
CREATE POLICY "church_memberships_update_pastor"
  ON public.church_memberships FOR UPDATE
  TO authenticated
  USING (public.is_church_pastor(church_id))
  WITH CHECK (public.is_church_pastor(church_id));

-- User can leave (delete own row), or Pastor can remove member
CREATE POLICY "church_memberships_delete"
  ON public.church_memberships FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_church_pastor(church_id));

-- 6.3 public.church_features RLS
ALTER TABLE public.church_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.church_features FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "church_features_select" ON public.church_features;
DROP POLICY IF EXISTS "church_features_insert_pastor" ON public.church_features;
DROP POLICY IF EXISTS "church_features_update_pastor" ON public.church_features;
DROP POLICY IF EXISTS "church_features_delete_pastor" ON public.church_features;

-- Active church members can read church feature configs
CREATE POLICY "church_features_select"
  ON public.church_features FOR SELECT
  TO authenticated
  USING (public.is_church_member(church_id));

-- Pastor or Super Admin can insert feature overrides
CREATE POLICY "church_features_insert_pastor"
  ON public.church_features FOR INSERT
  TO authenticated
  WITH CHECK (public.is_church_pastor(church_id));

-- Pastor or Super Admin can update feature overrides
CREATE POLICY "church_features_update_pastor"
  ON public.church_features FOR UPDATE
  TO authenticated
  USING (public.is_church_pastor(church_id))
  WITH CHECK (public.is_church_pastor(church_id));

-- Pastor or Super Admin can delete feature overrides
CREATE POLICY "church_features_delete_pastor"
  ON public.church_features FOR DELETE
  TO authenticated
  USING (public.is_church_pastor(church_id));
