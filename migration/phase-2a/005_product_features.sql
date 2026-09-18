-- =============================================================================
-- Phase 2A: Super Admin Product Journey & Feature Control
-- All Christian Songs — Database Migration
-- =============================================================================
-- Migration: 005_product_features.sql
-- Purpose:
--   1. Create public.product_features table to store platform roadmap metadata
--      and live runtime feature availability controls.
--   2. Database-level system feature protection: Enforce via CHECK constraint
--      and BEFORE UPDATE/DELETE trigger that is_system=true features cannot be
--      disabled or deleted.
--   3. Roadmap Privacy: Anonymous and non-admin visitors can ONLY read features
--      that are currently enabled (is_enabled = true). Unreleased, planned,
--      and future roadmap items (SaaS, subscriptions, etc.) are strictly
--      shielded by Row Level Security (RLS) from public visibility.
--   4. Administrative Authority: Only verified administrators via public.is_admin()
--      can view the full roadmap and mutate feature availability.
--   5. Seed the approved 14-feature catalog.
--
-- Safety: Non-destructive. Uses CREATE TABLE IF NOT EXISTS.
--         Does NOT drop any existing tables, alter columns, or modify catalog data.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Create public.product_features Table
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.product_features (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'core' CHECK (category IN ('core', 'worship', 'church', 'platform')),
  phase TEXT NOT NULL DEFAULT 'Phase 1' CHECK (phase IN ('Foundation', 'Phase 0', 'Phase 1', 'Phase 2A', 'Phase 2B', 'Phase 3', 'Future')),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('completed', 'active', 'ready', 'planned', 'deferred')),
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  is_system BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Database-Level System Feature Protection (Constraint)
  -- System features must ALWAYS remain enabled.
  CONSTRAINT chk_system_feature_enabled CHECK (NOT (is_system = true AND is_enabled = false))
);

-- Index for ordering and fast lookup
CREATE INDEX IF NOT EXISTS idx_product_features_sort_order
  ON public.product_features (sort_order ASC);

CREATE INDEX IF NOT EXISTS idx_product_features_enabled
  ON public.product_features (is_enabled);

-- -----------------------------------------------------------------------------
-- 2. Database-Level System Feature Protection (Trigger)
-- -----------------------------------------------------------------------------
-- Guarantees that:
--   - is_system features can NEVER be disabled by any update statement.
--   - is_system features can NEVER be deleted.
--   - updated_at is automatically updated on every modification.
--   - updated_by records the modifying administrator's auth.uid().

CREATE OR REPLACE FUNCTION public.protect_system_features()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Protection on DELETE: System features cannot be deleted
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_system = true THEN
      RAISE EXCEPTION 'System features are vital to platform operation and cannot be deleted.';
    END IF;
    RETURN OLD;
  END IF;

  -- Protection on UPDATE: System features cannot be disabled
  IF TG_OP = 'UPDATE' THEN
    IF OLD.is_system = true AND NEW.is_enabled = false THEN
      RAISE EXCEPTION 'System features are vital to platform operation and cannot be disabled.';
    END IF;

    -- Maintain updated_at timestamp
    NEW.updated_at = now();

    -- Automatically track modifying administrator if authenticated
    IF auth.uid() IS NOT NULL THEN
      NEW.updated_by = auth.uid();
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_product_features ON public.product_features;

CREATE TRIGGER trg_protect_product_features
  BEFORE UPDATE OR DELETE ON public.product_features
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_system_features();

-- -----------------------------------------------------------------------------
-- 3. Row Level Security (RLS) & Roadmap Privacy
-- -----------------------------------------------------------------------------

ALTER TABLE public.product_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_features FORCE ROW LEVEL SECURITY;

-- Clean up any existing policies (idempotent setup)
DROP POLICY IF EXISTS "product_features_select_admin" ON public.product_features;
DROP POLICY IF EXISTS "product_features_select_public" ON public.product_features;
DROP POLICY IF EXISTS "product_features_insert_admin" ON public.product_features;
DROP POLICY IF EXISTS "product_features_update_admin" ON public.product_features;
DROP POLICY IF EXISTS "product_features_delete_admin" ON public.product_features;

-- POLICY 1: Super Admin has full SELECT access to all features (including planned/future roadmap)
CREATE POLICY "product_features_select_admin"
  ON public.product_features FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- POLICY 2: Public Runtime Availability (Roadmap Privacy)
-- Anonymous and regular users can ONLY query features that are actively enabled.
-- All disabled, planned, ready, deferred, and future SaaS/subscription features
-- remain strictly invisible to non-admin users.
CREATE POLICY "product_features_select_public"
  ON public.product_features FOR SELECT
  TO anon, authenticated
  USING (is_enabled = true);

