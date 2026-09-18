-- =============================================================================
-- Phase 2B Security Hardening: Inactive Church Access Fix
-- All Christian Songs — Database Migration
-- =============================================================================
-- Migration: 007_church_inactive_access_fix.sql
-- Purpose:
--   1. Harden public.is_church_member() to verify public.churches.status = 'active'.
--   2. Harden public.is_church_pastor() to verify public.churches.status = 'active'.
--   3. Update churches_select_members policy on public.churches to require
--      status = 'active', preventing members from querying deactivated workspaces.
--   4. Update church_memberships_insert_request policy to prevent submitting
--      join requests to inactive churches.
--   5. Maintain Super Admin (public.is_admin()) full administrative bypass.
--
-- Safety: Non-destructive. Modifies 2 functions and 2 RLS policies.
--         Does NOT drop any tables or modify existing catalog data.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Helper Function: public.is_church_member(lookup_church_id UUID)
-- -----------------------------------------------------------------------------
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
      FROM public.church_memberships cm
      JOIN public.churches c ON c.id = cm.church_id
      WHERE cm.church_id = lookup_church_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND c.status = 'active'
    )
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_church_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_church_member(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. Helper Function: public.is_church_pastor(lookup_church_id UUID)
-- -----------------------------------------------------------------------------
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
      FROM public.church_memberships cm
      JOIN public.churches c ON c.id = cm.church_id
      WHERE cm.church_id = lookup_church_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'pastor'
        AND cm.status = 'active'
        AND c.status = 'active'
    )
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_church_pastor(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_church_pastor(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Policy: churches_select_members on public.churches
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "churches_select_members" ON public.churches;

CREATE POLICY "churches_select_members"
  ON public.churches FOR SELECT
  TO authenticated
  USING (
    status = 'active' AND
    EXISTS (
      SELECT 1 FROM public.church_memberships cm
      WHERE cm.church_id = public.churches.id
        AND cm.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 4. Policy: church_memberships_insert_request on public.church_memberships
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "church_memberships_insert_request" ON public.church_memberships;

CREATE POLICY "church_memberships_insert_request"
  ON public.church_memberships FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    role = 'member' AND
    status = 'pending' AND
    EXISTS (
      SELECT 1 FROM public.churches c
      WHERE c.id = church_id
        AND c.status = 'active'
    )
  );
