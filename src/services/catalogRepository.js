/**
 * Catalog Repository Service
 * 
 * Manages fetching the full catalog search index and songbook collections
 * with primary Supabase queries, in-memory caching, and instant static JSON fallback.
 */

import { supabase, isSupabaseConfigured } from '../utils/supabaseClient.js';

let cachedCatalog = null;
let cachedSongbooks = null;

const CATALOG_TIMEOUT_MS = 5000;
const SONGBOOKS_TIMEOUT_MS = 3000;

function withTimeout(promise, ms, errorMessage = 'Request timed out') {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMessage)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

/**
 * Maps a Supabase song row to the compact index format consumed by filterSongs and SongList
 */
export function mapRowToCompact(row) {
  const author = row.author_telugu || row.author_english || '';
  const title = row.title || '';
  const titleTr = row.title_transliterated || '';

  return {
    id: row.id,
    slug: row.slug,
    t: title,
    tr: titleTr,
    lang: row.language,
    alpha: row.alphabet,
    chords: Boolean(row.chords && row.chords.length > 0),
    video: Boolean(row.youtube_id),
    yt: row.youtube_id || null,
    ppt: Boolean(row.ppt_url),
    cats: Array.isArray(row.category_names) ? row.category_names : [],
    books: Array.isArray(row.songbooks) ? row.songbooks : [],
    auth: author,
    search: `${title} ${titleTr} ${author}`.toLowerCase()
  };
}

/**
 * Sorts songs by default preference (Telugu songs first)
 */
function sortCatalog(songs) {
  return [...songs].sort((a, b) => {
    const aTe = a.lang === 'telugu' ? 1 : 0;
    const bTe = b.lang === 'telugu' ? 1 : 0;
    return bTe - aTe;
  });
}

/**
 * Merges locally published custom songs from localStorage
 */
function mergeLocalPublished(songs) {
  try {
    const localCustom = JSON.parse(localStorage.getItem('jhf_published_songs') || '[]');
    if (localCustom.length > 0) {
      const existingIds = new Set(songs.map(s => s.id || s.slug));
      const fresh = localCustom.filter(s => !existingIds.has(s.id) && !existingIds.has(s.slug));
      return [...fresh, ...songs];
    }
  } catch (_) {}
  return songs;
}

/**
 * Fetches the entire compact catalog index for instant client-side searching
 * 
 * @returns {Promise<{ songs: Array, source: 'supabase'|'static' }>}
 */
export async function getCatalogIndex() {
  if (cachedCatalog) {
    return { songs: cachedCatalog, source: 'cache' };
  }

  // 1. Primary Source: Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      // Step A: Determine exact total count dynamically
      const { count: totalCount, error: countErr } = await withTimeout(
        supabase
          .from('songs')
          .select('id', { count: 'exact', head: true })
          .eq('is_published', true),
        CATALOG_TIMEOUT_MS,
        'Supabase catalog count check timed out'
      );

      if (countErr) throw countErr;
      if (typeof totalCount !== 'number' || totalCount <= 0) {
        throw new Error(`Invalid catalog count returned: ${totalCount}`);
      }

      // Defensive check: Catalog should not be suspiciously tiny (< 1000 songs)
      if (totalCount < 1000) {
        throw new Error(`Suspiciously low catalog count from Supabase: ${totalCount}`);
      }

      // Step B: Dynamic parallel batch fetching based on exact totalCount
      const PAGE_SIZE = 1000;
      const totalPages = Math.ceil(totalCount / PAGE_SIZE);
      const pagePromises = [];

      for (let page = 0; page < totalPages; page++) {
        const from = page * PAGE_SIZE;
        const to = Math.min(from + PAGE_SIZE - 1, totalCount - 1);
        pagePromises.push(
          supabase
            .from('songs')
            .select('id, slug, title, title_transliterated, language, alphabet, chords, youtube_id, ppt_url, category_names, songbooks, author_english, author_telugu')
            .eq('is_published', true)
            .range(from, to)
        );
      }

      const batchResults = await withTimeout(
        Promise.all(pagePromises),
        CATALOG_TIMEOUT_MS,
        'Supabase catalog batch fetch timed out'
      );

      let allRows = [];
      for (let i = 0; i < batchResults.length; i++) {
        const res = batchResults[i];
        if (res.error) throw res.error;
        if (!Array.isArray(res.data)) {
          throw new Error(`Invalid batch response data on page ${i}`);
        }
        allRows.push(...res.data);
      }

      // Step C: Defensive completeness validation
      if (allRows.length !== totalCount) {
        throw new Error(`Incomplete catalog payload: expected ${totalCount}, received ${allRows.length}`);
      }

      // Verify essential fields exist on all records
      const hasMalformedRecord = allRows.some(s => !s.id || !s.slug || !s.title);
      if (hasMalformedRecord) {
        throw new Error('Catalog payload contains malformed song records');
      }

      const compactSongs = allRows.map(mapRowToCompact);
      const merged = mergeLocalPublished(compactSongs);
      const sorted = sortCatalog(merged);
      cachedCatalog = sorted;
      return { songs: sorted, source: 'supabase' };
    } catch (err) {
      console.warn('[catalogRepository] Supabase catalog fetch failed or incomplete, falling back to static compact_index.json:', err?.message || err);
    }
  }

  // 2. Fallback Source: Static compact_index.json
  try {
    const res = await fetch('./data/compact_index.json');
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    const merged = mergeLocalPublished(data || []);
    const sorted = sortCatalog(merged);
    cachedCatalog = sorted;
    return { songs: sorted, source: 'static' };
  } catch (staticErr) {
    console.error('[catalogRepository] Both Supabase and static index fetch failed:', staticErr);
    return { songs: [], source: 'error' };
  }
}

/**
 * Fetches official songbook collections
 * 
 * @returns {Promise<{ songbooks: Array, source: 'supabase'|'static' }>}
 */
export async function getSongbooks() {
  if (cachedSongbooks) {
    return { songbooks: cachedSongbooks, source: 'cache' };
  }

  // 1. Primary Source: Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      const query = supabase
        .from('songbooks')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      const { data, error } = await withTimeout(
        query,
        SONGBOOKS_TIMEOUT_MS,
        'Supabase songbooks fetch timed out'
      );

      if (!error && data && data.length > 0) {
        cachedSongbooks = data;
        return { songbooks: data, source: 'supabase' };
      }
    } catch (err) {
      console.warn('[catalogRepository] Supabase songbooks fetch failed, falling back to static songbooks.json:', err?.message || err);
    }
  }

  // 2. Fallback Source: Static songbooks.json
  try {
    const res = await fetch('./data/songbooks.json');
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    cachedSongbooks = data || [];
    return { songbooks: cachedSongbooks, source: 'static' };
  } catch (staticErr) {
    console.error('[catalogRepository] Both Supabase and static songbooks fetch failed:', staticErr);
    return { songbooks: [], source: 'error' };
  }
}

/**
 * Clears in-memory catalog and songbooks cache
 */
export function clearCatalogCache() {
  cachedCatalog = null;
  cachedSongbooks = null;
}

export const invalidateCatalogCache = clearCatalogCache;
