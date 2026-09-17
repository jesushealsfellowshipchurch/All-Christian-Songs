/**
 * Song Repository Service
 * 
 * Manages fetching song details with primary Supabase queries,
 * an in-memory LRU cache, and transparent static JSON fallback.
 */

import { supabase, isSupabaseConfigured } from '../utils/supabaseClient.js';

const songCache = new Map();
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUEST_TIMEOUT_MS = 4000;

function withTimeout(promise, ms, errorMessage = 'Request timed out') {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMessage)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

/**
 * Normalizes song record to ensure 100% UI contract fidelity
 */
export function normalizeSong(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    slug: raw.slug,
    title: raw.title,
    title_transliterated: raw.title_transliterated || '',
    language: raw.language,
    alphabet: raw.alphabet,
    lyrics_original: Array.isArray(raw.lyrics_original) ? raw.lyrics_original : [],
    lyrics_transliterated: Array.isArray(raw.lyrics_transliterated) ? raw.lyrics_transliterated : [],
    youtube_id: raw.youtube_id || null,
    chords: Array.isArray(raw.chords) && raw.chords.length > 0 ? raw.chords : null,
    chord_count: raw.chord_count || 0,
    chord_credits: raw.chord_credits || null,
    author_english: raw.author_english || null,
    author_telugu: raw.author_telugu || null,
    category_names: Array.isArray(raw.category_names) ? raw.category_names : [],
    songbooks: Array.isArray(raw.songbooks) ? raw.songbooks : [],
    ppt_url: raw.ppt_url || null,
    bible_verses: Array.isArray(raw.bible_verses) ? raw.bible_verses : [],
    devotional: raw.devotional && Object.keys(raw.devotional).length > 0 ? raw.devotional : null
  };
}

/**
 * Fetches a single song by UUID or slug with Supabase primary and static fallback
 * 
 * @param {string} idOrSlug - Song UUID or URL slug
 * @returns {Promise<Object|null>} - Normalized song object or null
 */
export async function getSong(idOrSlug) {
  if (!idOrSlug || typeof idOrSlug !== 'string') return null;
  const cleanKey = idOrSlug.trim();

  // 1. In-memory cache hit
  if (songCache.has(cleanKey)) {
    return songCache.get(cleanKey);
  }

  // 2. Primary source: Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      const isUuid = UUID_REGEX.test(cleanKey);
      const query = isUuid
        ? supabase.from('songs').select('*').eq('id', cleanKey).maybeSingle()
        : supabase.from('songs').select('*').eq('slug', cleanKey).maybeSingle();

      const { data, error } = await withTimeout(
        query,
        REQUEST_TIMEOUT_MS,
        `Supabase query timeout for song: ${cleanKey}`
      );

      if (!error && data) {
        const song = normalizeSong(data);
        if (song) {
          if (song.id) songCache.set(song.id, song);
          if (song.slug) songCache.set(song.slug, song);
          return song;
        }
      }
    } catch (err) {
      // Supabase failed or timed out — log warning and proceed to static fallback
      console.warn(`[songRepository] Supabase fetch failed for "${cleanKey}", falling back to static JSON:`, err?.message || err);
    }
  }

  // 3. Fallback source: Static JSON file
  try {
    const res = await fetch(`./data/songs/${encodeURIComponent(cleanKey)}.json`);
    if (res.ok) {
      const data = await res.json();
      const song = normalizeSong(data);
      if (song) {
        if (song.id) songCache.set(song.id, song);
        if (song.slug) songCache.set(song.slug, song);
        return song;
      }
    }
  } catch (staticErr) {
    console.warn(`[songRepository] Static fetch failed for "${cleanKey}":`, staticErr?.message || staticErr);
  }

  // 4. Local storage fallback (for user-published local custom songs)
  try {
    const cached = localStorage.getItem(`jhf_song_${cleanKey}`);
    if (cached) {
      const data = JSON.parse(cached);
      const song = normalizeSong(data);
      if (song) {
        if (song.id) songCache.set(song.id, song);
        if (song.slug) songCache.set(song.slug, song);
        return song;
      }
    }
  } catch (_) {}

  return null;
}

/**
 * Clears the in-memory song cache, or a specific song by id or slug
 */
export function clearSongCache() {
  songCache.clear();
}

export function invalidateSongCache(idOrSlug) {
  if (idOrSlug && typeof idOrSlug === 'string') {
    songCache.delete(idOrSlug.trim());
  } else {
    songCache.clear();
  }
}
