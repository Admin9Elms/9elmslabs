/**
 * GET /api/auth-verify?token=xxx
 * Verifies magic link token, creates session cookie, redirects to dashboard.
 */
import { verifyAuthToken, createSessionToken, getClient, invalidateAuthToken } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.query || {};
  if (!token) {
    return res.redirect(302, '/login.html?error=missing-token');
  }

  try {
    const authData = await verifyAuthToken(token);
    if (!authData) {
      return res.redirect(302, '/login.html?error=expired');
    }

    // Verify client still exists and is active
    const client = await getClient(authData.clientId);
    if (!client || client.status !== 'active') {
      return res.redirect(302, '/login.html?error=inactive');
    }

    // Invalidate the magic link so it can't be reused
    await invalidateAuthToken(token);

    // Create long-lived session (30 days)
    const sessionToken = await createSessionToken(authData.clientId);

    // Set cookie and redirect to dashboard
    res.setHeader('Set-Cookie', `9el_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}; Secure`);
    return res.redirect(302, '/dashboard.html');
  } catch (err) {
    console.error('Auth verify error:', err);
    return res.redirect(302, '/login.html?error=server');
  }
}
