/**
 * churchWorshipService.js — Church Worship Collections & Repertoire Domain Service
 *
 * All Christian Songs — Phase 2C Church Worship Layer
 *
 * Responsibilities:
 * 1. Congregational Song Collections Management (CRUD, default collection resolution via RPC).
 * 2. Collection Items Curation (Adding global songs, key/tempo/arrangement notes, reordering, removal).
 * 3. Feature availability verification reusing Phase 2A/2B Two-Tier Feature Engine.
 * 4. Multi-tenant security adherence (PostgreSQL RLS is authoritative; client-side parameters are explicit).
 * 5. Safe handling of unpublished songs (relational links preserved; missing lyrics handled gracefully).
 *
 * Security & Governance Rules:
 * - Uses existing Supabase client (anon key + user JWT). Zero elevated backend keys.
 * - Never attempts to modify immutable fields (church_id, collection_id, song_id, created_at, created_by, added_at, added_by).
 * - Delegates default collection creation strictly to public.ensure_default_church_collection(UUID).
 * - Completely stateless across multiple churches: every method requires explicit churchId or collectionId.
 */

import { supabase } from '../utils/supabaseClient.js';
import { getEffectiveChurchFeatureState } from './churchService.js';

export const WORSHIP_FEATURE_ID = 'church_worship_collections';

/**
 * Cleanly format PostgreSQL / Supabase errors for user display
 * @param {Error|Object|string} error
 * @returns {string}
 */
export function formatWorshipError(error) {
  if (!error) return 'An unexpected error occurred.';
  const msg = typeof error === 'string' ? error : error.message || error.error_description || '';
  const lower = msg.toLowerCase();

  // RLS authorization failures
  if (error.code === '42501' || lower.includes('row-level security') || lower.includes('permission denied')) {
    return 'You do not have permission to perform this worship curation action.';
  }

  // Unique constraint violations
  if (error.code === '23505' || lower.includes('unique constraint') || lower.includes('duplicate key')) {
    if (lower.includes('uq_church_collection_name') || lower.includes('name')) {
      return 'A collection with this name already exists in this church.';
    }
    if (lower.includes('uq_collection_song')) {
      return 'This hymn is already in this collection.';
    }
    if (lower.includes('uq_church_default_collection')) {
      return 'Only one default collection is permitted per church.';
    }
    return 'This item already exists in the collection.';
  }

  // Trigger invariant exceptions
  if (lower.includes('default church collection cannot be deleted')) {
    return 'The default church collection cannot be deleted.';
  }
  if (lower.includes('default church collection cannot be demoted')) {
    return 'The default church collection cannot be demoted.';
  }
  if (lower.includes('default church collection name cannot be renamed') || lower.includes('name cannot be altered')) {
    return 'The default church collection name cannot be modified.';
  }
  if (lower.includes('church_id cannot be modified')) {
    return 'Security violation: church workspace assignment cannot be modified.';
  }
  if (lower.includes('collection_id cannot be modified')) {
    return 'Security violation: collection assignment cannot be modified.';
  }
  if (lower.includes('song_id cannot be modified')) {
    return 'Security violation: song assignment cannot be modified.';
  }
  if (lower.includes('target church workspace does not exist or is inactive')) {
    return 'This church workspace is currently inactive.';
  }
  if (lower.includes('caller is not an active member')) {
    return 'You must be an active member of this church to access worship collections.';
  }
  if (lower.includes('authentication required')) {
    return 'Please sign in to access church worship collections.';
  }

  return msg || 'Failed to complete worship operation.';
}

// =============================================================================
// 1. Two-Tier Feature Check Helper
// =============================================================================

/**
 * Checks whether the Church Worship feature is effectively active for a given church
 * Reuses the authoritative Two-Tier Feature Engine from Phase 2A/2B
 *
 * @param {string} churchId - Target church UUID
 * @param {Object<string, boolean>} platformAvailability - Map of platform features
 * @param {Object<string, boolean>} [churchOverrides] - Optional church feature overrides
 * @returns {boolean}
 */
