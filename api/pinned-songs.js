/**
 * Vercel Serverless Function: /api/pinned-songs
 * DECOMMISSIONED (Phase 8B Security Containment)
 * Legacy password-based pinning is permanently disabled.
 * Pinned songs are retrieved directly via Supabase client with static JSON fallback.
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Fail-closed: Reject all modifications and legacy serverless queries
  return res.status(410).json({
    success: false,
    error: 'This endpoint has been decommissioned. Pinned songs are managed via Supabase.'
  });
}
