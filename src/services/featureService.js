/**
 * featureService.js — Super Admin Feature Control & Public Availability Manager
 *
 * All Christian Songs — Phase 2A Platform Control
 *
 * Responsibilities:
 * 1. Maintain static fallback feature catalog for offline/pre-migration resilience.
 * 2. Public Runtime Availability: Expose ONLY minimal enabled state without leaking roadmap.
 * 3. Super Admin Catalog: Full roadmap query for authorized platform administrators.
 * 4. Database-Level & Client-Side System Protection: Block disabling is_system features.
 * 5. Factual Status Counts: Factual summary counts without misleading percentages.
 */

import { supabase } from '../utils/supabaseClient.js';

/**
 * Standard 14-Feature Catalog (Identical to 005_product_features.sql seed)
 */
export const DEFAULT_FEATURES = [
  // Foundation System Features (Completed + Enabled + System Locked)
  {
    id: 'song_catalog',
    display_name: 'Song Catalog & Search',
    description: 'Instant search, filtering, and lyric viewing for 3,774+ Telugu, English, and Hindi songs.',
    category: 'core',
    phase: 'Foundation',
    status: 'completed',
    is_enabled: true,
    is_system: true,
    sort_order: 10
  },
  {
    id: 'songbooks',
    display_name: 'Songbooks Index',
    description: 'Curated songbooks including Andhra Christian Hymnal and Hosanna Ministries collections.',
    category: 'core',
    phase: 'Foundation',
    status: 'completed',
    is_enabled: true,
    is_system: true,
    sort_order: 20
  },
  {
    id: 'authentication',
    display_name: 'Authentication & Profiles',
    description: 'Supabase Auth with role-based access control and profile synchronization.',
    category: 'core',
    phase: 'Foundation',
    status: 'completed',
    is_enabled: true,
    is_system: true,
    sort_order: 30
  },
  {
    id: 'admin_portal',
    display_name: 'Admin Song Management',
    description: 'Secure song creation, editing, unpublishing, and songbook curation for administrators.',
    category: 'platform',
    phase: 'Foundation',
    status: 'completed',
    is_enabled: true,
    is_system: true,
    sort_order: 40
  },

  // Live User-Facing Features (Phase 0 - Phase 2A)
  {
    id: 'todays_service',
    display_name: "Today's Service (Pinned Songs)",
    description: 'Featured worship songs pinned on the landing page for Sunday service and gatherings.',
    category: 'worship',
    phase: 'Phase 0',
    status: 'active',
    is_enabled: true,
    is_system: false,
    sort_order: 50
  },
  {
    id: 'personal_favorites',
    display_name: 'Cloud-Synced Personal Favorites',
    description: 'Personal bookmarking with cross-device sync and automatic guest migration.',
    category: 'worship',
    phase: 'Phase 1',
    status: 'active',
    is_enabled: true,
    is_system: false,
    sort_order: 60
  },
  {
    id: 'feature_control',
    display_name: 'Platform Journey & Feature Control',
    description: 'Super Admin roadmap oversight and live runtime feature availability controls.',
    category: 'platform',
    phase: 'Phase 2A',
    status: 'active',
    is_enabled: true,
    is_system: true,
    sort_order: 70
  },
  {
    id: 'presentation_mode',
    display_name: 'Presentation / Projector Mode',
    description: 'Distraction-free fullscreen projection display for sanctuary projectors and live streams.',
    category: 'worship',
    phase: 'Phase 2A',
    status: 'completed',
    is_enabled: true,
    is_system: false,
    sort_order: 80
  },

  // Ready Feature (Ready but disabled until release)
  {
    id: 'chord_transposer',
    display_name: 'Chord Transposition & Nashville Numbers',
    description: 'Dynamic key changes and Nashville number representation for worship team musicians.',
    category: 'worship',
    phase: 'Phase 2B',
    status: 'ready',
    is_enabled: false,
    is_system: false,
    sort_order: 90
  },

  // Future Roadmap Features (Planned, disabled, private from public view)
  {
    id: 'church_workspaces',
    display_name: 'Church Profiles & Workspaces',
    description: 'Dedicated congregation profiles with custom service banners and church identity.',
    category: 'church',
    phase: 'Phase 2B',
    status: 'planned',
    is_enabled: false,
    is_system: false,
    sort_order: 100
  },
  {
    id: 'worship_team_roles',
    display_name: 'Worship Team & Pastor Roles',
    description: 'Collaborative role-based access for pastors, worship leaders, and AV crew.',
    category: 'church',
    phase: 'Phase 2B',
    status: 'planned',
    is_enabled: false,
    is_system: false,
    sort_order: 110
  },
  {
    id: 'church_service_order',
    display_name: 'Service Order & Setlists',
    description: 'Ordered liturgy, song line-ups, and coordinated team rehearsal sets.',
    category: 'church',
    phase: 'Phase 3',
    status: 'planned',
    is_enabled: false,
    is_system: false,
    sort_order: 120
  },
  {
    id: 'offline_pwa',
    display_name: 'Offline Progressive Web App',
    description: 'Installable application with cached songs for uninterrupted rural ministry.',
    category: 'platform',
    phase: 'Phase 3',
    status: 'planned',
    is_enabled: false,
    is_system: false,
    sort_order: 130
  },
  {
    id: 'church_subscriptions',
    display_name: 'Church Membership & SaaS Tiers',
    description: 'Congregation subscription management and multi-campus ministry features.',
    category: 'church',
    phase: 'Future',
    status: 'planned',
    is_enabled: false,
    is_system: false,
    sort_order: 140
  }
];

