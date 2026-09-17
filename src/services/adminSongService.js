/**
 * Admin Song Service
 * 
 * Direct-Supabase operations for hymnal administration.
 * All mutations rely strictly on PostgreSQL Row Level Security (public.is_admin()).
 * Standard client authentication only; no server-side elevated keys and no API proxy.
 */

import { supabase, isSupabaseConfigured } from '../utils/supabaseClient.js';
import { invalidateCatalogCache } from './catalogRepository.js';
import { invalidateSongCache } from './songRepository.js';

const VALID_LANGUAGES = ['telugu', 'english', 'hindi'];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Maps PostgreSQL and network error codes to human-readable administrative messages.
 * Never exposes raw error objects or database internal details.
 */
export function formatAdminError(error) {
  if (!error) return 'An unknown error occurred.';
  const msg = typeof error === 'string' ? error : error.message || '';
  const code = error.code || '';
  const lower = msg.toLowerCase();

  if (code === '42501' || lower.includes('row-level security') || lower.includes('permission denied')) {
    return 'Permission denied: Administrator privileges are required to perform this action.';
  }
  if (code === '23505' || lower.includes('unique constraint') || lower.includes('already exists')) {
    return 'A song with this URL slug already exists. Please choose a different title or slug.';
  }
  if (code === '23503' || lower.includes('foreign key')) {
    return 'Invalid reference: Selected language or songbook record does not exist.';
  }
  if (code === '401' || lower.includes('jwt expired') || lower.includes('session expired')) {
    return 'Your session has expired. Please sign in again to continue.';
  }
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('failed to fetch')) {
    return 'Unable to connect to the database. Please check your internet connection.';
  }

  return msg || 'Database operation failed. Please try again.';
}

/**
 * Generates a URL-friendly slug from string input.
 */
