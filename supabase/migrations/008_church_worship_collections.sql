-- =============================================================================
-- Phase 2C: Church Worship Repertoire & Song Collections Layer
-- All Christian Songs — Database Migration
-- =============================================================================
-- Migration: 008_church_worship_collections.sql
-- Purpose:
--   1. Safely extend public.product_features.phase CHECK constraint (product_features_phase_check)
--      to allow 'Phase 2C' while preserving all existing Phase 2A allowed values.
--   2. Idempotently register 'church_worship_collections' in public.product_features (if absent).
--   3. Create public.church_collections to store congregational song collections
--      (e.g., "Church Repertoire", "Sunday Morning", "Youth Praise", "Communion Hymns").
--   4. Create public.church_collection_items to link church collections to global songs
--      (public.songs) without duplicating song lyrics or stanzas, while recording
--      church-specific arrangement metadata (default_key, tempo_notes, arrangement_notes).
--   5. Implement helper functions with SECURITY DEFINER and fixed search_path:
--      - public.is_church_worship_feature_active(lookup_church_id)
--      - public.is_church_worship_curator(lookup_church_id)
--      - public.ensure_default_church_collection(p_church_id)
--   6. Implement database triggers enforcing strict invariants:
--      - Tenant immutability: church_id cannot be changed on collections or items.
--      - Relational immutability: collection_id and song_id cannot be altered on items.
--      - Item church_id must strictly equal its parent collection's church_id.
--      - Audit field immutability (created_at, created_by, added_at, added_by).
--      - Audit field system management (updated_at, updated_by).
--      - Default collection protection: cannot be deleted, renamed, or demoted.
--      - At most ONE default collection per church workspace (partial unique index).
--   7. Enforce strict Row Level Security (RLS) and FORCE RLS on both tables:
--      - Active church members can SELECT when Worship is effectively enabled.
--      - Active Worship Leaders and Pastors can mutate items and collections.
--      - Pastors only can DELETE custom collections.
--      - Database authorization enforces feature availability.
--      - Super Admin administrative bypass follows public.is_admin().
--
-- Safety: Non-destructive. Uses CREATE TABLE IF NOT EXISTS.
--         Does NOT modify existing profiles, songs, songbooks, pinned_songs,
--         user_favorites, churches, church_memberships, or church_features tables.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Extend product_features_phase_check Constraint for 'Phase 2C'
-- -----------------------------------------------------------------------------
-- In Phase 2A (005_product_features.sql), the phase column was constrained to:
-- ('Foundation', 'Phase 0', 'Phase 1', 'Phase 2A', 'Phase 2B', 'Phase 3', 'Future').
-- Here we safely extend it to accept 'Phase 2C' while preserving all existing allowed values.

DO $$
BEGIN
  -- If constraint exists and does not yet allow 'Phase 2C', update it safely
  IF EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'product_features'
      AND con.conname = 'product_features_phase_check'
      AND pg_get_constraintdef(con.oid) NOT LIKE '%Phase 2C%'
  ) THEN
    ALTER TABLE public.product_features
      DROP CONSTRAINT product_features_phase_check;

    ALTER TABLE public.product_features
      ADD CONSTRAINT product_features_phase_check
      CHECK (phase IN ('Foundation', 'Phase 0', 'Phase 1', 'Phase 2A', 'Phase 2B', 'Phase 2C', 'Phase 3', 'Future'));

  ELSIF NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'product_features'
      AND con.conname = 'product_features_phase_check'
  ) THEN
    ALTER TABLE public.product_features
      ADD CONSTRAINT product_features_phase_check
      CHECK (phase IN ('Foundation', 'Phase 0', 'Phase 1', 'Phase 2A', 'Phase 2B', 'Phase 2C', 'Phase 3', 'Future'));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Idempotent Registration of Platform Feature Flag (Insert Only If Absent)
-- -----------------------------------------------------------------------------

INSERT INTO public.product_features (
  id,
  display_name,
  description,
  category,
  phase,
  status,
  is_enabled,
  is_system,
  sort_order
)
VALUES (
  'church_worship_collections',
  'Church Worship Collections & Repertoire',
  'Congregational worship repertoire curation, custom collections, and rehearsal arrangement notes.',
  'worship',
  'Phase 2C',
  'active',
  true,
  false,
  105
)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. Create public.church_collections Table
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.church_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) >= 2 AND char_length(name) <= 100),
  description TEXT NOT NULL DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Collection name must be unique within a church
  CONSTRAINT uq_church_collection_name UNIQUE (church_id, name)
);

