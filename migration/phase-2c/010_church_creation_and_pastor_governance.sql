-- =============================================================================
-- Migration: 010_church_creation_and_pastor_governance.sql
-- Phase 2C Step 4B: Church Creation & Pastor Governance Decoupling
-- All Christian Songs — Database Migration
-- =============================================================================
-- Purpose:
--   1. Remove automatic creator -> Pastor trigger (trg_on_church_created)
--      and function (assign_initial_church_pastor), preventing Super Admins from
--      being automatically appointed as local church Pastors upon church creation.
--   2. Allow church workspaces to validly exist with zero memberships in an
--      "Awaiting Pastor" state.
--   3. Harden is_public directory visibility in enforce_church_invariants()
--      so that only platform Super Admins (public.is_admin() = true) can modify
--      is_public, preventing unauthorized church directory publishing.
--   4. Harden Pastor role governance on public.church_memberships:
--      - Only Super Admin may INSERT or UPDATE memberships with role = 'pastor'.
--      - Active local Pastors continue managing role = 'member' and role = 'worship_leader'.
--      - Restrict membership deletion so non-admin pastors cannot delete other pastors.
--      - Preserve existing member join request flow and last-active-pastor protection.
--   5. Add secure admin_assign_church_pastor(p_church_id, p_user_id) RPC:
--      - Strictly Super Admin authorized.
--      - Validates target church exists and is active.
--      - Validates target user exists in public.profiles.
--      - Atomically creates or upgrades the membership to role = 'pastor' and status = 'active'.
--      - Records updated_by = auth.uid().
--      - Uses SET search_path = '', revokes PUBLIC execution.
--
-- Safety & Invariants:
--   - Non-destructive: No tables dropped, no rows truncated.
--   - Existing church_memberships rows are fully preserved (no silent data loss).
--   - Existing public.churches, church_features, church_collections, songs,
--     profiles, and favorites are 100% untouched.
--   - Preserves FORCE ROW LEVEL SECURITY on churches and church_memberships.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Remove Automatic Creator -> Pastor Trigger
-- -----------------------------------------------------------------------------

-- Drop the trigger that automatically enrolled church creator as Pastor
DROP TRIGGER IF EXISTS trg_on_church_created ON public.churches;

-- Drop the underlying trigger function
DROP FUNCTION IF EXISTS public.assign_initial_church_pastor();


-- -----------------------------------------------------------------------------
-- 2. Harden enforce_church_invariants() (Protect is_public)
-- -----------------------------------------------------------------------------

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

    -- Directory visibility (is_public) protection:
    -- Only Super Admins may create a church that is initially public.
    -- Non-admin creators (future self-service) are strictly forced to is_public = false.
    IF NOT public.is_admin() THEN
      NEW.is_public := false;
    ELSE
      NEW.is_public := COALESCE(NEW.is_public, false);
    END IF;

    RETURN NEW;
  END IF;

  -- UPDATE INVARIANTS: Role & Status Column Protection
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();

    -- Protected fields: status, verification_status, verification_notes, created_by, is_public
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

      -- 4. Directory visibility (is_public) protection
      IF OLD.is_public IS DISTINCT FROM NEW.is_public THEN
        RAISE EXCEPTION 'Unauthorized: Only Super Admins can alter church directory visibility.';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure trigger is cleanly bound to public.churches
DROP TRIGGER IF EXISTS trg_church_invariants ON public.churches;

CREATE TRIGGER trg_church_invariants
  BEFORE INSERT OR UPDATE ON public.churches
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_church_invariants();


-- -----------------------------------------------------------------------------
-- 3. Harden Pastor Role Governance on public.church_memberships
-- -----------------------------------------------------------------------------

-- 3.1 INSERT policy:
-- Super Admin can insert any role (including 'pastor').
-- Local church pastors can only insert 'member' or 'worship_leader'.
DROP POLICY IF EXISTS "church_memberships_insert_pastor" ON public.church_memberships;

CREATE POLICY "church_memberships_insert_pastor"
  ON public.church_memberships FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin() OR (
      public.is_church_pastor(church_id) AND role IN ('member', 'worship_leader')
    )
  );

-- 3.2 UPDATE policy:
-- Super Admin can update any membership (including promoting to 'pastor').
-- Local church pastors can only update/assign 'member' or 'worship_leader'.
DROP POLICY IF EXISTS "church_memberships_update_pastor" ON public.church_memberships;

CREATE POLICY "church_memberships_update_pastor"
  ON public.church_memberships FOR UPDATE
  TO authenticated
  USING (public.is_church_pastor(church_id))
  WITH CHECK (
    public.is_admin() OR (
      public.is_church_pastor(church_id) AND role IN ('member', 'worship_leader')
    )
  );

-- 3.3 DELETE policy:
-- Users can delete their own membership (subject to protect_last_active_pastor trigger).
-- Super Admin can remove any member or pastor.
-- Local church pastors can only remove 'member' or 'worship_leader' (cannot remove co-pastors).
DROP POLICY IF EXISTS "church_memberships_delete" ON public.church_memberships;

CREATE POLICY "church_memberships_delete"
  ON public.church_memberships FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    public.is_admin() OR
    (public.is_church_pastor(church_id) AND role IN ('member', 'worship_leader'))
  );


-- -----------------------------------------------------------------------------
-- 4. Super Admin Pastor Assignment RPC
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_assign_church_pastor(
  p_church_id UUID,
  p_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_church_status TEXT;
  v_user_exists BOOLEAN;
BEGIN
  -- 1. Authorization: Strictly Super Admins only
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admins can assign church pastors.';
  END IF;

  -- 2. Input validation
  IF p_church_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'Invalid parameters: church_id and user_id are required.';
  END IF;

  -- 3. Verify target church exists and is currently active
  SELECT status INTO v_church_status
  FROM public.churches
  WHERE id = p_church_id;

  IF v_church_status IS NULL THEN
    RAISE EXCEPTION 'Church not found: specified church workspace does not exist.';
  END IF;

  IF v_church_status <> 'active' THEN
    RAISE EXCEPTION 'Cannot assign pastor to an inactive church workspace.';
  END IF;

  -- 4. Verify target user exists in public.profiles
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_user_id
  ) INTO v_user_exists;

  IF NOT v_user_exists THEN
    RAISE EXCEPTION 'User not found: target user profile does not exist.';
  END IF;

  -- 5. Atomically create or update membership to active Pastor
  INSERT INTO public.church_memberships (
    church_id,
    user_id,
    role,
    status,
    updated_by,
    updated_at
  ) VALUES (
    p_church_id,
    p_user_id,
    'pastor',
    'active',
    auth.uid(),
    now()
  )
  ON CONFLICT (church_id, user_id)
  DO UPDATE SET
    role = 'pastor',
    status = 'active',
    updated_by = auth.uid(),
    updated_at = now();

  -- 6. Demote all other active pastors for this church to active members
  -- Note: Because p_user_id is already made active pastor above, protect_last_active_pastor
  -- invariant trigger check (v_remaining_pastors >= 1) succeeds cleanly.
  UPDATE public.church_memberships
  SET
    role = 'member',
    status = 'active',
    updated_by = auth.uid(),
    updated_at = now()
  WHERE church_id = p_church_id
    AND user_id <> p_user_id
    AND role = 'pastor'
    AND status = 'active';
END;
$$;

-- Security hardening on RPC execution:
REVOKE EXECUTE ON FUNCTION public.admin_assign_church_pastor(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_assign_church_pastor(UUID, UUID) TO authenticated;

-- Refresh PostgREST schema cache:
NOTIFY pgrst, 'reload schema';