export function slugify(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Derives the grouping alphabet character for a song title.
 */
export function deriveAlphabet(title, language = 'telugu') {
  const clean = (title || '').trim().replace(/^["'‘“]/, '');
  if (!clean) return 'A';
  if (language === 'telugu' || clean.charCodeAt(0) > 127) {
    return clean.charAt(0);
  }
  return clean.charAt(0).toUpperCase();
}

/**
 * Normalizes an array of lyrics lines while strictly preserving empty string stanza separators.
 */
export function normalizeLyricsArray(lyricsInput) {
  if (Array.isArray(lyricsInput)) {
    return lyricsInput.map(line => (line === null || line === undefined ? '' : String(line)));
  }
  if (typeof lyricsInput === 'string') {
    return lyricsInput.split(/\r?\n/).map(line => line.trimEnd());
  }
  return [];
}

/**
 * Validates song input for creation or modification.
 */
export function validateSongInput(songData, isUpdate = false) {
  const errors = [];

  if (!isUpdate && !songData) {
    return { isValid: false, errors: ['Song payload is required.'] };
  }

  if (!isUpdate || songData.title !== undefined) {
    if (!songData.title || !songData.title.trim()) {
      errors.push('Song title is required.');
    }
  }

  if (!isUpdate || songData.language !== undefined) {
    const lang = (songData.language || '').toLowerCase().trim();
    if (!VALID_LANGUAGES.includes(lang)) {
      errors.push(`Language must be one of: ${VALID_LANGUAGES.join(', ')}.`);
    }
  }

  if (!isUpdate || songData.lyrics_original !== undefined) {
    const lyrics = normalizeLyricsArray(songData.lyrics_original);
    const nonBlankLines = lyrics.filter(line => line.trim().length > 0);
    if (nonBlankLines.length === 0) {
      errors.push('Lyrics are required and must contain at least one non-empty stanza line.');
    }
  }

  if (songData.slug !== undefined && songData.slug !== null) {
    const cleanSlug = slugify(songData.slug);
    if (songData.slug.trim() && !cleanSlug) {
      errors.push('Song slug contains invalid characters.');
    }
  }

  if (songData.ppt_url && typeof songData.ppt_url === 'string' && songData.ppt_url.trim()) {
    const trimmedPpt = songData.ppt_url.trim();
    if (!trimmedPpt.startsWith('http://') && !trimmedPpt.startsWith('https://')) {
      errors.push('PowerPoint URL must start with http:// or https://.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Checks if a URL slug is available (UX assistance only; DB UNIQUE constraint is authoritative).
 */
export async function checkSlugAvailability(slug) {
  if (!isSupabaseConfigured || !supabase || !slug) {
    return { available: false, error: 'Slug is required.' };
  }
  try {
    const cleanSlug = slugify(slug);
    if (!cleanSlug) return { available: false, error: 'Invalid slug.' };

    const { data, error } = await supabase
      .from('songs')
      .select('id')
      .eq('slug', cleanSlug)
      .maybeSingle();

    if (error) {
      return { available: false, error: formatAdminError(error) };
    }
    return { available: !data, slug: cleanSlug, error: null };
  } catch (err) {
    return { available: false, error: formatAdminError(err) };
  }
}

/**
 * Fetches existing categories from public.categories table.
 */
export async function fetchAvailableCategories() {
  if (!isSupabaseConfigured || !supabase) {
    return { categories: [], error: 'Database service is not configured.' };
  }
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('name, slug')
      .order('sort_order', { ascending: true });

    if (error) {
      return { categories: [], error: formatAdminError(error) };
    }
    return { categories: (data || []).map(c => c.name), error: null };
  } catch (err) {
    return { categories: [], error: formatAdminError(err) };
  }
}

/**
 * Authoritative public.songs columns in the deployed database schema.
 * Invented CMS fields (e.g. english_title, lyrics, category, chords_credits, audio_url,
 * video_url, sheet_music_url, tempo, beat, key, author, composed_by, lyrics_by, music_by,
 * song_references) do NOT exist in the database and must never be sent to Supabase.
 */
export const SONGS_SCHEMA_COLUMNS = [
  'id',
  'slug',
  'title',
  'title_transliterated',
  'language',
  'alphabet',
  'lyrics_original',
  'lyrics_transliterated',
  'youtube_id',
  'chords',
  'chord_count',
  'chord_credits',
  'author_english',
  'author_telugu',
  'category_names',
  'songbooks',
  'ppt_url',
  'bible_verses',
  'devotional',
  'is_published',
  'created_at',
  'updated_at'
];

/**
 * Whitelist of editable columns for updateSong().
 * 
 * Protected/Immutable columns that must NEVER be modified during song update:
 * - id: Immutable primary key
 * - created_at: Managed by database default
 * - updated_at: Managed by database trigger
 * - songbooks: Songbook association management belongs exclusively to Phase 9B-6 (Rule 21 & 27).
 */
export const EDITABLE_SONG_COLUMNS = [
  'slug',
  'title',
  'title_transliterated',
  'language',
  'alphabet',
  'lyrics_original',
  'lyrics_transliterated',
  'youtube_id',
  'chords',
  'chord_count',
  'chord_credits',
  'author_english',
  'author_telugu',
  'category_names',
  'ppt_url',
  'bible_verses',
  'devotional',
  'is_published'
];

/**
 * 1. getAdminCatalog()
 * Retrieves songs for administrator review, including both published and unpublished records.
 * RLS ensures only authenticated administrators receive unpublished hymns.
 * 
 * @param {Object} options - Search, filter, and pagination options
 * @returns {Promise<{ songs: Array, totalCount: number, error: string|null }>}
 */
export async function getAdminCatalog(options = {}) {
  if (!isSupabaseConfigured || !supabase) {
    return { songs: [], totalCount: 0, error: 'Database service is not configured.' };
  }

  try {
    const {
      query = '',
      language = 'all',
      status = 'all', // 'all' | 'published' | 'draft'
      category = null,
      sortBy = 'updated_at',
      sortAsc = false,
      page = 1,
      pageSize = 50
    } = options;

    let req = supabase
      .from('songs')
      .select('id, slug, title, title_transliterated, language, alphabet, author_english, author_telugu, category_names, songbooks, chords, youtube_id, ppt_url, is_published, created_at, updated_at', { count: 'exact' });

    // Language filter
    if (language && language !== 'all') {
      req = req.eq('language', language.toLowerCase());
    }

    // Published status filter
    if (status === 'published') {
      req = req.eq('is_published', true);
    } else if (status === 'draft') {
      req = req.eq('is_published', false);
    }

    // Category filter
    if (category && category !== 'all') {
      req = req.contains('category_names', [category]);
    }

    // Search query filter (title, transliteration, author)
    if (query && query.trim()) {
      const cleanQuery = query.trim();
      req = req.or(`title.ilike.%${cleanQuery}%,title_transliterated.ilike.%${cleanQuery}%,author_telugu.ilike.%${cleanQuery}%,author_english.ilike.%${cleanQuery}%`);
    }

    // Sorting
    const validSortColumns = ['updated_at', 'title', 'title_transliterated', 'created_at'];
    const cleanSortBy = validSortColumns.includes(sortBy) ? sortBy : 'updated_at';

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    req = req
      .order(cleanSortBy, { ascending: Boolean(sortAsc) })
      .range(from, to);

    const { data, count, error } = await req;

    if (error) {
      return { songs: [], totalCount: 0, error: formatAdminError(error) };
    }

    return {
      songs: data || [],
      totalCount: count || 0,
      error: null
    };
  } catch (err) {
    return { songs: [], totalCount: 0, error: formatAdminError(err) };
  }
}

/**
 * 2. getAdminSong(idOrSlug)
 * Fetches an individual song and its associated hymnal links for administrative editing.
 * 
 * @param {string} idOrSlug - Song UUID or URL slug
 * @returns {Promise<{ song: Object|null, songbookAssociations: Array, error: string|null }>}
 */
export async function getAdminSong(idOrSlug) {
  if (!isSupabaseConfigured || !supabase) {
    return { song: null, songbookAssociations: [], error: 'Database service is not configured.' };
  }

  try {
    const key = (idOrSlug || '').trim();
    if (!key) {
      return { song: null, songbookAssociations: [], error: 'Song identifier is required.' };
    }

    const isUuid = UUID_REGEX.test(key);
    const query = isUuid
      ? supabase.from('songs').select('*').eq('id', key).maybeSingle()
      : supabase.from('songs').select('*').eq('slug', key).maybeSingle();

    const { data: song, error: songErr } = await query;

    if (songErr) {
      return { song: null, songbookAssociations: [], error: formatAdminError(songErr) };
    }
    if (!song) {
      return { song: null, songbookAssociations: [], error: 'Song record not found.' };
    }

    // Fetch relational songbook associations from public.songbook_songs
    const { data: associations, error: assocErr } = await supabase
      .from('songbook_songs')
      .select('id, songbook_id, song_number')
      .eq('song_id', song.id);

    return {
      song,
      songbookAssociations: assocErr ? [] : (associations || []),
      error: null
    };
  } catch (err) {
    return { song: null, songbookAssociations: [], error: formatAdminError(err) };
  }
}

/**
 * 3. createSong(songData)
 * Inserts a new song into public.songs under PostgreSQL RLS verification.
 * Does NOT write to songbook_songs (Rule 18: deferred to Phase 9B-6).
 * 
 * @param {Object} songData - Form payload containing song attributes
 * @returns {Promise<{ success: boolean, song: Object|null, error: string|null }>}
 */
export async function createSong(songData) {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, song: null, error: 'Database service is not configured.' };
  }

  // 1. Client-side input validation
  const validation = validateSongInput(songData, false);
  if (!validation.isValid) {
    return { success: false, song: null, error: validation.errors.join(' ') };
  }

  try {
    const id = songData.id && UUID_REGEX.test(songData.id) ? songData.id : crypto.randomUUID();
    const language = songData.language.toLowerCase().trim();
    const title = songData.title.trim();
    const titleTransliterated = (songData.title_transliterated || '').trim();
    
    // Slug derivation
    let slug = slugify(songData.slug || titleTransliterated || title);
    if (!slug) slug = id;

    // Lyrics with preserved stanza separators
    const lyricsOriginal = normalizeLyricsArray(songData.lyrics_original);
    const lyricsTransliterated = normalizeLyricsArray(songData.lyrics_transliterated);

    // Alphabet grouping
    const alphabet = (songData.alphabet || deriveAlphabet(title, language)).trim();

    // Chords formatting
    const chords = Array.isArray(songData.chords) && songData.chords.length > 0 ? songData.chords : null;
    const chordCount = chords ? (songData.chord_count !== undefined ? songData.chord_count : chords.length) : 0;

    // Relational songbook array construction (denormalized JSONB on public.songs)
    const songbooksJsonb = Array.isArray(songData.songbooks) ? songData.songbooks : [];

    // Strictly whitelist exact public.songs columns only
    const record = {
      id,
      slug,
      title,
      title_transliterated: titleTransliterated || null,
      language,
      alphabet,
      lyrics_original: lyricsOriginal,
      lyrics_transliterated: lyricsTransliterated,
      youtube_id: songData.youtube_id ? String(songData.youtube_id).trim() : null,
      chords,
      chord_count: chordCount,
      chord_credits: songData.chord_credits ? String(songData.chord_credits).trim() : null,
      author_english: songData.author_english ? String(songData.author_english).trim() : null,
      author_telugu: songData.author_telugu ? String(songData.author_telugu).trim() : null,
      category_names: Array.isArray(songData.category_names) ? songData.category_names : [],
      songbooks: songbooksJsonb,
      ppt_url: songData.ppt_url ? String(songData.ppt_url).trim() : null,
      bible_verses: Array.isArray(songData.bible_verses) ? songData.bible_verses : [],
      devotional: songData.devotional && typeof songData.devotional === 'object' && Object.keys(songData.devotional).length > 0 ? songData.devotional : null,
      is_published: songData.is_published !== undefined ? Boolean(songData.is_published) : true
    };

    // 2. Insert into public.songs (PostgreSQL RLS is authoritative)
    const { data: newSong, error: insertErr } = await supabase
      .from('songs')
      .insert(record)
      .select()
      .single();

    if (insertErr) {
      return { success: false, song: null, error: formatAdminError(insertErr) };
    }

    // 3. Invalidate in-memory caches
    invalidateCatalogCache();
    invalidateSongCache(newSong.id);
    invalidateSongCache(newSong.slug);

    return {
      success: true,
      song: newSong,
      error: null
    };
  } catch (err) {
    return { success: false, song: null, error: formatAdminError(err) };
  }
}

/**
 * 4. updateSong(id, songData)
 * Updates mutable fields of an existing song under PostgreSQL RLS verification.
 * 
 * @param {string} id - Song UUID (immutable)
 * @param {Object} songData - Mutable fields to update
 * @returns {Promise<{ success: boolean, song: Object|null, error: string|null }>}
 */
export async function updateSong(id, songData) {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, song: null, error: 'Database service is not configured.' };
  }

  if (!id || !UUID_REGEX.test(id)) {
    return { success: false, song: null, error: 'A valid song UUID is required for update.' };
  }

  // 1. Client-side input validation
  const validation = validateSongInput(songData, true);
  if (!validation.isValid) {
    return { success: false, song: null, error: validation.errors.join(' ') };
  }

  try {
    // 2. Fetch existing song to verify existence and capture previous slug for cache invalidation
    const { data: previousSong, error: prevErr } = await supabase
      .from('songs')
      .select('id, slug')
      .eq('id', id)
      .maybeSingle();

    if (prevErr) {
      return { success: false, song: null, error: formatAdminError(prevErr) };
    }
    if (!previousSong) {
      return { success: false, song: null, error: 'Song record not found or already removed.' };
    }

    const payload = {};

    // Mutable fields whitelist - strictly matching EDITABLE_SONG_COLUMNS
    // NEVER include id, created_at, updated_at, or songbooks
    if (songData.title !== undefined) {
      payload.title = songData.title.trim();
    }
    if (songData.title_transliterated !== undefined) {
      payload.title_transliterated = (songData.title_transliterated || '').trim() || null;
    }
    if (songData.slug !== undefined) {
      const cleanSlug = slugify(songData.slug);
      if (cleanSlug) payload.slug = cleanSlug;
    }
    if (songData.language !== undefined) {
      payload.language = songData.language.toLowerCase().trim();
    }
    if (songData.alphabet !== undefined) {
      payload.alphabet = (songData.alphabet || '').trim();
    } else if (payload.title && payload.language) {
      payload.alphabet = deriveAlphabet(payload.title, payload.language);
    }
    if (songData.lyrics_original !== undefined) {
      payload.lyrics_original = normalizeLyricsArray(songData.lyrics_original);
    }
    if (songData.lyrics_transliterated !== undefined) {
      payload.lyrics_transliterated = normalizeLyricsArray(songData.lyrics_transliterated);
    }
    if (songData.youtube_id !== undefined) {
      payload.youtube_id = songData.youtube_id ? String(songData.youtube_id).trim() : null;
    }
    if (songData.chords !== undefined) {
      payload.chords = Array.isArray(songData.chords) && songData.chords.length > 0 ? songData.chords : null;
      payload.chord_count = payload.chords ? (songData.chord_count !== undefined ? songData.chord_count : payload.chords.length) : 0;
    }
    if (songData.chord_credits !== undefined) {
      payload.chord_credits = songData.chord_credits ? String(songData.chord_credits).trim() : null;
    }
    if (songData.author_english !== undefined) {
      payload.author_english = songData.author_english ? String(songData.author_english).trim() : null;
    }
    if (songData.author_telugu !== undefined) {
      payload.author_telugu = songData.author_telugu ? String(songData.author_telugu).trim() : null;
    }
    if (songData.category_names !== undefined) {
      payload.category_names = Array.isArray(songData.category_names) ? songData.category_names : [];
    }
    if (songData.ppt_url !== undefined) {
      payload.ppt_url = songData.ppt_url ? String(songData.ppt_url).trim() : null;
    }
    if (songData.bible_verses !== undefined) {
      payload.bible_verses = Array.isArray(songData.bible_verses) ? songData.bible_verses : [];
    }
    if (songData.devotional !== undefined) {
      payload.devotional = songData.devotional && Object.keys(songData.devotional).length > 0 ? songData.devotional : null;
    }
    if (songData.is_published !== undefined) {
      payload.is_published = Boolean(songData.is_published);
    }

    // 3. Execute update on public.songs
    const { data: updatedSong, error: updateErr } = await supabase
      .from('songs')
      .update(payload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (updateErr) {
      return { success: false, song: null, error: formatAdminError(updateErr) };
    }
    if (!updatedSong) {
      return { success: false, song: null, error: 'Song record not found or already removed.' };
    }

    // 4. Invalidate in-memory caches
    invalidateCatalogCache();
    invalidateSongCache(id);
    if (previousSong.slug) invalidateSongCache(previousSong.slug);
    if (updatedSong.slug) invalidateSongCache(updatedSong.slug);

    return {
      success: true,
      song: updatedSong,
      error: null
    };
  } catch (err) {
    return { success: false, song: null, error: formatAdminError(err) };
  }
}

/**
 * 5. deleteSong(id)
 * Permanently deletes a song from public.songs under PostgreSQL RLS verification.
 * 
 * CRITICAL DATA-SAFETY RULES:
 * - Fail-closed: checks pinned_songs and songbook_songs before deletion.
 * - If pinned_songs references the song: BLOCKS DELETE.
 * - If songbook_songs has associations: BLOCKS DELETE.
 * - Does NOT automatically delete pinned_songs rows or songbook_songs rows.
 * - Does NOT mutate songbooks JSONB or cascade application-level data.
 * - In-memory caches are invalidated only after successful database deletion.
 * 
 * CONCURRENCY NOTICE:
 * Client-side relationship checks are executed immediately prior to the DELETE statement.
 * They do not provide atomic serializable isolation without a dedicated server-side RPC or trigger.
 * If concurrent modifications occur between the check and the delete, Postgres FK and trigger
 * constraints represent the ultimate security and integrity boundary.
 * 
 * @param {string} id - Song UUID
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export async function deleteSong(id) {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Database service is not configured.' };
  }

  if (!id || !UUID_REGEX.test(id)) {
    return { success: false, error: 'A valid song UUID is required for deletion.' };
  }

  try {
    // 1. Inspect relationships (pinned_songs & songbook_songs)
    const eligibility = await checkSongDeleteEligibility(id);

    if (eligibility.error) {
      return { success: false, error: eligibility.error };
    }

    if (!eligibility.canDelete) {
      return {
        success: false,
        error: eligibility.blockReason || 'Song cannot be deleted while active relationships exist.'
      };
    }

    const song = eligibility.song;

    // 2. Execute deletion strictly on public.songs and verify deletion result
    const { data: deletedRows, error: deleteErr } = await supabase
      .from('songs')
      .delete()
      .eq('id', id)
      .select('id');

    if (deleteErr) {
      return { success: false, error: formatAdminError(deleteErr) };
    }

    if (!deletedRows || deletedRows.length === 0) {
      return {
        success: false,
        error: 'Permission denied or song could not be deleted. Administrator privileges are required.'
      };
    }

    // 3. Invalidate caches
    invalidateCatalogCache();
    invalidateSongCache(id);
    if (song?.slug) invalidateSongCache(song.slug);

    return {
      success: true,
      error: null
    };
  } catch (err) {
    return { success: false, error: formatAdminError(err) };
  }
}

/**
 * 6. unpublishSong(id)
 * Sets is_published = false on a song record under PostgreSQL RLS verification.
 * Does NOT alter title, slug, lyrics, categories, songbooks, songbook_songs,
 * pinned_songs, or manually alter timestamps (database trigger manages updated_at).
 * 
 * @param {string} id - Song UUID
 * @returns {Promise<{ success: boolean, song: Object|null, error: string|null }>}
 */
export async function unpublishSong(id) {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, song: null, error: 'Database service is not configured.' };
  }

  if (!id || !UUID_REGEX.test(id)) {
    return { success: false, song: null, error: 'A valid song UUID is required.' };
  }

  try {
    // Execute update strictly altering ONLY is_published
    const { data: updatedSong, error: updateErr } = await supabase
      .from('songs')
      .update({ is_published: false })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (updateErr) {
      return { success: false, song: null, error: formatAdminError(updateErr) };
    }
    if (!updatedSong) {
      return { success: false, song: null, error: 'Song record not found or already removed.' };
    }

    // Invalidate in-memory caches
    invalidateCatalogCache();
    invalidateSongCache(id);
    if (updatedSong.slug) invalidateSongCache(updatedSong.slug);

    return {
      success: true,
      song: updatedSong,
      error: null
    };
  } catch (err) {
    return { success: false, song: null, error: formatAdminError(err) };
  }
}

/**
 * checkSongDeleteEligibility(id, slug)
 * Performs fail-closed relationship inspection for a song before deletion.
 * Checks whether the song is referenced in public.pinned_songs or public.songbook_songs.
 * 
 * NOTE: These checks are client-side queries against PostgREST before deletion.
 * They do not constitute an atomic database transaction. If relationships are
 * created concurrently between check and deletion, PostgreSQL foreign keys
 * or application constraints govern final execution.
 * 
 * @param {string} id - Song UUID
 * @param {string} [slug] - Optional song slug
 * @returns {Promise<{ canDelete: boolean, isPinned: boolean, songbookCount: number, song: Object|null, blockReason: string|null, error: string|null }>}
 */
export async function checkSongDeleteEligibility(id, slug = null) {
  if (!isSupabaseConfigured || !supabase) {
    return {
      canDelete: false,
      isPinned: false,
      songbookCount: 0,
      song: null,
      blockReason: 'Database service is not configured.',
      error: 'Database service is not configured.'
    };
  }

  if (!id || !UUID_REGEX.test(id)) {
    return {
      canDelete: false,
      isPinned: false,
      songbookCount: 0,
      song: null,
      blockReason: 'A valid song UUID is required.',
      error: 'A valid song UUID is required.'
    };
  }

  try {
    // 1. Fetch song record to verify existence and retrieve slug if not provided
    const { data: song, error: songErr } = await supabase
      .from('songs')
      .select('id, slug, title')
      .eq('id', id)
      .maybeSingle();

    if (songErr) {
      return {
        canDelete: false,
        isPinned: false,
        songbookCount: 0,
        song: null,
        blockReason: formatAdminError(songErr),
        error: formatAdminError(songErr)
      };
    }
    if (!song) {
      return {
        canDelete: false,
        isPinned: false,
        songbookCount: 0,
        song: null,
        blockReason: 'Song record not found or already deleted.',
        error: 'Song record not found or already deleted.'
      };
    }

    const targetSlug = slug || song.slug;

    // 2. Check public.pinned_songs (fails closed if query errors)
    let pinnedRows = [];
    try {
      const pinQuery = targetSlug
        ? supabase.from('pinned_songs').select('id, slug, title').or(`id.eq.${song.id},slug.eq.${targetSlug}`)
        : supabase.from('pinned_songs').select('id, slug, title').eq('id', song.id);

      const { data, error: pinErr } = await pinQuery;
      if (pinErr) {
        return {
          canDelete: false,
          isPinned: false,
          songbookCount: 0,
          song,
          blockReason: formatAdminError(pinErr),
          error: formatAdminError(pinErr)
        };
      }
      pinnedRows = data || [];
    } catch (pinFetchErr) {
      return {
        canDelete: false,
        isPinned: false,
        songbookCount: 0,
        song,
        blockReason: formatAdminError(pinFetchErr),
        error: formatAdminError(pinFetchErr)
      };
    }

    const isPinned = Array.isArray(pinnedRows) && pinnedRows.length > 0;

    // 3. Check public.songbook_songs (fails closed if query errors)
    let songbookCount = 0;
    try {
      const { count, error: sbErr } = await supabase
        .from('songbook_songs')
        .select('id', { count: 'exact', head: true })
        .eq('song_id', song.id);

      if (sbErr) {
        return {
          canDelete: false,
          isPinned,
          songbookCount: 0,
          song,
          blockReason: formatAdminError(sbErr),
          error: formatAdminError(sbErr)
        };
      }
      songbookCount = typeof count === 'number' ? count : 0;
    } catch (sbFetchErr) {
      return {
        canDelete: false,
        isPinned,
        songbookCount: 0,
        song,
        blockReason: formatAdminError(sbFetchErr),
        error: formatAdminError(sbFetchErr)
      };
    }

    // 4. Determine eligibility and block reason
    let blockReason = null;
    if (isPinned) {
      blockReason = "This song is currently pinned for Today's Service. Remove the pin before deleting the song.";
    } else if (songbookCount > 0) {
      blockReason = `This song is assigned to ${songbookCount} songbook${songbookCount === 1 ? '' : 's'}. Remove its songbook associations before deleting the song.`;
    }

    const canDelete = !isPinned && songbookCount === 0;

    return {
      canDelete,
      isPinned,
      songbookCount,
      song,
      blockReason,
      error: null
    };
  } catch (err) {
    return {
      canDelete: false,
      isPinned: false,
      songbookCount: 0,
      song: null,
      blockReason: formatAdminError(err),
      error: formatAdminError(err)
    };
  }
}


// =============================================================================
// SONGBOOK ASSOCIATION MANAGEMENT (Phase 9B-6)
// =============================================================================
// Canonical relationship: public.songbook_songs (junction table)
// songs.songbooks (JSONB) is denormalized read-only — NOT written here.
// No trigger exists to auto-sync songs.songbooks from songbook_songs.
// pinned_songs is never modified by association management.
// =============================================================================

/**
 * Fetches all available songbooks from public.songbooks.
 * Dynamically loaded — never hardcoded.
 * 
 * @returns {Promise<{ songbooks: Array, error: string|null }>}
 */
export async function getAvailableSongbooks(options = {}) {
  if (!isSupabaseConfigured || !supabase) {
    return { songbooks: [], error: 'Database service is not configured.' };
  }

  const onlyActive = typeof options === 'boolean'
    ? options
    : (options.includeInactive ? false : (options.onlyActive ?? true));

  try {
    let query = supabase
      .from('songbooks')
      .select('id, slug, title, title_native, language, description, sort_order, is_active, is_numbered')
      .order('sort_order', { ascending: true });

    if (onlyActive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      return { songbooks: [], error: formatAdminError(error) };
    }
    return { songbooks: data || [], error: null };
  } catch (err) {
    return { songbooks: [], error: formatAdminError(err) };
  }
}

/**
 * Fetches current songbook associations for a specific song.
 * Returns junction table rows with songbook metadata joined (including is_active).
 * 
 * @param {string} songId - Song UUID
 * @returns {Promise<{ associations: Array, error: string|null }>}
 */
export async function getSongbookAssociations(songId) {
  if (!isSupabaseConfigured || !supabase) {
    return { associations: [], error: 'Database service is not configured.' };
  }

  if (!songId || !UUID_REGEX.test(songId)) {
    return { associations: [], error: 'A valid song UUID is required.' };
  }

  try {
    const { data, error } = await supabase
      .from('songbook_songs')
      .select('id, song_id, songbook_id, song_number, created_at, songbooks(id, slug, title, title_native, is_active, sort_order)')
      .eq('song_id', songId);

    if (error) {
      return { associations: [], error: formatAdminError(error) };
    }
    return { associations: data || [], error: null };
  } catch (err) {
    return { associations: [], error: formatAdminError(err) };
  }
}

/**
 * Adds a single songbook association.
 * Inserts into public.songbook_songs under PostgreSQL RLS.
 * 
 * Does NOT modify songs metadata or pinned_songs.
 * Handles duplicate via UNIQUE constraint (uq_songbook_songs).
 * 
 * @param {string} songId - Song UUID
 * @param {string} songbookId - Songbook UUID
 * @param {number|null} songNumber - Optional song number in the songbook
 * @returns {Promise<{ success: boolean, association: Object|null, error: string|null }>}
 */
export async function addSongbookAssociation(songId, songbookId, songNumber = null) {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, association: null, error: 'Database service is not configured.' };
  }

  if (!songId || !UUID_REGEX.test(songId)) {
    return { success: false, association: null, error: 'A valid song UUID is required.' };
  }
  if (!songbookId || !UUID_REGEX.test(songbookId)) {
    return { success: false, association: null, error: 'A valid songbook UUID is required.' };
  }

  try {
    const record = {
      song_id: songId,
      songbook_id: songbookId,
    };

    if (songNumber !== null && songNumber !== undefined && songNumber !== '') {
      const num = parseInt(songNumber, 10);
      if (!isNaN(num) && num > 0) {
        record.song_number = num;
      }
    }

    const { data, error } = await supabase
      .from('songbook_songs')
      .insert(record)
      .select()
      .single();

    if (error) {
      // Handle duplicate association (UNIQUE constraint violation)
      if (error.code === '23505') {
        return { success: false, association: null, error: 'This song is already assigned to this songbook.' };
      }
      return { success: false, association: null, error: formatAdminError(error) };
    }

    return { success: true, association: data, error: null };
  } catch (err) {
    return { success: false, association: null, error: formatAdminError(err) };
  }
}