/**
 * Default availability map derived from DEFAULT_FEATURES.
 * Key: featureId, Value: boolean is_enabled.
 */
export const DEFAULT_AVAILABILITY = DEFAULT_FEATURES.reduce((acc, feat) => {
  acc[feat.id] = feat.is_enabled;
  return acc;
}, {});

/**
 * Fetch minimal public runtime feature availability.
 * Queries ONLY id and is_enabled for enabled features.
 * Non-admin users cannot see planned/unreleased roadmap items (enforced by RLS).
 *
 * @returns {Promise<{ success: boolean, data: Record<string, boolean>, isFallback: boolean }>}
 */
export async function fetchPublicFeatureAvailability() {
  try {
    const { data, error } = await supabase
      .from('product_features')
      .select('id, is_enabled');

    if (error) {
      // Graceful fallback for offline, pre-migration, or network failure
      console.warn('[featureService] Live availability query returned error, using defaults:', error.message);
      return {
        success: true,
        data: { ...DEFAULT_AVAILABILITY },
        isFallback: true
      };
    }

    if (!data || data.length === 0) {
      return {
        success: true,
        data: { ...DEFAULT_AVAILABILITY },
        isFallback: true
      };
    }

    // Build availability map
    const availabilityMap = { ...DEFAULT_AVAILABILITY };
    for (const row of data) {
      availabilityMap[row.id] = Boolean(row.is_enabled);
    }

    // Double-check system features are always enabled
    for (const feat of DEFAULT_FEATURES) {
      if (feat.is_system) {
        availabilityMap[feat.id] = true;
      }
    }

    return {
      success: true,
      data: availabilityMap,
      isFallback: false
    };
  } catch (err) {
    console.warn('[featureService] Exception fetching feature availability:', err);
    return {
      success: true,
      data: { ...DEFAULT_AVAILABILITY },
      isFallback: true
    };
  }
}

/**
 * Fetch complete Product Journey & Feature Control catalog (Super Admin only).
 * Requires authenticated user with role = 'admin'.
 *
 * @returns {Promise<{ success: boolean, data: Array<object>, isFallback: boolean, error?: string }>}
 */
export async function fetchAdminFeatureCatalog() {
  try {
    const { data, error } = await supabase
      .from('product_features')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.warn('[featureService] Admin catalog query error, falling back to static catalog:', error.message);
      return {
        success: true,
        data: [...DEFAULT_FEATURES],
        isFallback: true,
        error: error.message
      };
    }

    if (!data || data.length === 0) {
      return {
        success: true,
        data: [...DEFAULT_FEATURES],
        isFallback: true
      };
    }

    return {
      success: true,
      data,
      isFallback: false
    };
  } catch (err) {
    console.warn('[featureService] Exception fetching admin feature catalog:', err);
    return {
      success: true,
      data: [...DEFAULT_FEATURES],
      isFallback: true,
      error: err.message
    };
  }
}

/**
 * Update a feature's live availability toggle (Super Admin only).
 *
 * Mandatory Correction 1:
 * Enforces is_system protection on the client side before calling Supabase.
 * Database constraint/trigger additionally enforces it on the server.
 *
 * @param {string} featureId
 * @param {boolean} nextEnabled
 * @param {Array<object>} [catalog]
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
export async function updateFeatureToggle(featureId, nextEnabled, catalog = DEFAULT_FEATURES) {
  // 1. Database-Level & Client-Side System Protection Check
  const feature = catalog.find(f => f.id === featureId);
  if (feature?.is_system && !nextEnabled) {
    return {
      success: false,
      error: 'System features are vital to platform operation and cannot be disabled.'
    };
  }

  try {
    const { data, error } = await supabase
      .from('product_features')
      .update({ is_enabled: Boolean(nextEnabled) })
      .eq('id', featureId)
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: error.message || 'Database update failed.'
      };
    }

    return {
      success: true,
      data
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || 'Network exception updating feature.'
    };
  }
}

/**
 * Calculate simple factual counts for the Product Journey.
 *
 * Mandatory Correction 3:
 * Simple factual counts instead of misleading completion percentages.
 *
 * @param {Array<object>} features
 * @returns {{ total: number, completed: number, active: number, ready: number, planned: number, deferred: number }}
 */
export function calculateFactualCounts(features = DEFAULT_FEATURES) {
  const counts = {
    total: features.length,
    completed: 0,
    active: 0,
    ready: 0,
    planned: 0,
    deferred: 0
  };

  for (const f of features) {
    const s = f.status?.toLowerCase();
    if (s === 'completed') counts.completed++;
    else if (s === 'active') counts.active++;
    else if (s === 'ready') counts.ready++;
    else if (s === 'planned') counts.planned++;
    else if (s === 'deferred') counts.deferred++;
  }

  return counts;
}