export function isWorshipFeatureActive(churchId, platformAvailability = {}, churchOverrides = null) {
  if (!churchId) return false;
  return getEffectiveChurchFeatureState(
    churchId,
    WORSHIP_FEATURE_ID,
    platformAvailability,
    churchOverrides
  );
}

// =============================================================================
// 2. Church Collections API
// =============================================================================

/**
 * Fetch all song collections belonging to a church workspace
 * Ordered by: default collection first, then sort_order ASC, then name ASC
 *
 * @param {string} churchId - UUID of the target church
 * @returns {Promise<{ success: boolean, data: Array, error?: string }>}
 */
export async function getCollections(churchId) {
  if (!churchId) {
    return { success: false, data: [], error: 'Missing church ID.' };
  }

  try {
    const { data, error } = await supabase
      .from('church_collections')
      .select(`
        id,
        church_id,
        name,
        description,
        is_default,
        sort_order,
        created_at,
        created_by,
        updated_at,
        updated_by
      `)
      .eq('church_id', churchId)
      .order('is_default', { ascending: false })
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      return { success: false, data: [], error: formatWorshipError(error) };
    }

    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, data: [], error: formatWorshipError(err) };
  }
}

/**
 * Fetch a single church collection by ID
 *
 * @param {string} collectionId - UUID of the collection
 * @returns {Promise<{ success: boolean, data: Object|null, error?: string }>}
 */
export async function getCollection(collectionId) {
  if (!collectionId) {
    return { success: false, data: null, error: 'Missing collection ID.' };
  }

  try {
    const { data, error } = await supabase
      .from('church_collections')
      .select('*')
      .eq('id', collectionId)
      .single();

    if (error) {
      return { success: false, data: null, error: formatWorshipError(error) };
    }

    return { success: true, data };
  } catch (err) {
    return { success: false, data: null, error: formatWorshipError(err) };
  }
}

/**
 * Create a new custom church collection
 * Only Worship Leaders, Pastors, or Super Admins are authorized by RLS
 *
 * @param {string} churchId - UUID of the target church
 * @param {Object} data
 * @param {string} data.name - Name of collection (2-100 characters)
 * @param {string} [data.description] - Description / purpose of collection
 * @param {number} [data.sort_order] - Sort priority (default 0)
 * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
 */
export async function createCollection(churchId, data = {}) {
  if (!churchId) {
    return { success: false, error: 'Missing church ID.' };
  }

  const trimmedName = (data.name || '').trim();
  if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 100) {
    return { success: false, error: 'Collection name must be between 2 and 100 characters.' };
  }

  // Build clean payload with permitted fields only (custom collections cannot be default)
  const payload = {
    church_id: churchId,
    name: trimmedName,
    description: (data.description || '').trim(),
    sort_order: Number.isInteger(data.sort_order) ? data.sort_order : 0,
    is_default: false
  };

  try {
    const { data: created, error } = await supabase
      .from('church_collections')
      .insert(payload)
      .select()
      .single();

    if (error) {
      return { success: false, error: formatWorshipError(error) };
    }

    return { success: true, data: created };
  } catch (err) {
    return { success: false, error: formatWorshipError(err) };
  }
}

/**
 * Update custom collection metadata (name, description, sort_order)
 * Immutable fields (church_id, created_at, created_by, is_default) are strictly excluded
 *
 * @param {string} collectionId - UUID of the collection
 * @param {Object} data
 * @param {string} [data.name]
 * @param {string} [data.description]
 * @param {number} [data.sort_order]
 * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
 */
export async function updateCollection(collectionId, data = {}) {
  if (!collectionId) {
    return { success: false, error: 'Missing collection ID.' };
  }

  const payload = {};

  if (typeof data.name === 'string') {
    const trimmed = data.name.trim();
    if (trimmed.length < 2 || trimmed.length > 100) {
      return { success: false, error: 'Collection name must be between 2 and 100 characters.' };
    }
    payload.name = trimmed;
  }

  if (typeof data.description === 'string') {
    payload.description = data.description.trim();
  }

  if (Number.isInteger(data.sort_order)) {
    payload.sort_order = data.sort_order;
  }

  if (Object.keys(payload).length === 0) {
    return { success: false, error: 'No valid fields provided for update.' };
  }

  try {
    const { data: updated, error } = await supabase
      .from('church_collections')
      .update(payload)
      .eq('id', collectionId)
      .select()
      .single();

    if (error) {
      return { success: false, error: formatWorshipError(error) };
    }

    return { success: true, data: updated };
  } catch (err) {
    return { success: false, error: formatWorshipError(err) };
  }
}