-- POLICY 3: Only Super Admin can INSERT new feature entries
CREATE POLICY "product_features_insert_admin"
  ON public.product_features FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- POLICY 4: Only Super Admin can UPDATE feature entries / toggles
CREATE POLICY "product_features_update_admin"
  ON public.product_features FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- POLICY 5: Only Super Admin can DELETE feature entries
CREATE POLICY "product_features_delete_admin"
  ON public.product_features FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- 4. Seed the Approved Feature Catalog (14 Features)
-- -----------------------------------------------------------------------------
-- Distinguishes Product Journey ("What are we building?") from
-- Feature Control ("What is available right now?").
-- Status: completed | active | ready | planned | deferred
-- Enabled: true | false
-- System: true | false

INSERT INTO public.product_features (
  id, display_name, description, category, phase, status, is_enabled, is_system, sort_order
) VALUES
  -- Foundation System Features (All completed + enabled + system-locked)
  (
    'song_catalog',
    'Song Catalog & Search',
    'Instant search, filtering, and lyric viewing for 3,774+ Telugu, English, and Hindi songs.',
    'core',
    'Foundation',
    'completed',
    true,
    true,
    10
  ),
  (
    'songbooks',
    'Songbooks Index',
    'Curated songbooks including Andhra Christian Hymnal and Hosanna Ministries collections.',
    'core',
    'Foundation',
    'completed',
    true,
    true,
    20
  ),
  (
    'authentication',
    'Authentication & Profiles',
    'Supabase Auth with role-based access control and profile synchronization.',
    'core',
    'Foundation',
    'completed',
    true,
    true,
    30
  ),
  (
    'admin_portal',
    'Admin Song Management',
    'Secure song creation, editing, unpublishing, and songbook curation for administrators.',
    'platform',
    'Foundation',
    'completed',
    true,
    true,
    40
  ),

  -- Live User-Facing Features (Phase 0 - Phase 2A)
  (
    'todays_service',
    'Today''s Service (Pinned Songs)',
    'Featured worship songs pinned on the landing page for Sunday service and gatherings.',
    'worship',
    'Phase 0',
    'active',
    true,
    false,
    50
  ),
  (
    'personal_favorites',
    'Cloud-Synced Personal Favorites',
    'Personal bookmarking with cross-device sync and automatic guest migration.',
    'worship',
    'Phase 1',
    'active',
    true,
    false,
    60
  ),
  (
    'feature_control',
    'Platform Journey & Feature Control',
    'Super Admin roadmap oversight and live runtime feature availability controls.',
    'platform',
    'Phase 2A',
    'active',
    true,
    true,
    70
  ),
  (
    'presentation_mode',
    'Presentation / Projector Mode',
    'Distraction-free fullscreen projection display for sanctuary projectors and live streams.',
    'worship',
    'Phase 2A',
    'completed',
    true,
    false,
    80
  ),

  -- Ready Feature (Ready but disabled until release)
  (
    'chord_transposer',
    'Chord Transposition & Nashville Numbers',
    'Dynamic key changes and Nashville number representation for worship team musicians.',
    'worship',
    'Phase 2B',
    'ready',
    false,
    false,
    90
  ),

  -- Future Roadmap Features (Planned, disabled, private from public view)
  (
    'church_workspaces',
    'Church Profiles & Workspaces',
    'Dedicated congregation profiles with custom service banners and church identity.',
    'church',
    'Phase 2B',
    'planned',
    false,
    false,
    100
  ),
  (
    'worship_team_roles',
    'Worship Team & Pastor Roles',
    'Collaborative role-based access for pastors, worship leaders, and AV crew.',
    'church',
    'Phase 2B',
    'planned',
    false,
    false,
    110
  ),
  (
    'church_service_order',
    'Service Order & Setlists',
    'Ordered liturgy, song line-ups, and coordinated team rehearsal sets.',
    'church',
    'Phase 3',
    'planned',
    false,
    false,
    120
  ),
  (
    'offline_pwa',
    'Offline Progressive Web App',
    'Installable application with cached songs for uninterrupted rural ministry.',
    'platform',
    'Phase 3',
    'planned',
    false,
    false,
    130
  ),
  (
    'church_subscriptions',
    'Church Membership & SaaS Tiers',
    'Congregation subscription management and multi-campus ministry features.',
    'church',
    'Future',
    'planned',
    false,
    false,
    140
  )
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  phase = EXCLUDED.phase,
  status = EXCLUDED.status,
  -- Only update is_enabled on initial insert or keep existing enabled status on conflicts
  is_enabled = CASE
    WHEN EXCLUDED.is_system THEN true
    ELSE public.product_features.is_enabled
  END,
  is_system = EXCLUDED.is_system,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