-- Invariant: At most ONE default collection per church workspace
CREATE UNIQUE INDEX IF NOT EXISTS uq_church_default_collection
  ON public.church_collections (church_id)
  WHERE (is_default = true);

-- Query optimization indexes
CREATE INDEX IF NOT EXISTS idx_church_collections_church_id
  ON public.church_collections (church_id);

CREATE INDEX IF NOT EXISTS idx_church_collections_sort
  ON public.church_collections (church_id, sort_order ASC);

-- -----------------------------------------------------------------------------
-- 4. Create public.church_collection_items Table
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.church_collection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES public.church_collections(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  default_key TEXT CHECK (default_key IS NULL OR char_length(default_key) <= 10),
  tempo_notes TEXT CHECK (tempo_notes IS NULL OR char_length(tempo_notes) <= 50),
  arrangement_notes TEXT CHECK (arrangement_notes IS NULL OR char_length(arrangement_notes) <= 1000),
  sort_order INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- A song cannot be duplicated within the same collection
  CONSTRAINT uq_collection_song UNIQUE (collection_id, song_id)
);

-- Query optimization indexes
CREATE INDEX IF NOT EXISTS idx_church_collection_items_collection_sort
  ON public.church_collection_items (collection_id, sort_order ASC);

CREATE INDEX IF NOT EXISTS idx_church_collection_items_church_song
  ON public.church_collection_items (church_id, song_id);

CREATE INDEX IF NOT EXISTS idx_church_collection_items_song
  ON public.church_collection_items (song_id);

-- -----------------------------------------------------------------------------
-- 5. Helper Functions (Hardened & Non-Recursive)
-- -----------------------------------------------------------------------------

