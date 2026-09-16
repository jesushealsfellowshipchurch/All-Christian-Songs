/**
 * Vercel Serverless Function: /api/publish-song
 * Enables multi-device publishing for Vercel deployments.
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  const ADMIN_PASS = process.env.VITE_ADMIN_PASSWORD || 'sherwin1990';

  if (req.method === 'GET') {
    try {
      if (KV_URL && KV_TOKEN) {
        const response = await fetch(`${KV_URL}/get/jhf_custom_published_songs`, {
          headers: { Authorization: `Bearer ${KV_TOKEN}` }
        });
        const data = await response.json();
        const songs = data.result ? (typeof data.result === 'string' ? JSON.parse(data.result) : data.result) : [];
        return res.status(200).json({ success: true, songs: Array.isArray(songs) ? songs : [] });
      }
      return res.status(200).json({ success: true, songs: [] });
    } catch (err) {
      return res.status(200).json({ success: true, songs: [] });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const songPayload = body.song || body;
      const pass = body.password || req.headers['x-admin-password'];

      if (pass && pass !== ADMIN_PASS) {
        return res.status(401).json({ success: false, error: 'Unauthorized admin' });
      }

      const generatedId = crypto.randomUUID();
      const slug = (songPayload.title_transliterated || songPayload.title)
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-') || generatedId;

      const newSong = { ...songPayload, id: generatedId, slug };
      const indexEntry = {
        id: generatedId,
        slug,
        t: songPayload.title,
        tr: songPayload.title_transliterated || '',
        lang: songPayload.language || 'telugu',
        alpha: songPayload.title ? songPayload.title.charAt(0).toUpperCase() : 'A',
        chords: !!songPayload.chords,
        video: !!songPayload.youtube_id,
        yt: songPayload.youtube_id || '',
        ppt: true,
        cats: songPayload.category_names || ['Worship Songs'],
        books: songPayload.songbooks || [],
        auth: songPayload.author_english || songPayload.author_telugu || '',
        search: `${songPayload.title} ${songPayload.title_transliterated || ''} ${songPayload.author_english || ''}`.toLowerCase()
      };

      if (KV_URL && KV_TOKEN) {
        // Fetch existing custom songs
        const existingRes = await fetch(`${KV_URL}/get/jhf_custom_published_songs`, {
          headers: { Authorization: `Bearer ${KV_TOKEN}` }
        });
        const existingData = await existingRes.json();
        const existingList = existingData.result ? (typeof existingData.result === 'string' ? JSON.parse(existingData.result) : existingData.result) : [];
        const updatedList = [indexEntry, ...(Array.isArray(existingList) ? existingList : [])];

        // Save updated list
        await fetch(`${KV_URL}/set/jhf_custom_published_songs`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${KV_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(JSON.stringify(updatedList))
        });

        // Also save song detail object
        await fetch(`${KV_URL}/set/jhf_song_${slug}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${KV_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(JSON.stringify(newSong))
        });

        return res.status(200).json({ success: true, song: newSong, indexEntry, synced: true });
      }

      return res.status(200).json({ success: true, song: newSong, indexEntry, synced: false });
    } catch (err) {
      console.error('Error publishing song on serverless:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  res.status(405).json({ error: 'Method Not Allowed' });
}
