/**
 * Vercel Serverless Function: /api/pinned-songs
 * Enables real-time synchronization of pinned worship songs across all church members.
 * Supports Supabase REST API, Vercel KV / Upstash Redis, or fallback storage.
 */

export default async function handler(req, res) {
  // Enable CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  const ADMIN_PASS = process.env.VITE_ADMIN_PASSWORD || 'sherwin1990';

  // GET: Fetch pinned songs for all church members
  if (req.method === 'GET') {
    // 1. Try Supabase
    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/pinned_songs?select=*&order=pin_number.asc`, {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`
          }
        });
        if (response.ok) {
          const rows = await response.json();
          if (Array.isArray(rows)) {
            const formatted = rows.map(r => ({
              id: r.id,
              slug: r.slug || r.id,
              title: r.title,
              title_transliterated: r.title_transliterated || '',
              author: r.author || '',
              language: r.language || 'telugu',
              youtube_id: r.youtube_id || '',
              ppt_url: r.ppt_url || '',
              chords: !!r.chords,
              pinNumber: r.pin_number || 1,
              pinnedAt: r.pinned_at || new Date().toISOString()
            }));
            return res.status(200).json({ success: true, songs: formatted });
          }
        }
      } catch (err) {
        console.warn('Supabase fetch failed in serverless handler:', err);
      }
    }

    // 2. Try KV
    if (KV_URL && KV_TOKEN) {
      try {
        const response = await fetch(`${KV_URL}/get/jhf_pinned_songs`, {
          headers: { Authorization: `Bearer ${KV_TOKEN}` }
        });
        const data = await response.json();
        const songs = data.result ? (typeof data.result === 'string' ? JSON.parse(data.result) : data.result) : [];
        return res.status(200).json({ success: true, songs: Array.isArray(songs) ? songs : [] });
      } catch (err) {
        console.error('KV fetch failed:', err);
      }
    }

    return res.status(200).json({ success: true, songs: [] });
  }

  // POST: Admin updates pinned songs
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { songs, password } = body;

      // Validate admin password
      if (password !== ADMIN_PASS) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Invalid admin password' });
      }

      if (!Array.isArray(songs)) {
        return res.status(400).json({ success: false, error: 'Invalid songs array' });
      }

      // Sync to Supabase
      if (SUPABASE_URL && SUPABASE_KEY) {
        try {
          // Format rows for table pinned_songs
          const rows = songs.map(s => ({
            id: s.id || s.slug,
            slug: s.slug || s.id,
            title: s.title || 'Worship Song',
            title_transliterated: s.title_transliterated || '',
            author: s.author || '',
            language: s.language || 'telugu',
            youtube_id: s.youtube_id || '',
            ppt_url: s.ppt_url || '',
            chords: !!s.chords,
            pin_number: s.pinNumber || 1,
            pinned_at: s.pinnedAt || new Date().toISOString()
          }));

          // Upsert into Supabase
          await fetch(`${SUPABASE_URL}/rest/v1/pinned_songs`, {
            method: 'POST',
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              Prefer: 'resolution=merge-duplicates'
            },
            body: JSON.stringify(rows)
          });
        } catch (err) {
          console.warn('Supabase upsert failed in serverless handler:', err);
        }
      }

      // Sync to KV if present
      if (KV_URL && KV_TOKEN) {
        await fetch(`${KV_URL}/set/jhf_pinned_songs`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${KV_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(JSON.stringify(songs))
        });
      }

      return res.status(200).json({ success: true, songs, synced: true });
    } catch (err) {
      console.error('Error saving pinned songs:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  res.status(405).json({ error: 'Method Not Allowed' });
}
