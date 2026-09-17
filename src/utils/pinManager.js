/**
 * pinManager.js - Church Pinned / Featured Songs Manager
 * Fetches and synchronizes pinned worship songs from Supabase with static JSON fallback.
 * Write operations strictly require an authenticated Supabase admin session.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';

const STORAGE_KEY = 'jhf_pinned_songs_v1';
let realtimeSubscribed = false;

/**
 * Get locally cached pinned songs (synchronous, instant)
 */
export function getPinnedSongs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.sort((a, b) => (a.pinNumber || 999) - (b.pinNumber || 999));
  } catch (err) {
    console.error('Error reading pinned songs:', err);
    return [];
  }
}

/**
 * Checks if a specific song is currently pinned
 */
export function isSongPinned(songId, songSlug) {
  const list = getPinnedSongs();
  const match = list.find(s => (songId && s.id === songId) || (songSlug && s.slug === songSlug));
  return {
    isPinned: !!match,
    pinNumber: match ? match.pinNumber : null,
    pinnedItem: match || null
  };
}

/**
 * Fetch latest pinned songs from cloud (Supabase or static JSON fallback)
 */
export async function fetchPinnedSongs() {
  // 1. Try Supabase if configured
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('pinned_songs')
        .select('*')
        .order('pin_number', { ascending: true });

      if (!error && Array.isArray(data)) {
        const formatted = data.map(row => ({
          id: row.id,
          slug: row.slug || row.id,
          title: row.title,
          title_transliterated: row.title_transliterated || '',
          author: row.author || '',
          language: row.language || 'telugu',
          youtube_id: row.youtube_id || '',
          ppt_url: row.ppt_url || '',
          chords: !!row.chords,
          pinNumber: row.pin_number || 1,
          pinnedAt: row.pinned_at || new Date().toISOString()
        }));

        localStorage.setItem(STORAGE_KEY, JSON.stringify(formatted));
        window.dispatchEvent(new CustomEvent('jhf_pinned_songs_changed', { detail: formatted }));
        initRealtimeSubscription();
        return formatted;
      }
    } catch (err) {
      console.warn('Supabase fetch failed, trying fallback:', err);
    }
  }

  // 2. Fallback to public/data/pinned_songs.json
  try {
    const res = await fetch('./data/pinned_songs.json');
    if (res.ok) {
      const staticList = await res.json();
      if (Array.isArray(staticList) && staticList.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(staticList));
        window.dispatchEvent(new CustomEvent('jhf_pinned_songs_changed', { detail: staticList }));
        return staticList;
      }
    }
  } catch (_) {}

  return getPinnedSongs();
}

/**
 * Initializes Supabase real-time listener so church members' browsers
 * update automatically when an admin pins/unpins a song during service.
 */
export function initRealtimeSubscription() {
  if (realtimeSubscribed || !isSupabaseConfigured || !supabase) return;
  realtimeSubscribed = true;

  try {
    supabase
      .channel('church_pinned_songs_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pinned_songs' },
        () => {
          fetchPinnedSongs();
        }
      )
      .subscribe();
  } catch (err) {
    console.warn('Could not initialize Supabase realtime:', err);
  }
}

/**
 * Pin a song with an order number (e.g. #1, #2...)
 * Requires active Supabase admin authentication.
 * Fails closed if database write fails; does not mask failures with localStorage.
 */
export async function pinSong(song, requestedNumber = null) {
  if (!song) return { success: false, error: 'No song provided' };

  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Database is not configured' };
  }

  const list = getPinnedSongs();
  const targetId = song.id || song.slug;
  const remaining = list.filter(s => s.id !== targetId && s.slug !== song.slug);

  let pinNum = requestedNumber ? parseInt(requestedNumber, 10) : null;
  if (!pinNum || isNaN(pinNum) || pinNum < 1) {
    const maxNum = remaining.reduce((max, s) => Math.max(max, s.pinNumber || 0), 0);
    pinNum = maxNum + 1;
  }

  const pinnedEntry = {
    id: song.id || song.slug,
    slug: song.slug || song.id,
    title: song.title || song.t || 'Worship Song',
    title_transliterated: song.title_transliterated || song.tr || '',
    author: song.author_english || song.author_telugu || song.auth || '',
    language: song.language || song.lang || 'telugu',
    youtube_id: song.youtube_id || song.yt || '',
    ppt_url: song.ppt_url || '',
    chords: !!(song.chords && song.chords.length > 0) || !!song.chords,
    pin_number: pinNum,
    pinned_at: new Date().toISOString()
  };

  // Execute database write first
  const { data, error } = await supabase
    .from('pinned_songs')
    .upsert(pinnedEntry)
    .select();

  if (error || !data || data.length === 0) {
    const errMsg = error?.message || 'Database write rejected by security policy (Admin authentication required)';
    console.warn('pinSong failed:', errMsg);
    return { success: false, error: errMsg };
  }

  // Update local cache only upon confirmed database success
  const formattedEntry = {
    ...pinnedEntry,
    pinNumber: pinnedEntry.pin_number,
    pinnedAt: pinnedEntry.pinned_at
  };
  const updated = [...remaining, formattedEntry].sort((a, b) => a.pinNumber - b.pinNumber);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('jhf_pinned_songs_changed', { detail: updated }));

  return { success: true, songs: updated };
}

/**
 * Unpin a song
 * Requires active Supabase admin authentication.
 * Fails closed if database delete fails.
 */
export async function unpinSong(songId, songSlug) {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Database is not configured' };
  }

  const targetId = songId || songSlug;
  const { data, error } = await supabase
    .from('pinned_songs')
    .delete()
    .eq('id', targetId)
    .select();

  if (error || !data || data.length === 0) {
    const errMsg = error?.message || 'Database delete rejected by security policy (Admin authentication required)';
    console.warn('unpinSong failed:', errMsg);
    return { success: false, error: errMsg };
  }

  const list = getPinnedSongs();
  const updated = list.filter(s => s.id !== songId && s.slug !== songSlug);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('jhf_pinned_songs_changed', { detail: updated }));

  return { success: true, songs: updated };
}

/**
 * Update the order/number of a pinned song
 * Requires active Supabase admin authentication.
 * Fails closed if database update fails.
 */
export async function updatePinNumber(songId, newNumber) {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Database is not configured' };
  }

  const num = parseInt(newNumber, 10);
  if (isNaN(num) || num < 1) return { success: false, error: 'Invalid pin number' };

  const { data, error } = await supabase
    .from('pinned_songs')
    .update({ pin_number: num })
    .eq('id', songId)
    .select();

  if (error || !data || data.length === 0) {
    const errMsg = error?.message || 'Database update rejected by security policy (Admin authentication required)';
    console.warn('updatePinNumber failed:', errMsg);
    return { success: false, error: errMsg };
  }

  const list = getPinnedSongs();
  const updated = list.map(s => {
    if (s.id === songId || s.slug === songId) {
      return { ...s, pinNumber: num };
    }
    return s;
  }).sort((a, b) => a.pinNumber - b.pinNumber);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('jhf_pinned_songs_changed', { detail: updated }));

  return { success: true, songs: updated };
}
