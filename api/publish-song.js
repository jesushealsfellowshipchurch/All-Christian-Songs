/**
 * Vercel Serverless Function: /api/publish-song
 * DECOMMISSIONED (Phase 8B Security Containment)
 * Legacy password-based publishing is permanently disabled.
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

  // Fail-closed: Reject all publish and read requests on this legacy endpoint
  return res.status(410).json({
    success: false,
    error: 'This endpoint has been decommissioned. Legacy publishing is disabled.'
  });
}