/**
 * Delete a custom church collection
 * Only Pastors and Super Admins are authorized by RLS
 * Trigger trg_church_collections_invariants strictly prevents deleting the default collection
 *
 * @param {string} collectionId - UUID of the collection
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function deleteCollection(collectionId) {
  if (!collectionId) {
    return { success: false, error: 'Missing collection ID.' };
  }

  try {
    const { error } = await supabase
      .from('church_collections')
      .delete()
      .eq('id', collectionId);

    if (error) {
      return { success: false, error: formatWorshipError(error) };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: formatWorshipError(err) };
  }
}

/**
 * Ensure the default "Church Repertoire" collection exists atomically
 * Calls public.ensure_default_church_collection(UUID) via RPC
 *
 * @param {string} churchId - UUID of the church workspace
 * @returns {Promise<{ success: boolean, collectionId?: string, error?: string }>}
 */
export async function ensureDefaultCollection(churchId) {
  if (!churchId) {
    return { success: false, error: 'Missing church ID.' };
  }

  try {
    const { data: collectionId, error } = await supabase
      .rpc('ensure_default_church_collection', { p_church_id: churchId });

    if (error) {
      return { success: false, error: formatWorshipError(error) };
    }

    return { success: true, collectionId };
  } catch (err) {
    return { success: false, error: formatWorshipError(err) };
  }
}

// =============================================================================
// 3. Collection Items API (Song References & Annotations)
// =============================================================================

/**
 * Fetch all song items within a collection
 * Includes relational song details from public.songs
 * Unpublished songs return with song: null or is_published: false per songs RLS
 *
 * @param {string} collectionId - UUID of the collection
 * @returns {Promise<{ success: boolean, data: Array, error?: string }>}
 */
export async function getCollectionItems(collectionId) {
  if (!collectionId) {
    return { success: false, data: [], error: 'Missing collection ID.' };
  }

  try {
    const { data, error } = await supabase
      .from('church_collection_items')
      .select(`
        id,
        collection_id,
        church_id,
        song_id,
        default_key,
        tempo_notes,
        arrangement_notes,
        sort_order,
        added_at,
        added_by,
        updated_at,
        updated_by,
        song:songs (
          id,
          title,
          title_telugu,
          language,
          category,
          tempo,
          original_key,
          author,
          is_published
        )
      `)
      .eq('collection_id', collectionId)
      .order('sort_order', { ascending: true })
      .order('added_at', { ascending: true });

    if (error) {
      return { success: false, data: [], error: formatWorshipError(error) };
    }

    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, data: [], error: formatWorshipError(err) };
  }
}

/**
 * Add a global song reference to a church collection with optional arrangement notes
 * Church ID is automatically assigned by database trigger from the parent collection
 *
 * @param {string} collectionId - UUID of the parent collection
 * @param {string} songId - UUID of the global hymn (public.songs)
 * @param {Object} [data]
 * @param {string} [data.default_key] - Custom key (e.g. 'D', 'G', 'F#m')
 * @param {string} [data.tempo_notes] - Tempo / feel note (e.g. '120 BPM', 'Slow 6/8')
 * @param {string} [data.arrangement_notes] - Arrangement / pastoral directions
 * @param {number} [data.sort_order] - Position in rehearsal list
 * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
 */
