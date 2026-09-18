/**
 * churchService.js — Multi-Church Workspace Foundation Domain Service
 *
 * All Christian Songs — Phase 2B Multi-Church Workspace Foundation
 *
 * Responsibilities:
 * 1. Centralized Two-Tier Feature Resolution (Platform Ceiling + Church Override).
 * 2. Church Workspace CRUD (Profile, Directory, Direct Slug Lookup via RPC).
 * 3. Fellowship Membership Management (Join Requests, Approvals, Role Assignments).
 * 4. Church-Level Feature Override Configuration.
 * 5. Super Admin Church Oversight (Verification, Operational Status, Moderation).
 * 6. Offline / Pre-migration Fallback Resilience.
 *
 * Security Architecture:
 * - Client-side validation acts purely as a UX guide.
 * - PostgreSQL RLS and database triggers remain the ultimate authority.
 */

import { supabase } from '../utils/supabaseClient.js';

// In-memory offline fallback cache for seamless UX
let memoryChurches = [];
let memoryMemberships = [];
let memoryChurchFeatures = {};

/**
 * Validates URL-safe church slug format
 * Must be 3-60 chars, lowercase alphanumeric with single hyphens
 * @param {string} slug
 * @returns {boolean}
 */
export function isValidSlug(slug) {
  if (!slug || typeof slug !== 'string') return false;
  const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  return slug.length >= 3 && slug.length <= 60 && slugRegex.test(slug);
}

/**
 * Generates a clean URL-safe slug from a church name
 * @param {string} name
 * @returns {string}
 */
export function generateSlug(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

// =============================================================================
// 1. Centralized Two-Tier Feature Resolution
// =============================================================================

/**
 * Authoritative Two-Tier Church Feature Resolution
 * 
 * Hierarchy:
 * 1. Platform Feature OFF -> HARD OFF (Church cannot override)
 * 2. Platform Feature ON ->
 *    - Church override row exists -> Use church override value (ON or OFF)
 *    - No church override row -> Default to ON (standard platform inheritance)
 *
 * @param {string} churchId - UUID of the target church
 * @param {string} featureId - Identifier of the feature (e.g. 'worship_team_roles')
 * @param {Object<string, boolean>} platformAvailability - Map of platform feature enabled states
 * @param {Object<string, boolean>} [churchOverrides] - Optional preloaded map of church overrides
 * @returns {boolean} Whether the feature is effectively enabled
 */
export function getEffectiveChurchFeatureState(
  churchId,
  featureId,
  platformAvailability = {},
  churchOverrides = null
) {
  // Step 1: Master platform availability check
  const isPlatformEnabled = Boolean(platformAvailability[featureId]);
  if (!isPlatformEnabled) {
    // Platform master switch is OFF -> Hard disabled everywhere
    return false;
  }

  // Step 2: Check church-level override
  const overrides = churchOverrides || memoryChurchFeatures[churchId] || {};
  if (Object.prototype.hasOwnProperty.call(overrides, featureId)) {
    return Boolean(overrides[featureId]);
  }

  // Step 3: Default inheritance (ON when platform is ON)
  return true;
}

// =============================================================================
// 2. Church Workspace Queries & Lookups
// =============================================================================

/**
 * Fetch all church workspaces that the authenticated user belongs to
 * @param {string} userId - UUID of authenticated user
 * @returns {Promise<{ success: boolean, data: Array, isFallback?: boolean, error?: string }>}
 */
export async function fetchUserChurches(userId) {
  if (!userId) {
    return { success: true, data: [] };
  }

  try {
    const { data, error } = await supabase
      .from('church_memberships')
      .select(`
        id,
        role,
        status,
        created_at,
        church:churches (
          id,
          name,
          slug,
          description,
          city,
          state_province,
          country,
          website_url,
          logo_url,
          is_public,
          status,
          verification_status,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[churchService] fetchUserChurches query failed, using memory fallback:', error.message);
      const userFallbacks = memoryMemberships
        .filter(m => m.user_id === userId)
        .map(m => {
          const c = memoryChurches.find(church => church.id === m.church_id) || null;
          return {
            ...c,
            membershipId: m.id,
            role: m.role,
            membershipStatus: m.status,
            churchStatus: c?.status,
            status: (m.status === 'active' && c?.status === 'active') ? 'active' : m.status,
            joinedAt: m.created_at
          };
        })
        .filter(m => m.id);
      return { success: true, data: userFallbacks, isFallback: true };
    }

    // Map memberships and joined church data preserving explicit statuses
    const formatted = (data || [])
      .filter(row => row.church !== null)
      .map(row => ({
        ...row.church,
        membershipId: row.id,
        role: row.role,
        membershipStatus: row.status,
        churchStatus: row.church?.status,
        status: (row.status === 'active' && row.church?.status === 'active') ? 'active' : row.status,
        joinedAt: row.created_at
      }));

    return { success: true, data: formatted };
  } catch (err) {
    console.error('[churchService] Unexpected error in fetchUserChurches:', err);
    return { success: false, data: [], error: err.message };
  }
}

/**
 * Public directory query: Returns verified, active, public churches only
 * @param {string} [searchQuery]
 * @returns {Promise<{ success: boolean, data: Array, error?: string }>}
 */
export async function fetchPublicDirectory(searchQuery = '') {
  try {
    let query = supabase
      .from('churches')
      .select('id, name, slug, description, city, state_province, country, website_url, logo_url, created_at')
      .eq('is_public', true)
      .eq('status', 'active')
      .eq('verification_status', 'verified')
      .order('name', { ascending: true })
      .limit(50);

    if (searchQuery && searchQuery.trim()) {
      query = query.or(`name.ilike.%${searchQuery.trim()}%,city.ilike.%${searchQuery.trim()}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('[churchService] fetchPublicDirectory query failed:', error.message);
      const filtered = memoryChurches
        .filter(c => c.is_public && c.status === 'active' && c.verification_status === 'verified')
        .filter(c => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.city.toLowerCase().includes(searchQuery.toLowerCase()));
      return { success: true, data: filtered, isFallback: true };
    }

    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, data: [], error: err.message };
  }
}