/**
 * Removes a single songbook association.
 * Deletes from public.songbook_songs under PostgreSQL RLS.
 * 
 * Does NOT delete the song. Does NOT delete the songbook.
 * Does NOT modify songs metadata or pinned_songs.
 * 
 * @param {string} songId - Song UUID
 * @param {string} songbookId - Songbook UUID
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export async function removeSongbookAssociation(songId, songbookId) {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Database service is not configured.' };
  }

  if (!songId || !UUID_REGEX.test(songId)) {
    return { success: false, error: 'A valid song UUID is required.' };
  }
  if (!songbookId || !UUID_REGEX.test(songbookId)) {
    return { success: false, error: 'A valid songbook UUID is required.' };
  }

  try {
    const { data: deletedRows, error } = await supabase
      .from('songbook_songs')
      .delete()
      .eq('song_id', songId)
      .eq('songbook_id', songbookId)
      .select('id');

    if (error) {
      return { success: false, error: formatAdminError(error) };
    }

    if (!deletedRows || deletedRows.length === 0) {
      return { success: false, error: 'Association not found or permission denied.' };
    }

    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: formatAdminError(err) };
  }
}

/**
 * Reconciles songbook associations for a song using difference-based logic.
 * Calculates toAdd, toRemove, and toUpdate from current vs desired state.
 * 
 * ATOMICITY: This is NOT transactional. Multiple PostgREST calls are made.
 * Partial failure is explicitly reported — never claimed as fully transactional.
 * 
 * Does NOT modify songs metadata, pinned_songs, or songbooks table.
 * 
 * @param {string} songId - Song UUID
 * @param {Array<{ songbookId: string, songNumber: number|null }>} desiredAssociations
 * @returns {Promise<{ success: boolean, added: number, removed: number, updated: number, errors: string[], error: string|null }>}
 */