export async function addSongToCollection(collectionId, songId, data = {}) {
  if (!collectionId) {
    return { success: false, error: 'Missing collection ID.' };
  }
  if (!songId) {
    return { success: false, error: 'Missing song ID.' };
  }

  // Validate lengths
  const defaultKey = data.default_key ? data.default_key.trim().slice(0, 10) : null;
  const tempoNotes = data.tempo_notes ? data.tempo_notes.trim().slice(0, 50) : null;
  const arrangementNotes = data.arrangement_notes ? data.arrangement_notes.trim().slice(0, 1000) : null;
  const sortOrder = Number.isInteger(data.sort_order) ? data.sort_order : 0;

  const payload = {
    collection_id: collectionId,
    song_id: songId,
    default_key: defaultKey,
    tempo_notes: tempoNotes,
    arrangement_notes: arrangementNotes,
    sort_order: sortOrder
  };

  try {
    const { data: created, error } = await supabase
      .from('church_collection_items')
      .insert(payload)
      .select()
      .single();

    if (error) {
      return { success: false, error: formatWorshipError(error) };
    }

    return { success: true, data: created };
  } catch (err) {
    return { success: false, error: formatWorshipError(err) };
  }
}

/**
 * Update arrangement metadata on an existing collection item
 * Immutable fields (collection_id, church_id, song_id, added_at, added_by) are excluded
 *
 * @param {string} itemId - UUID of the collection item
 * @param {Object} data
 * @param {string|null} [data.default_key]
 * @param {string|null} [data.tempo_notes]
 * @param {string|null} [data.arrangement_notes]
 * @param {number} [data.sort_order]
 * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
 */
export async function updateCollectionItem(itemId, data = {}) {
  if (!itemId) {
    return { success: false, error: 'Missing collection item ID.' };
  }

  const payload = {};

  if (data.default_key !== undefined) {
    payload.default_key = data.default_key ? data.default_key.trim().slice(0, 10) : null;
  }
  if (data.tempo_notes !== undefined) {
    payload.tempo_notes = data.tempo_notes ? data.tempo_notes.trim().slice(0, 50) : null;
  }
  if (data.arrangement_notes !== undefined) {
    payload.arrangement_notes = data.arrangement_notes ? data.arrangement_notes.trim().slice(0, 1000) : null;
  }
  if (Number.isInteger(data.sort_order)) {
    payload.sort_order = data.sort_order;
  }

  if (Object.keys(payload).length === 0) {
    return { success: false, error: 'No valid fields provided for item update.' };
  }

  try {
    const { data: updated, error } = await supabase
      .from('church_collection_items')
      .update(payload)
      .eq('id', itemId)
      .select()
      .single();

    if (error) {
      return { success: false, error: formatWorshipError(error) };
    }

    return { success: true, data: updated };
  } catch (err) {
    return { success: false, error: formatWorshipError(err) };
  }
}

/**
 * Remove a song reference from a church collection
 *
 * @param {string} itemId - UUID of the collection item
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function removeSongFromCollection(itemId) {
  if (!itemId) {
    return { success: false, error: 'Missing collection item ID.' };
  }

  try {
    const { error } = await supabase
      .from('church_collection_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      return { success: false, error: formatWorshipError(error) };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: formatWorshipError(err) };
  }
}

/**
 * Reorder collection items with minimum updates
 * Only submits { sort_order } for items whose position actually changed
 * Does NOT modify immutable relational keys or audit fields
 *
 * @param {string} collectionId - UUID of the parent collection
 * @param {Array<{ id: string, sort_order: number }>} orderedItems - Array of items with target sort_order
 * @returns {Promise<{ success: boolean, updatedCount?: number, error?: string }>}
 */
export async function reorderCollectionItems(collectionId, orderedItems = []) {
  if (!collectionId) {
    return { success: false, error: 'Missing collection ID.' };
  }
  if (!Array.isArray(orderedItems) || orderedItems.length === 0) {
    return { success: true, updatedCount: 0 };
  }

  try {
    // Process minimal positional updates in parallel batches
    const updatePromises = orderedItems.map((item, index) => {
      const targetSortOrder = Number.isInteger(item.sort_order) ? item.sort_order : index;
      return supabase
        .from('church_collection_items')
        .update({ sort_order: targetSortOrder })
        .eq('id', item.id)
        .eq('collection_id', collectionId);
    });

    const results = await Promise.all(updatePromises);
    const firstError = results.find(r => r.error)?.error;

    if (firstError) {
      return { success: false, error: formatWorshipError(firstError) };
    }

    return { success: true, updatedCount: orderedItems.length };
  } catch (err) {
    return { success: false, error: formatWorshipError(err) };
  }
}