/**
 * Hardened Slug Lookup for Join Flow via RPC
 * Returns minimal identity metadata (id, name, city, logo_url) for join confirmation
 * @param {string} slug
 * @returns {Promise<{ success: boolean, data: Object|null, error?: string }>}
 */
export async function lookupChurchForJoin(slug) {
  if (!slug || !isValidSlug(slug)) {
    return { success: false, data: null, error: 'Invalid church link format.' };
  }

  try {
    const { data, error } = await supabase
      .rpc('lookup_church_for_join', { p_slug: slug });

    if (error) {
      console.warn('[churchService] lookup_church_for_join RPC failed, checking memory:', error.message);
      const match = memoryChurches.find(c => c.slug === slug && c.status === 'active');
      if (match) {
        return {
          success: true,
          data: {
            church_id: match.id,
            name: match.name,
            city: match.city,
            logo_url: match.logo_url
          },
          isFallback: true
        };
      }
      return { success: false, data: null, error: 'Church workspace not found or currently inactive.' };
    }

    if (!data || data.length === 0) {
      return { success: false, data: null, error: 'Church workspace not found or currently inactive.' };
    }

    return { success: true, data: data[0] };
  } catch (err) {
    return { success: false, data: null, error: err.message };
  }
}

/**
 * Fetch complete church workspace by ID (for authorized members/pastors)
 * @param {string} churchId
 * @returns {Promise<{ success: boolean, data: Object|null, error?: string }>}
 */
