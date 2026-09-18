/**
 * favoritesService.js — Authenticated & Guest Favorites Manager
 * 
 * Manages user favorite songs with Supabase cloud synchronization for
 * authenticated users and localStorage fallback for guest users.
 * 
 * Rules:
 * - Private personal data strictly authenticated via Supabase RLS
 * - No elevated credentials, no admin bypasses, no credential storage.
 */

import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';

export const FAVORITES_STORAGE_KEY = 'jhf_favorites';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reads favorites safely from localStorage for guest visitors
 * @returns {string[]} Array of song UUID strings
 */
export function getLocalFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(id => typeof id === 'string' && id.trim().length > 0);
  } catch (err) {
    console.warn('[favoritesService] Failed to parse local favorites:', err);
    return [];
  }
}

/**
 * Persists favorites to localStorage for guest visitors
 * @param {string[]} ids
 */
export function setLocalFavorites(ids) {
  try {
    if (!Array.isArray(ids)) return;
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(ids));
  } catch (err) {
    console.warn('[favoritesService] Failed to write local favorites:', err);
  }
}

/**
 * Clears local favorites from localStorage after verified cloud sync
 */
export function clearLocalFavorites() {
  try {
    localStorage.removeItem(FAVORITES_STORAGE_KEY);
  } catch (err) {
    console.warn('[favoritesService] Failed to clear local favorites:', err);
  }
}

/**
 * Fetches the authenticated user's favorite song IDs from Supabase
 * @param {string} userId - auth.users(id) UUID
 * @returns {Promise<{ success: boolean, data: string[], error: string|null }>}
 */
export async function fetchUserFavorites(userId) {
  if (!isSupabaseConfigured || !supabase || !userId) {
    return { success: false, data: [], error: 'Supabase or user not configured' };
  }

  try {
    const { data, error } = await supabase
      .from('user_favorites')
      .select('song_id')
      .eq('user_id', userId);

    if (error) {
      console.warn('[favoritesService] Error fetching user favorites:', error.message);
      return { success: false, data: [], error: error.message };
    }

    const ids = Array.isArray(data) ? data.map(row => row.song_id) : [];
    return { success: true, data: ids, error: null };
  } catch (err) {
    console.warn('[favoritesService] Exception fetching user favorites:', err);
    return { success: false, data: [], error: err?.message || 'Network error' };
  }
}

/**
 * Adds a song to the authenticated user's cloud favorites
 * @param {string} userId
 * @param {string} songId
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export async function addUserFavorite(userId, songId) {
  if (!isSupabaseConfigured || !supabase || !userId || !songId) {
    return { success: false, error: 'Invalid parameters or Supabase not configured' };
  }

  try {
    const { error } = await supabase
      .from('user_favorites')
      .insert({ user_id: userId, song_id: songId });

    if (error) {
      // 23505 = unique_violation (already favorited) -> treat as success
      if (error.code === '23505' || error.message?.includes('duplicate key')) {
        return { success: true, error: null };
      }
      console.warn('[favoritesService] Error adding favorite:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err) {
    console.warn('[favoritesService] Exception adding favorite:', err);
    return { success: false, error: err?.message || 'Network error' };
  }
}

/**
 * Removes a song from the authenticated user's cloud favorites
 * @param {string} userId
 * @param {string} songId
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export async function removeUserFavorite(userId, songId) {
  if (!isSupabaseConfigured || !supabase || !userId || !songId) {
    return { success: false, error: 'Invalid parameters or Supabase not configured' };
  }

  try {
    const { error } = await supabase
      .from('user_favorites')
      .delete()
      .eq('user_id', userId)
      .eq('song_id', songId);

    if (error) {
      console.warn('[favoritesService] Error removing favorite:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err) {
    console.warn('[favoritesService] Exception removing favorite:', err);
    return { success: false, error: err?.message || 'Network error' };
  }
}

/**
 * Migrates local guest favorites to the authenticated user's cloud favorites
 * 
 * Safety invariants:
 * 1. Validates referenced song IDs format and existence if validCatalogSongIds is supplied.
 * 2. Upserts using composite key (user_id, song_id) to avoid duplicates.
 * 3. Only clears local favorites after verified cloud upsert.
 * 4. Never deletes local favorites on network/database failure.
 * 
 * @param {string} userId - Authenticated user UUID
 * @param {string[]} localFavorites - Local favorite song IDs
 * @param {Set<string>|null} validCatalogSongIds - Optional set of valid song IDs
 * @returns {Promise<{ success: boolean, migratedCount: number, error: string|null }>}
 */
export async function syncLocalFavoritesToCloud(userId, localFavorites, validCatalogSongIds = null) {
  if (!isSupabaseConfigured || !supabase || !userId) {
    return { success: false, migratedCount: 0, error: 'Supabase or user not configured' };
  }

  if (!Array.isArray(localFavorites) || localFavorites.length === 0) {
    return { success: true, migratedCount: 0, error: null };
  }

  // 1. Validate format and catalog existence
  const validIds = localFavorites.filter(id => {
    if (typeof id !== 'string' || !UUID_REGEX.test(id)) return false;
    if (validCatalogSongIds && !validCatalogSongIds.has(id)) return false;
    return true;
  });

  if (validIds.length === 0) {
    // If local entries were completely invalid / malformed, clear them
    clearLocalFavorites();
    return { success: true, migratedCount: 0, error: null };
  }

  // 2. Batch upsert into public.user_favorites
  try {
    const rows = validIds.map(song_id => ({
      user_id: userId,
      song_id
    }));

    const { error } = await supabase
      .from('user_favorites')
      .upsert(rows, { onConflict: 'user_id,song_id', ignoreDuplicates: true });

    if (error) {
      console.warn('[favoritesService] Cloud migration failed, preserving local favorites:', error.message);
      return { success: false, migratedCount: 0, error: error.message };
    }

    // 3. Cloud synchronization succeeded: clear local entries safely
    clearLocalFavorites();
    return { success: true, migratedCount: rows.length, error: null };
  } catch (err) {
    console.warn('[favoritesService] Cloud migration exception, preserving local favorites:', err);
    return { success: false, migratedCount: 0, error: err?.message || 'Migration failed' };
  }
}