export async function reconcileSongbookAssociations(songId, desiredAssociations) {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, added: 0, removed: 0, updated: 0, errors: [], error: 'Database service is not configured.' };
  }

  if (!songId || !UUID_REGEX.test(songId)) {
    return { success: false, added: 0, removed: 0, updated: 0, errors: [], error: 'A valid song UUID is required.' };
  }

  if (!Array.isArray(desiredAssociations)) {
    return { success: false, added: 0, removed: 0, updated: 0, errors: [], error: 'Desired associations must be an array.' };
  }

  try {
    // 1. Fetch current associations from the database
    const { associations: currentAssociations, error: fetchErr } = await getSongbookAssociations(songId);
    if (fetchErr) {
      return { success: false, added: 0, removed: 0, updated: 0, errors: [fetchErr], error: fetchErr };
    }

    // 2. Build lookup maps
    const currentMap = new Map();
    for (const assoc of currentAssociations) {
      currentMap.set(assoc.songbook_id, assoc);
    }

    const desiredMap = new Map();
    for (const desired of desiredAssociations) {
      if (desired.songbookId && UUID_REGEX.test(desired.songbookId)) {
        desiredMap.set(desired.songbookId, desired);
      }
    }

    // 3. Calculate differences
    const toAdd = [];
    const toRemove = [];
    const toUpdate = [];

    // Associations to remove: in current but not in desired
    for (const [sbId, assoc] of currentMap) {
      if (!desiredMap.has(sbId)) {
        toRemove.push(assoc);
      }
    }

    // Associations to add: in desired but not in current
    // Associations to update: in both but song_number changed
    for (const [sbId, desired] of desiredMap) {
      if (!currentMap.has(sbId)) {
        toAdd.push(desired);
      } else {
        const current = currentMap.get(sbId);
        if (desired.songNumber !== undefined) {
          const desiredNum = desired.songNumber !== null && desired.songNumber !== ''
            ? parseInt(desired.songNumber, 10) : null;
          const currentNum = current.song_number;
          if (desiredNum !== currentNum) {
            toUpdate.push({ ...current, newSongNumber: desiredNum });
          }
        }
      }
    }

    // 4. Execute mutations with explicit partial failure tracking
    let added = 0;
    let removed = 0;
    let updated = 0;
    const errors = [];

    // Process removals
    for (const assoc of toRemove) {
      const result = await removeSongbookAssociation(songId, assoc.songbook_id);
      if (result.success) {
        removed++;
      } else {
        errors.push(`Remove from songbook failed: ${result.error}`);
      }
    }

    // Process additions
    for (const desired of toAdd) {
      const songNum = desired.songNumber !== null && desired.songNumber !== undefined && desired.songNumber !== ''
        ? parseInt(desired.songNumber, 10) : null;
      const result = await addSongbookAssociation(songId, desired.songbookId, songNum);
      if (result.success) {
        added++;
      } else {
        errors.push(`Add to songbook failed: ${result.error}`);
      }
    }

    // Process updates (song_number changes)
    for (const item of toUpdate) {
      try {
        const { error: upErr } = await supabase
          .from('songbook_songs')
          .update({ song_number: item.newSongNumber })
          .eq('song_id', songId)
          .eq('songbook_id', item.songbook_id);

        if (upErr) {
          errors.push(`Update song number failed: ${formatAdminError(upErr)}`);
        } else {
          updated++;
        }
      } catch (upCatchErr) {
        errors.push(`Update song number failed: ${formatAdminError(upCatchErr)}`);
      }
    }

    const totalChanges = added + removed + updated;
    const totalErrors = errors.length;

    if (totalErrors > 0 && totalChanges > 0) {
      // Partial failure
      return {
        success: false,
        added,
        removed,
        updated,
        errors,
        error: `Songbook associations were partially updated. ${totalChanges} change${totalChanges === 1 ? '' : 's'} succeeded and ${totalErrors} change${totalErrors === 1 ? '' : 's'} failed.`
      };
    }

    if (totalErrors > 0 && totalChanges === 0) {
      return {
        success: false,
        added: 0,
        removed: 0,
        updated: 0,
        errors,
        error: errors.join(' ')
      };
    }

    // Invalidate caches if any mutations occurred
    if (totalChanges > 0) {
      invalidateCatalogCache();
      invalidateSongCache(songId);
    }

    return {
      success: true,
      added,
      removed,
      updated,
      errors: [],
      error: null
    };
  } catch (err) {
    return { success: false, added: 0, removed: 0, updated: 0, errors: [formatAdminError(err)], error: formatAdminError(err) };
  }
}