export async function fetchChurchWorkspace(churchId) {
  if (!churchId) return { success: false, data: null, error: 'Missing church ID.' };

  try {
    const { data, error } = await supabase
      .from('churches')
      .select('*')
      .eq('id', churchId)
      .single();

    if (error) {
      const match = memoryChurches.find(c => c.id === churchId);
      if (match) return { success: true, data: match, isFallback: true };
      return { success: false, data: null, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    return { success: false, data: null, error: err.message };
  }
}

// =============================================================================
// 3. Church Creation & Profile Mutations
// =============================================================================

/**
 * Register a new Church Workspace
 * The database trigger atomically assigns status='active', verification_status='unverified',
 * and makes the creator the initial active Pastor in church_memberships.
 *
 * @param {Object} churchInput
 * @param {string} churchInput.name
 * @param {string} [churchInput.slug]
 * @param {string} [churchInput.description]
 * @param {string} [churchInput.city]
 * @param {string} [churchInput.state_province]
 * @param {string} [churchInput.country]
 * @param {string} [churchInput.website_url]
 * @param {string} [churchInput.logo_url]
 * @param {boolean} [churchInput.is_public]
 * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
 */
export async function createChurch(churchInput) {
  if (!churchInput.name || churchInput.name.trim().length < 2) {
    return { success: false, error: 'Church name must be at least 2 characters.' };
  }

  let slug = churchInput.slug ? churchInput.slug.trim().toLowerCase() : generateSlug(churchInput.name);
  if (!isValidSlug(slug)) {
    slug = `${generateSlug(churchInput.name)}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  const payload = {
    name: churchInput.name.trim(),
    slug,
    description: churchInput.description ? churchInput.description.trim() : '',
    city: churchInput.city ? churchInput.city.trim() : '',
    state_province: churchInput.state_province ? churchInput.state_province.trim() : '',
    country: churchInput.country ? churchInput.country.trim() : 'India',
    website_url: churchInput.website_url ? churchInput.website_url.trim() : null,
    logo_url: churchInput.logo_url ? churchInput.logo_url.trim() : null,
    is_public: Boolean(churchInput.is_public)
  };

  try {
    const { data, error } = await supabase
      .from('churches')
      .insert([payload])
      .select()
      .single();

    if (error) {
      // Memory fallback for mock/pre-migration development
      console.warn('[churchService] createChurch insert failed, creating in memory:', error.message);
      const newChurch = {
        id: `mock-${Date.now()}`,
        ...payload,
        status: 'active',
        verification_status: 'unverified',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      memoryChurches.push(newChurch);
      return { success: true, data: newChurch, isFallback: true };
    }

    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Update pastor-editable church profile settings
 * @param {string} churchId
 * @param {Object} updates
 * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
 */
export async function updateChurchProfile(churchId, updates) {
  if (!churchId) return { success: false, error: 'Missing church ID.' };

  // Whitelist only pastor-editable fields to prevent payload tampering
  const allowed = ['name', 'description', 'city', 'state_province', 'country', 'website_url', 'logo_url', 'is_public'];
  const payload = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      payload[key] = updates[key];
    }
  }

  if (updates.slug && isValidSlug(updates.slug)) {
    payload.slug = updates.slug;
  }

  try {
    const { data, error } = await supabase
      .from('churches')
      .update(payload)
      .eq('id', churchId)
      .select()
      .single();

    if (error) {
      console.warn('[churchService] updateChurchProfile failed:', error.message);
      const idx = memoryChurches.findIndex(c => c.id === churchId);
      if (idx >= 0) {
        memoryChurches[idx] = { ...memoryChurches[idx], ...payload, updated_at: new Date().toISOString() };
        return { success: true, data: memoryChurches[idx], isFallback: true };
      }
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// =============================================================================
// 4. Church Membership & Roster Management
// =============================================================================

/**
 * Fetch member roster for an active church workspace
 * @param {string} churchId
 * @returns {Promise<{ success: boolean, data: Array, error?: string }>}
 */
export async function fetchChurchMembers(churchId) {
  if (!churchId) return { success: false, data: [], error: 'Missing church ID.' };

  try {
    const { data, error } = await supabase
      .from('church_memberships')
      .select(`
        id,
        church_id,
        user_id,
        role,
        status,
        created_at,
        updated_at
      `)
      .eq('church_id', churchId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('[churchService] fetchChurchMembers failed, using memory:', error.message);
      const mems = memoryMemberships.filter(m => m.church_id === churchId);
      return { success: true, data: mems, isFallback: true };
    }

    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, data: [], error: err.message };
  }
}

/**
 * Request to join a church as a pending member
 * @param {string} churchId
 * @param {string} userId
 * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
 */
export async function requestJoinChurch(churchId, userId) {
  if (!churchId || !userId) {
    return { success: false, error: 'Church ID and User ID are required.' };
  }

  try {
    const { data, error } = await supabase
      .from('church_memberships')
      .insert([{
        church_id: churchId,
        user_id: userId,
        role: 'member',
        status: 'pending'
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'You already have an existing membership or request with this church.' };
      }
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Update member status (e.g. approve 'active' or suspend 'suspended')
 * Enforced by RLS: Pastor or Super Admin only
 * @param {string} membershipId
 * @param {string} newStatus - 'active' | 'suspended' | 'pending'
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function updateMemberStatus(membershipId, newStatus) {
  if (!['active', 'suspended', 'pending'].includes(newStatus)) {
    return { success: false, error: 'Invalid membership status.' };
  }

  try {
    const { error } = await supabase
      .from('church_memberships')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', membershipId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Update member role (e.g. 'member', 'worship_leader', 'pastor')
 * Enforced by RLS & Trigger: Pastor or Super Admin only.
 * Trigger blocks demoting/suspending the last active pastor.
 * @param {string} membershipId
 * @param {string} newRole - 'member' | 'worship_leader' | 'pastor'
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function updateMemberRole(membershipId, newRole) {
  if (!['member', 'worship_leader', 'pastor'].includes(newRole)) {
    return { success: false, error: 'Invalid church role.' };
  }

  try {
    const { error } = await supabase
      .from('church_memberships')
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq('id', membershipId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Remove a member from the fellowship (or member leaving church)
 * Enforced by Trigger: Blocks deleting the sole active pastor.
 * @param {string} membershipId
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function removeMember(membershipId) {
  try {
    const { error } = await supabase
      .from('church_memberships')
      .delete()
      .eq('id', membershipId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// =============================================================================
// 5. Church-Level Feature Overrides
// =============================================================================

/**
 * Fetch feature override records for a church workspace
 * @param {string} churchId
 * @returns {Promise<{ success: boolean, data: Object, error?: string }>}
 */
export async function fetchChurchFeatures(churchId) {
  if (!churchId) return { success: true, data: {} };

  try {
    const { data, error } = await supabase
      .from('church_features')
      .select('feature_id, is_enabled')
      .eq('church_id', churchId);

    if (error) {
      console.warn('[churchService] fetchChurchFeatures failed, using memory:', error.message);
      return { success: true, data: memoryChurchFeatures[churchId] || {}, isFallback: true };
    }

    const overrideMap = {};
    (data || []).forEach(row => {
      overrideMap[row.feature_id] = Boolean(row.is_enabled);
    });

    memoryChurchFeatures[churchId] = overrideMap;
    return { success: true, data: overrideMap };
  } catch (err) {
    return { success: false, data: {}, error: err.message };
  }
}

/**
 * Upsert a church feature override (Pastor or Super Admin only)
 * @param {string} churchId
 * @param {string} featureId
 * @param {boolean} isEnabled
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function updateChurchFeatureOverride(churchId, featureId, isEnabled) {
  if (!churchId || !featureId) {
    return { success: false, error: 'Missing churchId or featureId.' };
  }

  const payload = {
    church_id: churchId,
    feature_id: featureId,
    is_enabled: Boolean(isEnabled),
    updated_at: new Date().toISOString()
  };

  try {
    const { error } = await supabase
      .from('church_features')
      .upsert(payload, { onConflict: 'church_id,feature_id' });

    if (error) return { success: false, error: error.message };

    if (!memoryChurchFeatures[churchId]) {
      memoryChurchFeatures[churchId] = {};
    }
    memoryChurchFeatures[churchId][featureId] = Boolean(isEnabled);

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// =============================================================================
// 6. Super Admin Oversight Operations
// =============================================================================

/**
 * Super Admin: Query all churches across the entire platform
 * @param {Object} [filter]
 * @returns {Promise<{ success: boolean, data: Array, error?: string }>}
 */
export async function fetchAdminChurchesList() {
  try {
    const { data, error } = await supabase
      .from('churches')
      .select(`
        id,
        name,
        slug,
        city,
        state_province,
        country,
        is_public,
        status,
        verification_status,
        verification_notes,
        created_at,
        updated_at,
        created_by
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[churchService] fetchAdminChurchesList failed, using memory:', error.message);
      return { success: true, data: memoryChurches, isFallback: true };
    }

    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, data: [], error: err.message };
  }
}

/**
 * Super Admin: Set church verification status
 * @param {string} churchId
 * @param {'unverified'|'verified'|'rejected'} verificationStatus
 * @param {string} [notes]
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function adminSetVerification(churchId, verificationStatus, notes = '') {
  if (!['unverified', 'verified', 'rejected'].includes(verificationStatus)) {
    return { success: false, error: 'Invalid verification status.' };
  }

  try {
    const { error } = await supabase
      .from('churches')
      .update({
        verification_status: verificationStatus,
        verification_notes: notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', churchId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Super Admin: Set church operational status (activate / deactivate)
 * @param {string} churchId
 * @param {'active'|'inactive'} status
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function adminSetOperationalStatus(churchId, status) {
  if (!['active', 'inactive'].includes(status)) {
    return { success: false, error: 'Invalid operational status.' };
  }

  try {
    const { error } = await supabase
      .from('churches')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', churchId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