-- Helper 1: Is the church worship feature effectively active for this church?
-- Effective State = Super Admin OR (Church Active AND Platform Feature ON AND Church Feature != OFF)
CREATE OR REPLACE FUNCTION public.is_church_worship_feature_active(lookup_church_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    -- Super Admin administrative bypass
    WHEN public.is_admin() THEN true

    -- Anonymous visitors never have active church worship access
    WHEN auth.uid() IS NULL THEN false

    -- 1. Church itself must exist and be operational ('active')
    WHEN NOT EXISTS (
      SELECT 1 FROM public.churches
      WHERE id = lookup_church_id AND status = 'active'
    ) THEN false

    -- 2. Platform Feature Ceiling must be enabled
    WHEN NOT EXISTS (
      SELECT 1 FROM public.product_features
      WHERE id = 'church_worship_collections' AND is_enabled = true
    ) THEN false

    -- 3. Church-level override must NOT be explicitly disabled (default true)
    WHEN EXISTS (
      SELECT 1 FROM public.church_features
      WHERE church_id = lookup_church_id
        AND feature_id = 'church_worship_collections'
        AND is_enabled = false
    ) THEN false

    ELSE true
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_church_worship_feature_active(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_church_worship_feature_active(UUID) TO authenticated;

-- Helper 2: Is caller an active Pastor or Worship Leader of an active church?
CREATE OR REPLACE FUNCTION public.is_church_worship_curator(lookup_church_id UUID)
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
        AND cm.role IN ('pastor', 'worship_leader')
        AND cm.status = 'active'
        AND c.status = 'active'
    )
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_church_worship_curator(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_church_worship_curator(UUID) TO authenticated;

-- Helper 3: Ensure the default "Church Repertoire" collection exists atomically
CREATE OR REPLACE FUNCTION public.ensure_default_church_collection(p_church_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_collection_id UUID;
  v_is_active_church BOOLEAN;
  v_is_member BOOLEAN;
  v_is_curator BOOLEAN;
BEGIN
  -- Authenticated caller required
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- 1. Tenant validation: Check if target church exists and is active
  SELECT (status = 'active') INTO v_is_active_church
  FROM public.churches
  WHERE id = p_church_id;

  IF v_is_active_church IS NULL OR v_is_active_church = false THEN
    RAISE EXCEPTION 'Target church workspace does not exist or is inactive.';
  END IF;

  -- 2. Tenant isolation: Caller must be an active member or curator of target church (or Super Admin)
  v_is_member := public.is_church_member(p_church_id);
  IF NOT v_is_member THEN
    RAISE EXCEPTION 'Access denied: caller is not an active member of target church.';
  END IF;

  -- 3. Check if default collection already exists
  SELECT id INTO v_collection_id
  FROM public.church_collections
  WHERE church_id = p_church_id AND is_default = true;

  IF v_collection_id IS NOT NULL THEN
    RETURN v_collection_id;
  END IF;

  -- 4. If default collection does not exist yet, caller must be a curator to initialize it
  v_is_curator := public.is_church_worship_curator(p_church_id);
  IF NOT v_is_curator THEN
    RAISE EXCEPTION 'Default collection has not been initialized for this church.';
  END IF;

  -- 5. Atomic, race-safe insertion using partial unique index constraint
  INSERT INTO public.church_collections (
    church_id,
    name,
    description,
    is_default,
    sort_order,
    created_by,
    updated_by
  )
  VALUES (
    p_church_id,
    'Church Repertoire',
    'Core congregational worship repertoire and hymns',
    true,
    0,
    auth.uid(),
    auth.uid()
  )
  ON CONFLICT (church_id) WHERE (is_default = true)
  DO NOTHING
  RETURNING id INTO v_collection_id;

  -- Handle concurrent insertion race condition gracefully
  IF v_collection_id IS NULL THEN
    SELECT id INTO v_collection_id
    FROM public.church_collections
    WHERE church_id = p_church_id AND is_default = true;
  END IF;

  RETURN v_collection_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_default_church_collection(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_default_church_collection(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 6. Triggers: Invariant & Audit Protection
-- -----------------------------------------------------------------------------

-- Trigger Function 1: Invariant & Audit Protection on church_collections
CREATE OR REPLACE FUNCTION public.trg_fn_church_collections_invariants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Audit fields on insert
    NEW.created_at := now();
    NEW.updated_at := now();
    IF NEW.created_by IS NULL THEN
      NEW.created_by := auth.uid();
    END IF;
    NEW.updated_by := auth.uid();
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- 1. Tenant immutability: church_id cannot change after INSERT
    IF NEW.church_id IS DISTINCT FROM OLD.church_id THEN
      RAISE EXCEPTION 'Security violation: church_id cannot be modified or reassigned.';
    END IF;

    -- 2. Audit fields immutability
    NEW.created_at := OLD.created_at;
    NEW.created_by := OLD.created_by;

    -- 3. System-managed audit fields
    NEW.updated_at := now();
    NEW.updated_by := auth.uid();

    -- 4. Default collection demotion protection
    IF OLD.is_default = true AND NEW.is_default = false THEN
      RAISE EXCEPTION 'Operational invariant: default church collection cannot be demoted.';
    END IF;

    -- 5. Default collection rename protection
    IF OLD.is_default = true AND NEW.name IS DISTINCT FROM OLD.name THEN
      RAISE EXCEPTION 'Operational invariant: default church collection name cannot be renamed.';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- 6. Default collection deletion protection
    IF OLD.is_default = true THEN
      RAISE EXCEPTION 'Operational invariant: default church collection cannot be deleted.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_church_collections_invariants ON public.church_collections;
CREATE TRIGGER trg_church_collections_invariants
  BEFORE INSERT OR UPDATE OR DELETE ON public.church_collections
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_church_collections_invariants();

-- Trigger Function 2: Invariant & Audit Protection on church_collection_items
CREATE OR REPLACE FUNCTION public.trg_fn_church_collection_items_invariants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_parent_church_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- 1. Resolve parent collection's church_id strictly
    SELECT church_id INTO v_parent_church_id
    FROM public.church_collections
    WHERE id = NEW.collection_id;

    IF v_parent_church_id IS NULL THEN
      RAISE EXCEPTION 'Integrity error: parent church collection does not exist.';
    END IF;

    -- Enforce item church_id strictly matches parent collection
    NEW.church_id := v_parent_church_id;

    -- System-managed audit fields on insert
    NEW.added_at := now();
    NEW.updated_at := now();
    IF NEW.added_by IS NULL THEN
      NEW.added_by := auth.uid();
    END IF;
    NEW.updated_by := auth.uid();
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- 2. Prevent reassignment across collections, churches, or songs
    IF NEW.collection_id IS DISTINCT FROM OLD.collection_id THEN
      RAISE EXCEPTION 'Security violation: collection_id cannot be modified.';
    END IF;

    IF NEW.church_id IS DISTINCT FROM OLD.church_id THEN
      RAISE EXCEPTION 'Security violation: church_id cannot be modified.';
    END IF;

    IF NEW.song_id IS DISTINCT FROM OLD.song_id THEN
      RAISE EXCEPTION 'Security violation: song_id cannot be modified in existing item.';
    END IF;

    -- 3. Audit fields immutability
    NEW.added_at := OLD.added_at;
    NEW.added_by := OLD.added_by;

    -- 4. System-managed audit fields
    NEW.updated_at := now();
    NEW.updated_by := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_church_collection_items_invariants ON public.church_collection_items;
CREATE TRIGGER trg_church_collection_items_invariants
  BEFORE INSERT OR UPDATE ON public.church_collection_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_church_collection_items_invariants();

-- -----------------------------------------------------------------------------
-- 7. Row Level Security Policies
-- -----------------------------------------------------------------------------

-- Enable and FORCE Row Level Security on both tables
ALTER TABLE public.church_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.church_collections FORCE ROW LEVEL SECURITY;

ALTER TABLE public.church_collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.church_collection_items FORCE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Policies for public.church_collections
-- -----------------------------------------------------------------------------

-- SELECT: Active members of active church when feature is effectively active
DROP POLICY IF EXISTS "church_collections_select" ON public.church_collections;
CREATE POLICY "church_collections_select"
  ON public.church_collections FOR SELECT
  TO authenticated
  USING (
    public.is_church_member(church_id) AND
    public.is_church_worship_feature_active(church_id)
  );

-- INSERT: Active Pastor or Worship Leader when feature is active
DROP POLICY IF EXISTS "church_collections_insert" ON public.church_collections;
CREATE POLICY "church_collections_insert"
  ON public.church_collections FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_church_worship_curator(church_id) AND
    public.is_church_worship_feature_active(church_id) AND
    (created_by IS NULL OR created_by = auth.uid())
  );

-- UPDATE: Active Pastor or Worship Leader when feature is active
DROP POLICY IF EXISTS "church_collections_update" ON public.church_collections;
CREATE POLICY "church_collections_update"
  ON public.church_collections FOR UPDATE
  TO authenticated
  USING (
    public.is_church_worship_curator(church_id) AND
    public.is_church_worship_feature_active(church_id)
  )
  WITH CHECK (
    public.is_church_worship_curator(church_id) AND
    public.is_church_worship_feature_active(church_id)
  );

-- DELETE: Pastor only (Default collection deletion is blocked by trigger)
DROP POLICY IF EXISTS "church_collections_delete" ON public.church_collections;
CREATE POLICY "church_collections_delete"
  ON public.church_collections FOR DELETE
  TO authenticated
  USING (
    public.is_church_pastor(church_id) AND
    public.is_church_worship_feature_active(church_id)
  );

-- -----------------------------------------------------------------------------
-- Policies for public.church_collection_items
-- -----------------------------------------------------------------------------

-- SELECT: Active members of active church when feature is effectively active
DROP POLICY IF EXISTS "church_collection_items_select" ON public.church_collection_items;
CREATE POLICY "church_collection_items_select"
  ON public.church_collection_items FOR SELECT
  TO authenticated
  USING (
    public.is_church_member(church_id) AND
    public.is_church_worship_feature_active(church_id)
  );

-- INSERT: Active Pastor or Worship Leader when feature is active
DROP POLICY IF EXISTS "church_collection_items_insert" ON public.church_collection_items;
CREATE POLICY "church_collection_items_insert"
  ON public.church_collection_items FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_church_worship_curator(church_id) AND
    public.is_church_worship_feature_active(church_id) AND
    (added_by IS NULL OR added_by = auth.uid())
  );

-- UPDATE: Active Pastor or Worship Leader when feature is active
DROP POLICY IF EXISTS "church_collection_items_update" ON public.church_collection_items;
CREATE POLICY "church_collection_items_update"
  ON public.church_collection_items FOR UPDATE
  TO authenticated
  USING (
    public.is_church_worship_curator(church_id) AND
    public.is_church_worship_feature_active(church_id)
  )
  WITH CHECK (
    public.is_church_worship_curator(church_id) AND
    public.is_church_worship_feature_active(church_id)
  );

-- DELETE: Active Pastor or Worship Leader when feature is active
DROP POLICY IF EXISTS "church_collection_items_delete" ON public.church_collection_items;
CREATE POLICY "church_collection_items_delete"
  ON public.church_collection_items FOR DELETE
  TO authenticated
  USING (
    public.is_church_worship_curator(church_id) AND
    public.is_church_worship_feature_active(church_id)
  );
