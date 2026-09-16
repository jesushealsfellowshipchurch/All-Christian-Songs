/**
 * pinManager.js - Church Pinned / Featured Songs Manager
 * Allows church admins to pin featured worship songs (e.g. for today's Sunday service)
 * with order numbers (#1, #2, #3...), syncing in real-time across the landing page and song details.
 * Supports Supabase Realtime cloud synchronization so all church members see updates instantly.
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
 * Fetch latest pinned songs from cloud (Supabase or Vercel serverless / static JSON)
 * Syncs with all church members' devices.
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

  // 2. Try Vercel Serverless Function /api/pinned-songs
  try {
    const res = await fetch('/api/pinned-songs');
    if (res.ok) {
      const result = await res.json();
      if (result.success && Array.isArray(result.songs) && result.songs.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(result.songs));
        window.dispatchEvent(new CustomEvent('jhf_pinned_songs_changed', { detail: result.songs }));
        return result.songs;
      }
    }
  } catch (_) {}

  // 3. Fallback to public/data/pinned_songs.json
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
 * update automatically when an admin pins/unpins a song during service!
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
          // Re-fetch when admin updates anything
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
 */
export async function pinSong(song, requestedNumber = null) {
  if (!song) return [];
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
    pinNumber: pinNum,
    pinnedAt: new Date().toISOString()
  };

  const updated = [...remaining, pinnedEntry].sort((a, b) => a.pinNumber - b.pinNumber);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('jhf_pinned_songs_changed', { detail: updated }));

  // Cloud Sync to Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('pinned_songs').upsert({
        id: pinnedEntry.id,
        slug: pinnedEntry.slug,
        title: pinnedEntry.title,
        title_transliterated: pinnedEntry.title_transliterated,
        author: pinnedEntry.author,
        language: pinnedEntry.language,
        youtube_id: pinnedEntry.youtube_id,
        ppt_url: pinnedEntry.ppt_url,
        chords: pinnedEntry.chords,
        pin_number: pinnedEntry.pinNumber,
        pinned_at: pinnedEntry.pinnedAt
      });
    } catch (err) {
      console.warn('Failed to save pinned song to Supabase:', err);
    }
  }

  // Also sync to Vercel Serverless if running
  syncToVercelApi(updated);

  return updated;
}

/**
 * Unpin a song
 */
export async function unpinSong(songId, songSlug) {
  const list = getPinnedSongs();
  const targetId = songId || songSlug;
  const updated = list.filter(s => {
    if (songId && s.id === songId) return false;
    if (songSlug && s.slug === songSlug) return false;
    return true;
  });

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('jhf_pinned_songs_changed', { detail: updated }));

  // Cloud Remove from Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      if (songId) {
        await supabase.from('pinned_songs').delete().eq('id', songId);
      }
      if (songSlug && songSlug !== songId) {
        await supabase.from('pinned_songs').delete().eq('slug', songSlug);
      }
    } catch (err) {
      console.warn('Failed to delete pinned song from Supabase:', err);
    }
  }

  // Also sync to Vercel Serverless
  syncToVercelApi(updated);

  return updated;
}

/**
 * Update the order/number of a pinned song
 */
export async function updatePinNumber(songId, newNumber) {
  const list = getPinnedSongs();
  const num = parseInt(newNumber, 10);
  if (isNaN(num) || num < 1) return list;

  const updated = list.map(s => {
    if (s.id === songId || s.slug === songId) {
      return { ...s, pinNumber: num };
    }
    return s;
  }).sort((a, b) => a.pinNumber - b.pinNumber);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('jhf_pinned_songs_changed', { detail: updated }));

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('pinned_songs').update({ pin_number: num }).eq('id', songId);
    } catch (err) {
      console.warn('Failed to update pin number in Supabase:', err);
    }
  }

  syncToVercelApi(updated);
  return updated;
}

/**
 * Helper to sync to Vercel serverless /api/pinned-songs if available
 */
async function syncToVercelApi(songs) {
  try {
    await fetch('/api/pinned-songs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songs, password: 'sherwin1990' })
    });
  } catch (_) {}
}