/**
 * Updates songbook associations for a song.
 * Accepts an array of songbook UUIDs, or an array of objects
 * ({ songbookId, songNumber } or { id, song_number }).
 * 
 * Delegates to difference-based reconcileSongbookAssociations.
 * Never modifies songs metadata, songs.songbooks JSONB, or pinned_songs.
 * 
 * @param {string} songId - Song UUID
 * @param {Array<string|{ songbookId: string, songNumber?: number|null }>} desiredSongbookIds
 * @returns {Promise<{ success: boolean, added: number, removed: number, updated: number, errors: string[], error: string|null }>}
 */
export async function updateSongbookAssociations(songId, desiredSongbookIds) {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, added: 0, removed: 0, updated: 0, errors: [], error: 'Database service is not configured.' };
  }

  if (!songId || !UUID_REGEX.test(songId)) {
    return { success: false, added: 0, removed: 0, updated: 0, errors: [], error: 'A valid song UUID is required.' };
  }

  if (!Array.isArray(desiredSongbookIds)) {
    return { success: false, added: 0, removed: 0, updated: 0, errors: [], error: 'Desired songbook associations must be an array.' };
  }

  const normalized = desiredSongbookIds.map(item => {
    if (typeof item === 'string') {
      return { songbookId: item, songNumber: undefined };
    }
    if (item && typeof item === 'object') {
      return {
        songbookId: item.songbookId || item.id || item.songbook_id,
        songNumber: item.songNumber !== undefined ? item.songNumber : (item.song_number !== undefined ? item.song_number : undefined)
      };
    }
    return null;
  }).filter(item => item && item.songbookId && UUID_REGEX.test(item.songbookId));

  return reconcileSongbookAssociations(songId, normalized);
}

