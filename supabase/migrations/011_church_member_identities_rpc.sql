-- =============================================================================
-- Migration 011: Church-Scoped Member Identity Resolution RPC
-- All Christian Songs — Phase 2C Roster Identity Architecture
-- =============================================================================
-- Purpose:
--   Provide a secure, tenant-isolated mechanism for active church members
--   (including local Pastors) to view member identities (full_name, platform_role)
--   within their own church workspace, without weakening or altering global
--   profiles RLS (profiles_select_own_or_admin).
--
-- Security Guarantees:
--   1. Caller must be authenticated (auth.uid() IS NOT NULL).
--   2. Target church must exist and have status = 'active'.
--   3. Caller must have an active membership in target church, OR be a platform admin.
--   4. Tenant Isolation: Only returns members of p_church_id.
--   5. Data Minimization: Returns ONLY user_id, full_name, platform_role.
--      Zero email, passwords, phone, auth tokens, or private metadata exposed.
--   6. SECURITY DEFINER with search_path = '' prevents schema hijacking.
--   7. Global profiles table RLS remains untouched and private.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_church_member_identities(p_church_id UUID)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  platform_role TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- 1. Authentication check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- 2. Input validation
  IF p_church_id IS NULL THEN
    RAISE EXCEPTION 'Valid church ID is required.';
  END IF;

  -- 3. Target church active validation
  IF NOT EXISTS (
    SELECT 1 FROM public.churches c
    WHERE c.id = p_church_id
      AND c.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Church workspace not found or currently inactive.';
  END IF;

  -- 4. Tenant isolation & authorization check:
  -- Caller must be a Platform Administrator or hold an active membership in this church.
  IF NOT (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.church_memberships cm
      WHERE cm.church_id = p_church_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  ) THEN
    RAISE EXCEPTION 'Access denied. Active church membership or platform admin privileges required.';
  END IF;

  -- 5. Return church-scoped member identities (supporting both active and pending members)
  RETURN QUERY
  SELECT DISTINCT
    cm.user_id,
    COALESCE(NULLIF(TRIM(p.full_name), ''), 'Unnamed user')::TEXT AS full_name,
    COALESCE(p.role, 'user')::TEXT AS platform_role
  FROM public.church_memberships cm
  LEFT JOIN public.profiles p ON p.id = cm.user_id
  WHERE cm.church_id = p_church_id;
END;
$$;

-- Privileges: revoke from public, grant to authenticated
REVOKE EXECUTE ON FUNCTION public.get_church_member_identities(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_church_member_identities(UUID) TO authenticated;

-- Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
