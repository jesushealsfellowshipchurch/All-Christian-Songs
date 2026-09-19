-- =============================================================================
-- Migration: 009_church_creation_admin_only.sql
-- Phase 2C Security Hardening: Restrict Church Creation to Super Admin
-- All Christian Songs — Database Migration
-- =============================================================================
-- Purpose:
--   1. Replace the overly permissive "churches_insert_authenticated" RLS policy
--      with an admin-restricted "churches_insert_admin" policy on public.churches.
--   2. Ensure only verified platform Super Admins (public.is_admin() = true)
--      are authorized to create church workspaces.
--   3. Block normal authenticated users (profiles.role = 'user') from creating
--      churches and automatically acquiring unearned Pastor status.
--   4. Preserve all existing triggers (enforce_church_invariants and
--      assign_initial_church_pastor) so Super Admin creators continue to become
--      the initial active Pastor seamlessly.
--
-- Security Rules:
--   - Anonymous visitors: CANNOT create churches.
--   - Normal authenticated users (profiles.role = 'user'): CANNOT create churches.
--   - Worship Leaders / Pastors of existing churches: CANNOT create new churches
--     unless they are also platform Super Admins (public.is_admin() = true).
--   - Platform Super Admins (profiles.role = 'admin'): CAN create church workspaces.
--   - Creator automatically becomes initial active Pastor via existing trigger.
--
-- Safety: Non-destructive. Modifies RLS policy only.
--         Does NOT modify existing churches, church_memberships, church_features,
--         or church_collections data.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Restrict Church Workspace Creation to Super Admins via RLS
-- -----------------------------------------------------------------------------

-- Drop the overly permissive authenticated user insert policy
DROP POLICY IF EXISTS "churches_insert_authenticated" ON public.churches;
DROP POLICY IF EXISTS "churches_insert_admin" ON public.churches;

-- Create the authoritative Super Admin-only INSERT policy
CREATE POLICY "churches_insert_admin"
  ON public.churches FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());
